// v0.29.1: the answer key. Every case, ordered the textbook way, scores clean: no extra orders, no harm, nothing missing.
// Plus the v0.29.1 rules: pregnancy tests, the PE clot buster, ampicillin over 50, standard care that isn't wrong, in-house neurosurgery,
// the phone consult, and class codes that carry the version.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const roomFree = () => (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id;
function mine(k, o) {
  OC.newGame('easy', 1000 + k.length, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const p = OC.pt(OC.trainPatient(k, 'room', Object.assign({ room: roomFree() }, o || {}))); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); return p;
}
function key(p) {   // the textbook orders for this patient
  const tests = OC.needOf(p).n.slice(); if (p.right && p.right.wk.includes('ecg')) tests.push('ecg');
  const treats = [];
  for (const t of p.right.tr) {
    const g = OC.reqLeft(p, t);
    if (g) treats.push(...g.map(x => x[0]));
    else { const d = OC.drugFor(p, t); treats.push(d && OC.DRUGS[d] && OC.DRUGS[d].tx.includes(t) ? d : t); }
  }
  return { tests, treats };
}
const skip = new Set(OC.CASES.filter(c => /^(mci|ret)/.test(c.k) || c.src === 'm' || c.ift === 'only').map(c => c.k));
let bad = [];
for (const c of OC.CASES) {
  if (skip.has(c.k)) continue;
  let p; try { p = mine(c.k); } catch (e) { bad.push(`${c.k}: ${e.message}`); continue; }
  if (!p || !p.right) { bad.push(`${c.k}: no answer key`); continue; }
  const K = key(p), h0 = OC.G.stats.md.harm || 0, x0 = OC.G.stats.md.ordExtra || 0, w0 = OC.G.stats.md.wrongDrug || 0;
  const r = OC.signOrders(p.id, K.tests, K.treats);
  const miss = OC.missNow(p);
  if (!r.ok) bad.push(`${c.k}: refused (${r.why})`);
  else if ((OC.G.stats.md.harm || 0) > h0) bad.push(`${c.k}: the textbook orders were scored as harm`);
  else if ((OC.G.stats.md.ordExtra || 0) > x0) bad.push(`${c.k}: the textbook orders had extras`);
  else if ((OC.G.stats.md.wrongDrug || 0) > w0) bad.push(`${c.k}: a textbook drug was scored wrong`);
  else if (miss.length) bad.push(`${c.k}: still missing ${miss.join(', ')}`);
}
assert(!bad.length, `every case, ordered the textbook way, scores clean (${OC.CASES.length - skip.size} cases)${bad.length ? ': ' + bad.join(' | ') : ''}`);

// pregnancy tests
let p = mine('appy', { sex: 'F', age: 28 });
assert(OC.needOf(p).n.includes('hcg'), 'appendicitis in a woman of 28: the pregnancy test is required');
p = mine('appy', { sex: 'F', age: 62 });
assert(!OC.needOf(p).n.includes('hcg'), 'not at 62');
p = mine('appy', { sex: 'M', age: 28 });
assert(!OC.needOf(p).n.includes('hcg'), 'not for a man');
p = mine('stemi', { sex: 'F', age: 50 });
assert(!OC.needOf(p).n.includes('hcg'), 'not in cases outside the list');

// tenecteplase in PE
p = mine('pe');
assert(OC.contraOf(p).includes('tnk'), 'a stable PE: the clot buster is contraindicated');
OC.crashNow(p.id); for (let i = 0; i < 300 && OC.vitalsOf(p).sbp >= 90; i++) OC.step(0.1);
assert(OC.vitalsOf(p).sbp < 90 && !OC.contraOf(p).includes('tnk'), `a PE whose pressure falls under 90: it is not (SBP ${Math.round(OC.vitalsOf(p).sbp)})`);
{ const x0 = OC.G.stats.md.ordExtra || 0, h0 = OC.G.stats.md.harm || 0; OC.signOrders(p.id, [], ['tnk']);
  assert((OC.G.stats.md.ordExtra || 0) === x0 && (OC.G.stats.md.harm || 0) === h0 && p.tr.includes('tnk'), 'and ordering it then is neither harm nor an extra'); }
assert(OC.CONTRA_IF.pe.tnk({ ck: 'pe' }), 'with no patient to read, tenecteplase counts as contraindicated');
p = mine('mpe');
assert(p.right.tr.includes('tnk') && !OC.contraOf(p).includes('tnk'), 'massive PE: tenecteplase is required');

// ampicillin over 50
p = mine('mening', { age: 64 });
assert((OC.reqLeft(p, 'abx') || []).some(g => g.includes('ampi')), 'meningitis at 64: ampicillin is required');
p = mine('mening', { age: 30 });
assert(!(OC.reqLeft(p, 'abx') || []).some(g => g.includes('ampi')), 'at 30 it is not');

