-- Checks of the Code Black class-results rules, run by supabase/tests/run.sh on a throwaway local Postgres after
-- the migrations. "set role anon" is the browser with the publishable key; request.headers is what Supabase passes
-- in for an API call (its address headers). Each check prints "ok - ..."; the first failure stops the run.
\set ON_ERROR_STOP 1
\set QUIET 1
create function public.t_ok(c boolean, msg text) returns void language plpgsql as $$
begin
  if c is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok - %', msg;
end $$;
create function public.t_net(ip text) returns void language sql as $$
  select set_config('request.headers', case when ip is null then '' else json_build_object('x-forwarded-for', ip)::text end, false);
$$;
\set call `cat client_call.json`
\set K1 '7K2M9QXH4V1R8ZTB'
\set K2 'ABCDEFGHJKMNPQRS'
\set K3 '0123456789ABCDEF'
\set V '0.31.0'

-- ---------- the shape of it ----------
select t_ok(to_regclass('public.cb_results') is null, 'the old public results table is gone');
select t_ok(to_regprocedure('public.cb_class(text)') is null, 'reading results by class code alone is gone');
select t_ok(to_regprocedure('caseroom.cb_results_guard()') is null and to_regprocedure('caseroom.cb_results_stamp()') is null, 'the old table''s trigger functions are gone');
select t_ok(to_regclass('caseroom.cb_hits') is not null and to_regprocedure('caseroom.client_ip()') is not null, 'Case Room''s helpers are left alone');
select t_ok(to_regclass('public.cb_gate') is not null and to_regprocedure('public.cb_gate_check(text)') is not null and to_regprocedure('public.cb_gate_on()') is not null, 'the gate is left alone');
select t_ok(not has_schema_privilege('anon', 'codeblack', 'usage') and not has_schema_privilege('authenticated', 'codeblack', 'usage'), 'the API roles have no way into the codeblack schema');
select t_ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'codeblack' and grantee in ('anon', 'authenticated', 'PUBLIC')), 'no codeblack table is granted to the API roles');
select t_ok(bool_and(c.relrowsecurity), 'row-level security is on for every codeblack table')
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'codeblack' and c.relkind = 'r';
select t_ok(count(*) = 5 and bool_and(p.prosecdef) and bool_and('search_path=pg_catalog, pg_temp' = any(p.proconfig)) and bool_and(exists (select 1 from unnest(p.proconfig) c where lower(c) = 'timezone=utc')),
  'the five API functions run as their owner, with pg_catalog first and pg_temp last, in UTC whatever the caller''s time zone')
  from pg_proc p where p.oid in ('public.cb_class_new(text,text,text)'::regprocedure, 'public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)'::regprocedure,
                                 'public.cb_class_read(text,text)'::regprocedure, 'public.cb_class_delete(text,text,uuid,boolean)'::regprocedure, 'public.cb_health(boolean)'::regprocedure);
select t_ok(bool_and('search_path=pg_catalog, pg_temp' = any(p.proconfig)) and not bool_or(p.prosecdef), 'the codeblack helpers have the same search path and are not security definers')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'codeblack';
select t_ok(count(*) = 5 and bool_and(exists (select 1 from unnest(p.proconfig) c where lower(c) = 'timezone=utc')), 'the helpers that read the clock (who, allow, allow_day, allow48, tidy) run in UTC')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'codeblack' and p.proname in ('who', 'allow', 'allow_day', 'allow48', 'tidy');
select t_ok(to_regprocedure('public.cb_health()') is null, 'no zero-argument cb_health is left (an early draft''s)');
select t_ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where n.nspname = 'codeblack' and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner), 'nobody but the owner may run a codeblack helper');
select t_ok(not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where p.oid = 'public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)'::regprocedure and a.grantee = 0), 'PUBLIC may not run cb_submit (only the API roles)');
select t_ok(exists (select 1 from cron.job where jobname = 'codeblack-tidy' and command = 'select codeblack.tidy()'), 'the hourly clean-up is scheduled');
select t_ok((select count(*) from cron.job where jobname = 'codeblack-tidy') = 1, 'and scheduled once, after two runs of the migration');
select t_ok((select max(name) from codeblack.migrations) = :'latest' and (select count(*) from codeblack.migrations where name = :'latest') = 1
        and exists (select 1 from codeblack.migrations where name = '20261124120000_codeblack_private_results'), 'each migration recorded itself, once, and the newest is the newest file');
select t_ok(not exists (select 1 from caseroom.cb_hits), 'the raw addresses Code Black''s old trigger left in caseroom.cb_hits are gone');

-- ---------- the contract with the game (client_call.json) ----------
select t_ok((select bool_and(exists (select 1 from pg_proc p where p.proname = f.key and p.pronamespace = 'public'::regnamespace
               and (select array_agg(x order by x) from jsonb_object_keys(f.value) x) is not distinct from
                   (select array_agg(a order by a) from unnest(coalesce(p.proargnames, '{}')) a where a <> '')))
             from jsonb_each(:'call'::jsonb -> 'calls') f), 'every function the game calls takes exactly the argument names the game sends');
