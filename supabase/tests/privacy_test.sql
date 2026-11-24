-- Checks of the Code Black class-results rules, run by supabase/tests/run.sh on a throwaway local Postgres after
-- the migrations. "set role anon" is the browser with the publishable key; request.headers is the network address
-- Supabase would pass in. Each check prints "ok - ..."; the first failure stops the run.
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
\set stats '{"wait":12,"lwbs":1,"seen":30,"ama":0,"expired":0,"bedFirst":2,"scen":"none"}'

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
select t_ok(count(*) = 4 and bool_and(p.prosecdef) and bool_and(array_to_string(p.proconfig, ',') = 'search_path=""'), 'the four API functions run as their owner with an empty search path')
  from pg_proc p where p.oid in ('public.cb_class_new(text,text)'::regprocedure, 'public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)'::regprocedure,
                                 'public.cb_class_read(text,text)'::regprocedure, 'public.cb_class_delete(text,text,bigint)'::regprocedure);
select t_ok(bool_and(array_to_string(p.proconfig, ',') = 'search_path=""') and not bool_or(p.prosecdef), 'the codeblack helpers have an empty search path and are not security definers')
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'codeblack';
select t_ok(not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where n.nspname = 'codeblack' and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner), 'nobody but the owner may run a codeblack helper');
select t_ok(not exists (select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                        where p.oid = 'public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)'::regprocedure and a.grantee = 0), 'PUBLIC may not run cb_submit (only the API roles)');
select t_ok(exists (select 1 from cron.job where jobname = 'codeblack-tidy' and command = 'select codeblack.tidy()'), 'the hourly 30-day clean-up is scheduled');
select t_ok((select count(*) from cron.job where jobname = 'codeblack-tidy') = 1, 'and scheduled once, after two runs of the migration');
select t_ok((select octet_length(salt) from codeblack.salt where id = 1) = 32, 'there is a 32-byte salt for hashing network addresses');

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

-- ---------- an instructor registers a code ----------
select cb_class_new('kta-80p', '0.31.0')::text as r \gset
select t_ok((:'r'::jsonb ->> 'key') ~ '^[0-9A-HJKMNP-TV-Z]{16}$', 'registering a code returns a 16-character key in the game''s alphabet');
select t_ok((:'r'::jsonb ->> 'expires')::timestamptz between now() + interval '29 days 23 hours' and now() + interval '30 days 1 minute', 'and the class expires in 30 days');
select :'r'::jsonb ->> 'key' as key1 \gset
select t_ok(cb_class_new('KTA80P', '0.31.0') ->> 'error' = 'taken', 'the same code can''t be registered twice while it''s live (written another way)');
select t_ok(cb_class_new('KTA-80U', '0.31.0') ->> 'error' = 'invalid', 'a code with a letter outside the alphabet is refused');
select t_ok(cb_class_new('L1M-0O0', '0.31.0') ? 'key' and cb_class_new('11M-000', '0.31.0') ->> 'error' = 'taken', 'I and L read as 1 and O as 0, as in the game');
select t_ok(cb_class_new('KTA-80', '0.31.0') ->> 'error' = 'invalid', 'a short code is refused');
select t_ok(cb_class_new('KTB-80P', null) ->> 'error' = 'invalid' and cb_class_new('KTB-80P', 'x') ->> 'error' = 'invalid', 'a missing or malformed version is refused');
select t_ok((select count(*) from (select cb_class_new('NEW-' || lpad(i::text, 3, '0'), '0.31.0') ->> 'key' k from generate_series(1, 3) i) x where k is not null) = 3, 'other codes register');

