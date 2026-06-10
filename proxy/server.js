// ==============================================================
// PROXY SERVER — football-data.org
// Lê configuração do arquivo .env automaticamente
// ==============================================================

// Carrega .env automaticamente (Node 20.6+ nativo; senão usa dotenv)
try {
    require('dotenv').config();
} catch (e) {
    // dotenv não instalado — tenta variável de ambiente do sistema
}

const express = require('express');
const app = express();
const PORT = process.env.PROXY_PORT || 3002;
const API_KEY = process.env.FOOTBALL_DATA_KEY || '';

// CORS — permite chamadas do frontend local
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Endpoint: partidas da Copa do Mundo 2026
// football-data.org usa o código "WC" para a Copa do Mundo
app.get('/wc2026/matches', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada no proxy.' });
    }

    try {
        // Node.js 18+ tem fetch nativo; senão usa node-fetch
        const fetcher = typeof fetch !== 'undefined' ? fetch : require('node-fetch');

        const response = await fetcher(
            'https://api.football-data.org/v4/competitions/WC/matches',
            {
                headers: {
                    'X-Auth-Token': API_KEY
                }
            }
        );

        if (!response.ok) {
            return res.status(response.status).json({
                error: `football-data.org retornou ${response.status}`
            });
        }

        const data = await response.json();
        return res.json(data);

    } catch (err) {
        console.error('[Proxy] Erro ao buscar dados:', err.message);
        return res.status(500).json({ error: err.message });
    }
});

// Endpoint: classificação dos grupos
app.get('/wc2026/standings', async (req, res) => {
    if (!API_KEY) {
        return res.status(503).json({ error: 'FOOTBALL_DATA_KEY não configurada.' });
    }

    try {
        const fetcher = typeof fetch !== 'undefined' ? fetch : require('node-fetch');
        const response = await fetcher(
            'https://api.football-data.org/v4/competitions/WC/standings',
            { headers: { 'X-Auth-Token': API_KEY } }
        );

        if (!response.ok) return res.status(response.status).json({ error: `Status ${response.status}` });

        const data = await response.json();
        return res.json(data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// Healthcheck
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        apiKeyConfigured: !!API_KEY,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`\n🔌 Proxy football-data.org rodando em http://localhost:${PORT}`);
    console.log(`   Endpoints disponíveis:`);
    console.log(`   GET /wc2026/matches   → Partidas da Copa 2026`);
    console.log(`   GET /wc2026/standings → Classificação dos grupos`);
    console.log(`   GET /health           → Healthcheck`);
    if (!API_KEY) {
        console.warn('\n⚠️  ATENÇÃO: FOOTBALL_DATA_KEY não configurada!');
        console.warn('   Configure: export FOOTBALL_DATA_KEY=sua_chave_aqui');
        console.warn('   Ou: set FOOTBALL_DATA_KEY=sua_chave_aqui  (Windows)');
        console.warn('   Obtenha sua chave gratuita em: https://www.football-data.org/client/register\n');
    } else {
        console.log('\n✅ API Key configurada. Proxy pronto para uso.');
    }
});
