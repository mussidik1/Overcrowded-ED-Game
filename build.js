// Builds index.html: one self-contained page with the engine, UI, styles, and fonts inlined.
const fs = require('fs'), path = require('path');
const src = p => fs.readFileSync(path.join(__dirname, 'src', p), 'utf8');
const font = (fam, file, weight) => {
  const b64 = fs.readFileSync(path.join(__dirname, 'node_modules/@fontsource', file)).toString('base64');
  return `@font-face{font-family:"${fam}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
};
const fonts = [
  font('Permanent Marker', 'permanent-marker/files/permanent-marker-latin-400-normal.woff2', 400),
  ...[500, 600, 700].map(w => font('Barlow Condensed', `barlow-condensed/files/barlow-condensed-latin-${w}-normal.woff2`, w)),
  ...[400, 500, 600].map(w => font('Barlow', `barlow/files/barlow-latin-${w}-normal.woff2`, w)),
].join('\n');
const html = src('index.template.html')
  .replace('/*FONTS*/', () => fonts).replace('/*STYLE*/', () => src('style.css'))
  .replace('/*ENGINE*/', () => src('engine.js')).replace('/*UI*/', () => src('ui.js'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('built index.html', (html.length / 1024).toFixed(1), 'KB');
