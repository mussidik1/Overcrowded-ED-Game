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
const html = src('index.template.html')
  .replace('/*FONTS*/', () => fonts).replace('/*STYLE*/', () => src('style.css'))
  .replace('/*ENGINE*/', () => src('engine.js')).replace('/*UI*/', () => src('ui.js'));
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('built index.html', (html.length / 1024).toFixed(1), 'KB');
