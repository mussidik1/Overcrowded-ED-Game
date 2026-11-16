// v0.7: two roles. The attending writes orders and gives medical direction; the charge nurse routes the radio.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function run(min, fn) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (fn && fn()) return true; if (OC.G.over) return false; } return false; }
const ME = 'md1';
const room = (k, r) => OC.pt(OC.trainPatient(k, 'room', { room: r }));
const seen = p => { OC.assign(ME, p.id); run(40, () => p.ord === 'need'); return p; };

// 1. Physician mode: you are one attending; the computer runs the charge nurse's board
OC.newGame('train', 11, { mode: 'md' }); let G = OC.G;
assert(G.mode === 'md' && G.me === ME && OC.staff(ME).role === 'md', 'physician mode: you are Dr. Patel, an attending');

// 2. See, order, decide: a clean strep visit
const j = room('strep', '1');
let r = OC.assign(ME, j.id);
assert(r.ok && j.mine && j.prov === ME && G.stats.md.seen === 1, 'See this patient puts them on your panel');
run(40, () => j.ord === 'need');
assert(j.ord === 'need' && !j.wk.length && !j.tr.length, 'after your exam, nothing is ordered until you sign');
assert(!OC.signOrders(j.id, [], []).ok, 'signing nothing for a patient who needs a workup is refused');
let c0 = G.care;
r = OC.signOrders(j.id, ['lab'], ['meds']);
assert(r.ok && j.ord === 'signed' && G.stats.md.clean === 1 && G.care - c0 === 15, `exactly what they need: +2 test, +3 treatment, +10 clean (${G.care - c0})`);
assert(/penicillin/.test(r.msg), 'Medications names the drug: ' + r.msg);
run(90, () => j.dsp === 'mddecide');
assert(j.dsp === 'mddecide', 'results back: the disposition waits for your call');
assert(!OC.mdDecide(j.id, 'transfer').ok && G.stats.md.dispoWrong === 1, 'transfer for strep throat is declined and counts as a wrong call');
c0 = G.care;
r = OC.mdDecide(j.id, 'home');
assert(r.ok && G.stats.md.dispoRight === 1 && G.care - c0 === 12, 'discharge home is the right call: +12');
run(120, () => j.loc === 'gone');
assert(j.loc === 'gone' && j.outcome === 'dc', 'their nurse discharges them');

// 3. A thin workup: the diagnosis waits for the missing test
const s = seen(room('appy', '9'));
OC.signOrders(s.id, ['lab'], ['meds']);
assert(G.stats.md.ordMiss === 1 && G.stats.md.clean === 1, 'leaving out the CT is a miss, and the set is not clean');
run(120, () => s.ord === 'more');
assert(s.ord === 'more' && G.stats.md.gaps === 1 && !s.dxK, 'labs back, no diagnosis: the workup needs more');
r = OC.signOrders(s.id, ['ct'], []);
assert(r.ok && s.wk.includes('ct'), 'adding the CT');
run(120, () => s.dsp === 'mddecide');
assert(s.dsp === 'mddecide' && s.dxK, 'CT back: appendicitis, and your call');
r = OC.consult(s.id, 'surg');
assert(r.ok && s.mdPick === 'consult' && G.stats.md.dispoRight === 2, 'calling surgery is the right call');

// 4. Extra tests cost time and points; a CT costs the most
const x = seen(room('strep', '2'));
c0 = G.care;
OC.signOrders(x.id, ['lab', 'ct'], ['meds']);
assert(G.care - c0 === -3 && G.stats.md.ordExtra === 1, `an unneeded CT costs 8: +2 +3 -8 (${G.care - c0})`);

// 5. Untreated: DKA without insulin gets worse
const d = seen(room('dka', '5'));
OC.signOrders(d.id, ['lab'], ['fluids']);
run(120, () => d.txGap && d.txGap.length);
assert(d.txGap && d.txGap.join() === 'insulin', 'labs back: DKA is not improving without the insulin drip');
run(25, () => G.stats.md.untreated > 0);
assert(G.stats.md.untreated === 1 && G.stats.mm.some(m => /insulin/i.test(m.what)), 'twenty minutes untreated: harm, and it goes on the M&M list');
r = OC.signOrders(d.id, [], ['insulin']);
assert(r.ok && !d.txGap, 'adding insulin closes the gap');
run(120, () => d.dsp === 'mddecide');
c0 = G.care;
OC.mdDecide(d.id, 'home');
assert(G.stats.md.dispoWrong === 2 && G.care - c0 === -25 && d.wrongHome === 'icu' && G.stats.mm.some(m => /went home/.test(m.what)), 'sending DKA home: -25 and an M&M case');

// 6. Orders with no indication can hurt people
let hurt = 0;
for (const rm of ['3', '4', '6', '7', '8']) {
  const h = seen(room('strep', rm));
  OC.signOrders(h.id, ['lab'], ['meds', 'insulin', 'tnk']);
}
run(240, () => (hurt = G.stats.md.harm) >= 2);
assert(hurt >= 2, `insulin and a thrombolytic for strep throat hurt people (${hurt} harmed)`);

// 7. The radio is yours
assert(OC.trainConsult(), 'a medic calls for medical direction');
r = OC.boxTake(ME);
assert(r.ok && r.sc && r.doc === OC.staff(ME).name, 'you take the call yourself');
c0 = G.care;
const b = OC.boxDecide(r.sc.a);
assert(b && b.ok && G.stats.boxC.right === 1 && G.care > c0, 'the right order scores');
const al = OC.pt(OC.trainPatient('stroke', 'alert', { eta: 8 }));
run(3, () => !G.box.cur);
assert(!G.box.cur && al.pren, 'the charge nurse takes the stroke alert report, not you');

// 8. A full shift as the attending
OC.newGame('med', 4242, { mode: 'md' }); G = OC.G;
assert(OC.staff(ME).q.length === 0 && !OC.active().some(p => p.prov === ME), 'you start with an empty panel; the night doc signed out to the team');
run(120);
const others = OC.active().filter(p => p.prov && p.prov !== ME).length;
assert(OC.inRooms().length > 10 && others > 0 && !OC.active().some(p => p.prov === ME), `the computer charge nurse rooms patients, and other providers pick up anyone you leave (${others})`);
const MDT = ['md', 'orders', 'harm', 'dispo', 'box', 'consult', 'flow', 'goals', 'returns', 'gray', 'blood'];
assert(Object.keys(G.ledger).every(k => MDT.includes(k)), 'your score has no nursing items (ratios, wall time, staffing): ' + Object.keys(G.ledger).join(', '));
let n = 0; while (!G.over && n++ < 20000) { OC.step(0.1); if (n % 20 === 0) OC.mdPlay({ budget: 2, acc: 0.8, line: 1 }); }
const R = G.report;
assert(R.mode === 'md' && R.md.seen >= 30 && R.md.harm === 0, `a steady attending sees ${R.md.seen} patients and hurts no one`);
assert(R.care >= 1300 && OC.starsFor(R.care, 'med', 'md') >= 2, `and earns ${R.care} points, ${OC.starsFor(R.care, 'med', 'md')} stars`);
assert(OC.STARS_MD && OC.starsFor(2100, 'hard', 'md') === 3 && OC.starsFor(2100, 'hard', 'rn') === 2, 'physician stars have their own scale');

// 9. Save and resume keeps the role
const snap = JSON.parse(JSON.stringify(G));
OC.load(snap);
assert(OC.G.mode === 'md' && OC.G.me === ME, 'a saved physician shift resumes as the physician');
