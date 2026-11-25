# Reviewer 2, round 11: DevOps, tooling, CI and legal (the release review of v0.31.0)

Branch `claude/sleepy-rubin-jot35n` at `e3fbeec` (v0.31.0). Reviewed:
- the round-10 fixes and the release as a whole (`git diff 1ab6fa9..e3fbeec -- src supabase test tools .github build.js package.json CLAUDE.md README.md docs/SMOKE.md`);
- the live-and-frozen second migration, as it now sits on the live project.

Nov 25, 2026.

**CI (GitHub REST API, read-only):**
- `origin/3d` is `e3fbeec`. Tests run 45645723660 is green: Rule checks; Database rules on **PostgreSQL 17.12**, en_US, fingerprint `d6705b15…` = the committed one; UI tests in Chrome.
- d57115a, the commit the migration was applied from, was green before the apply (run 45554040070).
- WebKit was skipped: it runs on `main` only. The last WebKit result on `ci-results` is v0.30.0 (`815e279`), and it is **red** (`map3d_test` FAIL, "SOME FAILED"). **v0.31.0 has never run in the iPhone engine.** The deferral is an owner decision from round 4. It still matters for this release (Verdict).
- `origin/main` is still `815e279` (v0.30.0). The deploy's new parts have never run: the `contract` job, `db_live.js` against live, the `deploy.txt` check. Neither has `db-watch.yml`, which isn't on `main` yet.

I did not contact supabase.co or edcodeblack.com. Every database call in my scripts went to a local PostgREST stand-in on a throwaway PostgreSQL 16.15 cluster. Scratch: `scratchpad/round11/r2/`:
- `live/` has the cluster scripts, `lifo.sql` and `take.sql`;
- `tree/` is a `git archive` of `e3fbeec`;
- `bin/` has actionlint 1.7.12 and shellcheck 0.11.0.

## 0. Round-10 status

| ID | Was | Status | Evidence |
|---|---|---|---|
| R2.10-01 The privacy lists name "how quickly the sickest patients were seen", which is never sent | Low | **Still open** | `grep -n "sickest patients were seen" src/ui.js` gives `:2284` (Send box) and `:3016` (About). `cbArgs` (`:2272-2280`) and `client_call.json` have no such key. |
| R2.10-02 The device drops a revived class's key at 60 days while the server still holds results | Low | **Still open** | `CB_KEEP = 60 * 864e5` (`ui.js:2075`) and the filter at `:2129` are unchanged. `CLAUDE.md:141` still says 60 days. |
| R2.10-03 The 30,000 held-code cap had no test | Low | **Partly fixed** | `privacy_test.sql:351-368` now floods 30,001 codes and checks the outcome. It covers only a flood that ended **after** the real code. Its own assertion admits the cap released "a few test classes that ended later". There is still no case for a released code being taken by another key, which is new finding R2.11-01. |
| R2.10-04 The fingerprint ignores triggers, policies, owners, schema grants and dependent views | Low | **Still open** | `fingerprint_parts()` changed only by the `contype` filter (`:390`). The migration is now frozen, so a fix needs a new migration. |
| R2.10-05 The fingerprint would change on PostgreSQL 18 | Low | **Fixed** | `and o.contype <> 'n'` at migration `:390`. The fingerprint `d6705b15…` is the same on 16.15 (here) and 17.12 (CI). Not run on 18; nothing here has it. The runbook line I asked for ("a PostgreSQL major upgrade can change the fingerprint: test first") was not added (`grep -n major supabase/README.md`: nothing). |
| R2.10-06 Nitpicks (12) | Nitpick | **Still open** | 0 of 12 fixed. Item by item below. |

