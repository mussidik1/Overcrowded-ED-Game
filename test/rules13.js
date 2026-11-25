// Audit round 7: the attending's own numbers sent to the instructor (v0.31.0). Each drives the real game path.
// R6.7-07 / R1.7-01: contraindicated drugs and unneeded risky treatments are counted per order, when ordered, whatever the dice do
// next; the attending's own dead count even if the body hasn't left by the end of the shift, and only once; an early end says when.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const roomFree = () => (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id;
function mine(k, seed, at) {
  OC.newGame('easy', seed || 1300 + k.length, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  if (at) { OC.G.t = at; OC.G.card = null; }   // a patient who arrives during the shift (one placed at 0 arrived before it)
  const p = OC.pt(OC.trainPatient(k, 'room', { room: roomFree() })); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); return p;
}
const md = () => OC.G.stats.md;
const run = mins => { for (let i = 0; i < mins * 10 && !OC.G.over; i++) { if (OC.G.card && OC.G.card.eid !== 'code') OC.botStep({ budget: 0 }); OC.step(0.1); } };

// one order with two contraindicated drugs: two unsafe orders, both counted as harm, none as a chance complication
let p = mine('cwp');
OC.signOrders(p.id, ['ecg', 'trop'], ['ibu', 'ketor']);
assert((md().contra || 0) === 2 && (md().harm || 0) === 2, `two contraindicated drugs in one order count as two (contra ${md().contra}, harm ${md().harm})`);
assert((md().unneeded || 0) === 0, 'and neither is an unneeded treatment');

// an unneeded risky treatment is counted when it is ordered, before any dice
p = mine('cwp');
OC.signOrders(p.id, ['ecg', 'trop'], ['insulin']);
assert((md().unneeded || 0) === 1 && (md().harm || 0) === 0, `an insulin drip nobody needs is one unsafe order the moment it is signed (unneeded ${md().unneeded}, harm ${md().harm})`);
let n = 0, harmed = 0;
for (let s = 0; s < 30; s++) {
  p = mine('cwp', 5000 + s); OC.signOrders(p.id, ['ecg', 'trop'], ['insulin']); run(90);
  n += (md().unneeded || 0) === 1 ? 1 : 0; harmed += (md().harm || 0) > 0 ? 1 : 0;
}
assert(n === 30 && harmed > 0 && harmed < 30, `the same unneeded order counts every time (${n} of 30), while the complication is chance (${harmed} of 30)`);

// the attending's own patient dies in the room: counted at the end of the shift even if the body is still there, and only once
p = mine('cwp', 7100, 60); OC.toArrest(p, 'Arrested in the room');   // the attending's own, and nobody runs the code
for (let i = 0; i < 400 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
assert(!p.arrest && ['family', 'morgue', 'morguing'].includes(p.dsp) && p.loc !== 'gone', `an own patient nobody ran the code on died, and the body is still in the department (${p.dsp})`);
const endNow = () => { OC.G.t = OC.G.shift; for (let i = 0; i < 20 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); } };
endNow();
const R1 = OC.G.report;
assert(R1 && R1.md.died === 1 && R1.expired >= 1, `the report counts that death as the attending's own (md.died ${R1 && R1.md.died}, expired ${R1 && R1.expired})`);
p = mine('cwp', 7200, 60); OC.toArrest(p, 'Arrested in the room');
for (let i = 0; i < 400 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
for (let i = 0; i < 900 && p.loc !== 'gone'; i++) { if (OC.G.card && OC.G.card.eid !== 'code') OC.botStep({ budget: 0 }); OC.step(0.1); }
endNow();
assert(p.loc === 'gone' && OC.G.report.md.died === 1, `a body that has left is counted once, not twice (md.died ${OC.G.report.md.died})`);

// another provider's patient who dies isn't the attending's own
let other = null;
for (let seed = 7300; seed < 7340 && !other; seed++) {   // a seed where the code is lost (another provider runs it)
  p = mine('cwp', seed, 60); p.mine = false; p.prov = null; OC.toArrest(p, 'Arrested in the room');
  for (let i = 0; i < 600 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
  if (['family', 'morgue', 'morguing'].includes(p.dsp) || p.loc === 'gone') { endNow(); other = OC.G.report; }
}
assert(other && other.expired >= 1 && other.md.died === 0, `another provider's patient's death counts for the department, not as the attending's own (md.died ${other && other.md.died}, dept. ${other && other.expired})`);

// R6.8-01: an own patient who arrived before 07:00 (placed at minute 0, arrived at -25) and died with the body still here counts,
// own and department; and one whose death fires the attending counts too
p = mine('cwp', 7400); assert(p.tArrive < 0, `the patient arrived before 07:00 (${p.tArrive})`);
OC.toArrest(p, 'Arrested in the room');
for (let i = 0; i < 400 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
endNow();
assert(OC.G.report.md.died === 1 && OC.G.report.expired >= 1, `an own patient from before 07:00 who died on this shift counts (md.died ${OC.G.report.md.died}, dept. ${OC.G.report.expired})`);
p = mine('cwp', 7500); OC.G.lit = 62; OC.toArrest(p, 'Arrested in the room');
for (let i = 0; i < 400 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.report && OC.G.report.fail === 'fired' && OC.G.report.md.died === 1, `the own death that fires the attending is counted (fail ${OC.G.report && OC.G.report.fail}, md.died ${OC.G.report && OC.G.report.md.died})`);

// a patient of another provider (a real one, not an unassigned patient) who dies isn't the attending's
p = mine('cwp', 7600, 60); p.mine = false; OC.assign('md2', p.id); OC.toArrest(p, 'Arrested in the room');
for (let i = 0; i < 600 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
endNow();
assert(OC.G.report.md.died === 0, `another doctor's patient (md2) who arrests isn't counted as the attending's (md.died ${OC.G.report.md.died}, outcome ${p.dsp || p.loc})`);

// R5.8-03: an own patient still in an unrun arrest at the end of the shift: an M&M line, the penalty, and a count sent on
p = mine('cwp', 7700, 60); OC.G.t = OC.G.shift - 3; OC.toArrest(p, 'Arrested in the room'); OC.G.card = null;   // 3 minutes before the end: under the 20-minute rule
const lit0 = OC.G.lit || 0; for (let i = 0; i < 100 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.report.md.arrestOpen === 1 && OC.G.report.mm.some(x => /nobody was running the code/.test(x.what || x.t || JSON.stringify(x))) && (OC.G.lit || 0) > lit0,
  `an own arrest left unrun at the end is counted, named in the M&M and costs legal risk (arrestOpen ${OC.G.report.md.arrestOpen}, legal ${lit0} -> ${OC.G.lit})`);

// the UI's "complications" (harm - contra) are exactly the unneeded treatments that went wrong
let comp = 0, h0 = 0;
for (let s2 = 0; s2 < 20; s2++) { p = mine('cwp', 8000 + s2); OC.signOrders(p.id, ['ecg', 'trop'], ['ibu', 'insulin']); run(90); comp += (md().harm || 0) - (md().contra || 0); h0 += OC.G.mm ? 0 : 0; }
assert(comp >= 0 && comp <= 20, `harm minus contraindicated drugs counts only complications of unneeded treatments (${comp} in 20 shifts)`);

// an early end says when
OC.newGame('easy', 1400, { mode: 'md' }); OC.G.train = null; OC.G.card = null; OC.G.t = 301; OC.G.fireNow = true; OC.step(0.1);
assert(OC.G.report && OC.G.report.fail === 'fired' && OC.G.report.endMin === 301, `a shift that ends early (fired) records its minute (${OC.G.report && OC.G.report.endMin})`);
