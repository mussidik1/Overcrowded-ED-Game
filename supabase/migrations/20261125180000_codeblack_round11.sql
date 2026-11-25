-- Code Black v0.31.0, round 11 of the review (the release review): fixes to 20261125120000_codeblack_round6.
--
-- What changes (audit findings R1.11-01, R2.11-01, R3.11-01, R1.11-02):
--   * Held codes are never released early. Past 30,000 held codes a new code is refused as "full", like the live-class backstop:
--     releasing held codes let a flood of throwaway codes free a real class's code for someone else to take. A code that already
--     exists still answers "taken" to another key and "ok" to its own.
--   * The fingerprint hashes each function's body exactly (but for carriage returns): a doubled space inside a string, which can change
--     the name rule, now shows.
--
-- It refuses to run unless 20261125120000_codeblack_round6 is applied, and refuses to run over a newer Code Black migration. Safe
-- to run twice. ASCII only, with no backslash-u escapes, so pasting or a tool can't change it.

begin;
set local lock_timeout = '10s';

do $$ declare n bigint := 0; begin
  if to_regclass('codeblack.migrations') is null then raise exception 'Apply 20261125120000_codeblack_round6 first.'; end if;
  execute 'select count(*) from codeblack.migrations where name = ''20261125120000_codeblack_round6''' into n;
  if n = 0 then raise exception 'Apply 20261125120000_codeblack_round6 first.'; end if;
  execute 'select count(*) from codeblack.migrations where name > ''20261125180000_codeblack_round11''' into n;
  if n > 0 then raise exception 'A newer Code Black migration is already applied: running this older one would undo it.'; end if;
end $$;

