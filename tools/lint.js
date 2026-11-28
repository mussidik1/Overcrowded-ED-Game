// npm run lint: ESLint over the source, with src/map.js spliced into src/ui.js at /*MAP*/ (as build.js does). Exit 1 on any problem.
const fs = require('fs'), path = require('path');
const { ESLint } = require('eslint');
(async () => {
  const root = path.join(__dirname, '..'), es = new ESLint({ cwd: root });
  const files = ['src/engine.js', 'src3d', 'build.js', 'build3d.js', 'eslint.config.js', 'tools', 'test'];
  const res = await es.lintFiles(files);
  const ui = fs.readFileSync(path.join(root, 'src/ui.js'), 'utf8'), map = fs.readFileSync(path.join(root, 'src/map.js'), 'utf8');
  const at = ui.indexOf('/*MAP*/'), line0 = ui.slice(0, at).split('\n').length, mapN = map.split('\n').length;
  const [joined] = await es.lintText(ui.replace('/*MAP*/', () => map), { filePath: path.join(root, 'src/ui.js') });
  for (const m of joined.messages) {   // a line inside the spliced map belongs to map.js; a line after it moves back up
    if (m.line >= line0 && m.line < line0 + mapN) { m.file = 'src/map.js'; m.line = m.line - line0 + 1; }
    else { m.file = 'src/ui.js'; if (m.line >= line0 + mapN) m.line -= mapN - 1; }
  }
  let n = 0;
  for (const r of res) for (const m of r.messages) { n++; console.log(`${path.relative(root, r.filePath)}:${m.line}:${m.column} ${m.ruleId || ''} ${m.message}`); }
  for (const m of joined.messages) { n++; console.log(`${m.file}:${m.line}:${m.column} ${m.ruleId || ''} ${m.message}`); }
  console.log(n ? `${n} lint problem(s)` : 'lint: clean');
  process.exitCode = n ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 2; });
