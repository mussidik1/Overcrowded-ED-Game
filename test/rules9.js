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
for (const [k, T] of Object.entries(OC.RXOK)) for (const [tx, L] of Object.entries(T)) assert(L.every(id => OC.DRUGS[id] && OC.DRUGS[id].tx.includes(tx)) || L.every(id => OC.DRUGS[id]), `right drugs for ${k} (${tx}) exist`);
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
p.re = 'work'; // force the ask
if (!p.dxq) { p.dxq = null; }
const ask = () => { p.dxK = false; p.dxPick = null; p.dxq = [p.dx, 'Pulmonary embolism', 'Heart failure flare', 'Lung cancer']; };
ask();
r = OC.dxPick(p.id, p.dx);
assert(r.ok && r.right && p.dxK && G.stats.md.dxRight >= 1, 'naming the right diagnosis counts');
const q = mine('stemi'); q.dxq = [q.dx, 'Pericarditis', 'Aortic dissection', 'Pulmonary embolism']; q.dxK = false;
const lit0 = G.lit || 0;
r = OC.dxPick(q.id, 'Pericarditis');
assert(!r.right && q.dxK && G.stats.md.dxWrong === 1, 'a wrong call still shows the real diagnosis, and is counted');
assert(G.lit - lit0 === 6 && OC.MUST.has('stemi'), 'missing a must-not-miss diagnosis adds 6% legal risk');
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
OC.litAdd(30, 'test');
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
