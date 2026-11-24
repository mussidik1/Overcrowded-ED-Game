#!/usr/bin/env bash
# Builds a throwaway Postgres, applies the Supabase stand-ins, the baseline and every later migration, then runs
# privacy_test.sql against it. Needs PostgreSQL 15 or newer with pgcrypto (Ubuntu's postgresql package has both).
#   bash supabase/tests/run.sh
# Nothing here touches the live project.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
bin="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
[ -x "$bin/initdb" ] || { echo "No PostgreSQL found (set PG_BIN)"; exit 1; }
work="$(mktemp -d)"; chmod 755 "$work"
cp "$here"/../migrations/*.sql "$here"/stubs.sql "$here"/privacy_test.sql "$work"/
as=()
if [ "$(id -u)" = 0 ]; then as=(runuser -u postgres --); chown -R postgres "$work"; fi   # initdb refuses to run as root
port="${PG_PORT:-54329}"
cleanup() { "${as[@]}" "$bin/pg_ctl" -D "$work/db" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
loc=C.UTF-8; locale -a 2>/dev/null | grep -qi '^en_US.utf-\?8$' && loc=en_US.UTF-8   # the live project is en_US.UTF-8
"${as[@]}" "$bin/initdb" -D "$work/db" -U postgres -A trust --locale="$loc" -E UTF8 >/dev/null
"${as[@]}" "$bin/pg_ctl" -D "$work/db" -o "-p $port -k $work -c listen_addresses=''" -l "$work/log" -w start >/dev/null
psql=("${as[@]}" "$bin/psql" -X -q -o /dev/null -v ON_ERROR_STOP=1 -h "$work" -p "$port" -U postgres -d postgres)
"${psql[@]}" -f "$work/stubs.sql"
for f in $(cd "$work" && ls 2*.sql | sort); do echo "migration $f"; PGOPTIONS="-c client_min_messages=warning" "${psql[@]}" -f "$work/$f"; done
echo "second run of the latest migration (it must be safe to run twice)"; PGOPTIONS="-c client_min_messages=warning" "${psql[@]}" -f "$work/$(cd "$work" && ls 2*.sql | sort | tail -1)"
"${psql[@]}" -f "$work/privacy_test.sql" 2>&1 | sed -e 's/^psql:[^ ]* NOTICE:  //' -e 's/^NOTICE:  //'
echo "ALL DATABASE CHECKS PASSED"
