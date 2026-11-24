# The Code Black database

Code Black keeps two things on a server: class results and the private-testing password gate. Both live in a Supabase project
(`ecpxhcqvgxizdadwumqt`, US East) that is shared with Case Room. Everything else in the game runs offline in the browser.

This folder holds every Code Black object in that project, so it can be read, reviewed and rebuilt. Case Room's own tables and
functions (schemas `caseroom` and `golden_hour`, functions `cr_*` and `gh_*`) are not here.

## The files

| File | What it is |
|---|---|
| `migrations/20261124000000_codeblack_baseline.sql` | The live database before v0.31.0, read from the project. A record: it is already applied. |
| `migrations/20261124120000_codeblack_private_results.sql` | v0.31.0: private class results (below). |
| `tests/run.sh` | Builds a throwaway local Postgres, applies the migrations (the last one twice), and runs `tests/privacy_test.sql`. |
| `tests/stubs.sql` | The few Supabase pieces the migrations expect (the API roles, pgcrypto, a stand-in for pg_cron). |
| `tests/privacy_test.sql` | About 120 checks of the rules, as the browser would meet them. |

`npm run db:test` runs the local checks (PostgreSQL 15 or newer, with pgcrypto). CI runs them on every push. `npm run db:live`
(`test/db_live.js`) checks the live project from outside with the game's public key; the Pages deploy runs it after each release.

## How class results work (since v0.31.0)

- **Registering a code.** When an instructor makes a class code, the game calls `cb_class_new`. The database stores the code with a
  SHA-256 hash of a new 16-character **instructor key** and returns the key once. The game keeps it on that device and shows it with
  a Copy button. Codes are unique among live classes: a code that's taken comes back `taken`, and the game makes another.
- **Sending a result.** After a class-code shift, a student taps Send. `cb_submit` checks everything: the code is registered and
  live; the name is a first name or initials (letters, periods, hyphens and apostrophes, at most two words and 20 characters, so no
  digits, @ or markup); score 0 to 100, stars 0 to 3, play time up to a day; the stats object has only known keys with numbers in
  range; the version is `x.y.z`. Each result carries its own id from the game, so a result sent twice is kept once. A class holds
  at most 300 results.
- **Reading and deleting.** Only `cb_class_read` and `cb_class_delete`, each with the code and its key, reach a class's results. A
  wrong key, an unknown code and an expired class all get the same answer. The instructor can delete one result or all of them.
- **Where it's kept.** The tables are in the `codeblack` schema. The API doesn't expose that schema, and the public key has no grant
  on it, so the four `cb_` functions are the only way in. They are `SECURITY DEFINER` with an empty `search_path`.
- **30 days.** A code and everything sent for it are deleted 30 days after the code was made, by the hourly `codeblack-tidy` job.
  An expired class can't be read or sent to before the job runs.
- **Rate limits.** Per network and hour: 20 new codes, 200 results, 120 reads, 120 deletes. Refused requests count too. Overall: 3,000
  new results an hour, 10,000 a day, 100,000 in all, and 50,000 live classes. The network address is never stored: only an HMAC of it,
  with a random 32-byte salt that stays in the database, kept for one day.

What it can't do: a player can still change their own score in the browser before sending it (the game says scores are
self-reported), and someone who holds a class code can still send made-up results to that class (the instructor can delete them).

## Changing the database

1. Add a new file to `migrations/` named `YYYYMMDDHHMMSS_codeblack_<what>.sql`. Wrap it in `begin; ... commit;` and make it safe to
   run twice.
2. Run `npm run db:test` and add checks to `tests/privacy_test.sql`.
3. The owner approves each change to the live project. He pastes the file into the Supabase SQL editor (or approves the tool call).
4. Run `npm run db:live` from a machine that can reach supabase.co, or let the next deploy run it.

The gate password's hash is never in this repo. To set or change the password, in the SQL editor:

```sql
update public.cb_gate set pass_hash = extensions.crypt('<the password>', extensions.gen_salt('bf')), updated_at = now() where id = 1;
```

At launch the gate goes off: `update public.cb_gate set gate_on = false where id = 1;`
