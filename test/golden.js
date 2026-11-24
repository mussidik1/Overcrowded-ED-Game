// Phase 0 safety net (audit, Nov 2026). Characterization tests: they record what the game does today, so a later change
// that alters a shift, a class code, a save or an answer key shows up as a diff instead of slipping through.
//   node test/golden.js            compare with test/golden.json (any difference is a FAIL)
//   node test/golden.js --update   rewrite test/golden.json (do this only on purpose, and say why in the commit)
// Sections:
//   shifts   one seeded shift per role x level x scenario, played by the autopilot: a fingerprint of arrivals and outcome
//   streams  the same shift played two different ways gets the same arrivals (what keeps a class in sync)
//   codes    20 class codes and what they decode to, for this game version
//   save     save mid-shift, load, play on: identical to an unbroken run
//   answers  the textbook orders for every case (the answer key), so clinical changes are visible in review
const fs = require('fs'), path = require('path');
const OC = require('../src/engine.js');
OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
const FILE = path.join(__dirname, 'golden.json');
const UPDATE = process.argv.includes('--update');
const VERSION = require('../package.json').version;

function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); }
const arrivals = () => OC.G.order.map(id => OC.G.pts[id]).filter(p => p.tArrive >= 0).map(p => `${p.ck}@${Math.round(p.tArrive * 10)}${p.src === 'ems' ? 'e' : ''}`);
// new walk-ins (not return visits, which come from that player's own discharges): these must match all shift long on one code
// (patients made by events, such as a VIP or a bus crash, are left out: events can be held back by what the player is doing)
const walkIns = () => OC.G.order.map(id => OC.G.pts[id]).filter(p => p.tArrive >= 0 && p.src !== 'ems' && !p.ret && p.ck !== 'vip' && !/^mci/.test(p.ck)).map(p => [p.ck, p.tArrive]);

function play(mode, level, scen, seed, style) {
  OC.newGame(level, seed, { mode, scen });
  const acc = style === 'careless' ? 0.2 : 0.6, budget = style === 'careless' ? 1 : 2;
  let since = 0, n = 0;
  while (!OC.G.over && n++ < 16000) {
    OC.step(0.1); since += 0.1;
    if (OC.G.card) OC.botStep({ budget: 0 });
    if (since >= 1.5) { since = 0; if (mode === 'md') OC.mdPlay({ budget: 1, acc, line: 1 }); else OC.botStep({ budget, acc }); }
  }
  return OC.G.report;
}

const out = { version: VERSION, shifts: {}, streams: {}, codes: [], save: {}, answers: {} };

// ---- shifts
const RUNS = [];
for (const mode of ['rn', 'md']) for (const level of ['rush', 'easy', 'med', 'hard']) RUNS.push([mode, level, 'none']);
for (const scen of Object.keys(OC.SCENS)) if (scen !== 'none') RUNS.push(['rn', 'med', scen]);
RUNS.push(['md', 'med', 'board']);
for (const [mode, level, scen] of RUNS) {
  const R = play(mode, level, scen, 424242);
  const a = arrivals();
  out.shifts[`${mode}/${level}/${scen}`] = {
    arrivals: a.length, arrivalsHash: fnv(a.join(',')),
    seen: R.seen, dc: R.dc, adm: R.adm, proc: R.proc, tx: R.tx, lwbs: R.lwbs, ama: R.ama, expired: R.expired, left: R.left,
    care: R.care, wait: R.wait, stars: R.stars, fail: R.fail || null, lit: R.lit, acc: R.acc,
    stateHash: fnv(JSON.stringify(OC.G)),
  };
}

// ---- streams: two players on one code get the same patients at the same times
for (const [mode, level] of [['rn', 'med'], ['rn', 'hard'], ['md', 'med']]) {
  play(mode, level, 'none', 777, 'normal'); const a = arrivals(), w1 = walkIns(), end1 = OC.G.t;
  play(mode, level, 'none', 777, 'careless'); const b = arrivals(), w2 = walkIns(), end2 = OC.G.t;
  const upTo = (w, t) => w.filter(x => x[1] <= t).map(x => `${x[0]}@${Math.round(x[1] * 10)}`).join(',');   // a fired or walked-out shift ends early
  const wa = upTo(w1, Math.min(end1, end2)), wb = upTo(w2, Math.min(end1, end2));
  // compare the first 2 hours: later arrivals can legitimately differ once diversion status differs between players
  const early = list => list.filter(x => +x.split('@')[1].replace('e', '') <= 1200).join(',');
  out.streams[`${mode}/${level}`] = { sameEarlyArrivals: early(a) === early(b), sameWalkIns: wa === wb, hash: fnv(early(a)), walkHash: fnv(wa) };
}

