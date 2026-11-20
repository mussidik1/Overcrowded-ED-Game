// v0.12: the clinical reviewer's list. Stroke pressure and last known well, the new orders, crashes that fit the diagnosis,
// the bleed nobody treats, a bus crash with tag colors, and the smaller corrections.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function run(min, fn, bot) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (bot) OC.botStep(bot); if (fn && fn()) return true; if (OC.G.over) return false; } return false; }
const BOT = { budget: 4 };
const ME = 'md1';
const bp = p => { const v = OC.vitalsOf(p); return `${v.sbp}/${v.dbp}`; };
const done = (p, k) => !!(p.treat[k] && p.treat[k].st === 'done');

// 1. A stroke over the limit, charge nurse mode: the provider orders pressure control, and the thrombolytic waits for it
OC.newGame('train', 31, {}); let G = OC.G;
const hi = OC.pt(OC.trainPatient('stroke', 'alert', { bpOver: true, eta: 2, name: 'Hi P.', age: 70 }));
assert(hi.tr[0] === 'bp' && hi.tr.includes('tnk') && hi.bp0[0] > 185, `a stroke that arrives over 185/110 needs pressure control before the thrombolytic (${hi.bp0.join('/')})`);
assert(hi.lkwT != null && hi.lkw === 50 && OC.clock(hi.lkwT) === OC.clock(G.t - 50), `last known well is on the record (${OC.clock(hi.lkwT)})`);
const rep = OC.boxNotify();
assert(rep.ok && /Last known well \d\d:\d\d/.test(rep.msg), 'the radio report gives last known well: ' + rep.msg);
let sawHeld = false, bpAtNeedle = null;
run(120, () => { if (hi.treat.tnk && hi.treat.tnk.st === 'wait' && hi.consult.st === 'here' && hi.work.ct && hi.work.ct.st === 'done' && !OC.bpOkForLytic(hi)) sawHeld = true; if (done(hi, 'tnk') && !bpAtNeedle) bpAtNeedle = OC.vitalsOf(hi); return done(hi, 'tnk'); }, BOT);
assert(done(hi, 'bp') && done(hi, 'tnk') && hi.treat.bp.tDone < hi.treat.tnk.tDone, 'pressure control goes in first, then the thrombolytic');
assert(bpAtNeedle && bpAtNeedle.sbp <= 185 && bpAtNeedle.dbp <= 110, `the thrombolytic went in under the limit (${bpAtNeedle && bpAtNeedle.sbp}/${bpAtNeedle && bpAtNeedle.dbp})`);
const after = OC.vitalsOf(hi, hi.treat.tnk.tDone + 45);
assert(after.sbp <= 180 && after.dbp <= 105, `and stays under 180/105 afterwards (${after.sbp}/${after.dbp})`);

// 2. A stroke under the limit: no pressure order, and the thrombolytic does not lower the pressure
OC.newGame('train', 32, {}); G = OC.G;
const lo = OC.pt(OC.trainPatient('stroke', 'ems', { age: 72 }));
assert(!lo.tr.includes('bp') && lo.bp0[0] <= 174 && lo.bp0[1] <= 96, `under the limit at the door: no pressure order (${lo.bp0.join('/')})`);
const b0 = OC.vitalsOf(lo, G.t + 10);
lo.treat = { tnk: { st: 'done', tDone: G.t + 20 } };
const b1 = OC.vitalsOf(lo, G.t + 90);
assert(Math.abs(b1.sbp - b0.sbp) <= 8 && b1.sbp <= 180, `the thrombolytic does not treat blood pressure (${b0.sbp}/${b0.dbp} before, ${b1.sbp}/${b1.dbp} ninety minutes on)`);
let overN = 0, n = 0, worst = [0, 0], worstUnder = [0, 0];
for (let i = 0; i < 400; i++) { const p = { id: 'p' + (5000 + i), alert: 'stroke', tr: ['tnk'] }; OC.strokeSetup(p); n++; if (p.tr[0] === 'bp') { overN++; worst = [Math.max(worst[0], p.bp0[0]), Math.max(worst[1], p.bp0[1])]; } else worstUnder = [Math.max(worstUnder[0], p.bp0[0]), Math.max(worstUnder[1], p.bp0[1])]; }
assert(overN > n * 0.3 && overN < n * 0.6 && worstUnder[0] <= 174 && worstUnder[1] <= 96, `arrival pressure varies around the limit: ${overN} of ${n} strokes come in over it (highest ${worst.join('/')}; highest under ${worstUnder.join('/')})`);

