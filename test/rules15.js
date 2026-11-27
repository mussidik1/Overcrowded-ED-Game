// Phase 6 (v0.33.0): game design. The owner's decisions (Nov 26, 2026): the attending is graded on the attending's own decisions;
// regular shifts don't give answers away (Orientation and Lessons still teach); Rush stars take real play; the attending's load grows with
// the level; a career rank per role.
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};

// R5-03: the attending's stars come from clinical, diagnoses, radio calls and legal risk, not the department's scores
OC.newGame('med', 51, { mode: 'md' }); let G = OC.G;
const sc = OC.scores();
G.stats.md.dxRight = 1; G.stats.md.dxWrong = 3; G.stats.boxC.right = 2; G.stats.boxC.wrong = 4; G.stats.boxC.miss = 2; G.lit = 70;
let m = OC.mdScores();
assert(m.dx === 25 && m.radio === 25 && m.legal === 30, `the attending's own parts: diagnoses ${m.dx}%, radio ${m.radio}%, legal ${m.legal}%`);
assert(OC.overallStars() <= 1, `a shift with most diagnoses and radio calls wrong and high legal risk earns at most one star, whatever the department did (${OC.overallStars()}; department ${JSON.stringify(sc)})`);
G.stats.md.dxRight = 4; G.stats.md.dxWrong = 0; G.stats.boxC.right = 8; G.stats.boxC.wrong = 0; G.stats.boxC.miss = 0; G.lit = 5;
m = OC.mdScores();
assert(OC.avgScore() === Math.round((m.clinical + m.dx + m.radio + m.legal) / 4), 'the attending\'s score is the average of the four own parts');
OC.newGame('med', 52, { mode: 'md' }); m = OC.mdScores();
assert(m.dx === null && m.radio === null && OC.avgScore() === Math.round((m.clinical + m.legal) / 2), 'a part with nothing to grade yet is left out, not counted as perfect');
OC.newGame('med', 53, {});
assert(OC.mdScores && OC.avgScore() === (s => Math.round([s.patients, s.clinical, s.admin, s.staff].filter(x => x != null).reduce((a, b) => a + b, 0) / [s.patients, s.clinical, s.admin, s.staff].filter(x => x != null).length))(OC.scores()), 'the charge nurse is still graded on the four department scores');

// R5-05: regular shifts don't give the answers away
const CAP = (k, o) => { const p = OC.pt(OC.trainPatient(k, 'room', Object.assign({ room: (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id }, o || {}))); return p; };
OC.newGame('med', 61, { mode: 'md' }); G = OC.G; G.train = null; G.card = null;
{ const p = CAP('appy'); p.prov = G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); p.dxq = ['Appendicitis', 'Gastroenteritis']; const wrong = OC.DDX && OC.DDX.appy ? OC.DDX.appy[0] : 'Gastroenteritis';
  const r = OC.dxPick(p.id, wrong);
  assert(r.ok && !/It’s|Right:/.test(r.msg) && r.msg.includes(wrong), `on a shift, a diagnosis gets no instant verdict ("${r.msg}")`); }
{ const p = CAP('stemi'); p.prov = G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); const other = Object.keys(OC.SPECS).find(s => s !== p.con && s !== 'hosp');
  const r = OC.consult(p.id, other);
  assert(r && !r.ok && !/Try |Call [A-Z]/.test(r.why || '') && !/Try /.test(p.conNote || ''), `on a shift, a wrong consult is declined without naming the right service ("${r && r.why}")`); }
OC.newGame('med', 62, { mode: 'md' }); G = OC.G;
{ G.train = null;
  OC.newGame('med', 63, { mode: 'md' }); let seen = 0, known = 0;
  for (let i = 0; i < 4000 && seen < 3; i++) { OC.step(0.25); for (const q of Object.values(OC.G.pts)) if (q.alertOn && q.alert && q.alert !== 'arrest' && !q.crash && q.loc === 'enroute' && !q._seen) { q._seen = 1; seen++; if (q.dxK) known++; } }
  assert(seen > 0 && known === 0, `on the attending's shift, an incoming alert doesn't carry its diagnosis (${known} of ${seen} known before any test)`); }
OC.newGame('med', 64, {});
{ let seen = 0, known = 0; for (let i = 0; i < 4000 && seen < 3; i++) { OC.step(0.25); for (const q of Object.values(OC.G.pts)) if (q.alertOn && q.alert && q.alert !== 'arrest' && q.loc === 'enroute' && !q._seen) { q._seen = 1; seen++; if (q.dxK) known++; } }
  assert(seen === known, 'the charge nurse still sees what the alert is'); }

// R5-04: the attending's own load grows with the level: on harder levels the game's charge nurse hands the sickest patients to you
{ const mine = lv => { let n = 0; for (let s = 1; s <= 3; s++) { OC.newGame(lv, 700 + s, { mode: 'md' }); for (let i = 0; i < 1200; i++) OC.step(0.1);   // two game hours, the attending taking nobody
    n += Object.values(OC.G.pts).filter(p => p.prov === OC.G.me && p.esi <= 2).length; } return n; };
  const e = mine('easy'), h = mine('hard');
  assert(e === 0 && h > 0, `the sickest new patients go to the attending on Full Moon Friday (${h}), not on Quiet Tuesday (${e})`); }
