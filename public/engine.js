// ==============================================================
// FIFA RANKING OFICIAL — Atualização: 11 de Junho de 2026
// Fonte Oficial: FIFA/Coca-Cola Men's World Ranking
// https://inside.fifa.com/fifa-world-ranking/men
// Apenas as 48 seleções classificadas para a Copa do Mundo 2026
// Pontos com 2 casas decimais conforme sistema FIFA (Elo)
// ==============================================================
const FIFA_RANKINGS = {
    // TOP 10 — todos classificados
    "France":                  { rank: 1,  points: 1877.32 },
    "Spain":                   { rank: 2,  points: 1876.40 },
    "Argentina":               { rank: 3,  points: 1874.81 },
    "England":                 { rank: 4,  points: 1825.97 },
    "Portugal":                { rank: 5,  points: 1763.83 },
    "Brazil":                  { rank: 6,  points: 1761.16 },
    "Netherlands":             { rank: 7,  points: 1757.87 },
    "Morocco":                 { rank: 8,  points: 1755.87 },
    "Belgium":                 { rank: 9,  points: 1734.71 },
    "Germany":                 { rank: 10, points: 1730.37 },
    // 11-20
    "Croatia":                 { rank: 11, points: 1717.07 },
    "Colombia":                { rank: 12, points: 1693.09 },
    "Senegal":                 { rank: 13, points: 1688.99 },
    "Mexico":                  { rank: 14, points: 1681.03 },
    "United States":           { rank: 15, points: 1673.13 },
    "Uruguay":                 { rank: 16, points: 1673.07 },
    "Japan":                   { rank: 17, points: 1660.43 },
    "Switzerland":             { rank: 18, points: 1649.40 },
    "Austria":                 { rank: 19, points: 1611.22 },
    "Ecuador":                 { rank: 20, points: 1603.44 },
    // 21-30
    "South Korea":             { rank: 21, points: 1591.78 },
    "Algeria":                 { rank: 22, points: 1587.65 },
    "Norway":                  { rank: 23, points: 1573.29 },
    "Iran":                    { rank: 24, points: 1558.41 },
    "Australia":               { rank: 25, points: 1542.87 },
    "Tunisia":                 { rank: 26, points: 1533.62 },
    "Egypt":                   { rank: 27, points: 1521.14 },
    "Canada":                  { rank: 28, points: 1510.39 },
    "Turkey":                  { rank: 29, points: 1501.85 },
    "Saudi Arabia":            { rank: 30, points: 1498.77 },
    // 31-48 — todos classificados
    "Ivory Coast":             { rank: 31, points: 1487.23 },
    "Paraguay":                { rank: 32, points: 1475.60 },
    "Czech Republic":          { rank: 33, points: 1471.44 },
    "Ghana":                   { rank: 34, points: 1463.15 },
    "Sweden":                  { rank: 35, points: 1455.92 },
    "Uzbekistan":              { rank: 36, points: 1451.82 },
    "Scotland":                { rank: 37, points: 1439.48 },
    "Bosnia and Herzegovina":  { rank: 38, points: 1431.67 },
    "Cape Verde":              { rank: 39, points: 1417.91 },
    "Haiti":                   { rank: 40, points: 1407.56 },
    "Jordan":                  { rank: 41, points: 1396.23 },
    "New Zealand":             { rank: 42, points: 1385.77 },
    "Panama":                  { rank: 43, points: 1374.32 },
    "South Africa":            { rank: 44, points: 1362.88 },
    "Curaçao":                 { rank: 45, points: 1352.45 },
    "Qatar":                   { rank: 46, points: 1342.01 },
    "DR Congo":                { rank: 47, points: 1321.14 },
    "Iraq":                    { rank: 48, points: 1308.22 },
};

// Copa do Mundo 2026 — Grupos Oficiais (Sorteio: 5 dez 2025, Washington D.C.)
// Fonte: FIFA.com — 48 seleções, 12 grupos de 4
const WORLD_CUP_2026_GROUPS = {
    "A": ["Mexico", "South Africa", "South Korea", "Czech Republic"],
    "B": ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
    "C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "D": ["United States", "Paraguay", "Australia", "Turkey"],
    "E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "I": ["France", "Senegal", "Iraq", "Norway"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
};