// 3. The attending orders the thrombolytic over the limit: held, and it costs points until the pressure is treated
OC.newGame('train', 33, { mode: 'md' }); G = OC.G;
const sp = OC.pt(OC.trainPatient('stroke', 'room', { room: 'R1', bpOver: true, age: 68 }));
sp.alertOn = true; sp.dxK = true; sp.pren = true;
assert(OC.consult(sp.id, 'neuro').ok, 'the stroke team is called');
OC.assign(ME, sp.id); run(40, () => sp.ord === 'need');
let c0 = G.care;
let r = OC.signOrders(sp.id, ['ct', 'lab'], ['tnk']);
assert(r.ok && r.held && /holding the thrombolytic/.test(r.msg) && G.care - c0 === 2 + 1 + 3 - 8, `thrombolytic without pressure control, over the limit: the nurse holds it and it costs points (${G.care - c0}): ${r.msg}`);
run(60, () => sp.work.ct && sp.work.ct.st === 'done' && sp.consult.st === 'here');
run(10);
assert(sp.treat.tnk.st === 'wait' && !done(sp, 'tnk'), `CT read and neurology here, and the drug is still held at ${bp(sp)}`);
r = OC.signOrders(sp.id, [], ['bp']);
assert(r.ok && sp.tr.includes('bp'), 'pressure control ordered');
run(60, () => done(sp, 'tnk'));
assert(done(sp, 'bp') && done(sp, 'tnk') && OC.vitalsOf(sp, sp.treat.tnk.tDone).sbp <= 185, `then it goes in (${bp(sp)})`);
const su = OC.pt(OC.trainPatient('stroke', 'room', { room: 'R2', age: 66 }));
su.alertOn = true; su.dxK = true; OC.consult(su.id, 'neuro'); OC.assign(ME, su.id); run(40, () => su.ord === 'need');
c0 = G.care; r = OC.signOrders(su.id, ['ct', 'lab'], ['tnk', 'bp']);
assert(r.ok && !r.held && G.care - c0 === 2 + 1 + 3 - 3 && su.extraTr.includes('bp'), `pressure control for a stroke already under the limit is an extra order (${G.care - c0})`);

// 4. Oxygen, a vasopressor, pacing, and a reversal agent: each has a patient who needs it
OC.newGame('train', 34, { mode: 'md' }); G = OC.G;
const T = OC.TREAT, need = k => OC.CASES.filter(c => c.tr.includes(k)).map(c => c.k);
assert(['o2', 'bp', 'pressor', 'pace', 'reverse'].every(k => T[k]) && need('o2').includes('pna') && need('pressor').includes('shock') && need('pace').includes('chb') && need('reverse').includes('tfall'),
  `new orders: oxygen (${need('o2')}), vasopressor (${need('pressor')}), pacing (${need('pace')}), reversal (${need('reverse')})`);
const pn = OC.pt(OC.trainPatient('pna', 'room', { room: '1', age: 70 }));
OC.assign(ME, pn.id); run(40, () => pn.ord === 'need');
const s0 = OC.vitalsOf(pn);
assert(s0.spo2 < 94 && s0.flags.spo2 && !s0.o2, `the attending's pneumonia patient sits at a low sat until oxygen is ordered (${s0.text})`);
c0 = G.care; r = OC.signOrders(pn.id, ['lab', 'xr'], ['o2', 'abx']);
assert(r.ok && G.care - c0 === 2 + 2 + 3 + 3 + 10, `oxygen is one of the right orders (${G.care - c0})`);
run(30, () => done(pn, 'o2'));
const s1 = OC.vitalsOf(pn, pn.treat.o2.tDone + 5);
assert(done(pn, 'o2') && s1.spo2 >= 94 && s1.o2 && s1.signs.includes('on oxygen'), `on oxygen, the sat comes up (${s1.text})`);
const st = OC.pt(OC.trainPatient('strep', 'room', { room: '2', age: 20 }));
OC.assign(ME, st.id); run(40, () => st.ord === 'need');
c0 = G.care; OC.signOrders(st.id, ['lab'], ['meds', 'o2']);
assert(G.care - c0 === 1 + 3 - 3, `oxygen for a normal sat is an extra order (${G.care - c0})`);
const as = OC.pt(OC.trainPatient('asthma', 'room', { room: '3', age: 22 }));
OC.assign(ME, as.id); run(40, () => as.ord === 'need');
c0 = G.care; OC.signOrders(as.id, [], ['nebs', 'meds', 'o2']);
assert(G.care - c0 === 3 + 3 + 10 && !(as.extraTr || []).includes('o2'), `oxygen for a low sat is never wrong, even when the nebulizer will fix it (${G.care - c0})`);

