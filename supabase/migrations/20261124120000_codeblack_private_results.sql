-- Code Black Phase 2 (v0.31.0): private class results.
--
-- What changes (audit findings R3-01, R3-02, R3-03, R3-13, R3-15, and the round-4 review of this file):
--   * Class results move to a private schema, codeblack, that the API does not expose and the public key has no
--     grant on. The browser reaches them only through these functions:
--       cb_class_new     an instructor registers a code with an instructor key the game made (only its SHA-256 is kept)
--       cb_submit        a student sends a result for a registered code (checked, rate limited, kept once)
--       cb_class_read    the instructor reads the results, with the key
--       cb_class_delete  the instructor deletes one result or all of them, with the key
--       cb_health        which migration is live, and whether the clean-up job runs (no class data)
--   * Reading by code alone is gone (the old cb_class(text)), so classmates and strangers can't read names.
--   * A code and its results are deleted 30 days after the code was made, or 7 days after if nobody sends a
--     result (an hourly job, and every new code also clears expired ones).
--   * Names: a first name or initials. Letters, then letters, periods, hyphens and apostrophes; up to three words
--     and 20 characters. No digits in any script, no @, no invisible filler characters.
--   * Rate limits: one counter per network, kind and hour. The network is a keyed hash of its address with a salt
--     that changes every day; counters and salts are deleted within two days.
--
-- It stops without changing anything if public.cb_results has any rows (it has had none). Safe to run twice.
-- Leaves alone: the gate (cb_gate, cb_gate_on, cb_gate_check) and everything that belongs to Case Room.
-- caseroom.cb_hits stays because caseroom.tidy() cleans it; nothing writes to it after this.
-- The order with the game: apply this first, then release v0.31.0. supabase/README.md has the steps.

begin;

do $$ declare n bigint := 0; begin
  if to_regclass('public.cb_results') is not null then   -- EXECUTE: on a second run the table is already gone
    execute 'lock table public.cb_results in access exclusive mode';   -- nothing can be added between the count and the drop
    execute 'select count(*) from public.cb_results' into n;
    if n > 0 then raise exception 'public.cb_results has % rows. Nobody could read them under the new rules: export or delete them first.', n; end if;
  end if;
end $$;

-- ---------- the private schema ----------
create schema if not exists codeblack;
revoke all on schema codeblack from public, anon, authenticated;

create table if not exists codeblack.migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists codeblack.salt (
  day date primary key,
  salt bytea not null check (octet_length(salt) = 32)
);

create table if not exists codeblack.classes (
  code text primary key check (code ~ '^[0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  ver text not null check (ver ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'   -- 30 days from creation once a result arrives
);
create index if not exists classes_expires_idx on codeblack.classes (expires_at);

create table if not exists codeblack.results (
  code text not null references codeblack.classes (code) on delete cascade,
  cid uuid not null,   -- the result's own id, made by the game: a retry is kept once, and the instructor deletes by it
  name text not null check (char_length(name) between 1 and 20),
  role text not null check (role in ('rn', 'md')),
  level text not null check (level in ('easy', 'med', 'hard', 'rush')),
  score smallint not null check (score between 0 and 100),
  stars smallint not null check (stars between 0 and 3),
  real_sec integer not null check (real_sec between 0 and 86400),
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) < 400),
  ver text not null check (ver ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  created_at timestamptz not null default now(),
  primary key (code, cid)
);

create table if not exists codeblack.rate (
  who text not null,
  kind text not null check (kind in ('class', 'submit', 'read', 'badkey', 'health')),
  hour timestamptz not null,
  n int not null,
  primary key (who, kind, hour)
);

alter table codeblack.migrations enable row level security;
alter table codeblack.salt enable row level security;
alter table codeblack.classes enable row level security;
alter table codeblack.results enable row level security;
alter table codeblack.rate enable row level security;
revoke all on all tables in schema codeblack from public, anon, authenticated;
revoke all on all sequences in schema codeblack from public, anon, authenticated;

