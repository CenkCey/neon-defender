export function createServiceWorker(files, version) {
  return `// Generated from the exact production files. No runtime dependencies.
const PREFIX = 'neon-defender:' + self.registration.scope + ':';
const CACHE = PREFIX + ${JSON.stringify(version)};
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  // No skipWaiting: never replace a running game mid-session.
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    if (request.mode === 'navigate') return (await cache.match('./index.html')) || fetch(request);
    const stored = await cache.match(request, { ignoreSearch: true });
    return stored || fetch(request);
  }));
});
`;
}
