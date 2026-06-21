// ==============================================================
// APP.JS — Main controller (Modo Híbrido Real + Simulação)
//
// LÓGICA CENTRAL:
//   1. Busca resultados reais já encerrados (live.js)
//   2. Aplica os resultados reais na tabela de grupos
//   3. DURANTE a Fase de Grupos: exibe apenas pontuação real (sem simulação)
//      → Tabela detalhada: J V E D GP GC SG Pts + barra de progresso
//   4. APÓS a Fase de Grupos: simula o mata-mata completo (determinístico)
//      → Re-simula apenas quando novos jogos forem encerrados
//   5. Polling: 30s com jogo ao vivo, 3min caso contrário
//   6. Traduções dinâmicas completas via tTeam() + t()
// Configuração manual do Próximo Jogo (fallback se a API não retornar)
const NEXT_MATCH = {
    home: 'Netherlands',
    away: 'Sweden',
    time: 'Hoje, 14:00'
};

let cachedData = null;
let _pollingTimer = null;
let _countdownTimer = null;
let _countdownSeconds = 0;
let _isRefreshing = false;

// Controle de estabilidade da simulação:
// Só re-simula quando o número de jogos encerrados muda
let _lastFinishedCount = -1;
let _cachedSimulation  = null;

// Controle de fase: mata-mata só liberado após fase de grupos completa
let _groupStageWasComplete = false;

// ── PERSISTÊNCIA LOCAL (localStorage) ───────────────────────────────
// Garante que os resultados da fase de grupos NUNCA se percam,
// mesmo que a API falhe ou o usuário recarregue a página.
//
// Estratégia (custo ZERO — apenas browser nativo):
//   1. A cada ciclo bem-sucedido, salva _liveResultsCache no localStorage
//   2. Ao iniciar, mescla dados ao vivo com os resultados já persistidos
//      (união: dados ao vivo têm prioridade; localStorage preenche lacunas)
//   3. Ao encerrar a fase de grupos, salva snapshot imutável do Elo dinâmico
//   4. O snapshot é usado como base fixa para toda a simulação do mata-mata
//
const _SKEY = {
    results:  'bolao2026_v1_results',  // resultados processados da fase de grupos
    eloSnap:  'bolao2026_v1_elo',      // snapshot Elo pós-fase de grupos (imutável)
    meta:     'bolao2026_v1_meta'      // metadados: savedAt, finishedCount
};

function _saveResultsToStorage(results) {
    if (!results || Object.keys(results).length === 0) return;
    try {
        localStorage.setItem(_SKEY.results, JSON.stringify(results));
        localStorage.setItem(_SKEY.meta, JSON.stringify({
            savedAt: new Date().toISOString(),
            finishedCount: Object.keys(results).length
        }));
    } catch (e) {
        console.warn('[Storage] Falha ao salvar resultados:', e.message);
    }
}

function _loadResultsFromStorage() {
    try {
        const raw = localStorage.getItem(_SKEY.results);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed && Object.keys(parsed).length > 0) return parsed;
    } catch (e) { console.warn('[Storage] Falha ao carregar resultados:', e.message); }
    return null;
}

// Une resultados ao vivo com resultados do localStorage.
// Dados ao vivo têm prioridade; localStorage preenche o que a API não trouxe.
// Resultados só crescem — nunca desaparecem — portanto a união é sempre segura.
function _mergeWithStoredResults(liveResults) {
    const stored = _loadResultsFromStorage();
    if (!stored) return liveResults || {};
    if (!liveResults || Object.keys(liveResults).length === 0) {
        console.warn('[Storage] API sem dados — usando resultados do localStorage (' + Object.keys(stored).length + ' jogos)');
        return stored;
    }
    // A API pode ter menos dados que o localStorage (falha parcial)
    // Usa o localStorage como base e sobrescreve com dados ao vivo
    const merged = { ...stored, ...liveResults };
    if (Object.keys(merged).length > Object.keys(liveResults).length) {
        console.info(`[Storage] 📦 Mesclado: ${Object.keys(liveResults).length} ao vivo + ${Object.keys(merged).length - Object.keys(liveResults).length} do localStorage`);
    }
    return merged;
}

// Snapshot imutável do Elo dinâmico após encerramento da fase de grupos.
// Salvo UMA Única vez — serve como base fixa para o mata-mata inteiro.
function _saveEloSnapshot(dynPts) {
    if (localStorage.getItem(_SKEY.eloSnap)) return; // já existe — não sobrescreve
    try {
        localStorage.setItem(_SKEY.eloSnap, JSON.stringify({
            pts: dynPts,
            savedAt: new Date().toISOString(),
            locked: true
        }));
        console.info('🔒 [Storage] Snapshot Elo pós-fase de grupos salvo permanentemente no localStorage.');
    } catch (e) { console.warn('[Storage] Falha ao salvar snapshot Elo:', e.message); }
}

function _loadEloSnapshot() {
    try {
        const raw = localStorage.getItem(_SKEY.eloSnap);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (parsed?.pts && Object.keys(parsed.pts).length > 0) {
            console.info(`📦 [Storage] Snapshot Elo carregado (salvo em ${parsed.savedAt})`);
            return parsed.pts;
        }
    } catch (e) { console.warn('[Storage] Falha ao carregar snapshot Elo:', e.message); }
    return null;
}

