// v0.2 systems: provider in triage, MTP and shock, pharmacy gating and override, interpreters, divert, AMA, returns, packs, O-neg.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function fresh(seed, pack) { OC.newGame('med', seed, { pack }); clearCard(); return OC.G; }
function run(min, fn) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (fn && fn()) return true; } return false; }

// 1. 12-hour shift, 32 beds, swing staff
let G = fresh(11);
assert(G.shift === 720 && G.rooms.filter(r => r.kind !== 'chair').length === 32 && G.rooms.filter(r => r.kind === 'chair').length === 6, '12-hour shift with 32 beds and 6 results-pending chairs');
assert(OC.clock(0) === '07:00' && OC.clock(720) === '19:00', 'shift runs 07:00 to 19:00');
assert(G.staff.find(s => s.id === 'md3').st === 'pending', 'swing attending not here at 07:00');
run(245);
assert(G.staff.find(s => s.id === 'md3').st === 'on' && G.staff.find(s => s.id === 'pa2').st === 'on', 'swing attending and PA arrive at 11:00');

// 2. provider in triage
G = fresh(22);
const app = G.staff.find(s => s.role === 'app' && s.st === 'on');
app.q = [];
assert(OC.setPit(app.id, true).ok && app.pit, 'APP stationed in triage');
assert(!OC.canAssign(app, OC.inRooms()[0] || { loc: 'room', esi: 3 }).ok, 'PIT provider cannot be assigned roomed patients');
const intakeAll = () => { if (!OC.G.staff.some(s => s.pit && s.st === 'on')) { const a = OC.G.staff.find(s => s.role === 'app' && s.st === 'on'); if (a) { a.q = []; OC.setPit(a.id, true); } } for (const p of OC.active()) { if ((p.loc === 'triage' || p.loc === 'wall') && p.reg === 'none') OC.register(p.id, 'reg1'); if (p.loc === 'triage' && p.tri === 'none') OC.triage(p.id, 'rnT'); } };
const before = G.stats.pitSeen;
run(90, () => { intakeAll(); return G.stats.pitSeen > before + 2; });
assert(G.stats.pitSeen > before, `PIT saw waiting patients (${G.stats.pitSeen - before})`);
const seen = OC.active().find(p => p.pitSeen && p.loc === 'waiting' && p.wk.length);
if (seen) assert(Object.keys(seen.work).length > 0, 'PIT started the workup from the waiting room');
run(180, () => { intakeAll(); return G.stats.pitDc > 0; });
assert(G.stats.pitDc > 0, `PIT discharged simple patients straight from triage (${G.stats.pitDc})`);

// 3. MTP: no activation -> shock -> traumatic arrest; activation -> cooler -> transfusion
G = fresh(33);
const mvcCase = OC.CASES.find(c => c.k === 'mvc');
function makeMvc() {
  G.box.q = []; G.box.cur = null;
  const pfx = Object.keys(G.pts).length;
  // spawn by hand through the engine's own alert path: push a notify and fast-forward its arrival
  const p = Object.values(G.pts)[0];
  return p;
}
void makeMvc;
let mvc = null;
run(720, () => (mvc = OC.active().find(p => p.bleed === 'mtp')));
assert(mvc, 'a hemorrhaging trauma patient arrived');
if (mvc) {
  run(16);
  assert(mvc.shock, 'no MTP after 15 min: hemorrhagic shock');
  run(16);
  assert(mvc.arrest || mvc.loc === 'gone', 'no MTP after 30 min: traumatic arrest');
}
G = fresh(34);
let mvc2 = null;
run(720, () => (mvc2 = OC.active().find(p => p.bleed === 'mtp')));
if (mvc2) {
  const r = OC.activateMTP(mvc2.id);
  assert(r.ok, 'MTP activated: ' + r.msg);
  run(40, () => mvc2.bb && mvc2.bb.st === 'here');
  assert(mvc2.bb.st === 'here', 'cooler reached the bedside');
  assert(!mvc2.shock && !mvc2.arrest, 'no shock or arrest once MTP was on time');
  const wasted = OC.activateMTP(OC.inRooms().find(p => !p.bleed) ? OC.inRooms().find(p => !p.bleed).id : mvc2.id);
  assert(!wasted.ok, 'MTP for a non-bleeding patient is refused and wastes O-neg: ' + wasted.why);
}

