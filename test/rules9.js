// v0.28: drugs by class and the right drug, the diagnosis call, clinical accuracy, legal risk, dose and order radio calls.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const roomFree = () => OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso).id;
const mine = k => { const p = OC.pt(OC.trainPatient(k, 'room', { room: roomFree() })); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); return p; };

OC.newGame('easy', 901, { mode: 'md' }); const G = OC.G;
// 1. Drugs
assert(Object.values(OC.DRUGS).every(d => d.n && d.c && d.tx.every(t => OC.TREAT[t])), 'every drug has a name, a class, and gives a real treatment');
assert(Object.values(OC.DRUGS).filter(d => d.c === 'resus').length >= 8, 'the resuscitation set has its own drugs');
for (const [k, T] of Object.entries(OC.RXOK)) for (const [tx, L] of Object.entries(T)) assert(L.every(id => OC.DRUGS[id] && OC.DRUGS[id].tx.includes(tx)), `right drugs for ${k} (${tx}) exist and give that treatment`);
assert(OC.CASES.every(c => (c.tr || []).every(t => ['meds', 'abx', 'nebs', 'epi', 'pressor', 'reverse', 'pace'].includes(t) ? !!OC.drugFor({ ck: c.k }, t) : true)), 'every drug treatment a case needs has a right drug to pick');
let p = mine('strep');
let r = OC.signOrders(p.id, ['strep'], ['dilt']);
assert(r.ok && !p.tr.includes('meds') && G.stats.md.wrongDrug === 1, 'strep throat: diltiazem is the wrong drug and does not count');
r = OC.signOrders(p.id, [], ['penvk']);
assert(r.ok && p.tr.includes('meds') && p.drugs.includes('penvk'), 'penicillin fills the need');
p = mine('anaph');
r = OC.signOrders(p.id, [], ['epiim', 'diphen', 'methylpred', 'o2', 'ns']);
assert(p.tr.includes('epi') && p.tr.includes('meds'), 'anaphylaxis: IM epinephrine and an antihistamine count');
// 2. The diagnosis call
OC.G.train = null;
p = mine('pna'); p.dxK = false;
OC.signOrders(p.id, ['cbc'], []);
const ask = () => { p.dxK = false; p.dxPick = null; p.dxq = [p.dx, 'Pulmonary embolism', 'Heart failure flare', 'Lung cancer']; };
ask();
r = OC.dxPick(p.id, p.dx);
assert(r.ok && r.right && p.dxK && G.stats.md.dxRight >= 1, 'naming the right diagnosis counts');
const q = mine('stemi'); q.dxq = [q.dx, 'Pericarditis', 'Aortic dissection', 'Pulmonary embolism']; q.dxK = false;
const lit0 = G.lit || 0;
r = OC.dxPick(q.id, 'Pericarditis');
assert(!r.right && q.dxK && G.stats.md.dxWrong === 1, 'a wrong call still shows the real diagnosis, and is counted');
assert(G.lit - lit0 === 5 && OC.MUST.has('stemi'), 'missing a must-not-miss diagnosis adds 5% legal risk');
assert(OC.accuracy() < 100, 'clinical accuracy drops with a miss');
assert(Object.keys(OC.DDX).filter(k => OC.CASES.find(c => c.k === k)).every(k => !OC.DDX[k].includes(OC.CASES.find(c => c.k === k).dx)), 'no case lists its own diagnosis as a wrong choice');
// 3. Legal risk steps
G.card = null; OC.litAdd(30, 'test');
assert(G.card && G.card.mine && G.card.eid === 'lit', 'past 25%: a call from the administrator the attending must answer');
OC.chooseCard('ok'); OC.litAdd(5, 'test');
assert(G.card && /Peer review/.test(G.card.title), 'past 40%: peer review');
OC.chooseCard('ok'); OC.litAdd(10, 'test');
assert(G.card && /improvement plan/.test(G.card.title) && G.lawNext > G.t, 'past 50%: a PIP, and lawyers will call');
OC.chooseCard('ok');
G.lawNext = G.t; for (let i = 0; i < 20 && !(G.card && G.card.eid === 'law'); i++) OC.step(0.5);
assert(G.card && G.card.eid === 'law', 'a lawyer calls');
const l0 = G.lit; OC.chooseCard('talk');
assert(G.lit > l0, 'discussing the case with the lawyer raises the risk');
OC.litAdd(30, 'test'); OC.step(0.1);
assert(G.over && G.fail === 'fired' && G.report.fail === 'fired', 'at 75% the group lets you go and the shift ends');
// 4. Radio: dose and order calls
const mc = OC.SCEN.national.filter(s => s.opts);
assert(mc.length >= 10 && mc.every(s => s.opts.length === 4 && s.r >= 0 && s.r < 4 && s.why), 'ten or more radio calls ask for a dose or an order, with four choices');
OC.newGame('easy', 902, { mode: 'md' });
OC.G.box.cur = { kind: 'consult', sc: OC.SCEN.national.indexOf(mc[0]), pk: 'national', unit: 'Medic 3', id: 99, ring: 99, left: 99, t0: 0 };
r = OC.boxTake(OC.G.me); r = OC.boxDecide(1);
assert(!r.ok && OC.G.stats.radioLog.slice(-1)[0].right === mc[0].opts[mc[0].r], 'a wrong dose is logged with the right order');
OC.trainConsult('tdose'); r = OC.boxTake(OC.G.me); r = OC.boxDecide(0);
assert(r.ok && r.sc.opts, 'the practice dose call has a right answer');

