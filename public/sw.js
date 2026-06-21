const CACHE_NAME = 'bolao26-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/live.js',
    '/engine.js',
    '/config.js',
    'https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg'
];

// ── INSTALAÇÃO E CACHE ESTÁTICO ───────────────────────────────
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('[Service Worker] Fazendo cache dos arquivos estáticos');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// ── INTERCEPTAÇÃO DE REDE (FETCH) ──────────────────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Estratégia Network-First para chamadas de API (Proxy e WorldCup26)
    if (url.pathname.includes('/wc2026/live') || url.hostname.includes('worldcup26.ir')) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clonedRes = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedRes));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Estratégia Cache-First para Arquivos Estáticos
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            return cachedResponse || fetch(event.request).then(response => {
                const clonedRes = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clonedRes));
                return response;
            });
        }).catch(() => {
            // Fallback em caso extremo (ex: navegação offline sem cache index)
            if (event.request.mode === 'navigate') {
                return caches.match('/');
            }
        })
    );
});

// ── PUSH NOTIFICATIONS ─────────────────────────────────────────
self.addEventListener('push', function(event) {
    if (event.data) {
        const payload = event.data.json();
        const title = payload.title || 'Bolão 26';
        const options = {
            body: payload.body,
            icon: payload.icon || 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg',
            badge: payload.badge || 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Soccerball.svg',
            vibrate: [200, 100, 200, 100, 200, 100, 400],
            data: { url: payload.url || '/' }
        };

        event.waitUntil(self.registration.showNotification(title, options));
    }
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let client of windowClients) {
                if (client.url === event.notification.data.url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(event.notification.data.url);
            }
        })
    );
});
