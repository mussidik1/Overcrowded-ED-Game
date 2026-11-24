# Reviewer 3, round 3: game tech, web app, security and privacy

Branch `claude/sleepy-rubin-jot35n` at v0.30.0. HEAD moved during the review from `88ed674` to `8357568` (the `.gitignore` commit); this report covers `8357568`. Reviewed Nov 24, 2026, against `git diff 49aea94..HEAD`.

Scratch scripts are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round3/r3/`: `a*.js` for Node, `b*.py` for Playwright in Chrome, and `shots/` for screenshots. Every browser run blocked `*.supabase.co` and turned service workers off. Nothing contacted Supabase or edcodeblack.com.

## 0. Round-2 status

Two of my round-2 claims were wrong, and I'm correcting them here:
- **R3.2-03 said nothing tested stale codes.** That was false. `test/rules7.js:63` and `test/rules10.js:101` already did.
- **My round-2 "keep" list said a class sees the same arrest because the rhythm comes from the patient id.** That is false; see R3.3-01.

| ID | Status | Evidence |
|---|---|---|
| R3-08 Class save silently dropped after an update | **Partly fixed** | `staleClassNote()` (`ui.js:2577`) exists, but it doesn't reach a phone player. `b1_stale.py` at 390×844: the 175-character toast is cut to "…was saved on v0.29.1 and ca…" and gone after 3 s. Because it is marked "noted" on first display, it never shows again. See R3.3-03. |
| R3.2-01 Orphaned code never ends | **Partly fixed** | The dead end is gone (`a1_orphan.js`). Case A dies 20 minutes after the doctor leaves and is counted in `noTeam`. Case C: the attending who takes over gets 3 cards with `me: true`. But `wait` is still wrong, now in the other direction: 12 instead of 2 (R3.3-04). A rule test exists (`rules12.js`, `staffGone`). |
| R3.2-02 Old saves kill arrests at load; cards after the outcome | **Partly fixed** | `a2_oldsave.js` against the real v0.29.1 engine. Cases (b) and (c) no longer die at load. Case (d): no more cards for a dead patient, and `codePick` and `codeCard` check `p.arrest`. Still to do: `G.v` is still 5 (deferred, R1-07). An old code in progress resolves with `wait: 10` taken from the resume (R3.3-05). |
| R3.2-03 Test net claims coverage it lacks | **Partly fixed** | Fixed: the `inStream` test now asserts, and attending round trips (4 seeds) and a mid-code save were added. Still missing: `bytesAt3h` was deleted, not replaced by a size budget; `readSave` and `staleClassNote` have no test; there's no frozen v0.29 save fixture; the stream check still compares only `ck@t` (it misses R3.3-01). `npm test`: 642 ok, 0 FAIL. |
| R3.2-04 Rhythm checks all at one instant | **Partly fixed** | Cards now come `CODE_GAP` = 4 game minutes apart (`b2_codecard.py`: t 20.3 → 24.3 → 28.3). The text still says "two minutes" (R3.3-06). The idle after the last card is deferred to Phase 6. |
| R3.2-05 `inStream` throws in the frame loop; slot mismatch | **Partly fixed** | Fixed: the slots match `newGame`, and the throw is exported and tested. Still open: the runtime throw stays in production with no crash guard; `rngE` is still shared by `regionTick` and `eventsTick` while the comment says each stream has its own slot; nothing lints stream keys at load. |
| R3.2-06 Version bump: live codes still play, golden breaks each release | **Partly fixed** | Fixed: golden pins the codes with an empty salt. Unchanged: `a5_codes.js` still finds **2,768 of 131,072 (2.11%, 1 in 47)** v0.29.0 codes playing as current. CLAUDE.md still says "about 63 in 64", and README's v0.29.1 paragraph says "about 1 in 64". The `ver` column waits for Phase 2. |
| R3.2-07 Cheat exports on `window.OC` | Deferred (Phase 2), but it grew | `OC` went from 223 members to **236** (new: `staffGone`, `inStream`, `CODE_WHY`, `CODE_BASE`, `CAUSE_OF`, `contraWhy`, `afOnset` and others). For Phase 2: the DOM also gives the code card away. All 28 cards list the right answer first, and the button carries `data-arg="${original index}"`, so the right answer is always the `data-arg="0"` button. |
| R3.2-08 Unroomed no-team deaths blamed on the attending | **Fixed** | In attending mode, `arrestNoTeam` now uses `own = false`, with no `care` or `litAdd` for an unroomed death. The root cause is still there and is new: R3.3-02. |
| R3.2-09 Smoke checklist | Partly fixed / waived | The class-code line now says R4-02/03 are known to be open. None of the four lines I asked for were added. The owner waived the phone checklist. |
| R3.2-10 `p.code` never cleared | Partly fixed | `codeDue` now short-circuits on `p.arrest`. `taskDone` still ignores eval/reassess for any patient with a past `p.code` (`engine.js:1560`). |
| R3.2-11 Dead vitals reuse `arrest: true` | Still open | `vitalsOf` (`engine.js:1110`) is unchanged. |
| R3.2-12 Code card focus | Still open | The only `.focus()` in `ui.js` is the gate. |
| R3.2-13 Page passed 1 MB | **Worse** | 1,005,581 → **1,034,056 bytes** (356,086 gzipped). |
| R3.2-14 The `PAST_V` rule is a trap | Partly fixed | The `ui.js:1995-1998` comment is now right. CLAUDE.md still says "set `PAST_V` … to the version being replaced". |

**Counts (15 items): 1 fixed, 10 partly fixed, 2 still open, 1 worse, 1 deferred (grew).**

## 1. Verdict

**No, not yet.** The round-2 work is real. The orphaned code now ends, old saves no longer kill arrests at load, the code cards are spaced and survive a reload with either card open, and the tests now assert things.

But this release's headline feature has a new hole, and it comes from a round-2 fix. `canPlace` now allows a code in a pod room. The game's own charge nurse (`botRoom`) was never taught that, so in attending mode a cardiac arrest lies on the EMS wall next to a dozen open rooms until it dies. It happened in 5 of 6 hard attending shifts, and the attending has no button to stop it.

Separately, the class-code guarantee is broken more widely than anyone has reported. Patient ids come from a global counter that play moves. In 11 of 12 class shifts, about a third of the "same" patients get different arrest rhythms, stroke onset times, A-fib onset (which decides whether cardioversion is right or harm), vitals jitter and code-card order.

Both have cheap fixes.

## 2. Score

**5 / 10.** It is up from 4. The save and code state machine is now sound under everything I threw at it. There are two High defects in the class and code features, and the stale-save notice doesn't work on the platform it targets. The backend and crash-guard items still wait for later phases.

## 3. New findings (worst first)

### R3.3-01 · High · Class shifts give the "same" patient different clinical facts: every id-derived fact desyncs once play moves the id counter (pre-existing; round 2 made more depend on it)

- **Location:**
  - `engine.js:1137`: `id: 'p' + (G.nid++)`. One global counter is consumed by return visits (`returnVisit`, `:3363`), VIP and MCI events (`:4154`, `:3956`) and surge EMS. A diverted ambulance consumes none (`spawnEms` returns before `makePatient`).
  - These facts all come from `vhash(p.id + …)`:
    - the arrest rhythm (`codeRhythm`, `:2156`)
    - the stroke's last known well and whether the BP is over the limit (`:1171-1172`)
    - the A-fib onset that decides cardioversion scoring (`afOnset`, `:1165`; new in round 2)
    - an infant's months, and from them the PALS weight (`monthsOf`/`kgOf`, `:1187`; new)
    - the vitals jitter (`:1114`)
    - the rehab flag and the second consult (`:1153-1154`)
    - the code-card answer order (`mixHash(G.seed + '|' + p.id …)`, `:2191`; new, with the comment "the same for everyone on a code")
- **Repro:**
  - **`a3b_idsync.js`:** the same seed is played twice by a fast and a slow autopilot (`budget` 1e9 vs 1), over 12 full shifts (med and hard).
    - **11 of 12 shifts diverge.**
    - **434 of 1,178** matched scheduled arrivals (same case, same minute) get another id.
    - **228** would show another arrest rhythm.
    - **7** A-fib patients get another onset.
  - **`a3c_facts.js`:** **8 of 18** matched strokes get another last known well. For example, the LVO at minute 640 of hard seed 11 arrived **142 minutes** after last known well for one student and **59** for the other.
  - Golden's stream check stays green because it compares `ck@t` strings only (`test/golden.js:26`, `:69`).
- **Why it matters:**
  - Class codes exist so an instructor can debrief one shared shift. CLAUDE.md promises "the same patients and events at the same times however differently they play", with clinical facts drawn "from the patient id, not the dice" so they match.
  - In practice, half a class can have a stroke close to the edge of the window while the other half has hours to spare. Some students' A-fib must not be shocked while others' may be.
  - This is separate from R1.2-03 (events, deferred). Fixing the event stream won't fix it.
- **Fix:**
  - Give each patient a stream-stable hash key at creation: the `sub()` sub-seed (`engine.js:1224`) for scheduled arrivals, or a per-stream counter (`'w17'`, `'e5'`, `'a3'`). Store it as `p.hk` and use `vhash(p.hk + …)` everywhere `p.id` is hashed now.
  - Return visits and event patients keep play-driven keys.
  - Extend golden's stream check to compare `id-derived facts` (rhythm, lkw, afOnset) of matched arrivals across the two play styles.
  - Run `golden:update` for the intended change.
- **Effort:** S.

### R3.3-02 · High · Attending mode: the game's charge nurse leaves a cardiac arrest on the wall to die while pod rooms are open (caused by the round-2 R5.2-03 fix)

- **Location:**
  - `engine.js:1355`: `canPlace` now allows an arrest in a pod room when no resus bay is free.
  - `engine.js:4382` (`botRoom`): `else if (e === 1) sc = r.kind === 'resus' ? 0 : 99`, and `return bs < 50 ? best : null`. Any non-resus room scores 99, so the bot returns no room.
  - `aiTick` → `botStep` is the charge nurse in attending mode. The attending has no way to place a patient: `mdPrimary0` shows "The charge nurse is working on a room".
- **Repro:**
  - **`a7_podbot.js`:** seeds 1 to 3, all four resus bays full, a field arrest ("Cardiac arrest, CPR in progress") on the wall. `canPlace` allows **11 to 12 pod rooms**. The patient is never roomed and is "Died in cardiac arrest: no code team" at 20 minutes, every time.
  - **`b3_wallcode.py` (UI):** the attending's sheet shows "The charge nurse is working on a room for Wei." with **no buttons**, while 15 rooms are allowed. They died 20 minutes later.
  - **`a7b_mdfreq.js`, 12 attending shifts as played** (aiTick plus the attending autopilot, every code card answered right): 20 arrests, **7 died unroomed**. **6 of those had a pod room open and allowed for 5 to 20 minutes.** That was 5 of the 6 hard shifts.
- **Why it matters:**
  - In the release whose headline is cardiac arrest, the game kills arrests in normal attending play: about one per Full Moon Friday.
  - The player is shown the death ("N patients died in the department") and can do nothing about it.
  - No working charge nurse would leave a code on an EMS stretcher beside empty monitored rooms.
  - The fix was applied to the player's rule and not to the game's own player.
- **Fix:**
  - In `botRoom`, when `p.arrest` and no resus bay is free, score `main` rooms at about 5 (safe rooms 19 and 20 higher).
  - Add a rule test: attending mode, resus bays full, an arrest on the wall is roomed within 2 minutes.
- **Effort:** XS.

### R3.3-03 · Medium · The stale-class-save notice (the R3-08 fix) is cut off on a phone, lasts 3 seconds, and is used up on first display

- **Location:**
  - `ui.js:2577-2587` (`staleClassNote`): it stores `oc-save-noted` before the toast shows.
  - `ui.js:168-175` (`toastShow`): an `info` toast lasts 3,000 ms. On the title the body is in `mapmode`, so it goes to the top strip, which cuts long text ("long" class).
  - `ui.js:2888`: called once from `boot2`.
- **Repro:** `b1_stale.py` puts a real class save with `ver: '0.29.1'` into storage before boot.
  - **Phone 390×844:** the toast is a 137×43 px box reading "Your class shift (code 11R-882) was saved on v0.29.1 and ca…" (`scrollHeight > clientHeight`; screenshot `shots/b1_phone_1000.png`). It is gone at 3 s.
  - **Desktop:** the full text shows for under 2 seconds.
  - **Both:** after one reload the note never appears again; there's no Resume button and the stale save stays in storage.
  - The actionable half ("Start it again with the code, or ask your instructor for a new one") is never shown on a phone.
- **Why it matters:** this is the update-day message for exactly the students R3-08 was about. On the main platform it is unreadable and impossible to get back.
- **Fix:** show it as a card or banner on the title, or in the Class code sheet, until the player dismisses it or starts a shift. Mark it "noted" on dismissal, not on display. Keep it short ("Your class shift can't continue on this version. Re-enter code 11R-882.").
- **Effort:** S.

### R3.3-04 · Low · A restarted code counts the first team's CPR minutes as "no doctor" minutes

- **Location:** `engine.js:2021-2024` (`codeTeam` now always calls `codeStart`), `:2181` (`wait = G.t - p.tArrest`).
- **Repro (`a1_orphan.js`, case D):** the first team runs the code for 10 minutes, then leaves (`staffGone`), and a new doctor takes it 2 minutes later.
  - `p.code.wait` = **12**, so `late` = 0.45 and the odds × 0.55. The real gap was 2 minutes, which carries no penalty.
  - The code also restarts at step 0 with a fresh 15-minute task, so it lasts 27 minutes.
  - An attending who takes over answers every card again. The M&M then says "the team got there 12 min after the arrest".
- **Fix:** keep a running "minutes without a team" on `p.code`: add `G.t - tLeft` when a new team starts, and keep `step`.
- **Effort:** S.

### R3.3-05 · Low · An old (v0.29) save resumed mid-code is penalized for the minutes after the resume

- **Location:** `engine.js:4806` sets `tArrest = G.t` at load. `codeOutcome` → `codeStart(p, true)` runs only at the outcome, so `wait` = outcome minus resume.
- **Repro (`a2_oldsave.js`, case d):** a code that ran 5 minutes on v0.29.1 resolves with `wait: 10`, cutting the odds by 35% for a code that had a team throughout.
- **Fix:** in `load`, for an arrest with a started code task and no `p.code`, call `codeStart(p, true)` right away, so `wait` = 0. Better: do this in a real `migrate()` with `G.v = 6` (R1-07).
- **Effort:** XS.

### R3.3-06 · Low · The game says rhythm checks are two minutes apart; the clock shows four

- **Location:**
  - `engine.js:2032`: `CODE_GAP = 4`.
  - `:2211`: the button label "Two more minutes of CPR".
  - The cards: "Two minutes of CPR. Still VF".
  - `ui.js:1871`: lesson `ca5`, "about two minutes apart".
  - README v0.30.0: "a card about two minutes of CPR apart".
- **Repro:** `b2_codecard.py`. After "Two more minutes of CPR", the next card arrives at +4.0 game minutes, on the clock the student is watching.
- **Fix:** set `CODE_GAP = 2` and resolve the outcome after the last check (deferred Phase 6), or say "a few minutes". Don't teach the 2-minute cycle on a 4-minute clock.
- **Effort:** XS.

### R3.3-07 · Low · The docs still overstate how often old class codes are refused

- **Location:** CLAUDE.md:51 ("about 63 in 64"), CLAUDE.md:114, README v0.29.1 ("about 1 in 64 still gets through").
- **Measured (`a5_codes.js`):** **1 in 47** v0.29.0 codes play as current on v0.30.0. That's 2,768 per setup, each a different shift with no warning.
- **Fix:** say "about 1 in 47 for the live version", or widen the check. Apply the `ver` column before the merge so the two sets of results can be told apart.
- **Effort:** XS (docs).

### R3.3-08 · Low · The post-deploy live-site check can't tell the new deploy from the old one, and fails slowly

- **Location:** `.github/workflows/pages.yml:56-76`.
- **What I verified (`live_check.sh`, the workflow's script run locally with the retries shortened):**
  - **It works logically:**
    - The packaged site passes all 12 checks.
    - A legacy repo-root site fails the 9 "must be 404" checks.
    - A down site fails everything.
  - **It can't tell which build is live:**
    - It checks status codes only, so the previous deploy also passes `want 200 index.html`.
    - It never compares the live `sw.js` cache name with the one this job built.
  - **It fails slowly:**
    - Each failing path retries for 5 minutes.
    - A real failure (Pages still on "Deploy from a branch") takes about 45 minutes to report.
  - **It has small gaps:**
    - It doesn't follow redirects. If the canonical host ever changes, every check fails after an hour.
    - The `?nocache=$i` value is the same 1 to 30 on every run.
    - It doesn't probe `src3d/`, `art/`, `tools/`, `.github/`, `test/*.py` or `docs/audit/round2/`.
  - It runs after the deploy, so it detects problems; it doesn't gate.
- **Fix:**
  - Pass the built `sw.js` `CACHE` line from the build job as an output, and compare it with the live file.
  - Use `?run=$GITHUB_RUN_ID-$i`.
  - Cut the 404 retries to one once `index.html` matches the new build.
- **Effort:** S.

### R3.3-09 · Nitpick · Code-system loose ends

- `CODE_CAUSE` appears twice in the `OC` literal (`engine.js:4820`).
- `inStream`'s slot line carries two stacked comments, and the second still claims "every stream has its own slot" (`:57`).
- `p.traumatic` is still set (`:3522`) but no longer read.
- **`lintCode()` has gaps:** it doesn't check:
  - `CODE_NAME` for every rhythm (a new rhythm would title the card "Code blue: undefined");
  - that the `kid*` sets exist;
  - that every `codeCause` return value (`bleed`, `look`) has a card;
  - that `{…}` placeholders appear only in kid cards.
- A code arrest can be placed in safe rooms 19 and 20 (psych rooms), and the canPlace message calls them "a pod room".

### R3.3-10 · Nitpick · Repository hygiene in the round-2 commits

- **A stray symlink in pushed history:** `eb88030` committed `node_modules` as a symlink to `/home/user/Overcrowded-ED-Game/node_modules`. That absolute container path is now in pushed history.
- **A commit message that isn't true:** `7a2efc6` says "the entry now matches a file or a symlink as well", but that commit only removed the link; the `.gitignore` change came two minutes later in `8357568`.
- **The new rule is fine:** `node_modules` with no slash matches a directory, file or link at any depth.
- **The round-2 commits never went through CI:** `tests.yml` runs only on `main` and `3d`.
- **Same version string, different behaviour:** round 2 changed shift behaviour and the save shape (`p.code.t0`, `tLeft`, `shocked`) under the same 0.30.0. Any code or save made from the pre-round-2 0.30.0 build (the `3d` branch, or the private artifact copy) silently plays a different shift. Bump to 0.30.1 or say it in the README.

## 4. Coverage

**Read:**
- the whole `git diff 49aea94..HEAD` for `src/`, `test/`, `.github/`, `.gitignore`, CLAUDE.md, README and SMOKE;
- the code-system paths (`toArrest`, `codeTeam`, `codeStart`, `codeCard`, `codePick`, `codeOutcome`, `arrestNoTeam`, `flowTick`, `taskStart`, `taskDone`, `orphanPatients`, `staffGone`, `unassign`, `setPit`, `sendBreak`, `canAssign`, `canPlace`, `place`, `move`, `botRoom`, `aiTick`);
- `OC.load`, `readSave`, `staleClassNote`, toasts, `renderModal`, `chooseCard`, the order-review path (`logOrders`, `orderLogOf`, `ordLogHTML`), `inStream` and stream seeding, `makePatient` ids, and every `vhash(p.id …)` use.

**Ran:**
- **Scratch rebuild:** `index.html`, `sw.js` and `3d/map3d.js` are byte-identical to the committed files.
- **`npm test`:** 642 ok, 0 FAIL.
- **`npm run stress`:** passes; vitals in range in every run.
- **Node:**
  - `a1` orphaned codes (4 cases);
  - `a2` v0.29.1 saves on v0.30.0;
  - `a3`/`a3b`/`a3c` class id sync over 12 full shifts;
  - `a4` shuffle distribution (uniform at 25% ± 0.5 per button; not a finding);
  - `a5` code acceptance;
  - `a6`/`a7`/`a7b` unroomed arrests in attending mode;
  - the bleed causes for every bleeding case (correct).
- **Playwright (Chrome):**
  - `b1` stale class save on phone and desktop;
  - `b2` code card → result card → save/reload with each open → the next card 4 minutes later → the outcome;
  - `b3` the attending's view of a wall arrest.
- **The `pages.yml` check script** against a packaged site, a repo-root site and a down host.

**Checked and not a finding:**
- **The code cards are sound:**
  - They don't stack: `codePick` runs after `chooseCard` clears `G.card`.
  - They halt the clock, so a code can't end mid-card and the patient can't die or leave mid-card.
  - A result card or rhythm card survives a save and reload and resumes paused.
  - `crashSetup` deleting a `todo` treatment can't orphan a nurse task, because `rnPick` re-reads `p.treat`.
- **Other round-2 changes check out:**
  - `orderLogOf` handles old object entries.
  - `inStream` restores the main stream in `finally`.
  - `lintCode` runs at load and the deploy runs `npm test` first.
  - The `.gitignore` rule works.

**Couldn't check:**
- The Pages source setting: the proxy refuses `repos/…/pages`. The last `main` deploy is still the legacy `pages-build-deployment`.
- The Supabase schema and RLS.
- Real phones and WebKit.

## 5. What I'd keep

- `arrestNoTeam`'s `tLeft`: a code whose team leaves now has a clock instead of a dead end.
- The two-card flow (`code` then `coderes`) lives entirely in `G` and survives reloads with either card open.
- The `p.arrest` guards in `codeCard` and `codePick`, and `codeDue` as one readable predicate.
- `orderLogOf` storing ids instead of aliased objects, with a fallback for old saves.
- golden's mid-code and attending round trips, and the `inStream` test that now asserts.
- `lintCode()` failing at load on broken card data.