OC.newGame('train', 35, {}); G = OC.G;
const sh = OC.pt(OC.trainPatient('shock', 'ems', { age: 70 }));
sh.treat = { o2: { st: 'done', tDone: G.t }, fluids: { st: 'done', tDone: G.t }, abx: { st: 'done', tDone: G.t } };
const f60 = OC.vitalsOf(sh, G.t + 60);
sh.treat.pressor = { st: 'done', tDone: G.t + 60 };
const p90 = OC.vitalsOf(sh, G.t + 90);
assert(f60.sbp <= 90 && f60.flags.bp && p90.sbp >= 95 && p90.sbp > f60.sbp + 8, `septic shock stays low on fluids alone and comes up on a vasopressor (${f60.sbp}/${f60.dbp} -> ${p90.sbp}/${p90.dbp})`);
const hb = OC.pt(OC.trainPatient('chb', 'ems', { age: 74 }));
const h0 = OC.vitalsOf(hb), h60 = OC.vitalsOf(hb, G.t + 60);
hb.treat = { pace: { st: 'done', tDone: G.t + 60 } };
const h70 = OC.vitalsOf(hb, G.t + 70);
assert(h0.hr < 45 && h0.flags.hr && h60.hr <= h0.hr && h70.hr >= 60 && h70.sbp > h0.sbp, `complete heart block: slow until it is paced (${h0.hr} -> ${h60.hr} untreated, ${h70.hr} paced)`);
const hbc = OC.CASES.find(c => c.k === 'chb');
assert(hbc.con === 'cards' && hbc.dispo === 'icu' && /heart block/.test(hbc.find.ecg), 'and it gets cardiology and a monitored bed, with the rhythm named');
const tf = OC.CASES.find(c => c.k === 'tfall');
assert(tf.tr.includes('reverse') && OC.TREAT.reverse.rx, 'a head bleed on a blood thinner gets a reversal agent, checked by pharmacy');

// 5. A crash looks like what is wrong, turns into the diagnosis it was, and never ends in a discharge
OC.newGame('med', 36, {}); G = OC.G;
const mkW = (k, age) => { const p = OC.pt(OC.trainPatient(k, 'waiting', { age, waited: 40 })); return p; };
const a = mkW('asthma', 24), an = mkW('anaph', 30), se = mkW('sepsisw', 80), gb = mkW('gib', 60), ns = mkW('nstemi', 66), kid = mkW('asthma', 7);
for (const p of [a, an, se, gb, ns, kid]) OC.crashNow(p.id);
const va = OC.vitalsOf(a), vn = OC.vitalsOf(an), vs = OC.vitalsOf(se), vg = OC.vitalsOf(gb), vc = OC.vitalsOf(ns), vk = OC.vitalsOf(kid);
assert(va.spo2 <= 86 && va.rr >= 32 && va.sbp >= 110 && /speak/.test(va.text), `asthma crashes as breathing failure, pressure intact (${va.text})`);
assert(vn.sbp <= 80 && vn.spo2 <= 90 && /stridor/.test(vn.text), `anaphylaxis crashes as shock with a closing airway (${vn.text})`);
assert(vs.sbp <= 84 && vs.temp >= 102.5 && vs.hr >= 125, `sepsis crashes hot, fast, and low (${vs.text})`);
assert(vg.sbp <= 82 && vg.hr >= 130 && vg.spo2 >= 94, `a bleed crashes pale and fast with a normal sat (${vg.text})`);
assert(vc.sbp <= 90 && vc.hr < 126, `a heart attack crashes into cardiogenic shock (${vc.text})`);
assert(vk.hr > va.hr + 8 && vk.rr > va.rr, `a child's crash is scaled to a child (${vk.text})`);
assert(a.dispo === 'icu' && an.dispo === 'admit' && a.con === 'icu' && /respiratory failure/.test(a.dx) && /shock/i.test(an.dx) && a.tr.includes('bipap') && an.tr.includes('o2') && se.tr.includes('pressor'),
  `the diagnosis and the plan change with the crash: "${a.dx}" to the ICU, "${an.dx}" admitted`);
