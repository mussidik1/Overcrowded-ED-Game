// v0.5: the expert panel's Good and Medium lists.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function fresh(seed, level) { OC.newGame(level || 'med', seed); clearCard(); return OC.G; }
function run(min, fn, bot) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (bot) OC.botStep(bot); if (fn && fn()) return true; if (OC.G.over) return false; } return false; }
const BOT = { budget: 3, gray: false, chairs: false, fcp: false, zones: false };
const NOPROV = Object.assign({}, BOT, { prov: false });
const free = (G, kind) => G.rooms.find(r => r.kind === kind && !r.pid && r.st === 'clean' && !r.closed);

// 1. Fast Track opens at 09:00
let G = fresh(501);
assert(G.rooms.filter(r => r.kind === 'ft').every(r => r.closed), 'Fast Track is closed at 07:00');
assert(OC.staff('rnFT').st === 'pending', 'its nurse starts at 09:00');
run(121);
assert(G.rooms.filter(r => r.kind === 'ft').every(r => !r.closed) && OC.staff('rnFT').st === 'on', 'Fast Track opens at 09:00 with its nurse');

// 2. Quick registration at the door, full registration at the bedside
G = fresh(502);
let w = null;
run(180, () => (w = OC.active().find(p => p.loc === 'triage' && p.reg === 'none' && p.esi >= 3)));
assert(w, 'a walk-in is at the door');
if (w) {
  assert(OC.register(w.id, 'reg1').ok, 'registrar directed');
  run(6, () => w.reg === 'quick');
  assert(w.reg === 'quick', 'a quick registration takes a couple of minutes');
  const tr = OC.triage(w.id, 'rnT');
  assert(tr.ok && !/once registered/.test(tr.msg), 'triage can start right after the quick registration');
  run(20, () => w.tri === 'done');
  const r = free(G, 'main');
  assert(OC.place(w.id, r.id).ok, 'a quick registration is enough to bed them');
  run(40, () => w.reg === 'done');
  assert(w.reg === 'done', 'registration finished at the bedside on its own');
}

// 3. Under-triage and the waiting-room recheck
G = fresh(503);
let u = null;
run(300, () => (u = OC.active().find(p => p.loc === 'triage' && p.reg === 'none' && p.esi === 2 && !p.alert)));
assert(u, 'an ESI 2 walk-in is at the door');
if (u) {
  OC.register(u.id, 'reg1'); OC.triage(u.id, 'rnT');
  run(30, () => u.tri === 'done');
  u.esiT = 3; u.crash = false;
  const hall = free(G, 'hall');
  assert(u.loc === 'waiting' && OC.vEsi(u) === 3 && OC.canPlace(u, hall).ok, 'under-triaged as ESI 3: the board lets them take a hallway bed');
  assert(!OC.recheck(u.id, 'rnD').ok, 'a new grad cannot do triage rechecks');
  assert(OC.recheck(u.id, 'rnT').ok, 'triage nurse directed to recheck');
  run(15, () => u.esiT == null);
  assert(u.esiT == null && OC.vEsi(u) === 2 && G.stats.underCaught >= 1, 'the recheck caught it: really ESI 2');
  assert(!OC.canPlace(u, hall).ok, 'now no hallway bed');
}

// 4. Skill mix
G = fresh(504);
assert(OC.staff('rnD').skill === 'new' && OC.staff('rnR1').skill === 'exp', 'a new grad in Pod D, resus-trained nurses in Resus');
assert(!OC.toggleZone('rnD', 'resus').ok && !OC.toggleZone('rnD', 'triage').ok, 'a new grad cannot cover Resus or triage');
const door = OC.active().find(p => (p.loc === 'triage' || p.loc === 'wall') && p.tri === 'none');
if (door) assert(!OC.triage(door.id, 'rnD').ok, 'a new grad cannot triage');
const ag = OC.callAgency('b');
assert(ag.ok && G.staff[G.staff.length - 1].skill === 'agency', 'agency nurses are their own skill level');

