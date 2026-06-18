// ==============================================================
// APP.JS — Main controller (Modo Híbrido Real + Simulação)
//
// LÓGICA CENTRAL:
//   1. Busca resultados reais já encerrados (live.js)
//   2. Aplica os resultados reais na tabela de grupos
//   3. Projeta os jogos ainda não realizados via Ranking FIFA
//   4. Refaz o chaveamento do mata-mata com base no que há de real
//   5. Simula as fases futuras APENAS UMA VEZ por conjunto de resultados
//      → Re-simula somente quando novos jogos forem encerrados
//   6. Polling: 30s com jogo ao vivo, 3min caso contrário
//   7. Traduções dinâmicas completas via tTeam() + t()
// ==============================================================

let cachedData = null;
let _pollingTimer = null;

// Controle de estabilidade da simulação:
// Só re-simula quando o número de jogos encerrados muda
let _lastFinishedCount = -1;
let _cachedSimulation  = null;

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
        statusText.textContent = (hasLive ? t('status_live_playing') : t('status_live'))
            + (sourceLabel ? ` (${sourceLabel})` : '');
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
                    const hs = real.homeScore, as = real.awayScore;
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

    renderChampion(data.knockout.champion, data.source, data.realMatchesUsed);
    renderMatchList('final-match',    data.knockout.final,          live, liveScores);
    renderMatchList('semi-finals',    data.knockout.semiFinals,     live, liveScores);
    renderMatchList('quarter-finals', data.knockout.quarterFinals,  live, liveScores);
    renderMatchList('round-16',       data.knockout.roundOf16,      live, liveScores);
    renderMatchList('round-32',       data.knockout.roundOf32,      live, liveScores);
    renderGroups(data.groups);
    renderRankingTable();
    updateTimestamp(data.source, data.realMatchesUsed, data.hasLive);

    // Atualiza elementos estáticos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
    document.title = t('title').replace(/^🏆\s*/, '') || 'Bolão Copa do Mundo 2026';
}

// ── REFRESH COM SIMULAÇÃO ESTÁVEL ────────────────────────────
// A simulação só é re-executada quando o número de jogos
// encerrados mudar — evitando que o campeão mude aleatoriamente
async function refresh() {
    const liveSource = await getDataSource();

    window._liveResultsCache = liveSource.data       || null;
    window._liveScoresCache  = liveSource.liveScores || null;

    const finishedCount = window._liveResultsCache
        ? Object.keys(window._liveResultsCache).length : 0;
    const hasLive = liveSource.hasLive || false;

    setStatus(liveSource.mode,
        liveSource.source !== 'simulation' ? liveSource.source : '',
        hasLive);

    // ── Só re-simula quando há novos jogos encerrados ──────────
    if (finishedCount !== _lastFinishedCount || _cachedSimulation === null) {
        console.info(`[App] 🔄 Nova simulação (${finishedCount} jogos encerrados)`);
        _lastFinishedCount = finishedCount;
        _cachedSimulation  = runHybridSimulation(window._liveResultsCache);
    } else {
        console.info(`[App] ✅ Simulação estável (${finishedCount} jogos, sem novidades)`);
    }

    // Atualiza metadados sem re-simular
    _cachedSimulation.source   = liveSource.mode;
    _cachedSimulation.hasLive  = hasLive;
    cachedData = _cachedSimulation;

    renderApp();

    // Polling adaptativo: 30s ao vivo | 3min sem jogo
    scheduleNextRefresh(hasLive ? 30 : 180);
}

function scheduleNextRefresh(seconds) {
    if (_pollingTimer) clearTimeout(_pollingTimer);
    _pollingTimer = setTimeout(refresh, seconds * 1000);
}

// ── INIT ─────────────────────────────────────────────────────
async function init() {
    await refresh();

    document.getElementById('loading-state').style.display   = 'none';
    document.getElementById('champion-section').style.display = '';
    document.getElementById('knockout-section').style.display = '';
    document.getElementById('groups-section').style.display   = '';
    document.getElementById('ranking-section').style.display  = '';

    renderApp();
}

window.renderApp = renderApp;

document.addEventListener('DOMContentLoaded', () => {
    setLang(currentLang);
    init();
});
