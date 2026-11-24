-- What a Supabase project has before any migration, as far as the Code Black SQL needs it.
-- Used only by supabase/tests/run.sh on a throwaway local Postgres.
do $$ declare r text; begin   -- roles belong to the whole cluster: a second database finds them already there
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then execute format('create role %I nologin', r); end if;
  end loop;
end $$;
create schema extensions;
create extension pgcrypto schema extensions;
-- pg_cron is not installed locally: a stand-in that records the job.
create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean not null default true);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid;
$$;
-- Supabase lets the API roles use the public schema, and grants them everything new in it by default
-- (row-level security is what holds tables back). The migrations must cope with that.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