// 4. pharmacy gating and override
G = fresh(44);
let rxp = null;
run(300, () => { OC.botStep({ budget: 2 }); return (rxp = OC.inRooms().find(p => Object.keys(p.treat).some(k => p.treat[k].st === 'verify'))); });
assert(rxp, 'an order is waiting on pharmacist verification');
for (const s of G.staff) if (s.role === 'rph') { s.st = 'away'; s.until = 1e9; s.task = null; }
const k = Object.keys(rxp.treat).find(x => rxp.treat[x].st === 'verify');
run(20);
assert(rxp.treat[k].st === 'verify', 'with no pharmacist the order stays unverified');
const ov = OC.overrideRx(rxp.id);
assert(ov.ok && rxp.treat[k].st !== 'verify', 'override releases the med: ' + ov.msg);

// 5. interpreters slow care until connected
G = fresh(55);
let lep = null;
run(400, () => { OC.botStep({ budget: 2, interp: 0 }); return (lep = OC.active().find(p => p.lang && p.interp === 'none' && p.loc !== 'gone')); });
assert(lep, 'a patient who needs an interpreter arrived (' + (lep && OC.LANGS[lep.lang]) + ')');
if (lep) {
  const r = OC.requestInterp(lep.id);
  assert(r.ok && lep.interp === 'req', 'interpreter requested: ' + r.msg);
  run(30, () => lep.interp === 'on' || lep.loc === 'gone');
  assert(lep.interp === 'on' || lep.loc === 'gone', 'interpreter connected');
}

// 6. divert lowers ambulance arrivals
function emsCount(on) {
  OC.newGame('hard', 909); clearCard();
  if (on) { OC.setDivert('yellow', true); OC.setDivert('red', true); }
  const s0 = OC.G.stats.arrived;
  for (let i = 0; i < 6000; i++) { clearCard(); OC.G.mods.noDivert = -1e9; OC.G.region.susp = -1e9; if (on) { OC.G.dv.yellow.on = true; OC.G.dv.red.on = true; } OC.step(0.1); }
  return OC.G.stats.diverted;
}
assert(emsCount(true) > 3, 'Yellow and Red Alert divert ambulances');

// 7. AMA leaves and bounces back
G = fresh(77);
let amaP = null;
run(200, () => { OC.botStep({ budget: 2 }); return (amaP = OC.inRooms().find(p => p.esi >= 3 && !p.alertOn)); });
if (amaP) {
  G.card = { eid: 'ama', title: '', who: '', text: '', choices: [{ k: 'sign', label: '' }], ctx: { pid: amaP.id } };
  OC.chooseCard('sign');
  assert(amaP.loc === 'gone' && amaP.outcome === 'ama', 'patient signed out AMA');
  assert(G.stats.ama === 1, 'AMA counted');
}
let returned = 0;
for (let seed = 1; seed <= 6 && !returned; seed++) { OC.newGame('med', seed * 31); let n = 0; while (!OC.G.over && n++ < 8000) { clearCard(); OC.step(0.1); if (n % 10 === 0) OC.botStep({ budget: 2 }); } returned += OC.G.stats.returns; }
assert(returned > 0, `72-hour returns come back during the shift (${returned})`);

// 8. protocol packs
G = fresh(88, 'miemss');
assert(G.pack === 'miemss', 'MIEMSS pack selected');
run(200, () => G.box.cur && G.box.cur.kind === 'consult');
if (G.box.cur && G.box.cur.kind === 'consult') { const md = G.staff.find(s => s.role === 'md' && s.st === 'on'); const t = OC.boxTake(md.id); assert(/\d\.\d|2026|Protocol|Refusal|Chest Pain|Stroke|Croup|Sepsis|Agitation|Withdrawal|Angioedema|Hypoglycemia|Tachycardia|ROSC|CHF|Freestanding|Pain/.test(t.sc.why), 'MIEMSS consult cites its protocol: ' + t.sc.why.slice(0, 60)); OC.boxDecide(true); }
G = fresh(89);
assert(G.pack === 'national', 'general pack is the default');

