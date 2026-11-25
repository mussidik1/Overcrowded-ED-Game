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

// R1.9-01: an order set with a drug that can hurt isn't "clean" (no +10, not counted under clean order sets), even if nothing else is off
const textbook = p => {   // as rules10.js: the needed tests and one right drug for each treatment
  const tests = OC.needOf(p).n.slice(); if (p.right && p.right.wk.includes('ecg')) tests.push('ecg');
  const treats = [];
  for (const t of p.right.tr) { const g = OC.reqLeft(p, t); if (g) treats.push(...g.map(x => x[0])); else { const d = OC.drugFor(p, t); treats.push(d && OC.DRUGS[d] && OC.DRUGS[d].tx.includes(t) ? d : t); } }
  return { tests, treats };
};
p = mine('cwp', 1351); let K = textbook(p), c0 = md().clean || 0; OC.signOrders(p.id, K.tests, K.treats);
const cleanOk = (md().clean || 0) - c0;
p = mine('cwp', 1351); K = textbook(p); c0 = md().clean || 0; OC.signOrders(p.id, K.tests, K.treats.concat(['ibu']));
assert(cleanOk === 1 && (md().clean || 0) === c0 && (md().contra || 0) === 1,
  `the textbook set is clean, the same set plus a contraindicated drug isn't (clean +${cleanOk}, then +${(md().clean || 0) - c0}, contra ${md().contra})`);

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
let died2 = null;   // seeds until that patient dies (some get pulses back), so the check is on a real death (audit R1.9-05)
for (let sd = 7600; sd < 7660 && !died2; sd++) {
  p = mine('cwp', sd, 60); p.mine = false; OC.assign('md2', p.id); OC.toArrest(p, 'Arrested in the room');
  for (let i = 0; i < 600 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
  if (p.dsp === 'expired' || p.dsp === 'morgue' || p.tDied != null) { endNow(); died2 = { sd, own: OC.G.report.md.died, dept: OC.G.report.expired }; }
}
assert(died2 && died2.own === 0 && died2.dept >= 1, `another doctor's patient (md2) who dies counts for the department, not the attending (${JSON.stringify(died2)})`);

// R5.8-03: an own patient still in an unrun arrest at the end of the shift: an M&M line, the penalty, and a count sent on
p = mine('cwp', 7700, 60); OC.G.t = OC.G.shift - 15; OC.toArrest(p, 'Arrested in the room'); OC.G.card = null;   // 15 minutes before the end: time to run it
let lit0 = OC.G.lit || 0; for (let i = 0; i < 300 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.report.md.arrestOpen === 1 && OC.G.report.md.arrestLeft === 1 && OC.G.report.mm.some(x => /nobody was running the code/.test(JSON.stringify(x))) && (OC.G.lit || 0) > lit0,
  `an own arrest left unrun 15 min at the end is counted, named in the M&M and costs legal risk (arrestLeft ${OC.G.report.md.arrestLeft}, legal ${lit0} -> ${OC.G.lit})`);
p = mine('cwp', 7710, 60); OC.G.t = OC.G.shift - 0.5; OC.toArrest(p, 'Arrested in the room'); OC.G.card = null;   // seconds before the end: no time to run it (R6.9-02)
lit0 = OC.G.lit || 0; for (let i = 0; i < 20 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.report.md.arrestOpen === 1 && OC.G.report.md.arrestLeft === 0 && (OC.G.lit || 0) === lit0 && !OC.G.report.mm.some(x => /nobody was running the code/.test(JSON.stringify(x))),
  `an arrest seconds before the end is counted but not penalised (arrestLeft ${OC.G.report.md.arrestLeft}, legal ${lit0} -> ${OC.G.lit})`);
// R5.9-03: legal risk added at the end of a shift that ran its course: no firing, no card after it, and the stage is the one reached
p = mine('cwp', 7720, 60); OC.G.lit = 62; OC.G.litStage = 3; OC.G.t = OC.G.shift - 15; OC.toArrest(p, 'Arrested in the room'); OC.G.card = null;
for (let i = 0; i < 300 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.over && !OC.G.fail && OC.G.report.lit >= 75 && OC.G.report.litStage === 3 && !OC.G.card && !OC.G.fireNow,
  `end-of-shift legal risk past 75% doesn't fire or queue a card on a shift that ran to the end (lit ${OC.G.report.lit}, stage ${OC.G.report.litStage}, card ${OC.G.card && OC.G.card.title})`);
p = mine('cwp', 7730, 60); OC.G.lit = 30; OC.G.litStage = 1; OC.G.t = OC.G.shift - 15; OC.toArrest(p, 'Arrested in the room'); OC.G.card = null;
for (let i = 0; i < 300 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.over && OC.G.report.lit >= 40 && OC.G.report.litStage === 1 && !OC.G.card,
  `and crossing a stage at the end brings no peer-review card after the shift (lit ${OC.G.report.lit}, stage ${OC.G.report.litStage}, card ${OC.G.card && OC.G.card.title})`);
// a fired shift gets no legal-risk reason after the firing (R6.9-02)
p = mine('cwp', 7720, 60); OC.G.lit = 62; OC.toArrest(p, 'Arrested in the room');
const p2 = OC.pt(OC.trainPatient('cwp', 'room', { room: roomFree() })); p2.prov = OC.G.me; p2.mine = true; p2.ev = 'done';
for (let i = 0; i < 400 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.report.fail === 'fired' && (OC.G.stats.litLog || []).every(x => x.t <= OC.G.report.endMin + 1), `a fired shift adds no reason after the firing (${(OC.G.stats.litLog || []).length} reasons, end ${OC.G.report.endMin})`);
// R6.9-03: a code the attending ran and lost is told apart from an abandoned one
let lost = null;
for (let sd = 7800; sd < 7860 && !lost; sd++) {
  p = mine('cwp', sd, 60); OC.toArrest(p, 'Arrested in the room'); OC.assign(OC.G.me, p.id);
  for (let i = 0; i < 400 && p.arrest; i++) { if (OC.G.card && OC.G.card.eid === 'code') { const c = OC.G.card, q = OC.codeSteps(p)[c.ctx.step], ri = q.c.findIndex(x => x[2]); OC.chooseCard(String(ri)); } else if (OC.G.card) OC.G.card = null; OC.step(0.1); }
  if (p.codeLost) { endNow(); lost = OC.G.report; }
}
assert(lost && lost.md.died === 1 && lost.md.codeLost === 1 && !lost.mm.some(x => /died after a/.test(JSON.stringify(x))), `a code run by the book and lost counts as an own death after a code they ran, with no M&M blame (died ${lost && lost.md.died}, codeLost ${lost && lost.md.codeLost})`);

// the UI's "complications" (harm - contra) are exactly the unneeded treatments that went wrong
let comp = 0, each = true;   // per shift 0 or 1 (one unneeded treatment), and over 20 shifts some but not all (audit R1.9-05)
for (let s2 = 0; s2 < 20; s2++) { p = mine('cwp', 8000 + s2); OC.signOrders(p.id, ['ecg', 'trop'], ['ibu', 'insulin']); run(90); const c = (md().harm || 0) - (md().contra || 0); comp += c; if (c !== 0 && c !== 1) each = false; }
assert(each && comp > 0 && comp < 20, `harm minus contraindicated drugs counts only complications of the one unneeded treatment: 0 or 1 a shift, ${comp} in 20 shifts`);

// an early end says when
OC.newGame('easy', 1400, { mode: 'md' }); OC.G.train = null; OC.G.card = null; OC.G.t = 301; OC.G.fireNow = true; OC.step(0.1);
assert(OC.G.report && OC.G.report.fail === 'fired' && OC.G.report.endMin === 301, `a shift that ends early (fired) records its minute (${OC.G.report && OC.G.report.endMin})`);

// R6.9-07: an unsafe drug ordered after a pulse comes back (no first order set on record) still reaches Orders to review
let back = null;
for (let sd = 7900; sd < 7960 && !back; sd++) {
  p = mine('cwp', sd, 60); OC.toArrest(p, 'Arrested in the room'); OC.assign(OC.G.me, p.id);
  for (let i = 0; i < 400 && p.arrest; i++) { if (OC.G.card && OC.G.card.eid === 'code') { const c = OC.G.card, q = OC.codeSteps(p)[c.ctx.step], ri = q.c.findIndex(x => x[2]); OC.chooseCard(String(ri)); } else if (OC.G.card) OC.G.card = null; OC.step(0.1); }
  if (p.rosc) back = p;
}
if (back) { back.ordLog = null; OC.G.card = null; OC.signOrders(back.id, [], ['ibu']); }
const logged = back && (md().log || []).map(id => OC.pt(id)).filter(Boolean).some(x => x.id === back.id && (x.ordLog.unsafe || []).some(u => /ibu/i.test(JSON.stringify(u))));
assert(back && (md().contra || 0) >= 1 && logged, `ibuprofen ordered after a pulse came back is counted and listed in Orders to review (contra ${md().contra}, listed ${logged})`);

// R1.10-02: a patient who arrived in cardiac arrest and was left unrun counts from the door, like any other unrun arrest
p = mine('arrest', 8100, 60); OC.G.t = OC.G.shift - 15; p.tArrive = OC.G.t; p.arrest = true; p.tArrest = undefined; p.code = null; OC.G.card = null;
let litA = OC.G.lit || 0; for (let i = 0; i < 300 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.report.md.arrestLeft === 1 && (OC.G.lit || 0) > litA, `an arrival in arrest left unrun 15 min at the end is penalised like any other (arrestLeft ${OC.G.report.md.arrestLeft}, legal ${litA} -> ${OC.G.lit})`);

// R6.10-01: a code run with wrong calls and lost is a death like any other: no "by the book", an M&M line and legal risk
let bad = null;
for (let sd = 8200; sd < 8260 && !bad; sd++) {
  p = mine('cwp', sd, 60); OC.toArrest(p, 'Arrested in the room'); OC.assign(OC.G.me, p.id); const l0 = OC.G.lit || 0;
  for (let i = 0; i < 400 && p.arrest; i++) { if (OC.G.card && OC.G.card.eid === 'code') { const c = OC.G.card, q = OC.codeSteps(p)[c.ctx.step], wi = q.c.findIndex(x => !x[2]); OC.chooseCard(String(wi)); } else if (OC.G.card) OC.G.card = null; OC.step(0.1); }
  if (p.dsp === 'family' && !p.rosc) { const l1 = OC.G.lit || 0; endNow(); bad = { r: OC.G.report, dl: l1 - l0, cl: p.codeLost }; }
}
assert(bad && bad.r.md.died === 1 && bad.r.md.codeLost === 0 && !bad.cl && bad.dl >= 10 && bad.r.mm.some(x => /died after a/.test(JSON.stringify(x))),
  `a code with every call wrong and lost isn't "by the book": an M&M line and legal risk (codeLost ${bad && bad.r.md.codeLost}, legal +${bad && bad.dl})`);

// R6.10-02: an own patient's code run at once by another doctor and lost is labelled by the book, not as an unexplained death
let ai = null;
for (let sd = 8300; sd < 8360 && !ai; sd++) {
  p = mine('cwp', sd, 60); OC.toArrest(p, 'Arrested in the room'); OC.assign('md2', p.id);
  for (let i = 0; i < 400 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
  if (p.dsp === 'family' && !p.rosc) { endNow(); ai = { r: OC.G.report, cl: p.codeLost, h: p.codeHanded }; }
}
assert(ai && !ai.cl && ai.h && ai.r.md.codeLost === 0 && ai.r.md.handed === ai.r.md.died && !ai.r.mm.some(x => /died after a/.test(JSON.stringify(x))),
  `another doctor's prompt code on an own patient, lost: no blame, and not labelled "by the book", which the student didn't run (audit R6.11-03; handed ${ai && ai.r.md.handed})`);

// R6.11-01: an own arrest left unrun, then handed to another doctor late, and lost: the delay still counts
let lateH = null;
for (let sd = 8400; sd < 8460 && !lateH; sd++) {
  p = mine('cwp', sd, 60); OC.toArrest(p, 'Arrested in the room'); const l0 = OC.G.lit || 0;
  for (let i = 0; i < 100; i++) { OC.G.card = null; OC.step(0.1); }   // 10 minutes with nobody running it
  OC.assign('md2', p.id);
  for (let i = 0; i < 400 && p.arrest; i++) { OC.G.card = null; OC.step(0.1); }
  if (p.dsp === 'family' && !p.rosc && p.code && !p.code.me) { const l1 = OC.G.lit || 0; endNow(); lateH = { r: OC.G.report, dl: l1 - l0, h: p.codeHanded, w: p.code.wait }; }
}
assert(lateH && !lateH.h && lateH.dl >= 10 && lateH.r.mm.some(x => /died after a/.test(JSON.stringify(x))),
  `an own arrest handed to another doctor ${lateH && lateH.w} min late and lost: M&M line and legal risk (legal +${lateH && lateH.dl})`);

// R6.11-02: an own arrest left 10 minutes, then started in the last minute of the shift, doesn't escape the end-of-shift rule
p = mine('cwp', 8500, 60); OC.G.t = OC.G.shift - 11; OC.toArrest(p, 'Arrested in the room'); OC.G.card = null;
for (let i = 0; i < 100; i++) { OC.G.card = null; OC.step(0.1); }
OC.assign('md2', p.id); let litE = OC.G.lit || 0;
for (let i = 0; i < 200 && !OC.G.over; i++) { OC.G.card = null; OC.step(0.1); }
assert(OC.G.over && (!p.arrest || OC.G.report.md.codeLate === 1) && (!p.arrest || (OC.G.lit || 0) > litE),
  `a code started 10 min late in the last minute of the shift is counted at the end (codeLate ${OC.G.report.md.codeLate}, legal ${litE} -> ${OC.G.lit}, still in arrest ${p.arrest})`);