// ── SECURITY ──────────────────────────────────────────────────
function escapeHTML(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

// ── UTILITY ───────────────────────────────────────────────────

// Formata uma partida com placar (encerrado ou ao vivo)
// Nomes traduzidos via tTeam() no momento da renderização
function formatMatch(matchString, finishedResults = null, liveScores = null) {
    const teams = matchString.split(' vs ');
    if (teams.length !== 2) return matchString;

    const [engA, engB] = teams;
    const a = tTeam(engA); // nome traduzido para exibição
    const b = tTeam(engB);

    const key1 = matchString;
    const key2 = `${engB} vs ${engA}`;

    // Jogo ao vivo → placar pulsante
    const liveResult = liveScores ? (liveScores[key1] || liveScores[key2]) : null;
    // Jogo encerrado → placar fixo
    const doneResult = finishedResults ? (finishedResults[key1] || finishedResults[key2]) : null;

    let scoreHtml = '';
    if (liveResult) {
        const min = liveResult.minute
            ? `<span class="match-minute">${liveResult.minute}'</span>` : '';
        scoreHtml = `<span class="match-score live-score">${liveResult.homeScore}–${liveResult.awayScore}${min}</span>`;
    } else if (doneResult && doneResult.homeScore >= 0) {
        scoreHtml = `<span class="match-score real">${doneResult.homeScore}–${doneResult.awayScore}</span>`;
    }

    return `<span class="team-a">${a}</span>${scoreHtml}<span class="vs">${t('vs')}</span><span class="team-b">${b}</span>`;
}

function setStatus(mode, sourceLabel = '', hasLive = false) {
    const dot = document.querySelector('.pulse-dot');
    const statusText = document.getElementById('status-text');
    if (mode === 'live') {
        dot.classList.add('live');
        statusText.textContent = hasLive ? t('status_live_playing') : t('status_live');
    } else {
        dot.classList.remove('live');
        statusText.textContent = t('status_simulation');
    }
}

// ── MOTOR HÍBRIDO: Integra resultados reais + simula o resto ──
// Etapas:
//   1. Computa Elo dinâmico (pontos atualizados após resultados reais)
//   2. Aplica resultados reais fixos na fase de grupos
//   3. Simula jogos ainda não realizados de forma DETERMINÍSTICA
//      → quem tem maior probabilidade (Elo atualizado) SEMPRE vence
//   4. Monta o chaveamento do mata-mata com a mesma lógica
function runHybridSimulation(liveResults) {
    const hasLive = liveResults && Object.keys(liveResults).length > 0;

    // ── PASSO 1: Elo dinâmico ─────────────────────────────────
    // Recalcula pontos de todas as seleções considerando resultados reais
    const dynPts = computeDynamicElo(liveResults);

    // Helper determinístico local
    function resolveMatch(teamA, teamB) {
        const real = liveResults?.[`${teamA} vs ${teamB}`]
                  || liveResults?.[`${teamB} vs ${teamA}`];
        if (real?.winner) return real.winner;
        // Determinístico: maior probabilidade Elo sempre vence
        return simulateMatchDeterministic(teamA, teamB, dynPts);
    }

    // ── PASSO 2: Fase de Grupos ───────────────────────────────
    const groupResults = {};

    for (const [groupName, teams] of Object.entries(WORLD_CUP_2026_GROUPS)) {
        const standings = teams.map(team => ({
            name: team,
            pts: 0, gf: 0, ga: 0,
            rank: getFifaRank(team),
            fifaPoints: dynPts[team] ?? getFifaPoints(team),  // usa Elo atualizado
            realMatches: 0
        }));

        for (let i = 0; i < standings.length; i++) {
            for (let j = i + 1; j < standings.length; j++) {
                const home = standings[i];
                const away = standings[j];
                const key1 = `${home.name} vs ${away.name}`;
                const key2 = `${away.name} vs ${home.name}`;
                const real = liveResults?.[key1] || liveResults?.[key2];

                if (real && real.winner !== undefined) {
                    // ✅ RESULTADO REAL — aplica diretamente (fixo)
                    let hs, as;
                    if (real === liveResults?.[key1]) {
                        hs = real.homeScore;
                        as = real.awayScore;
                    } else {
                        hs = real.awayScore;
                        as = real.homeScore;
                    }
                    
                    home.gf += hs; home.ga += as;
                    away.gf += as; away.ga += hs;
                    home.realMatches++; away.realMatches++;
                    if (hs > as)      { home.pts += 3; }
                    else if (hs < as) { away.pts += 3; }
                    else              { home.pts += 1; away.pts += 1; }
                } else {
                    // 🔵 SIMULAÇÃO DETERMINÍSTICA — Elo dinâmico, sem aleatoriedade
                    const probHome = winProbabilityDynamic(home.name, away.name, dynPts);
                    if (probHome > 0.5)      { home.pts += 3; }
                    else if (probHome < 0.5) { away.pts += 3; }
                    else                      { home.pts += 1; away.pts += 1; } // empate técnico
                }
            }
        }

        standings.sort((a, b) =>
            b.pts - a.pts ||
            (b.gf - b.ga) - (a.gf - a.ga) ||
            b.fifaPoints - a.fifaPoints
        );
        groupResults[groupName] = standings;
    }

    // ── PASSO 3: Mata-Mata ────────────────────────────────────
    const groupLetters = Object.keys(WORLD_CUP_2026_GROUPS);
    const groupWinners = {}, groupRunnersUp = {};
    const thirdPlace = [];

    for (const [g, standings] of Object.entries(groupResults)) {
        groupWinners[g]   = standings[0];
        groupRunnersUp[g] = standings[1];
        thirdPlace.push({ ...standings[2], group: g });
    }
    thirdPlace.sort((a, b) => b.pts - a.pts || b.fifaPoints - a.fifaPoints);
    const best8Third = thirdPlace.slice(0, 8);

    // Round of 32 — 16 partidas
    const r32Matches = [], r32Winners = [];
    for (let i = 0; i < 12; i++) {
        const w  = groupWinners[groupLetters[i]].name;
        const ru = groupRunnersUp[groupLetters[11 - i]].name;
        r32Matches.push(`${w} vs ${ru}`);
        r32Winners.push(resolveMatch(w, ru));
    }
    for (let i = 0; i < 4; i++) {
        const a = best8Third[i]?.name     || groupRunnersUp[groupLetters[i]].name;
        const b = best8Third[i + 4]?.name || groupRunnersUp[groupLetters[i + 6]].name;
        r32Matches.push(`${a} vs ${b}`);
        r32Winners.push(resolveMatch(a, b));
    }

    // Round of 16
    const r16Matches = [], r16Winners = [];
    for (let i = 0; i < 8; i++) {
        const a = r32Winners[i * 2], b = r32Winners[i * 2 + 1];
        r16Matches.push(`${a} vs ${b}`);
        r16Winners.push(resolveMatch(a, b));
    }

    // Quartas
    const qfMatches = [], qfWinners = [];
    for (let i = 0; i < 4; i++) {
        const a = r16Winners[i * 2], b = r16Winners[i * 2 + 1];
        qfMatches.push(`${a} vs ${b}`);
        qfWinners.push(resolveMatch(a, b));
    }

    // Semis
    const sfMatches = [], sfWinners = [];
    for (let i = 0; i < 2; i++) {
        const a = qfWinners[i * 2], b = qfWinners[i * 2 + 1];
        sfMatches.push(`${a} vs ${b}`);
        sfWinners.push(resolveMatch(a, b));
    }

    // Final
    const finalMatch = [`${sfWinners[0]} vs ${sfWinners[1]}`];
    const champion   = resolveMatch(sfWinners[0], sfWinners[1]);

    return {
        tournament: 'FIFA World Cup 2026',
        generatedAt: new Date().toISOString(),
        source: hasLive ? 'live' : 'simulation',
        fifaRankingDate: 'Dynamic (post-results Elo)',
        realMatchesUsed: hasLive ? Object.keys(liveResults).length : 0,
        groups: Object.entries(groupResults).map(([name, standings]) => ({
            name: `Group ${name}`,
            standings: standings.map(s => ({
                name: s.name,
                pts: s.pts,
                fifaRank: s.rank,
                fifaPoints: s.fifaPoints,
                realMatches: s.realMatches || 0,
                dynPts: dynPts[s.name] ?? getFifaPoints(s.name)
            }))
        })),
        knockout: {
            roundOf32:    r32Matches,
            roundOf16:    r16Matches,
            quarterFinals: qfMatches,
            semiFinals:   sfMatches,
            final:        finalMatch,
            champion
        }
    };
}

// ── RENDER FUNCTIONS ─────────────────────────────────────────

function renderChampion(champion, mode, realMatches = 0) {
    // Nome do campeão traduzido
    document.getElementById('champion-name').textContent = tTeam(champion);

    const rank = getFifaRank(champion);
    const pts  = getFifaPoints(champion).toFixed(2);
    document.getElementById('champion-rank-badge').textContent =
        `${t('rank')} #${rank} • ${pts} ${t('pts')}`;

    const tag = document.getElementById('data-source-tag');
    if (mode === 'live' && realMatches > 0) {
        const matchWord = realMatches === 1 ? t('real_match') : t('real_matches');
        tag.textContent = `${t('source_live')} — ${realMatches} ${matchWord} + ${t('source_simulation').toLowerCase()}`;
    } else {
        tag.textContent = t('source_simulation');
    }
    document.getElementById('champion-section').style.display = '';
}

function renderMatchList(elementId, matches, finishedResults = null, liveScores = null) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    ul.innerHTML = '';
    matches.forEach(match => {
        const li = document.createElement('li');
        li.className = 'match-item fade-in';

        const teams = match.split(' vs ');
        const key1  = match;
        const key2  = teams.length === 2 ? `${teams[1]} vs ${teams[0]}` : null;
        const isLive = liveScores && (liveScores[key1] || (key2 ? liveScores[key2] : null));
        if (isLive) li.classList.add('live-match');

        li.innerHTML = formatMatch(match, finishedResults, liveScores);
        ul.appendChild(li);
    });
}

