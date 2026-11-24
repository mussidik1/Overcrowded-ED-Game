-- Code Black Phase 2 (v0.31.0): private class results.
--
-- What changes (audit findings R3-01, R3-02, R3-03, R3-13, R3-15):
--   * Class results move to a private schema, codeblack, that the API does not expose and the public key has no
--     grant on. The browser reaches them only through four functions:
--       cb_class_new     an instructor registers a code and gets an instructor key back (shown once, kept on their device)
--       cb_submit        a student sends a result for a registered code (checked, rate limited, sent once)
--       cb_class_read    the instructor reads the results, with the key
--       cb_class_delete  the instructor deletes one result or all of them, with the key
--   * Reading by code alone is gone (the old cb_class(text)), so classmates and strangers can't read names.
--   * A code and its results are deleted 30 days after the code was made (an hourly job).
--   * Names: a first name or initials. Letters, spaces, periods, hyphens and apostrophes; at most 20 characters
--     and two words. No digits or @, so an email or phone number is refused.
--   * Network addresses are kept only as a keyed hash, for one day, to rate limit.
--
-- It stops without changing anything if public.cb_results has any rows (it has had none). Safe to run twice.
-- Leaves alone: the gate (cb_gate, cb_gate_on, cb_gate_check) and everything that belongs to Case Room.
-- caseroom.cb_hits stays because caseroom.tidy() cleans it; nothing writes to it after this.

begin;

do $$ declare n bigint := 0; begin
  if to_regclass('public.cb_results') is not null then   -- EXECUTE: on a second run the table is already gone
    execute 'select count(*) from public.cb_results' into n;
    if n > 0 then raise exception 'public.cb_results has % rows. Nobody could read them under the new rules: export or delete them first.', n; end if;
  end if;
end $$;

-- ---------- the private schema ----------
create schema if not exists codeblack;
revoke all on schema codeblack from public, anon, authenticated;

create table if not exists codeblack.salt (
  id int primary key check (id = 1),
  salt bytea not null check (octet_length(salt) = 32)
);
insert into codeblack.salt (id, salt) values (1, extensions.gen_random_bytes(32)) on conflict (id) do nothing;

create table if not exists codeblack.classes (
  code text primary key check (code ~ '^[0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  ver text not null check (ver ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create index if not exists classes_expires_idx on codeblack.classes (expires_at);

create table if not exists codeblack.results (
  id bigint generated always as identity primary key,
  code text not null references codeblack.classes (code) on delete cascade,
  cid uuid not null,
  name text not null check (char_length(name) between 1 and 20),
  role text not null check (role in ('rn', 'md')),
  level text not null check (level in ('easy', 'med', 'hard', 'rush')),
  score smallint not null check (score between 0 and 100),
  stars smallint not null check (stars between 0 and 3),
  real_sec integer not null check (real_sec between 0 and 86400),
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) < 600),
  ver text not null check (ver ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  created_at timestamptz not null default now(),
  constraint results_code_cid unique (code, cid)
);
create index if not exists results_created_idx on codeblack.results (created_at);

create table if not exists codeblack.hits (
  who text not null,
  kind text not null check (kind in ('class', 'submit', 'read', 'delete')),
  at timestamptz not null default now()
);
create index if not exists hits_who_idx on codeblack.hits (who, kind, at);

alter table codeblack.salt enable row level security;
alter table codeblack.classes enable row level security;
alter table codeblack.results enable row level security;
alter table codeblack.hits enable row level security;
revoke all on all tables in schema codeblack from public, anon, authenticated;
revoke all on all sequences in schema codeblack from public, anon, authenticated;

-- ---------- helpers (not callable from the API: the schema has no grants) ----------
-- The caller's network address, as Supabase passes it to the database. Copied from caseroom.client_ip() so Code
-- Black no longer depends on Case Room's schema. IPv6 addresses are cut to their /64.
create or replace function codeblack.client_ip()
 returns text language plpgsql stable set search_path to ''
as $$
declare h json; v text;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then h := null;
  end;
  v := coalesce(
    nullif(h ->> 'cf-connecting-ip', ''),
    nullif(h ->> 'x-real-ip', ''),
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''));
  if v like '%:%' then
    begin
      if not (v::inet <<= '::ffff:0.0.0.0/96'::inet) then
        v := network(set_masklen(v::inet, 64))::text;
      end if;
    exception when others then null;
    end;
  end if;
  return v;
end $$;

-- A keyed hash of the address: the rate limit can count requests without storing the address itself.
create or replace function codeblack.who()
 returns text language sql stable set search_path to ''
as $$
  select case when x.ip is null then null
    else encode(extensions.hmac(convert_to(x.ip, 'UTF8'), (select s.salt from codeblack.salt s where s.id = 1), 'sha256'), 'hex') end
  from (select codeblack.client_ip() as ip) x;
$$;

-- Counts this request and says whether the caller is still under p_limit requests of this kind in the last hour.
-- A call with no request headers (the SQL editor, the tests) is not limited.
create or replace function codeblack.allow(p_kind text, p_limit int)
 returns boolean language plpgsql volatile set search_path to ''
