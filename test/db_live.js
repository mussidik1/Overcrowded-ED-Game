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
    const why = (process.env.SKIP_REASON || '').trim();
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
  if (Array.isArray(hj.migs)) {   // since 20261125120000: every migration up to the live one must be there, none skipped (audit R1.6-04)
    const skipped = MIGS.filter(m => m <= hj.db && !hj.migs.includes(m));
    ok(!skipped.length, skipped.length ? `the live database skipped ${skipped.join(', ')}: apply it (supabase/README.md), then re-run` : `no migration was skipped (${hj.migs.length} recorded)`);
  }
  // Retention and storage: warnings, not failures. Reads and sends already treat an expired class as gone, and every new code also
  // deletes expired ones, so a lagging clean-up job doesn't expose anything; it shouldn't block a clinical fix.
  const warn = (c, msg) => { if (c) console.log('ok   ' + msg); else console.log('::warning::' + msg); };
  warn(hj.overdue === 0, `no class is more than two hours past its deletion time (${hj.overdue}). If not: check that pg_cron is on and the codeblack-tidy job is active (select * from cron.job).`);
  warn(hj.cron === true, 'the hourly clean-up job is scheduled. If not: enable pg_cron (Database > Extensions) and re-run the migration.');
  if (hj.classes != null) {   // since 20261125120000: how full the backstops are (0 to 1)
    warn(hj.classes < 0.5 && hj.results < 0.5, `the storage backstops are under half full (classes ${hj.classes}, results ${hj.results}). If not: someone may be filling them; see supabase/README.md, "Backstops".`);
  }
  ok(hj.addr === true && hj.public === true, `the database reads each caller's public address (addr ${hj.addr}, public ${hj.public}); otherwise everyone would share one rate limit. If not: Supabase's gateway changed its headers (codeblack.client_ip).`);
  const oldGet = await call('/rest/v1/cb_results?select=*&limit=1');
  ok(oldGet.status === 404, `the old results table is gone from the API (HTTP ${oldGet.status})`);
  // An invalid row (role "x"): refused by the old table's checks if it were still there (400), so this never writes.
  const oldPost = await call('/rest/v1/cb_results', { method: 'POST', body: JSON.stringify({ code: 'ZZZ-ZZZ', name: 'Probe', role: 'x', level: 'x', score: 0, stars: 0, real_sec: 0 }) });
  ok(oldPost.status === 404, `and can't be written to (HTTP ${oldPost.status})`);
  const oldRead = await rpc('cb_class', { p_code: 'ZZZ-ZZZ' });
  ok(oldRead.status === 404, `reading results by class code alone is gone (HTTP ${oldRead.status})`);
  for (const t of ['results', 'classes', 'salt', 'rate', 'migrations']) {
    const r = await call(`/rest/v1/${t}?select=*&limit=1`, { headers: { 'Accept-Profile': 'codeblack' } });
    ok(r.status >= 400 && r.status < 500, `the private ${t} table isn't reachable through the API (HTTP ${r.status})`);
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
    last = await rpc('cb_health', { p_probe: true }, { 'X-Forwarded-For': ip, 'X-Real-IP': ip, 'CF-Connecting-IP': ip, 'True-Client-IP': ip, Prefer: 'timezone=Asia/Kathmandu' });
    if (last.status !== 200) lost++;
    if ((json(last.body) || {}).error === 'busy') busy++;
  }
  if (lost) ok(false, `${lost} of the 31 probe calls didn't answer (last: HTTP ${last.status} ${last.body.slice(0, 120)}): the network or Supabase, not the rate limit. Re-run.`);
  else ok((json(last.body) || {}).error === 'busy', `forged address headers and another time zone don't get round the rate limit (call 31: ${last.body}; ${busy} refused)`);
  console.log(fails ? `${fails} FAILED` : 'All live database checks passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + (e && e.message)); process.exit(1); });
