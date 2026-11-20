// v0.26–v0.27: beds upstairs, transfers (hospitals, acceptance, transport levels, report), help calls, weather,
// admit by phone, a second consult, bedside tests, and screening at the door.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function run(min, fn) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (fn && fn()) return true; } return false; }
const P = x => (typeof x === 'string' ? OC.pt(x) : x);
const roomFree = () => OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso).id;

// 1. Beds upstairs
OC.newGame('easy', 801, { mode: 'rn' }); let G = OC.G;
assert(G.beds && Object.keys(OC.UNITS).every(k => G.beds[k].used <= OC.UNITS[k].cap), 'every unit upstairs starts at or under its capacity');
for (const k in G.beds) { G.beds[k].used = OC.UNITS[k].cap; G.beds[k].next = 1e9; }
let p = P(OC.trainPatient('dka', 'room', { room: roomFree() })); p.dispo = 'icu'; p.dsp = 'none'; OC.setDispo(p);
assert(p.dsp === 'board' && p.bedU === 'icu' && !p.bedGot && p.due > 1e8, 'an ICU admission with the ICU full waits for a bed');
let r = OC.txInstead(p.id);
assert(r.ok && p.dsp === 'readytx' && OC.txNeedOf(p) === 'icu' && p.needCC, 'no ICU bed: they can be transferred to a hospital with one');
const q = P(OC.trainPatient('pna', 'room', { room: roomFree() })); q.dispo = 'admit'; q.dsp = 'none'; OC.setDispo(q);
assert(!OC.txInstead(q.id).ok, 'a med-surg patient waits for a med-surg bed: those turn over fast');
G.beds.med.used = OC.UNITS.med.cap - 1; run(1.2);
assert(q.bedGot && q.due < 1e8, 'when a bed is free, the next ED patient for that unit gets it');

// 2. Transfers: call a hospital that can't do it, then one that can; pick the transport; give report
r = OC.callHosp(p.id, 'lake');
assert(r.ok && p.dsp === 'txcall', 'calling a hospital starts the call');
run(15, () => p.dsp !== 'txcall');
assert(p.dsp === 'readytx' && (p.txNo || []).includes('lake'), 'a psych hospital says no to an ICU patient');
assert(!OC.callHosp(p.id, 'lake').ok, 'a hospital that said no is not called again');
OC.G.hosp.valley.full = -1e9; p.txYes = null;
r = OC.callHosp(p.id, 'valley'); p.txYes = 'yes'; run(15, () => p.dsp !== 'txcall');
assert(p.dsp === 'txok' && /Valley/.test(p.txTo), 'a hospital with an ICU bed accepts');
assert(!OC.bookIFT(p.id, 'air').ok, 'no helipad at the receiving hospital: no flight');
r = OC.bookIFT(p.id, 'als');
assert(r.ok && p.iftMiss, 'ALS booked for an ICU patient: the crew will refuse');
run(60, () => p.dsp !== 'iftwait');
assert(p.dsp === 'txok' && G.stats.iftRefused >= 1, 'the ALS crew refuses at the bedside; book again');
for (const k of p.tr) p.treat[k] = { st: 'done' };
r = OC.bookIFT(p.id, 'cct'); run(90, () => p.dsp === 'iftreport');
assert(p.dsp === 'iftreport', 'critical care ground arrives and takes report');
run(3);
assert(p.iftRep != null, 'for the charge nurse, the provider gives report on their own');
run(10, () => p.loc === 'gone');
assert(p.loc === 'gone' && p.outcome === 'tx', 'packaged and gone');

// 3. The attending gives report; transport levels cost or score
OC.newGame('easy', 802, { mode: 'md' }); G = OC.G;
const s = P(OC.trainPatient('lvo', 'room', { room: roomFree(), prov: 'md1' })); s.mine = true; s.prov = 'md1'; s.dsp = 'readytx'; s.dispo = 'transfer'; s.mdPick = 'transfer'; s.tr = []; s.treat = {};
assert(OC.txNeedOf(s) === 'stroke' && OC.txFast(s) && OC.iftNeed(s) === 3, 'a big-vessel stroke needs clot removal, fast, with a critical care crew');
OC.callHosp(s.id, 'univ'); s.txYes = 'yes'; run(15, () => s.dsp !== 'txcall');
const c0 = G.care; G.mods.airWx = -1e9; G.wxAir = []; r = OC.bookIFT(s.id, 'air');
assert(r.ok && G.care > c0, 'a flight for a time-critical stroke 48 min away by ground scores');
s.airAbort = false; run(40, () => s.dsp === 'iftreport'); run(4);
assert(s.dsp === 'iftreport' && s.iftRep == null, 'the flight crew waits for the attending’s report');
r = OC.giveReport(s.id);
assert(r.ok && s.iftRep != null, 'the attending gives report');
const lo = P(OC.trainPatient('lvo', 'room', { room: roomFree() })); lo.dsp = 'txok'; lo.ck = 'ankle'; lo.needCC = false; lo.txNeed = 'pci';
const c1 = G.care; OC.bookIFT(lo.id, 'cct');
assert(G.care <= c1, 'more crew than a patient needs does not score');