as $$
declare v_who text := codeblack.who(); v_n int;
begin
  if v_who is null then return true; end if;
  select count(*) into v_n from codeblack.hits h where h.who = v_who and h.kind = p_kind and h.at > now() - interval '1 hour';
  insert into codeblack.hits (who, kind) values (v_who, p_kind);
  return v_n < p_limit;
end $$;

-- 'abc-def', 'ABCDEF' and 'abc def' all become 'ABC-DEF'. O reads as 0, I and L as 1, as in the game.
create or replace function codeblack.norm_code(p text)
 returns text language sql immutable set search_path to ''
as $$
  select case when t ~ '^[0-9A-HJKMNP-TV-Z]{6}$' then substr(t, 1, 3) || '-' || substr(t, 4, 3) end
  from (select translate(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011') as t) x;
$$;

create or replace function codeblack.norm_key(p text)
 returns text language sql immutable set search_path to ''
as $$ select translate(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011'); $$;

create or replace function codeblack.key_hash(p_key text)
 returns text language sql immutable set search_path to ''
as $$ select encode(extensions.digest(convert_to(codeblack.norm_key(p_key), 'UTF8'), 'sha256'), 'hex'); $$;

-- 16 characters of Crockford base-32 from 10 random bytes: 80 bits.
create or replace function codeblack.new_key()
 returns text language plpgsql volatile set search_path to ''
as $$
declare b bytea := extensions.gen_random_bytes(10); a text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; o text := ''; v bigint;
begin
  for h in 0..1 loop
    v := 0;
    for i in 0..4 loop v := (v << 8) | get_byte(b, h * 5 + i); end loop;
    for i in reverse 7..0 loop o := o || substr(a, ((v >> (i * 5)) & 31)::int + 1, 1); end loop;
  end loop;
  return o;
end $$;

-- A result's stats: only these keys; counts are numbers from 0 to 100,000, scen is a scenario key.
create or replace function codeblack.stats_ok(p jsonb)
 returns boolean language sql immutable set search_path to ''
as $$
  select case when p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) >= 600 then false   -- CASE: jsonb_each must never see a non-object
    else not exists (
      select 1 from jsonb_each(p) e
      where e.key not in ('wait', 'lwbs', 'seen', 'ama', 'expired', 'bedFirst', 'scen')
         or not (case jsonb_typeof(e.value)
                   when 'null' then true
                   when 'number' then e.key <> 'scen' and (e.value #>> '{}')::numeric between 0 and 100000
                   when 'string' then e.key = 'scen' and (e.value #>> '{}') ~ '^[a-z]{1,16}$'
                   else false end)) end;
$$;

-- A first name or initials: letters, then letters, periods, hyphens and apostrophes; one space allowed.
create or replace function codeblack.clean_name(p text)
 returns text language sql immutable set search_path to ''
as $$
  select case when char_length(n) between 1 and 20 and n ~ '^[[:alpha:]][[:alpha:].''-]*( [[:alpha:].''-]+)?$' then n end
  from (select regexp_replace(btrim(replace(coalesce(p, ''), U&'\2019', '''')), '\s+', ' ', 'g') as n) x;
$$;

create or replace function codeblack.tidy()
 returns void language sql set search_path to ''
as $$
  delete from codeblack.classes where expires_at <= now();   -- and, through the foreign key, their results
  delete from codeblack.hits where at < now() - interval '1 day';
$$;

revoke all on all functions in schema codeblack from public, anon, authenticated;

-- ---------- the API ----------
-- An instructor registers a code. Returns {"key", "expires"} or {"error": "invalid" | "taken" | "busy"}.
create or replace function public.cb_class_new(p_code text, p_ver text)
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $$
declare v_code text := codeblack.norm_code(p_code); v_key text; v_exp timestamptz;
begin
  if not codeblack.allow('class', 20) then return jsonb_build_object('error', 'busy'); end if;
  if v_code is null or coalesce(p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$', true) then return jsonb_build_object('error', 'invalid'); end if;
  delete from codeblack.classes c where c.code = v_code and c.expires_at <= now();
  if (select count(*) from codeblack.classes) >= 50000 then return jsonb_build_object('error', 'busy'); end if;
  v_key := codeblack.new_key();
  insert into codeblack.classes (code, key_hash, ver) values (v_code, codeblack.key_hash(v_key), p_ver)
    on conflict (code) do nothing returning expires_at into v_exp;
  if v_exp is null then return jsonb_build_object('error', 'taken'); end if;
  return jsonb_build_object('key', v_key, 'expires', v_exp);
end $$;

-- A student sends a result. Returns {"ok": true} (with "dup": true if this result was already in) or
-- {"error": "invalid" | "unknown" | "full" | "busy"}. p_cid is the result's own id, made by the game: a result
-- sent twice is kept once.
create or replace function public.cb_submit(p_code text, p_cid uuid, p_name text, p_role text, p_level text,
                                            p_score int, p_stars int, p_real_sec int, p_stats jsonb, p_ver text)
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $$
declare v_code text := codeblack.norm_code(p_code); v_name text := codeblack.clean_name(p_name); v_id bigint;
begin
  if not codeblack.allow('submit', 200) then return jsonb_build_object('error', 'busy'); end if;
  if coalesce(v_code is null or p_cid is null or v_name is null
       or p_role not in ('rn', 'md') or p_level not in ('easy', 'med', 'hard', 'rush')
       or p_score not between 0 and 100 or p_stars not between 0 and 3 or p_real_sec not between 0 and 86400
       or p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' or not codeblack.stats_ok(p_stats), true) then
    return jsonb_build_object('error', 'invalid');
  end if;
  if not exists (select 1 from codeblack.classes c where c.code = v_code and c.expires_at > now()) then
    return jsonb_build_object('error', 'unknown');
  end if;
  if exists (select 1 from codeblack.results r where r.code = v_code and r.cid = p_cid) then
    return jsonb_build_object('ok', true, 'dup', true);
  end if;
  if (select count(*) from codeblack.results r where r.code = v_code) >= 300 then return jsonb_build_object('error', 'full'); end if;
  if (select count(*) from codeblack.results r where r.created_at > now() - interval '1 hour') >= 3000
     or (select count(*) from codeblack.results r where r.created_at > now() - interval '1 day') >= 10000
     or (select count(*) from codeblack.results) >= 100000 then
    return jsonb_build_object('error', 'busy');
  end if;
  insert into codeblack.results (code, cid, name, role, level, score, stars, real_sec, stats, ver)
    values (v_code, p_cid, v_name, p_role, p_level, p_score, p_stars, p_real_sec, p_stats, p_ver)
    on conflict (code, cid) do nothing returning id into v_id;
  if v_id is null then return jsonb_build_object('ok', true, 'dup', true); end if;
  return jsonb_build_object('ok', true);
end $$;

-- The instructor reads a class's results, best first. Returns {"expires", "rows": [...]} or {"error": "key" | "busy"}.
-- A wrong key and an unknown or expired code give the same answer.
create or replace function public.cb_class_read(p_code text, p_key text)
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $$
declare v_code text := codeblack.norm_code(p_code); v_exp timestamptz;
begin
  if not codeblack.allow('read', 120) then return jsonb_build_object('error', 'busy'); end if;
  select c.expires_at into v_exp from codeblack.classes c
    where c.code = v_code and c.expires_at > now() and c.key_hash = codeblack.key_hash(p_key);
  if v_exp is null then return jsonb_build_object('error', 'key'); end if;
  return jsonb_build_object('expires', v_exp, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name, 'role', r.role, 'level', r.level, 'score', r.score,
             'stars', r.stars, 'real_sec', r.real_sec, 'stats', r.stats, 'ver', r.ver, 'created_at', r.created_at)
           order by r.score desc, r.created_at asc)
    from codeblack.results r where r.code = v_code), '[]'::jsonb));
end $$;

-- The instructor deletes one result (p_id) or every result for the code (p_id null).
-- Returns {"deleted": n} or {"error": "key" | "busy"}.
create or replace function public.cb_class_delete(p_code text, p_key text, p_id bigint default null)
 returns jsonb language plpgsql volatile security definer set search_path to ''
as $$
declare v_code text := codeblack.norm_code(p_code); v_n int;
begin
  if not codeblack.allow('delete', 120) then return jsonb_build_object('error', 'busy'); end if;
  if not exists (select 1 from codeblack.classes c where c.code = v_code and c.expires_at > now() and c.key_hash = codeblack.key_hash(p_key)) then
    return jsonb_build_object('error', 'key');
  end if;
  delete from codeblack.results r where r.code = v_code and (p_id is null or r.id = p_id);
  get diagnostics v_n = row_count;
  return jsonb_build_object('deleted', v_n);
end $$;

revoke all on function public.cb_class_new(text, text) from public, anon, authenticated;
revoke all on function public.cb_submit(text, uuid, text, text, text, int, int, int, jsonb, text) from public, anon, authenticated;
revoke all on function public.cb_class_read(text, text) from public, anon, authenticated;
revoke all on function public.cb_class_delete(text, text, bigint) from public, anon, authenticated;
grant execute on function public.cb_class_new(text, text) to anon, authenticated;
grant execute on function public.cb_submit(text, uuid, text, text, text, int, int, int, jsonb, text) to anon, authenticated;
grant execute on function public.cb_class_read(text, text) to anon, authenticated;
grant execute on function public.cb_class_delete(text, text, bigint) to anon, authenticated;

-- ---------- the old way out ----------
drop function if exists public.cb_class(text);
drop table if exists public.cb_results;              -- with its insert policy and its two triggers
drop function if exists caseroom.cb_results_guard();  -- used only by those triggers
drop function if exists caseroom.cb_results_stamp();

-- ---------- 30 days ----------
select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()');

commit;