// 5. v0.28.1: the review's findings
assert(OC.SCEN.national.every((x, i) => x && x.q) && Object.keys(OC.SCEN.national).length === OC.SCEN.national.length, 'no holes in the radio call list');
OC.newGame('easy', 903, { mode: 'md' }); let H = OC.G;
let t = mine('strep'); OC.signOrders(t.id, ['strep'], ['penvk']);
t = mine('refill'); const ex0 = H.stats.md.ordExtra; OC.signOrders(t.id, [], ['hydro']);
assert(H.stats.md.ordExtra === ex0 + 1, 'a reasonable treatment still needs a sensible drug: hydromorphone for a refill is extra');
t = mine('chb'); OC.signOrders(t.id, ['ecg'], ['atropine']);
r = OC.signOrders(t.id, [], ['tcp']);
assert(r.ok && t.drugs.includes('tcp'), 'pacing pads can be added after atropine');
// an open diagnosis question doesn't stop the untreated clock
t = mine('nstemi'); t.wk = []; for (const k of Object.keys(t.work || {})) delete t.work[k];
OC.signOrders(t.id, t.right.det.concat(['ecg']), []);
for (let i = 0; i < 4000 && !t.dxq; i++) OC.step(0.1);
assert(t.dxq && t.dxq.length === 4 && t.dxq.includes(OC.dxName(t.ck)), 'results back: the attending gets four choices, one right');
const u0 = H.stats.md.untreated; for (let i = 0; i < 400; i++) { if (H.card) H.card = null; OC.step(0.1); }
assert(H.stats.md.untreated > u0, 'leaving the diagnosis unanswered does not hide an untreated patient');
// a step behind another card shows later; the lawyer names a patient; firing keeps the last case
OC.newGame('easy', 904, { mode: 'md' }); H = OC.G;
H.card = { eid: 'x', title: 'Other', choices: [{ k: 'a', label: 'a' }], ctx: {} };
OC.litAdd(30, 'test'); assert(H.litStage === 0, 'no legal-risk card over another card');
H.card = null; for (let i = 0; i < 30 && !H.card; i++) OC.step(0.1);
assert(H.card && H.card.eid === 'lit', 'the skipped step shows once the other card is gone');
OC.chooseCard('ok');
const w = mine('stemi'); w.dxq = [w.dx, 'Pericarditis', 'Aortic dissection', 'Pulmonary embolism']; w.dxK = false;
OC.dxPick(w.id, 'Pericarditis');
OC.litAdd(16, 'test'); while (H.card) OC.chooseCard(H.card.choices[0].k);
H.lawNext = H.t; for (let i = 0; i < 30 && !(H.card && H.card.eid === 'law'); i++) OC.step(0.1);
assert(H.card && H.card.eid === 'law' && H.card.text.includes(w.name), 'the lawyer calls about a patient, by name');
OC.chooseCard('risk');
const v = mine('stemi'); v.dxq = [v.dx, 'Pericarditis', 'Aortic dissection', 'Pulmonary embolism']; v.dxK = false;
H.lit = 72; OC.dxPick(v.id, 'Aortic dissection'); OC.step(0.1);
assert(H.over && H.report.fail === 'fired' && H.report.mm.some(m => m.what.includes(v.name)), 'fired: the shift ends and the case that did it is in the review');
// 6. v0.28.1: a drug that can hurt this patient is harm
OC.newGame('easy', 905, { mode: 'md' }); const K = OC.G;
const g = mine('gib'); const h0 = K.stats.md.harm, l0b = K.lit;
OC.signOrders(g.id, [], ['heparin']);
assert(K.stats.md.harm === h0 + 1 && K.lit > l0b, 'heparin in a GI bleed is harm and adds legal risk');
assert(!OC.MUST.has('cpmod') && !OC.MUST.has('pna'), 'moderate-risk chest pain and pneumonia are not must-not-miss calls');
// 7. v0.29: the high-yield conditions and the cleaner diagnosis call
const NEW = Object.keys(OC.LESSON_CASE);
assert(NEW.length >= 20, `${NEW.length} high-yield conditions added, each with a lesson`);
for (const k of NEW) {
  const c = OC.CASES.find(x => x.k === k), N = OC.NEED[k] || { n: [] };
  const ok = c && OC.EXAM[k] && OC.ORD_WHY[k] && OC.DX_PLAIN[c.dx] && (OC.DDX[k] || []).length === 3 && !OC.DDX[k].includes(OC.dxName(k)) && N.n.every(t => OC.LABS[t] || OC.IMGS[t])
    && Object.values(OC.RXOK[k] || {}).every(l => l.every(d => OC.DRUGS[d])) && OC.contraOf({ ck: k }).every(d => OC.DRUGS[d]) && (!c.con || OC.SPECS[c.con]) && c.tr.every(t => OC.TREAT[t]);
  assert(ok, `${k}: case, exam, reason, plain words, three wrong choices, tests, drugs, specialist`);
}
OC.newGame('easy', 906, { mode: 'md' }); const Q = OC.G;
const hk = mine('hyperk');
OC.signOrders(hk.id, ['bmp', 'ecg'], ['calc', 'insreg']);
assert(hk.tr.includes('insulin') && !hk.tr.includes('meds') && OC.missNow(hk).join().includes('dextrose'), 'hyperkalemia: insulin without dextrose leaves dextrose still needed');
OC.signOrders(hk.id, [], ['d50', 'albut']);
assert(hk.tr.includes('meds') && OC.G.stats.md.ordExtra === 0, 'calcium, insulin and dextrose complete it; albuterol is a fine add-on');
const st = mine('status'); OC.signOrders(st.id, ['gluc', 'bmp'], ['levet']);
assert(!st.tr.includes('meds') && OC.missNow(st).join().includes('lorazepam'), 'status epilepticus: levetiracetam alone is not enough; the benzodiazepine is still needed');
const nf = mine('necfasc'); OC.signOrders(nf.id, nf.right.det, ['vanc']);
assert(!nf.tr.includes('abx'), 'necrotizing fasciitis: vancomycin alone is not enough');
const ds = mine('dissect'); OC.signOrders(ds.id, ds.right.det.concat(['ecg']), ['nicard', 'fent']);
assert(!ds.tr.includes('bp') && OC.G.stats.md.ordExtra === 0, 'dissection: nicardipine alone leaves rate control still needed (not an extra)');
const aq = mine('aaa'); const xq = OC.G.stats.md.harm; OC.signOrders(aq.id, [], ['enox']);
assert(OC.G.stats.md.harm === xq + 1, 'a ruptured AAA given enoxaparin is harm: blood thinners are one class');
const hg = mine('hypogly'); const hh = Q.stats.md.harm;
OC.signOrders(hg.id, ['gluc'], ['insreg']);
assert(Q.stats.md.harm === hh + 1, 'insulin in hypoglycemia is harm');
assert(!OC.CASES.filter(c => c.gray).some(c => { const p = mine(c.k); OC.signOrders(p.id, p.right.det.concat(p.right.wk.includes('ecg') ? ['ecg'] : []), p.right.tr.flatMap(t => OC.drugsFor(p, t).length ? OC.drugsFor(p, t) : [t])); for (let i = 0; i < 3000 && !p.dxq && p.dsp !== 'decide' && !p.dxK; i++) { if (Q.card) Q.card = null; OC.step(0.1); } return !!p.dxq; }), 'gray-zone patients with results back get the risk-score call, not the diagnosis quiz');
assert(OC.dxName('nstemi') === 'NSTEMI' && OC.dxName('pe') === 'Pulmonary embolism', 'quiz labels are plain diagnoses');
