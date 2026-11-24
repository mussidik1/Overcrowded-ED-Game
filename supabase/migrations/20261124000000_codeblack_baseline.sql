-- Code Black: the live database as it stood on Nov 24, 2026, before Phase 2 (v0.31.0).
--
-- A record, not something to run on the live project: it is already there. It was read from the live project
-- (pg_get_functiondef, information_schema, pg_policies) and from the two Code Black migrations stored in it
-- (codeblack_class_results, codeblack_private_gate). Other changes reached it through migrations shared with
-- Case Room ("security_fixes", "review_fixes", "hostile_review_fixes") and the Nov 24 version-column migration.
-- It is written so it also builds a fresh database, which is how supabase/tests/run.sh uses it.
--
-- The project is shared with Case Room (schemas caseroom and golden_hour, functions cr_* and gh_*). Only the
-- Code Black objects are here, plus the two Case Room helpers the results table used: caseroom.client_ip()
-- and caseroom.cb_hits.
--
-- The gate password's bcrypt hash is NOT in this repo. Set or change the password in the SQL editor with:
--   update public.cb_gate set pass_hash = extensions.crypt('<the password>', extensions.gen_salt('bf')), updated_at = now() where id = 1;

-- ---------- Case Room helpers the results table used ----------
create schema if not exists caseroom;

create table if not exists caseroom.cb_hits (ip text, at timestamptz default now());
create index if not exists cb_hits_ip_at_idx on caseroom.cb_hits (ip, at);
alter table caseroom.cb_hits enable row level security;

create or replace function caseroom.client_ip()
 returns text
 language plpgsql
 stable
 set search_path to ''
as $function$
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
      if not (v::inet <<= '::ffff:0.0.0.0/96'::inet) then -- an IPv4 address written as IPv6 stays whole
        v := network(set_masklen(v::inet, 64))::text;
      end if;
    exception when others then null;
    end;
  end if;
  return v;
end $function$;

-- ---------- class results ----------
create table if not exists public.cb_results (
  id bigint generated always as identity primary key,
  code text not null check (code ~ '^[0-9A-HJKMNP-TV-Z]{3}-[0-9A-HJKMNP-TV-Z]{3}$'),
  name text not null check (char_length(btrim(name)) between 1 and 30),
  role text not null check (role in ('rn', 'md')),
  level text not null check (level in ('easy', 'med', 'hard', 'rush')),
  score integer not null check (score between -50000 and 50000),
  stars smallint not null check (stars between 0 and 3),
  real_sec integer not null check (real_sec between 0 and 86400),
  stats jsonb not null default '{}'::jsonb check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) < 1500),
  created_at timestamptz not null default now(),
  ver text check (ver is null or ver ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'),
  constraint cb_results_stats_nums check (
    (not (stats ? 'wait') or jsonb_typeof(stats->'wait') in ('number', 'null')) and
    (not (stats ? 'lwbs') or jsonb_typeof(stats->'lwbs') in ('number', 'null')))
);
create index if not exists cb_results_code_idx on public.cb_results (code, created_at desc);
create index if not exists cb_results_created_idx on public.cb_results (created_at);

alter table public.cb_results enable row level security;
drop policy if exists "cb results: anyone may add" on public.cb_results;
create policy "cb results: anyone may add" on public.cb_results for insert to anon, authenticated with check (true);
-- Insert only, column by column. No select, update or delete for anon.
-- Not ver: the Nov 24 migration added the column without an insert grant, so from then until Phase 2 the
-- v0.30.0 client's Send was refused (permission denied is a 401, and the client retried only on a 400).
revoke all on public.cb_results from anon, authenticated;
grant insert (code, name, role, level, score, stars, real_sec, stats) on public.cb_results to anon, authenticated;

-- One statement adds at most 3 rows; at most 3,000 rows an hour, 10,000 a day and 100,000 in all.
create or replace function caseroom.cb_results_guard()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
      declare
        v_new int;
        v_hour int;
        v_day int;
      begin
        select count(*) into v_new from new_rows;
        if v_new > 3 then
          raise exception 'Send one result at a time.' using errcode = 'check_violation';
        end if;
        select count(*) filter (where r.created_at > now() - interval '1 hour'), count(*)
          into v_hour, v_day
        from public.cb_results r where r.created_at > now() - interval '1 day';
        if v_hour > 3000 or v_day > 10000
           or (select c.reltuples from pg_catalog.pg_class c where c.oid = 'public.cb_results'::regclass) > 100000 then
          raise exception 'Too many results right now. Try again later.' using errcode = 'check_violation';
        end if;
        return null;
      end $function$;

-- The server sets created_at; at most 200 results an hour from one network.
create or replace function caseroom.cb_results_stamp()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
      declare
        v_ip text := caseroom.client_ip();
        v_n int;
      begin
        new.created_at := now();
        if v_ip is not null then
          insert into caseroom.cb_hits (ip) values (v_ip);
          select count(*) into v_n from caseroom.cb_hits h where h.ip = v_ip and h.at > now() - interval '1 hour';
          if v_n > 200 then
            raise exception 'Too many results from this network right now. Try again later.' using errcode = 'check_violation';
          end if;
        end if;
        return new;
      end $function$;

drop trigger if exists cb_results_guard on public.cb_results;
create trigger cb_results_guard after insert on public.cb_results referencing new table as new_rows
  for each statement execute function caseroom.cb_results_guard();
drop trigger if exists cb_results_stamp on public.cb_results;
create trigger cb_results_stamp before insert on public.cb_results for each row execute function caseroom.cb_results_stamp();

-- Reading by class code alone: anyone holding the code reads every row for it (the problem Phase 2 fixes).
drop function if exists public.cb_class(text);
create function public.cb_class(p_code text)
 returns table(name text, role text, level text, score integer, stars smallint, real_sec integer, stats jsonb, created_at timestamptz, ver text)
 language sql stable security definer set search_path to 'public'
as $$
  select r.name, r.role, r.level, r.score, r.stars, r.real_sec, r.stats, r.created_at, r.ver
  from public.cb_results r where r.code = upper(btrim(p_code))
  order by r.score desc, r.created_at asc limit 300;
$$;
revoke all on function public.cb_class(text) from public;
grant execute on function public.cb_class(text) to anon, authenticated;

-- ---------- the private-testing gate (deleted at launch) ----------
-- Row-level security is on with no policies, so the table grants Supabase gives anon by default reach no rows.
create table if not exists public.cb_gate (
  id int primary key check (id = 1),
  gate_on boolean not null default true,
  pass_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.cb_gate enable row level security;

create or replace function public.cb_gate_on() returns boolean
 language sql stable security definer set search_path to 'public'
as $function$ select coalesce((select gate_on from public.cb_gate where id = 1), false); $function$;

create or replace function public.cb_gate_check(p text) returns boolean
 language sql stable security definer set search_path to 'public', 'extensions'
as $function$
  select coalesce((select (not gate_on) or (char_length(p) between 1 and 200 and extensions.crypt(p, pass_hash) = pass_hash) from public.cb_gate where id = 1), true); $function$;

revoke all on function public.cb_gate_on() from public;
revoke all on function public.cb_gate_check(text) from public;
grant execute on function public.cb_gate_on() to anon, authenticated;
grant execute on function public.cb_gate_check(text) to anon, authenticated;

-- Launch: update public.cb_gate set gate_on = false where id = 1;
