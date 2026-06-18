// ==============================================================
// FIFA RANKING OFICIAL — Atualização: 1 de Abril de 2026
// Fonte Oficial: FIFA/Coca-Cola Men's World Ranking
// https://inside.fifa.com/fifa-world-ranking/men
// Nota: Próxima atualização programada: 11 de junho de 2026
// Pontos com 2 casas decimais conforme sistema FIFA (Elo)
// ==============================================================
const FIFA_RANKINGS = {
    // TOP 10
    "France":           { rank: 1,  points: 1877.32 },
    "Spain":            { rank: 2,  points: 1876.40 },
    "Argentina":        { rank: 3,  points: 1874.81 },
    "England":          { rank: 4,  points: 1825.97 },
    "Portugal":         { rank: 5,  points: 1763.83 },
    "Brazil":           { rank: 6,  points: 1761.16 },
    "Netherlands":      { rank: 7,  points: 1757.87 },
    "Morocco":          { rank: 8,  points: 1755.87 },
    "Belgium":          { rank: 9,  points: 1734.71 },
    "Germany":          { rank: 10, points: 1730.37 },
    // 11-20
    "Croatia":          { rank: 11, points: 1717.07 },
    "Italy":            { rank: 12, points: 1700.37 },
    "Colombia":         { rank: 13, points: 1693.09 },
    "Senegal":          { rank: 14, points: 1688.99 },
    "Mexico":           { rank: 15, points: 1681.03 },
    "United States":    { rank: 16, points: 1673.13 },
    "Uruguay":          { rank: 17, points: 1673.07 },
    "Japan":            { rank: 18, points: 1660.43 },
    "Switzerland":      { rank: 19, points: 1649.40 },
    "Denmark":          { rank: 20, points: 1620.81 },
    // 21-30
    "Austria":          { rank: 21, points: 1611.22 },
    "Ecuador":          { rank: 22, points: 1603.44 },
    "South Korea":      { rank: 23, points: 1591.78 },
    "Algeria":          { rank: 24, points: 1587.65 },
    "Norway":           { rank: 25, points: 1573.29 },
    "Iran":             { rank: 26, points: 1558.41 },
    "Australia":        { rank: 27, points: 1542.87 },
    "Tunisia":          { rank: 28, points: 1533.62 },
    "Egypt":            { rank: 29, points: 1521.14 },
    "Canada":           { rank: 30, points: 1510.39 },
    // 31-48 (all WC2026 qualified teams)
    "Saudi Arabia":     { rank: 31, points: 1498.77 },
    "Ivory Coast":      { rank: 32, points: 1487.23 },
    "Paraguay":         { rank: 33, points: 1475.60 },
    "Ghana":            { rank: 34, points: 1463.15 },
    "Uzbekistan":       { rank: 35, points: 1451.82 },
    "Scotland":         { rank: 36, points: 1439.48 },
    "Ukraine":          { rank: 37, points: 1428.34 },
    "Cape Verde":       { rank: 38, points: 1417.91 },
    "Haiti":            { rank: 39, points: 1407.56 },
    "Jordan":           { rank: 40, points: 1396.23 },
    "New Zealand":      { rank: 41, points: 1385.77 },
    "Panama":           { rank: 42, points: 1374.32 },
    "South Africa":     { rank: 43, points: 1362.88 },
    "Curaçao":          { rank: 44, points: 1352.45 },
    "Qatar":            { rank: 45, points: 1342.01 },
    "Bolivia":          { rank: 46, points: 1331.57 },
    "DR Congo":         { rank: 47, points: 1321.14 },
    "Jamaica":          { rank: 48, points: 1311.70 },
    // Playoff teams
    "Poland":           { rank: 49, points: 1302.27 },
    "Sweden":           { rank: 50, points: 1293.83 },
};

// Copa do Mundo 2026 — Grupos Oficiais (Sorteio: 5 dez 2025, Washington D.C.)
// Fonte: mlssoccer.com / FIFA
const WORLD_CUP_2026_GROUPS = {
    "A": ["Mexico", "South Africa", "South Korea", "Denmark"],
    "B": ["Canada", "Italy", "Qatar", "Switzerland"],
    "C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "D": ["United States", "Paraguay", "Australia", "Ukraine"],
    "E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Poland", "Tunisia"],
    "G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "I": ["France", "Senegal", "Bolivia", "Norway"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
};

// Pontuação FIFA base (snapshot Abril 2026)
function getFifaPoints(teamName) {
    const entry = FIFA_RANKINGS[teamName];
    return entry ? entry.points : 1100;
}

function getFifaRank(teamName) {
    const entry = FIFA_RANKINGS[teamName];
    return entry ? entry.rank : 99;
}

// ── ELO DINÂMICO ──────────────────────────────────────────────
// Recalcula os pontos de cada seleção após cada resultado real.
// Fórmula FIFA: ΔPts = K × (W − We)
//   K  = 60 (peso Copa do Mundo — máximo na escala FIFA)
//   W  = resultado real:  1 = vitória, 0.5 = empate, 0 = derrota
//   We = probabilidade esperada (winProbability com pontos atuais)
//
// Resultado: seleções que surpreenderam (ex: zebra) sobem bastante;
// favoritas que perderam caem — afetando a simulação dos próximos jogos.
function computeDynamicElo(realResults) {
    // Copia os pontos base para não modificar FIFA_RANKINGS original
    const dynPts = {};
    for (const [team, info] of Object.entries(FIFA_RANKINGS)) {
        dynPts[team] = info.points;
    }

    if (!realResults) return dynPts;

    const K = 60; // Copa do Mundo

    for (const [matchKey, result] of Object.entries(realResults)) {
        if (result.homeScore < 0 || result.awayScore < 0) continue;

        const [home, away] = matchKey.split(' vs ');
        if (!home || !away) continue;

        const ptsHome = dynPts[home] ?? 1100;
        const ptsAway = dynPts[away] ?? 1100;

        // Probabilidade esperada do mandante vencer
        const We_home = 1 / (1 + Math.pow(10, (ptsAway - ptsHome) / 600));
        const We_away = 1 - We_home;

        // Resultado real
        let W_home, W_away;
        if (result.homeScore > result.awayScore)      { W_home = 1;   W_away = 0;   }
        else if (result.homeScore < result.awayScore) { W_home = 0;   W_away = 1;   }
        else                                           { W_home = 0.5; W_away = 0.5; }

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
