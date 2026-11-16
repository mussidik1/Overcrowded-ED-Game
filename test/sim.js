// Headless playtest: runs whole shifts with an autopilot and checks invariants.
const OC = require('../src/engine.js');

function check(G) {
  for (const r of G.rooms) {
    if (r.pid) {
      const p = G.pts[r.pid];
      if (!p) throw new Error(`room ${r.id} points to missing patient`);
      if (p.loc !== 'room' || p.room !== r.id) throw new Error(`room ${r.id} / patient ${p.id} mismatch (loc=${p.loc}, room=${p.room})`);
      if (r.st !== 'occ') throw new Error(`room ${r.id} has patient but st=${r.st}`);
    } else if (r.st === 'occ') throw new Error(`room ${r.id} occ without patient`);
  }
  for (const id of G.order) {
    const p = G.pts[id];
    if (p.loc === 'room') { const r = G.rooms.find(x => x.id === p.room); if (!r || r.pid !== p.id) throw new Error(`patient ${p.id} thinks it is in ${p.room}`); }
  }
  if (!Number.isFinite(G.care)) throw new Error('care is not finite');
  for (const s of G.staff) {
    if (!Number.isFinite(s.morale)) throw new Error(`morale NaN for ${s.id}`);
    if (OC.isProv(s)) for (const k of s.q) if (k.left == null || Number.isNaN(k.left)) throw new Error(`bad task on ${s.id}`);
    for (const k of s.q.concat(s.tq)) if (!OC.isProv(s) && !k.pid) throw new Error(`queue item without a patient on ${s.id}`);
  }
  JSON.stringify(G); // must stay serializable
}

function run(level, seed, opts) {
  OC.hooks.toast = () => {}; OC.hooks.sound = () => {};
  OC.newGame(level, seed);
  const G = () => OC.G;
  let steps = 0, maxWait = 0, maxWall = 0, maxBoard = 0, sinceBot = 0;
  while (!G().over && steps < 20000) {
    OC.step(0.1); steps++;
    sinceBot += 0.1;
    if (G().card && opts.cardDelay == null) OC.botStep({ budget: 0 });
    if (sinceBot >= opts.every) { sinceBot = 0; OC.botStep({ budget: opts.budget, acc: opts.acc, early: opts.early, breaks: opts.breaks, pit: opts.pit, interp: opts.interp }); }
    if (steps % 50 === 0) {
      check(G());
      maxWait = Math.max(maxWait, OC.waitingCount());
      maxWall = Math.max(maxWall, OC.maxWallNow());
      maxBoard = Math.max(maxBoard, OC.boarders().length);
    }
  }
  check(G());
  const R = G().report;
  return { level, seed, steps, ...R, maxWait, maxWall: Math.round(maxWall), maxBoard, events: G().stats.events, used: Object.keys(G().ev.used).join(',') };
}

const profiles = {
  perfect: { every: 0.2, budget: 1e9, acc: 0.9, early: true, breaks: true },
  human: { every: 1.0, budget: 2, acc: 0.75, early: false, breaks: true, pit: true, interp: 0.7 },
  casual: { every: 1.0, budget: 1, acc: 0.7, early: false, breaks: true, pit: false, interp: 0.5 },
  // At 1x a game minute takes 2.5 real seconds, so k decisions per second is 2.5k per game minute:
  // newbie ~0.16/s, real ~0.27/s (first shift), casual ~0.4/s (typical), human ~0.8/s (expert).
  real: { every: 3.0, budget: 2, acc: 0.7, early: false, breaks: true, pit: false, interp: 0.4 },
  newbie: { every: 5.0, budget: 2, acc: 0.6, early: true, breaks: false, pit: false, interp: 0.2 },
  sloppy: { every: 2.0, budget: 2, acc: 0.6, early: false, breaks: false },
};
const which = process.argv[2] || 'all';
for (const [name, prof] of Object.entries(profiles)) {
  if (which !== 'all' && which !== name) continue;
  for (const level of ['easy', 'med', 'hard']) {
    const rows = [];
    for (let seed = 1; seed <= 5; seed++) rows.push(run(level, seed * 7919, prof));
    const avg = k => (rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(1);
    console.log(`${name.padEnd(8)} ${level.padEnd(5)} care=${avg('care')} stars=${avg('stars')} wait=${avg('wait')} sat=${avg('sat')} seen=${avg('seen')} dc=${avg('dc')} adm=${avg('adm')} lwbs=${avg('lwbs')} left=${avg('left')} wallAvg=${avg('wallAvg')} wallMax=${avg('wallMax')} maxWaitRm=${avg('maxWait')} maxBoard=${avg('maxBoard')} goals=${avg('goalsMet')}/${avg('goalsMiss')} angry=${avg('angry')} ratioMin=${avg('ratioMin')} adverse=${avg('adverse')} ev=${avg('events')} fails=${rows.filter(r => r.fail).length}`);
  }
}
