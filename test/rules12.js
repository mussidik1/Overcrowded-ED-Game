// Audit round 2: fixes to the Phase 1 work, from the six reviewers' second pass. Every check drives the real game path (a real case,
// a real crash or bleed, the real code cards), not a hand-built object (R6.2-14).
// Clinical: R6.2-01 medical bleeds aren't trauma · R6.2-02 no beta-blocker or opioid in shock · R6.2-03 children get PALS doses ·
// R6.2-04 feedback never names a harmful drug · R6.2-05 the cause and rhythm follow the case · R6.2-06 ACS scoring · R6.2-08 harm
// says why · R6.2-09 traumatic arrest all at once · R6.2-10 VF needs a shock · R6.2-13 A-fib onset · R6.2-17 aspirin after a lytic.
// Tech: R3.2-01 a code whose doctor leaves · R3.2-02 old saves · R3.2-04 rhythm checks two minutes apart · R3.2-08 blame.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
let toasts = []; OC.hooks.toast = (m, k) => toasts.push(m); OC.hooks.sound = () => {};
const roomFree = () => (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id;
const untilArrest = (p, mins) => { for (let i = 0; i < mins * 10 && !p.arrest; i++) { if (OC.G.card && !OC.G.card.mine) OC.botStep({ budget: 0 }); OC.step(0.1); } };
const run = mins => { for (let i = 0; i < mins * 10 && !OC.G.over; i++) { if (OC.G.card && !OC.G.card.mine) OC.botStep({ budget: 0 }); OC.step(0.1); } };
function mine(k, o, seed) {
  OC.newGame('easy', seed || 1000 + k.length, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const p = OC.pt(OC.trainPatient(k, 'room', Object.assign({ room: roomFree() }, o || {}))); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); return p;
}
const md = () => OC.G.stats.md;
function sign(p, tests, treats) {
  const h = md().harm || 0, x = md().ordExtra || 0, w = md().wrongDrug || 0;
  const r = OC.signOrders(p.id, tests, treats);
  return { ok: r.ok, harm: (md().harm || 0) - h, extra: (md().ordExtra || 0) - x, wrong: (md().wrongDrug || 0) - w };
}
// run my own code to the end, answering every card right (or wrong), and return the cards seen
function runCode(p, right) {
  const seen = []; OC.assign(OC.G.me, p.id);
  for (let i = 0; i < 400 && p.arrest; i++) {
    if (OC.G.card && OC.G.card.eid === 'code') {
      const c = OC.G.card, q = OC.codeSteps(p)[c.ctx.step], ri = q.c.findIndex(x => x[2]);
      seen.push({ t: OC.G.t, who: c.who, title: c.title, text: c.text, right: q.c[ri][0] });
      OC.chooseCard(String(right ? ri : (ri + 1) % q.c.length));
    } else if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(x => !x.dis).k);
    OC.step(0.1);
  }
  return seen;
}

// ---- R6.2-01: a ruptured aneurysm or ectopic that arrests from bleeding is a medical bleed, not trauma
for (const k of ['aaa', 'ectopic']) {
  const p = mine(k, {}, 6100 + k.length); p.bb = null; p.bleed = 'mtp';
  untilArrest(p, 40);
  assert(p.arrest && !p.traumatic && OC.codeRhythm(p) === 'pea' && OC.codeCause(p) === 'bleed', `${k}: no massive transfusion, they arrest: hemorrhagic PEA, not a traumatic arrest`);
  const cards = runCode(p, true);
  assert(cards.length >= 3 && !cards.some(c => /decompress/i.test(c.right)) && cards.some(c => /transfusion/i.test(c.right)), `${k}: the right calls are blood and the surgeon, never chest decompression`);
}
{ const p = mine('mvc', {}, 6200); p.bb = null; p.bleed = 'mtp'; untilArrest(p, 40);
  assert(p.arrest && OC.codeRhythm(p) === 'trauma', 'a crash victim who bleeds out is a traumatic arrest');
  const cards = runCode(p, true);
  assert(/all at once/i.test(cards[0].right) && /decompress/i.test(cards[0].right) && /blood/i.test(cards[1].right) && !/drain/i.test(cards[1].right), 'a crash victim who bled out: everything at once (R6.2-09), then more blood, not a scripted tamponade (R6.3-07)'); }
{ const p = mine('mvc', {}, 6201); OC.toArrest(p, 'Traumatic arrest'); const cards = runCode(p, true);
  assert(OC.codeRhythm(p) === 'trauma' && /drain/i.test(cards[1].right), 'a crash victim who arrests without bleeding out: the tamponade card'); }
{ const p = mine('moto', {}, 6202); OC.toArrest(p, 'x'); assert(OC.codeRhythm(p) === 'limb', 'a motorcycle open femur is a limb bleed: no chest decompression (R6.3-07)'); }