select t_ok((select bool_and((select coalesce(array_agg(distinct m[1] order by m[1]), '{}') from pg_proc p, regexp_matches(p.prosrc, '''error'', ''([a-z]+)''', 'g') m
                              where p.proname = f.key and p.pronamespace = 'public'::regnamespace)
                             = (select array_agg(x order by x) from jsonb_array_elements_text(f.value) x))
             from jsonb_each(:'call'::jsonb -> 'answers') f), 'every error each function can give is in the contract file, which the game is checked against');
select t_ok((select bool_and(codeblack.clean_name(n) is not null) from jsonb_array_elements_text(:'call'::jsonb -> 'names' -> 'accept') n), 'the database accepts every name in the contract file''s accept list');
select t_ok((select bool_and(codeblack.clean_name(n) is null) from jsonb_array_elements_text(:'call'::jsonb -> 'names' -> 'refuse') n), 'and refuses every name in its refuse list');
select t_ok(codeblack.clean_stats(:'call'::jsonb -> 'calls' -> 'cb_submit' -> 'p_stats') = :'call'::jsonb -> 'calls' -> 'cb_submit' -> 'p_stats', 'the database keeps every stats key the game sends, unchanged');
select t_ok((select bool_and(f.value <> '[]'::jsonb) from jsonb_each(:'call'::jsonb -> 'answers') f) and (select count(*) from jsonb_each(:'call'::jsonb -> 'answers')) = 5, 'the contract lists errors for all five functions (so its error check isn''t empty)');

-- ---------- the browser can't touch the tables ----------
set role anon;
select t_net('203.0.113.5');
do $$ begin
  begin perform 1 from codeblack.results; raise exception 'FAIL: anon read codeblack.results';
  exception when insufficient_privilege then perform t_ok(true, 'the public key can''t read the results table'); end;
  begin insert into codeblack.classes (code, key_hash, ver) values ('AAA-AAA', repeat('0', 64), '0.31.0'); raise exception 'FAIL: anon inserted a class';
  exception when insufficient_privilege then perform t_ok(true, 'the public key can''t add a class directly'); end;
  begin perform 1 from codeblack.salt; raise exception 'FAIL: anon read the salt';
  exception when insufficient_privilege then perform t_ok(true, 'the public key can''t read the salt'); end;
  begin perform codeblack.tidy(); raise exception 'FAIL: anon ran a helper';
  exception when insufficient_privilege then perform t_ok(true, 'the public key can''t run a helper'); end;
end $$;

-- ---------- the game's own calls, exactly as it sends them ----------
select t_ok(cb_class_new(p_code => :'call'::jsonb -> 'calls' -> 'cb_class_new' ->> 'p_code', p_key => :'call'::jsonb -> 'calls' -> 'cb_class_new' ->> 'p_key', p_ver => :'call'::jsonb -> 'calls' -> 'cb_class_new' ->> 'p_ver') ->> 'ok' = 'true', 'the game''s registration call works');
select t_ok((select cb_submit(p_code => c ->> 'p_code', p_cid => (c ->> 'p_cid')::uuid, p_name => c ->> 'p_name', p_role => c ->> 'p_role', p_level => c ->> 'p_level',
        p_score => (c ->> 'p_score')::int, p_stars => (c ->> 'p_stars')::int, p_real_sec => (c ->> 'p_real_sec')::int, p_stats => c -> 'p_stats', p_ver => c ->> 'p_ver')
        from (select :'call'::jsonb -> 'calls' -> 'cb_submit' as c) x) = '{"ok": true}', 'the game''s send call works');
select t_ok(jsonb_array_length(cb_class_read(p_code => :'call'::jsonb -> 'calls' -> 'cb_class_read' ->> 'p_code', p_key => :'call'::jsonb -> 'calls' -> 'cb_class_read' ->> 'p_key') -> 'rows') = 1, 'the game''s read call works');
select t_ok(cb_class_delete(p_code => 'QZ7-K4M', p_key => '7K2M9QXH4V1R8ZTB', p_id => '8f14e45f-ceea-467a-9575-1c6e1d0a2b3c', p_all => false) = '{"deleted": 1}', 'the game''s delete call works');
select t_net('9.9.9.9');   -- an ordinary public address (the 203.0.113.0/24 used elsewhere is a documentation range)
select t_ok(cb_health() ->> 'db' = :'latest' and (cb_health() ->> 'overdue')::int = 0 and cb_health() ->> 'cron' = 'true' and cb_health() ->> 'addr' = 'true' and cb_health() ->> 'public' = 'true',
  'the health call names the live migration, no class is overdue, the clean-up is scheduled, and the caller''s address was read and is public');
select t_net('203.0.113.5');