assert([a, an, se, gb, ns].every(p => p.dispo !== 'home' && p.dispo !== 'obs' && p.esi === 1) && !OC.pitDcReady(a), 'nobody who crashed is sent home');
const gray = OC.CASES.filter(c => c.gray).map(c => c.k);
assert(gray.length === 6 && gray.every(k => !OC.CRASH[k]), `the six risk-score cases have no crash at all (${gray})`);
const sw = mkW('strokew', 70); sw.alertOn = false; OC.crashNow(sw.id);
assert(sw.bp0[0] > 185 && sw.tr[0] === 'bp' && OC.vitalsOf(sw).hr < 70, `a stroke that worsens: pressure up, heart rate down, and it now needs pressure control (${OC.vitalsOf(sw).text})`);

// 6. The ECG line agrees with the monitor
OC.newGame('train', 37, {}); G = OC.G;
const e1 = OC.pt(OC.trainPatient('cwp', 'room', { room: '1', age: 45 }));
run(30, () => e1.work.ecg && e1.work.ecg.st === 'done', BOT);
const hrNow = OC.vitalsOf(e1).hr;
assert(e1.work.ecg.st === 'done' && /rate \d+/.test(e1.find.ecg) && Math.abs(+/rate (\d+)/.exec(e1.find.ecg)[1] - hrNow) <= 6, `the ECG reads the rate on the monitor: "${e1.find.ecg}" at HR ${hrNow}`);
const e2 = OC.pt(OC.trainPatient('dehyd', 'room', { room: '2', age: 80 })); e2.find.ecg = 'Normal sinus rhythm'; e2.work.ecg = { st: 'todo', tOrd: G.t }; e2.wk.push('ecg');
run(30, () => e2.work.ecg.st === 'done', BOT);
assert(/^Sinus tachycardia, rate 1\d\d$/.test(e2.find.ecg), `a fast heart is not called normal sinus rhythm: "${e2.find.ecg}"`);

// 7. A bleed nobody treats goes into shock, then arrests. One that gets fluids does not.
OC.newGame('easy', 38, {}); G = OC.G;
const bl = OC.pt(OC.trainPatient('gib', 'ems', { age: 62, name: 'Bleed B.' }));
const ok2 = OC.pt(OC.trainPatient('gib', 'ems', { age: 58, name: 'Fluids F.' })); ok2.treat = { fluids: { st: 'done', tDone: G.t + 5 } };
run(74); const pre = OC.vitalsOf(bl);
assert(!bl.shock && bl.esi === 2 && pre.trend !== 'better', `74 minutes on the wall: sick, not yet in shock (${pre.text})`);
run(3);
assert(bl.shock && bl.esi === 1 && OC.emergent(bl) && OC.vitalsOf(bl).sbp <= 84, `at 75 minutes with nothing done: hemorrhagic shock, ESI 1, straight to resus (${OC.vitalsOf(bl).text})`);
assert(!ok2.shock && ok2.esi === 2, 'the one who got fluids is not in shock');
run(46);
assert(bl.arrest && bl.dx === 'Cardiac arrest' && !ok2.arrest, 'at two hours with nothing done, the bleed arrests');