// ---- R6.2-02: no beta-blocker or opioid in cardiogenic shock
{ const p = mine('nstemi', {}, 6300); OC.crashNow(p.id); run(30);
  const v = OC.vitalsOf(p);
  assert(v.sbp < 90 && ['metop', 'morph', 'fent', 'ntg'].every(d => OC.contraOf(p).includes(d)), `NSTEMI in cardiogenic shock (${Math.round(v.sbp)}/${Math.round(v.dbp)}): metoprolol, opioids and nitroglycerin are all harm`);
  const r = sign(p, [], ['metop']); assert(r.harm === 1, 'and ordering metoprolol there is scored as harm'); }
{ const p = mine('stemi', {}, 6301); const r = sign(p, ['ecg', 'trop'], ['asa', 'heparin', 'fent']);
  assert(!r.harm && !r.wrong && !r.extra, 'a stable STEMI: fentanyl is neutral, like morphine (R6.2-06)'); }

// ---- R6.2-06: NSAIDs are harm in any ACS; aspirin is what fills chest pain; nitroglycerin is fine in chest pain
for (const k of ['stemi', 'nstemi', 'cpmod']) { const p = mine(k, {}, 6400 + k.length); const r = sign(p, ['ecg', 'trop'], ['ketor']); assert(r.harm === 1, `${k}: ketorolac is harm, not just a wrong drug`); }
{ const p = mine('cwp', {}, 6410); sign(p, ['ecg', 'trop'], ['apap']);
  assert(OC.missNow(p).some(x => /aspirin/i.test(x)), 'low-risk chest pain: acetaminophen alone doesn\'t replace aspirin'); }
{ const p = mine('cwp', {}, 6411); const r = sign(p, ['ecg', 'trop'], ['asa', 'ntg']); assert(!r.harm && !r.wrong && !r.extra, 'chest pain: aspirin and nitroglycerin are right'); }

// ---- R6.2-04: feedback never names the drug that was just harm
{ const p = mine('cwp', {}, 6420); sign(p, ['ecg', 'trop'], ['ketor']);
  const miss = OC.missNow(p).join(' ');
  assert(!/ketorolac/i.test(miss) && /aspirin/i.test(miss), `after ketorolac was harm, the hint asks for aspirin, not ketorolac (${miss})`); }
{ const p = mine('afib', {}, 6430); OC.crashNow(p.id); run(10);
  sign(p, [], ['synccv']);
  assert(p.ordLog && /cardioversion/i.test(p.ordLog.why) && !/Diltiazem slows/.test(p.ordLog.why), 'unstable A-fib: the order summary says cardioversion, not diltiazem'); }

// ---- R6.2-08: harm says why, and never gives away the diagnosis
{ const p = mine('sbo', {}, 6440); toasts = []; sign(p, [], ['reglan']);
  const t = toasts.find(x => /can hurt/.test(x)) || '';
  assert(/blockage/.test(t) && !/obstruction/i.test(t), `metoclopramide harm says why without naming the diagnosis: "${t}"`); }
{ const p = mine('stroke', { lkw: 300 }, 6441); toasts = []; sign(p, ['ct', 'lab'], ['tnk']);
  assert(toasts.some(x => /4\.5 hours/.test(x)), 'a late lytic says it is past 4.5 hours'); }

// ---- R6.2-03: children get PALS, by weight
{ const p = mine('rsv', { age: 0 }, 6500); OC.toArrest(p, 'Arrested in the room');
  const cards = runCode(p, true), kg = OC.kgOf(p);
  assert(kg >= 4 && kg <= 11 && new RegExp(`${kg} kg`).test(cards[0].who) && /\d+ mo/.test(cards[0].who), `an infant (${OC.ageSex(p)}) is dosed for about ${kg} kg, the same months the card shows`);
  assert(cards.length >= 2 && /kg/.test(cards[0].who) && /child/.test(cards[0].title), 'the card shows the child\'s age and weight');
  assert(!cards.some(c => /(^|[^.\d])1 mg|300 mg/.test(c.right)) && cards.some(c => /\b0\.\d+ mg/.test(c.right)), `the right doses are per kilogram, never the adult 1 mg (${cards.map(c => c.right).join(' | ')})`); }
{ let vf = 0; for (let i = 1; i <= 200; i++) if (OC.codeRhythm({ id: 'kid' + i, ck: 'rsv', age: 2 }) === 'vf') vf++;
  assert(vf < 30, `children are mostly not shockable (${vf} of 200 VF)`); }
{ const q = { id: 'k7', ck: 'asthma', age: 8 }; q.code = { r: 'vf' }; const steps = OC.codeSteps(q);
  assert(/2 J\/kg/.test(steps[0].c.find(c => c[2])[0]) && /5 mg\/kg/.test(steps[2].c.find(c => c[2])[0]), 'VF in a child: 2 J/kg, then amiodarone 5 mg/kg'); }

