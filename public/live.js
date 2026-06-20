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
            signal: AbortSignal.timeout(30000)
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

        // Tenta obter o minuto exato através do scraper
        let exactMinute = null;
        let hasScraperError = false;
        
        if (inPlay.length > 0) {
            try {
                const proxyUrl = typeof PROXY_URL !== 'undefined' ? PROXY_URL : 'http://localhost:3002';
                const scraperRes = await fetch(`${proxyUrl}/wc2026/live-minute`, { signal: AbortSignal.timeout(3000) });
                if (scraperRes.ok) {
                    const scraperData = await scraperRes.json();
                    if (scraperData.scraper_broken) {
                        hasScraperError = true;
                    } else {
                        exactMinute = scraperData.minute;
                    }
                }
            } catch (err) {
                console.warn('[Scraper] Erro de conexão com proxy scraper:', err.message);
                hasScraperError = true;
            }
        }

        // Processa jogos em andamento (placar parcial)
        inPlay.forEach(m => {
            const home      = normalizeName(m.home_team_name_en || m.home_team?.name || m.home?.name || '');
            const away      = normalizeName(m.away_team_name_en || m.away_team?.name || m.away?.name || '');
            const homeScore = parseInt(m.home_score ?? 0);
            const awayScore = parseInt(m.away_score ?? 0);
            
            // Fallback Matemático
            let mathMinute = null;
            if (hasScraperError && m.local_date) {
                const start = new Date(m.local_date).getTime();
                const now = new Date().getTime();
                const diffMins = Math.floor((now - start) / 60000);
                if (diffMins >= 0) {
                    if (diffMins <= 45) {
                        mathMinute = `${diffMins}'`;
                    } else if (diffMins > 45 && diffMins <= 60) {
                        mathMinute = `HT`; // Intervalo
                    } else if (diffMins > 60 && diffMins <= 105) {
                        mathMinute = `${diffMins - 15}'`;
                    } else {
                        mathMinute = `90+'`;
                    }
                }
            }
            
            const minute    = exactMinute || mathMinute || m.time_elapsed || m.minute || m.elapsed || null;
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

// ── FALLBACK ESTATICO ──────────────────────────────────────────
const FALLBACK_RESULTS = {"Mexico vs South Africa":{"winner":"Mexico","homeScore":2,"awayScore":0,"source":"fallback","status":"finished"},"South Korea vs Czech Republic":{"winner":"South Korea","homeScore":2,"awayScore":1,"source":"fallback","status":"finished"},"Canada vs Bosnia and Herzegovina":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"United States vs Paraguay":{"winner":"United States","homeScore":4,"awayScore":1,"source":"fallback","status":"finished"},"Haiti vs Scotland":{"winner":"Scotland","homeScore":0,"awayScore":1,"source":"fallback","status":"finished"},"Australia vs Turkey":{"winner":"Australia","homeScore":2,"awayScore":0,"source":"fallback","status":"finished"},"Brazil vs Morocco":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Qatar vs Switzerland":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Ivory Coast vs Ecuador":{"winner":"Ivory Coast","homeScore":1,"awayScore":0,"source":"fallback","status":"finished"},"Germany vs Curaçao":{"winner":"Germany","homeScore":7,"awayScore":1,"source":"fallback","status":"finished"},"Netherlands vs Japan":{"winner":null,"homeScore":2,"awayScore":2,"source":"fallback","status":"finished"},"Sweden vs Tunisia":{"winner":"Sweden","homeScore":5,"awayScore":1,"source":"fallback","status":"finished"},"Iran vs New Zealand":{"winner":null,"homeScore":2,"awayScore":2,"source":"fallback","status":"finished"},"Spain vs Cape Verde":{"winner":null,"homeScore":0,"awayScore":0,"source":"fallback","status":"finished"},"Belgium vs Egypt":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Saudi Arabia vs Uruguay":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"France vs Senegal":{"winner":"France","homeScore":3,"awayScore":1,"source":"fallback","status":"finished"},"Iraq vs Norway":{"winner":"Norway","homeScore":1,"awayScore":4,"source":"fallback","status":"finished"},"Argentina vs Algeria":{"winner":"Argentina","homeScore":3,"awayScore":0,"source":"fallback","status":"finished"},"Austria vs Jordan":{"winner":"Austria","homeScore":3,"awayScore":1,"source":"fallback","status":"finished"},"Portugal vs Democratic Republic of the Congo":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"England vs Croatia":{"winner":"England","homeScore":4,"awayScore":2,"source":"fallback","status":"finished"},"Uzbekistan vs Colombia":{"winner":"Colombia","homeScore":1,"awayScore":3,"source":"fallback","status":"finished"},"Ghana vs Panama":{"winner":"Ghana","homeScore":1,"awayScore":0,"source":"fallback","status":"finished"},"Mexico vs South Korea":{"winner":"Mexico","homeScore":1,"awayScore":0,"source":"fallback","status":"finished"},"Switzerland vs Bosnia and Herzegovina":{"winner":"Switzerland","homeScore":4,"awayScore":1,"source":"fallback","status":"finished"},"Canada vs Qatar":{"winner":"Canada","homeScore":6,"awayScore":0,"source":"fallback","status":"finished"},"Czech Republic vs South Africa":{"winner":null,"homeScore":1,"awayScore":1,"source":"fallback","status":"finished"},"Scotland vs Morocco":{"winner":"Morocco","homeScore":0,"awayScore":1,"source":"fallback","status":"finished"},"United States vs Australia":{"winner":"United States","homeScore":2,"awayScore":0,"source":"fallback","status":"finished"}};

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

    // Fallback: Backup Estático + Simulação
    console.info('[Live] 🔵 Modo Backup Estático — APIs indisponíveis, usando cache de 30 jogos.');
    const fallbackLive = {
        "Brazil vs Haiti": {
            homeScore: 3,
            awayScore: 0,
            minute: "50:15",
            homeScorers: ["Matheus Cunha 23', 36'", "Vinícius Júnior 45+3'"],
            awayScorers: [],
            status: "in_play",
            source: "offline_cache"
        }
    };
    return { mode: 'simulation', source: 'offline_cache', data: FALLBACK_RESULTS, liveScores: fallbackLive, hasLive: true };
}

// ── STATUS PÚBLICO ───────────────────────────────────────────────
window.liveDataSource = null;
const _originalGetDataSource = getDataSource;
window.getDataSource = async function () {
    const result = await _originalGetDataSource();
    window.liveDataSource = result.source;
    return result;
};