-- ---------- helpers (not callable from the API: the schema has no grants) ----------
-- The caller's address, as Supabase passes it: Cloudflare's cf-connecting-ip (Cloudflare replaces any value a client
-- sends), then x-real-ip, then the first x-forwarded-for entry. It must parse as an address; an IPv4 address written
-- as IPv6 becomes plain IPv4, and IPv6 counts by its /56 (one home or one phone carrier's customer). Whether the
-- gateway really replaces these headers is checked from outside by test/db_live.js.
create or replace function codeblack.client_ip()
 returns text language plpgsql stable set search_path to pg_catalog, pg_temp
as $$
declare h json; v text; a inet;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then return null;
  end;
  if h is null then return null; end if;
  v := coalesce(nullif(btrim(h ->> 'cf-connecting-ip'), ''), nullif(btrim(h ->> 'x-real-ip'), ''),
                nullif(btrim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''));
  if v is null or length(v) > 64 then return null; end if;
  begin
    a := v::pg_catalog.inet;
  exception when others then return null;
  end;
  if pg_catalog.family(a) = 6 and a <<= '::ffff:0.0.0.0/96'::pg_catalog.inet then
    a := split_part(pg_catalog.host(a), ':', 4)::pg_catalog.inet;   -- ::ffff:6.6.6.5 -> 6.6.6.5
  end if;
  if pg_catalog.family(a) = 6 then return pg_catalog.network(pg_catalog.set_masklen(a, 56))::text; end if;
  return pg_catalog.host(a);
end $$;

-- Who is asking, for the rate limits: an HMAC of the address with today's salt (an unreadable address counts as
-- "unknown"). Null when the call didn't come through the API (the SQL editor): those are not limited.
create or replace function codeblack.who()
 returns text language plpgsql volatile set search_path to pg_catalog, pg_temp
as $$
declare s bytea;
begin
  if nullif(current_setting('request.headers', true), '') is null then return null; end if;
  select x.salt into s from codeblack.salt x where x.day = current_date;
  if s is null then
    insert into codeblack.salt (day, salt) values (current_date, extensions.gen_random_bytes(32)) on conflict (day) do nothing;
    select x.salt into s from codeblack.salt x where x.day = current_date;
  end if;
  return encode(extensions.hmac(convert_to(coalesce(codeblack.client_ip(), 'unknown'), 'UTF8'), s, 'sha256'), 'hex');
end $$;

-- Counts this request and says whether the caller is within p_limit of this kind in this clock hour. One row per
-- network, kind and hour; once a network is over its limit, further refusals write nothing.
create or replace function codeblack.allow(p_kind text, p_limit int)
 returns boolean language plpgsql volatile set search_path to pg_catalog, pg_temp
as $$
declare v_who text := codeblack.who(); v_n int;
begin
  if v_who is null then return true; end if;
  insert into codeblack.rate as r (who, kind, hour, n) values (v_who, p_kind, date_trunc('hour', now()), 1)
    on conflict (who, kind, hour) do update set n = r.n + 1 where r.n <= p_limit
    returning r.n into v_n;
  return v_n is not null and v_n <= p_limit;
end $$;

-- 'abc-def', 'ABCDEF' and 'abc def' all become 'ABC-DEF'. O reads as 0, I and L as 1, as in the game.
create or replace function codeblack.norm_code(p text)
 returns text language sql immutable set search_path to pg_catalog, pg_temp