-- ---------- an instructor registers a code ----------
select cb_class_new('kta-80p', :'K1', :'V')::text as r \gset
select t_ok(:'r'::jsonb ->> 'ok' = 'true', 'registering a code with a key the game made works');
select t_ok((select array_agg(k order by k) from jsonb_object_keys(:'r'::jsonb) k) = (select array_agg(x order by x) from jsonb_array_elements_text(:'call'::jsonb -> 'responses' -> 'cb_class_new') x), 'its answer has exactly the keys the contract lists');
select t_ok((:'r'::jsonb ->> 'created')::timestamptz between now() - interval '1 minute' and now() + interval '1 minute', 'and says when the class was made');
select t_ok((:'r'::jsonb ->> 'expires')::timestamptz between now() + interval '13 days 23 hours' and now() + interval '14 days 1 minute', 'a class nobody has sent to yet lasts 14 days');
select t_ok(cb_class_new('KTA80P', :'K1', :'V') ->> 'ok' = 'true', 'registering it again with the same key is fine: a retry after a lost answer');
select t_ok(cb_class_new('KTA-80P', :'K2', :'V') ->> 'error' = 'taken', 'the same code with another key is taken');
select t_ok(cb_class_new('KTA-80U', :'K1', :'V') ->> 'error' = 'invalid', 'a code with a letter outside the alphabet is refused');
select t_ok(cb_class_new('KTA-80', :'K1', :'V') ->> 'error' = 'invalid', 'a short code is refused');
select t_ok(cb_class_new('KTB-80P', 'SHORTKEY', :'V') ->> 'error' = 'invalid' and cb_class_new('KTB-80P', null, :'V') ->> 'error' = 'invalid', 'a key that isn''t 16 characters of the alphabet is refused');
select t_ok(cb_class_new('KTB-80P', :'K1', null) ->> 'error' = 'invalid' and cb_class_new('KTB-80P', :'K1', 'x') ->> 'error' = 'invalid', 'a missing or malformed version is refused');
select t_ok(cb_class_new(repeat('A', 100000), :'K1', :'V') ->> 'error' = 'invalid', 'a huge argument is refused before any work');
select t_ok(cb_class_new('L1M-0O0', :'K3', :'V') ->> 'ok' = 'true' and cb_class_new('11M-000', :'K2', :'V') ->> 'error' = 'taken', 'I and L read as 1 and O as 0, as in the game');
select t_ok((select count(*) from (select cb_class_new('NEW-' || lpad(i::text, 3, '0'), :'K1', :'V') ->> 'ok' k from generate_series(1, 3) i) x where k = 'true') = 3, 'other codes register (one key may serve several codes)');

