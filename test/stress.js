// Many seeds, slow player: look for wedged departments (very few discharges) or crashes.
const OC = require('../src/engine.js');
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
for (const level of ['easy', 'med', 'hard']) {
  const res = [];
  for (let seed = 1; seed <= 20; seed++) {
    OC.newGame(level, seed * 104729);
    let since = 0, n = 0;
    while (!OC.G.over && n++ < 16000) {
      OC.step(0.1); since += 0.1;
      if (OC.G.card) OC.botStep({ budget: 0 });
      if (since >= 1.5) { since = 0; OC.botStep({ budget: 2, acc: 0.6 }); }
    }
    const R = OC.G.report; res.push({ seed, dc: R.dc, done: R.dc + R.adm + R.proc + R.tx, care: R.care, sat: R.sat, left: R.left, fail: R.fail });
  }
  res.sort((a, b) => a.done - b.done);
  const avg = k => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(0);
  console.log(level, 'avg done', avg('done'), 'avg care', avg('care'), '| worst 3:', res.slice(0, 3).map(r => `seed${r.seed}: done=${r.done} care=${r.care} left=${r.left}${r.fail ? ' WALKOUT' : ''}`).join(' ; '), '| walkouts', res.filter(r => r.fail).length);
}
