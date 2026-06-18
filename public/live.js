// ==============================================================
// LIVE DATA MANAGER — Arquitetura em 3 Camadas
//
// CAMADA 1 (Primária):   worldcup26.ir — gratuito, sem API key
//                        CORS aberto, dados específicos Copa 2026
//
// CAMADA 2 (Secundária): football-data.org via proxy local na
//                        porta 3002 — proxy já tem a API key
//                        Acessa /wc2026/live (partidas encerradas
//                        + em andamento separadas)
//
// CAMADA 3 (Fallback):   Simulação baseada no Ranking FIFA 2026
//                        Ativada automaticamente se APIs falharem
// ==============================================================

// ── URL do Proxy ─────────────────────────────────────────────────
// LOCAL:    http://localhost:3002  (rode node proxy/server.js)
// PROD:     URL do Railway, injetada via public/config.js no Vercel
//           (ver instrucoes no arquivo DEPLOY.md)
const PROXY_URL = (typeof window !== 'undefined' && window.__PROXY_URL__)
    ? window.__PROXY_URL__
    : 'http://localhost:3002';

// Mapeamento de nomes de times: APIs externas → nosso padrão interno
const TEAM_NAME_MAP = {
    'United States':              'United States',
    'USA':                        'United States',
    'US':                         'United States',
    'Ivory Coast':                'Ivory Coast',
    "Côte d'Ivoire":              'Ivory Coast',
    "Cote d'Ivoire":              'Ivory Coast',
    'DR Congo':                   'DR Congo',
    'Congo DR':                   'DR Congo',
    'Congo, DR':                  'DR Congo',
    'Democratic Republic of Congo': 'DR Congo',
    'South Korea':                'South Korea',
    'Korea Republic':             'South Korea',
    'Republic of Korea':          'South Korea',
    'Iran':                       'Iran',
    'Iran (Islamic Republic of)': 'Iran',
    'IR Iran':                    'Iran',
    'Curacao':                    'Curaçao',
    'Cape Verde':                 'Cape Verde',
    'Cabo Verde':                 'Cape Verde',
};

function normalizeName(name) {
    return TEAM_NAME_MAP[name] || name || '';
}

