-- Code Black v0.31.0, round 6 of the review: fixes to 20261124120000_codeblack_private_results.
--
-- What changes (audit findings R3.6-05, -07, -09, -10, -12, R5.6-08, R6.6-02, -04, -08, R1.6-04, -11):
--   * Rate limits and the daily salt use UTC, whatever time zone the caller asks for (PostgREST lets a request set its
--     session time zone; the hour and the day used to follow it, so one address got about five buckets).
--   * Daily limits per network on top of the hourly ones: 200 new codes and 3,000 sends a day. And for IPv6, limits per /48
--     (one site, or one free tunnel-broker allocation, which holds 256 of the /56 networks the other limits count by):
--     1,000 new codes and 10,000 sends a day, and 2,000 sends an hour.
--   * cb_health also lists every recorded migration (so a skipped one shows), and how full the two storage backstops
--     are (0 to 1); its "public" test reads the address before it is grouped, against the special-purpose ranges.
--   * Names: no invisible characters (Unicode's Default_Ignorable_Code_Point) except a zero-width non-joiner or joiner
--     between letters (Persian, Sinhala); no enclosing marks (S with U+20DD looks like a circled S); no full-width
--     forms; every word starts with a letter, not a mark; a middle dot (U+00B7, U+30FB) and the Hebrew geresh and
--     gershayim are allowed inside a word. The joiners are allowed only after a letter or mark of the scripts that use
--     them (U+0600 to U+0DFF: Arabic, Syriac, Thaana and the Indic scripts through Sinhala), and before a letter; a
--     joiner may also end a Malayalam word (a chillu typed as virama and joiner). The Tibetan tsheg (U+0F0B) separates
--     syllables inside a word. scen is no longer kept (the code names the scenario). tools/name_ranges.py makes the Unicode lists (here, Unicode 15.1).
--   * When a class ends, its results are deleted at once, and its code is held 30 more days with only its key's hash (no
--     student data): another key gets "taken", so nobody who knows the code (every student does, and a planned code may be
--     posted weeks ahead) can take it over and receive late results; the same key turns it back on, empty (audit R1.7-08,
--     R5.8-02). Held codes don't count toward the storage backstop (R3.8-02). A code another key holds answers "taken"
--     before "full", and invalid calls are refused before they count against a network's limits (R3.8-01). cb_class_new also returns when the
--     class was made. The clean-up job is scheduled again here, so re-running the newest migration restores it.
--   * cb_class_read returns results in the order they came in (the game shows them unranked), and when the class was
--     made. cb_submit's "full" says whether the class or all of class results is full.
--   * Stats: four more numbers from the attending's own work (deaths among their own patients, contraindicated drugs
--     ordered, unneeded risky treatments ordered, own patients left in an unrun cardiac arrest at the end), and the game
--     minute an early-ended shift stopped; "fast" is a
--     percentage (at most 100). The stats column may be up to 1,000 bytes (cleaned stats are well under it).
--   * The zero-argument public.cb_health() of an early draft, if a database has it, goes.
--
-- It refuses to run unless 20261124120000_codeblack_private_results is applied, and refuses to run over a newer
-- Code Black migration. Safe to run twice. Apply it before releasing the game that needs it (supabase/README.md).

begin;
set local lock_timeout = '10s';   -- a busy table makes it stop and say so, not hang the live API behind it

do $$ declare n bigint := 0; begin
  if to_regclass('codeblack.migrations') is null then raise exception 'Apply 20261124120000_codeblack_private_results first.'; end if;
  execute 'select count(*) from codeblack.migrations where name = ''20261124120000_codeblack_private_results''' into n;
  if n = 0 then raise exception 'Apply 20261124120000_codeblack_private_results first.'; end if;
  execute 'select count(*) from codeblack.migrations where name > ''20261125120000_codeblack_round6''' into n;
  if n > 0 then raise exception 'A newer Code Black migration is already applied: running this older one would undo it.'; end if;
end $$;

-- ---------- tables ----------
do $$ declare c text; begin   -- the rate kinds: the daily ones join
  for c in select conname from pg_catalog.pg_constraint where conrelid = 'codeblack.rate'::regclass and contype = 'c' loop
    execute format('alter table codeblack.rate drop constraint %I', c);
  end loop;
  for c in select conname from pg_catalog.pg_constraint where conrelid = 'codeblack.results'::regclass and contype = 'c'
           and pg_catalog.pg_get_constraintdef(oid) like '%pg_column_size(stats)%' loop
    execute format('alter table codeblack.results drop constraint %I', c);
  end loop;