// ---- R6.2-05: the cause card and the rhythm follow the case
const causeRight = (k, o) => { const p = mine(k, o || {}, 6600 + k.length); OC.toArrest(p, 'Arrested in the room'); return { p, cards: runCode(p, true) }; };
{ const { p, cards } = causeRight('pe'); assert(OC.codeCause(p) === 'clot' && (OC.codeRhythm(p) !== 'vf') && (cards.length < 3 || /tenecteplase/i.test(cards[2].right)), 'PE arrest: the cause is the clot, and the call is a clot buster'); }
{ const { p, cards } = causeRight('ptx'); assert(OC.codeCause(p) === 'tension' && (cards.length < 3 || /decompress/i.test(cards[2].right)), 'pneumothorax arrest: decompress'); }
{ const { p } = causeRight('hypogly'); assert(OC.codeCause(p) === 'gluc', 'low sugar arrest: dextrose'); }
{ const { p } = causeRight('od'); assert(OC.codeCause(p) === 'opioid', 'overdose arrest: breathing and naloxone'); }
{ let vf = 0; for (const k of ['asthma', 'copd', 'od', 'ptx', 'pe']) for (let i = 1; i <= 60; i++) if (OC.codeRhythm({ id: k + i, ck: k, age: 50 }) === 'vf') vf++;
  assert(vf === 0, 'breathing, clot and tension arrests are never VF'); }
{ let hgb = 0; for (let i = 1; i <= 100; i++) { const q = { id: 'nb' + i, ck: 'cell', age: 50 }; q.code = { r: 'pea' }; if (OC.codeSteps(q).some(s => /Hemoglobin/.test(s.t))) hgb++; }
  assert(hgb === 0, 'nobody without a bleed is told their hemoglobin is 5'); }

// ---- R6.2-10: VF that is never shocked almost never comes back
{ let rosc = 0; for (let s = 0; s < 80; s++) { const p = mine('nstemi', {}, 6700 + s); OC.toArrest(p, 'x'); p.code = null;
    OC.assign(OC.G.me, p.id);
    for (let i = 0; i < 400 && p.arrest; i++) {
      if (OC.G.card && OC.G.card.eid === 'code') { const c = OC.G.card, q = OC.codeSteps(p)[c.ctx.step], ri = q.c.findIndex(x => x[2]); const wrong = q.c.findIndex((x, j) => j !== ri && !/^shock/i.test(x[0])); OC.chooseCard(String(wrong)); }
      else if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(x => !x.dis).k);
      OC.step(0.1);
    }
    if (p.code && p.code.r === 'vf' && p.dx === 'ROSC after cardiac arrest') rosc++; }
  assert(rosc <= 4, `VF with no shock: ${rosc} of the VF arrests got a pulse back`); }

// ---- R3.2-04: rhythm checks are about two minutes of CPR apart, not all at once
{ const p = mine('nstemi', {}, 6800); OC.toArrest(p, 'x'); const cards = runCode(p, true);
  assert(cards.length >= 2 && cards.every((c, i) => i === 0 || c.t - cards[i - 1].t >= OC.CODE_GAP - 0.2), `rhythm checks come ${OC.CODE_GAP} game minutes apart (${cards.map(c => Math.round(c.t)).join(', ')})`); }

// ---- R3.2-01: the doctor running a code leaves: the code stops, the clock restarts, and someone can take it over
{ OC.newGame('med', 6900, { mode: 'rn' }); OC.G.card = null;
  for (let i = 0; i < 400 && !OC.inRooms().some(x => x.prov && !x.arrest && OC.staff(x.prov) && OC.present(OC.staff(x.prov))); i++) { OC.step(0.1); OC.botStep({ budget: 2 }); }
  const p = OC.inRooms().find(x => x.prov && !x.arrest);
  const s = OC.staff(p.prov); OC.toArrest(p, 'x'); run(2);
  assert(p.ev === 'doing', 'their provider is running the code');
  OC.staffGone(s, 'off'); run(1);
  assert(p.arrest && p.ev === 'none' && !p.prov, 'the provider goes home mid-code: the patient is back on the board, still in arrest');
  run(21);
  assert(!p.arrest && /no code team/.test(p.dx), 'nobody takes it over for 20 minutes: they die, and it counts (no endless CPR)'); }

// ---- R3.2-02: a save from before v0.30 with an arrest in progress doesn't kill the patient on resume
{ const p = mine('nstemi', {}, 7000); OC.toArrest(p, 'x'); p.tArrest = undefined; p.tArrive = OC.G.t - 90;
  const g = JSON.parse(JSON.stringify(OC.G)); OC.load(g); const q = OC.pt(p.id); run(2);
  assert(q.arrest && q.tArrest != null, 'an arrest loaded from an old save gets its 20 minutes from the resume'); }