// 4. Weather
OC.newGame('easy', 803, { mode: 'rn', wx: 'fog' }); G = OC.G;
assert(G.wx === 'fog' && OC.wxGrounded(), 'fog grounds the helicopters in the morning');
OC.newGame('easy', 803, { mode: 'rn', wx: 'storm' });
assert(OC.G.wxAir.length === 2, 'storms ground the helicopters twice in a shift');
OC.newGame('easy', 803, { mode: 'rn', wx: 'nonsense' });
assert(OC.G.wx === 'clear', 'an unknown weather plays clear');

// 5. Help from upstairs
OC.newGame('easy', 804, { mode: 'rn' }); G = OC.G;
const b = P(OC.trainPatient('burn', 'room', { room: 'R1' }));
assert(b.hardAirway, 'a burn to the airway is a hard airway');
r = OC.helpCall(b.id, 'anes');
assert(r.ok && b.help.st === 'req', 'anesthesia is paged');
run(15, () => b.help.st === 'here');
assert(OC.helpHere(b, 'anes'), 'anesthesia arrives at the bedside');
const ank = P(OC.trainPatient('ankle', 'room', { room: roomFree() })), c2 = G.care;
OC.helpCall(ank.id, 'icu');
assert(G.care < c2, 'calling critical care for a sprained ankle costs points');

// 6. Admit by phone
OC.newGame('easy', 805, { mode: 'rn' }); G = OC.G;
const pn = P(OC.trainPatient('pna', 'room', { room: roomFree() })); pn.ev = 'done'; pn.dxK = true; for (const k of pn.wk) pn.work[k] = { st: 'done', tDone: G.t };
r = OC.consult(pn.id, 'hosp', { phone: true });
assert(r.ok && pn.consult.phone && pn.consult.due - G.t <= 6, 'a medical admission can be admitted by phone in minutes');
run(8);
assert(pn.consult.st === 'here' && pn.consult.tVisit < 0, 'the hospitalist accepts without coming down');
const ap = P(OC.trainPatient('appy', 'room', { room: roomFree() })); ap.ev = 'done'; ap.dxK = true; for (const k of ap.wk) ap.work[k] = { st: 'done', tDone: G.t };
r = OC.consult(ap.id, 'hosp', { phone: true });
assert(!r.ok && /Surgery/.test(r.why), 'a surgical problem cannot be admitted by phone to the hospitalist');

// 7. A second consult
const hx = P(OC.trainPatient('hipfx', 'room', { room: roomFree() })); hx.con2 = 'hosp'; hx.ev = 'done'; hx.dxK = true; for (const k of hx.wk) hx.work[k] = { st: 'done', tDone: G.t };
r = OC.consult(hx.id, 'ortho'); run(30, () => hx.consult.st === 'here');
assert(OC.con2Open(hx), 'orthopedics is on board; a second service is needed');
for (const k of hx.tr) hx.treat[k] = { st: 'done' }; run(3);
assert(hx.dsp === 'none', 'they don’t go upstairs before the second service sees them');
assert(!OC.consult(hx.id, 'cards').ok, 'the wrong second service says no');
r = OC.consult(hx.id, 'hosp'); run(25, () => hx.consult2.st === 'here'); run(1);
assert(r.ok && hx.consult2.st === 'here' && hx.dsp !== 'none', 'with the hospitalist co-managing, the admission goes ahead');

// 8. Bedside tests
OC.newGame('easy', 806, { mode: 'md' }); G = OC.G;
assert(OC.LABS.gluc && OC.LABS.gluc.poc && OC.LABS.udip.poc, 'a fingerstick glucose and a urine dip are bedside tests');
const dk = P(OC.trainPatient('dka', 'room', { room: roomFree(), prov: 'md1' })); dk.mine = true; dk.prov = 'md1'; OC.awaitOrders(dk);
dk.ev = 'done'; dk.ord = 'need';
r = OC.signOrders(dk.id, ['gluc'].concat(OC.NEED.dka.n), []);
G.out = { lab: { t0: G.t, until: G.t + 60 } };
run(10, () => dk.work.poc && dk.work.poc.st === 'done');
assert(dk.work.poc && dk.work.poc.st === 'done', 'the bedside sugar reads in minutes, even with the lab down');

// 9. Screening at the door
OC.newGame('easy', 807, { mode: 'rn' }); G = OC.G;
const tb = P(OC.trainPatient('tb', 'walk'));
assert(tb.screen === 'pending', 'a patient with a contagious illness is unscreened at first');
run(14);
assert(tb.exposed && G.stats.exposed === 1, 'left unscreened in the waiting area too long, they expose others');
const fl = P(OC.trainPatient('flu', 'walk'));
OC.register(fl.id, G.staff.find(x => x.role === 'reg' && x.st === 'on').id); run(6, () => fl.screen === 'pos');
assert(fl.screen === 'pos' && fl.mask && !fl.exposed, 'quick registration screens them: mask on');
