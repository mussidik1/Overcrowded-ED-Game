# Round 4: what was fixed (Nov 24, 2026)

Round 4 reviewed Phase 2 (private class results, v0.31.0) at `ce11887`: the six auditors' reports are in this folder, and the
owner's three "I HATE this project" reviewers ran alongside them. The fixes are the commit after this file's predecessors
("Phase 2, round-4 review fixes"). Items deferred or waived in `docs/audit/round2/STATUS.md` and `round3/STATUS.md` stay
deferred or waived.

## Needs the owner

- **A privacy contact (R2.4-01, R3.4-17, R6.4-10).** The About page now says who runs the database and who can read results,
  but it names no contact for deletion requests: CLAUDE.md bars publishing the owner's email without his approval. Put an
  address in `src/backend.json` (`contact`) and rebuild; the About page shows it. Until then the route is the instructor,
  who can delete any result.
- **The attending's score (R6.4-01, R6.4-09, and the first hostile review).** An attending who sees no patients still gets
  68 to 94 and two or three stars, because three of the four scores measure the department the computer runs. Phase 2 makes
  the class list honest about it (diagnoses right and wrong, "fired", "dept. wait", "Not for grading"), but the scoring is
  a game-design decision for Phase 6.
- **Applying the migration** (`supabase/migrations/20261124120000_codeblack_private_results.sql`) before v0.31.0 is merged into
  `main`. The deploy now refuses to publish until the live database has it.

## Fixed

- **Database (R3.4-01, -02, -04, -07, -08, -12, -13, -14, -19, R1.4-03, -04, -05, -06, -09, -13, -16, R2.4-03, -04, -05,
  -07):** per-network counters with one row per hour (refusals past the limit write nothing); no global caps that strangers
  can fill (storage backstops at about 300,000 classes and 1,000,000 results); unused codes last 7 days; the key is made by
  the game, so registering is safe to repeat; stats rebuilt from known keys as whole numbers (the 0e-16383 trick is gone);
  argument sizes checked first; an advisory lock per class; names normalized, three words, no digits in any script or
  invisible fillers; a result's version must match its class's; addresses parsed and canonicalized, IPv6 by /56, salt
  rotated daily; deletes by the result's own id (no global sequence), "all" explicit; the migration records itself;
  `cb_health` for the deploy; the baseline moved out of `migrations/`, refuses to run on a migrated database, and no longer
  overwrites Case Room's `client_ip()`; search path `pg_catalog, pg_temp`; the guard locks the old table.
- **The game (R3.4-03, -09, -10, -11, -15, -18, R4.4-01 to -15, R5.4-01 to -06, -09, -10, -12 to -15, R6.4-02 to -08
  (round 5 rated six of those seven only partly fixed; see round5/STATUS.md), -11, -12, -14, R1.4-08, -10, -14):** the key is hidden until Show key; Class results lists every saved code with
  Results, Show key, Copy key and Forget; a typed key is kept only if asked; any well-formed code opens with its key,
  whatever its version; the code shows only after registration, so it never changes in front of a class; the results are a
  list with the delete button on the left (the sheet's close button sits over the right edge when it scrolls), a confirm
  bar away from the finger that ignores a double tap, deletes in place without a reload, Copy table and Download CSV (no
  cell can run as a formula); "Not for grading" with the reasons; deaths, firing, sped-up play and the attending's
  diagnoses shown; the Send box says what is sent, takes Enter, keeps focus, never stores the name, works when storage is
  blocked, and the game asks before you leave an unsent summary; error messages say whether it was the network, a timeout
  or the server; `copyText` reports success only when the copy worked; a broken `oc-ckeys` entry is ignored; stored formats
  carry a version; the Privacy text lists everything sent and says the developer can see the database; About and Lessons say
  no licensed clinician has reviewed the content; the summary's speed breakdown includes 3×.
- **Tests, CI and deploy (R1.4-01, -02, -11, -12, R2.4-02, -06, -08, -09, -10, R3.4-16, -21, -22):**
  `supabase/tests/client_call.json` pins the calls, checked by both the SQL tests and `class_test.py`; the SQL tests also
  check the refusal with rows in the old table, the baseline's refusal, a fresh project, number formats and unicode names
  (about 150 checks); CI runs them on PostgreSQL 17 as live; the address, key and contact live in `src/backend.json`; the
  deploy checks the live database **before** publishing (latest migration, clean-up scheduled, nothing overdue, addresses
  read, forged headers still limited, the old table gone for reads and writes); `audit_shots.py` and `class_test.py` can't
  reach a real server; `run.sh` keeps its evidence on failure and runs on bash 3.2; job permissions are read-only except the
  WebKit results upload; CI moved to Node 22; the live-site check has time limits.

## Partly fixed, with the reason

- **One person with the code can still fill a class (R3.4-05, R5.4-08):** the cap is 500 and deletes with the key aren't
  limited, but a sender with the code and a few networks can add made-up results. Telling a real student from a troll
  needs accounts, which the game doesn't have. The list says so ("Not for grading").
- **Per-network limits on a campus (R3.4-06, R5.4-06, R1.4-07):** limits are now 60 codes, 600 results and 300 reads an
  hour per network, and refusals stop counting at the limit. Every shift tapped still registers a code (the code has to be
  registered before it is shown, so it never changes in front of a class).
- **Whose address (R3.4-07):** the order of headers is unchanged, but the deploy now proves on the live project that an
  address is read and that forged headers don't get round the limit.
- **Concurrency tests (R3.4-21):** the cap holds by an advisory lock and atomic counters; there is no pgbench test.
- **UI state and screen-reader details (R1.4-18, R4.4-16, R4.4-17):** stale answers are dropped for every call; `U` still
  grows ad-hoc fields (Phase 5).
- **Case Room coupling (R1.4-15):** Code Black no longer uses Case Room's helpers; `caseroom.cb_hits` stays because
  `caseroom.tidy()` cleans it. A project of its own stays an owner decision.

## Moved, with the reason

- **R3.2-07, the cheat surface on `window.OC` (R3.4-20, R5.4-07):** listed for Phase 2 in round 2. Removing `OC` from the
  page breaks every UI test, and a score computed in the browser can always be changed there. Phase 2 makes the results
  honest about it instead ("Not for grading"). Moved to Phase 5, where the module work decides what the page exposes.
- **From the hostile reviews, outside Phase 2:** the crash guard (R1-04, Phase 4), save versioning (Phase 4), CI on every
  branch and the deploy waiting for the UI and WebKit jobs (Phase 4), class codes going stale with each release and
  events drifting on one code (R1.2-03, Phase 4/5), minifying the page and the service worker's network timeout (Phase 4),
  the two Dr. Okafors (R5-22, Phase 7), the dead star scale (Phase 5).
- **Hardening the gate:** rejected by the owner (it is deleted at launch). The fail-open paths the reviews name are the
  gate's designed offline behaviour.