// ---- R3.2-08: an arrest that never got a room isn't the attending's fault
{ OC.newGame('med', 7100, { mode: 'md' }); OC.G.card = null;
  const p = OC.pt(OC.trainPatient('nstemi', 'waiting', {})); OC.toArrest(p, 'Arrested in the waiting room'); p.tArrest = OC.G.t - 21;
  const L0 = JSON.stringify(OC.G.ledger), mm0 = OC.G.stats.mm.length; OC.step(0.1);
  assert(!p.arrest && p.loc === 'gone' && JSON.stringify(OC.G.ledger) === L0 && !OC.G.stats.mm.slice(mm0).some(x => /no code team/.test(x.what)) && OC.G.stats.noTeam === 1,
    'an arrest that never got a room is counted, but isn\'t charged to the attending'); }

// ---- R6.2-13: A-fib onset decides whether cardioversion of a stable patient is fair
{ let shortId = null, longId = null;
  for (let s = 0; s < 60 && (!shortId || !longId); s++) { const p = mine('afib', {}, 7200 + s); if (OC.afOnset(p) != null) shortId = shortId || s; else longId = longId || s; }
  let p = mine('afib', {}, 7200 + shortId); let r = sign(p, ['ecg', 'lab'], ['dilt', 'synccv']);
  assert(!r.extra && !r.harm, `stable A-fib that started ${OC.afOnset(p)} hours ago: cardioversion is a fair choice`);
  p = mine('afib', {}, 7200 + longId); r = sign(p, ['ecg', 'lab'], ['dilt', 'synccv']);
  assert(r.extra === 1, 'not sure when it started: cardioversion without a blood thinner is an extra (and a stroke risk)'); }

// ---- R6.2-17: no aspirin on top of a clot buster in stroke
{ const p = mine('stroke', { lkw: 60, over: false }, 7300); sign(p, ['ct', 'lab'], ['tnk']); const r = sign(p, [], ['asa']);
  assert(r.harm === 1, 'aspirin after tenecteplase in a stroke is harm'); }

// ---- R4.2-01: the code card's answers are really shuffled (the right one isn't always on top)
{ const pos = [0, 0, 0, 0]; let n = 0;
  for (let s = 0; s < 120; s++) { const p = mine('nstemi', {}, 7400 + s); OC.toArrest(p, 'x'); OC.assign(OC.G.me, p.id);
    for (let i = 0; i < 400 && p.arrest; i++) {
      if (OC.G.card && OC.G.card.eid === 'code') { const c = OC.G.card, q = OC.codeSteps(p)[c.ctx.step], ri = String(q.c.findIndex(x => x[2])); pos[c.choices.findIndex(x => x.k === ri)]++; n++; OC.chooseCard(ri); }
      else if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(x => !x.dis).k);
      OC.step(0.1);
    } }
  assert(pos.every(x => x > n * 0.15), `the right answer lands in every position (${pos.join(' / ')} of ${n})`); }
// ---- R4.2-02: every answer gets a result card: right or wrong, the right call, and why
{ const p = mine('nstemi', {}, 7600); OC.toArrest(p, 'x'); OC.assign(OC.G.me, p.id);
  let res = null; for (let i = 0; i < 200 && !res; i++) {
    if (OC.G.card && OC.G.card.eid === 'code') { const q = OC.codeSteps(p)[OC.G.card.ctx.step], ri = q.c.findIndex(x => x[2]); OC.chooseCard(String((ri + 1) % 4)); res = OC.G.card; }
    else if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(x => !x.dis).k); else OC.step(0.1); }
  assert(res && res.eid === 'coderes' && /Not this one/.test(res.title) && /The call:/.test(res.text), 'a wrong answer shows a result card with the right call'); }

