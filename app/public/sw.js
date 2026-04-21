// The Book Times Service Worker
// Provides offline caching, asset pre-caching, and API cache-first strategies

// __BUILD_ID__ is replaced at Docker build time with the commit SHA so each
// deploy invalidates old caches. Falls back to a stable id for local dev.
const CACHE_VERSION = 'thebooktimes-__BUILD_ID__';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// â”€â”€ Assets to pre-cache on install â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
];

// â”€â”€ Cache size limits â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const API_CACHE_MAX = 100;     // Max API responses to cache
const IMAGE_CACHE_MAX = 200;   // Max images to cache
const API_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes for API data

// â”€â”€ Install: pre-cache shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// â”€â”€ Activate: clean old caches â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('thebooktimes-') && key !== STATIC_CACHE && key !== API_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// â”€â”€ Fetch strategies â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip non-http(s) schemes (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // Skip admin routes â€” always network
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api/admin')) return;

  // Skip auth-related API calls
  if (url.pathname.startsWith('/api/auth')) return;

  // Strategy 1: API requests â€” Network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request, API_CACHE, API_CACHE_TTL));
    return;
  }

  // Strategy 2: Image requests â€” Cache-first with network fallback
  if (isImageRequest(request)) {
    event.respondWith(cacheFirstWithNetwork(request, IMAGE_CACHE));
    return;
  }

  // Strategy 3: Static assets (JS, CSS) â€” Cache-first (hashed filenames = immutable)
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request, STATIC_CACHE));
    return;
  }

  // Strategy 4: Navigation (SPA pages) â€” Network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the response for offline
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put('/', clone));
          return response;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // Strategy 5: Everything else â€” Network with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// â”€â”€ Helper: Network-first with timed cache â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function networkFirstWithCache(request, cacheName, ttl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      const cache = await caches.open(cacheName);

      // Store with timestamp header for TTL checking
      const headers = new Headers(clone.headers);
      headers.set('sw-cache-time', Date.now().toString());
      const body = await clone.blob();
      const cachedResponse = new Response(body, { status: clone.status, statusText: clone.statusText, headers });
      await cache.put(request, cachedResponse);

      // Evict old entries if over limit
      await trimCache(cacheName, API_CACHE_MAX);
    }
    return response;
  } catch {
    // Network failed â€” try cache
    const cached = await caches.match(request);
    if (cached) {
      // Check TTL
      const cacheTime = cached.headers.get('sw-cache-time');
      if (cacheTime && Date.now() - parseInt(cacheTime) < ttl) {
        return cached;
      }
      // Expired but still return as offline fallback
      return cached;
    }
    // No cache â€” return offline response
    return new Response(JSON.stringify({ error: 'You are offline', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// â”€â”€ Helper: Cache-first with network fallback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function cacheFirstWithNetwork(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());

      // Trim image cache to prevent storage bloat
      if (cacheName === IMAGE_CACHE) {
        await trimCache(cacheName, IMAGE_CACHE_MAX);
      }
    }
    return response;
  } catch {
    // Return transparent pixel for failed images
    if (isImageRequest(request)) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect fill="#f3f0ea" width="200" height="300"/><text x="100" y="150" text-anchor="middle" font-size="14" fill="#999">Offline</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('Offline', { status: 503 });
  }
}

// â”€â”€ Helper: Check if request is for an image â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isImageRequest(request) {
  const accept = request.headers.get('accept') || '';
  const url = request.url;
  return accept.includes('image/') ||
    /\.(jpg|jpeg|png|gif|svg|webp|avif|ico)(\?|$)/i.test(url) ||
    url.includes('images.unsplash.com') ||
    url.includes('books.googleusercontent.com');
}

// â”€â”€ Helper: Check if pathname is a static asset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isStaticAsset(pathname) {
  return /\.(js|css|woff2?|ttf|eot)(\?|$)/i.test(pathname) ||
    pathname.startsWith('/assets/');
}

// â”€â”€ Helper: Trim cache to max entries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    // Delete oldest entries (FIFO)
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map((key) => cache.delete(key)));
  }
}

// â”€â”€ Background sync placeholder for offline reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});

// â”€â”€ Offline queue for mutating requests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// When the user makes a POST/PUT/DELETE while offline, queue it for replay.
const OFFLINE_QUEUE_KEY = 'thebooktimes-offline-queue';

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only intercept mutating API requests
  if (request.method === 'GET' || !request.url.includes('/api/')) return;

  event.respondWith(
    fetch(request.clone()).catch(async () => {
      // Network failed â€” queue the request
      try {
        const body = await request.clone().text();
        const queued = {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          body,
          timestamp: Date.now(),
        };

        // Store in IndexedDB via cache API workaround
        const cache = await caches.open(OFFLINE_QUEUE_KEY);
        const queueKey = new Request(`/_offline-queue/${Date.now()}`);
        await cache.put(queueKey, new Response(JSON.stringify(queued)));
      } catch { /* silently fail if storage is full */ }

      return new Response(
        JSON.stringify({ queued: true, message: 'Request queued for when you are back online' }),
        { status: 202, headers: { 'Content-Type': 'application/json' } }
      );
    })
  );
});

// â”€â”€ Replay offline queue when back online â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('sync', (event) => {
  if (event.tag === 'replay-offline-queue') {
    event.waitUntil(replayOfflineQueue());
  }
});

async function replayOfflineQueue() {
  try {
    const cache = await caches.open(OFFLINE_QUEUE_KEY);
    const keys = await cache.keys();

    for (const key of keys) {
      const response = await cache.match(key);
      if (!response) continue;

      const queued = JSON.parse(await response.text());
      try {
        await fetch(queued.url, {
          method: queued.method,
          headers: queued.headers,
          body: queued.method !== 'GET' ? queued.body : undefined,
        });
        await cache.delete(key);
      } catch {
        // Still offline â€” keep in queue
        break;
      }
    }
  } catch { /* ignore errors during replay */ }
}

// â”€â”€ Periodic background sync (check for new content) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'refresh-trending') {
    event.waitUntil(
      fetch('/api/books/trending?limit=10')
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(API_CACHE);
            await cache.put(new Request('/api/books/trending?limit=10'), response);
          }
        })
        .catch(() => { /* offline, skip */ })
    );
  }
});
