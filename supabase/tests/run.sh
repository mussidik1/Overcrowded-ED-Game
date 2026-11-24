#!/usr/bin/env bash
# Builds a throwaway Postgres and checks the Code Black database on it. Nothing here touches the live project.
#   bash supabase/tests/run.sh          (npm run db:test)
# Needs PostgreSQL 15 or newer with pgcrypto (Ubuntu's postgresql package has both), and bash 3.2 or newer.
# Set PG_BIN to pick a PostgreSQL, KEEP=1 to keep the database folder afterwards.
#
# 0. Applied migrations are frozen: each one in migrations/applied.sha256 still has its recorded SHA-256, and every
#    migration not yet applied sorts after all the applied ones (so none is skipped on the live project).
# 1. The Supabase stand-ins (stubs.sql), then the live state before v0.31.0 (baseline/live_before_v0.31.0.sql).
# 2. With a row in the old results table, the first v0.31.0 migration must refuse and change nothing.
# 3. Every migration in order, then the latest one again (it must be safe to run twice); the latest recorded its name.
# 4. With a newer migration recorded, the latest must refuse (with its own message).
# 5. The baseline again: it must refuse to run on a migrated database, and change nothing.
# 6. A second, fresh database with the migrations alone (a new project).
# 7. privacy_test.sql: the rules, as the browser meets them, and the contract with the game (client_call.json).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$bin/initdb" ] || { echo "No PostgreSQL found (set PG_BIN)"; exit 1; }
work="$(mktemp -d)"; chmod 700 "$work"
cp "$here"/../migrations/*.sql "$here"/../baseline/live_before_v0.31.0.sql "$here"/stubs.sql "$here"/privacy_test.sql "$here"/client_call.json "$work"/
as=(env)
if [ "$(id -u)" = 0 ]; then as=(runuser -u postgres --); chown -R postgres "$work"; fi   # initdb refuses to run as root
# 0. The applied migrations are frozen (supabase/README.md, "Releasing"): a change to one would never reach the live project.
if command -v sha256sum >/dev/null; then sum=(sha256sum); else sum=(shasum -a 256); fi
(cd "$here/../migrations" && "${sum[@]}" -c applied.sha256 >/dev/null) || { echo "FAIL: an applied migration was edited. Put the change in a new migration (supabase/README.md)."; exit 1; }
applied=$(awk '{print $2}' "$here/../migrations/applied.sha256" | sort); newest_applied=$(echo "$applied" | tail -1)
for f in $(cd "$here/../migrations" && ls | grep -E '^[0-9]{14}_.*\.sql$' | sort); do
  if ! echo "$applied" | grep -qxF "$f" && [[ "$f" < "$newest_applied" ]]; then echo "FAIL: $f isn't applied but sorts before $newest_applied, which is: rename it to a later time"; exit 1; fi
done
echo "ok - the applied migrations are unchanged ($(echo "$applied" | wc -l | tr -d ' ') listed in applied.sha256)"
port="${PG_PORT:-54329}"
finish() {
  local status=$?
  "${as[@]}" "$bin/pg_ctl" -D "$work/db" stop -m immediate >/dev/null 2>&1 || true
  if [ "$status" != 0 ] || [ -n "${KEEP:-}" ]; then echo "Kept $work (server log: $work/log)"; tail -20 "$work/log" 2>/dev/null || true; else rm -rf "$work"; fi
}
trap finish EXIT
loc=C.UTF-8; locale -a 2>/dev/null | grep -qiE '^en_US\.utf-?8$' && loc=en_US.UTF-8   # the live project is en_US.UTF-8
"${as[@]}" "$bin/initdb" -D "$work/db" -U postgres -A trust --locale="$loc" -E UTF8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$work/db" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null
echo "$("$bin/postgres" --version | sed 's/^postgres //'), locale $loc"
q() { local db=$1; shift; (cd "$work" && PGOPTIONS="-c client_min_messages=warning" "${as[@]}" "$bin/psql" -X -q -o /dev/null -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d "$db" "$@"); }
migs=$(cd "$work" && ls | grep -E '^[0-9]{14}_.*\.sql$' | sort)
first=$(echo "$migs" | head -1); last=$(echo "$migs" | tail -1)

q postgres -f stubs.sql
echo "baseline (the live state before v0.31.0)"; q postgres -f live_before_v0.31.0.sql
q postgres -c "insert into public.cb_results (code, name, role, level, score, stars, real_sec) values ('KTA-80P', 'Old', 'rn', 'med', 1, 1, 1)"
if q postgres -f "$first" 2>/dev/null; then echo "FAIL: the migration ran over a results table with rows in it"; exit 1; fi
q postgres -c "do \$\$ begin if to_regnamespace('codeblack') is not null or (select count(*) from public.cb_results) <> 1 then raise exception 'FAIL: the refused migration changed something'; end if; end \$\$"
echo "ok - with a row in the old table, the migration refuses and changes nothing"
q postgres -c "delete from public.cb_results; insert into caseroom.cb_hits (ip) values ('192.0.2.1')"
for f in $migs; do echo "migration $f"; q postgres -f "$f"; done
echo "second run of $last (it must be safe to run twice)"; q postgres -f "$last"
q postgres -c "do \$\$ begin if (select max(name) from codeblack.migrations) is distinct from '${last%.sql}' then raise exception 'FAIL: the latest migration did not record its own name'; end if; end \$\$"
echo "ok - the latest migration recorded its own name (the deploy's check depends on it)"
q postgres -c "insert into codeblack.migrations (name) values ('29991231235959_codeblack_from_the_future')"
if q postgres -f "$last" 2>"$work/refused.txt"; then echo "FAIL: an older migration ran over a newer one"; exit 1; fi
grep -q 'A newer Code Black migration' "$work/refused.txt" || { echo "FAIL: the migration failed, but not with its newer-migration refusal:"; cat "$work/refused.txt"; exit 1; }
q postgres -c "delete from codeblack.migrations where name = '29991231235959_codeblack_from_the_future'"
echo "ok - a migration refuses to run over a newer one"
# Without ON_ERROR_STOP, as a client that keeps going after an error would run it: the transaction must stop everything.
(cd "$work" && "${as[@]}" "$bin/psql" -X -q -o /dev/null -h "$work" -p "$port" -U postgres -d postgres -f live_before_v0.31.0.sql) >/dev/null 2>&1 || true
q postgres -c "do \$\$ begin if to_regclass('public.cb_results') is not null or to_regprocedure('public.cb_class(text)') is not null then raise exception 'FAIL: the baseline changed a migrated database'; end if; end \$\$"
echo "ok - the baseline refuses to run on a migrated database, and changes nothing"
q postgres -c "create database fresh"
q fresh -f stubs.sql
for f in $migs; do q fresh -f "$f"; done
q fresh -c "do \$\$ begin if to_regprocedure('public.cb_class_new(text,text,text)') is null or to_regprocedure('public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)') is null or to_regprocedure('public.cb_class_read(text,text)') is null or to_regprocedure('public.cb_class_delete(text,text,uuid,boolean)') is null or to_regprocedure('public.cb_health(boolean)') is null or to_regnamespace('codeblack') is null then raise exception 'FAIL: fresh project'; end if; end \$\$"
echo "ok - the migrations alone build a fresh project"
(cd "$work" && "${as[@]}" "$bin/psql" -X -q -o /dev/null -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d postgres -v latest="${last%.sql}" -f privacy_test.sql) 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
echo "ALL DATABASE CHECKS PASSED"