function renderGroups(groups) {
    const container = document.getElementById('groups');
    container.innerHTML = '';
    groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'group-card';

        const title = document.createElement('h3');
        // "Group A" → "Grupo A" / "Group A" / "Grupo A"
        title.textContent = group.name.replace(/^Group\s+/, `${t('group')} `);
        card.appendChild(title);

        group.standings.forEach((team, idx) => {
            const row = document.createElement('div');
            row.className = 'group-team' + (idx < 2 ? ' qualified' : '');

            const nameSpan = document.createElement('span');
            // Nome traduzido para exibição
            nameSpan.textContent = tTeam(team.name);

            if (team.realMatches > 0) {
                const realBadge = document.createElement('span');
                realBadge.className = 'real-badge';
                realBadge.title = `${team.realMatches} ${t('real_match_title')}`;
                // Ponto verde sutil — indica dados reais (não simulação)
                nameSpan.appendChild(realBadge);
            }

            const meta = document.createElement('span');
            meta.className = 'team-pts';
            const rankTag = document.createElement('span');
            rankTag.className = 'team-rank-tag';
            rankTag.textContent = `#${team.fifaRank}`;
            meta.appendChild(rankTag);
            meta.insertAdjacentText('beforeend', ` ${team.pts} ${t('pts')}`);

            row.appendChild(nameSpan);
            row.appendChild(meta);
            card.appendChild(row);
        });

        container.appendChild(card);
    });
}

