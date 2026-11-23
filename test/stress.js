// Many seeds, slow player: look for wedged departments (very few discharges) or crashes.
const OC = require('../src/engine.js');
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
// v0.10: the five-minute shift, and every scenario, get the same treatment; vitals must always be numbers.
const RUNS = [['rn', 'easy'], ['rn', 'med'], ['rn', 'hard'], ['md', 'med'], ['md', 'hard'], ['rn', 'rush'], ['md', 'rush'],
  ['rn', 'med', 'ct'], ['rn', 'med', 'mci'], ['rn', 'med', 'board'], ['rn', 'med', 'short'], ['rn', 'rush', 'mci'], ['md', 'med', 'board']];
let badVitals = 0;
const vitalsOK = () => {
  for (const p of Object.values(OC.G.pts)) {
    if (p.loc === 'gone') continue;
    const v = OC.vitalsOf(p);
    if (v.arrest || !v.taken) continue;
    if (![v.hr, v.sbp, v.dbp, v.rr, v.spo2, v.temp].every(Number.isFinite) || v.hr < 20 || v.hr > 230 || v.sbp < 40 || v.sbp > 260 || v.dbp >= v.sbp || v.rr < 4 || v.rr > (p.age < 2 ? 72 : p.age < 13 ? 60 : 44) || v.spo2 < 50 || v.spo2 > 100 || v.temp < 90 || v.temp > 108) { if (badVitals++ < 5) console.log('BAD VITALS', p.ck, v.text); }
  }
};
for (const [mode, level, scen] of RUNS) {
  const res = [];
  for (let seed = 1; seed <= (scen ? 8 : 20); seed++) {
    OC.newGame(level, seed * 104729, { mode, scen });
    let since = 0, n = 0;
    while (!OC.G.over && n++ < 16000) {
      OC.step(0.1); since += 0.1;
      if (OC.G.card) OC.botStep({ budget: 0 });
      if (since >= 1.5) { since = 0; if (mode === 'md') OC.mdPlay({ budget: 1, acc: 0.6, line: 1 }); else OC.botStep({ budget: 2, acc: 0.6 }); }
      if (n % 400 === 0) vitalsOK();
    }
    const R = OC.G.report; res.push({ seed, dc: R.dc, done: R.dc + R.adm + R.proc + R.tx, care: R.care, sat: R.sat, left: R.left, fail: R.fail });
  }
  res.sort((a, b) => a.done - b.done);
  const avg = k => (res.reduce((a, r) => a + r[k], 0) / res.length).toFixed(0);
  console.log(mode, level + (scen ? '+' + scen : ''), 'avg done', avg('done'), 'avg care', avg('care'), '| worst 3:', res.slice(0, 3).map(r => `seed${r.seed}: done=${r.done} care=${r.care} left=${r.left}${r.fail ? ' ' + String(r.fail).toUpperCase() : ''}`).join(' ; '), '| walkouts', res.filter(r => r.fail).length);
}
if (badVitals) { console.log('FAIL: ' + badVitals + ' out-of-range vitals'); process.exitCode = 1; } else console.log('vitals stayed in range in every run');
