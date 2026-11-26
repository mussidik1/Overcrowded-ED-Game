// Phase 3 (v0.32.0): the high-priority clinical content (the owner as clinical consultant, with a clinician's answers to three questions; Nov 25, 2026).
// Each check signs real orders on a real case, as a student would.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const roomFree = () => (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id;
function mine(k, o) {
  OC.newGame('easy', 1400 + k.length, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const p = OC.pt(OC.trainPatient(k, 'room', Object.assign({ room: roomFree() }, o || {}))); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); return p;
}
const md = () => OC.G.stats.md;
const sign = (k, tests, treats) => { const p = mine(k); const x0 = md().ordExtra || 0, w0 = md().wrongDrug || 0, h0 = md().harm || 0;
  const r = OC.signOrders(p.id, tests == null ? OC.needOf(p).n : tests, treats);   /* null: the case's needed tests */ return { p, r, miss: OC.missNow(p), extra: (md().ordExtra || 0) - x0, wrong: (md().wrongDrug || 0) - w0, harm: (md().harm || 0) - h0 }; };

// R6-09 severe asthma: magnesium is no substitute for a systemic steroid
let s = sign('asthma', [], ['albut', 'mag']);
assert(s.miss.length > 0 && s.extra === 0 && s.wrong === 0, `asthma: albuterol and magnesium without a steroid leaves the steroid missing; magnesium is fine, not wrong (missing ${s.miss})`);
s = sign('asthma', [], ['albut', 'dexa', 'mag']);
assert(s.miss.length === 0 && s.extra === 0, 'asthma: albuterol, a steroid and magnesium is complete');

// R6-11 anaphylaxis: IM epinephrine alone is the treatment; the add-ons are fine
s = sign('anaph', [], ['epiim']);
assert(s.miss.length === 0, 'anaphylaxis: IM epinephrine alone fills the order');
s = sign('anaph', [], ['diphen', 'methylpred']);
assert(s.miss.length > 0, 'anaphylaxis: an antihistamine and a steroid without epinephrine leaves epinephrine missing');
s = sign('anaph', [], ['epiim', 'diphen', 'famot', 'methylpred', 'ns', 'albut']);
assert(s.miss.length === 0 && s.extra === 0 && s.wrong === 0, 'anaphylaxis: fluids, a bronchodilator, H1/H2 blockers and a steroid are fine add-ons');

// R6-12 tranexamic acid in hemorrhagic shock
for (const k of ['mvc', 'moto']) {
  s = sign(k, [], ['txa']);
  assert(s.extra === 0 && s.wrong === 0 && s.harm === 0, `${k}: tranexamic acid is a fine add-on, not an extra`);
}

// R6-13 COPD on BiPAP: a steroid and an antibiotic are required
s = sign('copd', null, ['duoneb', 'bipap']);
assert(s.miss.length >= 2, `COPD on BiPAP: bronchodilator and BiPAP alone leave the steroid and the antibiotic missing (${s.miss})`);
s = sign('copd', null, ['duoneb', 'methylpred', 'azith', 'bipap']);
assert(s.miss.length === 0 && s.extra === 0, 'COPD: bronchodilator, steroid, antibiotic and BiPAP is complete');

// R6-14 combinations
s = sign('pna', null, ['o2', 'azith']);
assert(s.miss.length > 0 && s.wrong === 0, 'admitted pneumonia: azithromycin alone leaves the beta-lactam missing');
s = sign('pna', null, ['o2', 'ctx', 'azith']);
assert(s.miss.length === 0, 'admitted pneumonia: ceftriaxone plus azithromycin is complete');
s = sign('shock', null, ['o2', 'ns', 'vanc', 'norepi']);
assert(s.miss.length > 0, 'septic shock: vancomycin alone leaves gram-negative cover missing');
s = sign('shock', null, ['o2', 'ns', 'piptazo', 'vanc', 'pushepi']);
assert(s.miss.length > 0 && s.extra === 0 && s.wrong === 0, 'septic shock: push-dose epinephrine is a fine bridge but not the pressor (norepinephrine still missing)');
s = sign('shock', null, ['o2', 'ns', 'piptazo', 'vanc', 'norepi']);
assert(s.miss.length === 0, 'septic shock: fluids, broad antibiotics and norepinephrine is complete');

// R6-15 DKA with potassium 4.8: potassium is required; insulin may go on the same sheet as the BMP
s = sign('dka', ['bmp', 'vbg'], ['ns', 'insdrip']);
assert(s.r.ok && s.miss.length > 0, `DKA: fluids and insulin without potassium leaves potassium missing (${s.miss})`);
s = sign('dka', ['bmp', 'vbg'], ['ns', 'insdrip', 'kcl']);
assert(s.r.ok && s.miss.length === 0 && s.harm === 0, 'DKA: fluids, insulin and potassium on one sheet with the BMP is complete and not harm');