-- ---------- a student sends a result ----------
select t_ok(cb_submit('kta-80p', '00000000-0000-4000-8000-000000000001', 'Sam', 'rn', 'med', 85, 3, 1200, :'stats', '0.31.0') = '{"ok": true}', 'a good result is accepted');
select t_ok(cb_submit('KTA-80P', '00000000-0000-4000-8000-000000000001', 'Sam', 'rn', 'med', 85, 3, 1200, :'stats', '0.31.0') = '{"ok": true, "dup": true}', 'the same result sent again is kept once');
do $$ declare n text; i int := 10; begin
  foreach n in array array['José', 'Zoë', 'O''Neil', 'Mary-Kate', 'J.D.', 'Ana M.', '  Ty   Lee ', 'Ann’s', 'S', 'Abcdefghijklmnopqrst'] loop
    i := i + 1;
    perform t_ok(cb_submit('KTA-80P', ('00000000-0000-4000-8000-0000000000' || i)::uuid, n, 'md', 'hard', 50 + i, 2, 900, '{}', '0.31.0') ->> 'ok' = 'true', format('the name %L is accepted', n));
  end loop;
  foreach n in array array['Bob1', 'a@b.com', '<b>x</b>', '', '   ', 'Jane Q Public', 'Abcdefghijklmnopqrstu', 'Sam' || chr(8238) || 'x', '.Sam', '555-1234', 'Sam_K', 'Sam;--'] loop
    perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), n, 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', format('the name %L is refused', n));
  end loop;
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), null, 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'a missing name is refused');
end $$;
do $$ declare s jsonb; begin
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'er', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'an unknown role is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'train', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'an Orientation shift is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 101, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'a score over 100 is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', -1, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'a negative score is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 4, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'four stars are refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 86401, '{}', '0.31.0') ->> 'error' = 'invalid', 'more than a day of play is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', null, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'a missing score is refused');
  perform t_ok(cb_submit('KTA-80P', null, 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'invalid', 'a result without its id is refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', null) ->> 'error' = 'invalid', 'a result without a version is refused');
  foreach s in array array['[]', '"x"', 'null', '{"evil":1}', '{"wait":"12"}', '{"wait":-1}', '{"wait":100001}', '{"scen":"<b>"}', '{"scen":5}', '{"seen":[1]}', '{"wait":{"a":1}}']::jsonb[] loop
    perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, s, '0.31.0') ->> 'error' = 'invalid', format('the stats %s are refused', s));
  end loop;
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, null, '0.31.0') ->> 'error' = 'invalid', 'missing stats are refused');
  perform t_ok(cb_submit('KTA-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, ('{"wait":1,"scen":"' || repeat('a', 700) || '"}')::jsonb, '0.31.0') ->> 'error' = 'invalid', 'oversized stats are refused');
  perform t_ok(cb_submit('ZZZ-999', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'unknown', 'a code nobody registered is refused');
end $$;

-- ---------- the instructor reads and deletes ----------
select t_ok(cb_class_read('KTA-80P', 'WRONGKEYWRONGKEY') = '{"error": "key"}', 'a wrong key reads nothing');
select t_ok(cb_class_read('ZZZ-999', :'key1') = '{"error": "key"}', 'an unknown code gives the same answer as a wrong key');
select t_ok(cb_class_read('KTA-80P', null) = '{"error": "key"}' and cb_class_read('KTA-80P', '') = '{"error": "key"}', 'no key reads nothing');
select cb_class_read('kta-80p', :'key1')::text as rd \gset
select t_ok(jsonb_array_length(:'rd'::jsonb -> 'rows') = 11, 'the right key reads every result for the code (11)');
select t_ok((:'rd'::jsonb -> 'rows' -> 0 ->> 'score')::int = 85 and (:'rd'::jsonb -> 'rows' -> 0 ->> 'name') = 'Sam', 'best score first');
select t_ok(exists (select 1 from jsonb_array_elements(:'rd'::jsonb -> 'rows') e where e ->> 'name' = 'Ty Lee')
        and exists (select 1 from jsonb_array_elements(:'rd'::jsonb -> 'rows') e where e ->> 'name' = 'Ann''s'), 'names are stored trimmed, with single spaces and plain apostrophes');
select t_ok((select bool_and(e ? 'id' and e ? 'ver' and e ? 'stats' and not e ? 'cid' and not e ? 'code') from jsonb_array_elements(:'rd'::jsonb -> 'rows') e), 'each row has its id, version and stats, and not the sender''s result id');
select t_ok(cb_class_read('KTA-80P', regexp_replace(lower(:'key1'), '(....)', '\1-', 'g')) ? 'rows', 'the key works typed in lower case with dashes');
select t_ok(cb_class_read('KTA-80P', translate(:'key1', '01', 'OL')) ? 'rows', 'and with O for 0 and L for 1');
select :'rd'::jsonb -> 'rows' -> 0 ->> 'id' as id1 \gset
select t_ok(cb_class_delete('KTA-80P', 'WRONGKEYWRONGKEY', :id1) = '{"error": "key"}', 'a wrong key deletes nothing');
select t_ok(cb_class_delete('KTA-80P', :'key1', :id1) = '{"deleted": 1}', 'the key deletes one result');
select t_ok(jsonb_array_length(cb_class_read('KTA-80P', :'key1') -> 'rows') = 10, 'and it is gone');
select cb_class_new('KTC-80P', '0.31.0') ->> 'key' as key2 \gset
select t_ok(cb_submit('KTC-80P', gen_random_uuid(), 'Lee', 'rn', 'med', 70, 2, 600, '{}', '0.31.0') ->> 'ok' = 'true', 'another class gets a result');
select t_ok(cb_class_delete('KTC-80P', :'key1', null) = '{"error": "key"}', 'one class''s key doesn''t open another class');
select t_ok(cb_class_delete('KTA-80P', :'key1', (cb_class_read('KTC-80P', :'key2') -> 'rows' -> 0 ->> 'id')::bigint) = '{"deleted": 0}', 'and can''t delete another class''s result by its id');
select t_ok(cb_class_delete('KTA-80P', :'key1') = '{"deleted": 10}', 'the key deletes all of a class''s results');
select t_ok(cb_class_read('KTA-80P', :'key1') -> 'rows' = '[]', 'and none are left');
select t_ok(jsonb_array_length(cb_class_read('KTC-80P', :'key2') -> 'rows') = 1, 'the other class keeps its result');

-- ---------- rate limits, per network ----------
select t_net('198.51.100.7');
do $$ declare n int := 0; begin
  for i in 1..20 loop if cb_class_new('R' || lpad(i::text, 5, '0'), '0.31.0') ? 'key' then n := n + 1; end if; end loop;
  perform t_ok(n = 20, 'one network registers 20 codes in an hour');
  perform t_ok(cb_class_new('R00021', '0.31.0') = '{"error": "busy"}', 'the 21st is refused');
  perform t_net('198.51.100.8');
  perform t_ok(cb_class_new('R00021', '0.31.0') ? 'key', 'another network is not held back');
end $$;
select t_net('192.0.2.1');
select cb_class_new('KMN-000', '0.31.0') ->> 'key' as key3 \gset
do $$ declare n int := 0; begin
  for i in 1..200 loop if cb_submit('KMN-000', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'ok' = 'true' then n := n + 1; end if; end loop;
  perform t_ok(n = 200, 'one network sends 200 results in an hour');
  perform t_ok(cb_submit('KMN-000', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "busy"}', 'the next is refused');
  perform t_ok(cb_submit('KMN-000', gen_random_uuid(), 'Al!', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "busy"}', 'refused requests count too: probing is limited');
  perform t_net('192.0.2.2');
  for i in 1..100 loop perform cb_submit('KMN-000', gen_random_uuid(), 'Bo', 'rn', 'med', 50, 1, 60, '{}', '0.31.0'); end loop;
  perform t_ok(cb_submit('KMN-000', gen_random_uuid(), 'Bo', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "full"}', 'a class holds at most 300 results');
  perform t_ok(cb_submit('KMN-000', '00000000-0000-4000-8000-000000000001', 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'full', 'a full class refuses a new result');
end $$;
select t_net('192.0.2.9');
do $$ declare n int := 0; begin
  for i in 1..120 loop if cb_class_read('KMN-000', 'WRONGKEYWRONGKEY') = '{"error": "key"}' then n := n + 1; end if; end loop;
  perform t_ok(n = 120 and cb_class_read('KMN-000', 'WRONGKEYWRONGKEY') = '{"error": "busy"}', 'key guesses are limited to 120 an hour per network');
end $$;
select t_net(null);
select t_ok(cb_class_read('KMN-000', :'key3') ? 'rows', 'a call with no request headers (the SQL editor) is not limited');

-- ---------- what the database keeps about networks ----------
reset role;
select t_ok(not exists (select 1 from codeblack.hits where who ~ '\.|:' ) and (select bool_and(who ~ '^[0-9a-f]{64}$') from codeblack.hits), 'only a keyed hash of each address is stored');
select t_ok((select count(distinct who) from codeblack.hits) = 6, 'six networks were seen');
select t_net('2001:db8:1:2::1'); select codeblack.client_ip() as v6a \gset
select t_net('2001:db8:1:2::ff'); select codeblack.client_ip() as v6b \gset
select t_ok(:'v6a' = '2001:db8:1:2::/64' and :'v6a' = :'v6b', 'IPv6 addresses count by their /64');
select t_net('::ffff:192.0.2.1'); select t_ok(codeblack.client_ip() = '::ffff:192.0.2.1', 'an IPv4 address written as IPv6 stays whole');
select set_config('request.headers', '{"cf-connecting-ip":"203.0.113.9","x-forwarded-for":"10.0.0.1, 203.0.113.10"}', false);
select t_ok(codeblack.client_ip() = '203.0.113.9', 'the Cloudflare address header wins over x-forwarded-for');
select set_config('request.headers', 'not json', false);
select t_ok(codeblack.client_ip() is null, 'bad headers mean no address, not an error');
select t_net(null);

-- ---------- global caps ----------
insert into codeblack.results (code, cid, name, role, level, score, stars, real_sec, stats, ver)
  select 'NEW-001', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0' from generate_series(1, 3000 - (select count(*) from codeblack.results));
set role anon;
select t_net('203.0.113.77');
select t_ok(cb_submit('NEW-002', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') = '{"error": "busy"}', 'at 3,000 new results in an hour, everyone waits');
reset role;
delete from codeblack.results where code = 'NEW-001';

-- ---------- 30 days ----------
update codeblack.classes set expires_at = now() - interval '1 second' where code in ('KTC-80P', 'KMN-000');
set role anon;
select t_ok(cb_class_read('KTC-80P', :'key2') = '{"error": "key"}', 'an expired class can''t be read, even with its key');
select t_ok(cb_submit('KTC-80P', gen_random_uuid(), 'Al', 'rn', 'med', 50, 1, 60, '{}', '0.31.0') ->> 'error' = 'unknown', 'or sent to');
select t_ok(cb_class_new('KTC-80P', '0.31.0') ? 'key', 'its code can be registered again, by a new instructor');
select t_ok(cb_class_read('KTC-80P', :'key2') = '{"error": "key"}', 'the old key doesn''t open the new class');
reset role;
select t_ok(not exists (select 1 from codeblack.results where code = 'KTC-80P'), 'the expired class''s results went with it');
insert into codeblack.hits (who, kind, at) values (repeat('a', 64), 'read', now() - interval '25 hours');
select count(*) as nlim from codeblack.results where code = 'KMN-000' \gset
select t_ok(:nlim = 300, format('before the clean-up an expired class still holds its rows (%s)', :nlim));
select codeblack.tidy();
select t_ok(not exists (select 1 from codeblack.classes where code = 'KMN-000') and not exists (select 1 from codeblack.results where code = 'KMN-000'), 'the clean-up deletes expired classes and their results');
select t_ok(not exists (select 1 from codeblack.hits where at < now() - interval '1 day'), 'and network hashes older than a day');
select t_ok(exists (select 1 from codeblack.classes where code = 'KTA-80P'), 'and leaves live classes alone');

drop function public.t_ok(boolean, text);
drop function public.t_net(text);
