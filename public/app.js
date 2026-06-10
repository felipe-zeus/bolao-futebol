// ==============================================================
// APP.JS — Main controller (Modo Híbrido Real + Simulação)
//
// LÓGICA CENTRAL:
//   1. Busca resultados reais já encerrados (live.js)
//   2. Aplica os resultados reais na tabela de grupos
//   3. Projeta os jogos ainda não realizados via Ranking FIFA
//   4. Refaz o chaveamento do mata-mata com base no que há de real
//   5. Simula as fases futuras a partir do ponto atual
//   6. Auto-refresh a cada 3 minutos durante a Copa
// ==============================================================

let cachedData = null;
let lastLiveSource = null;

// ---- UTILITY ----
function formatMatch(matchString, result = null) {
    const teams = matchString.split(' vs ');
    if (teams.length !== 2) return matchString;

    const [a, b] = teams;
    let scoreHtml = '';
    if (result && result.homeScore >= 0) {
        const isConfirmed = result.winner !== undefined;
        scoreHtml = `<span class="match-score ${isConfirmed ? 'real' : ''}">${result.homeScore}–${result.awayScore}</span>`;
    }

    return `<span class="team-a">${a}</span>${scoreHtml}<span class="vs">VS</span><span class="team-b">${b}</span>`;
}

function setStatus(mode, sourceLabel = '') {
    const dot = document.querySelector('.pulse-dot');
    const statusText = document.getElementById('status-text');
    if (mode === 'live') {
        dot.classList.add('live');
        statusText.textContent = `${t('status_live')} ${sourceLabel ? `(${sourceLabel})` : ''}`;
    } else {
        dot.classList.remove('live');
        statusText.textContent = t('status_simulation');
    }
}

