#!/usr/bin/env node
/* Checks the live Supabase project's class-results rules from the outside, with the same publishable key the game uses.
   It reads nothing private and adds no results. Each call to a cb_ function does add one rate-limit row (a keyed hash of
   this machine's network address, deleted after a day), as any player's call does.
     node test/db_live.js
   Run it after applying a migration; the Pages deploy runs it after each release. */
'use strict';
const fs = require('fs'), path = require('path');
const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui.js'), 'utf8');
const m = ui.match(/const CB = \{ url: '([^']+)', key: '([^']+)' \}/);
if (!m) { console.log('FAIL: CB (the Supabase address and key) not found in src/ui.js'); process.exit(1); }
const [, URL, KEY] = m;
let fails = 0;
const ok = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails++; };
const call = (p, opt = {}) => fetch(URL + p, Object.assign({}, opt, { headers: Object.assign({ apikey: KEY, 'Content-Type': 'application/json' }, opt.headers || {}) }))
  .then(async r => ({ status: r.status, body: await r.text() }));
const rpc = (fn, args) => call('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(args) });
const json = t => { try { return JSON.parse(t); } catch (e) { return null; } };

(async () => {
  const oldTable = await call('/rest/v1/cb_results?select=*&limit=1');
  ok(oldTable.status === 404 || oldTable.status === 401, `the old results table can't be read through the API (HTTP ${oldTable.status})`);
  const oldRead = await rpc('cb_class', { p_code: 'ZZZ-ZZZ' });
  ok(oldRead.status === 404, `reading results by class code alone is gone (HTTP ${oldRead.status})`);
  for (const t of ['results', 'classes', 'salt', 'hits']) {
    const r = await call(`/rest/v1/${t}?select=*&limit=1`, { headers: { 'Accept-Profile': 'codeblack' } });
    ok(r.status >= 400 && r.status !== 500, `the private ${t} table isn't reachable through the API (HTTP ${r.status})`);
  }
  const read = await rpc('cb_class_read', { p_code: 'ZZZ-ZZZ', p_key: 'ZZZZZZZZZZZZZZZZ' });
  ok(read.status === 200 && (json(read.body) || {}).error === 'key', `a made-up code and key read nothing (${read.status} ${read.body})`);
  const del = await rpc('cb_class_delete', { p_code: 'ZZZ-ZZZ', p_key: 'ZZZZZZZZZZZZZZZZ', p_id: null });
  ok(del.status === 200 && (json(del.body) || {}).error === 'key', `or delete anything (${del.status} ${del.body})`);
  const sub = await rpc('cb_submit', { p_code: 'ZZZ-ZZZ', p_cid: '00000000-0000-4000-8000-000000000000', p_name: 'Probe', p_role: 'rn', p_level: 'med', p_score: 1, p_stars: 0, p_real_sec: 0, p_stats: {}, p_ver: '0.0.0' });
  ok(sub.status === 200 && (json(sub.body) || {}).error === 'unknown', `a result for a code nobody registered is refused (${sub.status} ${sub.body})`);
  const gate = await rpc('cb_gate_on', {});
  ok(gate.status === 200 && (gate.body === 'true' || gate.body === 'false'), `the gate still answers (${gate.body})`);
  console.log(fails ? `${fails} FAILED` : 'All live database checks passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL: ' + (e && e.message)); process.exit(1); });