// R5-04: the charge nurse's Rush stars are capped by pace
assert(OC.paceStars(12) === 3 && OC.paceStars(20) === 2 && OC.paceStars(35) === 1 && OC.paceStars(50) === 0, 'Rush pace: 15, 25 and 40 minutes from the door to a provider for three, two and one stars');

// QA-10: a risky treatment with no indication (tenecteplase for DKA) is named as unsafe when signed, with a reason, and in the review
OC.newGame('easy', 81, { mode: 'md' }); G = OC.G; G.train = null; G.card = null;
{ const p = CAP('dka'); p.prov = G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p);
  const r = OC.signOrders(p.id, OC.needOf(p).n, ['ns', 'insulin', 'kcl', 'tnk']);
  assert(r.ok && /Can hurt them: Thrombolytic/.test(r.msg) && (p.ordLog.unsafe || []).some(x => /Thrombolytic/.test(x)), `an unneeded thrombolytic is named as unsafe at signing and in the review ("${r.msg}")`); }

// QA2-1: on a shift a diagnosis scores when the patient leaves, not when it is picked (nothing on screen moves at the pick)
OC.newGame('easy', 91, { mode: 'md' }); G = OC.G; G.train = null; G.card = null;
{ const p = CAP('stemi'); p.prov = G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); p.dxq = [p.dx, 'Pericarditis', 'Aortic dissection'];
  const lit0 = G.lit || 0, w0 = G.stats.md.dxWrong || 0; OC.dxPick(p.id, 'Pericarditis');
  assert((G.lit || 0) === lit0 && (G.stats.md.dxWrong || 0) === w0 && G.stats.md.dxCalled >= 1, 'a wrong call changes no score or legal risk at the pick');
  OC.settleDx(p); assert((G.stats.md.dxWrong || 0) === w0 + 1 && G.lit > lit0, 'and counts when it settles (the patient leaves, or the shift ends)'); }
// QA2-3: the syncope risk score is built from the patient's parts, and the diagnosis doesn't name the risk band
OC.newGame('easy', 92, {});
for (const k of ['syncope', 'synchigh', 'cpmod', 'cwp']) { const p = OC.pt(OC.trainPatient(k, 'walk', {})); assert(!/risk/.test(p.dx) && p.gray.parts.length >= 2 && p.gray.parts.reduce((n, x) => n + +(x.match(/\((-?\d+)\)$/) || [0, 0])[1], 0) === p.gray.score, `${k}: the score is the sum of its listed parts (${p.gray.score}) and the diagnosis "${p.dx}" doesn't name the band`); }

// QA3-2: on the attending's shift, the bleeding warning says what the nurse sees, not the diagnosis and its treatment
{ const msgs = []; OC.hooks.toast = m => msgs.push(String(m));
  OC.newGame('med', 95, { mode: 'md' }); G = OC.G; G.train = null; G.card = null;
  const p = CAP('mvc'); p.bleed = 'mtp'; p.bb = null; p.tArrive = G.t - 16; p.dsp = 'none'; p.shock = false; for (let i = 0; i < 12; i++) OC.step(0.1);
  assert(msgs.some(m => /pressure is falling/.test(m)) && !msgs.some(m => /hemorrhagic shock|massive transfusion/i.test(m)), `the attending hears the signs, not "hemorrhagic shock" (${msgs.filter(m => /pressure|shock/.test(m)).join(' | ')})`);
  OC.hooks.toast = () => {}; }

// QA4-4: a patient the charge nurse hands over waits for the attending: no credit and no exam until See this patient
{ OC.newGame('hard', 702, { mode: 'md' }); for (let i = 0; i < 1200; i++) OC.step(0.1);
  const h = Object.values(OC.G.pts).filter(p => p.handed && p.prov === OC.G.me);
  assert(h.length > 0 && h.every(p => !p.mine && p.ev === 'none') && (OC.G.stats.md.seen || 0) === 0, `handed-over patients wait for the attending: none counted as seen, none examined (${h.length} handed)`); }
// QA4-3: a missed radio call is one of the attending's worst moments
{ OC.newGame('rush', 703, { mode: 'md' }); while (!OC.G.over) OC.step(0.5);
  const R = OC.G.report; assert(!(R.boxC && R.boxC.miss) || (R.mm || []).some(m => /radio call/.test(m.what)), `an idle attending's M&M lists the missed radio calls (${(R.boxC || {}).miss || 0} missed)`); }

// QA5-3: staff actions and radio calls don't land in the attending's own clinical score or disposition points
{ OC.newGame('rush', 704, { mode: 'md' }); while (!OC.G.over) OC.step(0.5);
  const R = OC.G.report; assert(!(R.md && R.md.seen) && !(OC.G.stats.md.unseen) ? R.own.clinical >= 90 : true, `an attending who saw nobody isn't graded down on Clinical for radio calls (only for patients left unseen) (Clinical ${R.own.clinical}%, Radio ${R.own.radio}%)`); }

// QA6-2: patients put on the attending's list and never seen count against the attending
{ OC.newGame('med', 705, { mode: 'md' }); while (!OC.G.over) OC.step(0.5);
  const R = OC.G.report, n = (OC.G.stats.md || {}).unseen || 0;
  assert(n > 0 && R.own.clinical < 90 && (R.mm || []).some(m => /never seen/.test(m.what)) && R.stars <= 1, `an idle attending's unseen patients cost Clinical and stars and reach the M&M (${n} unseen, Clinical ${R.own.clinical}%, ${R.stars} stars)`); }