// ── RENDER: Fase de Grupos em andamento (sem mata-mata) ────
// Exibe tabela detalhada + barra de progresso + mensagem de espera
function renderGroupsOnlyView(groups, finished, total) {
    // Oculta seções do mata-mata e campeão
    document.getElementById('knockout-section').style.display = 'none';
    document.getElementById('champion-section').style.display = 'none';

    // Barra de progresso
    const pct = total > 0 ? Math.round((finished / total) * 100) : 0;
    let progressBar = document.getElementById('group-progress-bar');
    if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.id = 'group-progress-bar';
        progressBar.className = 'group-progress-bar';
        const groupsSection = document.getElementById('groups-section');
        groupsSection.parentNode.insertBefore(progressBar, groupsSection);
    }
    progressBar.innerHTML = `
        <div class="progress-header">
            <span class="progress-icon">⏳</span>
            <div class="progress-info">
                <span class="progress-label">${t('groups_in_progress')}</span>
                <span class="progress-sub">${t('simulation_pending')}</span>
            </div>
            <span class="progress-count">${finished}<span class="progress-sep">/</span>${total}</span>
        </div>
        <div class="progress-track">
            <div class="progress-fill" style="width: ${pct}%">
                <span class="progress-pct">${pct}%</span>
            </div>
        </div>
    `;

    // Tabela dos grupos (formato detalhado: J V E D GP GC Pts)
    const container = document.getElementById('groups');
    container.innerHTML = '';
    groups.forEach(group => {
        const card = document.createElement('div');
        card.className = 'group-card group-card--detailed';

        const title = document.createElement('h3');
        title.textContent = group.name.replace(/^Group\s+/, `${t('group')} `);
        card.appendChild(title);

        // Cabeçalho da tabela
        const header = document.createElement('div');
        header.className = 'group-table-header';
        header.innerHTML = `
            <span class="col-team">${t('team_col')}</span>
            <span class="col-stat">J</span>
            <span class="col-stat">V</span>
            <span class="col-stat">E</span>
            <span class="col-stat">D</span>
            <span class="col-stat">GP</span>
            <span class="col-stat">GC</span>
            <span class="col-stat">SG</span>
            <span class="col-stat col-pts">${t('pts')}</span>
        `;
        card.appendChild(header);

        group.standings.forEach((team, idx) => {
            const row = document.createElement('div');
            // Top 2 qualificados, 3º pode qualificar (cor amarela)
            let rowClass = 'group-team group-team--detailed';
            if (idx < 2) rowClass += ' qualified';
            else if (idx === 2) rowClass += ' third-place';
            row.className = rowClass;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'col-team';
            nameSpan.textContent = tTeam(team.name);
            if (team.realMatches > 0) {
                const badge = document.createElement('span');
                badge.className = 'real-badge';
                badge.title = `${team.realMatches} ${t('real_match_title')}`;
                nameSpan.appendChild(badge);
            }

            const played  = document.createElement('span'); played.className = 'col-stat';  played.textContent = team.played  ?? 0;
            const wins    = document.createElement('span'); wins.className   = 'col-stat';  wins.textContent   = team.wins    ?? 0;
            const draws   = document.createElement('span'); draws.className  = 'col-stat';  draws.textContent  = team.draws   ?? 0;
            const losses  = document.createElement('span'); losses.className = 'col-stat';  losses.textContent = team.losses  ?? 0;
            const gf      = document.createElement('span'); gf.className     = 'col-stat';  gf.textContent     = team.gf      ?? 0;
            const ga      = document.createElement('span'); ga.className     = 'col-stat';  ga.textContent     = team.ga      ?? 0;
            const gd      = document.createElement('span'); gd.className     = 'col-stat';  const gdVal = (team.gd ?? 0); gd.textContent = gdVal > 0 ? `+${gdVal}` : gdVal;
            const pts     = document.createElement('span'); pts.className    = 'col-stat col-pts'; pts.textContent = team.pts ?? 0;

            row.appendChild(nameSpan);
            row.appendChild(played);
            row.appendChild(wins);
            row.appendChild(draws);
            row.appendChild(losses);
            row.appendChild(gf);
            row.appendChild(ga);
            row.appendChild(gd);
            row.appendChild(pts);
            card.appendChild(row);
        });

        container.appendChild(card);
    });
}