// ---- codes
OC.setCodeVersion(VERSION, []);
const levels = ['rush', 'easy', 'med', 'hard'], scens = Object.keys(OC.SCENS), packs = Object.keys(OC.PACKS);
for (let i = 0; i < 20; i++) {
  const o = { mode: i % 2 ? 'md' : 'rn', level: levels[i % 4], scen: scens[i % scens.length], pack: packs[i % packs.length], seed: (i * 7919 + 13) % 131072 };
  const code = OC.classCode(o), back = OC.readCode(code);
  out.codes.push({ in: o, code, roundTrip: !!back && back.mode === o.mode && back.level === o.level && back.scen === o.scen && back.pack === o.pack && back.seed === o.seed });
}
OC.setCodeVersion('', []);

// ---- save round trip
{
  const go = to => { let n = 0; while (OC.G.t < to && !OC.G.over && n++ < 20000) { OC.step(0.1); if (OC.G.card) OC.botStep({ budget: 0 }); if (n % 15 === 0) OC.botStep({ budget: 2, acc: 0.6 }); } };
  OC.newGame('med', 9090, { mode: 'rn' });
  const t0 = OC.G.t; go(t0 + 180);
  const saved = JSON.stringify(OC.G);
  go(t0 + 360); const unbroken = fnv(JSON.stringify(OC.G));
  OC.load(JSON.parse(saved)); go(t0 + 360); const resumed = fnv(JSON.stringify(OC.G));
  out.save = { identical: unbroken === resumed, bytesAt3h: saved.length > 0 };
}

// ---- answers: the textbook orders for each case
{
  const roomFree = () => (OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso) || {}).id;
  for (const c of OC.CASES) {
    if (/^(mci|ret)/.test(c.k) || c.src === 'm' || c.ift === 'only') continue;
    OC.newGame('easy', 1000 + c.k.length, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
    let p; try { p = OC.pt(OC.trainPatient(c.k, 'room', { room: roomFree() })); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p); } catch (e) { out.answers[c.k] = 'error: ' + e.message; continue; }
    if (!p || !p.right) { out.answers[c.k] = 'no key'; continue; }
    const tests = OC.needOf(p).n.slice().sort();
    const treats = p.right.tr.map(t => { const g = OC.reqLeft(p, t); return g ? t + '=' + g.map(x => x.join('/')).join('+') : t; });
    out.answers[c.k] = { tests, treats, dx: p.dx || c.dx || null, ok: OC.RXOK[c.k] || null, also: (OC.ALSO || {})[c.k] || null, contra: OC.contraOf(p).slice().sort() };
  }
}

// ---- compare
if (!UPDATE && !fs.existsSync(FILE)) { console.error('FAIL: test/golden.json is missing. Restore it from git, or run npm run golden:update on purpose.'); process.exitCode = 1; }
else if (UPDATE) {
  fs.writeFileSync(FILE, JSON.stringify(out, null, 1) + '\n');
  console.log('ok - wrote test/golden.json');
} else {
  const old = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let fails = 0;
  const cmp = (sec, k, a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.error(`FAIL: golden ${sec}/${k} changed:\n   was ${JSON.stringify(b)}\n   now ${JSON.stringify(a)}`); } };
  if (old.version !== VERSION) console.log(`note - golden.json was made on ${old.version}; this is ${VERSION}`);
  for (const sec of ['shifts', 'streams', 'save']) for (const k of new Set([...Object.keys(out[sec]), ...Object.keys(old[sec] || {})])) cmp(sec, k, out[sec][k], (old[sec] || {})[k]);
  out.codes.forEach((c, i) => cmp('codes', i, c, old.codes[i]));
  for (const k of new Set([...Object.keys(out.answers), ...Object.keys(old.answers || {})])) cmp('answers', k, out.answers[k], (old.answers || {})[k]);
  if (!fails) console.log(`ok - golden: ${Object.keys(out.shifts).length} shifts, ${Object.keys(out.streams).length} stream checks, ${out.codes.length} codes, save round trip, ${Object.keys(out.answers).length} answer keys unchanged`);
  else { console.error(`FAIL: ${fails} golden difference(s). If they are intended, run: node test/golden.js --update, and say why in the commit.`); process.exitCode = 1; }
}
// invariants that must hold whatever the snapshot says
const inv = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
inv(out.codes.every(c => c.roundTrip), 'every class code decodes to what made it');
inv(out.save.identical, 'a saved and reloaded shift plays on exactly like an unbroken one');
inv(Object.values(out.streams).every(s => s.sameEarlyArrivals), 'two players on one shift get the same arrivals for the first two hours, however they play');
inv(Object.values(out.streams).every(s => s.sameWalkIns), 'and the same new walk-ins all shift long');
