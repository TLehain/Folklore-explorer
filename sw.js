// Folklore Explorer service worker.
// Bump VERSION whenever you deploy changed files, so visitors receive them.
const VERSION = 'v1';
const SHELL_CACHE = `folklore-shell-${VERSION}`;
const WALK_CACHE = 'folklore-walks-v1'; // not versioned, so saved walks survive updates
const TILE_CACHE = 'folklore-tiles-v1';
const MAX_TILES = 400; // only tiles the person has already viewed are kept

const SHELL_FILES = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'stories.json',
  'walks.json',
  'favicon.png',
  'js/app.js',
  'js/dialog.js',
  'js/location.js',
  'js/notify.js',
  'js/offline.js',
  'js/stories.js',
  'js/util.js',
  'js/walks.js'
];

const CDN_FILES = [
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css',
  'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.js'
];

const CACHEABLE_CDN_HOSTS = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache =>
      Promise.all(
        SHELL_FILES.concat(CDN_FILES).map(url =>
          cache.add(url).catch(error => console.warn('Precache failed for', url, error))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('folklore-shell-') && key !== SHELL_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(tileStrategy(request));
    return;
  }

  if (url.origin !== self.location.origin) {
    if (CACHEABLE_CDN_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    }
    return; // everything else (such as route requests) goes straight to the network
  }

  if (/\.(mp3|webp|jpg|jpeg|png|gif)$/i.test(url.pathname)) {
    event.respondWith(mediaStrategy(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok || response.type === 'opaque') {
      await cache.put(request, response.clone());
      trimCache(cache, MAX_TILES);
    }
    return response;
  } catch (error) {
    return Response.error();
  }
}

async function trimCache(cache, maxItems) {
  const keys = await cache.keys();
  const excess = keys.length - maxItems;
  for (let index = 0; index < excess; index++) {
    await cache.delete(keys[index]);
  }
}

function fetchWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(request, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

// Pages, scripts, styles, and data: use the network when it answers quickly,
// otherwise fall back to the saved copy (important on weak rural signal).
async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetchWithTimeout(request, 4000);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await caches.match('index.html');
      if (shell) return shell;
    }
    return Response.error();
  }
}

// Images and audio: serve saved copies first. Browsers request audio in byte
// ranges, so saved files are sliced to answer those requests.
async function mediaStrategy(request) {
  const cached = await caches.match(request.url);
  if (cached) {
    const range = request.headers.get('range');
    return range ? rangeResponse(cached, range) : cached;
  }

  const response = await fetch(request);
  if (response.status === 200 && !/\.mp3$/i.test(new URL(request.url).pathname)) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request.url, response.clone());
  }
  return response;
}

async function rangeResponse(cached, rangeHeader) {
  const buffer = await cached.clone().arrayBuffer();
  const total = buffer.byteLength;
  const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
  if (!match) return cached;

  let start;
  let end;
  if (match[1] === '' && match[2] !== '') {
    start = Math.max(0, total - parseInt(match[2], 10)); // suffix range
    end = total - 1;
  } else {
    start = match[1] === '' ? 0 : parseInt(match[1], 10);
    end = match[2] === '' ? total - 1 : Math.min(parseInt(match[2], 10), total - 1);
  }

  if (start >= total || start > end) {
    return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
  }

  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers: {
      'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Length': String(end - start + 1),
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes'
    }
  });
}