// ==============================================================
// CHAVEAMENTO OFICIAL FIFA — 16-avos de Final (Round of 32)
// Fonte: FIFA.com / football-data.org (IDs confirmados no games.json)
// Fase disputada: 28 de Junho – 3 de Julho de 2026
// CRÍTICO: Este é o bracket REAL definido pela FIFA após a fase de grupos.
//          NÃO é gerado matematicamente — é o chaveamento oficial fixo.
// ==============================================================
const OFFICIAL_R32_BRACKET = [
    { home: "South Africa",          away: "Canada" },                  // ID 537417 — 28/jun ✅ 0-1
    { home: "Brazil",                away: "Japan" },                   // ID 537423 — 29/jun ✅ 2-1
    { home: "Germany",               away: "Paraguay" },                // ID 537415 — 29/jun ✅ 1-1 (PEN: PAR)
    { home: "Netherlands",           away: "Morocco" },                 // ID 537418 — 29/jun
    { home: "Ivory Coast",           away: "Norway" },                  // ID 537424 — 30/jun
    { home: "France",                away: "Sweden" },                  // ID 537416 — 30/jun
    { home: "Mexico",                away: "Ecuador" },                 // ID 537425 — 01/jul
    { home: "England",               away: "DR Congo" },                // ID 537426 — 01/jul
    { home: "Belgium",               away: "Senegal" },                 // ID 537422 — 01/jul
    { home: "United States",         away: "Bosnia and Herzegovina" },  // ID 537421 — 02/jul
    { home: "Spain",                 away: "Austria" },                 // ID 537420 — 02/jul
    { home: "Portugal",              away: "Croatia" },                 // ID 537419 — 02/jul
    { home: "Switzerland",           away: "Algeria" },                 // ID 537429 — 03/jul
    { home: "Australia",             away: "Egypt" },                   // ID 537428 — 03/jul
    { home: "Argentina",             away: "Cape Verde" },              // ID 537427 — 03/jul
    { home: "Colombia",              away: "Ghana" },                   // ID 537430 — 03/jul
];

// Pontuação FIFA base (snapshot Abril 2026)
function getFifaPoints(teamName) {
    const entry = FIFA_RANKINGS[teamName];
    return entry ? entry.points : 1100;
}

function getFifaRank(teamName) {
    const entry = FIFA_RANKINGS[teamName];
    return entry ? entry.rank : 99;
}

// ── ELO DINÂMICO ──────────────────────────────────────────
// Recalcula os pontos de cada seleção após cada resultado real.
//
// Fórmula oficial FIFA (desde Agosto 2018):
//   P = P_before + I × (W − We)
//   We = 1 / (1 + 10^((Rb - Ra) / 600))
//
// Fator de Importância (I) oficial por fase:
//   I = 50  → Fase de Grupos + Oitavas de Final
//   I = 60  → Quartas de Final em diante
//
// Esta função processa APENAS jogos da fase de grupos (I = 50).
// O fator 60 será usado futuramente na simulação do mata-mata
// quando os resultados reais do mata-mata estiverem disponíveis.
//
// W = resultado real: 1 = vitória, 0.5 = empate, 0 = derrota
//   (0.75 para vitória por pênaltis — não ocorre na fase de grupos)
//
// Resultado: seleções que surpreenderam (ex: zebra) sobem;
// favoritas que perderam caem — afetando a simulação dos próximos jogos.
function computeDynamicElo(realResults) {
    // Copia os pontos base para não modificar FIFA_RANKINGS original
    const dynPts = {};
    for (const [team, info] of Object.entries(FIFA_RANKINGS)) {
        dynPts[team] = info.points;
    }

    if (!realResults) return dynPts;

    for (const [matchKey, result] of Object.entries(realResults)) {
        if (result.homeScore < 0 || result.awayScore < 0) continue;

        const [home, away] = matchKey.split(' vs ');
        if (!home || !away) continue;

        const ptsHome = dynPts[home] ?? 1100;
        const ptsAway = dynPts[away] ?? 1100;

        // Probabilidade esperada do mandante vencer
        const We_home = 1 / (1 + Math.pow(10, (ptsAway - ptsHome) / 600));
        const We_away = 1 - We_home;

        // Fator de Importância (I) oficial FIFA por fase:
        //   I = 50  → Fase de Grupos + 16-avos + Oitavas de Final
        //   I = 60  → Quartas de Final em diante
        const stage = (result.stage || '').toUpperCase();
        const isHighStake = ['QUARTER', 'SEMI', 'FINAL'].some(s => stage.includes(s));
        const K = isHighStake ? 60 : 50;

        // Resultado real — respeita vencedor por pênaltis (W=0.75 conforme regra FIFA oficial)
        // Se `result.winner` está definido, usa ele (cobre pênaltis e tempo extra)
        // Fallback: compara placar do tempo normal
        let W_home, W_away;
        if (result.winner === home) {
            const isPen = result.duration === 'PENALTY_SHOOTOUT';
            W_home = isPen ? 0.75 : 1;
            W_away = isPen ? 0.25 : 0;
        } else if (result.winner === away) {
            const isPen = result.duration === 'PENALTY_SHOOTOUT';
            W_home = isPen ? 0.25 : 0;
            W_away = isPen ? 0.75 : 1;
        } else if (result.homeScore > result.awayScore) {
            W_home = 1;   W_away = 0;
        } else if (result.homeScore < result.awayScore) {
            W_home = 0;   W_away = 1;
        } else {
            W_home = 0.5; W_away = 0.5;
        }

        // Aplica atualização Elo
        dynPts[home] = ptsHome + K * (W_home - We_home);
        dynPts[away] = ptsAway + K * (W_away - We_away);
    }

    return dynPts;
}