// 8. The bus crash: a capacity question, then a red by radio, a yellow, and four greens, each with its tag
OC.newGame('med', 39, { scen: 'mci' }); G = OC.G;
let card = null;
for (let i = 0; i < 700 && !card; i++) { OC.step(0.1); if (G.card && G.card.eid === 'mci') card = G.card; else clearCard(); }
assert(card && /1 red tag, 1 yellow, and 4 greens/.test(card.text) && /Red is critical/.test(card.text) && card.choices.length === 3 && card.choices.some(c => c.k === 'green'), 'EMS asks what the hospital can take: ' + (card && card.text));
const t0 = G.t; OC.chooseCard('ok');
const tagged = () => G.order.map(OC.pt).filter(p => p.tag);
run(6, () => tagged().length >= 1);
const red = tagged()[0];
assert(red && red.tag === 'red' && red.loc === 'enroute' && red.alertOn && red.esi === 1 && red.bleed === 'mtp' && (G.box.cur || G.box.q.length), 'the red tag comes first, by radio, as a trauma alert');
run(12, () => tagged().length >= 6);
const tags = tagged().map(p => p.tag), yel = tagged().find(p => p.tag === 'yellow'), grn = tagged().filter(p => p.tag === 'green');
assert(tags.filter(x => x === 'red').length === 1 && tags.filter(x => x === 'yellow').length === 1 && grn.length === 4, `one red, one yellow, four greens (${tags})`);
assert(yel.esi === 2 && yel.loc === 'wall' && grn.every(p => p.esi >= 3 && p.dispo === 'home'), 'the yellow needs a bed soon; the greens are walking wounded');
OC.newGame('med', 40, { scen: 'mci' }); G = OC.G; card = null;
for (let i = 0; i < 700 && !card; i++) { OC.step(0.1); if (G.card && G.card.eid === 'mci') card = G.card; else clearCard(); }
c0 = G.care; OC.chooseCard('green'); run(16);
const tg2 = G.order.map(OC.pt).filter(p => p.tag).map(p => p.tag);
assert(tg2.length === 4 && tg2.every(x => x === 'green') && G.care < c0, `"Greens only" sends the red and the yellow elsewhere, and costs points (${tg2})`);

// 9. Smaller corrections
const copd = OC.CASES.find(c => c.k === 'copd');
assert(copd.esi === 1 && copd.anyRoom && copd.tr.includes('bipap'), 'a COPD flare that needs BiPAP is ESI 1 (emergent BiPAP), in any monitored room');
OC.newGame('train', 41, {}); G = OC.G;
const baby = OC.pt(OC.trainPatient('rsv', 'ems', { age: 0 })), tod = OC.pt(OC.trainPatient('otitis', 'walk', { age: 1 })), ch = OC.pt(OC.trainPatient('otitis', 'walk', { age: 5 })), ad = OC.pt(OC.trainPatient('pna', 'ems', { age: 72 }));
assert(/^\d+ mo [FM]$/.test(OC.ageSex(baby)) && /^(1[2-9]|2[0-3]) mo [FM]$/.test(OC.ageSex(tod)) && /^5 yo [FM]$/.test(OC.ageSex(ch)) && /^72[FM]$/.test(OC.ageSex(ad)), `ages read the way a chart does: ${OC.ageSex(baby)}, ${OC.ageSex(tod)}, ${OC.ageSex(ch)}, ${OC.ageSex(ad)}`);
const ch2 = OC.pt(OC.trainPatient('chole', 'ems', { age: 50 })), an2 = OC.pt(OC.trainPatient('ankle', 'walk', { age: 30 }));
assert(OC.npo(ch2) && !OC.npo(an2) && OC.npo(OC.pt(OC.trainPatient('stroke', 'ems', {}))), 'a patient waiting on surgery is not offered a food tray; a sprained ankle is');
const w = OC.pt(OC.trainPatient('hipfx', 'ems', { age: 82 }));
const tn = G.staff.find(s => s.role === 'rn' && s.zones.includes('triage'));
r = OC.triage(w.id, tn.id);
assert(r.ok && !/once registered/.test(r.msg), 'on the wall, the nurse takes report without waiting for registration: ' + r.msg);
run(8, () => w.tri === 'done');
assert(w.tri === 'done' && w.reg === 'none' && !OC.canPlace(w, OC.room('1')).ok, 'report is done first; registration is still needed before a bed');

// 12. Decision cards: key facts are marked for bold, patients carry a name tag, and no mark is left unpaired
OC.newGame('hard', 57, {}); G = OC.G;
run(150, null, BOT);
const seenCards = {};
const pairs = t => (t.match(/\*\*/g) || []).length % 2 === 0 && (t.match(/\[\[/g) || []).length === (t.match(/\]\]/g) || []).length && !/\*\*\s*\*\*|\[\[\s*\]\]/.test(t);
const grab = () => { if (G.card && !seenCards[G.card.eid]) seenCards[G.card.eid] = G.card.text; };
for (let i = 0; i < 2400 && !G.over; i++) {   // four hours of a hard shift: take every card the shift deals, and deal each one that is ready
  grab(); clearCard();
  if (i % 20 === 0) for (const k of OC.eventKeys()) if (!seenCards[k] && !G.card && OC.eventReady(k)) { OC.fireEvent(k); grab(); clearCard(); }
  OC.step(0.1); OC.botStep(BOT);
}
const texts = Object.values(seenCards);
assert(texts.length >= 8 && texts.every(pairs),   // how many cards a shift deals depends on the shift; eight is plenty to check the marks
  `every decision card's marks pair up (${texts.length} cards seen: ${Object.keys(seenCards).join(', ')})` + (texts.find(t => !pairs(t)) || ''));