**R2.10-06 by item:**
- **a. Still open.** A refused `full`/`all` send still revives the class. `cb_submit`'s revival (migration `:292-296`) still runs before the cap checks.
- **b. Still open.** README `:55` still says "deleted 30 days after the code was made". The typed-key error at `ui.js:2775` says "deleted 30 days after the code was made, or 14 if nobody sent one", with no word of the revival.
- **c. Can no longer be fixed.** The frozen migration's header still says "four more numbers", and still omits the revival, the cap and `fingerprint_parts`.
- **d. Still open.** `supabase/README.md:39` still says "about 25 MB with indexes" and "about 8 MB" for held codes. The migration says about 15 MB; I measured 15.6 MB and 4.7 MB.
- **e. Still open.** `db_live.js:57-58` still says "the live functions" for a hash over tables and the job.
- **f. Still open.** The `pages.yml:144-148` comment says "the version and the service worker's cache name, then the source … 404". The script checks `index.html`, then the 12 404s, then `sw.js`, then `3d/map3d.js`.
- **g. Partly fixed.** The `db-watch.yml:1-4` header still names only the backstops, the job and overdue deletions. It doesn't name held codes or the fingerprint. The other sub-items are unchanged.
- **h. Still open.** Held codes past half fail the watch every day, and `supabase/README.md` "Backstops" still gives no remedy for them. This now matters (R2.11-01).
- **i. Still open.** `run.sh` uses `python3` at `:99` and `:102`, but `:4` lists only PostgreSQL and bash.
- **j. Still open.** README `:55` still says "eight rounds of review of the fixes" and points to "`round4/STATUS.md` through `round9/STATUS.md`". There is a round-10 STATUS now.
- **k. Partly fixed.** The CLAUDE.md release bullet (`:18`) still omits step 3's check of `cb_health`'s `fp`. `:20` mentions only that the deploy checks it.
- **l. Still open.** The C.UTF-8 fallback compares two code-point collations (`run.sh:52,88`).

**Carried over from round 9, unchanged and now on a live, frozen database:**
- **R2.9-02 (Low): the runbook remedy for a function mismatch is still wrong.**
  - `supabase/README.md:58` says "A function: paste the newest migration again from the green commit (it re-creates every function)".
  - Migration 2 does not re-create `codeblack.keyed_class`, `norm_code`, `norm_key` or `key_hash`.
  - Reproduced again, on the local cluster:
    1. `alter function codeblack.keyed_class(text,text) volatile`;
    2. db_live gives "FAIL the live functions differ";
    3. re-paste migration 2;
    4. `fpdiff.sh` still gives `DIFF: f codeblack.keyed_class(text,text)`.
  - Migration 1 refuses to run over migration 2. So for those four functions there is no documented remedy except SQL written by hand on the live project.
- **Unchanged:** shellcheck SC2010 ×3 and SC2012 on `run.sh`; `class_test.py`'s fixed sleeps; the `name_ranges.py` message under Python 3.12.

**Counts:** 1 Fixed, 1 Partly fixed, 4 Still open, 0 Worse. R2.11-01 is a new defect introduced by the round-10 change to the cap, not a worsening of one of my findings.

**STATUS claims that overreach:**
1. **"The held-code cap released real codes (fixed) … the most recently ended go first (a flood ends after the real classes it would push out)".** It still releases real codes: every class that ends after a flood is released first, and the "never the code being registered" guard is beaten by making any other code first (R2.11-01).
2. **"privacy_test.sql checks a planned code survives a 30,001-code flood".** True only for a flood that ended after the planned code. The opposite order, which is the attacker's choice, is untested and fails.
3. **"GitHub's Node 20 warning: checkout v5, setup-node v5, setup-python v6".** `pages.yml` and the WebKit job still use `actions/configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`, `upload-artifact@v4` and `download-artifact@v4`, all Node 20 actions. The release run (the first `pages.yml` run since this change) will show the warning. The 3d runs had no annotations only because they don't run those jobs.
4. **"Lows and nitpicks … none is a correctness or privacy failure".** R2.10-01 is a privacy notice that is false. It lists a number the game doesn't collect.
5. **"Live fingerprint d6705b15… matches"** (commit `e3fbeec`). I can't verify it (barred). It is consistent with CI.

## 1. Verdict

**Ship v0.31.0 behind the gate, after three text fixes in the client. Plan a third migration for the cap.**

**Why ship now:**
- The live database already runs v0.31.0's migrations.
- So the live v0.30.0 game's Send and Class results are broken today (`supabase/README.md:62` says so).
- Shipping v0.31.0 is what repairs them.

**What is solid:**
- The build reproduces byte for byte.
- `npm test`: 720 ok, 0 FAIL.
- `db:test`: 228 ok.
- `class_test.py`: 107 ok.
- Tests are green on PostgreSQL 17.
- db_live passes against a faithful local stand-in.
- No secrets in the diff.
- Retention: every path I traced deletes results within 30 days of the class's first result, except the hourly job's lag. So About's "How long" and `CB_WHO` are true.