function renderRankingTable() {
    const container = document.getElementById('ranking-table');
    const entries = Object.entries(FIFA_RANKINGS)
        .sort((a, b) => a[1].rank - b[1].rank)
        .slice(0, 32);

    const grid = document.createElement('div');
    grid.className = 'ranking-grid';

    entries.forEach(([teamEn, info]) => {
        const row = document.createElement('div');
        row.className = 'ranking-row';

        const pos = document.createElement('div');
        pos.className = 'ranking-pos' + (info.rank <= 3 ? ' top3' : '');
        pos.textContent = info.rank;

        const name = document.createElement('div');
        name.className = 'ranking-team';
        name.textContent = tTeam(teamEn); // nome traduzido

        const pts = document.createElement('div');
        pts.className = 'ranking-pts';
        pts.textContent = `${info.points.toFixed(2)} ${t('pts')}`;

        row.appendChild(pos);
        row.appendChild(name);
        row.appendChild(pts);
        grid.appendChild(row);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function updateTimestamp(source, realCount, hasLive) {
    const el = document.getElementById('last-updated-text');
    const localeMap = { pt: 'pt-BR', en: 'en-GB', es: 'es-ES' };
    const now = new Date().toLocaleString(localeMap[currentLang] || 'pt-BR');
    let txt = `${t('last_updated')}: ${now}`;
    if (realCount > 0) txt += ` • ${realCount} ${t('real_integrated')}`;
    if (hasLive)       txt += ` • 🔴 ${t('live_score')}`;
    el.textContent = txt;
}

// ── MAIN RENDER ──────────────────────────────────────────────
function renderApp() {
    if (!cachedData) return;

    const data      = cachedData;
    const live      = window._liveResultsCache || null;
    const liveScores = window._liveScoresCache  || null;

    if (data.groupStageComplete) {
        document.getElementById('knockout-section').style.display = '';
        renderChampion(data.knockout.champion, data.source, data.realMatchesUsed);
        renderMatchList('final-match',    data.knockout.final,          live, liveScores);
        renderMatchList('semi-finals',    data.knockout.semiFinals,     live, liveScores);
        renderMatchList('quarter-finals', data.knockout.quarterFinals,  live, liveScores);
        renderMatchList('round-16',       data.knockout.roundOf16,      live, liveScores);
        renderMatchList('round-32',       data.knockout.roundOf32,      live, liveScores);
        renderGroups(data.groups);
    } else {
        renderGroupsOnlyView(data.groups, data.realMatchesUsed, getTotalGroupMatches());
    }

    renderRankingTable();
    updateTimestamp(data.source, data.realMatchesUsed, data.hasLive);

    // Atualiza elementos estáticos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    document.title = t('title').replace(/^🏆\s*/, '') || 'Simulador - Copa do Mundo 2026';

    // RENDERIZA JOGOS AO VIVO E PREVIEW
    renderLiveMatches(window._liveScoresCache, data.groups);
    renderNextMatchPreview();
}

function renderNextMatchPreview() {
    const sec = document.getElementById('next-match-section');
    
    // Procura o próximo jogo na lista 'upcomingMatches' que NÃO esteja já rolando e nem finalizado
    let bestMatch = null;
    if (window._upcomingMatchesCache && window._upcomingMatchesCache.length > 0) {
        for (const match of window._upcomingMatchesCache) {
            const key1 = `${match.home} vs ${match.away}`;
            const key2 = `${match.away} vs ${match.home}`;
            
            const isLive = window._liveScoresCache && (window._liveScoresCache[key1] || window._liveScoresCache[key2]);
            const isFinished = window._liveResultsCache && (window._liveResultsCache[key1] || window._liveResultsCache[key2]);
            
            if (!isLive && !isFinished) {
                bestMatch = match;
                break; // Achou o mais próximo no futuro verdadeiro!
            }
        }
    }

    const matchData = bestMatch || window._nextMatchCache || NEXT_MATCH;

    if (!sec || !matchData) {
        if (sec) sec.style.display = 'none';
        return;
    }

    sec.style.display = '';
    sec.innerHTML = '';

    let displayTime = matchData.time || 'A definir';
    if (matchData.utcDate) {
        const d = new Date(matchData.utcDate);
        displayTime = d.toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
    }

    const ISO_MAP = {
        "France":"fr","Spain":"es","Argentina":"ar","England":"gb-eng","Portugal":"pt",
        "Brazil":"br","Netherlands":"nl","Morocco":"ma","Belgium":"be","Germany":"de",
        "Croatia":"hr","Colombia":"co","Senegal":"sn","Mexico":"mx","United States":"us",
        "Uruguay":"uy","Japan":"jp","Switzerland":"ch","Austria":"at","Ecuador":"ec",
        "South Korea":"kr","Tunisia":"tn","Sweden":"se","Egypt":"eg","Iran":"ir",
        "Australia":"au","Canada":"ca","Czech Republic":"cz","Algeria":"dz","Scotland":"gb-sct",
        "Turkey":"tr","Panama":"pa","Saudi Arabia":"sa","Qatar":"qa","Ivory Coast":"ci",
        "Iraq":"iq","Paraguay":"py","South Africa":"za","Ghana":"gh","Bosnia and Herzegovina":"ba",
        "Cape Verde":"cv","New Zealand":"nz","Jordan":"jo","Democratic Republic of the Congo":"cd",
        "Norway":"no","Curaçao":"cw","Uzbekistan":"uz","Haiti":"ht"
    };

    const homeFlag = ISO_MAP[matchData.home] ? `https://flagcdn.com/w80/${ISO_MAP[matchData.home]}.png` : 'flags/default.svg';
    const awayFlag = ISO_MAP[matchData.away] ? `https://flagcdn.com/w80/${ISO_MAP[matchData.away]}.png` : 'flags/default.svg';

    const card = document.createElement('div');
    card.className = 'next-match-widget';
    card.innerHTML = `
        <div class="nm-header">
            <span class="nm-pulse"></span>
            <span class="nm-title">PRÓXIMO JOGO</span>
        </div>
        <div class="nm-content">
            <div class="nm-team">
                <img src="${homeFlag}" class="nm-flag" alt="${tTeam(matchData.home)}">
                <div class="nm-name">${tTeam(matchData.home)}</div>
            </div>
            <div class="nm-vs">
                <div class="nm-vs-text">VS</div>
                <div class="nm-time">${displayTime}</div>
            </div>
            <div class="nm-team">
                <img src="${awayFlag}" class="nm-flag" alt="${tTeam(matchData.away)}">
                <div class="nm-name">${tTeam(matchData.away)}</div>
            </div>
        </div>
    `;
    sec.appendChild(card);
}

// ── REFRESH COM SIMULAÇÃO CONDICIONAL ────────────────────────────────
async function refresh() {
    if (_isRefreshing) return; // evita chamadas concorrentes
    _isRefreshing = true;
    _updateCountdownUI();

    try {
        const liveSource = await getDataSource();

        window._liveResultsCache = liveSource.data       || null;
        window._liveScoresCache  = liveSource.liveScores || null;
        window._nextMatchCache   = liveSource.nextMatch  || null;
        window._upcomingMatchesCache = liveSource.upcomingMatches || [];
        window._hasScraperError  = liveSource.hasScraperError || false;

        // ── PERSISTÊNCIA: salva e mescla com resultados históricos ────────
        if (window._liveResultsCache && Object.keys(window._liveResultsCache).length > 0) {
            _saveResultsToStorage(window._liveResultsCache);
        }
        window._liveResultsCache = _mergeWithStoredResults(window._liveResultsCache);

        const finishedCount = window._liveResultsCache
            ? Object.keys(window._liveResultsCache).length : 0;
        const hasLive = liveSource.hasLive || false;

        setStatus(liveSource.mode,
            liveSource.source !== 'simulation' ? liveSource.source : '',
            hasLive);

        // ── Verifica se a fase de grupos está completa ──────────────────────
        const groupsDone = isGroupStageComplete(window._liveResultsCache);

        if (groupsDone) {
            // ✅ Fase de grupos ENCERRADA — simula mata-mata
            if (finishedCount !== _lastFinishedCount || _cachedSimulation === null
                    || _cachedSimulation.source === 'groups_only') {
                console.info(`[App] 🔄 Nova simulação completa (${finishedCount} jogos, grupos encerrados)`);
                _lastFinishedCount = finishedCount;

                // Salva snapshot Elo pós-grupos
                const dynPts = computeDynamicElo(window._liveResultsCache);
                _saveEloSnapshot(dynPts);

                _cachedSimulation  = runHybridSimulation(window._liveResultsCache);
                _cachedSimulation.groupStageComplete = true;
            } else {
                console.info(`[App] ✅ Simulação estável (${finishedCount} jogos, sem novidades)`);
            }
            if (!_groupStageWasComplete) {
                _groupStageWasComplete = true;
                console.info('[App] 🎉 Fase de grupos encerrada! Mata-mata desbloqueado.');
            }
        } else {
            // ⏳ Fase de grupos EM ANDAMENTO — apenas acumula pontuação real
            if (finishedCount !== _lastFinishedCount || _cachedSimulation === null) {
                console.info(`[App] 📊 Grupos em andamento (${finishedCount}/${getTotalGroupMatches()} jogos encerrados)`);
                _lastFinishedCount = finishedCount;
                _cachedSimulation  = buildGroupsOnlyView(window._liveResultsCache, window._liveScoresCache);
                _cachedSimulation.groupStageComplete = false;
            } else {
                console.info(`[App] ⏳ Aguardando mais jogos (${finishedCount}/${getTotalGroupMatches()} encerrados)`);
            }
            _groupStageWasComplete = false;
        }

        // Atualiza metadados sem re-simular
        _cachedSimulation.source   = liveSource.mode;
        _cachedSimulation.hasLive  = hasLive;
        cachedData = _cachedSimulation;

        renderApp();

        // Polling adaptativo inteligente
        const interval = getPollingInterval(hasLive);
        console.info(`[App] ⏱ Próxima atualização em ${interval}s`);
        scheduleNextRefresh(interval);

    } finally {
        _isRefreshing = false;
        _updateCountdownUI();
    }
}

// ── POLLING INTELIGENTE ──────────────────────────────────────────
// Intervalo adaptativo baseado em estado:
//   20s → jogo ao vivo
//   45s → horário de jogo (12h–23h hora local)
//   90s → fora do horário
function getPollingInterval(hasLive) {
    if (hasLive) return 60;
    const hour = new Date().getHours();
    // Copa do Mundo 2026: jogos entre 12h e 23h (BRT)
    const isGameHour = hour >= 12 && hour <= 23;
    return isGameHour ? 45 : 90;
}

// ── COUNTDOWN REGRESSIVO ─────────────────────────────────────────
function startCountdown(seconds) {
    if (_countdownTimer) clearInterval(_countdownTimer);
    _countdownSeconds = seconds;
    _updateCountdownUI();
    _countdownTimer = setInterval(() => {
        _countdownSeconds = Math.max(0, _countdownSeconds - 1);
        _updateCountdownUI();
    }, 1000);
}

function _updateCountdownUI() {
    const el = document.getElementById('next-update-countdown');
    if (!el) return;
    if (_isRefreshing) {
        el.textContent = t('refreshing');
        el.classList.add('refreshing');
        return;
    }
    el.classList.remove('refreshing');
    el.textContent = `${t('next_update')} ${_countdownSeconds}${t('seconds')}`;
}

function scheduleNextRefresh(seconds) {
    if (_pollingTimer) clearTimeout(_pollingTimer);
    _pollingTimer = setTimeout(refresh, seconds * 1000);
    startCountdown(seconds);
}

// ── PAGE VISIBILITY: pausa quando aba oculta, atualiza ao retornar ──
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Suspende polling e countdown
        if (_pollingTimer)   clearTimeout(_pollingTimer);
        if (_countdownTimer) clearInterval(_countdownTimer);
        console.info('[App] 👁 Aba oculta — polling suspenso');
    } else {
        // Aba voltou a ser visível → atualiza imediatamente
        console.info('[App] 👁 Aba visível — refresh imediato');
        if (_pollingTimer)   clearTimeout(_pollingTimer);
        if (_countdownTimer) clearInterval(_countdownTimer);
        refresh();
    }
});

