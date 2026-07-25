const CACHE_NAME = 'labores-cache-v15';
const urlsToCache = [
  './',
  './index.html',
  './LaboresV15.html',
  './pdf-lib.min.js',
  './manifest.json',
  './icon.png',
  './logo_corrected.jpg'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Forza al SW a activarse inmediatamente
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('Algunos archivos no se pudieron pre-cachear:', err);
        });
      })
  );
});

self.addEventListener('activate', event => {
  self.clients.claim(); // Toma el control de las pestañas abiertas
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name.startsWith('labores-cache-'))
          .map(name => caches.delete(name))
      );
    })
  );
});

// Estrategia combinada: Stale-While-Revalidate con Fallback a index.html
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  // Ignorar extensiones o esquemas raros
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cachedResponse => {
      
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Guardamos en caché las respuestas válidas, incluyendo CORS (ej. Google Fonts)
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return networkResponse;
      }).catch(err => {
        console.log('Fallo de red al intentar descargar:', event.request.url);
        return null; // Resolvemos con null para manejar el fallo gracefully
      });

      // Si es una petición de navegación (abrir la app) y no hay caché, intentamos red o fallback a index.html
      if (event.request.mode === 'navigate') {
        return fetchPromise.then(res => {
          return res || cachedResponse || caches.match('./index.html', { ignoreSearch: true });
        });
      }

      // Para el resto (imágenes, fuentes, js): Devolvemos caché si hay, y de fondo actualizamos (Stale-While-Revalidate)
      // Si no hay caché, esperamos a la red.
      return cachedResponse || fetchPromise;
    })
  );
});
