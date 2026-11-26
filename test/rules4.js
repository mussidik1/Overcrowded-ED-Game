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
assert(r.ok && j.ord === 'signed' && G.stats.md.clean === 1 && G.care - c0 === 14, `exactly what they need: +1 lab test (the rapid strep), +3 treatment, +10 clean (${G.care - c0})`);
assert(j.det.join() === 'strep' && j.dres.strep[0] === 'Rapid strep positive', 'the Labs kind means this case\'s own test: the rapid strep, positive');
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
assert(G.care - c0 === -2 && G.stats.md.ordExtra === 1, `an unneeded CT costs 6: +1 +3 -6 (${G.care - c0})`);

// 5. Untreated: DKA without insulin gets worse
const d = seen(room('dka', '5'));
OC.signOrders(d.id, ['lab'], ['fluids', 'kcl']);   // Phase 3 (R6-15): potassium is required too
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
OC.newGame('med', 4244, { mode: 'md' }); G = OC.G;
assert(OC.staff(ME).q.length === 0 && !OC.active().some(p => p.prov === ME), 'you start with an empty panel; the night doc signed out to the team');
run(120);
const others = OC.active().filter(p => p.prov && p.prov !== ME).length;
const here = OC.active().filter(p => p.loc !== 'enroute' && p.loc !== 'new');
const handed = OC.active().filter(p => p.prov === ME);   // Phase 6 (R5-04): on Manic Monday the charge nurse hands you up to two of the sickest
assert(OC.inRooms().length >= 4 && OC.inRooms().length >= here.length - 2 && others > 0 && handed.every(p => p.esi <= 2) && handed.filter(p => p.loc === 'room' && !p.mdPick).length <= 2, `the computer charge nurse rooms patients, other providers pick up anyone you leave (${others}), and only the sickest are handed to you (${handed.length})`);
const MDT = ['md', 'orders', 'harm', 'dispo', 'box', 'consult', 'flow', 'goals', 'returns', 'gray', 'blood'];
assert(Object.keys(G.ledger).every(k => MDT.includes(k)), 'your score has no nursing items (ratios, wall time, staffing): ' + Object.keys(G.ledger).join(', '));
let n = 0; while (!G.over && n++ < 20000) { OC.step(0.1); if (n % 20 === 0) OC.mdPlay({ budget: 2, acc: 0.8, line: 1 }); }
const R = G.report;
assert(R.mode === 'md' && R.md.seen >= 30 && R.md.harm === 0, `a steady attending sees ${R.md.seen} patients and hurts no one`);
assert(R.care >= 1300 && OC.starsFor(R.care, 'med', 'md') >= 2, `and earns ${R.care} points, ${OC.starsFor(R.care, 'med', 'md')} stars`);
assert(OC.STARS_MD && OC.starsFor(1500, 'easy', 'md') === 2 && OC.starsFor(1500, 'easy', 'rn') === 3 && OC.starsFor(2000, 'hard', 'rn') === 3, 'physician stars have their own scale, and Full Moon Friday takes 2,000 for three');

// 9. Save and resume keeps the role
const snap = JSON.parse(JSON.stringify(G));
OC.load(snap);
assert(OC.G.mode === 'md' && OC.G.me === ME, 'a saved physician shift resumes as the physician');

// 10. Review fixes (v0.7.2)
OC.newGame('train', 21, { mode: 'md' }); G = OC.G;
const k1 = OC.pt(OC.trainPatient('appy', 'room', { room: '9' }));
OC.assign(ME, k1.id); run(40, () => k1.ord === 'need');
OC.signOrders(k1.id, [], ['meds']);
assert(!k1.dxK && k1.ord === 'more', 'treatment with no tests: the diagnosis waits for the workup');
OC.signOrders(k1.id, ['lab', 'ct'], []);
run(6);
assert(k1.dsp !== 'mddecide', 'and your call waits for the results');
run(120, () => k1.dsp === 'mddecide');
assert(k1.dsp === 'mddecide' && Object.values(k1.work).every(w => w.st === 'done'), 'your call comes after every result is back');
const k2 = OC.pt(OC.trainPatient('dka', 'room', { room: '5' }));
OC.assign(ME, k2.id); run(40, () => k2.ord === 'need');
OC.signOrders(k2.id, ['lab'], ['fluids', 'kcl']);   // Phase 3 (R6-15): potassium too
run(120, () => k2.dsp === 'mddecide');
assert(k2.txGap && k2.dsp === 'mddecide', 'not improving at your call');
const r2 = OC.signOrders(k2.id, [], ['insulin']);
assert(r2.ok && !k2.txGap, 'orders can still be added at your call, and that closes the gap');
OC.newGame('med', 77, { mode: 'md' }); G = OC.G;
run(600);
assert(OC.staff(ME).st !== 'break' && G.staff.filter(s => s.role === 'md' && s.id !== ME).some(s => s.lastBreak > 0), 'the computer charge nurse sends the other doctors on break, never you');
const names = Object.values(G.pts).map(p => p.name);
assert(new Set(names).size === names.length, `no repeated patient names (${names.length} patients)`);

