const translations = {
    pt: {
        // Header / título
        title: "🏆 Bolão Copa do Mundo 2026",
        subtitle: "Simulador baseado no Ranking Oficial FIFA • Dados em Tempo Real",

        // Status badge
        status_live: "🔴 Ao Vivo",
        status_live_playing: "🔴 Em Andamento",
        status_simulation: "🔵 Simulação",

        // Seções
        champion_label: "O Grande Campeão",
        final: "A Grande Final",
        semifinals: "Semifinais",
        quarterfinals: "Quartas de Final",
        roundOf16: "Oitavas de Final",
        round32: "Fase de Classificação (32)",
        groups: "Fase de Grupos",
        rank: "Ranking FIFA",

        // Fonte de dados
        source_label: "Fonte",
        source_simulation: "Simulação baseada no Ranking FIFA",
        source_live: "Dados em Tempo Real",
        source_live_detail: "jogos reais + simulação",

        // Tabelas / grupos
        group: "Grupo",
        pts: "Pts",
        vs: "VS",
        qualified: "Classificado",
        standings_title: "Classificação",
        rank_col: "Rank",
        team_col: "Seleção",
        pts_col: "Pontos",

        // Campeão
        champion_rank_badge: "Ranking FIFA",
        champion_pts_label: "pts",

        // Jogos reais
        real_match: "jogo real",
        real_matches: "jogos reais",
        real_integrated: "jogos reais integrados",
        real_match_title: "jogo(s) com resultado real",
        live_score: "Ao Vivo",
        halftime: "Intervalo",
        finished: "Encerrado",
        not_started: "Não iniciado",

        // Geral
        loading: "Carregando dados...",
        error_load: "Erro ao carregar dados. Verifique sua conexão.",
        last_updated: "Última atualização",
        data_source: "Dados: Ranking FIFA + Simulação Matemática",
        next_update: "Próxima atualização em",
        seconds: "seg",
        refreshing: "Atualizando...",
    },
    en: {
        title: "🏆 World Cup 2026 Predictor",
        subtitle: "Simulator powered by Official FIFA Rankings • Live Data",

        status_live: "🔴 Live",
        status_live_playing: "🔴 In Progress",
        status_simulation: "🔵 Simulation",

        champion_label: "The Grand Champion",
        final: "The Grand Final",
        semifinals: "Semi-Finals",
        quarterfinals: "Quarter-Finals",
        roundOf16: "Round of 16",
        round32: "Round of 32",
        groups: "Group Stage",
        rank: "FIFA Ranking",

        source_label: "Source",
        source_simulation: "Simulation based on FIFA Ranking",
        source_live: "Live Data",
        source_live_detail: "real matches + simulation",

        group: "Group",
        pts: "Pts",
        vs: "VS",
        qualified: "Qualified",
        standings_title: "Standings",
        rank_col: "Rank",
        team_col: "Team",
        pts_col: "Points",

        champion_rank_badge: "FIFA Ranking",
        champion_pts_label: "pts",

        real_match: "real match",
        real_matches: "real matches",
        real_integrated: "real matches integrated",
        real_match_title: "match(es) with real result",
        live_score: "Live",
        halftime: "Half-Time",
        finished: "Finished",
        not_started: "Not Started",

        loading: "Loading data...",
        error_load: "Failed to load data. Check your connection.",
        last_updated: "Last updated",
        data_source: "Data: FIFA Ranking + Mathematical Simulation",
        next_update: "Next update in",
        seconds: "sec",
        refreshing: "Refreshing...",
    },
    es: {
        title: "🏆 Predictor Copa del Mundo 2026",
        subtitle: "Simulador basado en el Ranking Oficial FIFA • Datos en Vivo",

        status_live: "🔴 En Vivo",
        status_live_playing: "🔴 En Juego",
        status_simulation: "🔵 Simulación",

        champion_label: "El Gran Campeón",
        final: "La Gran Final",
        semifinals: "Semifinales",
        quarterfinals: "Cuartos de Final",
        roundOf16: "Octavos de Final",
        round32: "Fase de Clasificación (32)",
        groups: "Fase de Grupos",
        rank: "Ranking FIFA",

        source_label: "Fuente",
        source_simulation: "Simulación basada en el Ranking FIFA",
        source_live: "Datos en Vivo",
        source_live_detail: "partidos reales + simulación",

        group: "Grupo",
        pts: "Pts",
        vs: "VS",
        qualified: "Clasificado",
        standings_title: "Clasificación",
        rank_col: "Rank",
        team_col: "Equipo",
        pts_col: "Puntos",

        champion_rank_badge: "Ranking FIFA",
        champion_pts_label: "pts",

        real_match: "partido real",
        real_matches: "partidos reales",
        real_integrated: "partidos reales integrados",
        real_match_title: "partido(s) con resultado real",
        live_score: "En Vivo",
        halftime: "Medio Tiempo",
        finished: "Terminado",
        not_started: "No Iniciado",

        loading: "Cargando datos...",
        error_load: "Error al cargar datos. Verifica tu conexión.",
        last_updated: "Última actualización",
        data_source: "Datos: Ranking FIFA + Simulación Matemática",
        next_update: "Próxima actualización en",
        seconds: "seg",
        refreshing: "Actualizando...",
    }
};

