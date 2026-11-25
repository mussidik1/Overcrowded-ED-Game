# Round 8: what was fixed (Nov 25, 2026)

Round 8 reviewed the round-7 fixes. Reviewers 1 to 4 read `87c9c13`; reviewers 5 and 6 read `32dbdae`, after the first
round-8 fixes. Every Critical, High and Medium finding was re-run by a second, independent agent before it was fixed; all
of them reproduced. The second migration is still unapplied, so its round-8 fixes went into it directly. The fixes are the
commits "round-8 fixes from reviewers 1 and 2", "… 3 and 4", and "… 5 and 6".

## Needs the owner

- **The GitHub checks first.** The Tests workflow, its PostgreSQL 17 database job included, must be green on `3d` at the
  commit to be released (no Phase 2 commit has run on GitHub yet). Merging this branch into `3d` runs them.
- **Then apply the second migration** (`20261125120000_codeblack_round6.sql`), pasted from that green commit, add its
  SHA-256 to `supabase/migrations/applied.sha256` and commit. The deploy now also checks the live functions' fingerprint
  against `supabase/tests/fingerprint.txt`, so a stale or edited paste can't pass (R1.8-01).
- Unchanged: radio calls on their own stream (R6.6-01), the privacy contact, the attending's scoring (Phase 6).

## Fixed

- **The other-device form was wider than its card on phones held upright (R4.8-01, High).** One grid rule; `class_test`
  checks it at 390x844 and 360x640.
- **A stale draft of the migration could pass the deploy (R1.8-01).** `codeblack.fingerprint()` (an md5 of the functions'
  signatures, bodies without whitespace, settings and owner rights), returned by `cb_health`, checked by `run.sh` against a
  fresh project and the migrated baseline, and by `db_live.js` against the live project.
- **Results could go to whoever registers a code first (R3.8-01, R5.8-01).** "Use it without results" is offered when the
  server can't be reached, or when class results are full (then nobody can register a code). Not for busy, which a
  student can cause; the busy message now says to make the code on mobile data instead. The off text says plainly that
  until results are set up, whoever registers the code first gets what students send. In the migration, invalid calls
  are refused before they count against a network's limits, and a code another key holds answers "taken" before "full".
- **Held codes (R3.8-02, R1.8-04, R5.8-02).** Every ended class's code is held 30 days with only its key's hash, so a
  planned code posted ahead can't be taken over; held codes don't count toward the storage backstop; `overdue` is
  counted from indexes and probes results only for classes that got some; `cb_health` has a per-/48 limit. The device
  keeps a key 60 days (the class's life, then the hold), and a class past its end says "class ended" with Turn results
  back on (R5.8-04).
- **Deaths the summary missed (R6.8-01, R5.8-03).** The dead still in the department at the end count whenever the patient
  arrived (an own patient from before 07:00 included, and the death that fires the attending); a death before 07:00
  belongs to the night shift. An own patient still in an unrun arrest at the end gets an M&M line, the no-team penalty and
  legal risk, and is counted and sent (`mdArrestOpen`).
- **Panel and row disagreed (R1.8-03, R4.8-03),** a refused name sent again showed nothing (R4.8-02), the focus hand-off
  jumped to another button (R1.8-02).
- **The summary's words (R5.8-05, R6.8-05, R6.8-07, R6.8-03, R6.8-04):** no "numbers were good" or "Attending of the year"
  when an own patient died or there are calls to review; the fired verdict points to "What raised your legal risk"; the
  ledger says "Unsafe orders, complications and untreated patients"; the order review names each contraindicated drug and
  why.
- **Names (R5.8-07):** the Taiwanese middle dot (U+2027), the Hebrew maqaf and a Bengali joiner before the virama.
- **Smaller:** a caution that results show every name and score (R5.8-06); the replace question sits under the code;
  older codes keep their description; a refused delete at the class's end marks it ended; a taken row offers no Turn
  results back on (R5.8-09); `rules13.js` covers a patient from before 07:00, the firing death, a real other doctor's
  patient, the unrun arrest and the complications count (R6.8-06); the deploy's `deploy.txt` marker is checked first
  (R2.8-02); `!cancelled()`; env-passed ref names; the PGDG check and a Python 3.13 `name_ranges.py --check` in CI; the
  daily watch opens an issue on failure (R1.8-06); `build.js` escapes `<` in image credits; docs and runbook corrected
  (R1.8-07, R2.8-01, R2.8-03, R6.8-08).

## Partly fixed, or left, with the reason

- **R4.8-02's severity** was judged lower by its verifier; fixed anyway.
- **A real attending's payload in `class_test.py` (R6.7-07, R6.8-06):** still a hand-written row; the engine side is now
  covered by `rules13.js`, and `cbArgs` reads the report's fields.
- **Not counting `taken` answers against the limit (R5.8-01, optional):** left, so codes can't be probed for free.
- **The gate shows "Can't reach the server" when its functions fail (R2.7-02):** the gate's designed behaviour until
  launch (hardening it was rejected; it goes at launch).
- **Bullets (U+2022, U+2219) and full-width dots in names (R5.8-07):** still refused; they aren't name characters.
- **The Send box on a sideways phone starts below the first screen (R5.8-09):** the summary's layout is Phase 5.
- **Earlier STATUS files** overclaimed in places (R5.8-08, R6.8-02); this file is the correction: R5.7-03's round-7 fix
  was narrowed by R3.8-01 and widened again here for `full`; R5.7-04 (Forget and the clipboard) holds only for a key
  copied in the same page load; R6.7-01 and R6.7-07 were only partly fixed until this round.
