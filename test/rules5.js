// v0.10: vitals that change during the visit, the five-minute shift, and preset scenarios.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function run(min, fn) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (fn && fn()) return true; if (OC.G.over) return false; } return false; }

// 1. Vitals drift while nothing is done, and settle when treatment lands
OC.newGame('train', 5, {}); let G = OC.G;
const s = OC.pt(OC.trainPatient('sepsisw', 'walk', { name: 'Sep S.', age: 60 }));
assert(OC.vitalsOf(s).taken === false, 'a walk-in has no vitals until triage takes them');
s.tri = 'done';
const v0 = OC.vitalsOf(s), v60 = OC.vitalsOf(s, G.t + 60);
assert(v0.taken && v0.hr > 100 && v0.sbp < 110 && v0.temp > 102 && v0.flags.temp && v0.flags.hr, `sepsis at the door: fast heart, soft pressure, fever (${v0.text})`);
assert(v60.hr > v0.hr + 6 && v60.sbp < v0.sbp && v60.trend === 'worse' && v60.s > v0.s, `an hour untreated, they are worse (${v60.text})`);
s.treat = { abx: { st: 'done', tDone: G.t + 60 }, fluids: { st: 'done', tDone: G.t + 62 } };
const v75 = OC.vitalsOf(s, G.t + 75), v110 = OC.vitalsOf(s, G.t + 110);
assert(v75.trend === 'better' && v75.hr < v60.hr, `fifteen minutes after antibiotics and fluids, they are improving (${v75.text})`);
assert(v110.hr < v0.hr && v110.sbp > v0.sbp && !v110.flags.bp, `and an hour later they look better than they did at the door (${v110.text})`);

// 2. The numbers fit the case and the patient
const od = OC.pt(OC.trainPatient('od', 'ems', { age: 30 }));
const o0 = OC.vitalsOf(od);
const o60 = OC.vitalsOf(od, G.t + 60);
assert(o0.taken && o0.ems && o0.rr <= 12 && o0.spo2 < 94 && o0.flags.spo2 && o0.spo2 >= 90, `an overdose on the wall: drowsy and breathing slowly after the crew's naloxone, from the EMS report (${o0.text})`);
assert(o60.rr < o0.rr && o60.rr < 10 && o60.flags.rr && o60.spo2 < o0.spo2, `left alone, the breathing slows again as the field dose wears off (${o60.text})`);
od.treat = { nalox: { st: 'done', tDone: G.t } };
assert(OC.vitalsOf(od, G.t + 20).rr >= 12, 'naloxone brings the breathing back');
const kid = OC.pt(OC.trainPatient('otitis', 'ems', { age: 2 })), grown = OC.pt(OC.trainPatient('ankle', 'ems', { age: 30 }));
assert(OC.vitalsOf(kid).hr > OC.vitalsOf(grown).hr + 15 && !OC.vitalsOf(kid).flags.hr, 'a toddler runs a faster heart rate, and it is not flagged');
assert(!Object.values(OC.vitalsOf(grown).flags).some(Boolean), 'a sprained ankle has normal vitals');
const code = OC.pt(OC.trainPatient('arrest', 'ems', { age: 60 }));
if (code && code.arrest) assert(OC.vitalsOf(code).arrest && /No pulse/.test(OC.vitalsOf(code).text), 'a cardiac arrest has no pulse');
const sh = OC.pt(OC.trainPatient('gib', 'ems', { age: 70 })); const g0 = OC.vitalsOf(sh); sh.shock = true; const g1 = OC.vitalsOf(sh);
assert(g1.sbp < 80 && g1.hr >= 128 && g1.s > g0.s, `shock shows in the numbers (${g1.text})`);
const a1 = OC.vitalsOf(grown).text, a2 = OC.vitalsOf(grown).text;
assert(a1 === a2, 'the same moment always reads the same');

