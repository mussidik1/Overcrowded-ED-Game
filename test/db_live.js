#!/usr/bin/env node
/* Checks the live Supabase project's class-results rules from outside, with the same publishable key the game uses
   (src/backend.json). It reads no class data and stores no result: every probe is a wrong key or an invalid result.
   Each call to a cb_ function adds to a rate-limit counter (one row per network, kind and hour, a keyed hash, deleted
   within two days), as any player's call does.
     node test/db_live.js        (npm run db:live)
   The Pages deploy runs it before it publishes, so the site can't go live ahead of its database. */
'use strict';
const fs = require('fs'), path = require('path');
const { url: URL, key: KEY } = require('../src/backend.json');
const MIGS = fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations')).filter(f => /^\d{14}_.*\.sql$/.test(f)).sort().map(f => f.replace(/\.sql$/, ''));
const LATEST = MIGS[MIGS.length - 1];
// The migrations the repo says are live (supabase/migrations/applied.sha256): the deploy checks this list against the live project, so a
// migration applied but not frozen in the repo, or frozen but not applied, stops the release (audit R1.7-03).
const APPLIED_LINES = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', 'applied.sha256'), 'utf8').split('\n').filter(l => l.trim());
const APPLIED = APPLIED_LINES.map(l => (/^[0-9a-f]{64} {2}(\d{14}_[a-z0-9_]+)\.sql$/.exec(l) || [])[1]).filter(Boolean);
const MALFORMED = APPLIED_LINES.filter(l => !/^[0-9a-f]{64} {2}\d{14}_[a-z0-9_]+\.sql$/.test(l));
// What the repo's migrations make the functions into (supabase/tests/fingerprint.txt, checked by run.sh): the live project must match.
const FP = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'tests', 'fingerprint.txt'), 'utf8').trim();
const WATCH = process.env.DB_WATCH === '1';   // the daily watch (.github/workflows/db-watch.yml): storage past half full fails, so someone hears
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const call = async (p, opt = {}) => {   // never throws: status 0 means no answer (network, timeout, or a body that stalled)
  try {
    const r = await fetch(URL + p, Object.assign({}, opt, { signal: AbortSignal.timeout(15000), headers: Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, opt.headers || {}) }));
    return { status: r.status, body: await r.text() };
  } catch (e) { return { status: 0, body: `${p}: ${e && e.message}` }; }
};
const rpc = (fn, args, headers) => call('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args), headers });
const json = t => { try { return JSON.parse(t); } catch (e) { return null; } };
// A well-formed key made fresh for each run (80 random bits), so nobody can register the probe code with it and block deploys.
const BAD = Array.from(require('crypto').randomBytes(16), b => '0123456789ABCDEFGHJKMNPQRSTVWXYZ'[b & 31]).join('');
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  if (process.env.SKIP_DB_CHECK === '1') {   // only for an emergency deploy, such as a rollback while Supabase is down: say so loudly
    const why = (process.env.SKIP_REASON || '').replace(/[\r\n]+/g, ' ').replace(/::/g, ': ').trim();   // one line, no workflow command inside it
    if (!why) { console.log('FAIL: skip_db_check needs a reason (the skip_reason box on the Deploy run). Nothing was published.'); process.exit(1); }
    console.log(`::warning::The live database check was SKIPPED for this deploy: ${why.slice(0, 200)}. Run npm run db:live as soon as you can.`);
    console.log('SKIPPED: the live database was not checked.'); process.exit(0);
  }
  const h = await rpc('cb_health', { p_probe: false }), hj = json(h.body) || {};
  if (hj.error === 'busy') { console.log(`FAIL: this network has used its health checks for this hour. Re-run after ${new Date(Math.ceil(Date.now() / 36e5) * 36e5).toISOString().slice(11, 16)} UTC; the database itself may be fine.`); process.exit(1); }
  if (h.status !== 200 || typeof hj.db !== 'string') {   // one diagnosis, not a page of failures
    console.log(`FAIL: the health check didn't answer (HTTP ${h.status}: ${h.body.slice(0, 200)}).`);
    console.log('  Status 0 or 5xx: Supabase is down or the project is paused. 401: the key in src/backend.json changed. 404 (PGRST202): the migration isn\'t applied.');
    console.log('  Nothing was published. See supabase/README.md, "Releasing a database change".');
    process.exit(1);
  }
  ok(true, `the health check answers (${h.body.slice(0, 300)})`);
  ok(hj.db >= LATEST, hj.db === LATEST ? `the live database has this release's migration ${LATEST}`
    : hj.db > LATEST ? `the live database has a newer migration than this release (live ${hj.db}, release ${LATEST}): fine for a rollback`
    : `the live database is behind this release (live ${hj.db}, release ${LATEST}). Apply the migration in the Supabase SQL editor first (supabase/README.md, "Releasing"), then re-run the deploy.`);
  const round6 = hj.db >= '20261125120000';   // from this migration on, health also says these: they can't quietly go missing (R2.7-09g)
  if (round6) ok(Array.isArray(hj.migs) && typeof hj.classes === 'number' && typeof hj.results === 'number' && typeof hj.fp === 'string', 'the health check lists the migrations, how full the backstops are and the functions\' fingerprint');
  if (hj.db === LATEST) ok(hj.fp === FP, hj.fp === FP ? `the live functions are exactly what the repo's migrations make (fingerprint ${FP})`
    : `the live functions differ from what the repo's migrations make (live ${hj.fp}, repo ${FP}): an older draft was applied, or something was changed by hand. Re-apply the repo's newest migration from the green commit, then re-run.`);
  ok(!MALFORMED.length, MALFORMED.length ? `malformed line(s) in supabase/migrations/applied.sha256 (want: the hash, two spaces, the file name): ${MALFORMED.map(l => JSON.stringify(l.slice(0, 100))).join(', ')}` : 'applied.sha256 is well formed');
  if (Array.isArray(hj.migs)) {   // since 20261125120000: every migration up to the live one must be there, none skipped (audit R1.6-04)
    const skipped = MIGS.filter(m => m <= hj.db && !hj.migs.includes(m));
    ok(!skipped.length, skipped.length ? `the live database skipped ${skipped.join(', ')}: apply it (supabase/README.md), then re-run` : `no migration was skipped (${hj.migs.length} recorded)`);
    const notFrozen = hj.migs.filter(m => MIGS.includes(m) && !APPLIED.includes(m)), notLive = APPLIED.filter(m => !hj.migs.includes(m));
    ok(!notFrozen.length && !notLive.length, notFrozen.length ? `applied live but not in supabase/migrations/applied.sha256: ${notFrozen.join(', ')}. Add its line (sha256sum, in migrations/) and commit.`
      : notLive.length ? `listed in applied.sha256 but not live: ${notLive.join(', ')}` : 'applied.sha256 lists exactly the migrations that are live');
  }
  // The clean-up job keeps the privacy promises (the network counters and daily salts go only through it): its absence fails the
  // deploy (audit R2.7-05). A class overdue for deletion, or the backstops past half full, warn (and fail the daily watch).
  const warn = (c, good, bad) => { if (c) console.log('ok   ' + good); else console.log('::warning::' + bad); };
  ok(hj.cron === true, hj.cron === true ? 'the hourly clean-up job is scheduled and active'
    : 'the hourly clean-up job is NOT scheduled or NOT active, so network counters and daily salts are never deleted. Fix: enable pg_cron (Database > Extensions), then in the SQL editor: select cron.schedule(\'codeblack-tidy\', \'41 * * * *\', \'select codeblack.tidy()\'); and, if it is paused, select cron.alter_job(jobid, active := true) from cron.job where jobname = \'codeblack-tidy\'; then re-run the deploy.');
  (WATCH ? (c, g, b) => ok(c, c ? g : b) : warn)(hj.overdue === 0, 'no deletion is more than two hours late',
    `${hj.overdue} class(es) are more than two hours past a deletion that should have happened: is the clean-up job running? (select * from cron.job_run_details order by start_time desc limit 5)`);
  if (typeof hj.classes === 'number') {   // since 20261125120000: how full the backstops are (0 to 1)
    (WATCH ? (c, g, b) => ok(c, c ? g : b) : warn)(hj.classes < 0.5 && hj.results < 0.5, `the storage backstops are under about half full (classes ${hj.classes}, results ${hj.results}, to a tenth)`,
      `the storage backstops are about half full or more (classes ${hj.classes}, results ${hj.results}, to a tenth): someone may be filling them. See supabase/README.md, "Backstops".`);
  }
  ok(hj.addr === true && hj.public === true, `the database reads each caller's public address (addr ${hj.addr}, public ${hj.public}); otherwise everyone would share one rate limit. If not: Supabase's gateway changed its headers (codeblack.client_addr).`);
  const oldGet = await call('/rest/v1/cb_results?select=*&limit=1');
  ok(oldGet.status === 404, `the old results table is gone from the API (HTTP ${oldGet.status})`);
  // An invalid row (role "x"): refused by the old table's checks if it were still there (400), so this never writes.
  const oldPost = await call('/rest/v1/cb_results', { method: 'POST', body: JSON.stringify({ code: 'ZZZ-ZZZ', name: 'Probe', role: 'x', level: 'x', score: 0, stars: 0, real_sec: 0 }) });
  ok(oldPost.status === 404, `and can't be written to (HTTP ${oldPost.status})`);
  const oldRead = await rpc('cb_class', { p_code: 'ZZZ-ZZZ' });
  ok(oldRead.status === 404, `reading results by class code alone is gone (HTTP ${oldRead.status})`);
  for (const t of ['results', 'classes', 'salt', 'rate', 'migrations']) {
    const r = await call(`/rest/v1/${t}?select=*&limit=1`, { headers: { 'Accept-Profile': 'codeblack' } });
    ok([400, 404, 406].includes(r.status), [400, 404, 406].includes(r.status) ? `the private ${t} table isn't reachable through the API (HTTP ${r.status})`
      : `couldn't confirm the private ${t} table is unreachable: the API answered HTTP ${r.status} (401: the key changed; 429: rate-limited), not 404 or 406`);
  }
  const read = await rpc('cb_class_read', { p_code: 'ZZZ-ZZZ', p_key: BAD });
  ok(read.status === 200 && (json(read.body) || {}).error === 'key', `a made-up key reads nothing (${read.status} ${read.body})`);
  const del = await rpc('cb_class_delete', { p_code: 'ZZZ-ZZZ', p_key: BAD, p_all: true });
  ok(del.status === 200 && (json(del.body) || {}).error === 'key', `or deletes anything (${del.status} ${del.body})`);
  const sub = await rpc('cb_submit', { p_code: 'ZZZ-ZZZ', p_cid: '00000000-0000-4000-8000-000000000000', p_name: 'Probe', p_role: 'rn', p_level: 'x', p_score: 1, p_stars: 0, p_real_sec: 0, p_stats: {}, p_ver: '0.0.0' });
  ok(sub.status === 200 && (json(sub.body) || {}).field === 'level', `an invalid result is refused and names the field (${sub.status} ${sub.body})`);
  const reg = await rpc('cb_class_new', { p_code: 'ZZZ-ZZZ', p_key: BAD, p_ver: 'x' });
  ok(reg.status === 200 && (json(reg.body) || {}).error === 'invalid', `registering with a bad version is refused (${reg.status} ${reg.body})`);
  // The rate limit must hold however a caller dresses up its address: 31 probe calls (a bucket of 30 an hour), each claiming a
  // different address. Not across the top of the hour, when the counter restarts.
  if (new Date().getUTCMinutes() >= 55) { const ms = Math.ceil(Date.now() / 36e5) * 36e5 - Date.now() + 5000; console.log(`waiting ${Math.round(ms / 1000)} s for the next hour`); await wait(ms); }
  let last = null, busy = 0, lost = 0;
  for (let i = 0; i < 31; i++) {
    const ip = `203.0.113.${i + 1}`;
    // half the calls ask for a time zone at a quarter past the hour: a database that followed it would count them in a second bucket (audit R3.7-07)
    last = await rpc('cb_health', { p_probe: true }, Object.assign({ 'X-Forwarded-For': ip, 'X-Real-IP': ip, 'CF-Connecting-IP': ip, 'True-Client-IP': ip }, i % 2 ? { Prefer: 'timezone=Asia/Kathmandu' } : {}));
    if (last.status !== 200) lost++;
    if ((json(last.body) || {}).error === 'busy') busy++;
  }
  if (lost) ok(false, `${lost} of the 31 probe calls didn't answer (last: HTTP ${last.status} ${last.body.slice(0, 120)}): the network or Supabase, not the rate limit. Re-run.`);
  else ok((json(last.body) || {}).error === 'busy', `forged address headers and another time zone don't get round the rate limit (call 31: ${last.body}; ${busy} refused)`);
  console.log(fails ? `${fails} FAILED` : 'All live database checks passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + (e && e.message)); process.exit(1); });