// 9. emergency-release O-neg
let bleeder = null;
for (const sd of [99, 101, 103, 107, 109]) {
  G = fresh(sd);
  run(720, () => { OC.botStep({ budget: 2 }); return (bleeder = OC.inRooms().find(p => p.bleed === 'prbc' && (!p.bb || p.bb.st === 'xm'))); });
  if (bleeder) break;
}
if (bleeder) {
  G.blood.oneg = 10;
  const o0 = G.blood.oneg, r = OC.releaseONeg(bleeder.id);
  assert(r.ok && G.blood.oneg === o0 - 2, 'emergency release uses 2 units of O-negative');
  run(6);
  assert(bleeder.bb.st === 'ready' || bleeder.loc === 'gone', 'released blood is ready in about 5 minutes');
} else console.log('skip - no PRBC patient this seed');

// 10. intake: EMS waits to give report; registration and triage come before a bed
G = fresh(1010);
let ems = null;
run(400, () => (ems = OC.active().find(p => p.loc === 'wall' && !p.alertOn && p.esi >= 3 && p.reg === 'none')));
assert(ems, 'a non-critical EMS patient is on the wall');
if (ems) {
  const clean = G.rooms.find(r => r.kind === 'main' && !r.pid && r.st === 'clean' && OC.canPlace(Object.assign({}, ems, { reg: 'done', tri: 'done' }), r).ok);
  let r = OC.place(ems.id, clean.id);
  assert(!r.ok && /Register/.test(r.why), 'cannot bed an unregistered EMS patient: ' + r.why);
  assert(OC.register(ems.id, 'reg1').ok, 'registrar directed');
  assert(OC.triage(ems.id, 'rnT').ok, 'triage nurse directed to take report');
  r = OC.place(ems.id, clean.id);
  assert(!r.ok, 'still no bed while intake is in progress: ' + r.why);
  const t0 = G.t;
  run(30, () => ems.tri === 'done');
  assert(ems.reg === 'quick' && ems.tri === 'done' && ems.loc === 'wall', `quick-registered, then report and triage done in ${Math.round(G.t - t0)} min; crew still on the wall`);
  const w = OC.toWaiting(ems.id);
  if (ems.esi >= 3) assert(w.ok && ems.loc === 'waiting' && ems.tWall > 0, `EMS ESI ${ems.esi} handed off to the waiting room after ${Math.round(ems.tWall)} min on the wall`);
}
let walk = null;
run(300, () => (walk = OC.active().find(p => p.loc === 'triage' && p.reg === 'none' && p.esi >= 3)));
if (walk) {
  OC.register(walk.id, 'reg2'); OC.triage(walk.id, 'rnT');
  run(30, () => walk.loc !== 'triage');
  assert(walk.loc === 'waiting' && walk.tri === 'done', 'walk-in goes to the waiting room after directed triage');
}
// nothing happens without direction
let idle = null;
run(300, () => (idle = OC.active().find(p => p.loc === 'triage' && p.reg === 'none')));
if (idle) { run(10); assert(idle.reg === 'none' && idle.tri === 'none', 'without direction, nobody registers or triages a walk-in'); }

// 11. critical patients skip intake but must be registered before they leave
G = fresh(1111);
let alertP = null;
run(720, () => { if (G.box.cur && G.box.cur.kind === 'notify') OC.boxNotify(); return (alertP = OC.active().find(p => p.loc === 'wall' && p.alertOn && p.esi === 1 && !p.arrest)); });
if (alertP) {
  const bay = G.rooms.find(r => r.kind === 'resus' && !r.pid && r.st === 'clean');
  if (bay) {
    const r = OC.place(alertP.id, bay.id);
    assert(r.ok && alertP.tri === 'done' && alertP.reg !== 'done', 'alert goes straight to resus; triaged at the bedside, not yet registered');
  }
} else console.log('skip - no ESI 1 alert');

