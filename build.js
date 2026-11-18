// Builds index.html: one self-contained page with the engine, UI, styles, and fonts inlined.
const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const font = (fam, file, weight, style = 'normal') => {
  const b64 = fs.readFileSync(path.join(__dirname, 'node_modules/@fontsource', file)).toString('base64');
  return `@font-face{font-family:"${fam}";font-style:${style};font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
};
const fonts = [
  font('Cardo', 'cardo/files/cardo-latin-400-normal.woff2', 400),
  font('Cardo', 'cardo/files/cardo-latin-700-normal.woff2', 700),
  font('Cardo', 'cardo/files/cardo-latin-400-italic.woff2', 400, 'italic'),
].join('\n');
// A script that does not parse would ship as a blank page, so stop here if one does not.
const vm = require('vm');
for (const [name, code] of [['engine.js', src('engine.js')], ['ui.js + map.js', src('ui.js').replace('/*MAP*/', () => src('map.js'))]]) {
  try { new vm.Script(code, { filename: name }); } catch (e) { console.error(`build stopped: ${name} does not parse: ${e.message}`); process.exit(1); }
}
const html = src('index.template.html')
  .replace('/*FONTS*/', () => fonts).replace('/*STYLE*/', () => src('style.css'))
  .replace('/*ENGINE*/', () => src('engine.js')).replace('/*UI*/', () => src('ui.js').replace('/*MAP*/', () => src('map.js')));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
// The service worker: the game plays offline once it has loaded once. The cache name changes with every build.
const stamp = require('./package.json').version + '-' + require('crypto').createHash('sha1').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(__dirname, 'sw.js'), `/* Overcrowded: plays offline once it has loaded once. Written by build.js; do not edit. */
const CACHE = 'overcrowded-${stamp}';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
// Other pages on this site (other games, other tools) keep their own caches: only this game's old copies are cleared.
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('overcrowded-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// Online: fetch the newest copy and keep it. Offline: serve the kept copy.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(r, copy)); } return res; })
    .catch(() => caches.open(CACHE).then(c => c.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? c.match('index.html') : Response.error())))));
});
`);
console.log('built index.html', (html.length / 1024).toFixed(1), 'KB');
