const STATIC_CACHE = 'trainer-static-v7';
const RUNTIME_CACHE = 'trainer-runtime-v7';
const APP_SHELL = './index.html';

const PRECACHE_URLS = [
  './',
  './index.html',
  './index.html?v=7',
  './manifest.webmanifest',
  './manifest.webmanifest?v=7',
  './icon.svg',
  './trainer-clean-icon.svg',
  './trainer-192.png',
  './trainer-192.png?v=7',
  './trainer-512.png',
  './trainer-512.png?v=7'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  event.respondWith(handleAssetRequest(request, url));
});

async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request);
    await cacheResponse(RUNTIME_CACHE, request, networkResponse);
    return networkResponse;
  } catch (error) {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(APP_SHELL, { ignoreSearch: true }))
    );
  }
}

async function handleAssetRequest(request, url) {
  const cachedResponse = await caches.match(request, { ignoreSearch: true });
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    const targetCache = url.origin === self.location.origin ? STATIC_CACHE : RUNTIME_CACHE;
    await cacheResponse(targetCache, request, networkResponse);
    return networkResponse;
  } catch (error) {
    return caches.match(APP_SHELL, { ignoreSearch: true });
  }
}

async function cacheResponse(cacheName, request, response) {
  if (!response || (!response.ok && response.type !== 'opaque')) {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}