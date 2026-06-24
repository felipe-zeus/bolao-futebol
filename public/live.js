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
    'Democratic Republic of the Congo': 'DR Congo',
    'South Korea':                'South Korea',
    'Korea Republic':             'South Korea',
    'Republic of Korea':          'South Korea',
    'Iran':                       'Iran',
    'Iran (Islamic Republic of)': 'Iran',
    'IR Iran':                    'Iran',
    'Curacao':                    'Curaçao',
    'Cape Verde':                 'Cape Verde',
    'Cabo Verde':                 'Cape Verde',
    // Novos times Copa 2026
    'Turkey':                     'Turkey',
    'Türkiye':                     'Turkey',
    'Turkiye':                     'Turkey',
    'Czech Republic':             'Czech Republic',
    'Czechia':                    'Czech Republic',
    'Bosnia and Herzegovina':     'Bosnia and Herzegovina',
    'Bosnia & Herzegovina':       'Bosnia and Herzegovina',
    'Bosnia-Herzegovina':         'Bosnia and Herzegovina',
    'Iraq':                       'Iraq',
    'Sweden':                     'Sweden',
};

function normalizeName(name) {
    return TEAM_NAME_MAP[name] || name || '';
}

// ── CAMADA 1: worldcup26.ir ───────────────────────────────────────────
const WORLDCUP26_URL = 'https://worldcup26.ir';