// ── INIT ─────────────────────────────────────────────────
async function init() {
    await refresh();

    document.getElementById('loading-state').style.display   = 'none';
    // Grupos e ranking sempre visíveis
    document.getElementById('groups-section').style.display  = '';
    document.getElementById('ranking-section').style.display = '';
    // Mata-mata e campeão só visíveis quando fase de grupos encerrar
    // (controlado por renderApp() → renderGroupsOnlyView ou renderChampion)

    renderApp();
}

window.renderApp = renderApp;

document.addEventListener('DOMContentLoaded', () => {
    setLang(currentLang);
    init();

    // Easter egg para testar a animacao de gol
    const mainTitle = document.querySelector('h1');
    if (mainTitle) {
        mainTitle.style.cursor = 'pointer';
        mainTitle.title = 'Clique para simular um Gol!';
        mainTitle.addEventListener('click', () => {
            if (window.triggerGoalAnimation) {
                const liveMatches = window._liveScoresCache ? Object.keys(window._liveScoresCache) : [];
                if (liveMatches.length > 0) {
                    const parts = liveMatches[0].split(' vs ');
                    window.triggerGoalAnimation(parts[0], parts[0], parts[1]);
                } else {
                    window.triggerGoalAnimation('Espanha', 'Espanha', 'Seleção Rival');
                }
            }
        });
    }
});

