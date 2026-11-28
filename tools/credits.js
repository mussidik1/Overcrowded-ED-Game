// node tools/credits.js: writes img/CREDITS.md from img/credits.json (one source of truth for the imaging credits; audit R2-18).
const fs = require('fs'), path = require('path');
const LIC = require('./licences.js');
const root = path.join(__dirname, '..'), C = JSON.parse(fs.readFileSync(path.join(root, 'img/credits.json'), 'utf8'));
const rows = Object.entries(C).map(([k, c]) => {
  const lic = LIC[c.license] ? `[${c.license}](${LIC[c.license]})` : c.license;
  const src = (c.source || 'Wikimedia Commons').replace(/\|/g, '/');
  return `| \`img/${k}.jpg\` | ${String(c.file || '').replace(/\|/g, '/')} | ${c.author} | ${lic} | [${src}](${c.url}) |`;
});
const n = rows.length;
fs.writeFileSync(path.join(root, 'img/CREDITS.md'), `# Imaging credits

The ${n} X-rays, CTs, MRIs and ultrasounds in the imaging viewer come from Wikimedia Commons, and one (\`cta_m1\`) from PubMed Central via
Open-i. This file is written from \`img/credits.json\` by \`node tools/credits.js\`.

**Changes made for the game:** every picture is resized and saved as JPEG; \`cthead_normal\` and \`cta_m1\` are also cropped. Where the licence
is CC BY-SA, the changed picture is released under that same licence. CC0 and public domain need no credit but get one here; CC BY and
CC BY-SA require it, with a link to the licence.

| Picture | Shows | Author | Licence | Source |
|---|---|---|---|---|
${rows.join('\n')}
`);
console.log(`img/CREDITS.md: ${n} pictures`);
