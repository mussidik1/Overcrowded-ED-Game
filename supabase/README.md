# The Code Black database

Code Black keeps two things on a server: class results and the private-testing password gate. Both live in a Supabase project
(`ecpxhcqvgxizdadwumqt`, AWS us-east-1, PostgreSQL 17) that is shared with Case Room. Everything else in the game runs offline
in the browser.

This folder holds every Code Black object in that project, so it can be read, reviewed and rebuilt. Case Room's own tables and
functions (schemas `caseroom` and `golden_hour`, functions `cr_*` and `gh_*`) are not here.

## The files

| File | What it is |
|---|---|
| `baseline/live_before_v0.31.0.sql` | The live database before v0.31.0, read from the project. A record, not a migration: it refuses to run on a database that has v0.31.0. |
| `migrations/20261124120000_codeblack_private_results.sql` | v0.31.0: private class results (below). |
| `tests/run.sh` | A throwaway local Postgres: the baseline, the migrations (the last one twice, and refused over a newer one), the self-recorded name, the refusals, a fresh project, then `privacy_test.sql`. |
| `tests/stubs.sql` | The Supabase pieces the SQL expects: the API roles and their default grants, pgcrypto, a stand-in for pg_cron. |
| `tests/privacy_test.sql` | About 160 checks of the rules, as the browser would meet them. |
| `tests/client_call.json` | The contract: the exact calls the game makes, every error each function can give, and names both sides must accept and refuse. `privacy_test.sql` and `test/class_test.py` both check against it. |

- `npm run db:test` runs the local checks (PostgreSQL 15 or newer, with pgcrypto). CI runs them on PostgreSQL 17, as live.
- `npm run db:live` (`test/db_live.js`) checks the live project from outside with the game's public key. The Pages deploy runs it **before** it publishes. It can't run from a Claude cloud container (the network refuses supabase.co). It needs the live database to have the repo's newest migration or a newer one; a run that hits the hourly limit says so and when to re-run; `skip_db_check` on a manual run of the Deploy workflow skips it in an emergency.
- The game reads the project's address and key from `src/backend.json` (the build puts them in the page and in its Content Security Policy). Set `contact` there to show a privacy contact on the About page.

## How class results work (since v0.31.0)

- **Registering a code.** When an instructor picks a shift, the game makes a code and a 16-character **instructor key** (80 random bits, from the browser's secure random source), saves the key on that device (kept 30 days from when the code was made, marked unconfirmed until the server answers), and calls `cb_class_new`. The database stores the code with the key's SHA-256 only. Registering the same code with the same key again is fine, so a retry after a lost answer is safe; another key gets `taken`, and the game makes a new code before showing anything (and never shows a taken code).
- **Sending a result.** After a class-code shift, a student taps Send. `cb_submit` checks everything: the code is registered and live, and the result's version matches the class's (a mismatch answers `unknown`, like a dead code, so the answers don't reveal live codes); the name is a first name or initials (a letter, then letters with their marks in any script, periods, hyphens and apostrophes; up to three words and 20 characters; no number of any kind (Unicode Nd, Nl and No), no @, no invisible fillers, no circled, squared or math letters); score 0 to 100, stars 0 to 3, play time up to a day. Stats are rebuilt from known keys only, with whole numbers; anything else is dropped, so a game that sends one more number still works. A refusal names the field. Each result carries its own id from the game, so a retry is kept once. A class holds at most 500 results. Stats now include the attending's own patients, harm and radio calls, and whether the shift ended early.
- **Reading and deleting.** Only `cb_class_read` and `cb_class_delete`, each with the code and its key, reach a class's results. A wrong key, an unknown code and an expired class get the same answer. The instructor deletes one result (by its id) or all of them (`p_all`).
- **Where it's kept.** The tables are in the `codeblack` schema. The API doesn't expose it, and the public key has no grant on it, so the `cb_` functions are the only way in. They are `SECURITY DEFINER` with `search_path` set to `pg_catalog, pg_temp`, and everything inside is schema-qualified.
- **How long.** A code lasts 14 days until its first result, then 30 days from when it was made; then it and its results are deleted. The hourly `codeblack-tidy` job deletes them, and every new code also clears expired ones, so deletion doesn't depend on the job alone. Reads and sends already treat an expired class as gone.
- **Rate limits.** One counter per network, kind and clock hour (`codeblack.rate`): 60 new codes, 600 sends, 300 reads, 120 wrong-key deletes and 120 health checks per network per hour (plus 30 `cb_health(true)` probes, the deploy's forged-header check); deletes with the right key aren't limited. Once a network is over, further refusals write nothing. The network is an HMAC of its address with a random salt that changes every day; counters and salts are deleted within two days. IPv6 counts by /56.
- **Whose address.** `codeblack.client_ip()` takes Cloudflare's `cf-connecting-ip` first (Cloudflare replaces any value a client sends), then `x-real-ip`, then the first `x-forwarded-for` entry, and only if it parses as an address. This depends on Supabase's gateway; `db_live.js` checks it every deploy (`cb_health` says whether an address was read and whether it is public, and 31 probe calls with forged headers must still hit the limit).
- **Backstops.** About 100,000 live classes (about 15 MB) and 300,000 results (about 150 MB), estimated from the table statistics: far above any real use and well under the free plan's 500 MB, which Case Room shares. Past them, registering and sending answer `full`.
- **`cb_health`.** For the deploy's check: the live migration's name, how many classes are more than two hours past deletion, whether the clean-up job is scheduled, whether the caller's address was read. No class data.

What it can't do: a player can change their own score in the browser before sending it, and anyone holding a class code can send made-up results to that class under any name. The game says so to instructors ("Not for grading"), and the instructor can delete any result.

## Releasing a database change

The order matters: **database first, then the game.** The deploy refuses to publish a game whose database isn't there yet.

1. Add a new file to `migrations/` named `YYYYMMDDHHMMSS_codeblack_<what>.sql`. Wrap it in `begin; ... commit;`, make it safe to run twice, have it refuse to run when a newer name is in `codeblack.migrations`, and have it record its own name there (`run.sh` checks both).
2. Run `npm run db:test` and add checks to `tests/privacy_test.sql` (and `tests/client_call.json` if a call changes).
3. The owner approves each change to the live project. He pastes the file into the Supabase SQL editor (or approves the tool call). Check afterwards that `select public.cb_health();` names the new migration.
4. Merge the game into `main`. The deploy runs `db_live.js` before publishing; if it fails, nothing is published, and the output says why: not migrated (apply it, re-run), rate-limited this hour (re-run after the hour), unreachable (Supabase down or paused), or a rule broken.

Between steps 3 and 4 the live site still runs the previous game. For v0.31.0 that means its Send and Class results fail until the deploy (they used the old open table); the gate is on and nobody uses class results yet.

**Rolling back the game** (`git revert -m 1 <merge>` on `main`) leaves the database as it is, and the deploy's check accepts a database ahead of the game. Rolling back v0.31.0 itself would bring back v0.30.0, whose Send and Class results use the old open table: with this migration applied they simply fail ("Could not send"), and nothing private is exposed. There is no database rollback for v0.31.0: undoing it would reopen the old table.

## The gate

The gate password's hash is never in this repo. To set or change the password, in the SQL editor:

```sql
update public.cb_gate set pass_hash = extensions.crypt('<the password>', extensions.gen_salt('bf')), updated_at = now() where id = 1;
```

At launch the gate goes off: `update public.cb_gate set gate_on = false where id = 1;`