window._previousScores = {};
window._previousHomeScores = {};
window._previousAwayScores = {};

window.triggerGoalAnimation = function(scoringTeam, homeName, awayName) {
    const overlay = document.createElement('div');
    overlay.className = 'goal-overlay';
    overlay.innerHTML = `
        <div class="goal-net"></div>
        <div class="goal-ball">⚽</div>
        <div class="goal-text">GOL DA ${tTeam(scoringTeam).toUpperCase()}!</div>
        <div class="goal-teams">${tTeam(homeName)} vs ${tTeam(awayName)}</div>
    `;
    document.body.appendChild(overlay);

    const audio = new Audio('https://www.myinstants.com/media/sounds/gol_1.mp3');
    audio.volume = 0.9;
    audio.play().catch(e => console.warn('Audio blocked:', e));

    if (typeof confetti === 'function') {
        confetti({
            particleCount: 200,
            spread: 120,
            origin: { y: 0.6 },
            colors: ['#fedb00', '#00ff66', '#00ffff', '#ffffff']
        });
        setTimeout(() => confetti({ particleCount: 100, spread: 160, origin: { y: 0.7 }}), 600);
    }

    setTimeout(() => {
        overlay.classList.add('fade-out');
        setTimeout(() => overlay.remove(), 1000);
    }, 4500);
};

