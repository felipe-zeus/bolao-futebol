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

// CORS — permite chamadas do frontend local
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
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