// 2b. The numbers follow the physiology, not just the acuity
const mk = (k, age, how) => OC.pt(OC.trainPatient(k, how || 'ems', { age }));
const dka = OC.vitalsOf(mk('dka', 30)), cva = OC.vitalsOf(mk('stroke', 70)), lung = OC.vitalsOf(mk('copd', 70));
assert(dka.spo2 >= 97 && dka.rr >= 26 && cva.spo2 >= 95 && cva.hr < 100 && cva.sbp > 160 && lung.spo2 < 94, `oxygen is low only when breathing is the problem (DKA ${dka.spo2}%, stroke ${cva.spo2}%, COPD ${lung.spo2}%)`);
const sub = mk('tfall', 80), h0 = OC.vitalsOf(sub), h1 = OC.vitalsOf(sub, G.t + 45);
assert(h0.hr < 65 && h0.sbp > 160 && h1.hr <= h0.hr && h1.sbp > h0.sbp && h1.rr <= 16, `a head bleed gets slower and higher, not fast and low (${h0.text} -> ${h1.text})`);
const lvo = mk('lvo', 70);
let overLimit = 0;
for (const k of ['stroke', 'strokew', 'lvo']) for (const age of [56, 70, 88]) { const sp = mk(k, age); for (let m = 0; m <= 180; m += 15) { const x = OC.vitalsOf(sp, G.t + m); if (x.sbp > 185 || x.dbp > 110) overLimit++; } }
assert(overLimit === 0, 'a stroke never shows a pressure over 185/110, the limit for the thrombolytic, since the game has no order to lower it');
lvo.treat = { tnk: { st: 'done', tDone: G.t } };
const l90 = OC.vitalsOf(lvo, G.t + 90);
assert(l90.sbp >= 145 && l90.sbp <= 180 && l90.dbp <= 105, `and after the thrombolytic the pressure is left high, but under 180/105 (${l90.text})`);
const mi = mk('nstemi', 66), m0 = OC.vitalsOf(mi, G.t + 30);
mi.esi = 1; mi.crash = true; mi.tCrash = G.t + 30;
const m1 = OC.vitalsOf(mi, G.t + 35);
assert(m0.sbp > 140 && m1.sbp < 95 && m1.hr > 115 && m1.flags.bp && m1.flags.hr, `a patient who crashes in the waiting room looks it (${m0.text} -> ${m1.text})`);
mi.treat = { meds: { st: 'done', tDone: G.t + 40 } };
const m2 = OC.vitalsOf(mi, G.t + 75);
assert(m2.sbp > 110 && m2.hr < 100 && m2.trend !== 'worse', `and comes back with treatment (${m2.text})`);
const od2 = mk('od', 30); od2.treat = { nalox: { st: 'done', tDone: G.t } };
const sp2 = mk('sepsisw', 80); sp2.treat = { abx: { st: 'done', tDone: G.t }, fluids: { st: 'none' } };
const s5 = OC.vitalsOf(sp2, G.t + 5), s60 = OC.vitalsOf(sp2, G.t + 60);
assert(OC.vitalsOf(od2, G.t + 5).rr >= 12 && s5.hr > 110 && s60.hr > 105 && s60.flags.temp, `naloxone works in minutes; an antibiotic alone has not fixed a septic patient an hour later (${s60.text})`);
const a6 = OC.vitalsOf(mk('asthma', 6)), a25 = OC.vitalsOf(mk('asthma', 25));
assert(a6.hr > a25.hr + 8 && a6.sbp < a25.sbp - 15 && a6.rr > a25.rr && a6.flags.rr && a6.flags.spo2, `a child's version of the same case (${a6.text} vs ${a25.text})`);
const ss = OC.vitalsOf(mk('shock', 75)), rf = OC.vitalsOf(mk('refill', 60, 'walk') && (() => { const p = mk('refill', 60, 'walk'); p.tri = 'done'; return p; })());
assert(ss.temp >= 101.5 && ss.flags.temp && ss.sbp < 85, `septic shock arrives with the fever its complaint says (${ss.text})`);
assert(rf.sbp > 150 && !rf.flags.bp && !rf.flags.hr, `out of blood pressure pills: high, but not an emergency (${rf.text})`);