// ── RENDER LIVE MATCHES ──────────────────────────────────────
function renderLiveMatches(liveScores, groups) {
    const sec = document.getElementById('live-matches-section');
    if (!sec) return;
    
    if (!liveScores || Object.keys(liveScores).length === 0) {
        sec.style.display = 'none';
        return;
    }
    
    sec.style.display = '';
    sec.innerHTML = '';
    
    const ISO_MAP = {
        "France":"fr","Spain":"es","Argentina":"ar","England":"gb-eng","Portugal":"pt",
        "Brazil":"br","Netherlands":"nl","Morocco":"ma","Belgium":"be","Germany":"de",
        "Croatia":"hr","Colombia":"co","Senegal":"sn","Mexico":"mx","United States":"us",
        "Uruguay":"uy","Japan":"jp","Switzerland":"ch","Austria":"at","Ecuador":"ec",
        "South Korea":"kr","Tunisia":"tn","Sweden":"se","Egypt":"eg","Iran":"ir",
        "Australia":"au","Canada":"ca","Czech Republic":"cz","Algeria":"dz","Scotland":"gb-sct",
        "Turkey":"tr","Panama":"pa","Saudi Arabia":"sa","Qatar":"qa","Ivory Coast":"ci",
        "Iraq":"iq","Paraguay":"py","South Africa":"za","Ghana":"gh","Bosnia and Herzegovina":"ba",
        "Cape Verde":"cv","New Zealand":"nz","Jordan":"jo","Democratic Republic of the Congo":"cd",
        "Norway":"no","Curaçao":"cw","Uzbekistan":"uz","Haiti":"ht"
    };

    Object.entries(liveScores).forEach(([key, m]) => {
        const parts = key.split(' vs ');
        const homeName = parts[0];
        const awayName = parts[1];
        let groupName = 'Copa';
        let homeRankPos = '';
        let awayRankPos = '';
        if (groups) {
            const g = groups.find(x => x.standings.some(s => s.name === homeName));
            if (g) {
                groupName = t('groups') + ' · ' + g.name;
                const hs = g.standings.find(s => s.name === homeName);
                const as = g.standings.find(s => s.name === awayName);
                if (hs) homeRankPos = (g.standings.indexOf(hs) + 1) + 'º';
                if (as) awayRankPos = (g.standings.indexOf(as) + 1) + 'º';
            }
        }
        
        const card = document.createElement('div');
        card.className = 'live-match-widget';
        
        const currentGoals = m.homeScore + m.awayScore;
        if (window._previousScores[key] !== undefined && currentGoals > window._previousScores[key]) {
            const prevHome = window._previousHomeScores[key] || 0;
            let scoringTeam = m.homeScore > prevHome ? homeName : awayName;
            window.triggerGoalAnimation(scoringTeam, homeName, awayName);
        }
        window._previousScores[key] = currentGoals;
        window._previousHomeScores[key] = m.homeScore;
        window._previousAwayScores[key] = m.awayScore;
        
        const homeScorersHtml = (m.homeScorers || []).map(s => `<div>${escapeHTML(s)}</div>`).join('');
        const awayScorersHtml = (m.awayScorers || []).map(s => `<div>${escapeHTML(s)}</div>`).join('');
        
        let displayTime = m.minute ? escapeHTML(m.minute) : '';
        if (displayTime.toLowerCase() === 'live') displayTime = '🔴 ' + t('live_score');

        const homeFlag = ISO_MAP[homeName] ? `https://flagcdn.com/w80/${ISO_MAP[homeName]}.png` : 'flags/default.svg';
        const awayFlag = ISO_MAP[awayName] ? `https://flagcdn.com/w80/${ISO_MAP[awayName]}.png` : 'flags/default.svg';
        
        card.innerHTML = `
            <div class="lm-header">
                <div class="lm-title">Copa do Mundo da FIFA 2026™</div>
                <div class="lm-time">${displayTime}</div>
            </div>
            <div class="lm-content">
                <div class="lm-team lm-home">
                    <img src="${homeFlag}" class="lm-flag" alt="${tTeam(homeName)}">
                    <div class="lm-name">${tTeam(homeName)}</div>
                    <div class="lm-pos">${homeRankPos}</div>
                </div>
                <div class="lm-score-box">
                    <span class="lm-score">${m.homeScore}</span>
                    <span class="lm-vs">×</span>
                    <span class="lm-score">${m.awayScore}</span>
                </div>
                <div class="lm-team lm-away">
                    <img src="${awayFlag}" class="lm-flag" alt="${tTeam(awayName)}">
                    <div class="lm-name">${tTeam(awayName)}</div>
                    <div class="lm-pos">${awayRankPos}</div>
                </div>
            </div>
            <div class="lm-group">${groupName}</div>
            ${(homeScorersHtml || awayScorersHtml) ? `
            <div class="lm-scorers">
                <div class="lm-scorers-home">${homeScorersHtml}</div>
                <div class="lm-scorers-icon">⚽</div>
                <div class="lm-scorers-away">${awayScorersHtml}</div>
            </div>
            ` : ''}
        `;
        sec.appendChild(card);
    });
}
