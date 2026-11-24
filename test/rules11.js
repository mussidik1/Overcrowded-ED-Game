// Audit phase 1: the Critical clinical fixes and the arrest dead ends. Each check fails on v0.29.1 and passes now.
// R6-01 lytic window · R6-05 metoclopramide in bowel obstruction · R6-06 unstable A-fib · R6-07 Bicillin IM only ·
// R6-08 ACS drugs · R6-03 epinephrine in arrest · R6-04 ACLS decisions · R5-01 your own patient's code · R5-02 no code team
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const roomFree = () => (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id;
function mine(k, o, seed) {
  OC.newGame('easy', seed || 1000 + k.length, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const p = OC.pt(OC.trainPatient(k, 'room', Object.assign({ room: roomFree() }, o || {}))); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); return p;
}
const md = () => OC.G.stats.md;
const run = mins => { for (let i = 0; i < mins * 10 && !OC.G.over; i++) { if (OC.G.card && !OC.G.card.mine) OC.botStep({ budget: 0 }); OC.step(0.1); } };
function sign(p, tests, treats) {
  const h = md().harm || 0, x = md().ordExtra || 0, w = md().wrongDrug || 0;
  const r = OC.signOrders(p.id, tests, treats);
  return { ok: r.ok, harm: (md().harm || 0) - h, extra: (md().ordExtra || 0) - x, wrong: (md().wrongDrug || 0) - w };
}

// ---- R6-01: the thrombolytic window
let p = mine('stroke', { lkw: 60 });
assert(OC.lyticWindowOk(p) && !OC.contraOf(p).includes('tnk'), 'stroke 60 min after last known well: inside the window, tenecteplase allowed');
let r = sign(p, ['ct', 'lab'], ['labet', 'tnk']);
assert(r.ok && !r.harm && p.tr.includes('tnk'), 'and ordering it is the right call');
p = mine('stroke', { lkw: 300 });
assert(!OC.lyticWindowOk(p) && OC.contraOf(p).includes('tnk'), 'stroke 5 hours after last known well: tenecteplase is contraindicated');
r = sign(p, ['ct', 'lab'], ['tnk']);
assert(r.harm === 1, 'ordering it out of the window is scored as harm');
p = mine('stroke', { lkw: 250 });
assert(p.right.tr.includes('tnk'), 'stroke at 250 min: tenecteplase still required');
for (let i = 0; i < 300; i++) OC.step(0.1);
assert(!p.right.tr.includes('tnk') && !p.tr.includes('tnk') && p.lyticLate && OC.G.stats.lyticLate === 1, 'when 4.5 hours pass without it, it comes off the orders and the missed window is counted');
assert(!OC.missNow(p).some(x => /hromb/i.test(x)), 'and it is no longer listed as missing (it can no longer be given)');
// the nurse doesn't push it once the window has closed, even if it was ordered in time
p = mine('stroke', { lkw: 262, over: false });
sign(p, ['ct', 'lab'], ['tnk']);
for (let i = 0; i < 300; i++) OC.step(0.1);
assert(!(p.treat.tnk && p.treat.tnk.st === 'done') || p.treat.tnk.tDone - p.lkwT <= OC.LYTIC_WINDOW + 0.2, 'a thrombolytic ordered late is never given after the window closes');

// ---- R6-05: no metoclopramide in a bowel obstruction
p = mine('sbo');
assert(OC.contraOf(p).includes('reglan'), 'bowel obstruction: metoclopramide is contraindicated');
r = sign(p, ['ctap'], ['ns', 'reglan']);
assert(r.harm === 1 && !r.wrong, 'and ordering it is harm, not a right drug');
p = mine('sbo'); r = sign(p, ['ctap'], ['ns', 'ondan']);
assert(!r.harm && !r.wrong && !r.extra, 'ondansetron is the right antiemetic');
p = mine('gastro'); r = sign(p, [], ['reglan']);
assert(!r.harm && !r.wrong, 'metoclopramide is still fine for gastroenteritis');

// ---- R6-07: Bicillin is IM only
assert(OC.DRUGS.bicillin.c === 'abxm' && /IM only/.test(OC.DRUGS.bicillin.n), 'penicillin G benzathine sits under "by shot in the muscle (IM)" and its name says IM only');
assert(OC.DRUG_CLASS.some(([c, n]) => c === 'abxm' && /muscle/i.test(n)) && !OC.DRUG_CLASS.find(([c]) => c === 'abxi')[1].includes('muscle'), 'the IM class is its own menu');

// ---- R6-08: ACS drugs
p = mine('cwp'); r = sign(p, ['ecg', 'trop'], ['asa']);
assert(!r.harm && !r.wrong && !r.extra, 'undifferentiated chest pain: aspirin is right, not "wrong drug"');
p = mine('cwp'); r = sign(p, ['ecg', 'trop'], ['ketor']);
assert(r.harm === 1, 'ketorolac before the troponin is back is harm');
p = mine('cwp'); p.work.lab = { st: 'done' };
assert(!OC.contraOf(p).includes('ketor'), 'after a normal troponin, an NSAID for chest wall pain is fine');
for (const k of ['cpmod', 'nstemi', 'stemi']) {
  p = mine(k); r = sign(p, ['ecg', 'trop'], ['ntg']);
  assert(!r.harm && !r.wrong && !r.extra, `${k}: nitroglycerin is not a "wrong drug"`);
  p = mine(k); r = sign(p, ['ecg', 'trop'], ['morph', 'metop']);
  assert(!r.harm && !r.wrong && !r.extra, `${k}: morphine and metoprolol are neutral (pending clinician review)`);
}
p = mine('nstemi'); OC.crashNow(p.id); run(30);
assert(OC.vitalsOf(p).sbp < 90 && OC.contraOf(p).includes('ntg'), `NSTEMI in cardiogenic shock (SBP ${Math.round(OC.vitalsOf(p).sbp)}): nitroglycerin is harm`);

// ---- R6-06: unstable A-fib
p = mine('afib');
r = sign(p, ['ecg', 'trop'], ['dilt']);
assert(!r.harm && !r.wrong, 'stable A-fib with a fast rate: diltiazem is right');
p = mine('afib');
OC.crashNow(p.id); for (let i = 0; i < 50; i++) OC.step(0.1);
assert(p.crash && p.tr.includes('cardiovert') && !p.tr.includes('fluids'), 'A-fib that crashes needs synchronized cardioversion, not fluids');
assert(OC.contraOf(p).includes('dilt') && OC.contraOf(p).includes('metop'), 'and diltiazem or metoprolol is harm once the pressure has fallen');
assert(OC.PROC.synccv && OC.PROC.synccv.tx === 'cardiovert' && OC.ORDER_MENUS.find(m => m[0] === 'proc')[2].includes('synccv'), 'synchronized cardioversion is on the Procedures menu');
if (p.right) { r = sign(p, [], ['synccv']); assert(r.ok && !r.extra && p.tr.includes('cardiovert'), 'ordering it fills the order'); }

// ---- R6-03: epinephrine in arrest is never harm
{ let n = 0; for (let s = 0; s < 40; s++) { p = mine('nstemi', {}, 9000 + s); OC.toArrest(p, 'Arrested in the room'); p.extraTr = ['epi']; const h = md().harm || 0; OC.harmCheck(p, 'epi'); n += (md().harm || 0) - h; }
  assert(n === 0, 'a patient in arrest is never "harmed" by epinephrine (40 tries)'); }
assert((OC.ALSO.arrest || []).includes('epiarr') && (OC.ALSO.arrest || []).includes('amio'), 'epinephrine and amiodarone are standard care in arrest');

// ---- R5-01 + R6-04: your own patient arrests, you run the code, and the rhythm checks are cards
p = mine('nstemi', {}, 5001);
OC.toArrest(p, 'Arrested in the room');
assert(OC.mdMine(p) && p.arrest && p.ev === 'none' && OC.needsProv(p), 'your own patient in arrest stays yours and needs you');
r = OC.assign(OC.G.me, p.id);
assert(r.ok && OC.staff(OC.G.me).q.some(k => k.type === 'code' && k.pid === p.id), '"Run the code" queues the code on you');
let cards = 0, sawRight = 0;
for (let i = 0; i < 400 && p.arrest; i++) {
  if (OC.G.card && OC.G.card.eid === 'code') {
    cards++;
    const q = OC.codeSteps(p)[OC.G.card.ctx.step], right = String(q.c.findIndex(x => x[2]));
    assert(OC.G.card.choices.length === 4 && OC.G.card.choices.some(c => c.k === right), `rhythm check ${cards}: four choices, one right`);
    OC.chooseCard(right); sawRight++;
  }
  OC.step(0.1);
}
assert(cards === OC.codeSteps(p).length && cards >= 2, `the code asks ${cards} rhythm-check questions (${p.code && p.code.r})`);
assert(!p.arrest && (p.dx === 'ROSC after cardiac arrest' || p.dx === 'Resuscitation unsuccessful') && p.code.right === sawRight, 'and it resolves: a pulse back, or the code called');
// the rhythm decides the path
assert(OC.CODE_Q.vf[0].c.find(x => x[2])[0].startsWith('Shock'), 'VF: shock first');
assert(OC.CODE_Q.pea[0].c.find(x => x[2])[0].includes('epinephrine'), 'PEA: CPR and epinephrine first, no shock');
assert(OC.codeRhythm({ id: 1, ck: 'arrest' }) === 'vf' && OC.codeRhythm({ id: 1, ck: 'mvc', bleed: 'mtp' }) === 'trauma', 'the arrest case is VF; a bleed is a traumatic arrest');
// right answers raise the odds
function codeRate(rightAnswers) {
  let rosc = 0;
  for (let s = 0; s < 120; s++) {
    const q = mine('nstemi', {}, 7000 + s); OC.toArrest(q, 'Arrested in the room'); OC.assign(OC.G.me, q.id);
    for (let i = 0; i < 400 && q.arrest; i++) {
      if (OC.G.card && OC.G.card.eid === 'code') { const c = OC.codeSteps(q)[OC.G.card.ctx.step].c, ri = c.findIndex(x => x[2]); OC.chooseCard(String(rightAnswers ? ri : (ri + 1) % 4)); }
      OC.step(0.1);
    }
    if (q.dx === 'ROSC after cardiac arrest') rosc++;
  }
  return rosc;
}
{ const good = codeRate(true), bad = codeRate(false); assert(good > bad * 1.6, `the algorithm matters: ${good} of 120 get a pulse back with the right calls, ${bad} with the wrong ones`); }

// another provider's patient: they run it at once
OC.newGame('med', 4244, { mode: 'rn' }); OC.G.card = null;
for (let i = 0; i < 400 && !OC.inRooms().some(x => x.prov && !x.arrest && OC.staff(x.prov) && OC.present(OC.staff(x.prov))); i++) { OC.step(0.1); OC.botStep({ budget: 2 }); }
p = OC.inRooms().find(x => x.prov && !x.arrest);
if (p) {
  const sid = p.prov; OC.toArrest(p, 'Arrested in the room');
  assert(p.prov === sid && OC.staff(sid).q.some(k => k.type === 'code' && k.pid === p.id), 'a provider whose patient arrests runs the code: no dead end');
  for (let i = 0; i < 300 && p.arrest; i++) OC.step(0.1);
  assert(!p.arrest, 'and it resolves within 30 minutes');
}

// ---- R5-02: nobody runs the code
OC.newGame('med', 4245, { mode: 'rn' }); OC.G.card = null;
p = OC.pt(OC.trainPatient('arrest', 'room', { room: roomFree() })); p.prov = null; p.ev = 'none'; p.tArrest = OC.G.t;
run(22);
assert(!p.arrest && /no code team/.test(p.dx) && OC.G.stats.noTeam === 1, 'an arrest nobody runs for 20 minutes ends in death, and it is counted');
run(800);
assert(OC.G.report && OC.G.report.expired >= 1 && OC.G.report.noTeam >= 1, `the end-of-shift report counts the death (${OC.G.report.expired})`);
