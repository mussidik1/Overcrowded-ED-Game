#!/usr/bin/env node
/* Checks the live Supabase project's class-results rules from outside, with the same publishable key the game uses
   (src/backend.json). It reads no class data and stores no result: every probe is a wrong key or an invalid result.
   Each call to a cb_ function adds to a rate-limit counter (one row per network and hour, a keyed hash, deleted
   within two days), as any player's call does.
     node test/db_live.js        (npm run db:live)
   The Pages deploy runs it before it publishes, so the site can't go live ahead of its database. */
'use strict';
const fs = require('fs'), path = require('path');
const { url: URL, key: KEY } = require('../src/backend.json');
const LATEST = fs.readdirSync(path.join(__dirname, '..', 'supabase', 'migrations')).filter(f => /^\d{14}_.*\.sql$/.test(f)).sort().pop().replace(/\.sql$/, '');
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const call = (p, opt = {}) => fetch(URL + p, Object.assign({}, opt, { signal: AbortSignal.timeout(15000), headers: Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, opt.headers || {}) }))
  .then(async r => ({ status: r.status, body: await r.text() }), e => ({ status: 0, body: String(e && e.message) }));
const rpc = (fn, args, headers) => call('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args), headers });
const json = t => { try { return JSON.parse(t); } catch (e) { return null; } };
const BAD = 'ZZZZZZZZZZZZZZZZ';   // a well-formed key nobody has (a 1 in 2^80 chance otherwise)

(async () => {
  const h = await rpc('cb_health', {}), hj = json(h.body) || {};
  ok(h.status === 200 && hj.db === LATEST, `the live database has the latest migration, ${LATEST} (${h.status} ${h.body})`);
  ok(hj.overdue === 0, `no class is more than two hours past its deletion time (${hj.overdue})`);
  ok(hj.cron === true, 'the hourly clean-up job is scheduled');
  ok(hj.addr === true, 'the database can read each caller\'s address (otherwise everyone would share one rate limit)');
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
  // The rate limit must hold however a caller dresses up its address: 121 health calls, each claiming a different one.
  let last = null;
  for (let i = 0; i < 121; i++) {
    const ip = `203.0.113.${(i % 250) + 1}`;
    last = await rpc('cb_health', {}, { 'X-Forwarded-For': ip, 'X-Real-IP': ip, 'CF-Connecting-IP': ip, 'True-Client-IP': ip });
  }
  ok((json(last && last.body) || {}).error === 'busy', `forged address headers don't get round the rate limit (call 121: ${last && last.body})`);
  console.log(fails ? `${fails} FAILED` : 'All live database checks passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + (e && e.message)); process.exit(1); });
