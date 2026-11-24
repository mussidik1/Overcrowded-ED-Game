# Reviewer 1, round 2: Senior Software Architect

Re-audit of branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD `49aea94`), Nov 24, 2026. I changed nothing in the repo except this file. Scratch scripts and outputs are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round2/r1/`: `mutate.sh`, `savemd.js`, `savediff.js`, `savereport.js`, `evsync2.js`, `orphan.js`, `dropbug.js`, `oldsave.js`, `arr.js`, `arr2.js`, `throw2.py`. A copy of the repo there was used for builds and test runs.

## 0. Round-1 status

Nothing in my area is fixed. Eleven items got worse.

| ID | R1 severity | Status | Evidence |
|---|---|---|---|
| R1-01 God files, textual splice | High | **Worse** | `engine.js` went from 4,486 lines / 383 KB to 4,668 / 402 KB. The physician-mode section (`engine.js:1547-2124`) now holds scoring, the lytic window and the whole ACLS system. `map.js` is still spliced into `ui.js` at `/*MAP*/`. |
| R1-02 Content is code in ~30 tables | High | **Worse** | Phase 1 added `CODE_WHY`, `CODE_Q`, `CODE_CAUSE`, `CODE_BASE` and `CODE_NAME` (`engine.js:1983-2039`), five hard-coded case-key lists (`2047-2050`, `428`) and five more `CONTRA_IF` closures (`426-437`). All of it is JavaScript, none of it is schema-checked, and none of it has a source field. |
| R1-03 Display text as keys | High | Still open | `RADIO_PLAIN`/`RADIO_BTN` are still applied to `SCEN` by array index (`engine.js:4661-4665`). `dxPick` still compares display strings (`562`). The new dx string `'Died in cardiac arrest: no code team'` has no `DX_PLAIN` gloss. |
| R1-04 One exception freezes the game | High | Still open | `frame()` in `ui.js` is unchanged. I re-ran `throw2.py` on the v0.30.0 build: one throw from `OC.step`, then the clock stays at 07:02 for good, with no message. |
| R1-05 Backend contract not in the repo | High | Still open | There is no `supabase/` directory. The fallback that resends on any HTTP 400 is still at `ui.js:2398`. |
| R1-06 Pages publishes the whole repo | High | Still open (unverifiable) | Nothing in the repo changed. The last `main` deploy is still the legacy `pages-build-deployment` (run 45240789894). The Pages settings API is blocked from this container. |
| R1-07 No save versioning or migrations | High (Verifier: Medium) | **Worse** | `G.v` is still 5, but Phase 1 added persisted fields (`p.tArrest`, `p.code`, `stats.noTeam`, `stats.lyticLate`). A v0.29 save resumes into an instant death (R1.2-09). Shared object references also corrupt resumed saves (R1.2-02). |
| R1-08 Singleton engine, hidden global config | Medium | Still open | `let G` and `CODE_V` are still module globals, and `globalThis.OC` is still set under Node. `golden.js:66,73` has to set and then reset `setCodeVersion` around its code checks. |
| R1-09 The whole engine is the public API | Medium | **Worse** | Exports went from 215 to 223. The new ones include the test-only mutators `toArrest` and `harmCheck`, and the mutable `CODE_Q`. |
| R1-10 Mode if-branches everywhere | Medium | **Worse** | Counts: `G.pre` 61 to 65, `G.mode` checks for `'md'` 35 to 38, `G.train` 26 to 27. |
| R1-11 Magic-string state machines | Medium | **Worse** | `'obsq'` is still dead. `p.code` is a new implicit state machine with no explicit states, and it causes R1.2-04. The dead-patient state list is now written three ways in the engine (R1.2-11). |
| R1-12 God functions | Medium | Still open | `mapRender` 394 lines, `EV` 257, `ACT` 181, `botStep` 108, `signOrders` 99. Engine lines over 300 characters went from 79 to 84. |
| R1-13 Duplicated knowledge | Medium | **Worse** | The `rngS` slot is still 5 in `inStream` and 6 in `newGame` (`engine.js:57` vs `847`), even after the "stream slots" fix. The cardioversion name is now stored three times (R1.2-14). `BEDSIDE` and `SC_TAGS` are unchanged. |
| R1-14 Tutorial content is UI code | Medium | Still open | Unchanged. |
| R1-15 Render loop rebuilds everything | Medium | Still open | Unchanged. |
| R1-16 3D keeps drawing when switched off | Medium | Still open | `src3d/map3d.js` and `src/map.js` have no changes since `6edcc3d`. |
| R1-17 No types, lint or formatter | Medium | Still open | There are still no config files and no scripts for them. |
| R1-18 Hand-rolled, seed-fragile tests | Medium | **Worse** | The same `assert` one-liner is now in 11 files and `roomFree` in 5. One `rules11.js` check is vacuous (R1.2-08). There are 237 fixed sleeps in the Python tests, and `features.js` still has 0 assertions. |
| R1-19 Dead code | Low | Still open | Each of `ORDER_TESTS`, `testsBlock`, `starLine`, `VINV`, `GOLD`, `LIFT3`, `placeFor` and `cubLen` is defined once and never used. Phase 1 added write-only state (R1.2-10). |
| R1-20 Test hooks ship to players | Low | **Worse** | `toArrest` and `harmCheck` are now exported too. `lintCases()` still runs on every page load (`engine.js:4640`). |
| R1-21 Changelog kept in comments | Low | **Worse** | Phase 1 added 16 "audit"/"audit phase 1 (R6-0x)" stamps to the engine. |
| R1-22 Build by string splicing | Low | Still open | Unchanged. Rebuilt in scratch: byte-identical `index.html`, `sw.js` and `3d/map3d.js`. |
| R1-23 Asset tooling | Low | Still open | Unchanged. |
| R1-24 Repo hygiene | Low | Still open | No `LICENSE` or `CREDITS.md`. `tests.yml` still triggers only on pushes to `main` and `3d`. |
| R1-25 Content order is behaviour | Low | **Worse** | `chooseCard` gained a third hard-coded branch, `'code'` (`engine.js:3755`). `aiCard` still picks the first choice. |
| R1-26 Pipe-separated arguments | Low | Still open | Unchanged. |
| R1-27 to R1-29 Nitpicks | Nitpick | Still open | Drug classes `resus` and `fluid` are still missing from `DRUG_CLASS`. "Okafor" is still two different doctors. |

**Counts:** Fixed 0, Partly fixed 0, Still open 18, Worse 11.

## 1. Verdict

**Only after major work.** Phase 0 was supposed to give this project a safety net. Instead it built a whole-state hash that fails on a one-word copy edit. That same net cannot see the new ACLS answer key, the code odds or the radio keys, and it has been regenerated in every commit since it was created. Phase 1 fixed clinical data by pushing more closures over the global `G`, more parallel hard-coded case lists and more stringly-typed state into the god file, which is the opposite of what the round-1 plan asked for. Under the net's own claims I found three real defects it certifies as fine: resumed attending shifts corrupt the teaching report, class shifts fall out of sync on events, and an abandoned code never ends. I would not put my name on this. The deterministic core is still the only part worth inheriting.

## 2. Score

**3 / 10.** Same as round 1. There is now a characterization suite and the fixes come with tests, but the suite cannot tell harmless changes from harmful ones, and Phase 1 made the structure measurably worse.

## 3. New findings (worst first)

### R1.2-01 · High · Phase 0's "safety net" detects changes but cannot protect anything *(Phase 0)*
- **Location:** `test/golden.js:47,50` (`arrivalsHash`, `stateHash: fnv(JSON.stringify(OC.G))`), `:55-63` (streams), `:66-72` (codes), `:76-84` (save), `:87-98` (answers); `test/golden.json`; CLAUDE.md "Practical notes".
- **What's wrong:**
  - **It is blind to the content Phase 1 added.** I applied mutations to a scratch copy (`mutate.sh`) and ran `golden.js`, `rules11.js` and `rules.js` through `rules10.js`. **Every one of these passed every test:**
    - The right answer in the second traumatic-arrest card changed to "Synchronized cardioversion".
    - The right answer for potassium 7.9 in arrest changed to "Start an insulin drip".
    - VF ROSC base odds raised from 0.5 to 0.9.
    - The late-team penalty removed.
    - `HARM.cardiovert` set to 0.
    - The A-fib crash `drop` rule deleted.
    - A MIEMSS radio-call answer flipped.

    Flipping the national radio key that teaches "no nitroglycerin at BP 84/52" to "approve" is caught only as two changed `stateHash` values (md/med, md/hard), with every readable metric identical. A reviewer cannot tell it from a copy edit. `CODE_Q`, `CODE_CAUSE`, the radio keys (`SCEN`), `DXQ`/`DDX` and the Box answers are not in the "answers" snapshot. `CONTRA_IF` is snapshotted only as `contraOf(p)` at the moment of arrival, so every time-dependent rule is invisible: `answers.stroke.contra` is `["enox","heparin"]`, and the 4.5-hour window never appears. CLAUDE.md says "A change that moves … an answer key fails it." That is false.
  - **It is hypersensitive to things that don't matter.** Changing one word in a log note ("you've seen them" to "you have seen them") fails all 5 attending shifts. The only diff shown is `"stateHash":"b189a9fa"` against `"fdd91f76"`, with every visible metric identical. The 20 class-code strings are salted with the version, so **every release fails golden** until `golden:update` runs (confirmed by bumping `package.json` to 0.30.1: all 20 code fixtures fail).
  - **It has been overwritten in every commit since it was created.** `golden.json` was regenerated in `8c75f86`, `443497d` and `f59708d`: every commit after `1aa61ea` that touched the engine or the version. Because the diffs are opaque hashes, the commit messages cannot be checked against them, and twice they don't match:
    - `443497d` says "attending shift outcomes change with the code odds", but no outcome field changed. Only three `stateHash` values did.
    - `8c75f86` says shifts changed in "md shifts, rn/hard, md/med/board", but all 13 `stateHash` values changed, including `rn/rush`, `rn/easy`, `rn/med` and all four rn scenario shifts.
  - **Its coverage is thin:**
    - 13 runs, not the plan's level × scenario × role (40).
    - No `wx` and no `pack` option is ever passed, so weather and the MIEMSS pack are never fingerprinted.
    - The save round trip uses one rn seed only (which is how R1.2-02 escapes).
    - The stream check leaves events out on purpose (`golden.js:21-22`), which is how R1.2-03 escapes.
    - Nothing in `ui.js` is covered: not `readSave`, not `PAST_V`, not the version check on a class shift.
- **Why a professional cares:** PRO_AUDIT Phase 5 (modules, TypeScript, content to JSON) is planned "behind the Phase 0 fingerprints". A net that must be regenerated on every release and every copy edit, and that misses answer-key changes, trains people to run `golden:update` by reflex. A restructure behind it is unprotected.
- **Fix:**
  - Delete `stateHash` and `arrivalsHash`. Store readable fingerprints instead: the arrival list as `ck@t` strings (the first 30), deaths, LWBS, the counts of each event fired and the score components. A diff should then say what moved.
  - Snapshot every answer key as readable data: `CODE_Q`, `CODE_CAUSE`, `SCEN` (both packs) and `DXQ`. Snapshot each `CONTRA_IF` rule as a table of probes (for example, stroke at `lkw` 60/260/280/null; ACS at SBP 85/95; cwp before and after a troponin).
  - Take code strings out of the snapshot and keep only the round-trip invariant.
  - Run the save round trip in both modes on at least 8 seeds, and add an aliasing walker (R1.2-02).
  - Add weather and pack runs, and an event-sync check (R1.2-03).
- **Effort:** M

### R1.2-02 · High · A resumed attending shift corrupts the end-of-shift "Orders to review", and golden certifies the opposite *(pre-existing; Phase 0 claims save identity)*
- **Location:** `engine.js:1862-1867` (`p.ordLog = {...}; S.log.push(p.ordLog)`, then later `p.ordLog.miss = missNow(p)`, `p.ordLog.extra.push(...)`); `ui.js:2689` (`ordLogHTML` reads `m.log`); `ui.js:2541-2544` (save and resume by `JSON.stringify(G)`); `golden.js:76-84`.
- **What's wrong:** `G.stats.md.log[i]` and `G.pts[id].ordLog` are the **same object**. In seed 3 of `savediff.js`, the save point had 12 such shared references. `JSON.stringify` and `parse` turn each one into two independent copies. After any resume (the page saves every 15 s and resumes after a tab kill or reload), later updates to `p.ordLog` never reach the report's copy.
  - `savemd.js`: hard attending shifts saved at 4 h and played on to 8 h. **4 of 8 seeds diverge** from an unbroken run.
  - `savereport.js`, seed 3, end-of-shift report: the resumed run tells the student **"Dorothy A. · Missed: Medications (nitroglycerin and a diuretic)"** and **"Jean T. · Missed: Medications (pain control)"**. The unbroken run shows nothing missed for either, because the gaps were filled after the save point.
  - I ruled out other divergence: with the order log left out of the comparison, the four diverging seeds (3, 5, 6 and 7) stay identical for 240 more minutes. The bug predates Phase 1 (the `6edcc3d` engine diverges the same way).
  - Golden's save check runs only `rn`/`med`/seed 9090, where no order log exists, and prints "ok - a saved and reloaded shift plays on exactly like an unbroken one."
- **Why a professional cares:** It is silent corruption of the attending's main teaching feedback after a routine event, and the project's own invariant says it can't happen. CLAUDE.md's "keep G JSON-safe" rule doesn't mention shared references, and nothing enforces it.
- **Fix:**
  - Make `S.log` an array of patient ids, and build the review at `endShift` from `G.pts[id].ordLog`.
  - Add a walker to golden that fails on any object reachable twice from `G`.
  - Run the save round trip in attending mode across several seeds.
- **Effort:** S

### R1.2-03 · High · Class shifts fall out of sync on events: the event stream is shared, but which event fires depends on how each student plays *(pre-existing; the Phase 0 sync check skips it)*
- **Location:**
  - `engine.js:3774-3782` (`eventsTick0`: `pool = Object.keys(EV).filter(k => EV[k].w() > 0)`, then `wpick(pool, k => EV[k].w())`).
  - The weights read play state, for example `huddle` (`boarders().length >= 2`), `admWait` (`waitingCount() >= 10`), the outages (`!Object.keys(G.out).length`), `cnoPizza` (`staffSat() < 55`) and every `!G.ev.used.X`.
  - `regionTick0` shares `rngE` (`engine.js:3504`).
  - `golden.js:21-22,55-63` compares arrivals only, and leaves out VIP and MCI patients.
- **What's wrong:** The stream fixes *when* an event fires, but *which* event fires is a function of each player's board. After the first difference, the used-flags differ, so every later pick differs too. `evsync2.js` compared the normal and careless autopilots on the same code, counting events (not cards):

  | Shift | Seed | Identical for the first | First difference |
  |---|---|---|---|
  | rn/med | 777 | 5 events | minute 246: `huddle` vs `labDown` |
  | rn/hard | 424242 | 5 events | minute 162: `powerOut` vs `labDown` |
  | md/med | 424242 | 7 events | minute 357: `labOut` vs `orDown` |

  **A bus crash (MCI) fires for one student and not the other** in rn/med seed 777 and rn/hard seed 777. CLAUDE.md promises "the same patients and events at the same times however differently they play", with exceptions only for return visits and diversion. That promise is false.
- **Why a professional cares:** Class codes are the classroom feature. An instructor comparing scores on one code is comparing shifts with different outages and different mass-casualty incidents.
- **Fix:** Draw the event schedule from `rngE` at `newGame` (time and key), using only static weights. At fire time, an event whose precondition fails becomes a deterministic no-op (or a fixed substitute), never a different draw. Give `regionTick0` its own stream. Add an event-sequence equality check to golden's streams section.
- **Effort:** M

### R1.2-04 · Medium · An abandoned code never ends: the R5-02 fix has a hole *(Phase 1)*
- **Location:** `engine.js:2114` (`arrestNoTeam`: `if (!p.arrest || p.ev === 'doing' || p.code) return;`); `staffGone` (`3578`) and `orphanPatients` (`3565-3577`) set `p.ev = 'none'` and `p.prov = null` but leave `p.code`; `EV.sick` (`3871-3880`) can pick providers (weights `app 1.2`, `md 0.7`).
- **What's wrong:** If `EV.sick`, a common random event (weight 1.1, up to `sickMax` per shift) and the only path that removes a provider mid-task, takes the doctor running a code during the 15-minute code task, `p.code` stays set. The 20-minute no-team death rule is then skipped forever.
  - `orphan.js` used `fireEvent('sick')` to time the removal, on 40 seeds in charge-nurse mode with no reassignment. **In 40 of 40, the patient was still "No pulse. CPR in progress" an hour later**, never pronounced and never counted.
  - If someone does reassign, `codeStart` is skipped, so `C.wait` keeps the first doctor's arrival and the orphaned minutes cost nothing.
  - The root cause is R1-11: `p.code` means both "a code record exists" and "a code is running", and nothing defines the states.
- **Fix:**
  - Give the code an explicit state (`p.code.st: 'running' | 'orphaned' | 'done'`).
  - Make `orphanPatients` set `'orphaned'` and record `tOrphan`.
  - Make `arrestNoTeam` count from `max(tArrest, tOrphan)` unless the state is `running`.
  - Recompute `wait` when the code resumes. Add the case to `rules11.js`.
- **Effort:** S

### R1.2-05 · Medium · The crash `drop` rule updates two of the three copies of an order, so a dropped drug still gets given *(Phase 1)*
- **Location:** `engine.js:3289` (`if (c.drop) { p.tr = p.tr.filter(...); if (p.right) p.right.tr = ...filter }`); nurses and pharmacy work from `p.treat` (`engine.js:2224`, `2681`, `2719`); compare `lyticWindowClosed` (`1952-1960`), which does `delete p.treat.tnk`.
- **What's wrong:** One order lives in three parallel structures: `p.tr`, `p.right.tr` and `p.treat`. The A-fib crash drops `meds` from the first two and leaves `p.treat.meds` pending.
  - `dropbug.js`: a stable A-fib patient, diltiazem signed (state `verify`), then a crash. **In 20 of 20, the pharmacist verified it and the nurse gave it after the crash**, while `contraOf(p)` listed `dilt` as contraindicated. No harm was scored, and `vRelief` (`engine.js:1031`) counts the finished `p.treat.meds` toward the patient improving.
  - This is reachable today only through `crashNow`, because `crash()` fires only for waiting patients (`3397`, `3401`), and those have no `p.treat` entries yet. It becomes a silently wrong clinical outcome as soon as roomed patients can crash.
  - The mutation that deletes the `drop` rule passed every test (R1.2-01).
- **Fix:** Make one function own "cancel order k": remove it from `p.tr` and `p.right.tr`, delete `p.treat[k]` unless it is `doing` or `done`, and pull it from the pharmacy and nurse queues. Have both `drop` and `lyticWindowClosed` call it. Test it in `rules11.js` with the pending-order case.
- **Effort:** S

### R1.2-06 · Medium · `CONTRA_IF` grew into closures over the global `G`, with conflicting meanings and a weakened lint *(Phase 1)*
- **Location:** `engine.js:426-439` (`CONTRA_IF`, `addContraIf`, `sbpUnder`, `tropBack`), `1137` (`lyticWindowOk`), `2949-2950` (`flowTick`), `4632` (lint), `439`/`1848` (`treatOkNow`).
- **What's wrong:**
  - Round 1 asked for conditional rules as data. Phase 1 added five more closures that read `G.t`, `p.crash`, `p.det` and `p.work`.
  - **"Unknown onset" means three different things:**
    - `lyticWindowOk` returns `true` when `p.lkwT == null` ("the window doesn't apply").
    - The stroke `CONTRA_IF` rule (`430`) treats `null` as contraindicated.
    - `flowTick` adds a third, hand-written guard (`!(STROKE_CASES.includes(p.ck) && p.lkwT == null)`).
  - **`lintCases` was weakened:** "a right drug is also contraindicated" is now skipped whenever a `CONTRA_IF` entry exists (`4632`). `ibu` and `ketor` are therefore both right (`RXOK.cwp`) and contraindicated (`CONTRA.cwp`), with the answer settled at runtime by a closure, so the answer key can no longer be checked statically.
  - **Contraindications double as indications.** `treatOkNow` marks any treatment "fine, not extra" when some `CONTRA_IF` drug that gives it is *not* contraindicated now. Every new `CONTRA_IF` entry therefore silently widens the scoring for its treatment.
  - `addContraIf`'s comment says "a second rule never erases the first". `Object.assign` does erase a second rule for the same drug.
- **Fix:**
  - Use rules as data, for example `{case:'stroke', drug:'tnk', contra:{any:[{lkwMin:{gt:270}}, {lkwT:null}]}}` or `{case:'stemi', drug:'ntg', contra:{sbp:{lt:90}}}`, evaluated by one tested function.
  - Have one `lyticAllowed(p)`.
  - Put an explicit `indicatedWhen` next to each contraindication instead of `treatOkNow`'s inference.
  - Restore the lint, with the right-and-conditional drugs explicitly allowed per case.
- **Effort:** M

### R1.2-07 · Medium · The ACLS answer key is unvalidated positional tuples inside the engine, keyed by hard-coded case lists *(Phase 1)*
- **Location:** `engine.js:1983-2039` (`CODE_WHY`, `CODE_Q`, `CODE_CAUSE`, `CODE_BASE`, `CODE_NAME`); `2047-2050` (`TRAUMA_CASES`, `BLEED_CASES`, `K_CASES`, `AIR_CASES`); `2070-2072` (choice keys are `String(i)` indices); `lintCases` (`4614-4639`).
- **What's wrong:**
  - Each choice is `[label, whyKey, 1?]`. "Right" is a magic trailing `1`, and the explanation is a string key into another table.
  - `lintCases` checks none of it: one right per question, every `whyKey` in `CODE_WHY`, and every case key in the four lists. I checked by script that the data is consistent today; nothing keeps it that way.
  - A case added through `addCase` cannot declare its arrest rhythm or cause. It has to be added by hand to lists 3,800 lines from the case format, and the coarse lists produce questionable content: `burn`, `mcigrn` and `mcimin` get the hemorrhage-and-decompression algorithm (a question for R6).
  - Card choices are keyed by array index, so reordering `CODE_Q` in an update remaps an open card in a saved game.
  - The content cites "AHA" only in a comment. There is no `source` field.
- **Fix:** Move `CODE_Q`, `CODE_CAUSE` and `CODE_WHY` to `content/acls.json` with a schema: `{id, text, choices:[{id, label, right:bool, why}], source}`. Let `addCase` take `arrest:{rhythm, cause}`. Key choices by id. Lint all of it at build.
- **Effort:** M

### R1.2-08 · Medium · A `rules11.js` check always passes because it tests nothing *(Phase 1)*
- **Location:** `test/rules11.js:156-157`: `OC.inStream && OC.inStream('rngZ', ...)` followed by `assert(!OC.inStream || threw, ...)`.
- **What's wrong:** `inStream` is not exported (`node -e "require('./src/engine.js').inStream"` gives `undefined`). The call never runs and the assert is true by construction. `npm test` prints "ok - an unknown random stream is refused" on every version, including one with the guard deleted.
- **Why a professional cares:** A false green in the release gate, on the class-sync guard the hostile review asked for.
- **Fix:** Export a test seam (or test through a public path that hits an unknown stream), and assert `threw === true` with no escape hatch.
- **Effort:** S

### R1.2-09 · Low · Phase 1 changed what a save holds without bumping the version or migrating: an old save resumes into a death *(Phase 1)*
- **Location:** `engine.js:2115` (`ref = p.tArrest != null ? p.tArrest : p.tArrive`); `OC.load` (`4642`) repairs only `G.spec`; `readSave` (`ui.js:2544`) accepts any `G.v === 5`.
- **What's wrong:** `oldsave.js` builds a v0.29 (`6edcc3d` engine) attending shift with your own patient in arrest (the R5-01 state), saves it 95 minutes into the shift and loads it into v0.30. **After one 0.1-minute step, the patient is "Died in cardiac arrest: no code team"**, with `stats.noTeam = 1` and an M&M line blaming the player, because `tArrest` is missing and `tArrive` (-25) is used instead. The old version gave that player no button to run the code.
- **Fix:** Bump `G.v` to 6 and add a migration chain in `OC.load` (`v5→v6`: set `tArrest = G.t` and `code = null` on arrest patients). Test loading a frozen v5 fixture in golden.
- **Effort:** S

### R1.2-10 · Low · Write-only state from Phase 1 *(Phase 1)*
- **Location:** `p.code.n` (`engine.js:2079`), `G.stats.md.codeRight` and `codeWrong` (`2080-2082`), `p.lyticLate` (`1956`), `G.report.noTeam` and `G.report.lyticLate` (`4206`).
- **What's wrong:** Nothing reads any of these. The report computes missed lytic windows and no-team deaths, and `ui.js` never shows either count. Only the M&M lines appear. `code.n` duplicates `code.step`.
- **Fix:** Show both counts in the report and the code score in the attending's table, or delete the fields.
- **Effort:** S

### R1.2-11 · Low · The dead-patient state is written three ways in the engine, and `LEAVING` is retyped three times in the UI *(Phase 1 added two)*
- **Location:** `engine.js:1084` and `4205` (`['family', 'morgue', 'morguing'].includes(p.dsp)`), `3237` (`p.dsp === 'family' || … 'morgue' || … 'morguing'`); `ui.js:489` (`LEAVING`), `873` and `969` (the same nine strings typed inline again).
- **What's wrong:**
  - This is more of R1-11. A new dead or leaving state has to be added in six places.
  - `vitalsOf` returns `arrest: true` for a dead patient, so "arrest" now also means "no vitals to show". Every consumer (`ui.js:659,2213`, `map.js:649`) inherits that overload.
- **Fix:** Use `const DEAD = new Set([...])` and `isDead(p)` in the engine, export it, and use `LEAVING` everywhere in the UI. Return `{dead: true}` without `arrest`.
- **Effort:** S

### R1.2-12 · Low · Phase 1's tests exercise states that play cannot reach, and miss the ones it can *(Phase 1)*
- **Location:**
  - `test/rules11.js:72-82`: `crashNow` on patients already in a room with orders open. In play, `crash()` only hits waiting patients, before `awaitOrders`.
  - `:87`: `p.extraTr = ['epi']; OC.harmCheck(...)` called directly.
  - `:84` and `:140`: assertions wrapped in `if (p.right)` and `if (p)`.
  - `:9-10`: the "mine" fixture, copied from `rules10.js`.
- **What's wrong:**
  - The reachable path (crash in the waiting room, then roomed) has no test, while the unreachable one does.
  - `harmCheck` and `toArrest` had to be exported to production for this.
  - The two conditional assertions disappear silently if their setup ever fails.
  - The header says "Each check fails on v0.29.1". At least "metoclopramide is still fine for gastroenteritis" and "stable A-fib: diltiazem is right" pass on the `6edcc3d` engine (checked).
- **Fix:** Use shared fixtures in `test/lib.js` (`makeMine`, `crashInWaiting`), assert that the setup holds instead of using `if`, and test through public actions.
- **Effort:** S

### R1.2-13 · Low · The "stream slots" fix edited one of the two places that assign slots *(Phase 1)*
- **Location:** `engine.js:57` (`{ rngA: 1, rngE: 2, rngM: 3, rngL: 4, rngS: 5 }`) vs `847` (`rngS: seedOf(seed, 6)`); `3504` and `3775` (`regionTick` and `eventsTick` share `rngE`).
- **What's wrong:**
  - Round-1 finding R1-13 named this exact disagreement. The fix added a throw for unknown streams and left the mismatch.
  - A shift whose save predates `rngS` gets slot 5 on load, while a fresh shift gets slot 6.
  - The comment "every stream has its own slot" is false: two subsystems share `rngE` (part of R1.2-03).
- **Fix:** Use one `STREAMS` table, used by both `newGame` and `inStream`. Give region its own slot.
- **Effort:** S

### R1.2-14 · Low · Adding one procedure took seven tables in two files and two ids *(Phase 1)*
- **Location:**
  - The ids: `synccv` is the orderable, `cardiovert` is the treatment.
  - The seven tables: `TREAT.cardiovert` (`engine.js:305`), `ORDER_MENUS` (`474`), `PROC.synccv` (`477`), `VONSET` (`1025`), `HARM` (`1760`), `CRASH.afib` (`3269`) and `ORDER_TX` in `ui.js:941`.
- **What's wrong:** "Synchronized cardioversion" is typed in `TREAT`, `PROC` and the UI's `ORDER_TX`. That makes three sources for one label, one of them in the UI duplicating an engine label. Nothing checks that a `PROC` has a `TREAT` or that `ORDER_TX` covers every `TREAT`.
- **Fix:** Use one `content/treatments.json` record per treatment (`label`, `menu`, `onset`, `harm`, `by`, `dur`) and generate the indexes. The UI reads `TREAT[k].label`.
- **Effort:** M (as part of R1-02)

### R1.2-15 · Low · The card system is one global slot with hand-written routing and retries *(Phase 1)*
- **Location:** `engine.js:3755` (`else if (c.eid === 'code') codePick(k, c.ctx)`, next to the `'lit'`/`'law'` branch); `2068` (`codeCard` returns early `if (G.card)`); `2937` (`flowTick` retries a deferred rhythm check); `2073` and `523` (`G.card.mine = true` patched after `setCard`).
- **What's wrong:** Every new prompt type adds a branch to `chooseCard` instead of registering a handler, and competes for `G.card` with its own retry logic. `setCard` has no `mine` parameter, so two callers mutate the card afterwards.
- **Fix:** Use a card queue in `G`, register handlers by id (as `EV` does), and give `setCard` an options object.
- **Effort:** S

### R1.2-16 · Low · Determinism is tested only on V8 *(Phase 0)*
- **Location:** `engine.js:20` (`expo = mean => -Math.log(1 - rnd()) * mean`); `golden.js` runs only under Node; the WebKit CI job runs Playwright UI scripts, not golden.
- **What's wrong:** `Math.log` is implementation-approximated in ECMAScript. Class sync across Safari (JavaScriptCore) and Chrome (V8) depends on it returning identical bits. I did not find a divergence, and the risk per arrival is tiny, but no test checks it.
- **Fix:** Run the golden arrivals section inside the WebKit job (`page.evaluate`) and compare with `golden.json`, or replace `Math.log` with a table-free deterministic log.
- **Effort:** S

### R1.2-17 · Nitpick · Diagnosis display strings used as state and as test oracles *(Phase 1)*
`p.dx = 'Died in cardiac arrest: no code team'` (`engine.js:2118`) has no `DX_PLAIN` entry, so "Plain words" shows nothing for it. `rules11.js:108,130,151` decide pass or fail by matching `p.dx` text. Use outcome ids (`p.outcome = 'rosc' | 'died' | 'noTeam'`) and gloss by id.

### R1.2-18 · Nitpick · Small defects in `golden.js` *(Phase 0)*
- `save.bytesAt3h` is `saved.length > 0`: always `true`, and misnamed.
- `answers` stores `'error: ' + e.message` as the expected value (`:92`), so a broken case can be frozen as "correct".
- `npm test` chains files with `&&`, so one failing rules file hides golden's output.
- The streams invariant says "however they play", but both runs are the same autopilot with a different `acc`.

### R1.2-19 · Nitpick · Lazy counters and changelog comments keep growing *(Phase 1)*
`(x || 0) + 1` counters went from 12 to 16 (`lyticLate`, `noTeam`, `md.codeRight`, `md.codeWrong`) instead of being added to `freshStats()`. There are 16 new "audit phase 1 (R6-0x)" stamps in comments. Git holds history.

### R1.2-20 · Nitpick · Docs describe the tests wrongly *(Phase 0/1)*
CLAUDE.md says golden fails when an answer key moves (false for code cards and MIEMSS radio, per R1.2-01) and "~520 ok lines" (`npm test` prints 587). The `rules11.js` header claim is false (R1.2-12).

### R1.2-21 · Nitpick · Presentation markup in simulation data *(Phase 1)*
`CODE_Q` and `CODE_CAUSE` text embeds `**bold**` markup for the UI renderer inside the engine. Content formatting belongs to the content layer and the UI, not the sim.

### Did Phase 1 make the architecture better or worse?

**Worse.**

What improved:
- `inStream` now fails loudly on an unknown stream.
- The code cards reuse the generic `G.card`/`chooseCard` path, so the UI needed only about 10 changed lines (the engine/UI boundary held).
- Each fix has a rule test.

What got worse, all in the god file:
- +182 lines.
- Five new hard-coded case lists.
- Five new closures over `G`.
- A weakened lint.
- A new implicit state machine (`p.code`) with a dead-end hole.
- A third copy of order state edited inconsistently.
- Three more magic-string copies.
- 8 more exports, including test-only mutators.
- Persisted fields with no version bump.
- Write-only fields.
- 16 changelog stamps.

**Is the safety net a safety net?** No. It is a tripwire on the whole state, it fires on wording, it misses answer keys, and it has been reset in every commit since it was written (R1.2-01). Three of its own invariants hide real defects (R1.2-02, R1.2-03), and one `rules11.js` check is a tautology (R1.2-08).

## 4. Coverage

**Read in full:**
- `git diff 6edcc3d..HEAD` (engine, UI, tests, CLAUDE.md, SMOKE.md, package.json).
- `test/golden.js`, `test/golden.json` (summarised by script) and `test/rules11.js`.
- The current text of every Phase 1 function: `inStream`, the `CONTRA_IF` block, `lyticWindowOk`, `lyticWindowClosed`, the `CODE_*` tables, `codeRhythm`, `codeCause`, `codeSteps`, `codeStart`, `codeCard`, `codePick`, `codeOutcome`, `arrestNoTeam`, `toArrest`, `crashSetup`, the `taskDone` guard, the `flowTick` changes, the `mdPlay` changes and the exports.
- Their collaborators: `assign`, `unassign`, `taskStart`, `taskDone`, `provTick`, `orphanPatients`, `staffGone`, `EV.sick`, `eventsTick0`, `stepInner`, `awaitOrders`, the order-classification part of `signOrders`, `vRelief`, the nurse, RT and pharmacy treatment loops, `pitDone`, `lintCases`, `OC.load`, `frame`, `isPaused`, `readSave` and `ordLogHTML`.

**Ran:**
- `npm test`: passes, 587 ok, 38 s.
- `npm run stress`: passes, 1 min 15 s.
- A scratch rebuild: byte-identical outputs.
- 13 mutation attempts through `mutate.sh` against golden and every rules file. Two did not apply; of the 11 that ran, 7 were caught by nothing: code-card keys ×2, code odds ×2, `HARM`, the `drop` rule and a MIEMSS radio key. The four that were caught (the no-team limit, the no-team penalty, a copy edit, and a national radio key) surfaced only as opaque `stateHash`/`care` diffs. A version bump alone fails all 20 code fixtures.
- Save round trips in attending mode (8 seeds), finding the first divergence with two engine instances, and comparing end-of-shift reports.
- Event-sequence sync across two play styles (6 runs).
- The orphaned-code reproduction (40 seeds).
- The drop-rule reproduction (20 seeds).
- The v0.29-save-into-v0.30 load.
- The md/rush arrival change traced to a "disaster" diversion at minute 84 (`arr2.js`); a design question for R5, not a stream bug.
- The R1-04 freeze, re-run in Chrome on the v0.30.0 build.
- `gh run list` for the deploy mode.

**Not checked, and why:**
- The Pages setting and the Supabase schema: the API and hosts are blocked from this container.
- I did not re-measure the 3D draw calls, because the 3D source has not changed since round 1.
- I did not run the Python UI suites or the WebKit job.
- Engine sections untouched by Phase 1 (transport, imaging, consults, blood bank, most of `EV`) and the `ui.js` renderers other than those named were not re-read line by line, beyond the metrics above.
- R1.2-05's clinical effect is shown only through the `crashNow` hook. I state its reachability as I found it.
- Cross-engine `Math.log` results (R1.2-16) were not measured.

## 5. What I'd grudgingly keep

- The seeded PRNG and per-stream arrivals: walk-ins and EMS stayed identical across play styles in every run I made.
- A DOM-free engine that two independent instances can run side by side in Node (that is how R1.2-02 was found).
- Fail-at-load linting, once it actually covers `CODE_Q`, the case lists and `CONTRA_IF`.
- The reproducible build, and the CI step that checks committed outputs match the source.
- Generic cards rendered by the UI with no per-card code: the ACLS cards needed no UI special-casing.
- The idea of a characterization suite, once it fingerprints readable facts instead of a hash of everything.
- `docs/SMOKE.md` as a merge checklist.