// ── Nomes das Seleções — Tradução por Idioma ─────────────────────
// Chave: nome interno em inglês (chave em engine.js / FIFA_RANKINGS)
const teamNames = {
    pt: {
        "France":"França","Spain":"Espanha","Argentina":"Argentina",
        "England":"Inglaterra","Portugal":"Portugal","Brazil":"Brasil",
        "Netherlands":"Países Baixos","Morocco":"Marrocos","Belgium":"Bélgica",
        "Germany":"Alemanha","Croatia":"Croácia","Italy":"Itália",
        "Colombia":"Colômbia","Senegal":"Senegal","Mexico":"México",
        "United States":"Estados Unidos","Uruguay":"Uruguai","Japan":"Japão",
        "Switzerland":"Suíça","Denmark":"Dinamarca","Austria":"Áustria",
        "Ecuador":"Equador","South Korea":"Coreia do Sul","Algeria":"Argélia",
        "Norway":"Noruega","Iran":"Irã","Australia":"Austrália",
        "Tunisia":"Tunísia","Egypt":"Egito","Canada":"Canadá",
        "Saudi Arabia":"Arábia Saudita","Ivory Coast":"Costa do Marfim",
        "Paraguay":"Paraguai","Ghana":"Gana","Uzbekistan":"Uzbequistão",
        "Scotland":"Escócia","Ukraine":"Ucrânia","Cape Verde":"Cabo Verde",
        "Haiti":"Haiti","Jordan":"Jordânia","New Zealand":"Nova Zelândia",
        "Panama":"Panamá","South Africa":"África do Sul","Curaçao":"Curaçao",
        "Qatar":"Catar","Bolivia":"Bolívia","DR Congo":"RD do Congo",
        "Jamaica":"Jamaica","Poland":"Polônia","Sweden":"Suécia",
    },
    es: {
        "France":"Francia","Spain":"España","Argentina":"Argentina",
        "England":"Inglaterra","Portugal":"Portugal","Brazil":"Brasil",
        "Netherlands":"Países Bajos","Morocco":"Marruecos","Belgium":"Bélgica",
        "Germany":"Alemania","Croatia":"Croacia","Italy":"Italia",
        "Colombia":"Colombia","Senegal":"Senegal","Mexico":"México",
        "United States":"Estados Unidos","Uruguay":"Uruguay","Japan":"Japón",
        "Switzerland":"Suiza","Denmark":"Dinamarca","Austria":"Austria",
        "Ecuador":"Ecuador","South Korea":"Corea del Sur","Algeria":"Argelia",
        "Norway":"Noruega","Iran":"Irán","Australia":"Australia",
        "Tunisia":"Túnez","Egypt":"Egipto","Canada":"Canadá",
        "Saudi Arabia":"Arabia Saudita","Ivory Coast":"Costa de Marfil",
        "Paraguay":"Paraguay","Ghana":"Ghana","Uzbekistan":"Uzbekistán",
        "Scotland":"Escocia","Ukraine":"Ucrania","Cape Verde":"Cabo Verde",
        "Haiti":"Haití","Jordan":"Jordania","New Zealand":"Nueva Zelanda",
        "Panama":"Panamá","South Africa":"Sudáfrica","Curaçao":"Curaçao",
        "Qatar":"Catar","Bolivia":"Bolivia","DR Congo":"RD del Congo",
        "Jamaica":"Jamaica","Poland":"Polonia","Sweden":"Suecia",
    }
};

let currentLang = localStorage.getItem('lang') || 'pt';

// Traduz nome de seleção para o idioma atual (EN = sem alteração)
function tTeam(englishName) {
    if (!englishName) return englishName;
    return teamNames[currentLang]?.[englishName] ?? englishName;
}

function t(key) {
    return translations[currentLang]?.[key] || translations['pt'][key] || key;
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);

    // Atualiza elementos estáticos com data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Atualiza botões de idioma
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Re-renderiza o app completo para aplicar traduções dinâmicas
    if (window.renderApp) window.renderApp();
}
