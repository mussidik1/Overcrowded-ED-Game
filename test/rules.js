// Checks the specific rules: consultant anger, attending-only Box, EVS before placement, APP scope, ratio math.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};

function fresh(seed) {
  OC.newGame('med', seed);
  if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k);
  return OC.G;
}
function runUntil(fn, max = 4000) { for (let i = 0; i < max && !fn(); i++) { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); OC.step(0.1); } return fn(); }

// 1. consultant anger: find a roomed, evaluated patient that needs a consult with prerequisites not yet back
let G = fresh(101), found = null;
runUntil(() => {
  OC.botStep({ budget: 3 });
  for (const p of OC.inRooms()) if (p.con && p.pre.length && p.ev === 'done' && p.consult.st === 'none' && !OC.preDone(p)) { found = p; return true; }
  // keep the bot from consulting: it only consults when dxK, which needs all results
  return false;
}, 6000);
assert(found, 'found a patient needing a consult with results pending: ' + (found && `${found.dx} needs ${found.con}, pre=${found.pre}`));
if (found) {
  const moodBefore = G.spec[found.con].mood, careBefore = G.care;
  const r = OC.consult(found.id, found.con);
  assert(!r.ok && r.mad, 'early consult is refused and the consultant is mad: ' + r.why);
  assert(G.spec[found.con].mood === moodBefore - 1, 'consultant mood dropped');
  assert(G.care < careBefore, 'early consult cost points');
  const wrong = Object.keys(OC.SPECS).find(k => k !== found.con);
  const r2 = OC.consult(found.id, wrong);
  assert(!r2.ok && r2.mad, 'wrong service is refused: ' + r2.why);
  runUntil(() => OC.preDone(found) || found.loc === 'gone', 3000);
  if (found.loc !== 'gone') { const r3 = OC.consult(found.id, found.con); assert(r3.ok, 'consult accepted once prerequisites are back: ' + r3.msg); }
}

// 2. the Box: consult must go to an attending
G = fresh(202);
runUntil(() => { if (G.box.cur && G.box.cur.kind === 'notify') OC.boxNotify(); return G.box.cur && G.box.cur.kind === 'consult'; }, 8000);
assert(G.box.cur && G.box.cur.kind === 'consult', 'a medical consult rang the Box');
if (G.box.cur && G.box.cur.kind === 'consult') {
  const app = G.staff.find(s => s.role === 'app');
  assert(!OC.boxTake(app.id).ok, 'a PA/NP cannot take a Box consult');
  const md = G.staff.find(s => s.role === 'md' && s.st === 'on');
  const t = OC.boxTake(md.id);
  assert(t.ok && md.q.some(k => k.type === 'box'), 'attending takes it and it lands at the front of their queue');
  assert(md.q[0].type === 'box', 'box consult pre-empts their current work');
  const d = OC.boxDecide(t.sc.a);
  assert(d && d.ok, 'right call scores as correct');
}
// unanswered consult rings out
G = fresh(303);
runUntil(() => { if (G.box.cur && G.box.cur.kind === 'notify') OC.boxNotify(); return G.stats.boxC.miss > 0; }, 9000);
assert(G.stats.boxC.miss > 0, 'an unanswered consult rings out and counts as missed');

// 3. EVS: dirty rooms block placement until cleaned
G = fresh(404);
const dirty = G.rooms.find(r => !r.pid && r.st === 'clean' && r.kind === 'main');
dirty.st = 'dirty';
let p = OC.active().find(x => x.loc === 'waiting' || x.loc === 'wall');
runUntil(() => (p = OC.active().find(x => (x.loc === 'waiting' || x.loc === 'wall') && x.esi >= 2 && x.esi <= 3 && !x.iso)), 3000);
if (p) {
  dirty.pid = null; dirty.st = 'dirty';
  p.reg = 'done'; p.tri = 'done';
  const r = OC.place(p.id, dirty.id);
  assert(!r.ok && /dirty/i.test(r.why), 'cannot place in a dirty room: ' + r.why);
  OC.evsTap(dirty.id);
  runUntil(() => dirty.st === 'clean', 600);
  assert(dirty.st === 'clean', 'EVS cleaned it after being sent');
}

// 4. APP scope and ratio weights
G = fresh(505);
const esi2 = OC.inRooms().find(x => x.esi <= 2) || (() => { runUntil(() => { OC.botStep({}); return OC.inRooms().some(x => x.esi <= 2); }); return OC.inRooms().find(x => x.esi <= 2); })();
if (esi2) { const app = G.staff.find(s => s.role === 'app'); const c = OC.canAssign(app, esi2); assert(!c.ok, 'APP blocked from ESI ' + esi2.esi + ': ' + c.why); }
assert(OC.weight({ esi: 1, dsp: 'none' }) === 4 && OC.weight({ esi: 2, dsp: 'none' }) === 2 && OC.weight({ esi: 3, dsp: 'none' }) === 1, 'ratio weights: ESI1=4, ESI2=2, ESI3-5=1');

// 5. snapshot round-trip keeps playing
G = fresh(606);
for (let i = 0; i < 300; i++) { OC.step(0.1); OC.botStep({ budget: 2 }); if (G.card) OC.chooseCard(G.card.choices.find(c => !c.dis).k); }
const snap = JSON.parse(JSON.stringify(OC.G)); const tBefore = snap.t;
OC.load(snap);
for (let i = 0; i < 300; i++) { OC.step(0.1); OC.botStep({ budget: 2 }); if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); }
assert(OC.G.t > tBefore + 25, 'game resumes from a JSON snapshot');
