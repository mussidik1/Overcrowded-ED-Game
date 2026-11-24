// Builds index.html: one self-contained page with the engine, UI, styles, and fonts inlined.
const fs = require('fs'), path = require('path');
// The class-results database's address, public key and privacy contact (src/backend.json), for the game and the CSP.
const BACKEND = (b => { if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(b.url) || !/^sb_publishable_[\w-]+$/.test(b.key)) { console.error('build stopped: src/backend.json needs a Supabase url and a publishable key'); process.exit(1); } return { url: b.url, key: b.key, contact: String(b.contact || '') }; })(require('./src/backend.json'));
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
// v0.29.1: load the engine for real, so the load-time case checks (addCase, lintCases) run here, not first in a player's browser.
try { require('./src/engine.js'); } catch (e) { console.error(`build stopped: the engine fails at load: ${e.message}`); process.exit(1); }
// A script that does not parse would ship as a blank page, so stop here if one does not.
const vm = require('vm');
for (const [name, code] of [['engine.js', src('engine.js')], ['ui.js + map.js', src('ui.js').replace('/*MAP*/', () => src('map.js'))]]) {
  try { new vm.Script(code, { filename: name }); } catch (e) { console.error(`build stopped: ${name} does not parse: ${e.message}`); process.exit(1); }
}
// Imaging credits (img/credits.json: picture key -> "author, licence, source"), shown in the imaging viewer.
let credits = {}; try { credits = JSON.parse(fs.readFileSync(path.join(__dirname, 'img/credits.json'), 'utf8')); } catch (e) { /* no pictures yet */ }
const credit = {}; for (const [k, c] of Object.entries(credits)) credit[k] = typeof c === 'string' ? { t: c } : { t: `${c.author}, ${c.license}, ${c.source || 'Wikimedia Commons'}`, u: c.url || '', f: c.file || '' };
let html = src('index.template.html')
  .replace('/*FONTS*/', () => fonts).replace('/*STYLE*/', () => src('style.css'))
  .replace('/*ENGINE*/', () => src('engine.js')).replace('/*UI*/', () => src('ui.js').replace('/*MAP*/', () => src('map.js')).replace('/*IMGCREDIT*/{}', () => JSON.stringify(credit)).replace("'/*BACKEND*/'", () => JSON.stringify(BACKEND)).replace("'/*GAMEV*/'", () => JSON.stringify(require('./package.json').version)));
// v0.29.1: a Content Security Policy. Only the page's own two inline scripts run (allowed by their sha256), plus scripts
// from this site (the 3D floor). 'wasm-unsafe-eval' is for the 3D models' meshopt decoder. The only outside address is the
// class results database. tools/pack3d.js takes this out of the private Claude copy, whose host adds its own scripts.
const crypto = require('crypto');
const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => `'sha256-${crypto.createHash('sha256').update(m[1], 'utf8').digest('base64')}'`);
if (hashes.length !== 2) { console.error(`build stopped: expected 2 inline scripts, found ${hashes.length}`); process.exit(1); }
const CSP = ["default-src 'self'", `script-src 'self' ${hashes.join(' ')} 'wasm-unsafe-eval'`, "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self' data:", `connect-src 'self' blob: data: ${BACKEND.url}`, "worker-src 'self' blob:", "manifest-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"].join('; ');
html = html.replace('/*CSP*/', () => CSP);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
// The service worker: the game plays offline once it has loaded once. The cache name changes with every build.
const stamp = require('./package.json').version + '-' + crypto.createHash('sha1').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(__dirname, 'sw.js'), `/* Emergency Department: Code Black: plays offline once it has loaded once. Written by build.js; do not edit. */
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
    .catch(() => caches.open(CACHE).then(c => c.match(r, { ignoreSearch: true }).then(m => m || (r.mode === 'navigate' ? c.match('index.html') : new Response('', { status: 503, statusText: 'Offline' }))))));
});
`);
console.log('built index.html', (html.length / 1024).toFixed(1), 'KB');