// 5. Results-pending chairs
G = fresh(505);
let c = null;
run(400, () => (c = OC.inRooms().find(p => p.esi >= 3 && p.ev === 'done' && p.dsp === 'none' && p.dispo === 'home' && !p.gray && !p.iso && !p.sitter && OC.roomOf(p).kind === 'main')), BOT);
assert(c, 'a seen patient is waiting on results');
if (c) {
  const chair = free(G, 'chair'), from = OC.roomOf(c);
  const unseen = OC.active().find(p => p.loc === 'waiting' && !p.pitSeen);
  if (unseen) assert(!OC.canPlace(unseen, chair).ok, 'unseen patients do not go to a chair');
  const board = OC.inRooms().find(p => p.dsp === 'board');
  if (board) assert(!OC.canPlace(board, chair).ok, 'admitted patients do not go to a chair');
  assert(OC.move(c.id, chair.id).ok, 'moved to a chair');
  assert(from.st === 'dirty' && chair.pid === c.id && OC.weight(c) < 0.5, 'their bed goes to EVS; a chair barely counts against the nurse');
  run(400, () => c.loc === 'gone', BOT);
  assert(c.loc === 'gone' && chair.st === 'clean', 'the chair is ready again as soon as they leave, no EVS');
}

// 6. Report calls and the hold nurse
G = fresh(506, 'hard');
const holds = OC.inRooms().filter(p => p.dsp === 'board');
assert(holds.length >= 3, 'the night shift left admitted patients holding ED beds');
if (holds.length >= 3) {
  const [b1, b2, b3] = holds;
  for (const b of holds) b.due = 1e9;
  b1.due = G.t; run(0.5);
  assert(b1.dsp === 'callrep' || b1.dsp === 'reporting', 'a bed upstairs is assigned: the nurse calls report first');
  assert(!OC.sendUp(b1.id, 'tp1').ok, 'nobody goes up before report');
  run(20, () => b1.dsp === 'bedready');
  assert(b1.dsp === 'bedready', 'report called; now they can go up');
  G.mods.noReport = G.t + 30; b2.due = G.t; run(10);
  assert(b2.dsp === 'callrep', 'floors in shift change: report waits');
  G.mods.noReport = -1e9; run(20, () => b2.dsp === 'bedready');
  assert(b2.dsp === 'bedready', 'report goes through once the floor picks up');
  const zn = OC.zoneNurses(OC.roomOf(b3).z)[0], before = OC.nurseLoad(zn);
  const casey = OC.staff('rnX'); casey.zones = []; casey.cover = [];
  assert(OC.toggleZone('rnX', 'hold').ok, 'Casey takes the admitted holds');
  assert(OC.nurseLoad(zn) < before && Math.abs(OC.nurseLoad(casey) - OC.holdLoad()) < 1e-9 && OC.ratioCap(casey) === 5, 'pod nurses drop the holds; the hold nurse carries them at 1:5');
  casey.task = null; b3.due = G.t; run(3, () => casey.task && casey.task.kind === 'report');
  assert(casey.task && casey.task.kind === 'report' && casey.task.pid === b3.id, 'the hold nurse calls report');
}

// 7. Gray-zone calls and the observation unit
G = fresh(507);
let gp = null;
run(600, () => (gp = OC.inRooms().find(p => p.dsp === 'decide')), Object.assign({}, BOT, { budget: 4 }));
assert(gp && gp.gray, 'a gray-zone patient is waiting on your call');
if (gp) {
  const c0 = G.care, right = gp.gray.right;
  assert(OC.grayDispo(gp.id, right).ok && Math.round(G.care - c0) === 8, `the right call (${right}) scores`);
  assert(right === 'home' ? gp.dsp === 'ready' : gp.dsp === 'board', 'and the plan follows it');
}
G = fresh(508);
const mk = (right) => { const p = OC.inRooms().find(x => x.dsp === 'none' && !x.gray); p.gray = { tool: 'HEART score', score: right === 'obs' ? 5 : 2, band: right === 'obs' ? 'moderate' : 'low', right, ok: right === 'obs' ? ['admit'] : [] }; p.dsp = 'decide'; return p; };
run(180, () => OC.inRooms().filter(x => x.dsp === 'none' && !x.gray).length >= 4, BOT);
let gx = mk('home');
let c1 = G.care; OC.grayDispo(gx.id, 'obs');
assert(Math.round(G.care - c1) === -6 && G.stats.gray.over === 1, 'too cautious with a low-risk score costs points');
gx = mk('obs'); OC.grayDispo(gx.id, 'home');
assert(G.stats.gray.under === 1 && gx.grayUnder, 'too bold: no points lost now, but a higher chance they come back');
G.obsUnit.filled = G.obsUnit.cap;
gx = mk('obs'); OC.grayDispo(gx.id, 'obs');
assert(gx.dsp === 'board' && gx.obsWait && gx.dispo === 'obs', 'obs unit full: they wait for an obs bed');
assert(!OC.escalate(gx.id).ok, 'the House Supervisor cannot push an obs bed');
G.obsUnit.nextOut = G.t; run(1.2);
assert(!gx.obsWait && gx.due < 1e9, 'an obs discharge frees a bed for them');

