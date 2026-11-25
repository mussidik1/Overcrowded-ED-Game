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
--   * A code and its results are deleted 30 days after the code was made, or 14 days after if nobody sends a
--     result (an hourly job, and every new code also clears expired ones).
--   * Names: a first name or initials. A letter, then letters (with their accents and vowel marks, in any script),
--     periods, hyphens and apostrophes; up to three words and 20 characters. No number of any kind (Unicode's Nd, Nl
--     and No), no @, no invisible fillers, no circled, squared or math letters. supabase/tests/client_call.json lists
--     the names both this and the game must accept and refuse.
--   * Rate limits: one counter per network, kind and hour. The network is a keyed hash of its address with a salt
--     that changes every day; counters and salts are deleted within two days.
--
-- It stops without changing anything if public.cb_results has any rows (it has had none), or if a newer Code Black
-- migration is already applied (running an older one over it would put old functions back). Safe to run twice.
-- Leaves alone: the gate (cb_gate, cb_gate_on, cb_gate_check) and everything that belongs to Case Room.
-- caseroom.cb_hits stays because caseroom.tidy() cleans it, but its rows go: only Code Black's old trigger wrote
-- them, and they are raw network addresses.
-- The order with the game: apply this first, then release v0.31.0. supabase/README.md has the steps.

begin;

do $$ declare n bigint := 0; begin
  if to_regclass('codeblack.migrations') is not null then
    execute 'select count(*) from codeblack.migrations where name > ''20261124120000_codeblack_private_results''' into n;
    if n > 0 then raise exception 'A newer Code Black migration is already applied: running this older one would undo it.'; end if;
  end if;
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
  expires_at timestamptz not null default now() + interval '14 days'   -- 30 days from creation once a result arrives
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
  kind text not null check (kind in ('class', 'submit', 'read', 'badkey', 'health', 'probe')),
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
  foreach k in array array['wait', 'lwbs', 'seen', 'ama', 'expired', 'bedFirst', 'fired', 'walkout', 'fast', 'dxRight', 'dxWrong', 'mdSeen', 'harm', 'radioRight', 'radioWrong', 'radioMiss'] loop
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

-- A first name or initials: a letter, then letters (with their marks, in any script), periods, hyphens and
-- apostrophes; up to three words; 20 characters at most. Refused: any number (Unicode Nd, Nl and No, generated from
-- Unicode 15.1), invisible fillers, circled and squared letters, and math letters. The marks and numbers lists are
-- Unicode's own categories (M*, and Nd/Nl/No), as the game's \p{M} and \p{N}.
create or replace function codeblack.clean_name(p text)
 returns text language sql immutable set search_path to pg_catalog, pg_temp