// Probabilidade usando pontos dinâmicos (pós resultados reais)
function winProbabilityDynamic(teamA, teamB, dynPts) {
    const ptsA = dynPts?.[teamA] ?? getFifaPoints(teamA);
    const ptsB = dynPts?.[teamB] ?? getFifaPoints(teamB);
    return 1 / (1 + Math.pow(10, (ptsB - ptsA) / 600));
}

// Probabilidade usando ranking estático (fallback / legacy)
function winProbability(teamA, teamB) {
    return winProbabilityDynamic(teamA, teamB, null);
}

// ── SIMULAÇÃO DETERMINÍSTICA ───────────────────────────────────
// Sem aleatoriedade: quem tem maior probabilidade SEMPRE vence.
// Se prob(A) >= 0.5 → A vence | Se prob(A) < 0.5 → B vence
// Em caso de empate perfeito (50/50) → considerado empate técnico
function simulateMatchDeterministic(teamA, teamB, dynPts) {
    const probA = winProbabilityDynamic(teamA, teamB, dynPts);
    if (probA > 0.5)  return teamA;
    if (probA < 0.5)  return teamB;
    // Empate perfeito (improvável) → favorece ranking base
    return getFifaPoints(teamA) >= getFifaPoints(teamB) ? teamA : teamB;
}

// Mantém função legada para compatibilidade com runSimulation() de engine.js
function simulateMatch(teamA, teamB) {
    return simulateMatchDeterministic(teamA, teamB, null);
}

function simulateGroupStage() {
    const results = {};
    for (const [groupName, teams] of Object.entries(WORLD_CUP_2026_GROUPS)) {
        const standings = teams.map(t => ({ name: t, pts: 0, gd: 0, rank: getFifaRank(t), fifaPoints: getFifaPoints(t) }));

        // Round-robin within group
        for (let i = 0; i < standings.length; i++) {
            for (let j = i + 1; j < standings.length; j++) {
                const probI = winProbability(standings[i].name, standings[j].name);
                const rand = Math.random();
                if (rand < probI * 0.7) {
                    standings[i].pts += 3;
                } else if (rand < probI * 0.7 + 0.2) {
                    standings[i].pts += 1;
                    standings[j].pts += 1;
                } else {
                    standings[j].pts += 3;
                }
            }
        }
        standings.sort((a, b) => b.pts - a.pts || b.fifaPoints - a.fifaPoints);
        results[groupName] = standings;
    }
    return results;
}

