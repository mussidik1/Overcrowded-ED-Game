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

// The state fingerprint ignores wording: strings longer than 24 characters (log lines, messages, notes) are blanked, so a copy edit
// doesn't fail a shift, while ids, keys, numbers and outcomes still count (R1.2-01).
const stateHash = () => {   // R2.2-01: a fingerprint of what happened (each patient's path and the shift's numbers), not of the state's shape
  const pts = OC.G.order.map(id => OC.G.pts[id]).map(p => [p.ck, Math.round(p.tArrive * 10), p.loc, p.outcome || '', p.dsp, p.esi, Math.round((p.tDone || 0) * 10), p.room || '', p.prov || '', p.arrest ? 1 : 0, (p.tr || []).join('+')].join(':'));
  const num = o => Object.keys(o || {}).sort().filter(k => typeof o[k] === 'number').map(k => k + '=' + Math.round(o[k] * 10));
  return fnv(pts.join('|') + '#' + num(OC.G.stats).join(',') + '#' + num(OC.G.stats.md).join(',') + '#' + Math.round(OC.G.care));
};
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16).padStart(8, '0'); }
const arrivals = () => OC.G.order.map(id => OC.G.pts[id]).filter(p => p.tArrive >= 0).map(p => `${p.ck}@${Math.round(p.tArrive * 10)}${p.src === 'ems' ? 'e' : ''}${p.ret ? 'R' : ''}`);   // R: a return visit (play-driven)
// new walk-ins (not return visits, which come from that player's own discharges): these must match all shift long on one code
// (patients made by events, such as a VIP or a bus crash, are left out: events can be held back by what the player is doing)
// the clinical facts "from the patient" (rhythm, stroke onset, A-fib onset, infant months) must match too, not only the case and time (R3.3-01)
const facts = () => { const m = {}; for (const p of OC.G.order.map(id => OC.G.pts[id])) if (p.tArrive >= 0 && p.hk) m[p.hk] = `${p.ck}:${OC.codeRhythm(p)}:${p.lkw == null ? '' : p.lkw}:${OC.afOnset(p) == null ? '' : OC.afOnset(p)}:${OC.ageSex(p)}`; return m; };
// the same patient (same stream slot, same case; one player's diversion can swap an ambulance's case) has the same facts
const factsAgree = (x, y) => { const both = Object.keys(x).filter(k => k in y && x[k].split(':')[0] === y[k].split(':')[0]); return both.length > 0 && both.every(k => x[k] === y[k]); };
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

const out = { version: VERSION, shifts: {}, streams: {}, codes: [], save: {}, answers: {}, codeKey: {}, radioKey: {}, codeCards: {}, drugRules: {}, codeRuns: {} };

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
    stateHash: stateHash(),
  };
}

// ---- streams: two players on one code get the same patients at the same times
for (const [mode, level] of [['rn', 'med'], ['rn', 'hard'], ['md', 'med']]) {
  play(mode, level, 'none', 777, 'normal'); const a = arrivals(), w1 = walkIns(), end1 = OC.G.t, f1 = facts();
  play(mode, level, 'none', 777, 'careless'); const b = arrivals(), w2 = walkIns(), end2 = OC.G.t, f2 = facts();
  const upTo = (w, t) => w.filter(x => x[1] <= t).map(x => `${x[0]}@${Math.round(x[1] * 10)}`).join(',');   // a fired or walked-out shift ends early
  const wa = upTo(w1, Math.min(end1, end2)), wb = upTo(w2, Math.min(end1, end2));
  // The first 2 hours: the new walk-ins must match exactly. Ambulances aren't compared by case or minute: one player's diversion can
  // turn one away or change which case comes (documented in CLAUDE.md); their clinical facts are checked by factsAgree.
  const early = list => list.filter(x => !/[eR]$/.test(x) && +x.split('@')[1] <= 1200).join(',');
  out.streams[`${mode}/${level}`] = { sameEarlyArrivals: early(a) === early(b), sameWalkIns: wa === wb, sameFacts: factsAgree(f1, f2), hash: fnv(early(a)), walkHash: fnv(wa) };
}

// ---- codes: the bit layout, checked without the version salt so the fixtures don't change every release (R3.2-06);
// every code must also round-trip under this version's salt.
OC.setCodeVersion('', []);
const levels = ['rush', 'easy', 'med', 'hard'], scens = Object.keys(OC.SCENS), packs = Object.keys(OC.PACKS);
for (let i = 0; i < 20; i++) {
  const o = { mode: i % 2 ? 'md' : 'rn', level: levels[i % 4], scen: scens[i % scens.length], pack: packs[i % packs.length], seed: (i * 7919 + 13) % 131072 };
  const code = OC.classCode(o), back = OC.readCode(code);
  OC.setCodeVersion(VERSION, []); const cur = OC.readCode(OC.classCode(o)); OC.setCodeVersion('', []);
  const same = b => !!b && !b.stale && b.mode === o.mode && b.level === o.level && b.scen === o.scen && b.pack === o.pack && b.seed === o.seed;
  out.codes.push({ in: o, code, roundTrip: same(back) && same(cur) });
}