assert(texts.filter(t => /\*\*.+?\*\*|\[\[.+?\]\]/.test(t)).length >= texts.length - 1, 'decision cards put their key facts in bold');
assert(['ama', 'agitated', 'patExp'].filter(k => seenCards[k]).every(k => /^\[\[[^\]]+\]\]/.test(seenCards[k])), 'a card about a patient opens with the name tag');

// ---- v0.15: exam findings, order reasons, plain results, plain radio calls, and what was missed ----
{
  const ks = OC.CASES.map(c => c.k);
  assert(ks.every(k => OC.EXAM[k] && OC.ORD_WHY[k]), 'every case has an exam finding and a reason for its orders');
  const finds = new Set(); OC.CASES.forEach(c => Object.values(c.find || {}).forEach(v => finds.add(v)));
  const bare = [...finds].filter(v => !OC.FIND_PLAIN[v]);
  assert(bare.every(v => /^(Normal|Clear lungs|Mild dehydration|Kidney function normal|Blood in urine, no infection)$/.test(v)), 'every result that is not already plain has plain words: ' + bare.join('; '));
  assert(Object.keys(OC.FIND_PLAIN).every(v => finds.has(v) || ['Normal sinus rhythm', 'No acute findings'].includes(v)), 'no plain line is left over for a result that no longer exists');
  for (const k of ['national', 'miemss']) assert(OC.SCEN[k].every(s => s.plain && s.pwhy && s.plain.split(' ').length <= 24 && s.pwhy.split(' ').length <= 18), `every ${k} radio call has a short plain line and a short plain reason`);
  OC.newGame('train', 77, { mode: 'md' });
  const x = OC.trainPatient('chole', 'room', { room: '5' }), p = typeof x === 'string' ? OC.pt(x) : x;
  OC.assign(OC.G.me, p.id); let n = 0; while (p.ord !== 'need' && n++ < 4000) OC.step(0.1);
  assert(p.ev === 'done' && OC.examOf(p) === OC.EXAM.chole, 'the exam finding belongs to the patient once examined');
  const r = OC.signOrders(p.id, ['lab', 'ct'], ['meds']);
  assert(r.ok && p.ordLog && p.ordLog.miss.join() === 'Gallbladder ultrasound' && p.ordLog.extra.join() === 'CT head' && p.ordLog.why === OC.ORD_WHY.chole, 'signing records what was missed and what was not needed: missed ' + p.ordLog.miss + ', extra ' + p.ordLog.extra);
  assert(OC.G.stats.md.log.length === 1 && OC.G.stats.md.log[0] === p.ordLog, 'and the shift keeps it for the report');
  n = 0; while (p.dsp !== 'mddecide' && n++ < 20000) { OC.step(0.1); if (p.ord === 'signed' && p.txGap && p.txGap.length) OC.signOrders(p.id, ['us'], []); if (p.wkGap || (p.gap && p.gap.length)) OC.signOrders(p.id, ['us'], []); }
  const w = OC.consult ? OC.consult(p.id, 'ortho') : null;
  if (w) assert(!w.ok && /Call General Surgery\./.test(w.why), 'the wrong consultant says who to call: ' + w.why);
}