// ---- MOTOR HÍBRIDO: Integra resultados reais + simula o resto ----
function runHybridSimulation(liveResults) {
    // liveResults: { "Home vs Away": { winner, homeScore, awayScore } } ou null
    const hasLive = liveResults && Object.keys(liveResults).length > 0;

    // ── FASE DE GRUPOS ──────────────────────────────────────────
    const groupResults = {};

    for (const [groupName, teams] of Object.entries(WORLD_CUP_2026_GROUPS)) {
        const standings = teams.map(t => ({
            name: t,
            pts: 0,
            gf: 0,
            ga: 0,
            rank: getFifaRank(t),
            fifaPoints: getFifaPoints(t),
            realMatches: 0
        }));

        // Round-robin: para cada par de times no grupo
        for (let i = 0; i < standings.length; i++) {
            for (let j = i + 1; j < standings.length; j++) {
                const home = standings[i];
                const away = standings[j];
                const matchKey1 = `${home.name} vs ${away.name}`;
                const matchKey2 = `${away.name} vs ${home.name}`;

                const realResult = liveResults?.[matchKey1] || liveResults?.[matchKey2];

                if (realResult && realResult.winner !== undefined) {
                    // ✅ RESULTADO REAL — aplica diretamente
                    const homeScore = realResult.homeScore;
                    const awayScore = realResult.awayScore;
                    home.gf += homeScore; home.ga += awayScore;
                    away.gf += awayScore; away.ga += homeScore;
                    home.realMatches++; away.realMatches++;

                    if (homeScore > awayScore)      { home.pts += 3; }
                    else if (homeScore < awayScore)  { away.pts += 3; }
                    else                             { home.pts += 1; away.pts += 1; }
                } else {
                    // 🔵 SIMULAÇÃO — jogo ainda não realizado, usa Ranking FIFA
                    const probHome = winProbability(home.name, away.name);
                    const rand = Math.random();
                    if (rand < probHome * 0.70)      { home.pts += 3; }
                    else if (rand < probHome * 0.70 + 0.18) { home.pts += 1; away.pts += 1; }
                    else                             { away.pts += 3; }
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

    // ── MATA-MATA ────────────────────────────────────────────────
    const groupLetters = Object.keys(WORLD_CUP_2026_GROUPS);
    const groupWinners = {};
    const groupRunnersUp = {};
    const thirdPlace = [];

    for (const [g, standings] of Object.entries(groupResults)) {
        groupWinners[g] = standings[0];
        groupRunnersUp[g] = standings[1];
        thirdPlace.push({ ...standings[2], group: g });
    }

    thirdPlace.sort((a, b) => b.pts - a.pts || b.fifaPoints - a.fifaPoints);
    const best8Third = thirdPlace.slice(0, 8);

    // Helpers para usar resultado real ou simular
    function resolveMatch(teamA, teamB) {
        const key1 = `${teamA} vs ${teamB}`;
        const key2 = `${teamB} vs ${teamA}`;
        const real = liveResults?.[key1] || liveResults?.[key2];
        if (real?.winner) return real.winner;
        return simulateMatch(teamA, teamB);
    }

    // Round of 32
    const r32Matches = [], r32Winners = [];
    for (let i = 0; i < 6; i++) {
        const w = groupWinners[groupLetters[i]].name;
        const ru = groupRunnersUp[groupLetters[11 - i]].name;
        r32Matches.push(`${w} vs ${ru}`);
        r32Winners.push(resolveMatch(w, ru));
    }
    for (let i = 6; i < 12; i++) {
        const w = groupWinners[groupLetters[i]].name;
        const t3 = best8Third[i - 6]?.name || groupRunnersUp[groupLetters[i - 6]].name;
        r32Matches.push(`${w} vs ${t3}`);
        r32Winners.push(resolveMatch(w, t3));
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
    const champion = resolveMatch(sfWinners[0], sfWinners[1]);

    return {
        tournament: 'FIFA World Cup 2026',
        generatedAt: new Date().toISOString(),
        source: hasLive ? 'live' : 'simulation',
        fifaRankingDate: 'April 1, 2026',
        realMatchesUsed: hasLive ? Object.keys(liveResults).length : 0,
        groups: Object.entries(groupResults).map(([name, standings]) => ({
            name: `Group ${name}`,
            standings: standings.map(s => ({
                name: s.name,
                pts: s.pts,
                fifaRank: s.rank,
                fifaPoints: s.fifaPoints,
                realMatches: s.realMatches || 0
            }))
        })),
        knockout: {
            roundOf32: r32Matches,
            roundOf16: r16Matches,
            quarterFinals: qfMatches,
            semiFinals: sfMatches,
            final: finalMatch,
            champion
        }
    };
}

// ---- RENDER FUNCTIONS ----
function renderChampion(champion, mode, realMatches = 0) {
    document.getElementById('champion-name').textContent = champion;

    const rank = getFifaRank(champion);
    const pts = getFifaPoints(champion).toFixed(2);
    document.getElementById('champion-rank-badge').textContent = `${t('rank')} #${rank} • ${pts} pts`;

    const tag = document.getElementById('data-source-tag');
    if (mode === 'live' && realMatches > 0) {
        tag.textContent = `${t('source_live')} — ${realMatches} ${realMatches === 1 ? 'jogo real' : 'jogos reais'} + simulação`;
    } else {
        tag.textContent = t('source_simulation');
    }
    document.getElementById('champion-section').style.display = '';
}

function renderMatchList(elementId, matches, liveResults = null) {
    const ul = document.getElementById(elementId);
    if (!ul) return;
    ul.innerHTML = '';
    matches.forEach(match => {
        const li = document.createElement('li');
        li.className = 'match-item fade-in';

        const teams = match.split(' vs ');
        const key1 = match, key2 = teams.length === 2 ? `${teams[1]} vs ${teams[0]}` : null;
        const result = liveResults ? (liveResults[key1] || (key2 ? liveResults[key2] : null)) : null;

        li.innerHTML = formatMatch(match, result);
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
        title.textContent = group.name;
        card.appendChild(title);

        group.standings.forEach((team, idx) => {
            const row = document.createElement('div');
            row.className = 'group-team' + (idx < 2 ? ' qualified' : '');

            const nameSpan = document.createElement('span');
            nameSpan.textContent = team.name;
            // Badge "real" se time tem jogos reais
            if (team.realMatches > 0) {
                const realBadge = document.createElement('span');
                realBadge.className = 'real-badge';
                realBadge.title = `${team.realMatches} jogo(s) com resultado real`;
                realBadge.textContent = '🔴';
                nameSpan.appendChild(realBadge);
            }

            const meta = document.createElement('span');
            meta.className = 'team-pts';

            const rankTag = document.createElement('span');
            rankTag.className = 'team-rank-tag';
            rankTag.textContent = `#${team.fifaRank}`;
            meta.appendChild(rankTag);
            meta.insertAdjacentText('beforeend', ` ${team.pts}${t('pts')}`);

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

    entries.forEach(([team, info]) => {
        const row = document.createElement('div');
        row.className = 'ranking-row';

        const pos = document.createElement('div');
        pos.className = 'ranking-pos' + (info.rank <= 3 ? ' top3' : '');
        pos.textContent = info.rank;

        const name = document.createElement('div');
        name.className = 'ranking-team';
        name.textContent = team;

        const pts = document.createElement('div');
        pts.className = 'ranking-pts';
        pts.textContent = `${info.points.toFixed(2)} pts`;

        row.appendChild(pos);
        row.appendChild(name);
        row.appendChild(pts);
        grid.appendChild(row);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

function updateTimestamp(source, realCount) {
    const el = document.getElementById('last-updated-text');
    const now = new Date().toLocaleString(
        currentLang === 'pt' ? 'pt-BR' : currentLang === 'es' ? 'es-ES' : 'en-GB'
    );
    let txt = `${t('last_updated')}: ${now}`;
    if (realCount > 0) txt += ` • ${realCount} jogos reais integrados`;
    el.textContent = txt;
}

// ---- MAIN RENDER ----
function renderApp() {
    if (!cachedData) return;

    const data = cachedData;
    const live = window._liveResultsCache || null;

    renderChampion(data.knockout.champion, data.source, data.realMatchesUsed);
    renderMatchList('final-match', data.knockout.final, live);
    renderMatchList('semi-finals', data.knockout.semiFinals, live);
    renderMatchList('quarter-finals', data.knockout.quarterFinals, live);
    renderMatchList('round-16', data.knockout.roundOf16, live);
    renderMatchList('round-32', data.knockout.roundOf32, live);
    renderGroups(data.groups);
    renderRankingTable();
    updateTimestamp(data.source, data.realMatchesUsed);

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === currentLang);
    });
}

// ---- INIT & AUTO-REFRESH ----
async function refresh() {
    const liveSource = await getDataSource();
    window._liveResultsCache = liveSource.data || null;
    lastLiveSource = liveSource.source;

    setStatus(liveSource.mode, liveSource.source !== 'simulation' ? liveSource.source : '');

    // Motor híbrido: usa dados reais + simula o resto
    cachedData = runHybridSimulation(window._liveResultsCache);
    cachedData.source = liveSource.mode;

    renderApp();
}

async function init() {
    await refresh();

    // Mostra todas as seções
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('champion-section').style.display = '';
    document.getElementById('knockout-section').style.display = '';
    document.getElementById('groups-section').style.display = '';
    document.getElementById('ranking-section').style.display = '';

    renderApp();

    // Auto-refresh: a cada 3 minutos durante a Copa
    setInterval(refresh, 3 * 60 * 1000);
}

window.renderApp = renderApp;

document.addEventListener('DOMContentLoaded', () => {
    setLang(currentLang);
    init();
});