// ---- R1.2-01: content checks that a snapshot can't make (each one catches a plausible wrong edit)
assert(/calcium/i.test(OC.CODE_CAUSE.k.c.find(c => c[2])[0]), 'potassium 7.9 in arrest: the right call starts with calcium, not an insulin drip');
assert(!Object.values(OC.CODE_Q).flat().some(q => /cardioversion/i.test(q.c.find(c => c[2])[0])), 'no code card ever makes cardioversion the right answer in a pulseless patient');
{ const B = OC.CODE_BASE; assert(B.ed.vf > B.ed.pea && B.ed.pea > B.ed.asys && ['vf', 'pea', 'asys', 'trauma', 'limb'].every(r => B.field[r] < B.ed[r]), 'pulse-back odds: VF best, asystole worst; better in the ED than arriving in arrest'); }
{ const p = mine('afib', {}, 7700); OC.signOrders(p.id, ['ecg', 'lab'], ['dilt']);
  assert(p.tr.includes('meds') && p.treat.meds && p.treat.meds.st !== 'done', 'a diltiazem order is pending');
  OC.crashNow(p.id); run(0.2);
  assert(!p.tr.includes('meds') && !p.treat.meds && p.tr.includes('cardiovert'), 'an A-fib crash cancels the pending rate-control order (R1.2-05, R1.3-02)'); }
{ let longId = null; for (let s = 0; s < 60 && longId == null; s++) { const p = mine('afib', {}, 7800 + s); if (OC.afOnset(p) == null) longId = s; }
  const p = mine('afib', {}, 7800 + longId); p.extraTr = ['cardiovert'];
  let harm = 0; for (let i = 0; i < 60; i++) { const h = md().harm || 0; OC.harmCheck(p, 'cardiovert'); harm += (md().harm || 0) - h; }
  assert(harm > 0 && harm < 30, `cardioversion of A-fib of unknown onset sometimes causes a stroke (${harm} of 60)`); }
{ const p = mine('stroke', { lkw: 60 }, 7900); p.lkwT = null; assert(!OC.lyticWindowOk(p) && OC.contraOf(p).includes('tnk'), 'unknown stroke onset is outside the window, in every rule that asks (R1.2-06)'); }
{ let threw = false; const keep = OC.CODE_Q.vf[0].c[0][2]; OC.CODE_Q.vf[0].c[0][2] = 0; try { OC.lintCode(); } catch (e) { threw = true; } OC.CODE_Q.vf[0].c[0][2] = keep;
  assert(threw, 'a code card with no right answer fails the load-time check (R1.2-07)'); }
assert(OC.CODE_AI_Q < 0.67, 'a code handed to the computer doctor scores below a player who gets every rhythm check right (and no better than 2 of 3)');
{ const L = OC.HCG_CASES; assert(['appy', 'dissect', 'pe', 'mpe', 'od', 'sbo'].every(k => L.has(k)), 'the pregnancy-test list still holds the cases that need it'); }

// ---- R5.2-02: a patient with a pulse back after an arrest goes to the ICU, never home
{ let p = null; for (let s = 0; s < 40 && !(p && p.rosc); s++) { p = mine('nstemi', {}, 8000 + s); OC.toArrest(p, 'x'); runCode(p, true); }
  assert(p && p.rosc && p.dx === 'ROSC after cardiac arrest', 'a code with every call right got a pulse back');
  p.dsp = 'mddecide'; const r = OC.mdDecide(p.id, 'home');
  assert(!r.ok && /ICU/.test(r.why) && p.dsp === 'mddecide', 'and "home" is refused: after an arrest, the ICU');
  assert(/pulse came back/i.test(OC.examOf(p)), 'and the card says what happened, not the old case\'s exam'); }
// ---- R5.2-03: a patient in arrest can go in a pod room when no resus bay is free, but not a chair or the hallway
{ OC.newGame('med', 8100, { mode: 'rn' }); OC.G.card = null;
  for (const r of OC.G.rooms) if (r.kind === 'resus') r.closed = true;
  const p = OC.pt(OC.trainPatient('nstemi', 'waiting', {})); OC.toArrest(p, 'Arrested in the waiting room');
  const pod = OC.G.rooms.find(r => r.kind === 'main' && !r.pid && r.st === 'clean' && !r.closed), chair = OC.G.rooms.find(r => r.kind === 'chair' && !r.pid);
  assert(OC.canPlace(p, pod).ok && !OC.canPlace(p, chair).ok, 'resus is full: the code can run in a pod room, never a chair');
  for (const r of OC.G.rooms) if (r.kind === 'resus') r.closed = false;
  const bay = OC.G.rooms.find(r => r.kind === 'resus' && !r.pid && r.st === 'clean');
  if (bay) assert(!OC.canPlace(p, pod).ok && OC.canPlace(p, bay).ok, 'with a resus bay free, the code goes there'); }
// ---- R5.2-01: letting your own patient die with no code costs the attending more than running it badly
{ const p = mine('nstemi', {}, 8200); OC.toArrest(p, 'x'); const c0 = OC.G.care, l0 = OC.G.lit || 0; run(21);
  const ignoreCost = c0 - OC.G.care, litUp = (OC.G.lit || 0) - l0;
  const q = mine('nstemi', {}, 8201); OC.toArrest(q, 'x'); const c1 = OC.G.care; runCode(q, false); const badCost = c1 - OC.G.care;
  assert(/no code team/.test(p.dx) && ignoreCost >= 40 && litUp > 0 && ignoreCost > badCost, `ignoring your own arrest costs ${ignoreCost} points and legal risk; running it with every call wrong costs ${badCost}`); }

