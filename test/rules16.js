// v0.34 (the owner, Nov 28, 2026): every ECG is drawn, and the attending signs each one: STEMI, No STEMI, or (for the ECG an ambulance
// sends ahead) Repeat ECG on Arrival. These checks measure the drawn tracings the way a reader would, and play the signature rules.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const DT = 0.002;
const T = read => OC.ecgTrace(read, 'test', 10, DT);
// measures one beat in one lead: QRS peak and trough, the ST level 60 ms after the QRS, and the T wave
function beat(tr, L, k) {
  const b = tr.beats.filter(x => x > 0.5 && x < 9)[k || 0], o = tr.out[L], at = x => o[Math.round(x / DT)] || 0, base = at(b - 0.025);
  let R = -9, S = 9; for (let x = b - 0.01; x < b + tr.qEnd + 0.01; x += DT) { R = Math.max(R, at(x) - base); S = Math.min(S, at(x) - base); }
  let Tw = 0; for (let x = b + tr.qEnd + 0.05; x < b + tr.qt; x += DT) { const v = at(x) - base; if (Math.abs(v) > Math.abs(Tw)) Tw = v; }
  return { R, S, ST: at(b + tr.qEnd + 0.06) - base, T: Tw };
}
// QRS width: how long the heart vector is large, around one beat
function qrsMs(tr) {
  const b = tr.beats.filter(x => x > 0.5)[0]; let first = null, last = null;
  for (let x = b - 0.03; x < b + 0.25; x += DT) { const i = Math.round(x / DT), m = Math.hypot(tr.out.I[i], tr.out.aVF[i] / 0.866, tr.out.V2[i] / 2.4); if (m > 0.05 && x < b + tr.qEnd + 0.03) { if (first == null) first = x; last = x; } }
  return Math.round((last - first) * 1000);
}
const N = T('Normal sinus rhythm, rate 75'), n = k => beat(N, k);
assert(n('I').R > 0.4 && n('aVF').R > 0.4 && n('aVR').S < -0.5, 'normal: upright I and aVF, negative aVR (axis about +50°)');
assert(n('V1').S < -0.5 && n('V1').R < 0.4 && n('V6').R > 0.8 && n('V6').S > -0.3, 'normal: rS in V1, tall R in V6');
assert(n('V4').R > n('V2').R && n('V2').R > n('V1').R, 'normal: R waves grow across the chest leads');
assert(qrsMs(N) <= 110 && Math.abs(N.beats[3] - N.beats[2] - 0.8) < 0.03, `normal: narrow QRS (${qrsMs(N)} ms) and a regular rate of 75`);
assert(['I', 'II', 'V3', 'V4', 'V5'].every(k => n(k).T > 0.1) && n('aVR').T < 0, 'normal: upright T waves, inverted in aVR');
const st = T('ST elevation V1–V4'), s = k => beat(st, k);
assert(['V1', 'V2', 'V3', 'V4'].every(k => s(k).ST >= 0.1) && s('V2').ST >= 0.2, `anterior STEMI: ST elevation of 1 mm or more in V1 to V4 (V2 ${(s('V2').ST * 10).toFixed(1)} mm)`);
assert(['II', 'III', 'aVF'].every(k => s(k).ST < 0), 'anterior STEMI: reciprocal ST depression inferiorly');
const ns = T('ST depression V4–V6'), d = k => beat(ns, k);
assert(['V4', 'V5', 'V6'].every(k => d(k).ST <= -0.1) && d('aVR').ST > 0 && ['V1', 'V2'].every(k => d(k).ST > -0.1), 'NSTEMI: ST depression of 1 mm or more in V4 to V6 (with ST elevation in aVR), none in V1 and V2');
assert(!['V1', 'V2', 'V3', 'V4', 'II', 'III', 'aVF', 'I', 'aVL', 'V5', 'V6'].some(k => d(k).ST >= 0.1), 'NSTEMI: no ST elevation meeting STEMI criteria');
const af = T('Irregularly irregular, no P waves, rate 152'), rr = af.beats.slice(1).map((x, i) => x - af.beats[i]).filter((_, i) => i > 1 && i < 20);
assert(Math.max(...rr) - Math.min(...rr) > 0.12 && Math.abs(60 / (rr.reduce((a, b) => a + b, 0) / rr.length) - 152) < 25, 'A-fib: irregularly irregular at about 152');
assert(af.s.rhythm === 'af', 'A-fib: no P waves (a fibrillating baseline instead)');
const hb = T('P waves march through, unrelated to the QRS; rate 38');
assert(Math.abs(60 / (hb.beats[3] - hb.beats[2]) - 38) < 3 && hb.s.atrial > 60, 'complete heart block: ventricles at 38, P waves faster and on their own');
const lb = T('New bundle branch block'), l = k => beat(lb, k);
assert(qrsMs(lb) >= 120 && l('V1').R < 0.15 && l('V1').S < -1 && l('V6').R > 0.6 && l('V6').S > -0.15 && l('V6').T < 0, `left bundle branch block: QRS ${qrsMs(lb)} ms, QS in V1, broad R in V6 with a discordant T`);
const rb = T('Sinus tachycardia 132, new right bundle branch block'), r = k => beat(rb, k);
assert(qrsMs(rb) >= 120 && r('V1').R > 0.5 && r('I').S < -0.25 && r('V6').S < -0.2, `right bundle branch block: QRS ${qrsMs(rb)} ms, tall R' in V1, wide S in I and V6`);
const pe = T('Sinus tachycardia 118, S wave in I, T inversion in III'), q = k => beat(pe, k);
assert(q('I').S < -0.3 && q('III').T < -0.05, 'pulmonary embolism: S in I, T inversion in III');
const lv = T('Sinus rhythm, left ventricular hypertrophy'), v = k => beat(lv, k);
assert(-v('V1').S + v('V5').R > 3.5 && v('V6').T < 0 && v('V6').ST < 0, `LVH: Sokolow-Lyon ${(-v('V1').S + v('V5').R).toFixed(1)} mV (over 3.5) with lateral strain`);
const hk = T('Peaked T waves, QRS 130 ms, rate 52'), h = k => beat(hk, k);
assert(h('V3').T > 1 && h('V3').T > h('V3').R && qrsMs(hk) >= 120 && Math.abs(60 / (hk.beats[3] - hk.beats[2]) - 52) < 3, `hyperkalemia: tall peaked T (V3 ${(h('V3').T * 10).toFixed(0)} mm), wide QRS (${qrsMs(hk)} ms), rate 52`);
const tc = T('Sinus tachycardia 128, QRS 140 ms, tall R wave in aVR'), c = k => beat(tc, k);
assert(c('aVR').R >= 0.3 && qrsMs(tc) >= 120 && c('I').S < -0.2, `tricyclic overdose: terminal R in aVR ${(c('aVR').R * 10).toFixed(0)} mm, QRS ${qrsMs(tc)} ms`);
const oq = T('Sinus tach, old Q waves'), o = k => beat(oq, k);
assert(o('III').S < -0.3 && o('III').R < 0.1 && o('aVF').S < -0.2, 'old inferior infarct: Q waves in III and aVF');
for (const k of OC.CASES) if (k.find && k.find.ecg) assert(OC.ecgSpec(k.find.ecg).known, `${k.k}: the reading "${k.find.ecg}" has a drawn tracing`);
const a1 = OC.ecgTrace('Irregularly irregular, no P waves, rate 110', 'p1', 10, 0.004), a2 = OC.ecgTrace('Irregularly irregular, no P waves, rate 110', 'p1', 10, 0.004);
assert(JSON.stringify(a1.beats) === JSON.stringify(a2.beats), 'a tracing is the same every time it is drawn (no dice)');

