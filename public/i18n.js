const translations = {
    pt: {
        title: "🏆 Bolão Copa do Mundo 2026",
        subtitle: "Simulador baseado no Ranking Oficial FIFA • Dados em Tempo Real",
        champion_label: "O Grande Campeão",
        source_label: "Fonte",
        source_simulation: "Simulação baseada no Ranking FIFA",
        source_live: "Dados em Tempo Real",
        final: "A Grande Final",
        semifinals: "Semifinais",
        quarterfinals: "Quartas de Final",
        roundOf16: "Oitavas de Final",
        round32: "Fase de Classificação (32)",
        groups: "Fase de Grupos",
        rank: "Ranking FIFA",
        status_live: "🔴 Ao Vivo",
        status_simulation: "🔵 Simulação",
        qualified: "Classificados",
        pts: "Pts",
        loading: "Carregando dados...",
        error_load: "Erro ao carregar dados. Verifique sua conexão.",
        last_updated: "Última atualização",
        data_source: "Dados: Ranking FIFA + Simulação Matemática",
        group: "Grupo",
        standings_title: "Classificação",
        real_match: "jogo real",
        real_matches: "jogos reais",
        real_integrated: "jogos reais integrados",
        real_match_title: "jogo(s) com resultado real",
        source_live_detail: "jogos reais + simulação",
    },
    en: {
        title: "🏆 World Cup 2026 Predictor",
        subtitle: "Simulator powered by Official FIFA Rankings • Live Data",
        champion_label: "The Grand Champion",
        source_label: "Source",
        source_simulation: "Simulation based on FIFA Ranking",
        source_live: "Live Data",
        final: "The Grand Final",
        semifinals: "Semi-Finals",
        quarterfinals: "Quarter-Finals",
        roundOf16: "Round of 16",
        round32: "Round of 32",
        groups: "Group Stage",
        rank: "FIFA Rank",
        status_live: "🔴 Live",
        status_simulation: "🔵 Simulation",
        qualified: "Qualified",
        pts: "Pts",
        loading: "Loading data...",
        error_load: "Failed to load data. Check your connection.",
        last_updated: "Last updated",
        data_source: "Data: FIFA Ranking + Mathematical Simulation",
        group: "Group",
        standings_title: "Standings",
        real_match: "real match",
        real_matches: "real matches",
        real_integrated: "real matches integrated",
        real_match_title: "match(es) with real result",
        source_live_detail: "real matches + simulation",
    },
    es: {
        title: "🏆 Predictor Copa del Mundo 2026",
        subtitle: "Simulador basado en el Ranking Oficial FIFA • Datos en Vivo",
        champion_label: "El Gran Campeón",
        source_label: "Fuente",
        source_simulation: "Simulación basada en el Ranking FIFA",
        source_live: "Datos en Vivo",
        final: "La Gran Final",
        semifinals: "Semifinales",
        quarterfinals: "Cuartos de Final",
        roundOf16: "Octavos de Final",
        round32: "Fase de Clasificación (32)",
        groups: "Fase de Grupos",
        rank: "Ranking FIFA",
        status_live: "🔴 En Vivo",
        status_simulation: "🔵 Simulación",
        qualified: "Clasificados",
        pts: "Pts",
        loading: "Cargando datos...",
        error_load: "Error al cargar datos. Verifica tu conexión.",
        last_updated: "Última actualización",
        data_source: "Datos: Ranking FIFA + Simulación Matemática",
        group: "Grupo",
        standings_title: "Clasificación",
        real_match: "partido real",
        real_matches: "partidos reales",
        real_integrated: "partidos reales integrados",
        real_match_title: "partido(s) con resultado real",
        source_live_detail: "partidos reales + simulación",
    }
};

let currentLang = localStorage.getItem('lang') || 'pt';

function t(key) {
    return translations[currentLang]?.[key] || translations['pt'][key] || key;
}

function setLang(lang) {
    currentLang = lang;
    localStorage.setItem('lang', lang);
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    // Re-trigger app render if already loaded
    if (window.renderApp) window.renderApp();
}
