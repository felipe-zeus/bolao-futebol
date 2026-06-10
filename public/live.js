// ==============================================================
// LIVE DATA MANAGER — Arquitetura em 3 Camadas
//
// CAMADA 1 (Primária):   worldcup26.ir — gratuito, sem API key
//                        CORS aberto, dados específicos Copa 2026
//
// CAMADA 2 (Secundária): football-data.org — via proxy local
//                        Requer API key gratuita + proxy Node.js
//                        (ver /proxy/server.js para configurar)
//
// CAMADA 3 (Fallback):   Simulação baseada no Ranking FIFA 2026
//                        Ativada automaticamente se APIs falharem
// ==============================================================

// ── CONFIG ──────────────────────────────────────────────────────
// Para ativar a CAMADA 2, insira sua chave gratuita de football-data.org
// Obtenha em: https://www.football-data.org/client/register
const FOOTBALL_DATA_API_KEY = ''; // Ex: 'abc123xyz...'

// Porta do proxy local (necessário para football-data.org)
// Execute: node proxy/server.js para iniciar o proxy
const PROXY_PORT = 3002;
// ────────────────────────────────────────────────────────────────

// Mapeamento de nomes de times: worldcup26.ir → nosso padrão
const TEAM_NAME_MAP = {
    'United States':   'United States',
    'USA':             'United States',
    'US':              'United States',
    'Ivory Coast':     'Ivory Coast',
    "Côte d'Ivoire":   'Ivory Coast',
    'DR Congo':        'DR Congo',
    'Congo DR':        'DR Congo',
    'South Korea':     'South Korea',
    'Korea Republic':  'South Korea',
    'Iran':            'Iran',
    'Iran (Islamic Republic of)': 'Iran',
};

function normalizeName(name) {
    return TEAM_NAME_MAP[name] || name;
}

// ── CAMADA 1: worldcup26.ir ─────────────────────────────────────
async function fetchFromWorldCup26() {
    try {
        const res = await fetch('https://worldcup26.ir/get/games', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) throw new Error(`worldcup26.ir status: ${res.status}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) return null;

        // Filtra apenas partidas já encerradas (status: finished/completed)
        const finished = data.filter(m =>
            m.status === 'finished' ||
            m.status === 'completed' ||
            m.status === 'FT' ||
            m.finished === true
        );

        if (finished.length === 0) {
            // Copa pode ainda não ter começado → retorna null para usar simulação
            return null;
        }

        // Converte para formato interno
        const results = {};
        finished.forEach(m => {
            const home = normalizeName(m.home_team?.name || m.home?.name || m.homeTeam || '');
            const away = normalizeName(m.away_team?.name || m.away?.name || m.awayTeam || '');
            const homeScore = parseInt(m.home_score ?? m.home?.goals ?? m.homeScore ?? -1);
            const awayScore = parseInt(m.away_score ?? m.away?.goals ?? m.awayScore ?? -1);

            if (!home || !away || homeScore < 0 || awayScore < 0) return;

            const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
            results[`${home} vs ${away}`] = { winner, homeScore, awayScore, source: 'worldcup26.ir' };
        });

        return Object.keys(results).length > 0 ? { mode: 'live', source: 'worldcup26.ir', data: results } : null;

    } catch (e) {
        console.warn('[Live] worldcup26.ir falhou:', e.message);
        return null;
    }
}

// ── CAMADA 2: football-data.org via Proxy Local ─────────────────
async function fetchFromFootballDataOrg() {
    if (!FOOTBALL_DATA_API_KEY) return null;

    try {
        // Usa proxy local para evitar bloqueio de CORS do browser
        const proxyUrl = `http://localhost:${PROXY_PORT}/wc2026/matches`;
        const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) throw new Error(`proxy/football-data status: ${res.status}`);
        const data = await res.json();

        const matches = data?.matches || [];
        const finished = matches.filter(m => m.status === 'FINISHED');

        if (finished.length === 0) return null;

        const results = {};
        finished.forEach(m => {
            const home = normalizeName(m.homeTeam?.name || '');
            const away = normalizeName(m.awayTeam?.name || '');
            const homeScore = m.score?.fullTime?.home ?? -1;
            const awayScore = m.score?.fullTime?.away ?? -1;

            if (!home || !away || homeScore < 0) return;

            const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
            results[`${home} vs ${away}`] = { winner, homeScore, awayScore, source: 'football-data.org' };
        });

        return Object.keys(results).length > 0 ? { mode: 'live', source: 'football-data.org', data: results } : null;

    } catch (e) {
        console.warn('[Live] football-data.org proxy falhou:', e.message);
        return null;
    }
}

// ── ORQUESTRADOR PRINCIPAL ──────────────────────────────────────
async function getDataSource() {
    // Tenta Camada 1
    const layer1 = await fetchFromWorldCup26();
    if (layer1) {
        console.info(`[Live] ✅ Dados ao vivo: ${layer1.source} (${Object.keys(layer1.data).length} partidas)`);
        return layer1;
    }

    // Tenta Camada 2
    const layer2 = await fetchFromFootballDataOrg();
    if (layer2) {
        console.info(`[Live] ✅ Dados ao vivo: ${layer2.source} (${Object.keys(layer2.data).length} partidas)`);
        return layer2;
    }

    // Fallback: simulação
    console.info('[Live] 🔵 Modo Simulação — APIs indisponíveis ou Copa ainda não iniciada.');
    return { mode: 'simulation', source: 'simulation', data: null };
}

// ── STATUS PÚBLICO ───────────────────────────────────────────────
// Exporta a última fonte conhecida para exibição na UI
window.liveDataSource = null;
const _originalGetDataSource = getDataSource;
window.getDataSource = async function () {
    const result = await _originalGetDataSource();
    window.liveDataSource = result.source;
    return result;
};
