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
# 6. The newest migration on a database without the ones before it: it must refuse. Then a fresh database with the
#    migrations alone (a new project).
# 7. privacy_test.sql: the rules, as the browser meets them, and the contract with the game (client_call.json).
# 8. The newest migration once more, over the data the tests left: nothing is lost.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$bin/initdb" ] || { echo "No PostgreSQL found (set PG_BIN)"; exit 1; }
# A file in migrations/ that isn't named like a migration would be skipped silently: refuse it (R2.7-09a).
odd=$(cd "$here/../migrations" && ls | grep -vE '^([0-9]{14}_[a-z0-9_]+\.sql|applied\.sha256)$' || true)
[ -z "$odd" ] || { echo "FAIL: unexpected file(s) in supabase/migrations (a migration is named YYYYMMDDHHMMSS_codeblack_<what>.sql): $odd"; exit 1; }
# 0. The applied migrations are frozen (supabase/README.md, "Releasing"): a change to one would never reach the live project.
if command -v sha256sum >/dev/null; then sum=(sha256sum); else sum=(shasum -a 256); fi
# Every line exactly "<64 hex>  <file>.sql" (sha256sum -c skips a malformed line without failing; audit R1.7-03), every file there.
bad=$(grep -nvE '^[0-9a-f]{64}  [0-9]{14}_[a-z0-9_]+\.sql$' "$here/../migrations/applied.sha256" || true)
[ -z "$bad" ] || { echo "FAIL: malformed line in applied.sha256 (want: the hash, two spaces, the file name):"; echo "$bad"; exit 1; }
(cd "$here/../migrations" && "${sum[@]}" -c --strict applied.sha256 >/dev/null 2>&1 || "${sum[@]}" -c applied.sha256 >/dev/null) || { echo "FAIL: an applied migration was edited, or is missing. Put the change in a new migration (supabase/README.md)."; exit 1; }
applied=$(awk '{print $2}' "$here/../migrations/applied.sha256" | sort); newest_applied=$(echo "$applied" | tail -1)
for f in $(cd "$here/../migrations" && ls | grep -E '^[0-9]{14}_.*\.sql$' | sort); do
  if ! echo "$applied" | grep -qxF "$f" && [[ "$f" < "$newest_applied" ]]; then echo "FAIL: $f isn't applied, but sorts before $newest_applied, which is. Rename it to a later time."; exit 1; fi
done
echo "ok - the applied migrations are unchanged ($(echo "$applied" | wc -l | tr -d ' ') listed in applied.sha256)"
# Only ASCII outside comments: a paste into the SQL editor can drop or change an invisible character (audit R2.7-01). Write \uXXXX.
if grep -nv '^[[:space:]]*--' "$here"/../migrations/[0-9]*.sql | LC_ALL=C grep -n '[^[:print:][:space:]]' >/dev/null; then
  echo "FAIL: a migration has a character outside ASCII in its code (write it as \\uXXXX):"; grep -nv '^[[:space:]]*--' "$here"/../migrations/[0-9]*.sql | LC_ALL=C grep '[^[:print:][:space:]]' | cut -c1-120; exit 1
fi
echo "ok - the migrations' code is plain ASCII"
work="$(mktemp -d)"; chmod 700 "$work"
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
loc=C.UTF-8; if locale -a 2>/dev/null | grep -iE '^en_US\.utf-?8$' >/dev/null; then loc=en_US.UTF-8; fi   # the live project is en_US.UTF-8 (no -q: under pipefail an early exit fails the pipe)
"${as[@]}" "$bin/initdb" -D "$work/db" -U postgres -A trust --locale="$loc" -E UTF8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$work/db" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null
echo "$("$bin/postgres" --version | sed 's/^postgres (PostgreSQL) /PostgreSQL /'), locale $loc"
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
# A later migration refuses to run on a database without the ones before it (R1.7-12c).
q postgres -c "create database bare"
q bare -f stubs.sql
if [ "$first" != "$last" ]; then
  if q bare -f "$last" 2>"$work/pre.txt"; then echo "FAIL: $last ran without the migrations before it"; exit 1; fi
  grep -q 'first' "$work/pre.txt" || { echo "FAIL: $last failed without its predecessor, but not with its own message:"; cat "$work/pre.txt"; exit 1; }
  echo "ok - the newest migration refuses to run without the ones before it"
fi
q postgres -c "create database fresh"
q fresh -f stubs.sql
for f in $migs; do q fresh -f "$f"; done
q fresh -c "do \$\$ begin if to_regprocedure('public.cb_class_new(text,text,text)') is null or to_regprocedure('public.cb_submit(text,uuid,text,text,text,int,int,int,jsonb,text)') is null or to_regprocedure('public.cb_class_read(text,text)') is null or to_regprocedure('public.cb_class_delete(text,text,uuid,boolean)') is null or to_regprocedure('public.cb_health(boolean)') is null or to_regnamespace('codeblack') is null then raise exception 'FAIL: fresh project'; end if; end \$\$"
echo "ok - the migrations alone build a fresh project"
(cd "$work" && "${as[@]}" "$bin/psql" -X -q -o /dev/null -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d postgres -v latest="${last%.sql}" -f privacy_test.sql) 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
# The newest migration once more, over a database full of classes, results and counters, as on the live project (R1.7-12b).
count="select (select count(*) from codeblack.classes) || '/' || (select count(*) from codeblack.results)"
q postgres -At -o n0.txt -c "$count"; n0=$(cat "$work/n0.txt")
q postgres -f "$last"
q postgres -At -o n1.txt -c "$count"; n1=$(cat "$work/n1.txt")
[ "$n0" = "$n1" ] || { echo "FAIL: re-running $last over data changed it ($n0 -> $n1 classes/results)"; exit 1; }
echo "ok - the newest migration runs again over a full database and keeps every class and result ($n1)"
echo "ALL DATABASE CHECKS PASSED"