// 12. admitted patients wait for a transporter; transfers wait for an interfacility ambulance
G = fresh(1212);
let up = null;
run(720, () => { OC.botStep({ budget: 3, up: false, ift: false }); return (up = OC.inRooms().find(p => p.dsp === 'bedready')); });
assert(up, 'an admitted patient has a bed ready upstairs');
if (up) {
  run(30);
  assert(up.dsp === 'bedready' && up.loc === 'room', 'nobody takes them up without direction (30 min later)');
  const tp = G.staff.find(s => s.role === 'tp' && s.st === 'on');
  const z = OC.room(up.room).z, icu = up.dispo === 'icu';
  const r = OC.sendUp(up.id, tp.id);
  assert(r.ok && up.dsp === 'xportq', 'transporter sent: ' + r.msg);
  run(5);
  assert(up.loc === 'gone' && tp.task && tp.task.kind === 'trip', 'transporter arrived and took them up');
  if (icu) assert(G.staff.some(s => s.escortUntil > G.t && s.zones.includes(z)), 'ICU patient took their nurse along');
}
let tx = null;
for (let seed = 1; seed < 40 && !tx; seed++) {
  OC.newGame('hard', seed * 7); clearCard(); G = OC.G;
  run(720, () => { OC.botStep({ budget: 3, ift: false }); return (tx = OC.inRooms().find(p => p.dsp === 'txok' && p.needCC)); });
}
assert(tx, 'a critical patient was accepted for transfer');
if (tx) {
  const r1 = OC.bookIFT(tx.id, 'als');
  assert(r1.ok && tx.dsp === 'iftwait', 'ALS ambulance booked: ' + r1.msg);
  run(55, () => tx.dsp !== 'iftwait');
  assert(tx.dsp === 'txok' && G.stats.iftRefused === 1, 'ALS crew refused an ICU-level patient; book again');
  const r2 = OC.bookIFT(tx.id, 'cct');
  assert(r2.ok, 'critical care transport booked');
  run(95, () => tx.loc === 'gone');
  assert(tx.loc === 'gone' && tx.outcome === 'tx', 'patient held the room until the critical care crew arrived and took report');
}

// 13. outages and the matching diversion
const forceAlerts = (mins, fn) => { for (let i = 0; i < mins * 10; i++) { clearCard(); OC.G.nextArr.alert = Math.min(OC.G.nextArr.alert, OC.G.t + 2); OC.step(0.1); if (fn && fn()) return true; } return false; };
G = fresh(1313);
OC.startOutage('ct'); G.out.ct.until = 1e9;
assert(OC.outActive('ct') && G.img.ct.down > G.t, 'CT outage takes the scanner down');
const miss0 = G.stats.outMiss, care0 = G.care;
forceAlerts(300, () => G.stats.outMiss > miss0);
assert(G.stats.outMiss > miss0 && G.care < care0, 'a stroke or head-injury alert came in with CT down and no CT Divert: penalty');
const r13 = OC.setDivert('ct', true);
assert(r13.ok && G.dv.ct.on, 'CT Divert on: ' + r13.msg);
const before13 = G.order.length, div13 = G.stats.diverted;
forceAlerts(240);
const ctHits = G.order.slice(before13).map(OC.pt).filter(p => p.alert === 'stroke' || (p.alert === 'trauma' && p.wk.includes('ct'))).length;
assert(G.stats.diverted > div13 && ctHits <= 4, `on CT Divert, stroke and head-injury alerts go elsewhere (${G.stats.diverted - div13} diverted, ${ctHits} came anyway)`);
G.out.ct.until = G.t;
run(2);
assert(!OC.outActive('ct') && !OC.justified('ct'), 'scanner fixed: CT Divert is no longer justified');
const extra0 = G.stats.divertExtra;
run(12);
assert(G.stats.divertExtra > extra0, `staying on CT Divert after the fix costs extra (${G.stats.divertExtra - extra0} min)`);
OC.setDivert('ct', false);

G = fresh(1414);
const right0 = G.stats.outRight;
OC.startOutage('cath');
run(3);
OC.setDivert('stemi', true);
assert(G.stats.outRight === right0 + 1 && G.stats.outLog[0].divertAt != null, 'STEMI Divert within minutes of the cath lab going down: credited');
G = fresh(1515);
OC.startOutage('cath'); G.out.cath.until = 1e9;
let stemiTx = null;
forceAlerts(600, () => { OC.botStep({ budget: 3, divert: false }); return (stemiTx = OC.active().find(p => p.alert === 'stemi' && p.dispo === 'transfer')); });
assert(stemiTx && stemiTx.txTo === 'another PCI center', 'with the cath lab down, a STEMI that came anyway has to be transferred');

G = fresh(1616);
let labP = null;
run(300, () => { OC.botStep({ budget: 3 }); return (labP = OC.active().find(p => p.work.lab && p.work.lab.st === 'run')); });
if (labP) {
  OC.startOutage('lab'); G.out.lab.until = G.t + 40;
  run(30);
  assert(labP.loc === 'gone' || labP.work.lab.st === 'run', 'with the lab down, results do not come back');
  run(15);
  assert(labP.loc === 'gone' || labP.work.lab.st === 'done', 'once the lab is fixed, results come back');
}