// standard care
p = mine('appy', { sex: 'M', age: 30 });
let x0 = OC.G.stats.md.ordExtra || 0, w0 = OC.G.stats.md.wrongDrug || 0;
OC.signOrders(p.id, ['cbc'], ['ondan']);
assert((OC.G.stats.md.ordExtra || 0) === x0 && (OC.G.stats.md.wrongDrug || 0) === w0, 'ondansetron is never wrong');
p = mine('strep'); x0 = OC.G.stats.md.ordExtra || 0; w0 = OC.G.stats.md.wrongDrug || 0;
OC.signOrders(p.id, ['strep'], ['apap']);
assert((OC.G.stats.md.ordExtra || 0) === x0 && (OC.G.stats.md.wrongDrug || 0) === w0, 'acetaminophen is never wrong');
p = mine('apapod'); const h0 = OC.G.stats.md.harm || 0;
OC.signOrders(p.id, [], ['apap']);
assert((OC.G.stats.md.harm || 0) > h0, 'except in an acetaminophen overdose: there it is harm');
p = mine('burn'); w0 = OC.G.stats.md.wrongDrug || 0;
OC.signOrders(p.id, ['cbc'], ['hydro']);
assert((OC.G.stats.md.wrongDrug || 0) === w0 && !p.tr.includes('meds'), 'burns: hydromorphone (another opioid) works but is not the first choice: not wrong, and the order still needs the right one');
p = mine('pna'); w0 = OC.G.stats.md.wrongDrug || 0;
OC.signOrders(p.id, ['cbc'], ['metro']);
assert((OC.G.stats.md.wrongDrug || 0) === w0 + 1 && !p.tr.includes('abx'), 'antibiotics are specific: metronidazole for pneumonia is still the wrong drug');
p = mine('dka'); x0 = OC.G.stats.md.ordExtra || 0;
OC.signOrders(p.id, ['bmp'], ['kcl']);
assert((OC.G.stats.md.ordExtra || 0) === x0 && !p.right.tr.includes('kcl'), 'DKA: potassium is allowed, not required');

// where they go
for (const k of ['sah', 'cauda', 'sea']) { const c = OC.CASES.find(x => x.k === k); assert(c.con === 'nsurg' && c.dispo !== 'transfer', `${c.dx}: neurosurgery here, no transfer`); }
assert(OC.CASES.find(x => x.k === 'tfall').con === 'nsurg', 'the older head bleed calls neurosurgery');
const ds = OC.CASES.find(x => x.k === 'dissect');
assert(ds.dispo === 'transfer' && OC.SPECS.cts.phone, 'dissection transfers out; cardiothoracic surgery is a phone consult');
p = mine('dissect'); p.work.ct = { st: 'done' }; p.pre = [];
let r = OC.consult(p.id, 'cts');
assert(r.ok && p.consult.phone && /receiving hospital/.test(r.msg), 'calling cardiothoracic surgery is a phone call to the receiving hospital');

// class codes carry the version
OC.setCodeVersion('9.9.9', ['']);
const code = OC.classCode({ mode: 'rn', level: 'med', scen: 'none', pack: 'national', seed: 12345 });
assert(OC.readCode(code) && !OC.readCode(code).stale, 'a code reads on its own version');
OC.setCodeVersion('9.9.10', ['', '9.9.9']);
assert(OC.readCode(code) && OC.readCode(code).stale === '9.9.9', 'and is named stale on the next');
OC.setCodeVersion('', []);

// the load-time check catches broken data
{
  const fake = { k: 'zz', dx: 'Test', con: 'nobody', tr: ['nothing'], wk: ['lab'], dispo: 'home' };
  OC.CASES.push(fake); let msg = '';
  try { OC.lintCases(); } catch (e) { msg = e.message; }
  OC.CASES.pop();
  assert(/unknown specialist nobody/.test(msg) && /unknown treatment nothing/.test(msg), 'the load-time check names a case that points at something missing');
  let clean = true; try { OC.lintCases(); } catch (e) { clean = false; }
  assert(clean, 'and every real case passes it');
}

// same-class means the same job in the same way: wrong drugs from a broad menu class are still wrong
{
  let p = mine('status'); let w0 = OC.G.stats.md.wrongDrug || 0;
  OC.signOrders(p.id, ['gluc'], ['halo']);
  assert((OC.G.stats.md.wrongDrug || 0) === w0 + 1, 'status epilepticus: haloperidol is the wrong drug');
  p = mine('status'); w0 = OC.G.stats.md.wrongDrug || 0;
  OC.signOrders(p.id, ['gluc'], ['mannitol']);
  assert((OC.G.stats.md.wrongDrug || 0) === w0 + 1, 'status epilepticus: mannitol is the wrong drug');
  p = mine('migraine'); w0 = OC.G.stats.md.wrongDrug || 0;
  OC.signOrders(p.id, [], ['morph']);
  assert((OC.G.stats.md.wrongDrug || 0) === w0 + 1 || (OC.G.stats.md.ordExtra || 0) > 0, 'migraine: morphine is not a stand-in for the headache drugs');
  p = mine('sah'); const h0 = OC.G.stats.md.harm || 0; w0 = OC.G.stats.md.wrongDrug || 0; const x0 = OC.G.stats.md.ordExtra || 0;
  OC.signOrders(p.id, ['cthead'], ['ketor']);
  assert((OC.G.stats.md.harm || 0) === h0 + 1 && (OC.G.stats.md.wrongDrug || 0) === w0 && (OC.G.stats.md.ordExtra || 0) === x0, 'a contraindicated drug counts as harm once, not also as a wrong drug and an extra');
}