function runSimulation() {
    const groupResults = simulateGroupStage();

    // Top 2 from each of 12 groups = 24 qualifiers
    // Best 8 third-place = 8 more → total 32
    const groupWinners = {};
    const groupRunnersUp = {};
    const thirdPlaceTeams = [];

    for (const [g, standings] of Object.entries(groupResults)) {
        groupWinners[g] = standings[0];
        groupRunnersUp[g] = standings[1];
        thirdPlaceTeams.push({ ...standings[2], group: g });
    }

    thirdPlaceTeams.sort((a, b) => b.pts - a.pts || b.fifaPoints - a.fifaPoints);
    const best8Third = thirdPlaceTeams.slice(0, 8);

    // Round of 32 — 16 partidas (32 times)
    const groupLetters = Object.keys(WORLD_CUP_2026_GROUPS);
    const r32Matches = [];
    const r32Winners = [];

    // Partidas 1-12: campeão do grupo i vs vice do grupo 11-i
    for (let i = 0; i < 12; i++) {
        const w  = groupWinners[groupLetters[i]].name;
        const ru = groupRunnersUp[groupLetters[11 - i]].name;
        r32Matches.push(`${w} vs ${ru}`);
        r32Winners.push(simulateMatch(w, ru));
    }

    // Partidas 13-16: os 8 melhores 3ºs lugares entre si
    for (let i = 0; i < 4; i++) {
        const a = best8Third[i]?.name     || groupRunnersUp[groupLetters[i]].name;
        const b = best8Third[i + 4]?.name || groupRunnersUp[groupLetters[i + 6]].name;
        r32Matches.push(`${a} vs ${b}`);
        r32Winners.push(simulateMatch(a, b));
    }

    // Round of 16
    const r16Matches = [];
    const r16Winners = [];
    for (let i = 0; i < 8; i++) {
        const a = r32Winners[i * 2];
        const b = r32Winners[i * 2 + 1];
        r16Matches.push(`${a} vs ${b}`);
        r16Winners.push(simulateMatch(a, b));
    }

    // Quarter-Finals
    const qfMatches = [];
    const qfWinners = [];
    for (let i = 0; i < 4; i++) {
        const a = r16Winners[i * 2];
        const b = r16Winners[i * 2 + 1];
        qfMatches.push(`${a} vs ${b}`);
        qfWinners.push(simulateMatch(a, b));
    }

    // Semi-Finals
    const sfMatches = [];
    const sfWinners = [];
    for (let i = 0; i < 2; i++) {
        const a = qfWinners[i * 2];
        const b = qfWinners[i * 2 + 1];
        sfMatches.push(`${a} vs ${b}`);
        sfWinners.push(simulateMatch(a, b));
    }

    // Final
    const finalMatch = [`${sfWinners[0]} vs ${sfWinners[1]}`];
    const champion = simulateMatch(sfWinners[0], sfWinners[1]);

    return {
        tournament: "FIFA World Cup 2026",
        generatedAt: new Date().toISOString(),
        source: "simulation",
        fifaRankingDate: "April 1, 2026",
        groups: Object.entries(groupResults).map(([name, standings]) => ({
            name: `Group ${name}`,
            standings: standings.map(s => ({ name: s.name, pts: s.pts, fifaRank: s.rank, fifaPoints: s.fifaPoints }))
        })),
        knockout: {
            roundOf32: r32Matches,
            roundOf16: r16Matches,
            quarterFinals: qfMatches,
            semiFinals: sfMatches,
            final: finalMatch,
            champion,
        }
    };
}

// ==============================================================
// CONTROLE DA FASE DE GRUPOS
// ==============================================================

// Retorna o número total de jogos na fase de grupos
// 12 grupos × C(4,2) = 6 jogos por grupo = 72 jogos no total
function getTotalGroupMatches() {
    let total = 0;
    for (const teams of Object.values(WORLD_CUP_2026_GROUPS)) {
        const n = teams.length;
        total += (n * (n - 1)) / 2; // combinações de 2
    }
    return total; // 72
}

// Verifica se TODOS os jogos da fase de grupos já foram encerrados
// liveResults: objeto com resultados reais { "TimeA vs TimeB": { homeScore, awayScore, winner } }
function isGroupStageComplete(liveResults) {
    if (!liveResults || Object.keys(liveResults).length === 0) return false;

    for (const [, teams] of Object.entries(WORLD_CUP_2026_GROUPS)) {
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const key1 = `${teams[i]} vs ${teams[j]}`;
                const key2 = `${teams[j]} vs ${teams[i]}`;
                const result = liveResults[key1] || liveResults[key2];
                // Jogo não encerrado = fase incompleta
                if (!result || result.homeScore < 0 || result.awayScore < 0) return false;
            }
        }
    }
    return true;
}

