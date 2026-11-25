# Round 6: what was fixed (Nov 24, 2026)

Round 6 reviewed the round-5 fixes at `6328cdf`, with the migration `20261124120000_codeblack_private_results` already
live. The six reports are in this folder. The fixes are the commit "Phase 2, round-6 review fixes". Some need a second
migration, `20261125120000_codeblack_round6.sql`, which **the owner must approve and apply before v0.31.0 goes to
`main`** (the deploy refuses to publish until it is live).

## Needs the owner

- **Apply `supabase/migrations/20261125120000_codeblack_round6.sql`** (SQL editor, or approve the tool call), then add
  its SHA-256 to `supabase/migrations/applied.sha256`.
- **Radio calls on one class code (R6.6-01).** They are drawn from the main random stream, so two students on one code
  get different calls. The text now says so everywhere (the class code sheet, the list's note, the README, and each row
  shows calls right out of calls offered). Moving them to their own stream changes every recorded shift
  (`golden:update`) and is a game change: an owner decision.
- **The privacy contact** stays on hold (`src/backend.json`, `contact`).

## Fixed

- **The deploy would fail on its first run (R2.6-01, R3.6-01).** The build job reads the Pages settings again
  (`pages: read`). The build and deploy jobs run only from `main` (R1.6-09, R3.6-13).
- **Enter in the key box froze Class results (R4.6-01, R3.6-02, R1.6-02).** The redraw keeps only the box being typed in
  and brings everything around it up to date, so an error, "Loading…" or the list shows at once. Show results does
  nothing when its form is closed. The UI test now types key by key and presses Enter.
- **A typed key left for the next person (R5.6-01, R3.6-04).** Opening Class code clears the form and the typed key, and
  drops any answer still on its way. **The key box is masked** while typed, with Show (R5.6-02, R4.6-11).
- **Forget and Close don't cancel a request in flight (R3.6-03).** Both drop answers still on their way; a read answered
  after Forget shows nothing and saves nothing.
- **A code nobody checked was shown (R3.6-06).** A code shows only after the server answers `ok`. Busy, full or refused:
  no code, the reason, and Try again. A server that can't be reached at all: Try again, or "Use it without results".
- **Rate limits by time zone (R3.6-05).** The limits and the daily salt use UTC whatever a request asks for (migration).
  The deploy's probe now also asks for another time zone.
- **Backstops (R3.6-07):** daily limits per network (200 codes, 3,000 sends), `cb_health` reports how full the backstops
  are, the deploy warns past half, and `supabase/README.md` has the clean-up SQL. Deleting the oldest unused classes
  when the backstop trips was not done: it would let an attacker evict real classes silently.
- **The live migration is frozen (R2.6-03, R1.6-01).** `supabase/migrations/applied.sha256`; `run.sh` refuses an edited
  applied migration, or a new one that sorts before an applied one. A skipped migration shows: `cb_health` lists every
  recorded migration and the deploy compares (R1.6-04).
- **The deploy waits for the database rules and the class-results test (R1.6-03),** on PostgreSQL 17.
- **Contract (R1.6-05):** `client_call.json` also pins the keys of each answer and of a result row; the SQL checks the
  real answers; the UI test drives each send and registration error and checks its own message. Read and delete errors
  are still checked only in the SQL.
- **The deploy check's diagnoses (R2.6-04, R1.6-09, R3.6-13):** one message when the health check doesn't answer (down,
  paused, key changed, not migrated); equal, ahead and behind say different things; a stalled body is caught; `overdue`
  and `cron` are warnings; `skip_db_check` needs a reason; probe time-outs aren't reported as a security failure; the
  probe key is random each run; the top-of-hour wait starts at minute 55.
- **The live-site check (R2.6-07, R3.6-08):** the new version first, then the 404 checks, so they test this deployment.
- **The WebKit job (R1.6-10):** tests run without a token that can push; a separate job with no project code saves
  `webkit.txt`.
- **`run.sh` (R2.6-06, R1.6-12):** the self-recorded-name check catches an empty table; the newer-migration refusal must
  give its own message; the baseline's refusal is checked without ON_ERROR_STOP; the folder is private; `privacy_test.sql`
  compares with the newest file.
- **Names (R3.6-10, R5.6-08, R5.6-06, R1.6-06):** both sides refuse invisible characters (except a joiner between letters,
  for Persian and Sinhala), enclosing marks, full-width forms, and words that start with a mark; both accept middle dots
  and the Hebrew geresh. `tools/name_ranges.py` makes the server's Unicode lists (`--check` compares). A letter newer than
  the server's Unicode is refused by the server, and the game now says so plainly. Repeated names are compared after
  NFKC. A lookalike in another script (Cyrillic е) still counts as a different name: anyone can send under any name.