// 2c. What the three reviewers caught
const cw = mk('cwp', 45), g2 = mk('gib', 60);
assert(OC.vitalsOf(cw, G.t + 90).trend === 'steady' && !OC.vitalsOf(cw, G.t + 90).red, `normal, flat numbers read Steady however long the patient waits (${OC.vitalsOf(cw, G.t + 90).text})`);
assert(OC.vitalsOf(g2, G.t + 40).trend === 'worse', `numbers that are moving the wrong way read Getting worse (${OC.vitalsOf(g2, G.t + 25).text} -> ${OC.vitalsOf(g2, G.t + 40).text})`);
let mismatch = [];
for (const c of OC.CASES) { if (c.arrest) continue; const age = Math.max(c.age[0], Math.min(c.age[1], 40)), x = OC.vitalsOf(mk(c.k, age)); if (c.esi >= 3 && (x.spo2 < 90 || x.sbp < 90 || x.hr > 125)) mismatch.push(`${c.k} ESI ${c.esi}: ${x.text}`); if (c.esi === 2 && x.spo2 < 90) mismatch.push(`${c.k} ESI 2: ${x.text}`); }
assert(mismatch.length === 0, 'no case arrives with vitals that contradict its triage level' + (mismatch.length ? ': ' + mismatch.join(' | ') : ''));
const pn = mk('pna', 70); pn.loc = 'room'; pn.rn = 'done'; pn.treat = { abx: { st: 'done', tDone: G.t } };
const co = mk('copd', 70), cA = OC.vitalsOf(co); co.loc = 'room'; co.rn = 'done'; const cB = OC.vitalsOf(co);
assert(cB.o2 && cB.signs.includes('on oxygen') && cB.spo2 >= 90 && cB.spo2 > cA.spo2 - 1, `once a nurse has assessed a patient with a low sat, the card says on oxygen (${cA.text} -> ${cB.text})`);
const p45 = OC.vitalsOf(pn, G.t + 45);
assert(p45.temp >= 100.4 && p45.trend !== 'better', `an antibiotic gets no credit for a fever or a sat within the hour (${p45.text})`);
const sh2 = mk('synchigh', 75), y0 = OC.vitalsOf(sh2), y90 = OC.vitalsOf(sh2, G.t + 90);
assert(y0.hr >= 60 && y0.sbp >= 110 && y90.hr >= 60 && !y90.red, `a faint with a new bundle branch block is high risk on paper, not unstable at the bedside (${y90.text})`);
let grayCrash = 0, anyCrash = 0;
for (let seed = 1; seed <= 6; seed++) { OC.newGame('hard', seed * 811, {}); for (let i = 0; i < 4200; i++) { clearCard(); OC.step(0.1); } for (const q of Object.values(OC.G.pts)) if (q.crash) { anyCrash++; if (q.gray) grayCrash++; } }
assert(anyCrash > 0 && grayCrash === 0, `patients who go home or to observation on a risk score never crash in the waiting room (${anyCrash} crashes, ${grayCrash} of them gray-zone)`);
OC.newGame('train', 5, {}); G = OC.G;

// 3. The five-minute shift
OC.newGame('rush', 4242, {}); G = OC.G;
assert(G.shift === 120 && OC.LEVELS.rush && !G.train, 'Five-Minute Rush is a two-hour shift');
run(121);
assert(G.over && G.report && G.report.level === 'rush' && G.report.seen >= 10, `it ends at 09:00 with a report (${G.report ? G.report.seen : 0} patients arrived)`);
assert(OC.starsFor(350, 'rush', 'rn') === 3 && OC.starsFor(250, 'rush', 'rn') === 2 && OC.starsFor(110, 'rush', 'rn') === 1 && OC.starsFor(50, 'rush', 'rn') === 0, 'it has its own stars');
assert(OC.starsFor(320, 'rush', 'md') === 3 && OC.starsFor(100, 'rush', 'md') === 0, 'for the attending too');

// 4. Scenarios: one named problem, on schedule
OC.newGame('med', 9, { scen: 'ct' }); G = OC.G;
assert(G.scen === 'ct' && !G.out.ct, 'CT down: the scanner works at 07:00');
run(50, () => !!G.out.ct);
assert(G.out.ct && G.t >= 40 && G.t <= 50, `and fails about 45 minutes in (${OC.clock()})`);
OC.newGame('med', 9, { scen: 'mci' }); G = OC.G; let mci = false;
for (let i = 0; i < 520 && !mci; i++) { if (G.card && /Multiple/.test(G.card.title)) mci = true; else clearCard(); OC.step(0.1); }
assert(mci && G.ev.used.mci, 'Bus crash: the multiple-casualty call comes in early');
OC.newGame('med', 9, {}); const b0 = OC.boarders().length;
OC.newGame('med', 9, { scen: 'board' }); G = OC.G;
assert(OC.boarders().length >= b0 + 4, `Boarding: the shift starts with extra admitted patients (${OC.boarders().length} vs ${b0})`);
OC.newGame('med', 9, {}); run(6); const c0 = OC.G.ev.used.callout || 0;
OC.newGame('med', 9, { scen: 'short' }); run(6);
assert((OC.G.ev.used.callout || 0) === c0 + 2, 'Short-staffed: two more call-outs at the start');
OC.newGame('rush', 9, { scen: 'ct' }); G = OC.G; run(25, () => !!G.out.ct);
assert(G.out.ct && G.t <= 25, 'scenarios work on the five-minute shift, sooner');
OC.newGame('train', 9, { scen: 'ct' });
assert(OC.G.scen === 'none', 'Orientation ignores scenarios');
OC.newGame('med', 9, { scen: 'nope' });
assert(OC.G.scen === 'none', 'an unknown scenario is a regular shift');
OC.newGame('med', 9, { scen: 'ct' }); run(60);
const saved = JSON.parse(JSON.stringify(OC.G)); OC.load(saved);
assert(OC.G.scen === 'ct', 'the scenario survives a save');
run(700);
assert(OC.G.over && OC.G.report.scen === 'ct', 'and the shift report names it');