as $$
  select case when char_length(n) between 1 and 20
      and n ~ ('^[[:alpha:]][[:alpha:]' || m || '.''-]*( [[:alpha:]' || m || '.''-]+){0,2}$')
      and n !~ ('[' || d || '\u115F\u1160\u3164\uFFA0\u2460-\u24FF\U0001F100-\U0001F1FF\U0001D400-\U0001D7FF]')
    then n end
  from (select regexp_replace(btrim(replace(normalize(coalesce(p, ''), NFC), U&'\2019', '''')), '\s+', ' ', 'g') as n,
               '\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962-\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7-\u09C8\u09CB-\u09CD\u09D7\u09E2-\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47-\u0A48\u0A4B-\u0A4D\u0A51\u0A70-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2-\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47-\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62-\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55-\u0C56\u0C62-\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5-\u0CD6\u0CE2-\u0CE3\u0CF3\u0D00-\u0D03\u0D3B-\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62-\u0D63\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2-\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18-\u0F19\u0F35\u0F37\u0F39\u0F3E-\u0F3F\u0F71-\u0F84\u0F86-\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1715\u1732-\u1734\u1752-\u1753\u1772-\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u180F\u1885-\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099-\u309A\uA66F-\uA672\uA674-\uA67D\uA69E-\uA69F\uA6F0-\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880-\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C-\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7-\uAAB8\uAABE-\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5-\uAAF6\uABE3-\uABEA\uABEC-\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\U000101FD\U000102E0\U00010376-\U0001037A\U00010A01-\U00010A03\U00010A05-\U00010A06\U00010A0C-\U00010A0F\U00010A38-\U00010A3A\U00010A3F\U00010AE5-\U00010AE6\U00010D24-\U00010D27\U00010EAB-\U00010EAC\U00010EFD-\U00010EFF\U00010F46-\U00010F50\U00010F82-\U00010F85\U00011000-\U00011002\U00011038-\U00011046\U00011070\U00011073-\U00011074\U0001107F-\U00011082\U000110B0-\U000110BA\U000110C2\U00011100-\U00011102\U00011127-\U00011134\U00011145-\U00011146\U00011173\U00011180-\U00011182\U000111B3-\U000111C0\U000111C9-\U000111CC\U000111CE-\U000111CF\U0001122C-\U00011237\U0001123E\U00011241\U000112DF-\U000112EA\U00011300-\U00011303\U0001133B-\U0001133C\U0001133E-\U00011344\U00011347-\U00011348\U0001134B-\U0001134D\U00011357\U00011362-\U00011363\U00011366-\U0001136C\U00011370-\U00011374\U00011435-\U00011446\U0001145E\U000114B0-\U000114C3\U000115AF-\U000115B5\U000115B8-\U000115C0\U000115DC-\U000115DD\U00011630-\U00011640\U000116AB-\U000116B7\U0001171D-\U0001172B\U0001182C-\U0001183A\U00011930-\U00011935\U00011937-\U00011938\U0001193B-\U0001193E\U00011940\U00011942-\U00011943\U000119D1-\U000119D7\U000119DA-\U000119E0\U000119E4\U00011A01-\U00011A0A\U00011A33-\U00011A39\U00011A3B-\U00011A3E\U00011A47\U00011A51-\U00011A5B\U00011A8A-\U00011A99\U00011C2F-\U00011C36\U00011C38-\U00011C3F\U00011C92-\U00011CA7\U00011CA9-\U00011CB6\U00011D31-\U00011D36\U00011D3A\U00011D3C-\U00011D3D\U00011D3F-\U00011D45\U00011D47\U00011D8A-\U00011D8E\U00011D90-\U00011D91\U00011D93-\U00011D97\U00011EF3-\U00011EF6\U00011F00-\U00011F01\U00011F03\U00011F34-\U00011F3A\U00011F3E-\U00011F42\U00013440\U00013447-\U00013455\U00016AF0-\U00016AF4\U00016B30-\U00016B36\U00016F4F\U00016F51-\U00016F87\U00016F8F-\U00016F92\U00016FE4\U00016FF0-\U00016FF1\U0001BC9D-\U0001BC9E\U0001CF00-\U0001CF2D\U0001CF30-\U0001CF46\U0001D165-\U0001D169\U0001D16D-\U0001D172\U0001D17B-\U0001D182\U0001D185-\U0001D18B\U0001D1AA-\U0001D1AD\U0001D242-\U0001D244\U0001DA00-\U0001DA36\U0001DA3B-\U0001DA6C\U0001DA75\U0001DA84\U0001DA9B-\U0001DA9F\U0001DAA1-\U0001DAAF\U0001E000-\U0001E006\U0001E008-\U0001E018\U0001E01B-\U0001E021\U0001E023-\U0001E024\U0001E026-\U0001E02A\U0001E08F\U0001E130-\U0001E136\U0001E2AE\U0001E2EC-\U0001E2EF\U0001E4EC-\U0001E4EF\U0001E8D0-\U0001E8D6\U0001E944-\U0001E94A\U000E0100-\U000E01EF'::text as m,
               '\u0030-\u0039\u00B2-\u00B3\u00B9\u00BC-\u00BE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D58-\u0D5E\u0D66-\u0D78\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19\U00010107-\U00010133\U00010140-\U00010178\U0001018A-\U0001018B\U000102E1-\U000102FB\U00010320-\U00010323\U00010341\U0001034A\U000103D1-\U000103D5\U000104A0-\U000104A9\U00010858-\U0001085F\U00010879-\U0001087F\U000108A7-\U000108AF\U000108FB-\U000108FF\U00010916-\U0001091B\U000109BC-\U000109BD\U000109C0-\U000109CF\U000109D2-\U000109FF\U00010A40-\U00010A48\U00010A7D-\U00010A7E\U00010A9D-\U00010A9F\U00010AEB-\U00010AEF\U00010B58-\U00010B5F\U00010B78-\U00010B7F\U00010BA9-\U00010BAF\U00010CFA-\U00010CFF\U00010D30-\U00010D39\U00010E60-\U00010E7E\U00010F1D-\U00010F26\U00010F51-\U00010F54\U00010FC5-\U00010FCB\U00011052-\U0001106F\U000110F0-\U000110F9\U00011136-\U0001113F\U000111D0-\U000111D9\U000111E1-\U000111F4\U000112F0-\U000112F9\U00011450-\U00011459\U000114D0-\U000114D9\U00011650-\U00011659\U000116C0-\U000116C9\U00011730-\U0001173B\U000118E0-\U000118F2\U00011950-\U00011959\U00011C50-\U00011C6C\U00011D50-\U00011D59\U00011DA0-\U00011DA9\U00011F50-\U00011F59\U00011FC0-\U00011FD4\U00012400-\U0001246E\U00016A60-\U00016A69\U00016AC0-\U00016AC9\U00016B50-\U00016B59\U00016B5B-\U00016B61\U00016E80-\U00016E96\U0001D2C0-\U0001D2D3\U0001D2E0-\U0001D2F3\U0001D360-\U0001D378\U0001D7CE-\U0001D7FF\U0001E140-\U0001E149\U0001E2F0-\U0001E2F9\U0001E4F0-\U0001E4F9\U0001E8C7-\U0001E8CF\U0001E950-\U0001E959\U0001EC71-\U0001ECAB\U0001ECAD-\U0001ECAF\U0001ECB1-\U0001ECB4\U0001ED01-\U0001ED2D\U0001ED2F-\U0001ED3D\U0001F100-\U0001F10C\U0001FBF0-\U0001FBF9'::text as d) x;
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
  if (select c.reltuples from pg_catalog.pg_class c where c.oid = 'codeblack.classes'::regclass) > 100000 then
    return jsonb_build_object('error', 'full');   -- a storage backstop (about 15 MB), far above any real use and far below the free plan's 500 MB
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
-- {"error": "invalid", "field": ...} | {"error": "unknown" | "full" | "busy"}. A class from another game version answers
-- "unknown", like an unregistered or expired code, so the answers don't tell a stranger which codes are live.
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
  if v_cls is null or v_cver <> p_ver then return jsonb_build_object('error', 'unknown'); end if;
  if exists (select 1 from codeblack.results r where r.code = v_code and r.cid = p_cid) then
    return jsonb_build_object('ok', true, 'dup', true);
  end if;
  if (select count(*) from (select 1 from codeblack.results r where r.code = v_code limit 500) x) >= 500 then
    return jsonb_build_object('error', 'full');
  end if;
  if (select c.reltuples from pg_catalog.pg_class c where c.oid = 'codeblack.results'::regclass) > 300000 then
    return jsonb_build_object('error', 'full');   -- a storage backstop (about 150 MB), far above any real use and below the free plan's 500 MB
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
-- read and is a public one (if not, every caller would share one rate-limit bucket). No class data, and not the address.
-- p_probe counts in its own small bucket, for the check that forged address headers still hit the limit.
create or replace function public.cb_health(p_probe boolean default false)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp
as $$
declare v_ip text := codeblack.client_ip(); v_a inet;
begin
  if coalesce(p_probe, false) then
    if not codeblack.allow('probe', 30) then return jsonb_build_object('error', 'busy'); end if;
    return jsonb_build_object('ok', true);
  end if;
  if not codeblack.allow('health', 120) then return jsonb_build_object('error', 'busy'); end if;
  begin v_a := v_ip::pg_catalog.inet; exception when others then v_a := null; end;
  return jsonb_build_object(
    'db', (select m.name from codeblack.migrations m order by m.name desc limit 1),
    'overdue', (select count(*) from codeblack.classes c where c.expires_at < now() - interval '2 hours'),
    'cron', exists (select 1 from cron.job j where j.jobname = 'codeblack-tidy' and j.active),
    'addr', v_ip is not null,
    'public', v_a is not null and not (v_a <<= '10.0.0.0/8' or v_a <<= '172.16.0.0/12' or v_a <<= '192.168.0.0/16' or v_a <<= '100.64.0.0/10'
                                       or v_a <<= '127.0.0.0/8' or v_a <<= '169.254.0.0/16' or v_a <<= '::1/128' or v_a <<= 'fc00::/7' or v_a <<= 'fe80::/10'));
end $$;

do $$ declare f text; begin
  foreach f in array array['public.cb_class_new(text, text, text)', 'public.cb_submit(text, uuid, text, text, text, int, int, int, jsonb, text)',
                           'public.cb_class_read(text, text)', 'public.cb_class_delete(text, text, uuid, boolean)', 'public.cb_health(boolean)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- ---------- the old way out ----------
drop function if exists public.cb_class(text);
drop table if exists public.cb_results;              -- with its insert policy and its two triggers
drop function if exists caseroom.cb_results_guard();  -- used only by those triggers
drop function if exists caseroom.cb_results_stamp();
do $$ begin if to_regclass('caseroom.cb_hits') is not null then execute 'delete from caseroom.cb_hits'; end if; end $$;   -- raw addresses only Code Black's old trigger wrote

-- ---------- the clean-up, hourly ----------
select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()');

insert into codeblack.migrations (name) values ('20261124120000_codeblack_private_results') on conflict (name) do nothing;

commit;
