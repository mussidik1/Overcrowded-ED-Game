// Confirms each new system shows up during simulated shifts.
const OC = require('../src/engine.js');
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const tot = {};
const add = (k, v) => { tot[k] = (tot[k] || 0) + v; };
for (let seed = 1; seed <= 8; seed++) {
  OC.newGame(seed % 2 ? 'med' : 'hard', seed * 7777, { pack: seed % 2 ? 'miemss' : 'national' });
  let since = 0, n = 0, verifyWaits = 0, rtTasks = 0, pitOn = 0, xm = 0;
  while (!OC.G.over && n++ < 16000) {
    OC.step(0.1); since += 0.1;
    if (OC.G.card) { add('card:' + OC.G.card.eid, 1); OC.botStep({ budget: 0 }); }
    if (since >= 1) { since = 0; OC.botStep({ budget: 2, acc: 0.75, pit: true, interp: 0.6, breaks: true }); }
    if (n % 50 === 0) {
      for (const p of OC.active()) for (const k in p.treat) if (p.treat[k].st === 'verify') verifyWaits++;
      for (const s of OC.G.staff) { if (s.role === 'rt' && s.task) rtTasks++; if (s.pit) pitOn++; }
      for (const p of OC.active()) if (p.bb && p.bb.st === 'xm') xm++;
    }
  }
  const R = OC.G.report;
  for (const k of ['ama', 'returns', 'lep', 'interp', 'mtp', 'mtpWaste', 'oneg', 'shock', 'overrides', 'medErrors', 'pitSeen', 'pitDc', 'rosc', 'expired', 'goalsMet', 'goalsMiss']) add(k, R[k] || 0);
  add('boxRight', R.boxC.right); add('boxAns', R.boxC.ans);
  add('verifySamples', verifyWaits); add('rtBusySamples', rtTasks); add('pitOnSamples', pitOn); add('crossmatchSamples', xm);
}
console.log(Object.fromEntries(Object.entries(tot).sort()));