// ── CAMADA 1: worldcup26.ir ─────────────────────────────────────
async function fetchFromWorldCup26() {
    try {
        const res = await fetch('https://worldcup26.ir/get/games', {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) throw new Error(`worldcup26.ir status: ${res.status}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) return null;

        const statusFinished = ['finished', 'completed', 'FT', 'AET', 'PEN'];
        const statusInPlay   = ['in_play', 'live', 'LIVE', 'HT', '1H', '2H', 'ET', 'PAUSED'];

        const finished = data.filter(m => statusFinished.includes(m.status) || m.finished === true);
        const inPlay   = data.filter(m => statusInPlay.includes(m.status));

        if (finished.length === 0 && inPlay.length === 0) return null;

        const results = {};
        const liveScores = {};

        // Processa encerrados
        finished.forEach(m => {
            const home = normalizeName(m.home_team?.name || m.home?.name || m.homeTeam || '');
            const away = normalizeName(m.away_team?.name || m.away?.name || m.awayTeam || '');
            const homeScore = parseInt(m.home_score ?? m.home?.goals ?? m.homeScore ?? -1);
            const awayScore = parseInt(m.away_score ?? m.away?.goals ?? m.awayScore ?? -1);

            if (!home || !away || homeScore < 0 || awayScore < 0) return;

            const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
            results[`${home} vs ${away}`] = { winner, homeScore, awayScore, source: 'worldcup26.ir', status: 'finished' };
        });

        // Processa em andamento (placar parcial — não altera chaveamento)
        inPlay.forEach(m => {
            const home = normalizeName(m.home_team?.name || m.home?.name || m.homeTeam || '');
            const away = normalizeName(m.away_team?.name || m.away?.name || m.awayTeam || '');
            const homeScore = parseInt(m.home_score ?? m.home?.goals ?? m.homeScore ?? 0);
            const awayScore = parseInt(m.away_score ?? m.away?.goals ?? m.awayScore ?? 0);
            const minute   = m.minute || m.elapsed || null;

            if (!home || !away) return;
            liveScores[`${home} vs ${away}`] = {
                homeScore, awayScore, minute,
                status: 'in_play', source: 'worldcup26.ir'
            };
        });

        const hasData = Object.keys(results).length > 0 || Object.keys(liveScores).length > 0;
        if (!hasData) return null;

        return {
            mode: 'live',
            source: 'worldcup26.ir',
            data: results,
            liveScores,
            hasLive: Object.keys(liveScores).length > 0
        };

    } catch (e) {
        console.warn('[Live] worldcup26.ir falhou:', e.message);
        return null;
    }
}

// ── CAMADA 2: football-data.org via Proxy Local ─────────────────
// O proxy (proxy/server.js) já possui a API key no .env.
// O frontend chama o proxy na porta 3002 — sem necessidade de key no cliente.
async function fetchFromProxy() {
    try {
        const proxyUrl = `${PROXY_URL}/wc2026/live`;
        const res = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(6000)
        });

        if (!res.ok) throw new Error(`proxy status: ${res.status}`);
        const data = await res.json();

        const results = {};
        const liveScores = {};

        // Partidas encerradas → resultado fixo
        (data.finished || []).forEach(m => {
            const home = normalizeName(m.homeTeam?.name || m.homeTeam?.shortName || '');
            const away = normalizeName(m.awayTeam?.name || m.awayTeam?.shortName || '');
            const homeScore = m.score?.fullTime?.home ?? -1;
            const awayScore = m.score?.fullTime?.away ?? -1;

            if (!home || !away || homeScore < 0) return;

            const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
            results[`${home} vs ${away}`] = { winner, homeScore, awayScore, source: 'football-data.org', status: 'finished' };
        });

        // Partidas em andamento → placar parcial
        (data.inPlay || []).forEach(m => {
            const home = normalizeName(m.homeTeam?.name || m.homeTeam?.shortName || '');
            const away = normalizeName(m.awayTeam?.name || m.awayTeam?.shortName || '');
            const homeScore = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
            const awayScore = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;
            const minute    = m.minute || null;

            if (!home || !away) return;
            liveScores[`${home} vs ${away}`] = {
                homeScore, awayScore, minute,
                status: 'in_play', source: 'football-data.org'
            };
        });

        const hasData = Object.keys(results).length > 0 || Object.keys(liveScores).length > 0;
        if (!hasData) return null;

        return {
            mode: 'live',
            source: 'football-data.org',
            data: results,
            liveScores,
            hasLive: data.hasLive || Object.keys(liveScores).length > 0,
            nextMatch: data.nextMatch || null
        };

    } catch (e) {
        console.warn('[Live] Proxy football-data.org falhou:', e.message);
        return null;
    }
}

// ── ORQUESTRADOR PRINCIPAL ──────────────────────────────────────
async function getDataSource() {
    // Tenta Camada 1
    const layer1 = await fetchFromWorldCup26();
    if (layer1) {
        const total = Object.keys(layer1.data).length + Object.keys(layer1.liveScores).length;
        console.info(`[Live] ✅ ${layer1.source}: ${Object.keys(layer1.data).length} encerradas, ${Object.keys(layer1.liveScores).length} ao vivo`);
        return layer1;
    }

    // Tenta Camada 2 (proxy local)
    const layer2 = await fetchFromProxy();
    if (layer2) {
        console.info(`[Live] ✅ ${layer2.source}: ${Object.keys(layer2.data).length} encerradas, ${Object.keys(layer2.liveScores).length} ao vivo`);
        return layer2;
    }

    // Fallback: simulação
    console.info('[Live] 🔵 Modo Simulação — APIs indisponíveis ou Copa ainda não iniciada.');
    return { mode: 'simulation', source: 'simulation', data: null, liveScores: {}, hasLive: false };
}

// ── STATUS PÚBLICO ───────────────────────────────────────────────
window.liveDataSource = null;
const _originalGetDataSource = getDataSource;
window.getDataSource = async function () {
    const result = await _originalGetDataSource();
    window.liveDataSource = result.source;
    return result;
};