end $$;
alter table codeblack.rate add constraint rate_kind_check
  check (kind in ('class', 'submit', 'read', 'badkey', 'health', 'probe', 'class_day', 'submit_day', 'class_day48', 'submit_day48', 'submit_hour48', 'health48'));
alter table codeblack.results add constraint results_stats_check check (jsonb_typeof(stats) = 'object' and pg_column_size(stats) < 1000);

-- ---------- helpers ----------
-- The caller's address as Supabase passes it (as before: cf-connecting-ip, then x-real-ip, then the first x-forwarded-for
-- entry), whole. client_ip() groups it for the rate limits; cb_health checks it whole.
create or replace function codeblack.client_addr()
 returns inet language plpgsql stable set search_path to pg_catalog, pg_temp
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
  return pg_catalog.set_masklen(a, case when pg_catalog.family(a) = 6 then 128 else 32 end);
end $$;

-- For the rate limits: IPv4 by address, IPv6 by its /56 (one home or one phone carrier's customer). Same as before.
create or replace function codeblack.client_ip()
 returns text language plpgsql stable set search_path to pg_catalog, pg_temp
as $$
declare a inet := codeblack.client_addr();
begin
  if a is null then return null; end if;
  if pg_catalog.family(a) = 6 then return pg_catalog.network(pg_catalog.set_masklen(a, 56))::text; end if;
  return pg_catalog.host(a);
end $$;

-- Whether an address is an ordinary public one: not private, loopback, link-local, shared (CGNAT), documentation,
-- benchmarking, multicast or reserved (IANA's special-purpose registries); for IPv6, only global unicast (2000::/3) outside them.
create or replace function codeblack.is_public(a inet)
 returns boolean language sql immutable set search_path to pg_catalog, pg_temp
as $$
  select a is not null and (pg_catalog.family(a) = 4 or a <<= '2000::/3'::pg_catalog.inet)   -- IPv6: global unicast only
    and not (a <<= any (array['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
    '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
    '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4', '2001::/23', '2001:db8::/32', '2002::/16', '3fff::/20', '5f00::/16']::pg_catalog.inet[]));
$$;

-- Who is asking: an HMAC of the address with today's salt (the UTC day).
create or replace function codeblack.who()
 returns text language plpgsql volatile set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare s bytea; d date := (now() at time zone 'UTC')::date;
begin
  if nullif(current_setting('request.headers', true), '') is null then return null; end if;
  select x.salt into s from codeblack.salt x where x.day = d;
  if s is null then
    insert into codeblack.salt (day, salt) values (d, extensions.gen_random_bytes(32)) on conflict (day) do nothing;
    select x.salt into s from codeblack.salt x where x.day = d;
  end if;
  return encode(extensions.hmac(convert_to(coalesce(codeblack.client_ip(), 'unknown'), 'UTF8'), s, 'sha256'), 'hex');
end $$;

-- Counts this request and says whether the caller is within p_limit of this kind in this UTC hour (allow) or UTC day
-- (allow_day). Once a network is over its limit, further refusals write nothing.
create or replace function codeblack.allow(p_kind text, p_limit int)
 returns boolean language plpgsql volatile set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare v_who text := codeblack.who(); v_n int;
begin
  if v_who is null then return true; end if;
  insert into codeblack.rate as r (who, kind, hour, n) values (v_who, p_kind, date_trunc('hour', now(), 'UTC'), 1)
    on conflict (who, kind, hour) do update set n = r.n + 1 where r.n <= p_limit
    returning r.n into v_n;
  return v_n is not null and v_n <= p_limit;
end $$;

create or replace function codeblack.allow_day(p_kind text, p_limit int)
 returns boolean language plpgsql volatile set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare v_who text := codeblack.who(); v_n int;
begin
  if v_who is null then return true; end if;
  insert into codeblack.rate as r (who, kind, hour, n) values (v_who, p_kind, date_trunc('day', now(), 'UTC'), 1)
    on conflict (who, kind, hour) do update set n = r.n + 1 where r.n <= p_limit
    returning r.n into v_n;
  return v_n is not null and v_n <= p_limit;
end $$;

-- The same, for an IPv6 caller's whole /48 (an IPv4 caller, or none, always passes): p_day picks the UTC day or hour.
create or replace function codeblack.allow48(p_kind text, p_limit int, p_day boolean)
 returns boolean language plpgsql volatile set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare a inet := codeblack.client_addr(); s bytea; v_who text; v_n int; d date := (now() at time zone 'UTC')::date;
begin
  if a is null or pg_catalog.family(a) <> 6 then return true; end if;
  perform codeblack.who();   -- makes today's salt if it isn't there yet
  select x.salt into s from codeblack.salt x where x.day = d;
  v_who := encode(extensions.hmac(convert_to('/48 ' || pg_catalog.network(pg_catalog.set_masklen(a, 48))::text, 'UTF8'), s, 'sha256'), 'hex');
  insert into codeblack.rate as r (who, kind, hour, n) values (v_who, p_kind, date_trunc(case when p_day then 'day' else 'hour' end, now(), 'UTC'), 1)
    on conflict (who, kind, hour) do update set n = r.n + 1 where r.n <= p_limit
    returning r.n into v_n;
  return v_n is not null and v_n <= p_limit;
end $$;

-- Stats, rebuilt from the known keys only (as before, with four more keys and no scen; fast is a percentage).
create or replace function codeblack.clean_stats(p jsonb)
 returns jsonb language plpgsql immutable set search_path to pg_catalog, pg_temp
as $$
declare o jsonb := '{}'::jsonb; k text; v jsonb; n numeric;
begin
  if p is null or jsonb_typeof(p) <> 'object' or pg_column_size(p) > 1000 then return null; end if;
  foreach k in array array['wait', 'lwbs', 'seen', 'ama', 'expired', 'bedFirst', 'fired', 'walkout', 'fast', 'dxRight', 'dxWrong',
                           'mdSeen', 'harm', 'radioRight', 'radioWrong', 'radioMiss', 'mdDied', 'contra', 'unneeded', 'endMin', 'mdArrestOpen', 'mdCodeLost'] loop
    v := p -> k;
    if v is not null and jsonb_typeof(v) = 'number' then
      n := v::numeric;   -- a jsonb number casts without printing it: 0e-16383 has scale 16383 and is dropped
      if scale(n) = 0 and n between 0 and (case when k = 'fast' then 100 else 999999 end) then o := o || jsonb_build_object(k, n::int); end if;
    end if;
  end loop;
  return o;
end $$;

-- A first name or initials: up to three words of a letter, then letters with their marks (in any script), periods,
-- hyphens, apostrophes and middle dots; 20 characters at most. A zero-width non-joiner or joiner may follow a letter or mark of
-- the scripts that use them (U+0600 to U+0DFF), before a letter.
-- Refused: any number (Nd, Nl, No), invisible characters (Default_Ignorable_Code_Point), enclosing marks (Me), full-width
-- forms, circled, squared and math letters. The lists are Unicode 15.1, from tools/name_ranges.py (--check compares them).
create or replace function codeblack.clean_name(p text)
 returns text language sql immutable set search_path to pg_catalog, pg_temp
as $$
  select case when char_length(n) between 1 and 20
      and s ~ ('^[[:alpha:]][[:alpha:]' || m || '.''\u00B7\u2027\u30FB\u05BE\u05F3\u05F4\u0F0B-]*( [[:alpha:]][[:alpha:]' || m || '.''\u00B7\u2027\u30FB\u05BE\u05F3\u05F4\u0F0B-]*){0,2}$')
      and s !~ ('(^| )[' || m || ']')
      and s !~ ('[' || d || me || di || '\uFF01-\uFF5E\u2460-\u24FF\U0001F100-\U0001F1FF\U0001D400-\U0001D7FF]')
    then n end
  from (select n, regexp_replace(regexp_replace(regexp_replace(n, '([\u0600-\u0DFF])[\u200C\u200D](?=[[:alpha:]])(?![' || m || '])', '\1', 'g'),
                                 '([\u0980-\u09FF])\u200D(?=\u09CD)', '\1', 'g'),
                                 '([\u0D00-\u0D7F])\u200D(?= |$)', '\1', 'g') as s, m, d, me, di
        from (select regexp_replace(btrim(replace(normalize(coalesce(p, ''), NFC), U&'\2019', '''')), '\s+', ' ', 'g') as n,
               '\u0300-\u036F\u0483-\u0489\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7-\u06E8\u06EA-\u06ED\u0711\u0730-\u074A\u07A6-\u07B0\u07EB-\u07F3\u07FD\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u0898-\u089F\u08CA-\u08E1\u08E3-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962-\u0963\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7-\u09C8\u09CB-\u09CD\u09D7\u09E2-\u09E3\u09FE\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47-\u0A48\u0A4B-\u0A4D\u0A51\u0A70-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2-\u0AE3\u0AFA-\u0AFF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47-\u0B48\u0B4B-\u0B4D\u0B55-\u0B57\u0B62-\u0B63\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0C00-\u0C04\u0C3C\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55-\u0C56\u0C62-\u0C63\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5-\u0CD6\u0CE2-\u0CE3\u0CF3\u0D00-\u0D03\u0D3B-\u0D3C\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62-\u0D63\u0D81-\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2-\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0EB1\u0EB4-\u0EBC\u0EC8-\u0ECE\u0F18-\u0F19\u0F35\u0F37\u0F39\u0F3E-\u0F3F\u0F71-\u0F84\u0F86-\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F\u109A-\u109D\u135D-\u135F\u1712-\u1715\u1732-\u1734\u1752-\u1753\u1772-\u1773\u17B4-\u17D3\u17DD\u180B-\u180D\u180F\u1885-\u1886\u18A9\u1920-\u192B\u1930-\u193B\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F\u1AB0-\u1ACE\u1B00-\u1B04\u1B34-\u1B44\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BE6-\u1BF3\u1C24-\u1C37\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF4\u1CF7-\u1CF9\u1DC0-\u1DFF\u20D0-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099-\u309A\uA66F-\uA672\uA674-\uA67D\uA69E-\uA69F\uA6F0-\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA82C\uA880-\uA881\uA8B4-\uA8C5\uA8E0-\uA8F1\uA8FF\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9E5\uAA29-\uAA36\uAA43\uAA4C-\uAA4D\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7-\uAAB8\uAABE-\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5-\uAAF6\uABE3-\uABEA\uABEC-\uABED\uFB1E\uFE00-\uFE0F\uFE20-\uFE2F\U000101FD\U000102E0\U00010376-\U0001037A\U00010A01-\U00010A03\U00010A05-\U00010A06\U00010A0C-\U00010A0F\U00010A38-\U00010A3A\U00010A3F\U00010AE5-\U00010AE6\U00010D24-\U00010D27\U00010EAB-\U00010EAC\U00010EFD-\U00010EFF\U00010F46-\U00010F50\U00010F82-\U00010F85\U00011000-\U00011002\U00011038-\U00011046\U00011070\U00011073-\U00011074\U0001107F-\U00011082\U000110B0-\U000110BA\U000110C2\U00011100-\U00011102\U00011127-\U00011134\U00011145-\U00011146\U00011173\U00011180-\U00011182\U000111B3-\U000111C0\U000111C9-\U000111CC\U000111CE-\U000111CF\U0001122C-\U00011237\U0001123E\U00011241\U000112DF-\U000112EA\U00011300-\U00011303\U0001133B-\U0001133C\U0001133E-\U00011344\U00011347-\U00011348\U0001134B-\U0001134D\U00011357\U00011362-\U00011363\U00011366-\U0001136C\U00011370-\U00011374\U00011435-\U00011446\U0001145E\U000114B0-\U000114C3\U000115AF-\U000115B5\U000115B8-\U000115C0\U000115DC-\U000115DD\U00011630-\U00011640\U000116AB-\U000116B7\U0001171D-\U0001172B\U0001182C-\U0001183A\U00011930-\U00011935\U00011937-\U00011938\U0001193B-\U0001193E\U00011940\U00011942-\U00011943\U000119D1-\U000119D7\U000119DA-\U000119E0\U000119E4\U00011A01-\U00011A0A\U00011A33-\U00011A39\U00011A3B-\U00011A3E\U00011A47\U00011A51-\U00011A5B\U00011A8A-\U00011A99\U00011C2F-\U00011C36\U00011C38-\U00011C3F\U00011C92-\U00011CA7\U00011CA9-\U00011CB6\U00011D31-\U00011D36\U00011D3A\U00011D3C-\U00011D3D\U00011D3F-\U00011D45\U00011D47\U00011D8A-\U00011D8E\U00011D90-\U00011D91\U00011D93-\U00011D97\U00011EF3-\U00011EF6\U00011F00-\U00011F01\U00011F03\U00011F34-\U00011F3A\U00011F3E-\U00011F42\U00013440\U00013447-\U00013455\U00016AF0-\U00016AF4\U00016B30-\U00016B36\U00016F4F\U00016F51-\U00016F87\U00016F8F-\U00016F92\U00016FE4\U00016FF0-\U00016FF1\U0001BC9D-\U0001BC9E\U0001CF00-\U0001CF2D\U0001CF30-\U0001CF46\U0001D165-\U0001D169\U0001D16D-\U0001D172\U0001D17B-\U0001D182\U0001D185-\U0001D18B\U0001D1AA-\U0001D1AD\U0001D242-\U0001D244\U0001DA00-\U0001DA36\U0001DA3B-\U0001DA6C\U0001DA75\U0001DA84\U0001DA9B-\U0001DA9F\U0001DAA1-\U0001DAAF\U0001E000-\U0001E006\U0001E008-\U0001E018\U0001E01B-\U0001E021\U0001E023-\U0001E024\U0001E026-\U0001E02A\U0001E08F\U0001E130-\U0001E136\U0001E2AE\U0001E2EC-\U0001E2EF\U0001E4EC-\U0001E4EF\U0001E8D0-\U0001E8D6\U0001E944-\U0001E94A\U000E0100-\U000E01EF'::text as m,
               '\u0030-\u0039\u00B2-\u00B3\u00B9\u00BC-\u00BE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D58-\u0D5E\u0D66-\u0D78\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19\U00010107-\U00010133\U00010140-\U00010178\U0001018A-\U0001018B\U000102E1-\U000102FB\U00010320-\U00010323\U00010341\U0001034A\U000103D1-\U000103D5\U000104A0-\U000104A9\U00010858-\U0001085F\U00010879-\U0001087F\U000108A7-\U000108AF\U000108FB-\U000108FF\U00010916-\U0001091B\U000109BC-\U000109BD\U000109C0-\U000109CF\U000109D2-\U000109FF\U00010A40-\U00010A48\U00010A7D-\U00010A7E\U00010A9D-\U00010A9F\U00010AEB-\U00010AEF\U00010B58-\U00010B5F\U00010B78-\U00010B7F\U00010BA9-\U00010BAF\U00010CFA-\U00010CFF\U00010D30-\U00010D39\U00010E60-\U00010E7E\U00010F1D-\U00010F26\U00010F51-\U00010F54\U00010FC5-\U00010FCB\U00011052-\U0001106F\U000110F0-\U000110F9\U00011136-\U0001113F\U000111D0-\U000111D9\U000111E1-\U000111F4\U000112F0-\U000112F9\U00011450-\U00011459\U000114D0-\U000114D9\U00011650-\U00011659\U000116C0-\U000116C9\U00011730-\U0001173B\U000118E0-\U000118F2\U00011950-\U00011959\U00011C50-\U00011C6C\U00011D50-\U00011D59\U00011DA0-\U00011DA9\U00011F50-\U00011F59\U00011FC0-\U00011FD4\U00012400-\U0001246E\U00016A60-\U00016A69\U00016AC0-\U00016AC9\U00016B50-\U00016B59\U00016B5B-\U00016B61\U00016E80-\U00016E96\U0001D2C0-\U0001D2D3\U0001D2E0-\U0001D2F3\U0001D360-\U0001D378\U0001D7CE-\U0001D7FF\U0001E140-\U0001E149\U0001E2F0-\U0001E2F9\U0001E4F0-\U0001E4F9\U0001E8C7-\U0001E8CF\U0001E950-\U0001E959\U0001EC71-\U0001ECAB\U0001ECAD-\U0001ECAF\U0001ECB1-\U0001ECB4\U0001ED01-\U0001ED2D\U0001ED2F-\U0001ED3D\U0001F100-\U0001F10C\U0001FBF0-\U0001FBF9'::text as d,
               '\u0488-\u0489\u1ABE\u20DD-\u20E0\u20E2-\u20E4\uA670-\uA672'::text as me,
               '\u00AD\u034F\u061C\u115F-\u1160\u17B4-\u17B5\u180B-\u180F\u200B-\u200F\u202A-\u202E\u2060-\u206F\u3164\uFE00-\uFE0F\uFEFF\uFFA0\uFFF0-\uFFF8\U0001BCA0-\U0001BCA3\U0001D173-\U0001D17A\U000E0000-\U000E0FFF'::text as di) x) y;
$$;

create or replace function codeblack.tidy()
 returns void language sql set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
  delete from codeblack.results r using codeblack.classes c where r.code = c.code and c.expires_at <= now();   -- an ended class's results go at once
  delete from codeblack.classes c where c.expires_at <= now() - interval '30 days';   -- the code is held 30 more days (its key's hash only, no student data)
  delete from codeblack.rate where hour < now() - interval '2 hours' and kind not in ('class_day', 'submit_day', 'class_day48', 'submit_day48');
  delete from codeblack.rate where hour < now() - interval '26 hours';
  delete from codeblack.salt where day < (now() at time zone 'UTC')::date - 1;
$$;

revoke all on all functions in schema codeblack from public, anon, authenticated;

-- ---------- the API ----------
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
  if (select count(*) from (select 1 from codeblack.classes x where x.expires_at <= now() limit 30001) y) > 30000 then   -- at most 30,000 held codes, oldest let go first (R3.9-01)
    delete from codeblack.classes c where c.code in (select x.code from codeblack.classes x where x.expires_at <= now() order by x.expires_at limit 1000);
  end if;
  v_hash := codeblack.key_hash(v_key);
  -- a code another key holds is "taken" before the storage backstop is looked at, so "full" never hides it (audit R3.8-01)
  if exists (select 1 from codeblack.classes c where c.code = v_code and c.key_hash <> v_hash) then return jsonb_build_object('error', 'taken'); end if;
  if not exists (select 1 from codeblack.classes c where c.code = v_code)   -- a retry of this instructor's own code isn't refused as full
     and (select count(*) from (select 1 from codeblack.classes c where c.expires_at > now() limit 100001) x) > 100000 then   -- live classes only, not held codes (R1.8-04)
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

-- Returns {"ok": true} (with "dup": true if this result was already in), or {"error": "invalid", "field": ...} |
-- {"error": "unknown"} | {"error": "full", "scope": "class" | "all"} | {"error": "busy"}.
create or replace function public.cb_submit(p_code text, p_cid uuid, p_name text, p_role text, p_level text,
                                            p_score int, p_stars int, p_real_sec int, p_stats jsonb, p_ver text)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare v_code text; v_name text; v_stats jsonb; v_cls text; v_cver text; v_bad text;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_name) > 200 or octet_length(p_role) > 8 or octet_length(p_level) > 8
              or octet_length(p_ver) > 16 or pg_column_size(p_stats) > 1000, false) then
    return jsonb_build_object('error', 'invalid', 'field', 'size');
  end if;
  v_code := codeblack.norm_code(p_code); v_name := codeblack.clean_name(p_name); v_stats := codeblack.clean_stats(p_stats);
  v_bad := case when v_code is null then 'code' when p_cid is null then 'cid' when v_name is null then 'name'
    when coalesce(p_role not in ('rn', 'md'), true) then 'role' when coalesce(p_level not in ('easy', 'med', 'hard', 'rush'), true) then 'level'
    when coalesce(p_score not between 0 and 100, true) then 'score' when coalesce(p_stars not between 0 and 3, true) then 'stars'
    when coalesce(p_real_sec not between 0 and 86400, true) then 'time' when v_stats is null then 'stats'
    when coalesce(p_ver !~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$', true) then 'ver' end;
  if v_bad is not null then return jsonb_build_object('error', 'invalid', 'field', v_bad); end if;
  -- counted only once the call is valid, so junk sends can't spend a campus's limits (audit R5.9-05)
  if not codeblack.allow('submit', 600) then return jsonb_build_object('error', 'busy'); end if;
  if not codeblack.allow_day('submit_day', 3000) then return jsonb_build_object('error', 'busy'); end if;
  if not codeblack.allow48('submit_hour48', 2000, false) then return jsonb_build_object('error', 'busy'); end if;
  if not codeblack.allow48('submit_day48', 10000, true) then return jsonb_build_object('error', 'busy'); end if;
  perform pg_advisory_xact_lock(hashtext('codeblack:' || v_code));   -- one result at a time per class: the cap holds
  select c.code, c.ver into v_cls, v_cver from codeblack.classes c where c.code = v_code and c.expires_at > now();
  if v_cls is null then   -- a code made ahead that nobody sent to ended at 14 days, but is held for its key: its first result turns it back on (R5.9-01)
    update codeblack.classes c set created_at = now(), expires_at = now() + interval '30 days'
      where c.code = v_code and c.ver = p_ver and c.expires_at <= now() and c.expires_at > now() - interval '30 days' and c.expires_at < c.created_at + interval '30 days'
      returning c.code, c.ver into v_cls, v_cver;
  end if;
  if v_cls is null or v_cver <> p_ver then return jsonb_build_object('error', 'unknown'); end if;
  if exists (select 1 from codeblack.results r where r.code = v_code and r.cid = p_cid) then
    return jsonb_build_object('ok', true, 'dup', true);
  end if;
  if (select count(*) from (select 1 from codeblack.results r where r.code = v_code limit 500) x) >= 500 then
    return jsonb_build_object('error', 'full', 'scope', 'class');
  end if;
  if (select c.reltuples from pg_catalog.pg_class c where c.oid = 'codeblack.results'::regclass) > 300000 then
    return jsonb_build_object('error', 'full', 'scope', 'all');   -- a storage backstop (about 150 MB, up to about 250 with the most stats), far above any real use and below the free plan's 500 MB
  end if;
  insert into codeblack.results (code, cid, name, role, level, score, stars, real_sec, stats, ver)
    values (v_code, p_cid, v_name, p_role, p_level, p_score, p_stars, p_real_sec, v_stats, p_ver);
  update codeblack.classes c set expires_at = c.created_at + interval '30 days'
    where c.code = v_code and c.expires_at < c.created_at + interval '30 days';
  return jsonb_build_object('ok', true);
end $$;

-- The instructor reads a class's results, in the order they came in. Returns {"expires", "created", "rows": [...]} or
-- {"error": "key" | "busy"}. A wrong key and an unknown or expired code give the same answer.
create or replace function public.cb_class_read(p_code text, p_key text)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare v_code text; v_exp timestamptz; v_made timestamptz;
begin
  if coalesce(octet_length(p_code) > 32 or octet_length(p_key) > 64, false) then return jsonb_build_object('error', 'key'); end if;
  if not codeblack.allow('read', 300) then return jsonb_build_object('error', 'busy'); end if;
  v_code := codeblack.keyed_class(p_code, p_key);
  if v_code is null then return jsonb_build_object('error', 'key'); end if;
  select c.expires_at, c.created_at into v_exp, v_made from codeblack.classes c where c.code = v_code;
  return jsonb_build_object('expires', v_exp, 'created', v_made, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('id', r.cid, 'name', r.name, 'role', r.role, 'level', r.level, 'score', r.score,
             'stars', r.stars, 'real_sec', r.real_sec, 'stats', r.stats, 'ver', r.ver, 'created_at', r.created_at)
           order by r.created_at asc, r.cid)
    from codeblack.results r where r.code = v_code), '[]'::jsonb));
end $$;

-- Unchanged but for the UTC time zone.
create or replace function public.cb_class_delete(p_code text, p_key text, p_id uuid default null, p_all boolean default false)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp set timezone to 'UTC'
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

-- What the live database is, not what its migrations are called (audit R1.8-01, R1.9-02): an md5 of each Code Black function
-- (body with its whitespace runs read as one space, settings, rights, strictness, volatility, return type, arguments and defaults, grants), each
-- codeblack table (columns, defaults, row-level security, constraints, indexes, grants) and the clean-up job. run.sh compares
-- them with supabase/tests/fingerprint.json, made from the repo's migrations, and test/db_live.js compares the live project's
-- total with the same file: a stale or edited draft, or a hand edit to anything here, can't pass. Every list is sorted in the
-- C collation, so the live project's locale can't change the result (audit R2.9-05e).
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
    -- every codeblack function and every cb_ API function but the gate's: body (each run of whitespace read as one space, so a
    -- re-indented paste passes but a changed string doesn't; audit R3.9-03), settings, rights,
    -- strictness, volatility, return type, argument names and defaults, and who may run it
    select 'f ' || p.oid::pg_catalog.regprocedure::text as k,
           md5(btrim(regexp_replace(p.prosrc, '\s+', ' ', 'g')) || '|' || lower(regexp_replace(coalesce(array_to_string(p.proconfig, ','), ''), '\s+', '', 'g'))
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
      || '|' || coalesce((select string_agg(x.d, ',' order by x.d collate "C") from (select regexp_replace(pg_catalog.pg_get_constraintdef(o.oid), '\s+', '', 'g') as d from pg_catalog.pg_constraint o where o.conrelid = c.oid) x), '')
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

-- One md5 over all of it, for the deploy. In the SQL editor, select codeblack.fingerprint_parts(); and compare with
-- supabase/tests/fingerprint.json to see which object differs.
create or replace function codeblack.fingerprint()
 returns text language sql stable set search_path to pg_catalog, pg_temp
as $$ select md5((select string_agg(e.key || '=' || (e.value #>> '{}'), '|' order by e.key collate "C") from jsonb_each(codeblack.fingerprint_parts()) e)); $$;
revoke all on function codeblack.fingerprint() from public, anon, authenticated;

-- For the deploy's check (test/db_live.js): the live migration and every recorded one, how many classes are more than
-- two hours past a deletion that should have happened (results of an ended class, or a code held past its 30 days; should be 0), whether the clean-up job is scheduled, whether this call's address
-- was read and is a public one, how full the two storage backstops are (0 to 1; live classes only), and the functions'
-- fingerprint. No class data, and not the address.
create or replace function public.cb_health(p_probe boolean default false)
 returns jsonb language plpgsql volatile security definer set search_path to pg_catalog, pg_temp set timezone to 'UTC'
as $$
declare v_a inet := codeblack.client_addr();
begin
  if coalesce(p_probe, false) then
    if not codeblack.allow('probe', 30) then return jsonb_build_object('error', 'busy'); end if;
    return jsonb_build_object('ok', true);
  end if;
  if not codeblack.allow('health', 120) then return jsonb_build_object('error', 'busy'); end if;
  if not codeblack.allow48('health48', 1000, false) then return jsonb_build_object('error', 'busy'); end if;   -- and per IPv6 /48 (R3.8-02)
  return jsonb_build_object(
    'db', (select m.name from codeblack.migrations m order by m.name desc limit 1),
    'migs', (select jsonb_agg(m.name order by m.name) from codeblack.migrations m),
    'fp', codeblack.fingerprint(),
    'overdue', (select count(*) from codeblack.classes c where c.expires_at < now() - interval '30 days 2 hours')   -- indexed counts over held codes only, not one scan (R1.8-04, R3.8-02)
               + (select count(*) from codeblack.classes c where c.expires_at < now() - interval '2 hours' and c.expires_at >= now() - interval '30 days 2 hours'
                    and c.expires_at >= c.created_at + interval '30 days' and exists (select 1 from codeblack.results r where r.code = c.code)),   -- only a class that got results can have any
    'cron', exists (select 1 from cron.job j where j.jobname = 'codeblack-tidy' and j.active),
    'addr', v_a is not null,
    'public', codeblack.is_public(v_a),
    'classes', round((select count(*) from (select 1 from codeblack.classes c where c.expires_at > now() limit 100001) x)::numeric / 100000, 1),
    'results', round(greatest((select c.reltuples from pg_catalog.pg_class c where c.oid = 'codeblack.results'::regclass), 0)::numeric / 300000, 1),
    'held', round((select count(*) from (select 1 from codeblack.classes c where c.expires_at <= now() limit 30001) x)::numeric / 30000, 1));   -- to a tenth: enough for the deploy, not a usage count
end $$;

drop function if exists public.cb_health();   -- an early draft's zero-argument version, if a database has it

do $$ declare f text; begin
  foreach f in array array['public.cb_class_new(text, text, text)', 'public.cb_submit(text, uuid, text, text, text, int, int, int, jsonb, text)',
                           'public.cb_class_read(text, text)', 'public.cb_class_delete(text, text, uuid, boolean)', 'public.cb_health(boolean)'] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;

-- the clean-up job again (the same name replaces it): re-running the newest migration restores a job someone deleted
select cron.schedule('codeblack-tidy', '41 * * * *', 'select codeblack.tidy()');
select cron.alter_job(j.jobid, active := true) from cron.job j where j.jobname = 'codeblack-tidy' and not j.active;   -- and on, if someone paused it

insert into codeblack.migrations (name) values ('20261125120000_codeblack_round6') on conflict (name) do nothing;

commit;