**Before the merge into `main` (client only, XS each):**
1. **Delete "how quickly the sickest patients were seen"** from both privacy lists (R2.10-01). A student reads that list before tapping Send, and it lists a number the game never sends.
2. **Stop promising "nobody else can take it"** in the made box (`ui.js:2176`) and the README, or qualify it (R2.11-01). Until a migration fixes the cap, it isn't true under a flood.
3. **Make the planned-code text say "on this version of the game"** (R2.11-03).
4. **Dispatch the Tests workflow's WebKit job by hand on `3d`.** The phone-first game's iPhone engine has never run v0.31.0, and its last result is red. This is a request, not a finding (the deferral is an owner decision).

**After release (new migration):** fix the cap (R2.11-01) together with R2.10-04 and the runbook remedy (R2.9-02). Each needs a migration and a new `fingerprint.json`.

## 2. Score

**7 / 10** (round 10: 8).

**What earned the points:**
- The release machinery: the build check, the frozen-migration check, the fingerprint on 16 and 17, and the C-locale fresh project.
- db_live's clear diagnoses, and the skip that comes before any file read.
- The watch with least privilege.
- The second migration went live from a green commit, and the stale paste was caught by the fingerprint, as designed.

**What costs the rest:**
- The round-10 "fix" to the held-code cap introduced a takeover path for exactly the codes the hold exists to protect, and froze it in a live migration. The test file even records the symptom.
- Zero of my round-10 Lows and nitpicks were fixed, including a false line in a privacy notice.
- A runbook remedy that is still wrong now has a live database to be wrong about.

## 3. New findings (worst first)

### R2.11-01 · Medium · Past 30,000 held codes the cap releases the newest-ended real classes first, so after any flood a planned or just-ended class code can be taken over, and its students' names and scores go to a stranger

**Location:**
- `supabase/migrations/20261125120000_codeblack_round6.sql:239-245` (`order by x.expires_at desc limit 1000`, `x.code <> v_code`). LIVE and frozen.
- The claims it breaks:
  - the migration comment `:239-241` ("a flood made to fill the hold ends after the real classes it would push out, so it goes before them; never the code being registered, so one call can't free a code and take it");
  - `supabase/README.md:36`;
  - CLAUDE.md `:141`;
  - the instructor's made box (`ui.js:2176`): "Once a class ends, its code is held 30 days with only its key's hash, so nobody else can take it", and "a code made ahead of a class still works then";
  - STATUS round 10.

**What goes wrong:**
- The ordering protects only the real classes that ended *before* the flood. Once 30,000 flood codes are held, the class that ended most recently is always a real one: a just-finished class, or a planned code that has just passed its 14 unused days. That class is released first.
- "Never the code being registered" means only that the attacker needs two calls:
  1. any code, which frees the 1,000 newest held codes;
  2. the target code, with the attacker's key.
