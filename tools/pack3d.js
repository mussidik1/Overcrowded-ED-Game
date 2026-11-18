// Packs the 3D models into script files, for hosts that serve scripts but not model files (the private Claude link).
// node tools/pack3d.js OUTDIR  -> OUTDIR/3d/map3d.js, pack-index.js, pack-1.js ... (about 4 MB each)
const fs = require('fs'), path = require('path');
const out = path.join(process.argv[2] || '/tmp/artifact', '3d'); fs.mkdirSync(out, { recursive: true });
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'icons') walk(p); } else if (/\.(glb|json)$/.test(f)) files.push(p); } })('3d');
const packs = []; let cur = [], size = 0;
const flush = () => { if (!cur.length) return; const name = `pack-${packs.length + 1}.js`; fs.writeFileSync(path.join(out, name), 'window.OC3DPACK=window.OC3DPACK||{};' + cur.join('')); packs.push(name); cur = []; size = 0; };
for (const p of files) { const k = path.relative('3d', p).split(path.sep).join('/'), b = fs.readFileSync(p).toString('base64'); cur.push(`OC3DPACK[${JSON.stringify(k)}]="${b}";`); size += b.length; if (size > 4e6) flush(); }
flush();
fs.writeFileSync(path.join(out, 'pack-index.js'), `window.OC3DPACKS=${JSON.stringify(packs)};`);
fs.copyFileSync('3d/map3d.js', path.join(out, 'map3d.js')); fs.copyFileSync('index.html', path.join(path.dirname(out), 'index.html'));
console.log('packed', files.length, 'files into', packs.length, 'scripts in', out);