// 8. Full-capacity protocol
G = fresh(509, 'hard');
for (const p of OC.inRooms()) if (p.dsp === 'board') p.due = 1e9;
assert(!OC.fullCapacity().ok, 'not available when the ED is not full');
run(120);
const fl = OC.inRooms().filter(p => p.dsp === 'board' && p.dispo === 'admit').length;
if (OC.waitingCount() >= 6 || OC.active().filter(p => p.loc === 'wall').length >= 2) {
  const r = OC.fullCapacity();
  assert(r.ok, 'full-capacity protocol runs when the ED is packed: ' + (r.msg || r.why));
  run(0.5);
  assert(OC.inRooms().filter(p => p.fcp && (p.dsp === 'callrep' || p.dsp === 'reporting')).length === Math.min(4, fl), 'up to 4 admitted patients head for inpatient hallways');
  assert(!OC.fullCapacity().ok, 'then it waits 4 hours');
} else console.log('skip - the ED never filled up this seed');

// 9. Intubation needs an attending and an RT; the vent waits for the tube
G = fresh(510);
let ip = null;
run(240, () => (ip = OC.inRooms().find(p => p.ev === 'none' && p.esi >= 2 && !p.alertOn && !p.prov && !p.arrest)), NOPROV);
assert(ip, 'a patient is waiting for a provider');
if (ip) {
  ip.tr = ['intub', 'vent']; ip.esi = 2;
  const cpa = OC.canAssign(OC.staff('pa1'), ip);
  assert(!cpa.ok && /attending/.test(cpa.why), 'a PA cannot take a patient who needs intubating: ' + cpa.why);
  assert(OC.assign('md1', ip.id).ok, 'attending assigned');
  run(60, () => ip.treat.intub && ip.treat.intub.st === 'doing');
  assert(ip.treat.vent && ip.treat.vent.st === 'wait', 'the vent waits for the tube');
  assert(G.staff.some(s => s.role === 'rt' && s.task && s.task.kind === 'airway' && s.task.pid === ip.id) || G.stats.intubNoRT === 1, 'an RT is at the head of the bed');
  run(40, () => ip.treat.vent.st === 'done');
  assert(ip.treat.intub.st === 'done' && ip.treat.vent.st === 'done', 'tube, then vent');
}
assert(OC.weight({ esi: 1, dsp: 'none', loc: 'room', tRoom: G.t - 5 }) === 6 && OC.weight({ esi: 1, dsp: 'none', loc: 'room', tRoom: G.t - 60 }) === 4, 'an active resuscitation takes a nurse and a half');

// 10. APPs see ESI 2 with an attending co-sign
G = fresh(511);
let e2 = null;
run(400, () => (e2 = OC.inRooms().find(p => p.esi === 2 && p.ev === 'none' && !p.prov && !p.alertOn && !p.tr.some(k => OC.TREAT[k].md))), NOPROV);
assert(e2, 'an ESI 2 patient needs a provider');
if (e2) {
  assert(OC.canAssign(OC.staff('pa1'), e2).ok, 'a PA can take an ESI 2');
  OC.assign('pa1', e2.id);
  run(60, () => e2.ev === 'done');
  assert(e2.cosign === 'need' && G.staff.some(s => s.role === 'md' && s.q.some(k => k.type === 'cosign' && k.pid === e2.id)), 'an attending gets a co-sign');
  run(30, () => e2.cosign === 'done');
  assert(e2.cosign === 'done' && G.stats.cosign >= 1, 'co-signed');
}