// ---- round 3 (R6.3, R3.3)
{ const p = mine('afib', {}, 8300); const r = sign(p, ['ecg', 'lab'], ['dilt', 'midaz', 'propofol', 'synccv']);
  assert(!r.wrong && !r.harm && !p.tr.includes('intub'), 'sedation for a cardioversion is right care, not a wrong drug or an intubation (R6.3-01)'); }
{ let s0 = null; for (let s = 0; s < 60 && s0 == null; s++) { const q = mine('afib', {}, 8400 + s); if (OC.afOnset(q) != null) s0 = s; }
  const p = mine('afib', {}, 8400 + s0); sign(p, ['ecg', 'lab'], ['synccv']);
  assert(!OC.missNow(p).some(x => /dilt|Medications/i.test(x)), 'stable A-fib under 48 hours: a cardioversion alone answers the rate-control order (R6.3-02)'); }
{ const q = mine('nstemi', {}, 8500); q.code = { r: 'vf' }; const steps = OC.codeSteps(q);
  assert(/^Shock/.test(steps[2].c.find(c => c[2])[0]), 'the amiodarone answer starts with a shock, so it counts as one (R6.3-04)'); }
assert(OC.codeCause({ id: 'd1', ck: 'dka', age: 40 }) === 'vol', 'a DKA arrest isn\'t told potassium 7.9 when its chart says 4.8 (R6.3-05)');
assert(!/ECG before the arrest/.test(OC.CODE_CAUSE.coronary.t), 'the coronary card doesn\'t claim an ECG the chart may not show (R6.3-06)');
assert(OC.codeCause({ id: 'a1', ck: 'asthma', age: 30 }) === 'trap' && /let air out/i.test(OC.CODE_CAUSE.trap.c.find(c => c[2])[0]), 'an asthma arrest: let the trapped air out, think tension (R6.3-14)');
{ const p = mine('stroke', { lkw: 60, over: false }, 8600); const r = sign(p, ['ct', 'lab'], ['tnk', 'asa']);
  assert(r.harm === 1, 'aspirin on the same order sheet as a stroke lytic is harm (R6.3-10)'); }
{ const p = mine('afib', {}, 8700); OC.crashNow(p.id); run(5); assert(/cardioversion/i.test(OC.whyOf(p)), 'the unstable A-fib disposition card says cardioversion, not diltiazem (R6.3-09)'); }
// R3.3-01: two players on one shift see the same clinical facts for the same patient, however their ids drift
{ const facts = style => { OC.newGame('med', 4321, { mode: 'rn' }); let n = 0, s = 0;
    while (OC.G.t < 240 && n++ < 6000) { OC.step(0.1); s += 0.1; if (OC.G.card) OC.botStep({ budget: 0 }); if (s >= 1.5) { s = 0; OC.botStep({ budget: style ? 2 : 1, acc: style ? 0.6 : 0.2 }); } }
    return OC.G.order.map(id => OC.G.pts[id]).filter(p => p.tArrive >= 0 && p.hk).map(p => `${p.hk}:${p.ck}:${OC.codeRhythm(p)}:${p.lkw || ''}:${OC.afOnset(p) || ''}`); };
  const a = facts(1), b = new Set(facts(0)), both = a.filter(x => b.has(x)).length;
  assert(a.length > 20 && both >= a.length * 0.9, `the same patient keeps the same facts across players (${both} of ${a.length} matched)`); }
// R3.3-02: the computer charge nurse rooms a code in a pod room when resus is full
{ OC.newGame('med', 8800, { mode: 'md' }); OC.G.card = null;
  for (const r of OC.G.rooms) if (r.kind === 'resus') r.closed = true;
  const p = OC.pt(OC.trainPatient('nstemi', 'waiting', {})); OC.toArrest(p, 'Arrested in the waiting room'); p.tri = 'done';
  for (let i = 0; i < 100 && p.loc !== 'room'; i++) { OC.step(0.1); OC.botStep({ budget: 3 }); }
  assert(p.loc === 'room' && OC.room(p.room).kind === 'main', 'resus is full: the computer charge nurse puts the code in a pod room'); }

// R4.3-01: after ROSC there's no gray-zone home or observation
{ let p = null; for (let s = 0; s < 40 && !(p && p.rosc); s++) { p = mine('cpmod', {}, 8900 + s); OC.toArrest(p, 'x'); runCode(p, true); }
  assert(p.rosc && !p.gray, 'a gray-zone patient with a pulse back has no observe-or-home call');
  p.gray = { band: 'moderate', tool: 'HEART', score: 6, right: 'obs' }; p.dsp = 'decide';
  assert(!OC.grayDispo(p.id, 'home').ok && !OC.grayDispo(p.id, 'obs').ok, 'and if one is open, home and observation are refused'); }