// R6-17 TIA with a low ABCD2: home or observation both right
let low = 0, both = 0;
for (let i = 0; i < 60; i++) {   // the risk score comes from the dice: many seeds, every low one checked
  OC.newGame('easy', 9000 + i, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const g = OC.pt(OC.trainPatient('tia', 'room', { room: roomFree() })).gray; if (!g || g.band !== 'low') continue;
  low++; if (g.right === 'home' && g.ok.includes('obs')) both++;
}
assert(low > 0 && both === low, `TIA with ABCD2 0 to 3: home is right and observation is also accepted (${both} of ${low})`);

// R6-02 strokes: not every stroke is a candidate for the clot buster, and the reason is on the patient
const kinds = { in: 0, late: 0, wake: 0, thin: 0 }; let okKey = true, harmOk = true;
for (let i = 0; i < 120; i++) {
  OC.newGame('easy', 7000 + i, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const k = ['strokew', 'stroke', 'lvo'][i % 3];
  const p = OC.pt(OC.trainPatient(k, 'room', { room: roomFree() })); p.hk = 'stroke-test-' + i; OC.strokeSetup(p); kinds[p.strokeKind]++;   // set up as a real arrival is, from its id
  const canLyse = p.tr.includes('tnk');
  if ((p.strokeKind === 'in') !== canLyse) okKey = false;
  if (p.strokeKind === 'thin' && (!p.anticoag || !OC.contraWhy(p, 'tnk').includes('blood thinner'))) harmOk = false;
  if (p.strokeKind === 'wake' && p.lkwT != null) okKey = false;
}
assert(kinds.in > 50 && kinds.late > 5 && kinds.wake > 5 && kinds.thin > 5, `strokes vary: inside the window, late, woke up with it, on a blood thinner (${JSON.stringify(kinds)})`);
assert(okKey, 'only a stroke inside the window has the clot buster in its answer key; a wake-up stroke has no last-known-well time');
assert(harmOk, 'a stroke on a blood thinner: the clot buster is harm, and the reason says so without naming the diagnosis');
const scripted = OC.pt((OC.newGame('train', 31, {}), OC.trainPatient('stroke', 'alert', { lkw: 40, eta: 2 })));
assert(scripted.strokeKind === 'in' && scripted.tr.includes('tnk') && !scripted.anticoag, 'a scripted stroke (Orientation, lessons) stays a clot-buster candidate');

// R6-16 risk scores: the number is the sum of the parts on the card, and the age part matches the patient's age
let sums = true, ages = true, n16 = 0;
for (let i = 0; i < 90; i++) {
  OC.newGame('easy', 8800 + i, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
  const p = OC.pt(OC.trainPatient(['pnalow', 'cwp', 'cpmod', 'tia'][i % 4], 'room', { room: roomFree() })), g = p.gray; if (!g) continue; n16++;
  const total = g.parts.reduce((a, x) => a + (+((/\((\d+)\)$/.exec(x) || [])[1]) || 0), 0);
  if (total !== g.score) sums = false;
  const agePart = g.parts.find(x => /^age/.test(x));
  if (g.tool === 'CURB-65' && !!agePart !== (p.age >= 65)) ages = false;
  if (g.tool === 'ABCD2 score' && !!agePart !== (p.age >= 60)) ages = false;
  if (g.tool === 'HEART score' && (p.age >= 45) !== !!agePart) ages = false;
}
assert(n16 > 40 && sums, `every risk score is the sum of the parts listed on the card (${n16} patients)`);
assert(ages, "every risk score's age part matches the patient's age");

// R6-18 the first order set is graded against the presenting complaint, not the hidden diagnosis
let clean18 = [], harm18 = [];
for (const [g, w] of Object.entries(OC.WORKUP)) for (const k of w.cases) {
  const s18 = sign(k, w.det, w.rx), lowBp = OC.vitalsOf(s18.p).sbp < 90, opi = w.rx.filter(d => ['morph', 'fent', 'hydro'].includes(d)).length;
  if (lowBp && s18.extra > opi) clean18.push(`${k}: extra ${s18.extra} with a low pressure`);
  if (lowBp && opi && !s18.extra) clean18.push(`${k}: an opioid on a low pressure passed as the workup`);   // round 12, R3.12-04
  if (!lowBp && (s18.extra || s18.wrong)) clean18.push(`${k}: extra ${s18.extra}, wrong ${s18.wrong}`);
  if (s18.harm) harm18.push(k);
}
assert(!clean18.length, `every case's first sheet with its complaint's standard workup has no extras and no wrong drugs${clean18.length ? ': ' + clean18.join('; ') : ''}`);
console.log('ok -   (harm still counts on the first sheet where a workup drug can hurt: ' + (harm18.join(', ') || 'none') + ')');
// after the first sheet, the case's own key applies again: a chest-pain test ordered later for a belly patient is an extra
let p18 = mine('appy'); OC.signOrders(p18.id, OC.needOf(p18).n, []); const x18 = md().ordExtra || 0;
OC.signOrders(p18.id, ['trop'], []);
assert((md().ordExtra || 0) === x18 + 1, 'after the first sheet, an order outside the case\'s own key is an extra again');
// a needed order still fills its need on the first sheet
p18 = mine('migraine'); OC.signOrders(p18.id, [], ['prochlor']);
assert(p18.tr.includes('meds'), 'a workup drug that is also the needed drug still fills the need');

// Round 12 (the release review)
// R6.12-01: a stroke that can't have the thrombolytic has no door-to-needle goal and no pressure order (permissive hypertension);
// a large-vessel stroke over the limit keeps it (clot removal); the teaching line doesn't promise the drug
{ let bad = 0, seen = {};
  for (let i = 0; i < 300; i++) for (const ck of ['stroke', 'strokew', 'lvo']) {
    const p = { id: 'r12s' + i, ck, alert: 'stroke', tr: ['tnk'], goals: { ct25: null, dtn60: null } }; OC.strokeSetup(p); seen[p.strokeKind] = 1;
    const over = p.bp0[0] > 185, cand = p.strokeKind === 'in' || ck === 'lvo';
    if (p.strokeKind !== 'in' && ('dtn60' in p.goals || p.tr.includes('tnk'))) bad++;
    if (p.strokeKind === 'in' && !('dtn60' in p.goals)) bad++;
    if (p.tr.includes('bp') !== (over && cand)) bad++;
    if (p.strokeKind !== 'in' && /Then the clot-busting drug/.test(OC.ordWhy(p))) bad++;
  }
  assert(bad === 0 && seen.late && seen.wake && seen.thin && seen.in, `strokes outside the window: no door-to-needle goal, no pressure order unless a large-vessel stroke, no promise of the drug (${bad} wrong)`);
}
// R1.12-02: a needed drug that is also an add-on fills the need (IV fluids in anaphylactic shock)
{ const p = mine('anaph'); p.right.tr.push('fluids'); OC.signOrders(p.id, [], ['epiim', 'ns']);
  assert(p.tr.includes('fluids') && !OC.missNow(p).length, 'anaphylactic shock: normal saline fills the fluids it needs, not just "also reasonable"'); }
// R6.12: cefepime is a broad antibiotic for septic shock, with vancomycin
s = sign('shock', null, ['o2', 'ns', 'cefepime', 'vanc', 'norepi']);
assert(s.miss.length === 0 && s.extra === 0 && s.wrong === 0, 'septic shock: cefepime and vancomycin fill the antibiotics');
// R6.12-07: the HEART risk-factor part matches the exam (diabetes and high blood pressure: 1 point), so cpmod is never "high"
{ let bad = 0;
  for (let i = 0; i < 200; i++) { OC.newGame('easy', 7000 + i, {}); const p = OC.pt(OC.trainPatient('cpmod', 'walk', { age: 45 + (i % 31) }));
    const g = p.gray; if (!g.parts.some(x => /risk factors: diabetes, high blood pressure \(1\)/.test(x)) || g.score > 6 || g.band === 'high') bad++; }
  assert(bad === 0, `chest pain, moderate risk: risk factors score 1, and the HEART score stays 6 or under (${bad} wrong)`); }
// Grace (Orientation, age 58): the score uses the age she shows, so observation is the call
OC.newGame('train', 3, {}); { const g = OC.pt(OC.trainPatient('cpmod', 'walk', { name: 'Grace T.', age: 58, sex: 'F' })).gray;
  assert(g.parts.some(x => /age 45 to 64 \(1\)/.test(x)) && g.right === 'obs', `Grace's HEART score counts age 58 and reads observation (${g.score}, ${g.right})`); }
// R1.12-06: the whole complaint list on the first sheet is allowed, but it isn't a clean set
{ const p = mine('migraine'); const c0 = md().clean || 0; OC.signOrders(p.id, ['cbc', 'bmp', 'cthead'], ['prochlor']);
  assert((md().clean || 0) === c0, 'the complaint workup beyond the case\'s own key earns no clean-set bonus'); }
// R5.12-08: the CURB-65 card's BUN matches the BMP
{ let bad = 0; for (let i = 0; i < 60; i++) { OC.newGame('easy', 8100 + i, {}); const p = OC.pt(OC.trainPatient('pnalow', 'walk', {}));
    const hi = (p.gray.parts || []).some(x => /^BUN 24/.test(x)), b = OC.detResult ? OC.detResult(p, 'bmp')[0] : null; if (b && hi !== /BUN 24/.test(b)) bad++; }
  assert(bad === 0, `the BMP shows the BUN the CURB-65 card counts (${bad} wrong)`); }
