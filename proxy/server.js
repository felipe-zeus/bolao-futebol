// ==============================================================
// PROXY SERVER — football-data.org
// Lê configuração do arquivo .env automaticamente
// ==============================================================

try {
    require('dotenv').config();
} catch (e) {
    // dotenv não instalado — tenta variável de ambiente do sistema
}

const express = require('express');
const fs      = require('fs');
const path    = require('path');
const app     = express();

// Railway injeta a porta via $PORT; localmente usa 3002
const PORT    = process.env.PORT || process.env.PROXY_PORT || 3002;
const API_KEY = process.env.FOOTBALL_DATA_KEY || '';

const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

// ── 1. Secure Headers (Helmet) ─────────────────────────────────
app.use(helmet());
app.use(express.json()); // Parse JSON body for Push Subscriptions

const webpush = require('web-push');

// Setup VAPID Keys for Push Notifications
const VAPID_KEYS_FILE = path.join(__dirname, 'vapidKeys.json');
let vapidKeys = {};
if (fs.existsSync(VAPID_KEYS_FILE)) {
    vapidKeys = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf8'));
} else {
    vapidKeys = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(vapidKeys));
}

webpush.setVapidDetails(
    'mailto:contato@bolao26.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

const SUBSCRIPTIONS_FILE = path.join(__dirname, 'subscriptions.json');
let subscriptions = [];
if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
    subscriptions = JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
}

// ── 2. Rate Limiting (Bloqueio de DDoS) ────────────────────────
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60,                  // 60 requisições por IP por minuto
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ── 3. CORS — Suporte completo incluindo preflight OPTIONS ──────
// Aceita qualquer subdomínio do vercel.app e do railway.app,
// além dos ambientes locais.
const ALLOWED_ORIGIN_PATTERNS = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
    /^https:\/\/[\w-]+\.vercel\.app$/,
    /^https:\/\/[\w-]+\.up\.railway\.app$/,
];

function isOriginAllowed(origin) {
    if (!origin) return true; // server-to-server (sem origin header)
    return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (isOriginAllowed(origin)) {
        res.header('Access-Control-Allow-Origin',  origin || '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
        res.header('Access-Control-Max-Age',       '86400'); // 24h cache do preflight
    }
    // Responde preflight imediatamente
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

// ── 4. Cache em memória (TTL 30s) — evita estourar rate limit ──
// A tier gratuita do football-data.org aceita 10 req/min.
// Com polling de 45-90s e múltiplos usuários, este cache serve
// todas as requisições dentro da janela sem re-bater na API.
const _cache = {};
function getCached(key) {
    const entry = _cache[key];
    if (!entry) return null;
    if (Date.now() - entry.ts > entry.ttl) { delete _cache[key]; return null; }
    return entry.data;
}
function setCache(key, data, ttlMs = 30_000) {
    _cache[key] = { data, ts: Date.now(), ttl: ttlMs };
}

// ── 5. Persistência em games.json (cache offline) ──────────────
const GAMES_JSON = path.join(__dirname, '..', 'games.json');
function persistCache(data) {
    try {
        fs.writeFileSync(GAMES_JSON, JSON.stringify({ savedAt: new Date().toISOString(), data }, null, 2));
    } catch (e) {
        console.warn('[Proxy] Falha ao persistir games.json:', e.message);
    }
}
function readPersistedCache() {
    try {
        const raw = fs.readFileSync(GAMES_JSON, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.data) return parsed.data;
    } catch (e) { /* arquivo vazio ou inexistente */ }
    return null;
}

// ── Helper de fetch ────────────────────────────────────────────
async function fetchFootballData(urlPath) {
    if (!API_KEY) throw new Error('FOOTBALL_DATA_KEY não configurada no proxy.');

    const fetcher = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
    const response = await fetcher(
        `https://api.football-data.org/v4${urlPath}`,
        { headers: { 'X-Auth-Token': API_KEY } }
    );

    if (!response.ok) {
        throw new Error(`football-data.org retornou ${response.status}: ${response.statusText}`);
    }
    return response.json();
}

// ── PUSH NOTIFICATIONS ENGINE ────────────────────────────────
let lastMatchesState = {};

function detectAndSendGoalPush(matches) {
    matches.forEach(m => {
        if (!['IN_PLAY', 'PAUSED'].includes(m.status)) return;
        
        const key = m.id;
        const currentHome = m.score?.fullTime?.home || 0;
        const currentAway = m.score?.fullTime?.away || 0;
        const homeName = m.homeTeam?.shortName || m.homeTeam?.name;
        const awayName = m.awayTeam?.shortName || m.awayTeam?.name;

        if (lastMatchesState[key]) {
            const prevHome = lastMatchesState[key].home;
            const prevAway = lastMatchesState[key].away;

            if (currentHome > prevHome || currentAway > prevAway) {
                const scoringTeam = currentHome > prevHome ? homeName : awayName;
                sendPushToAll(`⚽ GOL DA ${scoringTeam.toUpperCase()}!`, `${homeName} ${currentHome} x ${currentAway} ${awayName}`);
            }
        }
        
        lastMatchesState[key] = { home: currentHome, away: currentAway };
    });
}

function sendPushToAll(title, body) {
    console.log(`[Push] Disparando: ${title} - ${body}`);
    const payload = JSON.stringify({ title, body, url: '/' });
    
    subscriptions.forEach(sub => {
        webpush.sendNotification(sub, payload).catch(err => {
            if (err.statusCode === 410 || err.statusCode === 404) {
                subscriptions = subscriptions.filter(s => s.endpoint !== sub.endpoint);
                fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions));
            }
        });
    });
}