- A planned code is posted weeks ahead (the migration's own comment), so it is the natural target. When the class finally plays it, every student's first name and score goes to the attacker's key. The instructor's own key gets `{"error":"key"}`, which the game shows as "That code and key don't match, or the class has ended".

**Cost to the attacker:**
- The limits allow 1,000 new codes a day per IPv6 /48 (`class_day48`) and 200 per network.
- One /48 flooding steadily reaches about 30,000 held codes in about 30 days (14 live, then 30 held). About 30 /48s, or about 150 IPv4 addresses, reach it in a day.
- The watch fails at about half (15,000 held), but the runbook has no remedy for held codes (R2.10-06h). The owner gets a daily issue and nothing to do.

**Reproduction 1** (local cluster with baseline and both migrations, `scratchpad/round11/r2/live/setup.sh 9`, then `q.sh -f take.sql`):
1. Insert 30,001 held codes (key Z) that ended 3 days ago, and a planned code `PPP-P11` (key B) made 14 days ago that ended unused 1 minute ago.
2. As anon:
   - `cb_class_new('ATK-0A1', 'DDDDDDDDDDDDDDDD', '0.31.0')` gives ok;
   - `cb_class_new('PPP-P11', 'DDDDDDDDDDDDDDDD', '0.31.0')` gives **ok** (the attacker now owns P);
   - `cb_submit('PPP-P11', …, 'Ana', …)` gives `{"ok": true}`;
   - `cb_class_read('PPP-P11', 'DDDD…')` gives `["Ana"]`;
   - `cb_class_read('PPP-P11', 'BBBB…')` (the instructor) gives `{"error": "key"}`.
3. 29,002 flood codes are still held.

**Reproduction 2** (`lifo.sql`): with the flood ended 1 day ago, a used class that ended 1 hour ago and a planned code that ended 12 hours ago:
- one unrelated `cb_class_new` releases both;
- another key then registers the used class;
- a student's first result to the planned code gives `{"error":"unknown"}`.

Under the previous oldest-first rule both would have stayed (the flood is older).

**Also:** the new test (`privacy_test.sql:351-366`) passes only because its flood "ended 1 day ago", after its real code (6 days ago). Its assertion text says the cap let "a few test classes that ended later" go: the bug, written down as expected behaviour.

**Fix (a new migration, plus client text now):**
- **The fix:** never release a held code to make room. Past the cap, answer `full` to new codes from the networks making them. Or store the creating network's hash on `classes` and release that network's held codes first.
- **The test:** add the attacker's order (flood ends first), and a "released code taken by another key" case.
- **The text:** until the migration lands, make the made box and README say the hold can be cut short under a flood.
- **The runbook:** give a held-code remedy (delete held codes made in the attack window: `expires_at <= now() and created_at between …`).

**Effort:** M (migration, test, fingerprint, docs).

### R2.11-02 · Low · The runbook now endorses applying migrations through Claude's Supabase tool, which is known to corrupt them, and the repair that was run on live isn't in the repo

**Location:** `supabase/README.md:50` (new in `e3fbeec`); `CLAUDE.md:143` ("he pastes it into the SQL editor, or approves the tool call"); commit `e3fbeec`'s message.

**What happened:**
- The note says the tool "turns `\uXXXX` escapes in the text into the characters themselves", and that `clean_name` "had to be re-sent with the escapes rebuilt in the database".
- So the live database didn't get the file whose SHA-256 is now in `applied.sha256`. It got a corrupted version, then an ad hoc repair.
- The repair's SQL appears nowhere in the repo or the commit.
- Between the two sends, the live name validator was not the reviewed one.

**Why it matters:**
- The ASCII-with-escapes rule (`run.sh:36-39`, audit R2.7-01) exists precisely so that what is pasted is what runs. The runbook now presents the one path known to break that rule as an equal option.
- The fingerprint caught it, as designed. But "frozen in `applied.sha256`" now means "the file, as mangled and then fixed by hand".

**Evidence:** `git show e3fbeec`; `supabase/README.md:50`. I can't see the live database. I also can't tell whether the tool recorded a row in Supabase's own migration history, which Case Room's project shares (check `supabase_migrations.schema_migrations`).

**Fix:**
- Say plainly: apply migrations only by pasting the file into the SQL editor. The Claude tool can't be used for a migration with `\u` escapes.
- Remove "(or approves the tool call)" from both docs.
- Commit the repair SQL that was run (or a note of exactly what was run) under `supabase/` as a record.

**Effort:** XS.

### R2.11-03 · Low · The made box promises a planned code "still works" for up to 44 days, but any game release in between kills it

**Location:**
- `ui.js:2176` ("a student's first result before <date> starts it again for 30 days: a code made ahead of a class still works then");
- README `:55` ("so a code made ahead of a class still works");
- `supabase/README.md:36` ("a planned code works up to 44 days after it was made").

**Why it fails:**
- Class codes are salted with the game version. A newer game refuses an older code: `readCode` gives `stale`, the student sees `staleWhy` "made on another version … ask your instructor for a new code", and the server's revival requires `c.ver = p_ver` (migration `:295`).
- This project ships several versions a week (v0.29.0 to v0.31.0 in three days).
- The instructor who makes a code 30 days ahead, as the box invites, is the one most likely to be hit, and nothing on the made box warns them.

**Reproduction:** read `ui.js:2176`; then `grep -n "c.ver = p_ver" supabase/migrations/20261125120000_codeblack_round6.sql`; then CLAUDE.md "Class codes stay six characters … a code from another version is usually refused". Release cadence: `git log --format='%ad %s' --date=short | grep -E '^.{11}v0\.(29|30|31)\.0' | head`.

**Note:** the deferral of version-stable codes (round 4) is an owner decision. This finding is about the promise the made box makes, which is newer.

**Fix:** add "on this version of the game (v0.31.0); a game update needs a new code" to the made box and the two READMEs.

**Effort:** XS.

### R2.11-04 · Nitpick (5 items)

- **a. The privacy text says "every rhythm check right" for every lost code it counts.** The Send box (`ui.js:2283`) and `CB_MDNOTE` (`:2200`) define "a code run by the book" that way. The engine (`engine.js:2276`, `book = C.wait <= 3 && (!C.me || C.right >= n)`) also counts a code another doctor ran, with no check requirement.
- **b. The Node 20 actions remain in the jobs that publish** (STATUS claim 3 above). Move `configure-pages`, `upload-pages-artifact`, `deploy-pages`, `upload-artifact` and `download-artifact` to their Node 24 majors, and say which in STATUS.
- **c. `run.sh:108` still says "If that is intended and the newest migration isn't applied yet, replace …".** With both migrations applied, a fingerprint change on an unchanged migration set (a PostgreSQL upgrade, a catalog change) prints a replacement file. If anyone commits it, the live check breaks. Say "if no migration is unapplied, don't replace it: find what changed".
- **d. `db_live.js:58` ("re-create it from the migration that makes it")** can't be followed for the four functions only migration 1 makes, since it refuses to re-run (R2.9-02 above). It should name the new-migration route.
- **e. README `:55` runs to about 600 words in one paragraph,** and two of its retention sentences contradict each other (R2.10-06b).

## 4. Coverage

**Read:**
- BRIEF rounds 10 and 11, round-10 STATUS, my round-10 report;
- the whole diff `1ab6fa9..e3fbeec` in the listed paths;
- all three workflows in full (`tests.yml`: only action versions changed);
- `test/db_live.js` and `supabase/tests/run.sh` in full;
- `supabase/README.md` sections How long, Backstops, Releasing and Rolling back;
- CLAUDE.md release steps;
- the migration's `cb_class_new`, `cb_submit`, `cb_class_read`, `tidy` and `fingerprint_parts`;
- `privacy_test.sql`'s new cap test;
- in `ui.js`: `CB_KEEP`/`cbKeys`, the made box, `cbArgs`, `cbWhatAll`, `CB_WHO`, `CB_MDNOTE`, `cbTable`, About's Privacy, the typed-key error, `staleWhy`;
- the engine diff (no new random draws, storage or network).

**Ran:**
- **`npm run db:test` in the repo:** 228 ok, ALL PASSED (16.15, en_US, 5 s; repo left clean).
- **A scratch `git archive` of `e3fbeec`:**
  - `npm run build`: `index.html`, `sw.js` and `3d/map3d.js` byte-identical to the commit;
  - `npm test`: 720 ok, 0 FAIL;
  - `python3 test/class_test.py`: 107 ok, "No errors."
- **db_live.js against a local PostgREST stand-in** (baseline plus both migrations):
  - deploy mode: all pass, exit 0;
  - watch mode: all pass;
  - after `alter function codeblack.keyed_class volatile`: FAIL on the fingerprint with its remedy text, and the remedy (re-paste migration 2) leaves the difference (R2.9-02).
- **The cap:** `lifo.sql` and `take.sql` (R2.11-01).
- **Retention paths traced again:** first result within 14 days, late first result, refused send, own-key turn-on, used class at its end, the cap. Results are deleted within 30 days of the first result in all, apart from the job lag.
- **Lint:**
  - actionlint 1.7.12 with shellcheck 0.11.0 on all three workflows: clean;
  - shellcheck on `run.sh`: the same four old notes;
  - `bash -n run.sh` and `node --check db_live.js`: clean.
- **GitHub (read-only):** the run list for `3d`, the jobs and log of run 45645723660, annotations (none), `ci-results:webkit.txt`.
- **Secret scan of the diff:** no `sb_secret_`, JWT, bcrypt hash, GitHub, AWS or Slack token, private key or `service_role`. `backend.json` holds the publishable key only and is unchanged.

**Couldn't check:**
- the live project and site (barred);
- PostgreSQL 18;
- real pg_cron;
- any run of `pages.yml`'s new jobs or `db-watch.yml`;
- the `github-pages` environment's protection rules;
- what Claude's Supabase tool recorded in Supabase's own migration history.

## 5. What I'd keep

- **The fingerprint per object.** It caught a mangled live paste in production, which is exactly what it was built for.
- **db_live's diagnoses.** One message per cause, the skip before any file read, and an applied.sha256-vs-live check that forces the repo to record what is live.
- **`run.sh`'s freeze, its odd-file and predecessor refusals, and the C-locale fresh project.**
- **The watch job's split permissions and single issue.**
- **The retention design.** It holds on every path I traced, and About's "How long" says it accurately.
- **The contract file,** which keeps `mdCodeLost` in step on both sides.