as $$
  select case when t ~ '^[0-9A-HJKMNP-TV-Z]{6}$' then substr(t, 1, 3) || '-' || substr(t, 4, 3) end
  from (select translate(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011') as t) x;
$$;

-- An instructor key: 16 characters of the same alphabet (80 bits), typed any way. Null if it isn't one.
create or replace function codeblack.norm_key(p text)
 returns text language sql immutable set search_path to pg_catalog, pg_temp
as $$
  select case when t ~ '^[0-9A-HJKMNP-TV-Z]{16}$' then t end
  from (select translate(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011') as t) x;
$$;

create or replace function codeblack.key_hash(p_key text)
 returns text language sql immutable set search_path to pg_catalog, pg_temp
as $$ select encode(extensions.digest(convert_to(p_key, 'UTF8'), 'sha256'), 'hex'); $$;

-- The class whose code and key these are, if it is live. Null otherwise (wrong key, unknown code, expired).
create or replace function codeblack.keyed_class(p_code text, p_key text)
 returns text language sql stable set search_path to pg_catalog, pg_temp
as $$
  select c.code from codeblack.classes c, (select codeblack.norm_code(p_code) as code, codeblack.norm_key(p_key) as k) x
  where x.k is not null and c.code = x.code and c.expires_at > now() and c.key_hash = codeblack.key_hash(x.k);
$$;

-- A result's stats, rebuilt from the known keys only: counts are whole numbers from 0 to 999,999, scen is a
-- scenario key. Unknown keys and bad values are dropped, so a game with one more number still sends. Null if it
-- isn't a small JSON object at all.
create or replace function codeblack.clean_stats(p jsonb)
 returns jsonb language plpgsql immutable set search_path to pg_catalog, pg_temp
as $$
declare o jsonb := '{}'::jsonb; k text; v jsonb; n numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 1000 then return null; end if;
  foreach k in array array['wait', 'lwbs', 'seen', 'ama', 'expired', 'bedFirst', 'fired', 'fast', 'dxRight', 'dxWrong'] loop
    v := p -> k;
    if v is not null and jsonb_typeof(v) = 'number' then
      n := v::numeric;   -- a jsonb number casts without printing it: 0e-16383 has scale 16383 and is dropped
      if scale(n) = 0 and n between 0 and 999999 then o := o || jsonb_build_object(k, n::int); end if;
    end if;
  end loop;
  v := p -> 'scen';
  if v is not null and jsonb_typeof(v) = 'string' and (v #>> '{}') ~ '^[a-z]{1,16}$' then o := o || jsonb_build_object('scen', v #>> '{}'); end if;
  return o;
end $$;

-- A first name or initials: letters, then letters, periods, hyphens and apostrophes; up to three words; 20
-- characters at most. Refused: digits in any common script, Roman-numeral and math letters, and invisible fillers.
create or replace function codeblack.clean_name(p text)
 returns text language sql immutable set search_path to pg_catalog, pg_temp
as $$
  select case when char_length(n) between 1 and 20
      and n ~ '^[[:alpha:]][[:alpha:].''-]*( [[:alpha:].''-]+){0,2}$'
      and n !~ '[ᅟᅠㅤﾠⅠ-ↈ０-９٠-٩۰-۹߀-߉०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯๐-๙໐-໙༠-༩၀-၉០-៩᠐-᠙\U0001D400-\U0001D7FF]'
    then n end
  from (select regexp_replace(btrim(replace(normalize(coalesce(p, ''), NFC), U&'\2019', '''')), '\s+', ' ', 'g') as n) x;
$$;

create or replace function codeblack.tidy()
 returns void language sql set search_path to pg_catalog, pg_temp
as $$
  delete from codeblack.classes where expires_at <= now();   -- and, through the foreign key, their results
  delete from codeblack.rate where hour < now() - interval '2 hours';
  delete from codeblack.salt where day < current_date - 1;
$$;

revoke all on all functions in schema codeblack from public, anon, authenticated;

-- ---------- the API ----------
-- An instructor registers a code with a key the game made. Registering the same code with the same key again is
-- fine (a retry after a lost answer). Returns {"ok": true, "expires"} or {"error": "invalid" | "taken" | "busy" | "full"}.
create or replace function public.cb_class_new(p_code text, p_key text, p_ver text)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp
as $$
declare v_code text; v_key text; v_exp timestamptz; v_hash text;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_key) > 64 or octet_length(p_ver) > 16, false) then
    return jsonb_build_object('error', 'invalid');
  end if;
  if not codeblack.allow('class', 60) then return jsonb_build_object('error', 'busy'); end if;
  v_code := codeblack.norm_code(p_code); v_key := codeblack.norm_key(p_key);
  if v_code is null or v_key is null or coalesce(p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$', true) then
    return jsonb_build_object('error', 'invalid');
  end if;
  delete from codeblack.classes c where c.code in (select x.code from codeblack.classes x where x.expires_at <= now() limit 500);
  if (select c.reltuples from pg_catalog.pg_class c where c.oid = 'codeblack.classes'::regclass) > 300000 then
    return jsonb_build_object('error', 'full');   -- a storage backstop, far above any real use
  end if;
  v_hash := codeblack.key_hash(v_key);
  insert into codeblack.classes (code, key_hash, ver) values (v_code, v_hash, p_ver)
    on conflict (code) do nothing returning expires_at into v_exp;
  if v_exp is null then
    select c.expires_at into v_exp from codeblack.classes c where c.code = v_code and c.key_hash = v_hash;
    if v_exp is null then return jsonb_build_object('error', 'taken'); end if;
  end if;
  return jsonb_build_object('ok', true, 'expires', v_exp);
end $$;

-- A student sends a result. Returns {"ok": true} (with "dup": true if this result was already in), or
-- {"error": "invalid", "field": ...} | {"error": "unknown" | "version" | "full" | "busy"}.
create or replace function public.cb_submit(p_code text, p_cid uuid, p_name text, p_role text, p_level text,
                                            p_score int, p_stars int, p_real_sec int, p_stats jsonb, p_ver text)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp
as $$
declare v_code text; v_name text; v_stats jsonb; v_cls text; v_cver text; v_bad text;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_name) > 200 or octet_length(p_role) > 8 or octet_length(p_level) > 8
              or octet_length(p_ver) > 16 or pg_column_size(p_stats) > 1000, false) then
    return jsonb_build_object('error', 'invalid', 'field', 'size');
  end if;
  if not codeblack.allow('submit', 600) then return jsonb_build_object('error', 'busy'); end if;
  v_code := codeblack.norm_code(p_code); v_name := codeblack.clean_name(p_name); v_stats := codeblack.clean_stats(p_stats);
  v_bad := case when v_code is null then 'code' when p_cid is null then 'cid' when v_name is null then 'name'
    when coalesce(p_role not in ('rn', 'md'), true) then 'role' when coalesce(p_level not in ('easy', 'med', 'hard', 'rush'), true) then 'level'
    when coalesce(p_score not between 0 and 100, true) then 'score' when coalesce(p_stars not between 0 and 3, true) then 'stars'
    when coalesce(p_real_sec not between 0 and 86400, true) then 'time' when v_stats is null then 'stats'
    when coalesce(p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$', true) then 'ver' end;
  if v_bad is not null then return jsonb_build_object('error', 'invalid', 'field', v_bad); end if;
  perform pg_advisory_xact_lock(hashtext('codeblack:' || v_code));   -- one result at a time per class: the cap holds
  select c.code, c.ver into v_cls, v_cver from codeblack.classes c where c.code = v_code and c.expires_at > now();
  if v_cls is null then return jsonb_build_object('error', 'unknown'); end if;
  if v_cver <> p_ver then return jsonb_build_object('error', 'version'); end if;
  if exists (select 1 from codeblack.results r where r.code = v_code and r.cid = p_cid) then
    return jsonb_build_object('ok', true, 'dup', true);
  end if;
  if (select count(*) from (select 1 from codeblack.results r where r.code = v_code limit 500) x) >= 500 then
    return jsonb_build_object('error', 'full');
  end if;
  if (select c.reltuples from pg_catalog.pg_class c where c.oid = 'codeblack.results'::regclass) > 1000000 then
    return jsonb_build_object('error', 'busy');   -- a storage backstop, far above any real use
  end if;
  insert into codeblack.results (code, cid, name, role, level, score, stars, real_sec, stats, ver)
    values (v_code, p_cid, v_name, p_role, p_level, p_score, p_stars, p_real_sec, v_stats, p_ver);
  update codeblack.classes c set expires_at = c.created_at + interval '30 days'
    where c.code = v_code and c.expires_at < c.created_at + interval '30 days';
  return jsonb_build_object('ok', true);
end $$;

-- The instructor reads a class's results, best first. Returns {"expires", "rows": [...]} or {"error": "key" | "busy"}.
-- A wrong key and an unknown or expired code give the same answer. Each row's id is the result's own id.
create or replace function public.cb_class_read(p_code text, p_key text)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp
as $$
declare v_code text; v_exp timestamptz;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_key) > 64, false) then return jsonb_build_object('error', 'key'); end if;
  if not codeblack.allow('read', 300) then return jsonb_build_object('error', 'busy'); end if;
  v_code := codeblack.keyed_class(p_code, p_key);
  if v_code is null then return jsonb_build_object('error', 'key'); end if;
  select c.expires_at into v_exp from codeblack.classes c where c.code = v_code;
  return jsonb_build_object('expires', v_exp, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('id', r.cid, 'name', r.name, 'role', r.role, 'level', r.level, 'score', r.score,
             'stars', r.stars, 'real_sec', r.real_sec, 'stats', r.stats, 'ver', r.ver, 'created_at', r.created_at)
           order by r.score desc, r.created_at asc)
    from codeblack.results r where r.code = v_code), '[]'::jsonb));
end $$;

-- The instructor deletes one result (p_id, a result id from cb_class_read) or every result for the code (p_all).
-- With the right key it isn't rate limited; wrong keys are. Returns {"deleted": n} or {"error": "key" | "invalid" | "busy"}.
create or replace function public.cb_class_delete(p_code text, p_key text, p_id uuid default null, p_all boolean default false)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp
as $$
declare v_code text; v_n int;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_key) > 64, false) then return jsonb_build_object('error', 'key'); end if;
  v_code := codeblack.keyed_class(p_code, p_key);
  if v_code is null then
    if not codeblack.allow('badkey', 120) then return jsonb_build_object('error', 'busy'); end if;
    return jsonb_build_object('error', 'key');
  end if;
  if coalesce(p_all, false) then delete from codeblack.results r where r.code = v_code;
  elsif p_id is not null then delete from codeblack.results r where r.code = v_code and r.cid = p_id;
  else return jsonb_build_object('error', 'invalid');
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('deleted', v_n);
end $$;

-- For the deploy's check (test/db_live.js): which migration is live, how many classes are more than two hours past
-- their deletion time (should be 0), whether the clean-up job is scheduled, and whether this call's address could be
-- read (if not, every caller would share one rate-limit bucket). No class data, and not the address itself.
create or replace function public.cb_health()
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp
as $$
begin
  if not codeblack.allow('health', 120) then return jsonb_build_object('error', 'busy'); end if;
  return jsonb_build_object(
    'db', (select m.name from codeblack.migrations m order by m.name desc limit 1),
    'overdue', (select count(*) from codeblack.classes c where c.expires_at < now() - interval '2 hours'),
    'cron', exists (select 1 from cron.job j where j.jobname = 'codeblack-tidy' and j.active),
    'addr', codeblack.client_ip() is not null);
end $$;

do $$ declare f text; begin
  foreach f in array array['public.cb_class_new(text, text, text)', 'public.cb_submit(text, uuid, text, text, text, int, int, int, jsonb, text)',
                           'public.cb_class_read(text, text)', 'public.cb_class_delete(text, text, uuid, boolean)', 'public.cb_health()'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- ---------- the old way out ----------
drop function if exists public.cb_class(text);
drop table if exists public.cb_results;              -- with its insert policy and its two triggers
drop function if exists caseroom.cb_results_guard();  -- used only by those triggers
drop function if exists caseroom.cb_results_stamp();

-- ---------- the clean-up, hourly ----------
select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()');

insert into codeblack.migrations (name) values ('20261124120000_codeblack_private_results') on conflict (name) do nothing;

commit;