// 11. The region
G = fresh(512);
for (const h of G.region.hosps.slice(0, 2)) { h.st = 'yellow'; h.hold = G.t + 200; }
assert(OC.setDivert('yellow', true).ok, 'Yellow Alert on');
run(1.2);
assert(!G.dv.yellow.on && G.region.susp > G.t && G.stats.suspended === 1, 'three hospitals on alert: the region suspends them all');
const sy = OC.setDivert('yellow', true);
assert(!sy.ok && /region/.test(sy.why), 'no Yellow Alert during the suspension: ' + sy.why);

// 12. Updates and patient experience
G = fresh(513);
run(60);
const wr = OC.active().filter(p => p.loc === 'triage' || p.loc === 'waiting');
if (wr.length) {
  const pat0 = wr.map(p => p.patience);
  assert(OC.updateWaiting().ok && wr.every((p, i) => p.patience === pat0[i] + 20), 'walking the waiting room buys about 20 minutes of patience');
  assert(!OC.updateWaiting().ok, 'once every 30 minutes');
}
const rp = OC.inRooms()[0];
rp.px = 60; rp.lastUpdate = null;
assert(OC.updatePt(rp.id).ok && rp.px === 68, 'an update lifts their experience');
assert(!OC.updatePt(rp.id).ok, 'not again for 30 minutes');
rp.lastUpdate = G.t - 70; const px0 = rp.px; run(10);
assert(rp.px < px0, 'an hour without an update starts to cost you');

// 13. Pile patients on one provider and they start missing things
let missed = 0, piled = 0;
for (const sd of [701, 702, 703, 704]) {
  G = fresh(sd);
  run(300, () => OC.inRooms().filter(p => p.ev === 'none' && !p.prov && !p.arrest && OC.vEsi(p) >= 3).length >= 10, NOPROV);
  const pile = OC.inRooms().filter(p => p.ev === 'none' && !p.prov && !p.arrest && OC.vEsi(p) >= 3);
  for (const p of pile) if (OC.assign('pa1', p.id).ok) piled++;
  run(150, () => pile.every(p => p.ev === 'done' || p.loc === 'gone'));
  missed += G.stats.missedDx;
}
assert(missed > 0, `one PA with a line of ${Math.round(piled / 4)} misses things (${missed} missed diagnoses in 4 tries)`);

// 14. A whole hard shift: door to balloon, M&M, ED metrics, staffing hours
let cath = 0, d2b = 0, R = null;
for (const sd of [601, 602, 603]) {
  OC.newGame('hard', sd); let since = 0;
  while (!OC.G.over) { OC.step(0.1); since += 0.1; if (OC.G.card) OC.botStep({ budget: 0 }); if (since >= 1) { since = 0; OC.botStep({ budget: 1, acc: 0.7 }); } }
  R = OC.G.report;
  for (const id of OC.G.order) { const p = OC.G.pts[id]; if (p.outcome === 'cath') { cath++; if (typeof p.goals.d2b90 === 'boolean') d2b++; } }
}
assert(OC.ALERTS.stemi.goals.includes('d2b90') && OC.GOALS.d2b90.lim === 90, 'the STEMI goal is door to balloon under 90 minutes');
if (cath) assert(d2b === cath, `every STEMI that reached the cath lab was scored on door to balloon (${d2b} of ${cath})`);
assert(R.mm.length > 0 && R.mm.length <= 3 && R.mm.every(x => x.what && x.why) && R.mm.every((x, i) => i === 0 || R.mm[i - 1].sev >= x.sev), 'M&M lists the worst moments, worst first, each with the reason');
assert(['d2p', 'd2t', 'losDc', 'losAdm', 'board', 'lwbsPct', 'amaPct', 'admitPct', 'retPct', 'capHours'].every(k => k in R.m), 'the report has the ED metrics');
assert(R.staffH.rn > 60 && R.staffH.md > 20 && R.staffH.rnPerVisit > 0, `staffing hours: ${R.staffH.rn} RN, ${R.staffH.md} attending, ${R.staffH.rnPerVisit} RN hours per patient`);
assert(R.px >= 0 && R.px <= 100, `patient experience ${R.px}%`);
JSON.stringify(OC.G);