// Conta quantos jogos de grupo já foram encerrados
function countFinishedGroupMatches(liveResults) {
    if (!liveResults) return 0;
    let count = 0;
    for (const [, teams] of Object.entries(WORLD_CUP_2026_GROUPS)) {
        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                const key1 = `${teams[i]} vs ${teams[j]}`;
                const key2 = `${teams[j]} vs ${teams[i]}`;
                const result = liveResults[key1] || liveResults[key2];
                if (result && result.homeScore >= 0 && result.awayScore >= 0) count++;
            }
        }
    }
    return count;
}

// Constrói a visão da fase de grupos sem o mata-mata simulado
// Usado enquanto a fase de grupos ainda não encerrou
function buildGroupsOnlyView(liveResults, liveScores = {}) {
    const dynPts = computeDynamicElo(liveResults); // Elo só atualiza com jogos encerrados
    const combinedResults = { ...(liveResults || {}), ...(liveScores || {}) };
    const groupResults = {};

    for (const [groupName, teams] of Object.entries(WORLD_CUP_2026_GROUPS)) {
        const standings = teams.map(team => ({
            name: team,
            pts: 0, gf: 0, ga: 0, wins: 0, draws: 0, losses: 0, played: 0,
            rank: getFifaRank(team),
            fifaPoints: dynPts[team] ?? getFifaPoints(team),
            realMatches: 0
        }));

        for (let i = 0; i < standings.length; i++) {
            for (let j = i + 1; j < standings.length; j++) {
                const home = standings[i];
                const away = standings[j];
                const key1 = `${home.name} vs ${away.name}`;
                const key2 = `${away.name} vs ${home.name}`;
                const real = combinedResults[key1] || combinedResults[key2];

                if (real && real.homeScore >= 0 && real.awayScore >= 0) {
                    // Resultado encerrado ou em andamento
                    let hs, as;
                    if (real === combinedResults[key1]) {
                        hs = real.homeScore;
                        as = real.awayScore;
                    } else {
                        hs = real.awayScore;
                        as = real.homeScore;
                    }
                    
                    home.gf += hs; home.ga += as; home.played++;
                    away.gf += as; away.ga += hs; away.played++;
                    home.realMatches++; away.realMatches++;
                    if (hs > as)      { home.pts += 3; home.wins++; away.losses++; }
                    else if (hs < as) { away.pts += 3; away.wins++; home.losses++; }
                    else              { home.pts += 1; away.pts += 1; home.draws++; away.draws++; }
                }
                // Jogos não realizados não são simulados aqui—ficam em aberto
            }
        }

        standings.sort((a, b) =>
            b.pts - a.pts ||
            (b.gf - b.ga) - (a.gf - a.ga) ||
            b.gf - a.gf ||
            b.fifaPoints - a.fifaPoints
        );
        groupResults[groupName] = standings;
    }

    const finished = countFinishedGroupMatches(liveResults);
    const total    = getTotalGroupMatches();

    return {
        tournament: 'FIFA World Cup 2026',
        generatedAt: new Date().toISOString(),
        source: 'groups_only',
        groupStageComplete: false,
        groupsFinished: finished,
        groupsTotal: total,
        realMatchesUsed: finished,
        groups: Object.entries(groupResults).map(([name, standings]) => ({
            name: `Group ${name}`,
            standings: standings.map(s => ({
                name: s.name,
                pts: s.pts,
                played: s.played,
                wins: s.wins,
                draws: s.draws,
                losses: s.losses,
                gf: s.gf,
                ga: s.ga,
                gd: s.gf - s.ga,
                fifaRank: s.rank,
                fifaPoints: s.fifaPoints,
                realMatches: s.realMatches,
                dynPts: dynPts[s.name] ?? getFifaPoints(s.name)
            }))
        })),
        knockout: null // mata-mata não disponível ainda
    };
}