// ---- save round trip
{
  const go = to => { let n = 0; while (OC.G.t < to && !OC.G.over && n++ < 20000) { OC.step(0.1); if (OC.G.card) OC.botStep({ budget: 0 }); if (n % 15 === 0) OC.botStep({ budget: 2, acc: 0.6 }); } };
  OC.newGame('med', 9090, { mode: 'rn' });
  const t0 = OC.G.t; go(t0 + 180);
  const saved = JSON.stringify(OC.G);
  go(t0 + 360); const unbroken = fnv(JSON.stringify(OC.G));
  OC.load(JSON.parse(saved)); go(t0 + 360); const resumed = fnv(JSON.stringify(OC.G));
  out.save = { identical: unbroken === resumed };
  // the attending too, on four seeds: orders, results and the review list survive a reload (R1.2-02)
  let mdSame = 0;
  const mdPlayTo = to => { let n = 0; while (OC.G.t < to && !OC.G.over && n++ < 20000) { if (OC.G.card) { const c = OC.G.card; if (c.eid === 'code') { const q = OC.codeSteps(OC.pt(c.ctx.pid))[c.ctx.step]; OC.chooseCard(String(q.c.findIndex(x => x[2]))); } else OC.chooseCard(c.choices.find(x => !x.dis).k); } OC.step(0.1); if (n % 15 === 0) OC.mdPlay({ budget: 1, acc: 0.7, line: 1 }); } };
  for (let s = 1; s <= 4; s++) { OC.newGame('med', 5000 + s, { mode: 'md' }); mdPlayTo(180); const m = JSON.stringify(OC.G); mdPlayTo(400); const a = fnv(JSON.stringify(OC.G)); OC.load(JSON.parse(m)); mdPlayTo(400); if (fnv(JSON.stringify(OC.G)) === a) mdSame++; }
  out.save.attending = mdSame;
  // the attending, saved mid-code with a rhythm-check card open (R3.2-03): the same card is waiting after the reload, and the shift plays on the same
  const mdgo = to => { let n = 0; while (OC.G.t < to && !OC.G.over && n++ < 20000) { if (OC.G.card) { const c = OC.G.card; if (c.eid === 'code') { const q = OC.codeSteps(OC.pt(c.ctx.pid))[c.ctx.step]; OC.chooseCard(String(q.c.findIndex(x => x[2]))); } else OC.chooseCard(c.choices.find(x => !x.dis).k); } OC.step(0.1); } };
  OC.newGame('easy', 9191, { mode: 'md' }); OC.G.card = null;
  const free = OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso);
  const cp = OC.pt(OC.trainPatient('nstemi', 'room', { room: free.id })); cp.prov = OC.G.me; cp.mine = true; cp.ev = 'done'; OC.awaitOrders(cp); OC.toArrest(cp, 'golden');
  OC.assign(OC.G.me, cp.id); let n = 0; while (!(OC.G.card && OC.G.card.eid === 'code') && n++ < 200) OC.step(0.1);
  const mid = JSON.stringify(OC.G), cardThen = OC.G.card && OC.G.card.eid;
  mdgo(OC.G.t + 60); const a1 = fnv(JSON.stringify(OC.G));
  OC.load(JSON.parse(mid)); const cardAfter = OC.G.card && OC.G.card.eid; mdgo(OC.G.t + 60); const a2 = fnv(JSON.stringify(OC.G));
  out.save.midCode = { card: cardThen === 'code' && cardAfter === 'code', identical: a1 === a2 };
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

