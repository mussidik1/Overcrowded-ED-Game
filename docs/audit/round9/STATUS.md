# Round 9: what was fixed (Nov 25, 2026)

Round 9 reviewed the round-8 fixes at `ba471b7`. Every Critical, High and Medium finding was re-run by a second,
independent agent before it was fixed; all of them reproduced. The second migration is still unapplied, so its round-9
fixes went into it directly, and `supabase/tests/fingerprint.json` was regenerated from it. The fixes are in the commit
"round-9 fixes".

## Needs the owner

- **The GitHub checks first.** The Tests workflow, its PostgreSQL 17 database job included, must be green on `3d` at the
  commit to be released. No Phase 2 commit has run on GitHub yet, and this container can't install PostgreSQL 17, so the
  first PostgreSQL 17 run of the fingerprint is on GitHub. If it differs from 16's, `run.sh` prints the replacement file.
- **Then apply the second migration** (`20261125120000_codeblack_round6.sql`), pasted from that green commit. Check that
  `select public.cb_health();` shows its name and the `fp` in `supabase/tests/fingerprint.json`, then add its SHA-256 to
  `supabase/migrations/applied.sha256` and commit.
- **A read-only look at the live project (Nov 25)** found PostgreSQL 17.12, an en_US.UTF-8 collation, no default
  privileges outside `public`, and the same grants on the existing functions and tables as the local copy. Nothing was
  changed.
- Unchanged: radio calls on their own stream (R6.6-01), the privacy contact (on hold), the attending's scoring (Phase 6).

## Fixed

- **Required drugs were filed under "Also reasonable" (R6.9-01, High).** A drug that is part of a required combination
  (aspirin in STEMI and NSTEMI, ceftriaxone and vancomycin in meningitis, lorazepam in status epilepticus) is no longer
  counted as an optional add-on, and the "pick at least one order" check knows it. `rules10.js` checks every case, in both
  orders; it fails on the old engine.
- **A lost code read as the student's failure (R6.9-03).** The engine tells a code the attending ran (`codeLost`) from
  a death with no code. A lost code goes to the M&M only if a rhythm check was wrong or the team took more than 3
  minutes. The verdict's negative line is only for deaths without a code and unrun arrests; a lost code alone reads
  "You ran the code and lost a patient: many arrests don't come back, even when the code is run well." The list, the CSV
  and the summary say how many deaths came after a code the student ran, and the game sends it (`mdCodeLost`, in the
  migration and `client_call.json`).
- **The end-of-shift arrest penalty (R6.9-02, R5.9-02, R5.9-03).** It applies only to an own arrest at least 5 minutes
  old, and not when the shift ended early. A fired attending gets no legal-risk reason after the firing. Legal risk added
  at the end brings no firing, call or card after the shift, and the summary names the stage the player reached
  (`litStage`), so a shift that ran to the end no longer reads "Fired".
- **A contraindicated drug scored a "clean" order set (R1.9-01).** It no longer earns the +10 or counts as clean.
  `rules13.js` compares the textbook set with the same set plus ibuprofen.
- **The fingerprint (R1.9-02, R2.9-01, R2.9-02, R3.9-03, R2.9-05e).** `codeblack.fingerprint_parts()` gives one md5 per
  object: each function (body, settings, rights, strictness, volatility, return type, arguments, defaults, grants), each
  table (columns, defaults, row-level security, constraints, indexes, grants) and the clean-up job; `fingerprint()` is the
  md5 over all of them. Every list is sorted in the C collation: the local cluster is en_US, like live, and adding the
  collation changed the tables' value, so the sort had depended on the locale. `run.sh` now builds the fresh project in
  the C locale and requires the same fingerprint as the en_US one. A function body's whitespace runs count as one space,
  so a changed string can't pass but a re-indented paste can. On a mismatch `run.sh` names the objects that differ and
  prints the new file, and the runbook says how to diagnose a live mismatch (`fingerprint_parts()` in the SQL editor) and
  what fixes each kind.
- **Held codes had no cap or monitor (R3.9-01).** At most 30,000 held; past that the oldest are released early.
  `cb_health` reports `held`; the deploy warns and the daily watch fails at about half.
- **A planned code stopped at 14 days (R5.9-01).** A student's first result during the 30-day hold starts an unused
  class again, for 30 days, so a code made ahead works up to 44 days after it was made. The code panel says so.
- **The ended-class row (R1.9-06, R3.9-05, R4.9-05, R5.9-04).** A class that had results and ended says "class ended:
  results deleted <date>" with Turn results back on. An unused class past its end says it ended with no results unless a
  student has sent one since, with Results to check. Past the hold it says when the code was released. A row the server
  said another class has keeps saying so after the sheet is reopened.
- **Orders to review hid unsafe drugs after 12 entries (R4.9-01).** Entries with an unsafe drug come first and are never
  cut off. An unsafe drug ordered after a pulse came back now reaches the review too (R6.9-07).