// v0.19: named tests. The attending picks single labs and named studies; each case scores the ones it needs.
OC.newGame('train', 19, { mode: 'md' }); G = OC.G;
const ap = seen(room('appy', '3'));
let a0 = G.care;
r = OC.signOrders(ap.id, ['cbc', 'bmp', 'ctap', 'lip'], ['meds']);
assert(r.ok && G.care - a0 === 1 + 1 + 2 + 3 + 10 && G.stats.md.clean === 1, `appendicitis: CBC, BMP, CT abdomen and pelvis (+1 +1 +2), lipase is reasonable (0), meds +3, clean +10 (${G.care - a0})`);
assert(ap.wk.includes('lab') && ap.wk.includes('ct') && ap.dres.ctap[0] === 'Appendix 11 mm across, fat stranding around it' && ap.dres.ctap[1] === 'ct_appy', 'the CT result names the finding and its picture');
const ap2 = seen(room('appy', '4')); a0 = G.care;
OC.signOrders(ap2.id, ['cbc', 'bmp', 'cthead'], ['meds']);
assert(ap2.ord === 'signed' && OC.missNow(ap2, true).includes('CT abdomen and pelvis') && G.care - a0 === 1 + 1 - 6 + 3, `the wrong CT costs 6 and the right one is still missing (${G.care - a0}; missing: ${OC.missNow(ap2, true)})`);
run(60, () => ap2.ord === 'more');
assert(ap2.ord === 'more' && !ap2.dxK, 'with the right study missing, the diagnosis waits');
r = OC.signOrders(ap2.id, ['ctap'].concat(OC.hcgDue(ap2) ? ['hcg'] : []), []);   // v0.29.1: a woman 12 to 55 needs the pregnancy test too
run(90, () => ap2.dxK);
assert(ap2.dxK, 'ordering the CT abdomen and pelvis lets the diagnosis come');
const st = seen(room('stone', '5')); a0 = G.care;
OC.signOrders(st.id, ['ua', 'bmp', 'ctap', 'mrib'], ['meds', 'fluids']);
assert(G.care - a0 === 1 + 1 + 2 - 8 + 3 + 3 && st.wk.includes('mri'), `an MRI nobody needed costs 8 and an hour (${G.care - a0})`);
const ex = OC.pt(OC.trainPatient('hipfx', 'room', { room: '6' })); ex.sex = 'M'; seen(ex); a0 = G.care;
OC.signOrders(ex.id, ['cbc', 'bmp', 'ts', 'hipxr', 'hcg'], ['meds']);
assert(G.care - a0 === 1 + 1 + 1 + 2 - 1 + 3 && ex.dres.hcg[0].startsWith('Not done'), `a pregnancy test on a man is not needed (${G.care - a0})`);
assert(Object.keys(OC.NEED).every(k => OC.CASES.find(c => c.k === k)) && OC.NEED.appy.n.every(d => OC.LABS[d] || OC.IMGS[d]), 'every case in the needs table exists, and every test it names is on the order sheet');
const bad = []; for (const [k, N] of Object.entries(OC.NEED)) for (const d of N.n.concat(N.ok || [])) if (!OC.LABS[d] && !OC.IMGS[d]) bad.push(k + ':' + d);
assert(!bad.length, `every named test exists (${bad.join(', ')})`);
const kinds = []; for (const c of OC.CASES) { const N = OC.NEED[c.k]; if (!N) { if (c.wk.some(k => k !== 'ecg')) kinds.push(c.k); continue; } const have = new Set(N.n.map(OC.DET_KIND)); for (const k of c.wk) if (k !== 'ecg' && !have.has(k) && !(k === 'ct' && c.k === 'mvc') && !(k === 'ct' && c.k === 'mcired')) kinds.push(c.k + ':' + k); }
assert(!kinds.length, `every kind of test a case needs has a named test (${kinds.join(', ')})`);
