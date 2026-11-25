# Round 7: what was fixed (Nov 24, 2026)

Round 7 reviewed the round-6 fixes at `18a71f9`, with the second migration (`20261125120000_codeblack_round6.sql`) written
but not yet applied. The six reports are in this folder; their 138 findings were merged into 105 items. The fixes are the
commit "Phase 2, round-7 review fixes". Because the second migration is still unapplied, its round-7 fixes went into it
directly (it isn't frozen yet).

## Needs the owner

- **Apply the second migration** after the Tests workflow, its PostgreSQL 17 database job included, is green on this
  commit (R2.6-02). Then add its SHA-256 to `supabase/migrations/applied.sha256` and commit: the deploy now refuses to
  publish until the live migrations and that file agree (R1.7-03).
- Unchanged from round 6: radio calls on their own random stream (R6.6-01) and the privacy contact.

## Fixed

- **The key box had no room to type (R4.7-01, R5.7-01, High).** Show sits beside the box; the UI test now checks the box's
  width, that Show is inside the card, and that nothing scrolls sideways.
- **Raw invisible characters in the second migration (R2.7-01).** Every character outside ASCII in the SQL code is now a
  `\uXXXX` escape, and `run.sh` refuses raw ones in any migration.
- **The attending's own deaths (R1.7-01, R5.7-02, R6.7-01).** The dead whose bodies haven't left by the end of the shift
  count too, once; the report, the summary, the Send payload and the export use that count. `test/rules13.js` checks it, and
  the other new counters (R6.7-07).
- **Complications (R6.7-02, R4.7-10).** One label everywhere, "complications (partly chance)", counting only unneeded
  treatments that led to one (a contraindicated drug is an unsafe order, not a chance complication).
- **Unneeded risky treatments are counted when ordered (R6.7-03, R5.7-09d),** whatever happens next.
- **Busy or full gave no code at all (R4.7-02, R5.7-03).** "Use it without results" is offered for any failure. The code
  then says results are off, tells the instructor to ask students not to send, and keeps its key, so Try again can set them
  up for the same code; reopening the sheet no longer deletes that key (R1.7-02, R3.7-01).
- **A code another class has (R3.7-04):** struck through, with no Copy, Share or Play, and a message to tell students not
  to send.
- **Forget leaves the copied key on the clipboard (R5.7-04):** Forget replaces a key this page copied.
- **Errors looked like help text (R4.7-03):** red and bold.
- **An ended class's code could be taken over (R1.7-08).** Its results go when it ends, and the code is held 30 more days
  with only its key's hash: another key gets "taken"; its own key turns it back on, empty.
- **IPv6 /48 (R3.7-02, R2.7-07):** limits per /48 as well (1,000 codes and 10,000 sends a day, 2,000 sends an hour), and a
  daily `db-watch.yml` run fails (GitHub emails the owner) when a backstop passes half full, the clean-up job is missing or a
  deletion is late.
- **The freeze (R1.7-03, R2.7-06):** `run.sh` refuses a malformed `applied.sha256` line and an unexpected file in
  `migrations/`; the deploy compares `applied.sha256` with the migrations recorded live.
- **The deploy (R2.7-03, R1.7-09, R3.7-08):** the PostgreSQL and class-results tests run in their own job; an emergency
  deploy (skip_db_check with a reason, checked first) skips them too; Playwright is pinned; the PGDG install says when its
  repository is unreachable; install steps have time limits; a manual run from another branch fails in red; the live-site
  check names this exact deployment (the service worker's cache name) and retries a 5xx before calling a source file
  published.
- **The clean-up job (R2.7-05):** missing or paused, it fails the deploy (it keeps the privacy promise for network counters
  and salts); warnings name the problem; the second migration schedules the job again and turns it on, so re-running the
  newest migration is the remedy.
- **The deploy's time-zone probe (R1.7-04, R2.7-04, R3.7-07)** now alternates zones, so it fails on a database that splits
  buckets by zone.
- **Names (R3.7-05, R5.7-08):** joiners only after a letter or mark of a script that uses them (U+0600 to U+0DFF), before a
  letter, or ending a Malayalam word; the Tibetan tsheg; repeated names compared without joiners; a refusal caused by a
  hidden character says so.
- **`is_public` (R3.7-06):** IPv6 must be global unicast, outside the special-purpose blocks (2024 ones included).
- **The redraw (R1.7-06, R3.7-03):** the branch holding the focused box is found by what it is, not where it is, so a list
  appearing above the form doesn't drop the keyboard. A redrawn button hands its focus to its replacement (R4.7-09).
- **Two Set up results at once (R1.7-07):** each row has its own request.
- **Smaller ones:** the delete error and "Deleting…" in the row; the row confirm and Delete all's confirm scroll into view;
  Results clears the sheet's close button; "may have ended" for a saved code past its date; the replace question mentions
  the saved list only when the code is saved, and Keep is the main button; a key pasted into the code box goes to the hidden
  key box; Show turns off after a failed read; the shared-computer note shows on the typed-key form; "mean door-to-provider
  wait (all arrivals)" names what the number is; the attending's Send box lists every department number; the Send box is
  near the top of the summary, with the name box before the small print; typing again clears a name refusal; "1 patient";
  the fired verdict no longer blames diagnoses and harm; "you saw no patients" shows even when someone died; the radio
  summary says "of those you answered"; About names the class code and says GitHub Pages logs visits; a version mismatch
  says so; `busy` says an hour or tomorrow; `scen` is no longer kept; `cb_health` reports fill to a tenth; the migration
  has a lock timeout and refuses without its predecessor (tested); `run.sh` re-runs the newest migration over a full
  database; `build.js` requires an x.y.z version and escapes `<` in the backend settings; `tools/name_ranges.py` refuses a
  Python without Unicode 15.1; `.gitattributes` keeps the SQL's line endings; docs corrected (CLAUDE.md, both READMEs, the
  changelog order).

## Partly fixed, or left, with the reason

- **Only the send and registration errors are driven in the UI test (R1.6-05).** Read `busy` and delete `busy` are driven
  too now; the other read and delete errors are checked by the SQL tests.
- **Rows are tall (R4.6-03):** a charge nurse's row carries seven department numbers; a compact layout is Phase 5.
- **`cb_health` lists migration names (R2.7-09k):** the deploy needs them to catch a skipped migration; they name nothing
  about classes or students.
- **The new engine counters aren't initialised in a new game (R1.7-12p):** they read `|| 0`; adding fields to the starting
  state would move every recorded shift.
- **Left by design:** yesterday's salt is kept a day so a count across midnight still works (R2.7-09z5); a typed read in
  flight is dropped when the sheet reopens, with Remember (R1.7-12m); a late Set up results shows the server's new made
  date (R4.7-11g); `oc-ckeys` records from unreleased builds aren't migrated (R1.7-12o, R3.7-09h).
- **Moved to Phase 4/5:** Node 24, actions pinned by commit, cone-mode sparse checkout, migrations run as superuser in
  `run.sh`, the stubs' cron table, shellcheck style notes, the About list's typography, `lastReport()` parsing storage.
