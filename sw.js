/* Emergency Department: Code Black: plays offline once it has loaded once. Written by build.js; do not edit. */
const CACHE = 'overcrowded-0.31.0-47ac3e651f';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
// Other pages on this site (other games, other tools) keep their own caches: only this game's old copies are cleared.
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('overcrowded-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Online: fetch the newest copy and keep it. Offline: serve the kept copy.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.open(CACHE).then(c => c.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? c.match('index.html') : new Response('', { status: 503, statusText: 'Offline' }))))));
});