// ---- v0.16: the clinical review fixes ----
{
  const C = k => OC.CASES.find(c => c.k === k);
  assert(!C('mvc').wk.includes('ct') && !C('mcired').wk.includes('ct') && /CT only if the pressure comes up/.test(OC.ORD_WHY.mvc), 'a bleeding trauma in shock is not scored for a CT');
  assert(/potassium 4\.8/.test(C('dka').find.lab) && /potassium/.test(OC.ORD_WHY.dka) && /potassium/.test(OC.FIND_PLAIN[C('dka').find.lab]), 'DKA shows the potassium and says insulin waits for it');
  assert(C('od').esi === 1 && C('chb').esi === 1 && C('burn').esi === 1 && C('bh').esi === 2 && C('mcimin').wk.join() === 'ct', 'triage levels and the neck CT follow the review');
  for (const k of ['national', 'miemss']) assert(OC.SCEN[k].every(s => /They (want|ask)|The crew wants/.test(s.plain)), `every ${k} plain line says what the crew is asking for`);
  assert(OC.SCEN.national.filter(s => /Can (he|she) refuse\?/.test(s.q)).every(s => s.btn && /may refuse/.test(s.btn[0])) && !OC.SCEN.national.concat(OC.SCEN.miemss).some(s => /Accept the refusal/.test(s.q)), 'refusal calls ask "Can he refuse?" and the buttons say the action');
  // a reasonable order is neither scored nor flagged
  OC.newGame('train', 78, { mode: 'md' });
  const sx = OC.trainPatient('stroke', 'room', { room: 'R1' }), sp = typeof sx === 'string' ? OC.pt(sx) : sx;
  OC.assign(OC.G.me, sp.id); let n = 0; while (sp.ord !== 'need' && n++ < 4000) OC.step(0.1);
  const before = OC.G.stats.md.ordExtra, r1 = OC.signOrders(sp.id, ['ct', 'lab', 'ecg'], ['tnk']);
  assert(r1.ok && OC.G.stats.md.ordExtra === before && sp.ordLog.extra.length === 0 && sp.ordLog.fine.join() === 'ECG' && sp.ordLog.miss.length === 0, 'an ECG in a stroke is reasonable: not flagged, not counted as extra');
  // the wrong consultant stays on the patient; missing orders name the drug
  const nx = OC.trainPatient('nstemi', 'room', { room: '5' }), np = typeof nx === 'string' ? OC.pt(nx) : nx;
  OC.assign(OC.G.me, np.id); n = 0; while (np.ord !== 'need' && n++ < 6000) OC.step(0.1);
  OC.signOrders(np.id, ['ecg', 'lab'], []);
  assert(OC.missNow(np).join() === 'Medications (aspirin and heparin)', 'a missing Medications order names its drug: ' + OC.missNow(np));
  // a watch period before an overdose goes home (a real shift, not Orientation)
  OC.newGame('easy', 79, { mode: 'rn' });
  const until = (cond, max) => { const t = OC.G.t; let n = 0; while (!cond() && OC.G.t - t < max && n++ < 20000) { if (OC.G.card) OC.botStep({ budget: 0 }); OC.step(0.5); } };   // a decision card stops the clock: let the autopilot answer it
  const freeRoom = (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed) || {}).id;
  const ox = OC.trainPatient('od', 'room', { room: freeRoom }), op = typeof ox === 'string' ? OC.pt(ox) : ox;
  assert(op && op.loc === 'room' && OC.roomOf(op).kind !== 'resus', 'an overdose is ESI 1 but may take a monitored room');
  const doc = OC.G.staff.find(s => s.role === 'md' && s.st === 'on'); OC.assign(doc.id, op.id);
  until(() => op.dsp === 'watch' || op.loc !== 'room', 240);
  assert(op.dsp === 'watch' && Math.round(op.due - OC.G.t) > 100, 'a treated overdose is watched for two hours, not offered for discharge: ' + op.dsp);
  assert(OC.canPlace(op, OC.G.rooms.find(r => r.kind === 'chair' && !r.pid)).ok, 'a watched patient can wait in a chair');
  const d = OC.discharge(op.id);
  assert(d.ok && op.earlyDc && op.earlyDc.left > 60 && /naloxone/.test(op.earlyDc.why), 'the charge nurse may discharge early, and the reason is kept for the return');
  const ax = OC.trainPatient('asthma', 'room', { room: (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed) || {}).id }), ap = typeof ax === 'string' ? OC.pt(ax) : ax;
  const doc2 = OC.G.staff.filter(s => s.role === 'md' && s.st === 'on')[1] || doc; OC.assign(doc2.id, ap.id);
  until(() => ap.dsp === 'watch' || ap.loc !== 'room', 300);
  const t0 = OC.G.t; until(() => ap.dsp !== 'watch', 90);
  assert(ap.dsp === 'ready' && OC.G.t - t0 > 45, 'after an hour of watching, an asthma patient is ready to go home: ' + ap.dsp + ' after ' + Math.round(OC.G.t - t0));
}