// The signature rules
OC.newGame('med', 51, { mode: 'md' }); let G = OC.G; G.card = null;
const CAP = (k) => OC.pt(OC.trainPatient(k, 'room', { room: (G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id }));
G.train = null;
{ const p = CAP('stemi'); p.ecgs = [{ src: 'ed', read: p.find.ecg, t: G.t, pick: null, tSign: null, done: false }];
  assert(OC.ecgPending(p) && !OC.ecgSign(p.id, 'repeat').ok, 'an ECG done here offers STEMI or No STEMI (Repeat is for an ambulance ECG)');
  const lit0 = G.lit || 0; OC.ecgSign(p.id, 'no');
  assert((G.lit || 0) === lit0, 'a signature gives no verdict at the moment it is signed');
  OC.settleEcg(p);
  assert(G.stats.md.ecgMiss === 1 && G.lit > lit0 && (G.stats.mm || []).some(m => /STEMI/.test(m.what)), 'signing a STEMI as No STEMI is a must-not-miss error when it settles'); }
{ const p = CAP('cwp'); p.ecgs = [{ src: 'ems', read: 'Normal sinus rhythm, rate 80', t: G.t, pick: null, tSign: null, done: false }];
  assert(OC.ecgSign(p.id, 'stemi').ok, 'a STEMI call activates the cath lab'); const f0 = G.stats.md.ecgFalse || 0;
  for (let i = 0; i < 220; i++) OC.step(0.1);
  assert((G.stats.md.ecgFalse || 0) === f0 + 1, 'on an ECG with no STEMI, cardiology stands the cath lab down after 20 minutes and it counts'); }
{ const p = CAP('cwp'); p.ecgs = [{ src: 'ems', read: 'Normal sinus rhythm, rate 80', t: G.t, pick: null, tSign: null, done: false }];
  assert(OC.ecgSign(p.id, 'repeat').ok, 'an ambulance ECG can be signed Repeat ECG on Arrival'); OC.settleEcg(p);
  assert((G.stats.md.ecgRight || 0) >= 1, 'Repeat on an ECG with no STEMI is a right call'); }
{ OC.newGame('med', 52, { mode: 'md' }); let t = 0, q = 0;
  while (!OC.G.over) { OC.step(0.1); t += 0.1; if (OC.G.card && OC.G.card.choices) OC.chooseCard(OC.G.card.choices[0].k); if (t >= 2) { t = 0; OC.mdPlay({ budget: 2, acc: 1, line: 1 }); } }
  const R = OC.G.report; q = R.ecg;
  assert(q && q.signed >= 10 && q.right === q.signed && !q.miss && !q.falseCath, `a perfect attending signs every ECG right (${q && q.signed} signed)`); }
{ OC.newGame('med', 53, {}); for (let i = 0; i < 1500; i++) OC.step(0.1);
  assert(Object.values(OC.G.pts).every(p => !p.ecgs || !p.ecgs.length), 'the charge nurse signs no ECGs (the reading shows instead)'); }
