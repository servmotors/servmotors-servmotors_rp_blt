const CACHE_NAME = 'serv-motors-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'Nova corrida disponível!',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'accept',
        title: 'Aceitar',
        icon: '/accept-icon.png'
      },
      {
        action: 'decline',
        title: 'Recusar',
        icon: '/decline-icon.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Serv Motors', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'accept') {
    // Open app and accept ride
    event.waitUntil(
      clients.openWindow('/?action=accept&ride=' + event.notification.data.primaryKey)
    );
  } else if (event.action === 'decline') {
    // Decline ride
    event.waitUntil(
      clients.openWindow('/?action=decline&ride=' + event.notification.data.primaryKey)
    );
  } else {
    // Open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});