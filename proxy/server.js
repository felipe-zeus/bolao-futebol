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
const app = express();
// Railway injeta a porta via $PORT; localmente usa 3002
const PORT = process.env.PORT || process.env.PROXY_PORT || 3002;
const API_KEY = process.env.FOOTBALL_DATA_KEY || '';

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// ── 1. Secure Headers (Helmet) ─────────────────────────────────
app.use(helmet());

// ── 2. Rate Limiting (Bloqueio de DDoS) ────────────────────────
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // Limita cada IP a 60 requisições por `window` (por minuto)
    standardHeaders: true, 
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// ── 3. CORS Restrito ───────────────────────────────────────────
const allowedOrigins = ['https://bolao-futebol-rosy.vercel.app', 'http://localhost:3001', 'http://localhost:3000'];
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// ── Helper de fetch com retry ──────────────────────────────────
async function fetchFootballData(path) {
    if (!API_KEY) throw new Error('FOOTBALL_DATA_KEY não configurada no proxy.');

    const fetcher = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
    const response = await fetcher(
        `https://api.football-data.org/v4${path}`,
        { headers: { 'X-Auth-Token': API_KEY } }
    );

    if (!response.ok) {
        throw new Error(`football-data.org retornou ${response.status}`);
    }
    return response.json();
}

// ── Endpoint: partidas já encerradas ──────────────────────────
app.get('/wc2026/matches', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada no proxy.' });
    }
    try {
        const data = await fetchFootballData('/competitions/WC/matches');
        return res.json(data);
    } catch (err) {
        console.error('[Proxy] /matches erro:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ── Endpoint: jogos em andamento agora ────────────────────────
// Retorna partidas finalizadas + em andamento separadamente
app.get('/wc2026/live', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada no proxy.' });
    }
    try {
        const data = await fetchFootballData('/competitions/WC/matches');
        const matches = data?.matches || [];

        const finished = matches.filter(m => m.status === 'FINISHED');
        const inPlay   = matches.filter(m => ['IN_PLAY', 'PAUSED', 'HALF_TIME'].includes(m.status));
        const upcoming = matches.filter(m => ['TIMED', 'SCHEDULED'].includes(m.status));

        // Próxima partida agendada
        const nextMatch = upcoming.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0] || null;

        return res.json({
            finished,
            inPlay,
            nextMatch,
            totalFinished: finished.length,
            hasLive: inPlay.length > 0,
            fetchedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('[Proxy] /live erro:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// ── Endpoint: classificação dos grupos ────────────────────────
app.get('/wc2026/standings', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada.' });
    }
    try {
        const data = await fetchFootballData('/competitions/WC/standings');
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ── Healthcheck ───────────────────────────────────────────────
// ── Endpoint Scraper (Web Scraping Leve) ────────────────────────
app.get('/wc2026/live-minute', async (req, res) => {
    try {
        const fetcher = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
        const cheerio = require('cheerio');
        
        // Alvo genérico para simular a extração (como não há jogos reais acontecendo neste momento)
        // Usaremos o Google ou Flashscore. Para fins deste projeto e para poder quebrar intencionalmente
        // via seletor (se testarmos a quebra), vamos simular.
        
        // Exemplo: URL de placar ou serviço (vamos usar uma URL fixa de um site esportivo)
        // Como o Google bloqueia scrapers nativos muito rapido, simularemos uma resposta baseada em
        // um seletor especifico. Na prática, você rasparia uma div.
        
        // Simulação da quebra de layout para exibir o aviso solicitado:
        // Caso queiramos testar a quebra, basta mudar a flag abaixo
        const isLayoutBroken = true; 
        
        if (isLayoutBroken) {
            // Simula falha ao não encontrar o seletor na página HTML
            return res.status(200).json({ scraper_broken: true, error: "Elemento .live-time-clock não encontrado. Layout mudou!" });
        }
        
        // Simula o scraper retornando com sucesso (ex: "50:15")
        // No mundo real: 
        // const html = await fetcher('https://site.com').then(r => r.text());
        // const $ = cheerio.load(html);
        // const minute = $('.live-time-clock').text();
        
        const realMinuteScraped = "50:15"; // Scraped "successfully"
        
        res.json({ scraper_broken: false, minute: realMinuteScraped });
    } catch (e) {
        console.error('[Scraper] Falha ao executar web scraping:', e.message);
        res.status(200).json({ scraper_broken: true, error: e.message });
    }
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        apiKeyConfigured: !!API_KEY,
        timestamp: new Date().toISOString()
    });
});

// 0.0.0.0 necessário para Railway/cloud (localhost seria inacessível)
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🔌 Proxy football-data.org rodando em http://localhost:${PORT}`);
    console.log(`   Endpoints disponíveis:`);
    console.log(`   GET /wc2026/matches   → Todas as partidas`);
    console.log(`   GET /wc2026/live      → Partidas ao vivo + encerradas (recomendado)`);
    console.log(`   GET /wc2026/standings → Classificação dos grupos`);
    console.log(`   GET /health           → Healthcheck`);
    if (!API_KEY) {
        console.warn('\n⚠️  ATENÇÃO: FOOTBALL_DATA_KEY não configurada!');
        console.warn('   Configure no arquivo .env: FOOTBALL_DATA_KEY=sua_chave_aqui');
        console.warn('   Obtenha sua chave gratuita em: https://www.football-data.org/client/register\n');
    } else {
        console.log('\n✅ API Key configurada. Proxy pronto para uso.');
    }
});
