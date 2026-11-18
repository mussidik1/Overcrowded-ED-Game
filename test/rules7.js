// v0.20: bed first for sick patients (registration follows at the bedside), and class codes (the same shift for everyone).
const OC = require('../src/engine.js');
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const clearCard = () => { if (OC.G.card) OC.chooseCard(OC.G.card.choices.find(c => !c.dis).k); };
function run(min, fn) { const n = Math.round(min / 0.1); for (let i = 0; i < n; i++) { clearCard(); OC.step(0.1); if (fn && fn()) return true; } return false; }
const free = () => OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && r.kind !== 'resus').id;

// 1. Bed first
OC.newGame('easy', 501, { mode: 'rn' }); let G = OC.G;
const sx = OC.trainPatient('cpmod', 'walk'), sick = typeof sx === 'string' ? OC.pt(sx) : sx;   // chest pressure: ESI 2
run(5, () => sick.loc === 'triage');
assert(sick.loc === 'triage' && sick.reg === 'none' && sick.tri !== 'done' && OC.looksSick(sick), 'a chest-pain walk-in at the door, not registered or triaged, looks sick');
const rid = free(); let r = OC.place(sick.id, rid);
assert(r.ok && sick.loc === 'room' && sick.reg === 'none' && /registrar/.test(r.msg), `a patient who looks sick goes straight to a bed, and the message says to send a registrar (${r.msg})`);
assert(sick.tri === 'done' || sick.triaging || sick.tTriage != null, 'they are triaged at the bedside');
const wx = OC.trainPatient('ankle', 'walk'), well = typeof wx === 'string' ? OC.pt(wx) : wx;
run(5, () => well.loc === 'triage');
r = OC.place(well.id, free());
assert(!r.ok && /Register/.test(r.why) && !OC.looksSick(well), `a stable walk-in still registers first (${r.why})`);
run(25);
assert(sick.reg === 'none', 'idle registrars do not register the bedded patient on their own: the player sends one');
const reg = G.staff.find(s => s.role === 'reg' && s.st === 'on');
r = OC.register(sick.id, reg.id);
run(30, () => sick.reg === 'done');
assert(r.ok && sick.reg === 'done', 'sending a registrar to the room registers them fully at the bedside');
assert(G.stats.bedFirst === 1, 'the shift counts patients bedded before registration');

// 2. Class codes
const o = { mode: 'md', level: 'hard', scen: 'ct', pack: 'miemss', seed: 77777 };
const code = OC.classCode(o), back = OC.readCode(code);
assert(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/.test(code) && back && back.mode === 'md' && back.level === 'hard' && back.scen === 'ct' && back.pack === 'miemss' && back.seed === 77777, `a class code carries role, shift, scenario, pack and seed (${code})`);
assert(OC.readCode(code.toLowerCase().replace('-', ' ')).seed === 77777, 'it reads typed in lower case, with a space');
let typo = 0, tries = 0; for (let i = 0; i < 6; i++) for (const ch of '0123456789ABCDEFGHJKMNPQRSTVWXYZ') { const s = code.replace('-', ''); if (s[i] === ch) continue; tries++; if (OC.readCode(s.slice(0, i) + ch + s.slice(i + 1))) typo++; }
assert(typo / tries < 0.03, `a one-character typo is almost always refused (${typo} of ${tries} accepted)`);
const bad = code.slice(0, 6) + (code[6] === 'A' ? 'B' : 'A');
assert(OC.readCode(bad) === null && OC.readCode('HELLO') === null, 'a mistyped code is refused, not turned into a different shift');
let all = true; for (const lv of ['rush', 'easy', 'med', 'hard']) for (const sc of Object.keys(OC.SCENS)) for (const md of ['rn', 'md']) { const c = OC.classCode({ mode: md, level: lv, scen: sc, pack: 'national', seed: 12345 }), b = OC.readCode(c); if (!b || b.level !== lv || b.scen !== sc || b.mode !== md) all = false; }
assert(all, 'every shift, scenario and role round-trips');

// 3. Same code, same patients, whatever each player does
function arrivalsOf(seed, busy) {
  OC.newGame('med', seed, { mode: 'rn' });
  for (let i = 0; i < 3000; i++) { clearCard(); if (busy && i % 3 === 0) OC.botStep({}); OC.step(0.1); }
  const L = OC.G.order.map(id => OC.G.pts[id]).filter(p => p.tArrive >= 0 && p.sched);
  return { walk: L.filter(p => p.src !== 'ems').map(p => p.ck + '@' + Math.round(p.tArrive)).join(' '), ems: L.filter(p => p.src === 'ems').map(p => p.ck + '@' + Math.round(p.tArrive)), div: OC.G.divLog || [] };
}
const a = arrivalsOf(4321, false), b = arrivalsOf(4321, true);
assert(a.walk.split(' ').length > 15 && a.walk === b.walk, `two players on the same code get the same walk-ins at the same times over five hours, one idle and one busy (${a.walk.split(' ').length})`);
const bAll = b.ems.concat(b.div).sort().join(' '), aAll = a.ems.concat(a.div).sort().join(' ');
assert(a.ems.length > 8 && bAll === aAll, `and the same scheduled ambulances: the ones a player's divert sent elsewhere make up the difference (${a.ems.length} vs ${b.ems.length} + ${b.div.length} diverted)`);
assert(arrivalsOf(4322, false).walk !== a.walk, 'a different code gives a different shift');