// Background polling loop (runs every 10 seconds to guarantee ultra-fast push alerts without hitting the 10 req/min rate limit)
setInterval(async () => {
    if (subscriptions.length === 0) return;
    try {
        const data = await fetchFootballData('/competitions/WC/matches');
        const matches = data?.matches || [];
        detectAndSendGoalPush(matches);
    } catch(e) {
        console.warn('[Proxy Push Polling] Erro background:', e.message);
    }
}, 10000);

// ── Endpoints de Push ──────────────────────────────────────────
app.get('/api/notifications/vapidPublicKey', (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
});

app.post('/api/notifications/subscribe', (req, res) => {
    const subscription = req.body;
    if (!subscriptions.some(s => s.endpoint === subscription.endpoint)) {
        subscriptions.push(subscription);
        fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions));
        console.log('[Push] Novo dispositivo inscrito!');
    }
    res.status(201).json({});
});

// ── Endpoint: todas as partidas ───────────────────────────────
app.get('/wc2026/matches', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada no proxy.' });
    }
    try {
        const cacheKey = 'wc2026_matches';
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const data = await fetchFootballData('/competitions/WC/matches');
        setCache(cacheKey, data, 30_000);
        return res.json(data);
    } catch (err) {
        console.error('[Proxy] /matches erro:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ── Endpoint: jogos ao vivo + encerrados (com cache + fallback) ─
app.get('/wc2026/live', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada no proxy.' });
    }

    // Serve do cache em memória se ainda válido
    const cacheKey = 'wc2026_live';
    const cached = getCached(cacheKey);
    if (cached) {
        return res.json({ ...cached, fromCache: true });
    }

    try {
        const data    = await fetchFootballData('/competitions/WC/matches');
        const matches = data?.matches || [];

        const finished = matches.filter(m => m.status === 'FINISHED');
        const inPlay   = matches.filter(m => ['IN_PLAY', 'PAUSED', 'HALF_TIME'].includes(m.status));
        const upcoming = matches.filter(m => ['TIMED', 'SCHEDULED'].includes(m.status));

        const upcomingSorted = upcoming.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
        const nextMatch      = upcomingSorted[0] || null;

        const responseData = {
            finished,
            inPlay,
            nextMatch,
            upcomingMatches: upcomingSorted,
            totalFinished:   finished.length,
            hasLive:         inPlay.length > 0,
            fetchedAt:       new Date().toISOString(),
            fromCache:       false
        };

        // Cache em memória: 30s com jogo ao vivo, 60s sem jogo
        const ttl = inPlay.length > 0 ? 30_000 : 60_000;
        setCache(cacheKey, responseData, ttl);

        // Persiste em disco para fallback offline
        persistCache(responseData);

        return res.json(responseData);

    } catch (err) {
        console.error('[Proxy] /live erro:', err.message);

        // Fallback: tenta ler do cache em disco (games.json)
        const persisted = readPersistedCache();
        if (persisted) {
            console.warn('[Proxy] Usando cache persistido em games.json');
            return res.json({ ...persisted, fromCache: true, cacheWarning: 'API indisponível — dados do cache local' });
        }

        return res.status(500).json({ error: err.message });
    }
});

// ── Endpoint: classificação dos grupos ────────────────────────
app.get('/wc2026/standings', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada.' });
    }
    try {
        const cacheKey = 'wc2026_standings';
        const cached = getCached(cacheKey);
        if (cached) return res.json(cached);

        const data = await fetchFootballData('/competitions/WC/standings');
        setCache(cacheKey, data, 120_000); // standings mudam menos — cache de 2min
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── Healthcheck ───────────────────────────────────────────────
app.get('/health', (req, res) => {
    const persisted = readPersistedCache();
    res.json({
        status:           'ok',
        apiKeyConfigured: !!API_KEY,
        cacheInMemory:    Object.keys(_cache).length,
        cacheOnDisk:      !!persisted,
        diskCacheSavedAt: persisted ? (persisted.fetchedAt || 'desconhecido') : null,
        timestamp:        new Date().toISOString()
    });
});

// 0.0.0.0 necessário para Railway/cloud (localhost seria inacessível)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🔌 Proxy football-data.org rodando em http://localhost:${PORT}`);
    console.log(`   Endpoints disponíveis:`);
    console.log(`   GET /wc2026/matches   → Todas as partidas`);
    console.log(`   GET /wc2026/live      → Partidas ao vivo + encerradas (com cache 30s)`);
    console.log(`   GET /wc2026/standings → Classificação dos grupos`);
    console.log(`   GET /health           → Healthcheck + status do cache`);
    if (!API_KEY) {
        console.warn('\n⚠️  ATENÇÃO: FOOTBALL_DATA_KEY não configurada!');
        console.warn('   Configure no arquivo .env: FOOTBALL_DATA_KEY=sua_chave_aqui');
        console.warn('   Obtenha sua chave gratuita em: https://www.football-data.org/client/register\n');
    } else {
        console.log('\n✅ API Key configurada. Cache de 30s ativo. Proxy pronto para uso.\n');
    }
});