async function fetchFromWorldCup26() {
    try {
        const res = await fetch(`${WORLDCUP26_URL}/get/games`, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(5000)
        });

        if (!res.ok) throw new Error(`worldcup26.ir /get/games status: ${res.status}`);
        const payload = await res.json();

        // A API retorna { games: [...] } ou diretamente um array
        const data = Array.isArray(payload) ? payload : (payload.games || []);
        if (data.length === 0) return null;

        // Detecta status encerrado:
        // finished: "TRUE" (string) OU time_elapsed em lista de encerrados
        const statusFinished = ['finished', 'Finished', 'FINISHED', 'completed', 'FT', 'AET', 'PEN'];
        const statusInPlay   = ['in_play', 'live', 'LIVE', 'HT', '1H', '2H', 'ET', 'PAUSED', 'inprogress'];

        const finished = data.filter(m =>
            m.type === 'group' && (
                String(m.finished).toUpperCase() === 'TRUE' ||
                statusFinished.includes(m.time_elapsed)
            )
        );

        const inPlay = data.filter(m =>
            m.type === 'group' && (
                statusInPlay.includes(m.time_elapsed) ||
                statusInPlay.includes(m.status)
            )
        );

        if (finished.length === 0 && inPlay.length === 0) return null;

        const results    = {};
        const liveScores = {};

        // Processa jogos encerrados
        // A API usa: home_team_name_en, away_team_name_en, home_score, away_score (strings)
        finished.forEach(m => {
            const home      = normalizeName(m.home_team_name_en || m.home_team?.name || m.home?.name || '');
            const away      = normalizeName(m.away_team_name_en || m.away_team?.name || m.away?.name || '');
            const homeScore = parseInt(m.home_score ?? m.home_goals ?? -1);
            const awayScore = parseInt(m.away_score ?? m.away_goals ?? -1);

            if (!home || !away || isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) return;

            const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
            results[`${home} vs ${away}`] = {
                winner, homeScore, awayScore,
                source: 'worldcup26.ir',
                status: 'finished'
            };
        });

        function parseScorers(str) {
            if (!str || str === 'null') return [];
            try {
                const matches = str.match(/"([^"]+)"/g) || str.match(/“([^”]+)”/g) || [];
                const raw = matches.map(s => s.replace(/["“”]/g, ''));
                const map = {};
                raw.forEach(s => {
                    const m = s.match(/(.+?)\s*(\d+.*')/);
                    if (m) {
                        const name = m[1].trim();
                        const min = m[2].trim();
                        if (!map[name]) map[name] = [];
                        map[name].push(min);
                    } else {
                        if (!map[s]) map[s] = [];
                    }
                });
                return Object.entries(map).map(([name, mins]) => {
                    if (mins.length === 0) return name;
                    return `${name} ${mins.join(', ')}`;
                });
            } catch (e) { return []; }
        }

        // Minuto exato: usa o campo retornado pela própria API (time_elapsed / minute)
        // O endpoint /wc2026/live-minute foi removido — era experimental e instável.
        const exactMinute = null;
        const hasScraperError = false;

        // Processa jogos em andamento (placar parcial)
        inPlay.forEach(m => {
            const home      = normalizeName(m.home_team_name_en || m.home_team?.name || m.home?.name || '');
            const away      = normalizeName(m.away_team_name_en || m.away_team?.name || m.away?.name || '');
            const homeScore = parseInt(m.home_score ?? 0);
            const awayScore = parseInt(m.away_score ?? 0);
            
            const minute    = exactMinute || m.time_elapsed || m.minute || m.elapsed || null;
            const homeScorers = parseScorers(m.home_scorers);
            const awayScorers = parseScorers(m.away_scorers);

            if (!home || !away) return;
            liveScores[`${home} vs ${away}`] = {
                homeScore, awayScore, minute, homeScorers, awayScorers,
                status: 'in_play',
                source: 'worldcup26.ir'
            };
        });

        const hasData = Object.keys(results).length > 0 || Object.keys(liveScores).length > 0;
        if (!hasData) return null;

        console.info(`[worldcup26.ir] ✔ ${Object.keys(results).length} encerrados, ${Object.keys(liveScores).length} ao vivo`);
        return {
            mode: 'live',
            source: 'worldcup26.ir',
            data: results,
            liveScores,
            hasScraperError, // Repassa o erro do scraper
            hasLive: Object.keys(liveScores).length > 0
        };

    } catch (e) {
        console.warn('[Live] worldcup26.ir falhou:', e.message);
        return null;
    }
}

// ── CAMADA 2: football-data.org via Proxy Local ─────────────────
// Agora gerenciada diretamente por getDataSource() via _buildResultsFromProxy().
// A função fetchFromProxy() foi consolidada nos helpers internos abaixo.

// ── FALLBACK ESTATICO ──────────────────────────────────────────
const FALLBACK_RESULTS = {"Mexico vs South Africa":{"winner":"Mexico","homeScore":2,"awayScore":0,"source":"fallback","status":"finished"},"South Korea vs Czech Republic":{"winner":"South Korea","homeScore":2,"awayScore":1,"source":"fallback","status":"finished"},"Canada vs Bosnia and Herzegovina":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"United States vs Paraguay":{"winner":"United States","homeScore":4,"awayScore":1,"source":"fallback","status":"finished"},"Haiti vs Scotland":{"winner":"Scotland","homeScore":0,"awayScore":1,"source":"fallback","status":"finished"},"Australia vs Turkey":{"winner":"Australia","homeScore":2,"awayScore":0,"source":"fallback","status":"finished"},"Brazil vs Morocco":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Qatar vs Switzerland":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Ivory Coast vs Ecuador":{"winner":"Ivory Coast","homeScore":1,"awayScore":0,"source":"fallback","status":"finished"},"Germany vs Curaçao":{"winner":"Germany","homeScore":7,"awayScore":1,"source":"fallback","status":"finished"},"Netherlands vs Japan":{"winner":null,"homeScore":2,"awayScore":2,"source":"fallback","status":"finished"},"Sweden vs Tunisia":{"winner":"Sweden","homeScore":5,"awayScore":1,"source":"fallback","status":"finished"},"Iran vs New Zealand":{"winner":null,"homeScore":2,"awayScore":2,"source":"fallback","status":"finished"},"Spain vs Cape Verde":{"winner":null,"homeScore":0,"awayScore":0,"source":"fallback","status":"finished"},"Belgium vs Egypt":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Saudi Arabia vs Uruguay":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"France vs Senegal":{"winner":"France","homeScore":3,"awayScore":1,"source":"fallback","status":"finished"},"Iraq vs Norway":{"winner":"Norway","homeScore":1,"awayScore":4,"source":"fallback","status":"finished"},"Argentina vs Algeria":{"winner":"Argentina","homeScore":3,"awayScore":0,"source":"fallback","status":"finished"},"Austria vs Jordan":{"winner":"Austria","homeScore":3,"awayScore":1,"source":"fallback","status":"finished"},"Portugal vs DR Congo":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"England vs Croatia":{"winner":"England","homeScore":4,"awayScore":2,"source":"fallback","status":"finished"},"Uzbekistan vs Colombia":{"winner":"Colombia","homeScore":1,"awayScore":3,"source":"fallback","status":"finished"},"Ghana vs Panama":{"winner":"Ghana","homeScore":1,"awayScore":0,"source":"fallback","status":"finished"},"Mexico vs South Korea":{"winner":"Mexico","homeScore":1,"awayScore":0,"source":"fallback","status":"finished"},"Switzerland vs Bosnia and Herzegovina":{"winner":"Switzerland","homeScore":4,"awayScore":1,"source":"fallback","status":"finished"},"Canada vs Qatar":{"winner":"Canada","homeScore":6,"awayScore":0,"source":"fallback","status":"finished"},"Czech Republic vs South Africa":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Scotland vs Morocco":{"winner":"Morocco","homeScore":0,"awayScore":1,"source":"fallback","status":"finished"},"United States vs Australia":{"winner":"United States","homeScore":2,"awayScore":0,"source":"fallback","status":"finished"}};

// ── ORQUESTRADOR PRINCIPAL ──────────────────────────────────────
// ARQUITETURA EM 3 CAMADAS:
//   Camada 1: worldcup26.ir (gratuita, sem key, CORS aberto)
//   Camada 2: football-data.org via proxy (uma única chamada por ciclo)
//   Camada 3: Fallback estático
//
// OTIMIZAÇÃO: O proxy é chamado UMA ÚNICA VEZ por ciclo.
// O resultado é reaproveitado tanto para upcomingMatches quanto
// como fonte de dados (Camada 2), eliminando o double-fetch anterior.
async function getDataSource() {
    let nextMatch = null;
    let upcomingMatches = [];

    // ── CAMADA 1: proxy football-data.org (Mais confiável, atualiza em tempo real, sem limites graças ao cache do backend) ──
    let rawProxyData = null;
    try {
        const proxyUrl = typeof PROXY_URL !== 'undefined' ? PROXY_URL : 'http://localhost:3002';
        const proxyRes = await fetch(`${proxyUrl}/wc2026/live`, { signal: AbortSignal.timeout(6000) });
        if (proxyRes.ok) rawProxyData = await proxyRes.json();
    } catch (e) {
        console.warn('[Live] Proxy football-data.org falhou:', e.message);
    }

    if (rawProxyData) {
        upcomingMatches = _parseUpcomingMatches(rawProxyData);
        nextMatch = upcomingMatches[0] || null;

        const layer1 = _buildResultsFromProxy(rawProxyData);
        if (layer1) {
            console.info(`[Live] ✅ ${layer1.source}: ${Object.keys(layer1.data).length} encerradas, ${Object.keys(layer1.liveScores).length} ao vivo`);
            layer1.nextMatch = nextMatch;
            layer1.upcomingMatches = upcomingMatches;
            return layer1;
        }
    }

    // ── CAMADA 2: worldcup26.ir (Fallback caso o proxy caia) ──
    console.warn('[Live] Proxy indisponível ou sem dados — tentando worldcup26.ir');
    const layer2 = await fetchFromWorldCup26();
    if (layer2) {
        console.info(`[Live] ⚠️ ${layer2.source}: ${Object.keys(layer2.data).length} encerradas, ${Object.keys(layer2.liveScores).length} ao vivo`);
        layer2.nextMatch = nextMatch;
        layer2.upcomingMatches = upcomingMatches;
        return layer2;
    }

    // ── CAMADA 3: Fallback estático ───────────────────────────────
    console.warn('[Live] Todas as fontes falharam — usando fallback estático');
    return {
        mode: 'simulation',
        source: 'offline_cache',
        data: FALLBACK_RESULTS,
        liveScores: {},
        hasLive: false,
        nextMatch,
        upcomingMatches
    };
}

// ── Helpers internos ──────────────────────────────────────────
function _parseUpcomingMatches(proxyData) {
    if (!proxyData) return [];
    if (proxyData.upcomingMatches?.length > 0) {
        return proxyData.upcomingMatches.map(m => ({
            home: normalizeName(m.homeTeam?.name || m.homeTeam?.shortName || ''),
            away: normalizeName(m.awayTeam?.name || m.awayTeam?.shortName || ''),
            utcDate: m.utcDate
        })).filter(m => m.home && m.away);
    }
    if (proxyData.nextMatch) {
        const m = proxyData.nextMatch;
        const next = {
            home: normalizeName(m.homeTeam?.name || m.homeTeam?.shortName || ''),
            away: normalizeName(m.awayTeam?.name || m.awayTeam?.shortName || ''),
            utcDate: m.utcDate
        };
        return (next.home && next.away) ? [next] : [];
    }
    return [];
}

function _buildResultsFromProxy(data) {
    const results = {};
    const liveScores = {};

    (data.finished || []).forEach(m => {
        const home = normalizeName(m.homeTeam?.name || m.homeTeam?.shortName || '');
        const away = normalizeName(m.awayTeam?.name || m.awayTeam?.shortName || '');
        const homeScore = m.score?.fullTime?.home ?? -1;
        const awayScore = m.score?.fullTime?.away ?? -1;
        if (!home || !away || homeScore < 0) return;
        const winner = homeScore > awayScore ? home : awayScore > homeScore ? away : null;
        results[`${home} vs ${away}`] = { winner, homeScore, awayScore, source: 'football-data.org', status: 'finished' };
    });

    (data.inPlay || []).forEach(m => {
        const home = normalizeName(m.homeTeam?.name || m.homeTeam?.shortName || '');
        const away = normalizeName(m.awayTeam?.name || m.awayTeam?.shortName || '');
        const homeScore = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
        const awayScore = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;
        let minute = m.minute || null;
        if (!minute && ['IN_PLAY', 'PAUSED', 'HALF_TIME'].includes(m.status)) {
            if (m.utcDate) {
                const elapsedMins = Math.floor((new Date() - new Date(m.utcDate)) / 60000);
                if (elapsedMins < 0) minute = 'A começar';
                else if (elapsedMins <= 45) minute = `${elapsedMins}'`;
                else if (elapsedMins < 60) minute = 'Intervalo';
                else {
                    let secondHalf = elapsedMins - 15;
                    minute = secondHalf > 90 ? '90+\'' : `${secondHalf}'`;
                }
            } else {
                if (m.status === 'HALF_TIME') minute = 'Intervalo';
                else minute = '🔴 AO VIVO';
            }
        }
        if (!home || !away) return;
        liveScores[`${home} vs ${away}`] = { homeScore, awayScore, minute, status: 'in_play', source: 'football-data.org' };
    });

    const hasData = Object.keys(results).length > 0 || Object.keys(liveScores).length > 0;
    if (!hasData) return null;

    return {
        mode: 'live',
        source: 'football-data.org',
        data: results,
        liveScores,
        hasLive: data.hasLive || Object.keys(liveScores).length > 0,
        nextMatch: null // será preenchido por getDataSource()
    };
}

// ── STATUS PÚBLICO ───────────────────────────────────────────────
window.liveDataSource = null;
const _originalGetDataSource = getDataSource;
window.getDataSource = async function () {
    const result = await _originalGetDataSource();
    window.liveDataSource = result.source;
    return result;
};
