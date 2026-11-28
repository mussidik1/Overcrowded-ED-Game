# Round 13, Reviewer 1 (architecture): v0.33.0

**Scope:** `git diff 78916ef..HEAD` (HEAD = 76c553f) over the paths the brief lists. I did not change any project file. Scratch files are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round13/r1/`:
- `repo/`: a HEAD export
- `handed.py` and `crash.py`: Playwright scripts
- `p1.js` to `p7.js`: engine probes

In a HEAD copy, `npm test` passes (782 "ok", no FAIL) and `npm run lint` is clean. I did not run stress.

**Working tree:** the lead is editing it while I review. `CLAUDE.md`, `README.md` and `src/ui.js` have uncommitted changes. They already fix `CB_MDNOTE`, the README paragraph and part of `bestStars`. My findings are against HEAD, and I say where the working tree already addresses one.

## 1. Verdict

**Do not ship v0.33.0 until R1.13-01 to R1.13-04 are fixed.**

The headline feature, "the attending's load grows with the level", does not work in the UI. The game's charge nurse hands the sickest patients to the attending. But a handed patient's card has no See, Take over or Run the code button. The attending cannot pick them up. The game then penalises the attending for leaving them unseen, and the patients hold their rooms all shift.

The crash guard's main promise also fails: "keeps the last good save". Both Reload and "Start over without the save" write the half-finished state the error left.

The new grade rewards doing nothing. An attending who never touches the game gets 2 stars on Quiet Tuesday, the Rush, and 10 of 12 Manic Monday seeds. The rules15 test that says otherwise passes on the one seed where it doesn't happen.

Holding the diagnosis score until the patient leaves was a sound idea. But the score is checked against `p.dx`, and an arrest, ROSC or death overwrites `p.dx`. So the M&M for a missed STEMI that arrested reads "It was Cardiac arrest".

The engine and UI boundary got worse. The rules for which answers to hide are spread across about eight UI expressions, and the engine still returns `right` to the UI on a shift. Each of those rules is a place a later change can leak the answer. None of them can be tested in Node.

## 2. Score: 4 / 10

## 3. Findings

### R1.13-01 Critical: a patient handed to the attending can never be seen, and still costs the attending, and holds a room all shift
- **Location:**
  - The hand-over is in `src/engine.js` `botStep` (4653). It sets `p.prov = G.me; p.handed = true`, and the note says "See them when you can".
  - The card is `src/ui.js` `mdPrimary0` (1020-1027).
  - The penalty is `unseenHanded` (3471) and `endShift` (4523).
  - The load cap is `mdLoad` (873).
- **What happens:**
  - Every path to the "see" action fails for a handed patient:
    - `!p.prov` is false, because `p.prov` is the attending.
    - `p.arrest && mine(p)` is false, because `mine` needs `p.mine`.
    - `!mine(p)` is true, so the card says "**Dr. Patel** has this patient": the player's own name.
    - The Take over button needs `p.ev === 'q'`, and a handed patient has `ev === 'none'`.
  - In attending mode the provider dock opens a staff sheet with no assign button (`ACT.prov` 2892). Next (`needGo`) opens the same card. So no button anywhere calls `E.assign(G.me, pid)`.
  - The engine's `botStep` never gives the patient to another provider (`!(G.mode === 'md' && p.prov === G.me)`). So the patient is never examined and never leaves.
  - At 19:00 each one costs Clinical −25, legal +5 and an M&M line ("on your list and never seen").
  - The handed patients also stay in `mdLoad`. Once `MD_LOAD` patients are handed (2 on med and rush, 4 on hard), no more are handed. For the rest of the shift `MD_HOLD` keeps the attending's other patients held longer.
  - On Full Moon Friday, four rooms, holding a STEMI and strokes, are blocked from about 07:30 to 19:00 (F-134 notes they don't deteriorate).
  - rules15 ("QA4-4") only checks that handed patients *wait*. No test anywhere checks that the attending can pick one up. F-098 says "the attending sees them with See this patient", but that path never existed.
- **Reproduce:**
  - `python3 handed.py` (hard, attending, list board) prints the card: "Dr. Patel has this patient." and `buttons: ['closeSheet:✕']`.
  - `node p1.js` gives these results:

    | Level | Handed | Unseen | Still in room at 19:00 | Legal | Clinical |
    |---|---|---|---|---|---|
    | med | 2 | 2 | 2 | 10 | 75 |
    | hard | 4 to 5 | 4 to 5 | 4 | 20 | 48 to 60 |

  - `node p2.js` lists the hard seed 11 rooms: `strokew roomed 07:28`, `stroke 07:27`, `nstemi 07:39`, `stemi ESI1 08:18`, all `loc room` at the end.
- **Fix:**
  - In `mdPrimary0`, add a branch before `!mine(p)`: `if (p.prov === G.me && !p.mine) return <See this patient / Run the code>` (`ACT.see` → `E.assign` already sets `mine`).
  - Better, move the decision into the engine: `OC.canSee(p)` returning `{ act, label }`, so the UI doesn't rebuild ownership from four flags.
  - Have `mdLoad` count only `p.mine` patients, or count handed ones for at most N minutes.
  - If the attending ignores a handed patient for X minutes, give it to another provider.
  - Add a Playwright check that taps See on a handed patient, and an engine check that a handed patient is not still in a room at the end of a shift.
- **Effort:** S.

### R1.13-02 High: the crash guard saves the half-finished state; Reload and "Start over without the save" both write it
- **Location:** `src/ui.js`:
  - `crash()` (3324-3339)
  - `save()` (3003): no `crashed` check
  - `visibilitychange` and `pagehide` handlers (3451-3452)
- **What happens:**
  - The comment says "keeps the last good save (it doesn't save the state the error left half-done)". CLAUDE.md says the same.
  - After `crash()`, `U.scene` is still `'game'` and `G.over` is false. So `save(true)` still runs on `pagehide` and when the tab is hidden.
  - **Reload** calls `location.reload()`. That fires `pagehide`, which overwrites the good save with the broken state.
  - **Start over without the save** removes `oc-save` and then reloads. The same `pagehide` writes it straight back. The button does the opposite of its label.
  - Switching apps on a phone after a crash has the same effect.
  - `crash_test.py` checks the save just before tapping Reload, and never after the reload.
- **Reproduce:** `python3 crash.py`. It replaces `OC.step` with a function that changes `G` (`HALF_DONE = 1`, `t += 100`) and then throws.
  - The saved `t` before tapping is 0.32.
  - After Reload: `HALF_DONE in save True t 100.33`.
  - After "Start over without the save": `save present True HALF_DONE in save True t 100.33`.
- **Fix:**
  - Add `if (crashed) return;` as the first line of `save()`.
  - Or set `U.scene = 'crashed'` in `crash()`.
  - Extend `crash_test.py` to read `oc-save` after each button's reload.
- **Effort:** S.

### R1.13-03 High: the attending's grade counts missing evidence as perfect; an idle attending earns 2 stars, and the test that says otherwise was passed on one seed
- **Location:**
  - `src/engine.js` `mdScores` (around 890) and `baseStars` (around 899).
  - `scoreOf` (839): `SC_PRIOR` makes Clinical 100 with no events.
  - `test/rules15.js`, the "QA6-2" block (seed 705).
- **What happens:**
  - With nothing done: Clinical = 100 (no events), Legal = 100 (no risk), Diagnoses = null and left out.
  - So radio calls are the only thing that can lower an idle attending's grade. A missed call counts 0, which gives (3 + 0 + 3) / 3 = 2 stars.
  - "A part with nothing to grade yet is left out, not counted as perfect" is applied only to Diagnoses and Radio. Clinical and Legal start at perfect and only go down, so not acting is the safest play.
  - F-134 (accepted by the owner) describes "Clinical 55%, a star". The real result is usually 2 stars and rank points (4 per idle shift).
  - rules15 asserts `R.stars <= 1` on med seed 705. Seeds 700 to 711 give `[2,2,2,2,2,1,2,2,2,2,1,2]`, so 705 is one of the two seeds where the claim holds.
- **Reproduce:** `node p2.js` prints the idle attending's stars: easy 12×2, med 10×2 and 2×1, hard 12×1, rush 12×2.
- **Fix:**
  - Make Clinical "credit earned over credit available". For example, start at null and use (patients seen and worked well) / (patients the attending should have seen).
  - Or cap the attending's stars by patients seen per hour, the way the Rush is capped by pace.
  - Assert the idle result over at least 10 seeds per level, not one.
- **Effort:** M.

### R1.13-04 High: a held diagnosis score is checked against the overwritten `p.dx`, so the debrief names "Cardiac arrest" as the missed diagnosis
- **Location:**
  - `src/engine.js` `scoreDx` (608-617) reads `p.dx` when the score settles.
  - `toArrest` (3643: `p.dx = 'Cardiac arrest'`), ROSC (2358), a lost code (2371) and no team (2418) all overwrite `p.dx`.
  - `dxPick` (604) stores only `{ right, pick }`.
- **What happens:**
  - Before this release `scoreDx` ran at the pick. Now it runs when the patient leaves.
  - For a must-not-miss patient who arrests after a wrong call (common for an untreated STEMI or dissection), three records name the wrong diagnosis: the M&M line, the diagnosis review (`dxLog`) and the legal-risk reason.
  - The real diagnosis is gone from all three. That is the worst possible lesson on the case the M&M exists for.
  - `p.dxPick` is also never cleared, so `dxShown` (ui.js 10) keeps showing the attending's old call as the card heading of a patient in arrest or after ROSC.
- **Reproduce:** `node p3.js`:
  - `dxLog [{"said":"Pericarditis","dx":"Cardiac arrest","must":true}]`
  - litLog `missed Cardiac arrest (must not miss)`
  - mm `called Pericarditis. It was Cardiac arrest`
  - `dxPick still set after arrest: Pericarditis`
- **Fix:**
  - Store `p.dxPend = { right, pick, dx: p.dx, must: MUST.has(p.ck) }` at the pick, and make `scoreDx` use only those.
  - Clear `p.dxPick` (or have `dxShown` skip it) when `p.arrest`, `p.rosc` or `p.tDied` is set.
  - Add a rules15 check: wrong call, then `toArrest`, then `settleDx`, and expect the original diagnosis in the M&M.
- **Effort:** S.

### R1.13-05 Medium: `endShift` scores the held diagnoses before `G.over` is set, so a finished shift opens a peer-review or PIP card and gets past 75% legal risk without being fired
- **Location:** `src/engine.js`:
  - `endShift` (4523): the settle loop runs before `if (G.over) return` and before `G.over = true`.
  - `litAdd` / `litCheck` (548-562)
- **What happens:**
  - The rule from R5.9-03 ("added at the end of the shift: no call, card or firing after it") depends on `G.over` already being true. The new loop runs first.
  - So a held wrong call or an unseen handed patient at 19:00 can:
    - push legal risk past 40 or 50 and run `setCard('lit', …)` (and `randi` for the PIP) on a shift that is over;
    - push it past 75, which sets `G.fireNow = true`. The `finally` in `step` never acts on it, because by then `G.over` is set. The report shows legal risk 77 with stars, while 75 during the shift means fired and 0 stars.
  - The same loop also runs on every later call of `endShift` (repeated calls are harmless only because of `dxPend = null` and `unseenDone`).
- **Reproduce:** `node p5.js`:
  - lit 38 → 42 at the end: `card lit`
  - lit 73 → 77: `fail null fireNow true stars 1 own.legal 23`
- **Fix:**
  - Set `G.over = true` (or a `G.ending` flag that `litAdd` respects) before the settle loop.
  - Decide in writing whether settling at the end can fire the attending.
  - Add a test.
- **Effort:** S.

### R1.13-06 Medium: the rules for hiding answers live in the UI, scattered and untestable, and the engine still sends the answer across
- **Location:**
  - `src/engine.js` `dxPick` returns `{ right }` on a shift.
  - `src/ui.js` places that each decide something about hiding:
    - `dxShown` (10)
    - `tropIn` (147)
    - `grayBlock` and the Risk row (150, 159-162)
    - `gapHint` (1049)
    - `mdDecideBlock` (1167)
    - `ACT.dxPick` (2697)
    - `renderHud` "Dx called" (357)
    - the objectives line (430)
- **What happens:**
  - Phase 6's "no giveaways on a shift" is enforced as about eight separate `!g().train` and `mine(p)` checks in string-building UI code.
  - The engine computes the verdict and gives it back (`r.right`). Every caller (the toast, a future share button, the 3D labels, `OCUI`) must remember to drop it. QA rounds 2 to 6 found this pattern leaking several times: QA6-1 (colour and sound), QA2-1, QA5-4.
  - The troponin rule for HEART (QA6-3, "one troponin rule for the risk line and the call") is UI only. The engine's `grayDispo` takes the call without a troponin, so a Node test can't check it.
  - `tropIn` also checks that a troponin was *ordered* (`p.det`), not that the result is back. The name says the opposite.
- **Reproduce:** in a regular attending shift, `OC.dxPick(id, x).right` is true or false at the pick. `OC.grayDispo` accepts a HEART call with no troponin ordered.
- **Fix:**
  - Have the engine return a "view" object for the attending (`OC.mdView(p)`: heading, whether the call can be made, what to show), with `right` removed when `!G.train`.
  - Move the troponin rule into the engine (`grayReady(p)`) and enforce it in `grayDispo`.
  - Test both in rules15.
- **Effort:** M.

### R1.13-07 Medium: the instructor's results note says the attending's score reflects the department, which is now false
- **Location:** `src/ui.js` `CB_MDNOTE` (2240). It is shown in the class results list and in the CSV and copied table (2289, 2306).
- **What happens:**
  - At HEAD the note says "the score and stars mostly reflect the department the computer runs".
  - Since `gradeParts` (engine around 896), they come only from the attending's own four parts.
  - The send box's "(the score is the average of your four scores)" is also wrong for an attending with null parts.
  - The working tree already rewrites both. They aren't committed.
- **Reproduce:** at HEAD, `grep -n CB_MDNOTE src/ui.js`.
- **Fix:** commit the working-tree text. Add a test that the CSV note for an attending row doesn't contain "department".
- **Effort:** S.

### R1.13-08 Medium: the tests don't cover what this release's rules depend on
- **Location:** `test/rules15.js`, `test/crash_test.py`, `test/career_test.py`.
- **What happens:**
  - Missing tests, each of which would have caught a finding above:
    - No check that a handed patient can be picked up in the UI (R1.13-01).
    - No check of the save after Reload or Start over (R1.13-02).
    - The idle-attending check uses one seed (R1.13-03).
    - No arrest between the pick and the settle (R1.13-04).
    - No check of end-of-shift side effects (R1.13-05).
  - The Rush pace cap is tested only through `paceStars` (a unit test of a lookup table). Nothing checks that `overallStars()` or `G.report.stars` is actually capped. I checked it by hand with `node p7.js`, and it is capped.
  - No test that `dxPend` survives a save round trip, and nothing in `test/golden.js` on the new fields.
  - Several rules15 checks set state directly (`G.train = null`, `p.mine = true`, `p.ev = 'done'`) and so skip the paths the player uses.
- **Fix:** add the tests listed in each finding's Fix. Add a seeded loop for the stars of an idle and a scripted attending on every level. Add `dxPend` and `handed` to golden's save round trip.
- **Effort:** M.

### R1.13-09 Low: the disposition-points rule is written twice, and the second copy also drops credit for the attending's own patients
- **Location:**
  - `src/engine.js`: `PT_TAGS` gains `'dispo'` (876).
  - Nine new `if (G.mode !== 'md')` guards on `care(…, 'dispo', …)`: 2817, 2833, 2846, 2943-2944, 3403, 3413 and others.
- **What happens:**
  - `PT_TAGS` already filters disposition points for patients who aren't the attending's.
  - The guards also remove the points for the attending's *own* patients. Example: a bedside glucose before CT in the attending's own stroke patient. The note still says "sugar checked at the bedside before the CT", but the attending gets nothing.
  - There are two ways to express one rule, and they disagree.
- **Fix:** keep one. Either drop the guards and rely on `PT_TAGS`, or add a `'nurse'` ledger tag for nurse-owned events and filter on that.
- **Effort:** S.

### R1.13-10 Low: the crash guard covers the frame loop and pointer taps only
- **Location:** `src/ui.js` `bind()`:
  - keydown: `ACT.needNext`, `ACT.pause`, `ACT.tmenu`, and the extra `render()` after `mapAct` on Enter
  - popstate (3441-3450)
  - `input` and `change` handlers
  - `arrPop`'s `setTimeout`
- **What happens:**
  - CLAUDE.md now says "frame() and taps run inside a crash guard". An engine error raised from N, Escape or Back escapes as an uncaught error.
  - The loop keeps running on whatever state the error left, and `visibilitychange` saves it.
- **Fix:** route these through one `guarded(fn, where)` helper.
- **Effort:** S.

### R1.13-11 Low: best stars can go down, and the best score mixes metrics across versions
- **Location:** `src/ui.js`: `bestStars` (3053) and `showReport` (around 3302).
- **What happens:**
  - Before v0.33 there is no `oc-bests-*` value, so the menu falls back to `scoreStars(bestOf)`.
  - The first v0.33 shift stores its stars whenever they are more than −1, so always. A player who had 3 stars and finishes a 1-star shift now sees 1 star.
  - The attending's `oc-best4-md-*` compares the new own-grade average with the old department average.
- **Fix:** seed `oc-bests-*` from the fallback before comparing. Version the best-score key, for example `oc-best5-md-*`.
- **Effort:** S.

### R1.13-12 Low: the save format is still 5, but its meaning changed, and a rollback loses held diagnosis scores
- **Location:** `src/ui.js`: `SAVE_V = 5`, `MIGRATE = {}` (3016). Engine: `p.dxPend`, `p.handed`, `p.unseenDone`, `G.fireNow`.
- **What happens:**
  - Non-class saves resume across versions.
  - A v0.33 save resumed after the documented rollback (`git revert`) to v0.32 keeps `p.dxPend` on patients. v0.32 never scores it, so wrong calls go unscored.
  - A v0.32 attending save resumed on v0.33 has radio results already counted in Clinical, and alert patients with `dxK` true.
  - Both are quiet changes in what a save means, with no format bump.
- **Fix:**
  - Bump `SAVE_V` to 6 when a field's meaning changes, with a `MIGRATE[5]` that settles or clears `dxPend`.
  - Or refuse a cross-version resume of an attending shift, as class shifts already are.
- **Effort:** S.

### R1.13-13 Low: two "clinical" numbers and duplicated figures on the attending's report and screen
- **Location:** `src/ui.js`:
  - `scoreCardsHTML` (3227-3231): a Clinical card (from the ledger) and a Diagnoses card ("x of y right").
  - `litHTML` (3216-3221): "Clinical accuracy" (`accuracy()`) and "Diagnoses right" again.
  - HUD: a Legal pill and the objectives line both show legal risk.
- **What happens:** the report shows two different numbers both called clinical, and repeats the diagnosis count. `accuracy()` is no longer part of any grade but is still on the report.
- **Fix:** drop "Clinical accuracy" from the attending's report, or say what it measures. Show each figure once.
- **Effort:** S.

### R1.13-14 Low: the release paperwork at HEAD is incomplete
- **Location:** `README.md` (no v0.33.0 paragraph at HEAD; the working tree adds one) and CLAUDE.md's test counts (the working tree updates them).
- **What happens:** CLAUDE.md's release checklist requires a README paragraph. At HEAD, `npm test` reports 782 ok, while the docs said "~760" and "rules14".
- **Fix:** commit the working-tree changes before merging.
- **Effort:** S.

### R1.13-15 Nitpick: dead code and names that don't match what they do
- `starsFor`, `STARS` and `STARS_MD` are now used only by `rules4.js` and `rules5.js`. The UI never shows points-based stars. `starLine` was already dead before this release and has been removed.
- `PSHORT.Diagnoses` (ui.js 348) is never matched; the pill's label is "Dx called".
- `mdLoad` checks `p.dsp !== 'gone'`, and nothing ever sets `dsp` to `'gone'`.
- The HUD pill IDs `pPat`, `pClin`, `pAdm` and `pStaff` show Clinical, Dx, Radio and Legal in attending mode.
- `tropIn` means "troponin ordered".
- `MIGRATE` is empty scaffolding: fine, but say so.

### R1.13-16 Nitpick: a diagnosis that still names its risk band
- `pnalow` is still "Pneumonia, low risk" (engine 681). QA2-3 renamed syncope and chest pain so the diagnosis doesn't give away the risk band. rules15 checks only those four keys.

### R1.13-17 Nitpick: small UI issues
- `ARRQ` (ui.js 275) is module-level and isn't cleared by `start()`. Arrivals queued in one shift can pop up in the next (only `U.scene === 'game'` is checked).
- `readSave()` (`JSON.parse` of about 0.3 MB) runs two or three times on every title redraw (`titleHTML`, `replaceHTML`, `start`).
- The Enter-key path renders twice.
- `SAVE_MAX = 3e6` characters is above Safari's localStorage quota (about 2.5 million UTF-16 characters). On Safari, `setItem` fails silently first, so the "too big to save" message never shows and an older save stays.

## 4. Known issues F-134 to F-144, from the architecture side

| ID | Their severity | My rating | Note |
|---|---|---|---|
| F-134 | High | **High, and worse than recorded** | The idle attending usually gets 2 stars, not 1 (R1.13-03). Combined with R1.13-01, the "unseen" patients can't be seen at all. This should not be an accepted risk. |
| F-135, F-137, F-141, F-129 | Medium, Medium, Low, Low | Agree | Layout and target size; outside my area. |
| F-136, F-128 | Medium, Low | Agree | The initials filter is a client-only denylist; the server still accepts names. Defence in depth only. |
| F-138 | Low | Agree | The HEART parts list is incomplete. Same root cause as R1.13-06: the score's parts are built in two places. |
| F-139 | Low | Agree | Same as R1.13-03: a score with no evidence reads as good. |
| F-140 | Low | Agree, possibly Medium | Another UI giveaway path (R1.13-06). |
| F-142 | Low | Agree | `focusMgr` and `U.focRet0` race the first-shift card. |
| F-143 | Low | Agree, Medium for design | The acuity mix doesn't change by level. |
| F-144 | Low | Agree | |
