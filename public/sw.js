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
        clients.openWindow(event.notification.data.url)
    );
});