// ---- the ACLS/PALS code cards and the radio calls: the right answer to each question
for (const [k, L] of Object.entries(OC.CODE_Q)) out.codeKey[k] = L.map(q => q.c.find(c => c[2])[0]);
for (const [k, q] of Object.entries(OC.CODE_CAUSE)) out.codeKey['cause:' + k] = q.c.find(c => c[2])[0];
for (const [k, L] of Object.entries(OC.SCEN)) out.radioKey[k] = L.map(q => (q.opts ? q.opts[q.r] : q.a ? 'yes' : 'no'));
out.codeKey.hcg = [...OC.HCG_CASES].sort().join(' ');   // the cases where a woman of 12 to 55 needs a pregnancy test
// every code card as the student sees it: each answer (right ones marked) and its reason, so any content edit is a readable diff (R2.3-05)
const card = q => q.c.map(c => `${c[2] ? '[RIGHT] ' : ''}${c[0]} -> ${OC.CODE_WHY[c[1]] || '?'}`);
for (const [k, L] of Object.entries(OC.CODE_Q)) L.forEach((q, i) => { out.codeCards[`${k}[${i}]`] = [q.t, ...card(q)]; });
for (const [k, q] of Object.entries(OC.CODE_CAUSE)) out.codeCards['cause:' + k] = [q.t, ...card(q)];
out.codeCards.lists = { CAUSE_OF: OC.CAUSE_OF, base: OC.CODE_BASE, aiSkill: OC.CODE_AI_Q, gap: OC.CODE_GAP };
// the drug-scoring rule lists (R2.3-05)
const sortObj = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, Array.isArray(o[k]) ? o[k].slice().sort() : o[k]]));
out.drugRules = { ALSO: sortObj(OC.ALSO), CONTRA: sortObj(OC.CONTRA), CONTRA_IF: Object.fromEntries(Object.keys(OC.CONTRA_IF).sort().map(k => [k, Object.keys(OC.CONTRA_IF[k]).sort()])),
  RXREQ: OC.RXREQ, REQ_AGE: OC.REQ_AGE, NEVER_WRONG: [...OC.NEVER_WRONG].sort(), SAME_CLASS_OK: OC.SAME_CLASS_OK };
// scripted codes: 40 arrests run by the attending, every call right, then every call wrong: how many pulses come back (R2.3-02)
{ const runs = right => { let rosc = 0;
    for (let s = 0; s < 40; s++) { OC.newGame('easy', 30000 + s, { mode: 'md' }); OC.G.train = null; OC.G.card = null;
      const free = OC.G.rooms.find(r => !r.pid && /^[0-9]+$/.test(r.id) && r.st === 'clean' && !r.closed && !r.iso);
      const p = OC.pt(OC.trainPatient(['nstemi', 'pe', 'asthma', 'stemi'][s % 4], 'room', { room: free.id })); p.prov = OC.G.me; p.mine = true; p.ev = 'done'; OC.awaitOrders(p);
      OC.toArrest(p, 'golden'); OC.assign(OC.G.me, p.id);
      for (let i = 0; i < 400 && p.arrest; i++) { const c = OC.G.card;
        if (c && c.eid === 'code') { const q = OC.codeSteps(p)[c.ctx.step], ri = q.c.findIndex(x => x[2]); OC.chooseCard(String(right ? ri : (ri + 1) % 4)); }
        else if (c) OC.chooseCard(c.choices.find(x => !x.dis).k); else OC.step(0.1); }
      if (p.rosc) rosc++; }
    return rosc; };
  out.codeRuns = { allRight: runs(true), allWrong: runs(false) }; }

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
  for (const sec of ['codeKey', 'radioKey', 'codeCards', 'drugRules', 'codeRuns']) for (const k of new Set([...Object.keys(out[sec]), ...Object.keys(old[sec] || {})])) cmp(sec, k, out[sec][k], (old[sec] || {})[k]);
  if (!fails) console.log(`ok - golden: ${Object.keys(out.shifts).length} shifts, ${Object.keys(out.streams).length} stream checks, ${out.codes.length} codes, save round trip, ${Object.keys(out.answers).length} answer keys unchanged`);
  else { console.error(`FAIL: ${fails} golden difference(s). If they are intended, run: node test/golden.js --update, and say why in the commit.`); process.exitCode = 1; }
}
// invariants that must hold whatever the snapshot says
const inv = (c, m) => { if (!c) { console.error('FAIL:', m); process.exitCode = 1; } else console.log('ok -', m); };
inv(out.codes.every(c => c.roundTrip), 'every class code decodes to what made it');
inv(out.codeRuns.allRight > out.codeRuns.allWrong * 1.5, `the code's outcome follows the calls (${out.codeRuns.allRight} of 40 pulses back with every call right, ${out.codeRuns.allWrong} with every call wrong)`);
inv(out.save.identical, 'a saved and reloaded shift plays on exactly like an unbroken one');
inv(out.save.attending === 4, `an attending shift saved and reloaded plays on exactly the same (${out.save.attending} of 4 seeds)`);
inv(out.save.midCode.card && out.save.midCode.identical, 'an attending saved mid-code finds the same rhythm-check card after the reload, and plays on the same');
inv(Object.values(out.streams).every(s => s.sameEarlyArrivals), 'two players on one shift get the same walk-ins for the first two hours, however they play');
inv(Object.values(out.streams).every(s => s.sameWalkIns), 'and the same new walk-ins all shift long');
inv(Object.values(out.streams).every(s => s.sameFacts), 'and the same patients have the same clinical facts (rhythm, onset times, months)');