-- ---------- a student sends a result ----------
\set stats '{"wait":12,"lwbs":1,"seen":30,"ama":0,"expired":0,"bedFirst":2,"fired":0,"walkout":0,"fast":40,"scen":"none"}'
select t_ok(cb_submit('kta-80p', '00000000-0000-4000-8000-000000000001', 'Sam', 'rn', 'med', 85, 3, 1200, :'stats', :'V') = '{"ok": true}', 'a good result is accepted');
select pg_sleep(0.01);
reset role;
select t_ok((select expires_at = created_at + interval '30 days' from codeblack.classes where code = 'KTA-80P'), 'the first result makes the class last 30 days from when it was made');
set role anon;
select t_ok(cb_submit('KTA-80P', '00000000-0000-4000-8000-000000000001', 'Sam', 'rn', 'med', 85, 3, 1200, :'stats', :'V') = '{"ok": true, "dup": true}', 'the same result sent again is kept once');
do $$ declare n text; i int := 10; begin
  foreach n in array array['José', 'Zoë', 'O''Neil', 'Mary-Kate', 'J.D.', 'Ana M.', '  Ty   Lee ', 'Ann’s', 'S', 'Mary Ann K.', 'Abcdefghijklmnopqrst', 'Jose' || chr(769)] loop
    i := i + 1;
    perform t_ok(cb_submit('KTA-80P', ('00000000-0000-4000-8000-0000000000' || i)::uuid, n, 'md', 'hard', 50 + i, 2, 900, '{}', '0.31.0') ->> 'ok' = 'true', format('the name %L is accepted', n));
  end loop;
  foreach n in array array['Bob1', 'a@b.com', '<b>x</b>', '', '   ', 'Jane Q Public Jr', 'Abcdefghijklmnopqrstu', 'Sam' || chr(8238) || 'x', '.Sam', '555-1234', 'Sam_K', 'Sam;--',
                           'ㅤㅤㅤ', '５５５', '٥٥٥', '५५५', 'Ⅷ', '𝐒𝐚𝐦', 'Sam' || chr(4447)] loop
    perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), n, 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "invalid", "field": "name"}', format('the name %L is refused, and the game is told it was the name', n));
  end loop;
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), null, 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'field' = 'name', 'a missing name is refused');
end $$;
reset role;
select t_ok((select name from codeblack.results where code = 'KTA-80P' and cid = '00000000-0000-4000-8000-000000000022') = 'José', 'a name typed with a combining accent is stored composed');
set role anon;
do $$ declare s jsonb; f text; begin
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'er', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'field' = 'role', 'an unknown role is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'train', 50, 1, 60, '{}', '0.31.0') ->> 'field' = 'level', 'an Orientation shift is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 101, 1, 60, '{}', '0.31.0') ->> 'field' = 'score', 'a score over 100 is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', -1, 1, 60, '{}', '0.31.0') ->> 'field' = 'score', 'a negative score is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 4, 60, '{}', '0.31.0') ->> 'field' = 'stars', 'four stars are refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 86401, '{}', '0.31.0') ->> 'field' = 'time', 'more than a day of play is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', null, 1, 60, '{}', '0.31.0') ->> 'field' = 'score', 'a missing score is refused');
  perform t_ok(cb_submit('KTA-80P', null, 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'field' = 'cid', 'a result without its id is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', null) ->> 'field' = 'ver', 'a result without a version is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.30.0') = '{"error": "unknown"}', 'a result from another game version than the class is refused, with the same answer as an unknown code');
  foreach s in array array['[]', '"x"', 'null']::jsonb[] loop
    perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, s, '0.31.0') ->> 'field' = 'stats', format('stats that aren''t an object (%s) are refused', s));
  end loop;
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, null, '0.31.0') ->> 'field' = 'stats', 'missing stats are refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, ('{"wait":1,"scen":"' || repeat('a', 2000) || '"}')::jsonb, '0.31.0') ->> 'field' = 'size', 'oversized stats are refused before any work');
  perform t_ok(cb_submit('ZZZ-999', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "unknown"}', 'a code nobody registered is refused');
end $$;
reset role;
select t_ok(codeblack.clean_stats('{"evil":1,"wait":"12","lwbs":-1,"seen":1.5,"ama":1e3,"expired":[1],"bedFirst":{"a":1},"scen":"none","fired":1}') = '{"ama": 1000, "fired": 1}', 'stats keep only known keys with whole numbers; the rest (and the scenario, which the code names) is dropped');
select t_ok(codeblack.clean_stats(('{"wait":' || '0e-16383' || ',"lwbs":0e-16383}')::jsonb) = '{}', 'a number with a huge scale (0e-16383) is dropped, not stored');
set role anon;
select t_ok(cb_submit('KTA-80P', '00000000-0000-4000-8000-000000000099', 'Max', 'rn', 'med', 40, 1, 60, '{"wait":0e-16383,"unknown":5,"seen":7}', :'V') = '{"ok": true}', 'a result with an unknown stat and a bad number is still accepted');
reset role;
select t_ok((select stats from codeblack.results where code = 'KTA-80P' and cid = '00000000-0000-4000-8000-000000000099') = '{"seen": 7}', 'and only the good numbers are stored');
set role anon;

-- ---------- the instructor reads and deletes ----------
select t_ok(cb_class_read('KTA-80P', :'K2') = '{"error": "key"}', 'a wrong key reads nothing');
select t_ok(cb_class_read('ZZZ-999', :'K1') = '{"error": "key"}', 'an unknown code gives the same answer as a wrong key');
select t_ok(cb_class_read('KTA-80P', null) = '{"error": "key"}' and cb_class_read('KTA-80P', '') = '{"error": "key"}', 'no key reads nothing');
select cb_class_read('kta-80p', :'K1')::text as rd \gset
select t_ok(jsonb_array_length(:'rd'::jsonb -> 'rows') = 14, 'the right key reads every result for the code (14)');
select t_ok((:'rd'::jsonb -> 'rows' -> 0 ->> 'name') = 'Sam' and (select bool_and(x.c >= x.p) from (select (e ->> 'created_at')::timestamptz c, lag((e ->> 'created_at')::timestamptz, 1, '-infinity') over (order by o) p
             from jsonb_array_elements(:'rd'::jsonb -> 'rows') with ordinality t(e, o)) x), 'in the order they came in (the game shows them unranked)');
select t_ok((select array_agg(k order by k) from jsonb_object_keys(:'rd'::jsonb) k) = (select array_agg(x order by x) from jsonb_array_elements_text(:'call'::jsonb -> 'responses' -> 'cb_class_read') x)
        and (select bool_and((select array_agg(k order by k) from jsonb_object_keys(e) k) = (select array_agg(x order by x) from jsonb_array_elements_text(:'call'::jsonb -> 'responses' -> 'cb_class_read_row') x)) from jsonb_array_elements(:'rd'::jsonb -> 'rows') e),
  'the read''s answer and each row have exactly the keys the contract lists');
select t_ok(exists (select 1 from jsonb_array_elements(:'rd'::jsonb -> 'rows') e where e ->> 'name' = 'Ty Lee')
        and exists (select 1 from jsonb_array_elements(:'rd'::jsonb -> 'rows') e where e ->> 'name' = 'Ann''s'), 'names are stored trimmed, with single spaces and plain apostrophes');
select t_ok((select bool_and((e ->> 'id') ~ '^[0-9a-f-]{36}$' and e ? 'ver' and e ? 'stats' and not e ? 'code') from jsonb_array_elements(:'rd'::jsonb -> 'rows') e), 'each row''s id is the result''s own id, not a number that counts the whole service');
select t_ok(cb_class_read('KTA-80P', regexp_replace(lower(:'K1'), '(....)', '\1-', 'g')) ? 'rows', 'the key works typed in lower case with dashes');
select t_ok(cb_class_read('KTA-80P', translate(:'K1', '1', 'L')) ? 'rows', 'and with L for 1');
select t_ok(cb_class_delete('KTA-80P', :'K2', '00000000-0000-4000-8000-000000000001') = '{"error": "key"}', 'a wrong key deletes nothing');
select t_ok(cb_class_delete('KTA-80P', :'K1') = '{"error": "invalid"}', 'a delete with neither a result nor "all" deletes nothing');
select t_ok(cb_class_delete('KTA-80P', :'K1', '00000000-0000-4000-8000-000000000001') = '{"deleted": 1}', 'the key deletes one result');
select t_ok(jsonb_array_length(cb_class_read('KTA-80P', :'K1') -> 'rows') = 13, 'and it is gone');
select t_ok(cb_class_new('KTC-80P', :'K2', :'V') ->> 'ok' = 'true', 'another instructor registers another code');
select t_ok(cb_submit('KTC-80P', '00000000-0000-4000-8000-0000000000c1', 'Lee', 'rn', 'med', 70, 2, 600, '{}', :'V') ->> 'ok' = 'true', 'and gets a result');
select t_ok(cb_class_read('KTC-80P', :'K1') = '{"error": "key"}', 'one class''s key doesn''t open another class');
select t_ok(cb_class_delete('KTA-80P', :'K1', '00000000-0000-4000-8000-0000000000c1') = '{"deleted": 0}', 'and can''t delete another class''s result by its id');
select t_ok(cb_class_delete('KTA-80P', :'K1', null, true) = '{"deleted": 13}', 'the key deletes all of a class''s results (13)');
select t_ok(cb_class_read('KTA-80P', :'K1') -> 'rows' = '[]', 'and none are left');
select t_ok(jsonb_array_length(cb_class_read('KTC-80P', :'K2') -> 'rows') = 1, 'the other class keeps its result');

-- ---------- rate limits, per network and hour ----------
select t_net('198.51.100.7');
do $$ declare n int := 0; begin
  for i in 1..60 loop if cb_class_new('R' || lpad(i::text, 5, '0'), '7K2M9QXH4V1R8ZTB', '0.31.0') ->> 'ok' = 'true' then n := n + 1; end if; end loop;
  perform t_ok(n = 60, 'one network registers 60 codes in an hour');
  perform t_ok(cb_class_new('R00061', '7K2M9QXH4V1R8ZTB', '0.31.0') = '{"error": "busy"}', 'the 61st is refused');
  perform t_net('198.51.100.8');
  perform t_ok(cb_class_new('R00061', '7K2M9QXH4V1R8ZTB', '0.31.0') ->> 'ok' = 'true', 'another network is not held back');
end $$;
select t_net('192.0.2.1');
select t_ok(cb_class_new('KMN-000', :'K3', :'V') ->> 'ok' = 'true', 'a class for the limit checks');
do $$ declare n int := 0; begin
  for i in 1..500 loop if cb_submit('KMN-000', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'ok' = 'true' then n := n + 1; end if; end loop;
  perform t_ok(n = 500, 'a class takes 500 results');
  perform t_ok(cb_submit('KMN-000', gen_random_uuid(), 'Bo', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "full", "scope": "class"}', 'the 501st is refused: the class is full (and the answer says it''s this class)');
  for i in 1..99 loop perform cb_submit('ZZZ-999', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0'); end loop;
  perform t_ok(cb_submit('ZZZ-999', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "busy"}', 'one network sends 600 results an hour; the next is refused (probes count too)');
end $$;
reset role;
select t_ok((select n from codeblack.rate where kind = 'submit' and who = (select who from codeblack.rate where kind = 'submit' order by n desc limit 1)) = 601, 'the counter stops one past the limit');
set role anon;
select t_net('192.0.2.1');
do $$ begin for i in 1..50 loop perform cb_submit('ZZZ-999', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0'); end loop; end $$;
reset role;
select t_ok((select max(n) from codeblack.rate where kind = 'submit') = 601 and (select count(*) from codeblack.rate) < 20, 'refused requests write nothing more: one row per network, kind and hour');
set role anon;
select t_net('192.0.2.9');
do $$ declare n int := 0; begin
  for i in 1..300 loop if cb_class_read('KMN-000', 'WRONGKEYWRONGKEY') = '{"error": "key"}' then n := n + 1; end if; end loop;
  perform t_ok(n = 300 and cb_class_read('KMN-000', 'WRONGKEYWRONGKEY') = '{"error": "busy"}', 'reads are limited to 300 an hour per network');
  for i in 1..120 loop perform cb_class_delete('KMN-000', 'WRONGKEYWRONGKEY', null, true); end loop;
  perform t_ok(cb_class_delete('KMN-000', 'WRONGKEYWRONGKEY', null, true) = '{"error": "busy"}', 'wrong-key deletes are limited to 120 an hour');
  perform t_ok(cb_class_delete('KMN-000', '0123456789ABCDEF', gen_random_uuid()) = '{"deleted": 0}', 'the right key still deletes from that network: keyed deletes aren''t limited');
end $$;
select t_net('192.0.2.50');
do $$ declare n int := 0; begin
  for i in 1..30 loop if cb_health(true) = '{"ok": true}' then n := n + 1; end if; end loop;
  perform t_ok(n = 30 and cb_health(true) = '{"error": "busy"}', 'the deploy''s forged-header probe has its own bucket of 30 an hour');
  perform t_ok(cb_health() ? 'db', 'and doesn''t use up the health check''s own budget');
end $$;
select set_config('request.headers', '{"x-forwarded-for":"10.1.2.3"}', false);
select t_ok(cb_health() ->> 'public' = 'false', 'a private address is reported as not public (the gateway would be hiding callers)');
select t_net(null);
select t_ok(cb_class_read('KMN-000', :'K3') ? 'rows', 'a call with no request headers (the SQL editor) is not limited');

-- ---------- what the database keeps about networks ----------
reset role;
select t_ok(not exists (select 1 from codeblack.rate where who ~ '[.:]') and (select bool_and(who ~ '^[0-9a-f]{64}$') from codeblack.rate), 'only a keyed hash of each address is stored');
select t_ok((select count(*) from codeblack.salt) = 1 and (select day from codeblack.salt) = (now() at time zone 'UTC')::date, 'there is one salt, for today (in UTC)');
select set_config('request.headers', '{"x-forwarded-for":"2001:db8:1:2::1"}', false); select codeblack.client_ip() as v6a \gset
select set_config('request.headers', '{"x-forwarded-for":"2001:db8:1:7f::1"}', false); select codeblack.client_ip() as v6b \gset
select t_ok(:'v6a' = '2001:db8:1::/56' and :'v6a' = :'v6b', 'IPv6 addresses count by their /56');
do $$ declare v text; begin
  foreach v in array array['::ffff:192.0.2.1', '::FFFF:192.0.2.1', '0:0:0:0:0:ffff:c000:201', '192.0.2.1'] loop
    perform set_config('request.headers', json_build_object('x-forwarded-for', v)::text, false);
    perform t_ok(codeblack.client_ip() = '192.0.2.1', format('%s counts as 192.0.2.1', v));
  end loop;
end $$;
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.9","x-forwarded-for":"10.0.0.1, 203.0.113.10"}', false);
select t_ok(codeblack.client_ip() = '203.0.113.9', 'Cloudflare''s address header wins over x-forwarded-for');
select set_config('request.headers', '{"x-forwarded-for":"anything-at-all"}', false);
select t_ok(codeblack.client_ip() is null and codeblack.who() = codeblack.who(), 'a header that isn''t an address counts as one shared "unknown" network, not as its own');
select set_config('request.headers', 'not json', false);
select t_ok(codeblack.client_ip() is null, 'bad headers mean no address, not an error');
select set_config('request.headers', '', false);

-- ---------- 30 days, 7 days, and the clean-up ----------
update codeblack.classes set created_at = now() - interval '30 days 1 second', expires_at = now() - interval '1 second' where code in ('KTC-80P', 'KMN-000');   -- classes that got results, now ended
set role anon;
select t_net('203.0.113.77');
select t_ok(cb_class_read('KTC-80P', :'K2') = '{"error": "key"}', 'an expired class can''t be read, even with its key');
select t_ok(cb_submit('KTC-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', :'V') ->> 'error' = 'unknown', 'or sent to');
select t_ok(cb_class_new('KTC-80P', :'K1', :'V') = '{"error": "taken"}', 'its code is held: another key gets "taken", so a student who knows the code can''t take it over');
reset role;
select t_ok(not exists (select 1 from codeblack.results where code in ('KTC-80P', 'KMN-000')), 'the ended classes'' results are gone at once, without the hourly job');
select t_ok((select key_hash from codeblack.classes where code = 'KTC-80P') = codeblack.key_hash(:'K2'), 'the held code keeps only its key''s hash, no student data');
set role anon;
select t_net('203.0.113.78');
select cb_class_new('KTC-80P', :'K2', :'V')::text as back \gset
select t_ok(:'back'::jsonb ->> 'ok' = 'true' and (:'back'::jsonb ->> 'expires')::timestamptz > now() + interval '13 days' and cb_class_read('KTC-80P', :'K2') -> 'rows' = '[]', 'its own key turns it back on, as a new, empty class');
reset role;
insert into codeblack.classes (code, key_hash, ver, created_at, expires_at) values ('PQR-001', repeat('a', 64), '0.31.0', now() - interval '30 days 3 hours', now() - interval '3 hours');   -- a class that got results
insert into codeblack.results (code, cid, name, role, level, score, stars, real_sec, stats, ver) values ('PQR-001', gen_random_uuid(), 'Old', 'rn', 'med', 1, 1, 1, '{}', '0.31.0');
insert into codeblack.classes (code, key_hash, ver, created_at, expires_at) values ('PQR-002', repeat('b', 64), '0.31.0', now() - interval '61 days', now() - interval '31 days');
insert into codeblack.classes (code, key_hash, ver, created_at, expires_at) values ('PQR-003', repeat('c', 64), '0.31.0', now() - interval '14 days 3 hours', now() - interval '3 hours');   -- an unused class
select t_ok((cb_health() ->> 'overdue')::int = 2, 'the health call sees results that should have gone hours ago, and a code held past its 30 days (an unused class just ended is held, not overdue)');
insert into codeblack.rate (who, kind, hour, n) values (repeat('a', 64), 'read', now() - interval '3 hours', 1);
insert into codeblack.salt (day, salt) values (current_date - 3, extensions.gen_random_bytes(32));
select codeblack.tidy();
select t_ok(not exists (select 1 from codeblack.results where code = 'PQR-001') and exists (select 1 from codeblack.classes where code = 'PQR-001')
        and not exists (select 1 from codeblack.classes where code = 'PQR-002') and exists (select 1 from codeblack.classes where code = 'PQR-003')
        and (cb_health() ->> 'overdue')::int = 0, 'the clean-up deletes ended classes'' results and codes held past their 30 days; an unused class''s code is held too (a planned code may be known; R5.8-02)');
select t_ok(not exists (select 1 from codeblack.rate where hour < now() - interval '2 hours' and kind not like '%\_day') and not exists (select 1 from codeblack.salt where day < (now() at time zone 'UTC')::date - 1), 'and old counters and salts');
select t_ok(exists (select 1 from codeblack.classes where code = 'KTA-80P'), 'and leaves live classes alone');

-- ---------- round 6: time zones, daily limits, names, health ----------
set role anon;
select t_net('198.51.100.40');
do $$ declare n int := 0; begin
  set local timezone to 'UTC';
  for i in 1..30 loop if cb_health(true) = '{"ok": true}' then n := n + 1; end if; end loop;
  perform set_config('timezone', 'Pacific/Kiritimati', true);
  perform t_ok(n = 30 and cb_health(true) = '{"error": "busy"}', 'asking for another time zone (UTC+14) doesn''t open a new rate-limit bucket');
  perform set_config('timezone', 'Asia/Kathmandu', true);
  perform t_ok(cb_health(true) = '{"error": "busy"}', 'nor does a zone at a quarter past the hour (UTC+5:45)');
end $$;
reset role;
select t_ok(not exists (select 1 from codeblack.salt where day <> (now() at time zone 'UTC')::date), 'the daily salt is the UTC day''s, whatever the caller''s time zone');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.41"}', false); select codeblack.who() as w41 \gset
insert into codeblack.rate (who, kind, hour, n) values (:'w41', 'class_day', date_trunc('day', now(), 'UTC'), 200), (:'w41', 'submit_day', date_trunc('day', now(), 'UTC'), 3000);
set role anon;
select t_net('198.51.100.41');
select t_ok(cb_class_new('DAY-001', :'K1', :'V') = '{"error": "busy"}', 'a network that made 200 codes today is refused, though under its hourly limit');
select t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', :'V') = '{"error": "busy"}', 'and one that sent 3,000 results today');
select t_net('198.51.100.42');
select t_ok(cb_class_new('DAY-001', :'K1', :'V') ->> 'ok' = 'true', 'another network is not held back');
reset role;
select set_config('request.headers', '{"x-forwarded-for":"2001:db8:aa:100::1"}', false); select codeblack.who();
insert into codeblack.rate (who, kind, hour, n) values
  (encode(extensions.hmac(convert_to('/48 ' || network(set_masklen('2001:db8:aa::1'::inet, 48))::text, 'UTF8'), (select salt from codeblack.salt where day = (now() at time zone 'UTC')::date), 'sha256'), 'hex'), 'submit_day48', date_trunc('day', now(), 'UTC'), 10000),
  (encode(extensions.hmac(convert_to('/48 ' || network(set_masklen('2001:db8:aa::1'::inet, 48))::text, 'UTF8'), (select salt from codeblack.salt where day = (now() at time zone 'UTC')::date), 'sha256'), 'hex'), 'class_day48', date_trunc('day', now(), 'UTC'), 1000);
set role anon;
select t_net('2001:db8:aa:7700::1');
select t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', :'V') = '{"error": "busy"}' and cb_class_new('DAY-048', :'K1', :'V') = '{"error": "busy"}',
  'an IPv6 /48 that sent 10,000 results or made 1,000 codes today is refused, from any of its /56 networks');
select t_net('2001:db8:bb:100::1');
select t_ok(cb_class_new('DAY-048', :'K1', :'V') ->> 'ok' = 'true', 'another /48 is not held back');
select t_net('198.51.100.60');
do $$ declare n int := 0; begin
  for i in 1..200 loop if cb_class_new('', '', '') = '{"error": "invalid"}' then n := n + 1; end if; end loop;
  perform t_ok(n = 200 and cb_class_new('FRE-001', '7K2M9QXH4V1R8ZTB', '0.31.0') ->> 'ok' = 'true', 'invalid calls are refused before they count: 200 of them don''t spend a network''s limits (audit R3.8-01)');
  perform t_ok(cb_class_new('FRE-001', 'ABCDEFGHJKMNPQRS', '0.31.0') = '{"error": "taken"}', 'a code another key holds answers "taken"');
end $$;
select t_net('198.51.100.43');
select t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', :'V') ->> 'ok' = 'true', 'and IPv4 callers have no /48 limit');
reset role;
insert into codeblack.rate (who, kind, hour, n) values (repeat('b', 64), 'class_day', date_trunc('day', now(), 'UTC') - interval '2 days', 5);
select codeblack.tidy();
select t_ok(exists (select 1 from codeblack.rate where kind = 'class_day' and who = :'w41') and not exists (select 1 from codeblack.rate where who = repeat('b', 64)), 'the clean-up keeps today''s daily counters and deletes older ones');
update codeblack.classes set expires_at = now() - interval '1 minute' where code = 'DAY-001';
set role anon;
select t_net('198.51.100.43');
select cb_class_new('DAY-001', :'K1', :'V')::text as re \gset
select t_ok(:'re'::jsonb ->> 'ok' = 'true' and (:'re'::jsonb ->> 'expires')::timestamptz > now() + interval '13 days', 'an ended class, registered again with its key, starts afresh (not with an expiry in the past)');
select t_ok(cb_class_read('DAY-001', :'K1') ? 'created', 'the read says when the class was made');
reset role;
select t_ok(codeblack.clean_stats('{"fast":101,"mdDied":1,"contra":2,"unneeded":1,"endMin":300}') = '{"mdDied": 1, "contra": 2, "unneeded": 1, "endMin": 300}', 'the new stats keys are kept; a sped-up share over 100% is dropped');
set role anon;
select t_ok(cb_submit('DAY-001', gen_random_uuid(), 'Max', 'md', 'hard', 50, 1, 60,
  '{"wait":999999,"lwbs":999999,"seen":999999,"ama":999999,"expired":999999,"bedFirst":999999,"fired":1,"walkout":1,"fast":100,"dxRight":999999,"dxWrong":999999,"mdSeen":999999,"harm":999999,"radioRight":999999,"radioWrong":999999,"radioMiss":999999,"mdDied":999999,"contra":999999,"unneeded":999999,"endMin":999999}', :'V') = '{"ok": true}',
  'a result with every stats key at its largest is stored (no raw check-constraint error)');
reset role;
do $$ declare v text; begin
  foreach v in array array['::1', '0.0.0.0', '255.255.255.255', '224.0.0.1', '192.0.2.10', '198.18.0.1', '2001:db8::1', '64:ff9b::a00:1', '::10.0.0.1', '100.64.1.1', 'fe80::1',
                           '3fff::1', '5f00::1', 'fec0::1', '::ffff:0:a00:1', '1::1', '4000::1', 'e000::1', 'ff02::1'] loop
    perform t_ok(not codeblack.is_public(v::inet), format('%s is not a public address', v));
  end loop;
  foreach v in array array['8.8.8.8', '2606:4700::1111'] loop
    perform t_ok(codeblack.is_public(v::inet), format('%s is a public address', v));
  end loop;
end $$;
select set_config('request.headers', '{"cf-connecting-ip":"::1"}', false);
select t_ok(cb_health() ->> 'public' = 'false', 'the health check reads the address before grouping it: IPv6 loopback isn''t public');
select set_config('request.headers', '{"x-forwarded-for":"198.51.100.44"}', false);
select cb_health()::text as hl \gset
select t_ok((select array_agg(k order by k) from jsonb_object_keys(:'hl'::jsonb) k) = (select array_agg(x order by x) from jsonb_array_elements_text(:'call'::jsonb -> 'responses' -> 'cb_health') x), 'the health answer has exactly the keys the contract lists');
select t_ok((:'hl'::jsonb -> 'migs') = (select jsonb_agg(name order by name) from codeblack.migrations) and jsonb_array_length(:'hl'::jsonb -> 'migs') >= 2, 'it lists every recorded migration, so a skipped one shows');
select t_ok((:'hl'::jsonb ->> 'classes')::numeric between 0 and 1 and (:'hl'::jsonb ->> 'results')::numeric between 0 and 1, 'and how full the two storage backstops are');
select set_config('request.headers', '', false);

drop function public.t_ok(boolean, text);
drop function public.t_net(text);