- **Codes on the projector (R5.6-03, R4.6-04, R5.5-07, R4.5-08, R1.6-08):** the shift buttons are off while a code is
  being made; a shift tapped while a code is on screen asks first; Set up results works in its own row and leaves the
  screen alone; codes never shown are never listed; a new code is never one this device already holds (R3.6-11).
- **When a class ends (R5.6-04, R4.6-09, R3.6-12, R5.5-05):** the device keeps when the server made the class and when it
  ends; each saved code says "results until …"; one whose class has ended is marked and offers Turn results back on; a
  code made before a release offers no Set up results (R5.6-09). The server returns when the class was made, and a class
  that ended but isn't deleted yet starts afresh.
- **The results list (R4.6-03, R5.6-05, R4.6-08, R6.6-01 to -10, -12, -14):** each ✕ sits beside its name again; repeated
  names say "1 of 2 under this name" on both rows; the attending's row shows their own patients and how many died,
  diagnoses, unsafe orders and how many caused harm, radio calls right out of those offered; "department:" in full;
  "door-to-provider wait"; "fired (legal risk)"; an ended-early row says when it ended and that its numbers cover only
  the part played; a charge nurse's row shows arrivals, left against advice and bedded before registration. The export
  has all of these, including missed radio calls (R6.6-03, R4.6-05). The note says a repeated name may be another student.
- **New numbers (migration):** the attending's own deaths, contraindicated drugs ordered and unneeded risky treatments
  ordered (the unsafe orders, whatever the dice did next), and the minute an early-ended shift stopped. `scen` is no
  longer sent (the code names it).
- **The student's summary:** "Unsafe orders" and "Complications from those orders" replace "Patients hurt by an order"
  (R6.6-02); a fired attending's Staff card no longer says the staff walked out (R6.6-05); an attending who saw no
  patients is told so (R6.6-09); the clinician line sits under the header, not below the buttons (R6.6-13).
- **The Send box (R4.6-07, R2.6-08, R6.6-07):** it says what the score is and lists what is sent, and points to About.
  After a refusal the caret is at the end of the name and the box is marked invalid (R4.6-02); focus comes back only if
  the student hasn't moved on. Name refusals say why (too long, numbers, too many words).
- **Errors in view (R5.5-02, R4.5-05, R5.5-06):** a failed delete says "Nothing was deleted" next to the list and
  scrolls to it; Results scrolls its header to the top; "Loading…" scrolls into view; Delete all's confirm scrolls into
  view; a refused Refresh keeps the list.
- **Paste (R5.6-07):** Copy key's whole line pasted into either box fills both.
- **Escape (R4.6-10)** answers an open question "no" before it closes the sheet; reopening clears a confirm.
- **Privacy text (R4.5-09, R2.6-08, R6.5-03):** About's Privacy is a short list with key words in bold; "walkouts" is
  gone; Supabase's log retention is stated; the registration box names the developer; the saved-codes note says to delete
  downloaded results on a shared computer. The make box carries the not-for-grading note (R6.6-16).
- **Speed (R1.6-07):** a list's rows are worked out once per answer, and dates use two shared formatters.
- **Small:** the name box is 44 px tall; the stats column takes every key
  at its largest (R3.6-13); `fast` is at most 100; a spreadsheet guard for a leading tab or full-width `＝`; the old
  zero-argument `cb_health()` is dropped; documentation fixes in CLAUDE.md, both READMEs, the migration comments and the
  contract's description (R1.6-11, R2.6-05).

## Partly fixed, or left, with the reason

- **The live migration was applied before CI ever ran it (R2.6-02).** The order in the runbook is right for a release
  (database first, then the game); the gap was that no CI had run on Phase 2 yet. The merge into `3d` runs it, before
  the round-6 migration goes live.
- **Read and delete error messages** are checked by the SQL and by hand, not driven in the UI test (R1.6-05).
- **The deploy can't see a gateway that gives every caller one shared public address (R3.6-09);** it checks the address
  is public and that forged headers still hit the limit.
- **The CSV's caveat stays in its first row (R5.6-10):** Reviewer 6 asked for it there in round 5; a spreadsheet's import
  can skip the first two rows.
- **The HUD is a few pixels wider than a 360 or 390 px phone (R4.6-12, pre-existing).** Clipping or shrinking the
  five numbers cut "100%" in play; it needs the HUD's layout reworked (Phase 5).
- **Moved:** the attending's scoring (Phase 6), the UI's ad-hoc state (Phase 5), the sheet's close button overlapping
  text on a projector (Phase 5 layout).
