# Round 5: what was fixed (Nov 24, 2026)

Round 5 reviewed the round-4 fixes to Phase 2 at `7cb5613` (the six auditors; the owner was asked whether the three
"I HATE this project" reviewers should run again, and they didn't this round). The fixes are the commits after the
reports ("typing in a sheet box keeps focus" and "Phase 2, round-5 review fixes").

## Fixed

- **Keys lost on day 7 (R1.5-01, R2.5-02, R3.5-01, R4.5-02, R5.5-01, R6.5-02).** A device keeps a key 30 days from when its
  code was made, the longest a class can live; the server says when the class really ends. The UI test now answers
  registration with the real 14-day expiry and checks a 20-day-old key is still listed.
- **The deploy gate (R1.5-02, R2.5-01, R2.5-03, R3.5-05, R3.5-12).** The live database may be ahead of the game (a
  rollback passes). A run that hits the hourly limit says so and when to re-run; an unreachable Supabase says so. The
  forged-header probe has its own bucket (`cb_health(true)`, 30 an hour) and waits out the top of the hour. A manual
  Deploy run can tick `skip_db_check` in an emergency. `cb_health` also reports whether the caller's address is public
  (R2.5-04).
- **Migrations (R1.5-04, R2.5-05, R1.5-07, R1.5-11).** A migration refuses to run over a newer one; `run.sh` checks that
  the latest one records its own name and that the refusal works; the baseline runs in one transaction, so its guard
  stops everything in any client; the fresh-project check covers every function.
- **Storage backstops (R3.5-02):** about 100,000 classes and 300,000 results, well under the free plan's 500 MB; past
  them the answer is `full`, not the caller's network.
- **A taken code is never shown (R3.5-03),** and "Try again" works for busy and full registrations (R4.5-10).
- **Live codes no longer leak (R3.5-10):** a version mismatch answers `unknown`. `taken` on registration stays: it is
  needed, and a stranger still can't read anything with it.
- **Raw addresses in `caseroom.cb_hits` are deleted (R3.5-11).**
- **Names (R3.5-06, R1.4-16):** both sides now take a letter, then letters with their marks in any script (Hindi,
  Bengali, Tamil, Thai, Arabic, Hebrew with points), and refuse every Unicode number (Nd, Nl, No, generated from the
  Unicode tables), fillers, and circled, squared and math letters. The contract file's accept and refuse lists are
  checked against both.
- **The contract (R1.5-05):** `client_call.json` now also lists every error each function can give; the SQL test checks
  the functions give exactly those, and the UI test checks the game has a message for each.
- **Typing (R4.5-01):** a box being typed in is no longer replaced by the redraw (this also fixes the student's "Play a
  code" box, broken since v0.20).
- **Deleting (R4.5-03, R5.5-02):** the confirm shows in the row (or by "Delete all"), names the result's score and time,
  and ignores a double tap.
- **Shared computers (R4.5-04, R5.5-03, R4.5-07, R5.5-08):** reopening Class code hides any key left showing and drops
  results opened with a key the device wasn't asked to keep; Forget is a small link with a confirm that says the results
  become unreachable, and it also clears the code just made; Copy key copies the code with the key; Close results.
- **Unconfirmed registrations (R5.5-04, R1.5-06):** a saved code whose registration never confirmed says so and offers
  Set up results.
- **Results open in view (R4.5-05, R5.5-06),** and the open code is marked.
- **The list (R6.5-01, -03, -04, -07, -08, R5.5-10, R6.5-12):** in the order results arrived, unranked, with a second
  result under the same name marked; the attending's own numbers (patients seen, diagnoses, harm, radio calls) first, and
  the department's wait, walkouts and deaths labelled as the department's; "staff walked out" is no longer called
  "fired"; the "Not for grading" note also says no licensed clinician has reviewed the content, and for an attending says
  what the score mostly reflects.
- **Exports (R6.5-06, R2.5-07, R3.5-09, R1.5-10):** both carry the caveats in their first row, have no rank, and share
  one formula guard.
- **The student (R2.5-06, R3.5-04, R5.4-09, R6.5-05, R3.5-07, R3.5-08, R6.5-11):** the name box is emptied after a send
  and when a new shift starts; focus comes back after a server refusal; memory wins over storage, so a resend after a
  storage failure is the same result; the Send box lists what goes out; leaving unsent shows the warning in the Send box.
- **Wording (R6.5-09, -10, R2.5-07):** the instructor box says the developer can see the database; About says "patients
  who came in", that instructors can copy or download results, that the time sent is stored, and that Supabase's own
  logs keep addresses for the short time it sets; the summary ends with the clinician-review line (R6.5-08).
- **Toasts (R4.5-06):** menus and the summary get full-width toasts; the narrow strip is for a shift in progress.
- **CI and deploy (R2.5-08, R2.5-09, R2.5-10, R2.5-11):** `pages: write` and `id-token: write` only on the deploy job;
  the build, deploy and rules jobs have 30-minute limits; the 404 checks run first; the class test's server checks wait
  for the request instead of a fixed sleep; CLAUDE.md's release and rollback steps include the database.

## Partly fixed, or left, with the reason

- **"Database first" means an outage of class results between applying the migration and the deploy (R1.5-03).** The old
  endpoints are the privacy hole this phase closes; keeping them would keep the hole. The gate is on and nobody uses
  class results yet. `supabase/README.md` says so.
- **Drift by hand edits (R1.5-04, part):** `cb_health` names the newest recorded migration; a hand edit in the SQL editor
  that records nothing would not show. Comparing function bodies against the repo is a later improvement.
- **The attending's scoring (R6.5-01's root, R6.4-09):** an owner decision for Phase 6. The list no longer ranks by it.
- **A privacy contact (R2.4-01):** waits for the owner (`src/backend.json`, `contact`).
- **Unsent results after a second tap (R5.4-10):** leaving twice is a choice; the summary keeps one report.
- **Stored-format versions (R1.5-09)** and the UI's ad-hoc state (R1.4-18): Phase 5.