- **The shown key didn't fit at 390 and 360 (R4.9-02).** On an upright phone the key box takes the whole width and Show
  goes under it. `class_test` checks a 19-character key of W's at both widths.
- **Keyboard and screen readers in the class sheet (R4.9-03).** The sheet is named after its heading, takes the focus when
  it opens (in a shift, only when opened from the keyboard), keeps Tab inside it on the menus, and gives the focus back to
  the button that opened it. A focused button that disappears hands the focus to the control now in its place. A code
  made on another device puts the focus in the Class code box. `class_test` checks each.
- **Panel and row split again (R1.9-03).** Whichever answer says "on" first drops the other's late answer and clears its
  old refusal.
- **"Use it without results" for errors others can cause (R3.9-02).** Offered only when the server can't be reached (no
  answer, or none in time) or is full; a 429 reads as busy, and a 503 or other status as a server error, with Try again.
- **Junk sends spent a campus's limit (R5.9-05).** `cb_submit` validates before it counts, as `cb_class_new` does.
- **Round 8's server branches had no tests (R1.9-04, R2.9-04).** `privacy_test.sql` fills 100,001 live classes and some
  held ones: a new code is full; a live or held code under another key is "taken"; the own key's retry and turning a
  held class back on work; `cb_health` reports the classes full and held codes not; under 100,000 a new code works; a /48
  over the health limit is refused. Also: 700 junk sends don't block a real one.
- **Smaller:** the verdicts are built from what happened and name the sections to read (R4.9-07, R6.9-04, R6.9-08); a
  walkout's empty M&M no longer points to the legal box (R4.9-08); the legal box's summary is a 44 px target (R4.9-09);
  the row of the code on screen has no second Show key (R4.9-10); only a refused name marks the name box invalid, and a
  network or server failure stays until the next Send (R4.9-11); a refused delete at the class's end says the server
  deleted the results, hides ✕ and Delete all, and an `invalid` answer has its own message (R4.9-04); the busy hint says
  to try again on mobile data, same code and key (R4.9-06), in the row too; the Send box and About list every number
  sent, including arrests left at the end and deaths after a code (R2.9-03, R6.9-06); `rules13.js` checks a real death
  of another doctor's patient, a bounded complications count, the end-of-shift legal step and an unsafe drug after a
  pulse comes back (R1.9-05, R6.9-05); the daily watch keeps one open issue and comments on it, runs its issue step in a
  job of its own, and fails rather than times out (R2.9-05c); the emergency skip runs before any file is read
  (R2.9-05g); the runbook's step 3 compares `fp` (R2.9-05f); docs corrected (R1.9-06, R2.9-05b, R3.9-06.3, R3.9-06.4).

## Partly fixed, or left, with the reason

- **`full` still offers "Use it without results" (R3.9-02):** once a slot frees up, whoever registers the code first gets
  what students send. The off text tells the instructor to ask students not to Send. The robust fix is a results-off
  code (R3.8-01's option 4), left for a later release.
- **`overdue` and registration at the backstops (R3.9-04):** measured at 37 to 48 ms with 300,000 results. The rate
  limits cap the calls; left.
- **A live write probe in `db_live.js` (R2.9-01, optional):** it would need a fixed class row on the live project, which
  is a database change for the owner to decide.
- **Validation before limits holds only for malformed calls (R3.9-06.2):** a well-formed code is valid by format alone,
  so a classmate can still spend a network's code limit with real-looking codes.
- **The verdict names counts, not patients (R4.9-07):** "One of your own patients died" with the M&M below naming them.
- **The in-shift "Your call" card doesn't list the unsafe drug (R6.9-08):** the summary's Orders to review does.
- **"Died" and "Arrivals" don't share a base (R6.9-08, R1.9-07):** a patient who arrived before 07:00 and died on shift
  counts in one and not the other. Left as designed: deaths on the shift are the shift's.
- **The database's `harm` still means unsafe drugs plus complications (R6.9-08):** only the UI subtracts `contra`.
- **Not changed from earlier rounds:** R1.8-08's leftovers (R1.9-07), the replace question's scroll (R5.9-07), Copy key
  copying code and key together (R3.9-06.10).
- **Earlier STATUS files** overclaimed (R5.9-06, R6.9-04, R6.9-05, R1.9-06). Corrections: round 8's "a planned code
  posted ahead can't be taken over" was false after day 44 (now a planned code is held and revived as above); "invalid
  calls are refused before they count" was true only for `cb_class_new` until this round; "a class past its end says
  class ended with Turn results back on" and "a taken row offers no Turn results back on" held only until this round's
  row fix; "no 'numbers were good' when there are calls to review" and "rules13.js covers a real other doctor's patient
  and the complications count" were not true until this round.
