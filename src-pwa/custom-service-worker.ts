/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

// Cacheo de activos estáticos
const CACHE_NAME = 'pos-pwa-v1';
const urlsToCache = ['/', '/index.html', '/manifest.webmanifest'];

// Instalación del service worker
self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((error) => {
        console.warn('Algún archivo no pudo ser cacheado:', error);
      });
    }),
  );
  void self.skipWaiting();
});

// Activación del service worker
self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        }),
      );
    }),
  );
  void self.clients.claim();
});

// Estrategia: Network first, fallback to cache
self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;

  // Solo cachear GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // No cachear respuestas que no sean 200
        if (!response || response.status !== 200) {
          return response;
        }

        // Cachear respuesta exitosa
        const responseToCache = response.clone();
        void caches.open(CACHE_NAME).then((cache) => {
          void cache.put(request, responseToCache);
        });

        return response;
      })
      .catch(() => {
        // Fallback a cache si la red falla
        return caches.match(request).then((response) => {
          return (
            response ||
            new Response('Offline - recurso no disponible', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain',
              }),
            })
          );
        });
      }),
  );
});

// Manejo de mensajes desde clientes
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    void caches.delete(CACHE_NAME).then(() => {
      if (event.ports[0]) {
        event.ports[0].postMessage({ success: true });
      }
    });
  }
});

export {};
