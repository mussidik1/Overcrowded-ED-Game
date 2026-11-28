# CTO memo (Stage 17), v0.33.0

**Candidate:** `3d` at `1f79199`. It has the same tree as `5adcb9f`, the current checkout. Replaces v0.32.0 (`origin/main` at `78916ef`).

## Decision

- **Testers, behind the gate: GO WITH CONDITIONS.** The conditions are below.
- **Real students: NO-GO.** Three things block it:
  - No licensed clinician has reviewed the clinical content (F-034, still Partly).
  - The last QA round (round 7) failed Product depth (6 of 7) and Visual design (6 of 7), and no QA round has graded the round-13 fixes since.
  - The owner hasn't signed off F-136 to F-144.
- The gate stays on.

## Evidence I checked myself

- **`npm test`:** exit 0, 800 "ok" lines, 0 FAIL. That covers rules.js to rules15.js and golden.js.
- **`npm run lint`:** clean.
- **Clean rebuild:** I extracted `1f79199` with `git archive` into the scratchpad (`cto/`, node_modules symlinked) and ran `npm run build`. `index.html`, `sw.js` and `3d/map3d.js` are byte-identical to the committed files.
- **`npm run stress`** (188 shifts): exit 0, vitals in range in every run, no stuck states. Five attending autopilot runs ended FIRED. These are bot outcomes, not errors.
- **Database:** `git diff 78916ef 1f79199 -- supabase/` is empty. No new migration, so no database step. The live fingerprint check is unchanged.
- **Merge:** `git merge-tree 78916ef 1f79199` merges with no conflicts. The result is exactly the `3d` tree (`f780489`). `package.json` is 0.33.0 and `PAST_V = ['0.32.0']`.
- **My own Node probe of the Critical and High fixes.** I used 5 new seeds per level (101, 2027, 4441, 9001, 31337), none of the seeds rules15 uses:
  - **Stars (R1.13-03, R5.13-02/05):** idle and radio-only attendings earned 0 stars in 40 of 40 shifts across easy, med, hard and rush. An engaged autopilot earned 2 to 3 stars, seeing 42 to 50 patients on a full shift and 7 to 9 in the Rush.
  - **Handed patients (R5.13-04):** idle shifts had 59, 71 and 19 handed patients on med, hard and rush. Of those, 49, 56 and 10 got visibly worse, and 49, 50 and 9 moved to another doctor. Easy hands over none, by design.
  - **MTP (R6.13-01):** 0 toasts containing "hemorrhagic shock", "massive transfusion" or "MTP" across 20 idle attending shifts. In the code, `mtpHid` (ui.js:100) hides the MTP tag, chip, button and "Hemorrhage" line until `dxK` or `bb` is set.
  - **Crash guard (R1.13-02):** `save()` returns when `crashed` is set (ui.js:3017). That also covers pagehide, which goes through `save()`.
  - **Diagnosis in the log (R5.13-01):** on the attending's own patient, the log line now reads "results are in. Your call" (engine.js:3290).
  - **Handed patient can't be seen (R1.13-01), and an uncalled diagnosis (R5.13-03):** both pass in rules15, inside the green `npm test`.
- **CI:** Tests passed on `3d` at `6e55b05`. The run at `1f79199` (46089447487) was still in progress when I checked.

## Conditions before the merge into `main`

1. The Tests workflow is green on `3d` at exactly `1f79199`. Run 46089447487 was in progress.
2. The owner runs `docs/SMOKE.md` on a phone (Stage 15b). That means at least one iPhone in Safari, the Class code section on two devices, the 3D floor, and the sideways list board (R4.13-01). It has not been run for v0.33.0.
3. The owner signs off F-136 to F-144 by ID, in writing (he said to hold them). F-136, slurs accepted as initials in class results, needs an explicit decision because instructors will see them.
4. The owner decides on drift item #1. An incoming alert still shows its type ("SEPSIS", "STEMI") to the attending before any workup. The docs were narrowed to "doesn't count as the diagnosis", but the drift check called this the owner's call, and it hasn't been made.
5. Update the release paperwork:
   - `spec/FINDINGS.md`: F-134 and F-135 still read "Open" but round 13 fixed them. Mark them Fixed and add the round-13 items.
   - `spec/RELEASE.md` and `spec/STATUS.md`: write the v0.33.0 notes and record this memo.
6. Optional but recommended: no fresh agent has re-reviewed the code fixes and the 30/24/18 star caps added after the reviewed commit (895bc15). Either the owner counts them as bug fixes, or a short targeted R5/R6 recheck runs.

## Top 3 risks after release

1. **Grading feels unfair or misleads a debrief.**
   - The new star caps (30/24/18 patients, Rush 5/4/3) and the unseen-patient penalties may be harsh. My engaged autopilot reached the caps easily, but a real phone player on hard may not.
   - Open balance items R5.13-06 to R5.13-11 and F-143 add to this.
   - **Detection:** testers' feedback, and class results in Supabase showing clusters of 0 to 1 stars.
   - **Fix:** fix forward with a new version. Tuning needs no migration.
2. **Safari or iPhone engine regressions, and the sideways layouts.**
   - The list board and crash card changed. 70 of 97 sideways floor targets were under 44 px in round 7 (F-137, R4.13-06/07, still open).
   - **Detection:** the WebKit CI job on the push to `main` (`ci-results:webkit.txt`), plus the testers.
   - **Rollback:** `git revert -m 1 <merge>` on `main` and push. The deploy republishes v0.32.0. No database step.
3. **Moderation of class results** (F-136, slurs and names as initials).
   - **Detection:** an instructor's report.
   - **Mitigation:** the instructor deletes the result (`cb_class_delete`). The server-side name rule needs a new migration, which needs the owner's approval.

## Open findings

- **No open Critical or High from round 13.** Every one I spot-checked is fixed in the code.
- **Waiting on the owner:**
  - F-034: no clinician review (High, Partly).
  - F-035, F-036: accepted at v0.31.0.
  - F-136 to F-144: held, not yet signed off.
- **Open Mediums from round 13:**
  - R4.13-06/07: tap targets and 12 px text on the maps.
  - R4.13-08: two floating counters on the list board.
  - R5.13-06 to R5.13-11: grading balance.
  - R6.13-03, R6.13-06, R6.13-07: wording, case mix, gray-zone grading.
  - R2.13-03: events_test flake.
  - R2.13-04: lint rules for the engine.
  - Drift #1: the alert type shows to the attending.
- **QA:** the round-7 FAIL stands (Product depth 6 of 7, Visual design 6 of 7). The round-13 fixes target its High (QA7-1) and QA7-2, but nobody has re-graded them.

I wrote nothing into the repo. Scratch files: `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/cto` (the rebuild and `stress.log`) and `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/probe/p1.js` (the probe).
