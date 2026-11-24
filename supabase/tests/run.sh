#!/usr/bin/env bash
# Builds a throwaway Postgres and checks the Code Black database on it. Nothing here touches the live project.
#   bash supabase/tests/run.sh          (npm run db:test)
# Needs PostgreSQL 15 or newer with pgcrypto (Ubuntu's postgresql package has both), and bash 4.4 or newer.
# Set PG_BIN to pick a PostgreSQL, KEEP=1 to keep the database folder afterwards.
#
# 1. The Supabase stand-ins (stubs.sql), then the live state before v0.31.0 (baseline/live_before_v0.31.0.sql).
# 2. With a row in the old results table, the v0.31.0 migration must refuse and change nothing.
# 3. Every migration in order, then the latest one again (it must be safe to run twice).
# 4. The baseline again: it must refuse to run on a migrated database.
# 5. A second, fresh database with the migrations alone (a new project).
# 6. privacy_test.sql: the rules, as the browser meets them, and the contract with the game (client_call.json).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$bin/initdb" ] || { echo "No PostgreSQL found (set PG_BIN)"; exit 1; }
work="$(mktemp -d)"; chmod 755 "$work"
cp "$here"/../migrations/*.sql "$here"/../baseline/live_before_v0.31.0.sql "$here"/stubs.sql "$here"/privacy_test.sql "$here"/client_call.json "$work"/
as=(env)
if [ "$(id -u)" = 0 ]; then as=(runuser -u postgres --); chown -R postgres "$work"; fi   # initdb refuses to run as root
port="${PG_PORT:-54329}"
finish() {
  local status=$?
  "${as[@]}" "$bin/pg_ctl" -D "$work/db" stop -m immediate >/dev/null 2>&1 || true
  if [ "$status" != 0 ] || [ -n "${KEEP:-}" ]; then echo "Kept $work (server log: $work/log)"; tail -20 "$work/log" 2>/dev/null || true; else rm -rf "$work"; fi
}
trap finish EXIT
loc=C.UTF-8; locale -a 2>/dev/null | grep -qi '^en_US.utf-\?8$' && loc=en_US.UTF-8   # the live project is en_US.UTF-8
"${as[@]}" "$bin/initdb" -D "$work/db" -U postgres -A trust --locale="$loc" -E UTF8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$work/db" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null
echo "$("$bin/postgres" --version | sed 's/^postgres //'), locale $loc"
q() { local db=$1; shift; (cd "$work" && PGOPTIONS="-c client_min_messages=warning" "${as[@]}" "$bin/psql" -X -q -o /dev/null -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d "$db" "$@"); }
migs=$(cd "$work" && ls 2*.sql | sort)
last=$(echo "$migs" | tail -1)

q postgres -f stubs.sql
echo "baseline (the live state before v0.31.0)"; q postgres -f live_before_v0.31.0.sql
q postgres -c "insert into public.cb_results (code, name, role, level, score, stars, real_sec) values ('KTA-80P', 'Old', 'rn', 'med', 1, 1, 1)"
if q postgres -f "$last" 2>/dev/null; then echo "FAIL: the migration ran over a results table with rows in it"; exit 1; fi
q postgres -c "do \$\$ begin if to_regnamespace('codeblack') is not null or (select count(*) from public.cb_results) <> 1 then raise exception 'FAIL: the refused migration changed something'; end if; end \$\$"
echo "ok - with a row in the old table, the migration refuses and changes nothing"
q postgres -c "delete from public.cb_results"
for f in $migs; do echo "migration $f"; q postgres -f "$f"; done
echo "second run of $last (it must be safe to run twice)"; q postgres -f "$last"
if q postgres -f live_before_v0.31.0.sql 2>/dev/null; then echo "FAIL: the baseline ran on a migrated database"; exit 1; fi
echo "ok - the baseline refuses to run on a migrated database"
q postgres -c "create database fresh"
q fresh -f stubs.sql
for f in $migs; do q fresh -f "$f"; done
q fresh -c "do \$\$ begin if to_regprocedure('public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)') is null then raise exception 'FAIL: fresh project'; end if; end \$\$"
echo "ok - the migrations alone build a fresh project"
(cd "$work" && "${as[@]}" "$bin/psql" -X -q -o /dev/null -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d postgres -f privacy_test.sql) 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
echo "ALL DATABASE CHECKS PASSED"