// ---- R2.3-01: the children's dose arithmetic, by the numbers (PALS: epinephrine 0.01 mg/kg max 1 mg; amiodarone 5 mg/kg max 300 mg;
// shocks 2 then 4 J/kg). Weights are APLS-style estimates: about 9 kg at 9 months, 16 kg at 3 years, 32 kg at 8, 48 kg at 12.
{ const kid = (age, id) => ({ id, ck: 'asthma', age });
  const est = [[kid(3, 'w3'), 14, 18], [kid(8, 'w8'), 28, 36], [kid(12, 'w12'), 44, 52]];
  for (const [q, lo, hi] of est) { const kg = OC.kgOf(q); assert(kg >= lo && kg <= hi, `a ${q.age}-year-old is dosed for ${kg} kg (expected ${lo} to ${hi})`); }
  for (let m = 0; m < 24; m++) { const q = { id: 'inf' + m, ck: 'rsv', age: m < 12 ? 0 : 1 }; const mo = OC.monthsOf(q), kg = OC.kgOf(q);
    const want = mo < 12 ? (mo + 9) / 2 : 2 * (mo / 12 + 5); if (Math.abs(kg - Math.max(3, Math.round(want))) > 0.01) { assert(false, `infant of ${mo} months: ${kg} kg, expected ${Math.round(want)}`); break; } }
  for (const age of [0, 1, 3, 6, 8, 12]) { const q = { id: 'd' + age, ck: age < 2 ? 'rsv' : 'asthma', age }, kg = OC.kgOf(q);
    const epi = String(Math.round(Math.min(1, 0.01 * kg) * 100) / 100), amio = String(Math.min(300, Math.round(5 * kg)));
    q.code = { r: 'vf' }; const vf = OC.codeSteps(q).map(st => st.c.find(c => c[2])[0]);
    q.code = { r: 'pea' }; const pea = OC.codeSteps(q).map(st => st.c.find(c => c[2])[0]);
    const ok = vf[0].includes(`${Math.round(2 * kg)} J`) && vf[1].includes(`${Math.round(4 * kg)} J`) && vf[1].includes(`epinephrine ${epi} mg`) && vf[2].includes(`amiodarone ${amio} mg`) && pea[0].includes(`epinephrine ${epi} mg`);
    assert(ok, `age ${age} (${kg} kg): shocks ${Math.round(2 * kg)} then ${Math.round(4 * kg)} J, epinephrine ${epi} mg, amiodarone ${amio} mg`); } }
// ---- R2.3-02: the outcome model, by the numbers
{ const P = (r, right, n, wait, o) => Object.assign({ id: 'o1', ck: 'nstemi', age: 60, code: { r, right, me: true, wait, shocked: r !== 'vf' || right > 0 } }, o || {});
  const odds = x => OC.codeOdds(x);
  const vfAll = odds(P('vf', 3, 3, 0)), vfNone = odds(P('vf', 0, 3, 0)), vfLate = odds(P('vf', 3, 3, 13)), pea = odds(P('pea', 3, 3, 0)), field = odds(P('vf', 3, 3, 0, { ck: 'arrest' }));
  assert(Math.abs(vfAll - OC.CODE_BASE.ed.vf) < 0.001, `VF, everything right and fast: the full ${OC.CODE_BASE.ed.vf}`);
  assert(vfNone < vfAll * 0.05, `VF never shocked: almost no chance (${vfNone.toFixed(3)})`);
  assert(Math.abs(vfLate / vfAll - 0.5) < 0.001, 'ten minutes late (13 without a doctor) halves the odds');
  assert(pea < vfAll && field < vfAll, 'PEA is worse than VF; arriving in arrest is worse than arresting in the ED');
  assert(odds(P('vf', 2, 3, 0)) < vfAll && odds(P('vf', 1, 3, 0)) < odds(P('vf', 2, 3, 0)), 'each wrong rhythm check lowers the odds');
  assert(OC.CODE_GAP >= 2, `rhythm checks are at least 2 game minutes apart (${OC.CODE_GAP})`); }