-- Returns {"ok": true, "expires", "created"} or {"error": "invalid" | "taken" | "busy" | "full"}.
create or replace function public.cb_class_new(p_code text, p_key text, p_ver text)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare v_code text; v_key text; v_exp timestamptz; v_made timestamptz; v_hash text;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_key) > 64 or octet_length(p_ver) > 16, false) then
    return jsonb_build_object('error', 'invalid');
  end if;
  -- checked before anything is counted, so junk calls can't spend a network's limits (audit R3.8-01)
  v_code := codeblack.norm_code(p_code); v_key := codeblack.norm_key(p_key);
  if v_code is null or v_key is null or coalesce(p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$', true) then
    return jsonb_build_object('error', 'invalid');
  end if;
  if not codeblack.allow('class', 60) then return jsonb_build_object('error', 'busy'); end if;
  if not codeblack.allow_day('class_day', 200) then return jsonb_build_object('error', 'busy'); end if;
  if not codeblack.allow48('class_day48', 1000, true) then return jsonb_build_object('error', 'busy'); end if;
  -- every new code also clears ended classes' results and codes held past their 30 days, so deletion doesn't rest on the job alone
  delete from codeblack.results r where r.code in (select x.code from codeblack.classes x where x.expires_at <= now() and exists (select 1 from codeblack.results y where y.code = x.code) limit 500);
  delete from codeblack.classes c where c.code in (select x.code from codeblack.classes x where x.expires_at <= now() - interval '30 days' limit 500);
  v_hash := codeblack.key_hash(v_key);
  -- a code another key holds is "taken" before the storage backstop is looked at, so "full" never hides it (audit R3.8-01)
  if exists (select 1 from codeblack.classes c where c.code = v_code and c.key_hash <> v_hash) then return jsonb_build_object('error', 'taken'); end if;
  -- A new code is refused as full past 100,000 live classes, or past 30,000 held codes: a held code is never released early, so a flood
  -- of throwaway codes can't free a real class's code for someone else to take (audit R1.11-01, R2.11-01, R3.11-01). A retry of this
  -- instructor's own code, or turning it back on, isn't refused.
  if not exists (select 1 from codeblack.classes c where c.code = v_code)
     and ((select count(*) from (select 1 from codeblack.classes c where c.expires_at > now() limit 100001) x) > 100000
          or (select count(*) from (select 1 from codeblack.classes c where c.expires_at <= now() limit 30001) x) > 30000) then
    return jsonb_build_object('error', 'full');   -- a storage backstop (about 15 MB of live classes), far above any real use and far below the free plan's 500 MB
  end if;
  insert into codeblack.classes (code, key_hash, ver) values (v_code, v_hash, p_ver)
    on conflict (code) do nothing returning expires_at, created_at into v_exp, v_made;
  if v_exp is null then   -- the code exists: with the same key it is this instructor's, otherwise it's taken (live, or held after it ended)
    perform pg_advisory_xact_lock(hashtext('codeblack:' || v_code));
    if exists (select 1 from codeblack.classes c where c.code = v_code and c.key_hash = v_hash and c.expires_at <= now()) then
      delete from codeblack.results r where r.code = v_code;   -- turned back on: a new, empty class
      update codeblack.classes c set created_at = now(), expires_at = now() + interval '14 days', ver = p_ver where c.code = v_code;
    end if;
    select c.expires_at, c.created_at into v_exp, v_made from codeblack.classes c where c.code = v_code and c.key_hash = v_hash;
    if v_exp is null then return jsonb_build_object('error', 'taken'); end if;
  end if;
  return jsonb_build_object('ok', true, 'expires', v_exp, 'created', v_made);
end $$;

create or replace function codeblack.fingerprint_parts()
 returns jsonb language sql stable set search_path to pg_catalog, pg_temp
as $$
  with acl(oid, kind, a) as (   -- the grants that matter: to the API roles and PUBLIC
    select q.oid, 'f', string_agg(q.g, ',' order by q.g collate "C") from (
      select p.oid, case a.grantee when 0 then 'public' else r.rolname end || '=' || a.privilege_type as g
      from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        left join pg_catalog.pg_roles r on r.oid = a.grantee
      where a.grantee = 0 or r.rolname in ('anon', 'authenticated')) q group by q.oid
  )
  select jsonb_object_agg(k, v) from (
    -- every codeblack function and every cb_ API function but the gate's: body (exactly, but for carriage returns: a space inside a
    -- string can matter, as in the name rule; audit R1.11-02), settings, rights,
    -- strictness, volatility, return type, argument names and defaults, and who may run it
    select 'f ' || p.oid::pg_catalog.regprocedure::text as k,
           md5(replace(p.prosrc, chr(13), '') || '|' || lower(regexp_replace(coalesce(array_to_string(p.proconfig, ','), ''), '\s+', '', 'g'))
               || '|' || p.prosecdef::text || p.proisstrict::text || p.provolatile::text || '|' || p.prorettype::pg_catalog.regtype::text
               || '|' || coalesce(array_to_string(p.proargnames, ','), '') || '|' || coalesce(regexp_replace(pg_catalog.pg_get_expr(p.proargdefaults, 0), '\s+', '', 'g'), '')
               || '|' || coalesce((select a from acl where acl.oid = p.oid), '')) as v
    from pg_catalog.pg_proc p
    where p.pronamespace = 'codeblack'::regnamespace
       or (p.pronamespace = 'public'::regnamespace and p.proname like 'cb\_%' and p.proname not like 'cb\_gate%')
    union all
    -- every codeblack table: columns, row-level security, check constraints, indexes, and grants to the API roles
    select 't ' || c.relname, md5(
      coalesce((select string_agg(a.attname || ':' || pg_catalog.format_type(a.atttypid, a.atttypmod) || ':' || a.attnotnull::text || ':'
                                  || coalesce(regexp_replace(pg_catalog.pg_get_expr(d.adbin, d.adrelid), '\s+', '', 'g'), ''), ',' order by a.attnum)
                from pg_catalog.pg_attribute a left join pg_catalog.pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
                where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped), '')
      || '|' || c.relrowsecurity::text
      || '|' || coalesce((select string_agg(x.d, ',' order by x.d collate "C") from (select regexp_replace(pg_catalog.pg_get_constraintdef(o.oid), '\s+', '', 'g') as d from pg_catalog.pg_constraint o where o.conrelid = c.oid and o.contype <> 'n') x), '')
      || '|' || coalesce((select string_agg(x.d, ',' order by x.d collate "C") from (select regexp_replace(pg_catalog.pg_get_indexdef(i.indexrelid), '\s+', '', 'g') as d from pg_catalog.pg_index i where i.indrelid = c.oid) x), '')
      || '|' || coalesce((select string_agg(x.g, ',' order by x.g collate "C") from (select case a.grantee when 0 then 'public' else r.rolname end || '=' || a.privilege_type as g
                          from pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) a left join pg_catalog.pg_roles r on r.oid = a.grantee
                          where a.grantee = 0 or r.rolname in ('anon', 'authenticated')) x), ''))
    from pg_catalog.pg_class c where c.relnamespace = 'codeblack'::regnamespace and c.relkind = 'r'
    union all
    -- the clean-up job's schedule and command
    select 'cron codeblack-tidy', md5(coalesce((select j.schedule || '|' || j.command from cron.job j where j.jobname = 'codeblack-tidy'), ''))
  ) y;
$$;
revoke all on function codeblack.fingerprint_parts() from public, anon, authenticated;

insert into codeblack.migrations (name) values ('20261125180000_codeblack_round11') on conflict (name) do nothing;

commit;