// ---- round 3, architecture (R1.3)
{ OC.newGame('easy', 9100, { mode: 'md' }); OC.G.card = null;
  const p = OC.pt(OC.trainPatient('arrest', 'room', { room: roomFree() })); p.prov = null; const t0 = p.tArrest;
  run(5); const g = JSON.parse(JSON.stringify(OC.G)); OC.load(g); const q = OC.pt(p.id);
  assert(q.tArrest === t0, 'reloading a current save doesn\'t restart an arrival-in-arrest\'s clock (R1.3-01)'); }
{ const p = mine('stroke', { lkw: 60, over: false }, 9200); const r = sign(p, ['ct', 'lab'], ['asa', 'tnk']);
  assert(r.harm === 1, 'aspirin before tenecteplase on one sheet is harm too: the order of the taps doesn\'t matter (R1.3-03)'); }
{ const p = mine('salod', {}, 9300); toasts = []; sign(p, [], ['asa']); const t = toasts.find(x => /can hurt/.test(x)) || '';
  assert(/already took/.test(t) && !/bleeding/.test(t), `aspirin in an aspirin overdose says why, not "bleeding risk": "${t}" (R1.3-04)`); }
{ const p = mine('stroke', { lkw: 60 }, 9301); p.lkwT = null; assert(/known well/.test(OC.contraWhy(p, 'tnk')) && !/more than 4\.5/.test(OC.contraWhy(p, 'tnk')), 'an unknown onset is told the onset is unknown (R1.3-04)'); }
{ const words = ['sepsis', 'septic', 'obstruction', 'stemi', 'nstemi', 'fibrillation', 'a-fib', 'overdose of', 'diabetic', 'ketoacidosis', 'pulmonary embolism', 'anaphyla'];
  const bad = []; for (const [ck, M] of Object.entries(OC.CONTRA_WHY)) for (const [d, t] of Object.entries(M)) { const dx = ((OC.CASES.find(c => c.k === ck) || {}).dx || '').toLowerCase();
    if ((dx && t.toLowerCase().includes(dx)) || words.some(w => t.toLowerCase().includes(w))) bad.push(`${ck}/${d}`); }
  assert(!bad.length, `no harm reason names a diagnosis (R1.3-04)${bad.length ? ': ' + bad.join(', ') : ''}`); }
{ OC.newGame('med', 9400, { mode: 'rn' }); OC.G.card = null;
  for (let i = 0; i < 400 && !OC.inRooms().some(x => x.prov && !x.arrest && OC.staff(x.prov) && OC.present(OC.staff(x.prov))); i++) { OC.step(0.1); OC.botStep({ budget: 2 }); }
  const p = OC.inRooms().find(x => x.prov && !x.arrest), s = OC.staff(p.prov); OC.toArrest(p, 'x'); run(6);
  const w0 = p.code && p.code.wait; OC.staffGone(s, 'off'); run(2);
  const other = OC.G.staff.find(x => OC.isProv(x) && OC.present(x) && x.id !== s.id && !x.pit); OC.assign(other.id, p.id); run(1);
  assert(p.code && p.code.wait <= w0 + 3, `a code taken over counts only the minutes nobody ran it (${w0} then ${p.code && p.code.wait}) (R1.3-06)`); }
{ const p = mine('afib', {}, 9500); OC.signOrders(p.id, ['ecg', 'lab'], ['dilt']); for (let i = 0; i < 300 && !(p.treat.meds && p.treat.meds.st === 'done'); i++) { if (OC.G.card && !OC.G.card.mine) OC.botStep({ budget: 0 }); OC.step(0.1); }
  OC.crashNow(p.id); run(0.2); assert(/diltiazem/i.test(OC.rxName(p)), 'after a crash, the chart still names the diltiazem that was given (R1.3-07)'); }
{ let threw = false; const keep = OC.CODE_Q.kidpea; delete OC.CODE_Q.kidpea; try { OC.lintCode(); } catch (e) { threw = true; } OC.CODE_Q.kidpea = keep;
  assert(threw, 'a missing card set fails the load-time check (R1.3-08)'); }

// ---- round 3, player (R5.3)
{ const roscOf = (k, o, seed) => { let p = null; for (let s = 0; s < 60 && !(p && p.rosc); s++) { p = mine(k, o || {}, seed + s); OC.toArrest(p, 'x'); runCode(p, true); } return p; };
  const e = roscOf('ectopic', {}, 9600); e.dsp = 'mddecide';
  assert(e.rosc && e.con === 'obgyn' && e.dispo === 'or' && e.con2 === 'icu' && e.tr.includes('blood') === !!e.bledOut, `an ectopic with a pulse back goes to OB/GYN and the OR, then Critical Care (R5.3-01): ${e.con}/${e.dispo}`);
  const st = roscOf('stemi', {}, 9700); assert(st.rosc && st.con === 'cards' && st.dispo === 'cath', 'a STEMI with a pulse back goes to cardiology and the cath lab');
  const ns = roscOf('nstemi', {}, 9800); assert(ns.rosc && ns.con === 'icu' && ns.con2 === 'cards', 'an NSTEMI with a pulse back: Critical Care, then cardiology');
  const kid = roscOf('rsv', { age: 0 }, 9900); kid.dsp = 'mddecide';
  const r = OC.mdDecide(kid.id, 'transfer');
  assert(kid.rosc && r.ok && /children/.test(kid.txTo), `an infant with a pulse back is transferred to a children's hospital (R5.3-02): ${r.why || r.msg}`); }
{ let longest = 0, n = 0; const L = q => q.c.map(c => c[0].replace(/\{[a-z0-9]+\}/g, '00').length);
  for (const q of [...Object.values(OC.CODE_Q).flat(), ...Object.values(OC.CODE_CAUSE)]) { const l = L(q), ri = q.c.findIndex(c => c[2]); n++; if (l[ri] === Math.max(...l) && l.filter(x => x === l[ri]).length === 1) longest++; }
  assert(longest <= n * 0.25, `the right answer is the longest on only ${longest} of ${n} cards: "pick the longest" doesn't work (R5.3-03)`); }
assert(OC.CODE_GAP === 2, 'rhythm checks are two game minutes apart, as the cards say (R5.3-04)');
