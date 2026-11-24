# Reviewer 3, round 2: game tech, web app, security and privacy

Branch `claude/sleepy-rubin-jot35n` at v0.30.0 (HEAD `49aea94`), working tree clean. Reviewed Nov 24, 2026. Scratch scripts and screenshots are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round2/r3/` (named `e*.js` for Node and `t*.py` for Playwright below). Every browser run blocked `*.supabase.co` at the context level with service workers off. No traffic went to Supabase or the live site.

## 0. Round-1 status

Since round 1, nothing in my area has been touched. `git diff 6edcc3d..HEAD` is empty for `build.js`, `src/map.js`, `src3d/`, `src/style.css`, `src/index.template.html`, `manifest.webmanifest` and `.github/`. `src/ui.js` changed in three hunks: the order menu, "Run the code" and the verdict text. `sw.js` changed only its cache name.

| ID | Round-1 severity (Verifier) | Status | Evidence |
|---|---|---|---|
| R3-01 Forged, flooded, impersonated class results | Critical (High) | Still open | `cbFetch`/`ACT.cbSend` (`src/ui.js:1986`, `:2389`) are unchanged. I intercepted a v0.30.0 POST (`t5_send.py`): `{"ver":"0.30.0","code":"062-81F","name":"Instructor","score":90,"stars":3,"real_sec":0,…}` from a shift the autopilot played. |
| R3-02 Names and scores readable by anyone with or guessing a code | Critical (High) | Still open | `cbListHTML()` is still drawn inside every player's Class code sheet (`src/ui.js:1978`). `cb_class` still takes only `p_code`. The code space is unchanged: 131,072 seeds per setup. |
| R3-03 Backend security unverifiable and shared with Case Room | High | Still open | There is no `supabase/` folder and no `*.sql` file. The brief says the `ver` and stats migration is "not applied yet", so the schema still lives only in the dashboard. |
| R3-04 One exception freezes the game silently | High | Still open | `frame()` (`src/ui.js:2741`) is unchanged: no try/catch, and `requestAnimationFrame` is still last. Repro (`t4b_crash.py`): one injected throw in `OC.step` stopped the clock at 4.03 for good. `scene: game`, `paused: false`, no modal, no message. |
| R3-05 Lost WebGL context leaves a blank floor | High (Medium) | Still open | `grep contextlost` over `src/` and `src3d/` finds nothing. `src3d/` is untouched. |
| R3-06 Pages publishes the repo | High | Still open (unverifiable) | `pages.yml` is still not on `main`. The last deploy of `main` is the legacy `pages-build-deployment` (run 45240789894). The proxy refused the Pages API from here. This branch now also carries `docs/PRO_AUDIT.md`, the round-1 reports and this folder. |
| R3-07 Gate: plaintext password, bypass, blank screen | Medium | Still open (owner: won't fix) | The gate code is unchanged. |
| R3-08 Class shift silently discarded after an update | Medium (High) | Still open, and this release triggers it | `t1_classsave.py`, with the real `main` build: a class shift saved on v0.29.0 (and one on v0.29.1) gets **no Resume button and no message** on v0.30.0. The save stays in storage until the next shift overwrites it. A non-class save resumes. |
| R3-09 No real save versioning | Medium | **Worse** | `G.v` is still 5 (`src/engine.js:846`). Phase 1 added `p.code`, `p.tArrest`, `p.lyticLate`, `stats.noTeam`, `stats.lyticLate` and `stats.md.codeRight/codeWrong` with no migration, and `load()` still only fills `G.spec`. Old saves now kill in-progress arrests on the first tick (R3.2-02). |
| R3-10 Service worker hangs, thin precache, no update UX | Medium | Still open | Only the `CACHE` line of `sw.js` changed. |
| R3-11 Class code sheet overflows sideways | Medium | Still open | `t4_crash_cc.py`: sheet `scrollWidth` is 437 px at 320, 360 and 390 px. The new `docs/SMOKE.md` line "Make a code; it shows on screen without sideways scrolling" fails on v0.30.0. |
| R3-12 Keyboard and screen-reader access | Medium | Still open | The new code card repeats it (`t3_codecard.py`). Focus stays on `BODY.md ingame`. Tab walks the four card buttons, then leaves the `aria-modal` dialog for the board behind it. |
| R3-13 Double submit and resend on any 400 | Medium | Still open | `t5_send.py`: after a reload, Send is offered again, and a second identical POST went out. The fallback still resends on any HTTP 400. |
| R3-14 No network timeouts | Medium | Still open | `cbFetch` is unchanged. |
| R3-15 Privacy text wrong and incomplete | Medium | Still open | `src/ui.js:2598` is unchanged ("shares your name and score with that class"). The name box is still `autocomplete="given-name"`. |
| R3-16 Render every 110 ms in every scene | Low | Still open | Code unchanged. Not re-measured. |
| R3-17 3D floor heavy at "battery saver" | Low | Still open | `src3d/` untouched. |
| R3-18 Save grows without limit | Low | Still open | `e6_size.js`: Full Moon Friday reaches 33, 51, 102, 155, 223 and 256 KB every 2 h (RN). The attending reaches 283 KB. v0.29.1 is identical. |
| R3-19 Test and cheat hooks in production | Low | **Worse** | `OC` grew from 215 to 223 members. The new ones include `CODE_Q` (the ACLS answer key), `codeSteps`, `toArrest` and `harmCheck` (R3.2-07). |
| R3-20 CSP limits | Low | Still open | `build.js` and the template are unchanged. |
| R3-21 Unminified bundle, uncacheable fonts | Low | Still open | The page is now 1,005,581 bytes (346,097 gzipped), up 19 KB. |
| R3-22 Incomplete manifest | Low | Still open | Unchanged. |
| R3-23 Silent dt clamp | Low | Still open | `frame()` is unchanged. |
| R3-24 Nitpicks | Nitpick | Still open | All eight are as before. |

**Counts: 24 items. 0 fixed, 0 partly fixed, 22 still open, 2 worse (R3-09, R3-19).** No round-1 Critical or High item in my area has had any work.

## 1. Verdict

**No.** Phase 0 and Phase 1 did not touch the classroom backend, the frame loop, the service worker or the class-save path, so every security and robustness reason I gave in round 1 still stands. The deploy that ships this release will itself drop every class shift in progress without a word. The new arrest code is better than the code it replaced: the cards pause the clock, don't stack, and survive a save. But it adds state that leaks. A code whose provider goes home sticks in "CPR in progress" for the rest of the shift and is never counted, which is the R5-02 dead end the release claims to have closed. Old saves kill arrests at load. The new safety net has a test that asserts nothing, and it doesn't cover the saves it is supposed to protect.

## 2. Score

**4 / 10.** The new code is guarded more carefully than the old, but nothing a professional would reject this for has moved. The saves and the arrest state machine now have new holes, and the test net misses them.

## 3. New findings (worst first)

None of the new findings is Critical or High. All of them are in, or exposed by, the Phase 0 and Phase 1 changes unless marked otherwise.

### R3.2-01 · Medium · A code whose provider leaves mid-code never ends, is never counted, and restarts with stale state (Phase 1)
- **Location:** `src/engine.js:2113` (`arrestNoTeam` returns early whenever `p.code` is set), `:3565` (`orphanPatients` sets `p.ev = 'none'` but leaves `p.code`), `:1973` (`codeTeam`: `if (!p.code) codeStart(p)`), `:2062` (`codeStart` computes `wait` and `me` once).
- **Repro:** `e1_orphan.js` and `e2_orphan_end.js`, Manic Monday, seed 4244. A provider's patient arrests and the provider starts the code. The provider then leaves through `staffGone`, the same path the random `sick` event uses (`EV.sick` can pick an `md` or `app` mid-code; only `G.me` is excluded).
  - **Nobody reassigns (RN mode):** at 19:00 the patient still reads "No pulse. CPR in progress" and `dx: 'Cardiac arrest'`. They aren't in `noTeam` and aren't in `expired`. That is 11 hours of CPR, and the report hides the death, which is the exact R5-02 hole Phase 1 claims to have closed. The README says "an arrest nobody runs for 20 minutes is a death, counted in the report". That is false on this path.
  - **Reassigned 60 minutes later:** `p.code.wait` is still 0, so the odds treat a 79-minute arrest as if the team was there at once.
  - **The attending takes over the orphaned code:** `p.code.me` stays `false`. The player taps "Run the code" and gets **0 rhythm-check cards**, with the outcome scored at the bot's fixed 0.6 quality.
- **Why it matters:** It brings back a stuck state in the feature this release is built around, through a normal random event. It is rare (a provider has to call out sick during a 15-minute code), which is why it is Medium and not High.
- **Fix:**
  - Drop `|| p.code` from the guard in `arrestNoTeam`. `p.arrest` is already false after an outcome, so the clause only ever catches the orphan case.
  - When `orphanPatients`, `unassign` or `setPit` drop a `code` task, set `p.code = null`, so the next `codeStart` recomputes `wait` from `p.tArrest` and `me` from the new provider.
  - Add a rule test: start a code, `staffGone` the provider, run 25 minutes, and expect death plus `noTeam`.
- **Effort:** S.

### R3.2-02 · Medium · v0.29.x saves: an arrest in progress is pronounced dead at load, and an attending's code shows its cards after the outcome and pays points for a dead patient (Phase 1, root cause R3-09)
- **Location:** `src/engine.js:2113` (`ref = p.tArrest ?? p.tArrive`), `:2088` (`codeOutcome` → `codeStart` → `codeCard` when `p.code` is missing), `:2075` (`codePick` never checks `p.arrest`). `G.v` is still 5 (`:846`). `OC.load` doesn't migrate.
- **Repro:** `e3_oldsave.js` builds states with the real v0.29.1 engine, JSON round-trips them as the UI does, and loads them into v0.30.0.
  - **(b) Charge nurse:** a patient who arrived 69 minutes earlier arrests one minute before the save. 0.2 game minutes after the resume they are "Died in cardiac arrest: no code team", with the toast "Nobody ran the code" and −40 care.
  - **(c) Attending:** your own patient arrested 2 minutes before the save. Same result: dead at load.
  - **(d) Attending mid-code** (the v0.29.1 "Run the code" on an unassigned arrest), saved 5 minutes in. On v0.30.0 the code resolves "Resuscitation unsuccessful" with `wait: 40`, taken from `tArrive`, and 0 of 3 right. **Then** the three rhythm-check cards appear for the dead patient. Each right answer toasts "Right", adds +4 care and counts `codeRight`.
  - **Fuzz (`e4_fuzz.js`):** 72 resumed saves (36 from v0.29.0, 36 from v0.29.1, both roles, three levels), 120 game minutes each. No exceptions, which is luck, as in round 1. 1 of the 3 arrests in those saves died on the first tick.
- **Why it matters:** A non-class v0.29.0 save does resume on v0.30.0 (`t1_classsave.py`), so these are real paths for live players on update day. A shape change without a version bump is the textbook way to corrupt saves, and this release did it again.
- **Fix:**
  - Set `G.v = 6`.
  - Add `migrate(G)` in `load`: for every `p.arrest` without `tArrest`, set `tArrest = G.t`. For an in-progress code task without `p.code`, call `codeStart` without a card.
  - In `codeOutcome`, set `p.code.done = true` and clear `G.card` if it is this patient's code card.
  - In `codePick` and `codeCard`, return unless `p.arrest`.
  - Add a golden case that loads a frozen v0.29.1 save fixture.
- **Effort:** M.

### R3.2-03 · Medium · The Phase 0 safety net claims coverage it doesn't have (Phase 0 and 1)
- **Location:** `test/rules11.js:156-157`, `test/golden.js:66` and `:76-84`.
- **What's wrong:**
  - **The "unknown stream" check asserts nothing.** "ok - an unknown random stream is refused" passes because `OC.inStream` is not exported (`node -e` shows `typeof OC.inStream === 'undefined'`), so `assert(!OC.inStream || threw)` is always true.
  - **One field is a tautology.** `golden.js` records `bytesAt3h: saved.length > 0`, which can never be false.
  - **The save round trip covers one narrow case.** It is one charge-nurse shift at 3 hours, loaded with `OC.load(JSON.parse(...))`.
    - It never goes through `readSave` (the version gate behind R3-08).
    - It never saves with a card open, during a code, or in attending mode.
    - It never loads an older version's save.
    - Those are the only places the round-2 save defects live (R3.2-01, R3.2-02, R3-08).
  - **The codes section only tests the current version** (`setCodeVersion(VERSION, [])`). Nothing checks that a past-version code reads as stale, which is the whole point of the version salt.
- **Why it matters:** `npm test` reports 587 ok and 0 FAIL in 38 s (I ran it in a scratch copy). The owner will read that as "saves and streams are covered". They aren't.
- **Fix:**
  - Export `inStream` for tests, or test it through a module-private hook, and assert that it throws.
  - Replace `bytesAt3h` with a real size budget.
  - Add round trips for an attending mid-code with a card open, and for frozen v0.29.0 and v0.29.1 save fixtures through the UI's `readSave` logic (move it into the engine).
  - Add a stale-code assertion for `PAST_V`.
- **Effort:** S.

### R3.2-04 · Medium · "Every 2 minutes" rhythm checks all happen at one instant, then the code idles for 15 minutes (Phase 1)
- **Location:** `src/engine.js:2075-2085`. `codePick` calls `codeCard` for the next step at once, the sim is halted while any card is up (`stepInner` returns on `G.card`), and `codeOutcome` fires when the fixed 15-minute `code` task ends.
- **Repro (`e8_timing.js`):** card 1 at +0.1 min, card 2 at +0.1 min ("Two minutes of CPR. Rhythm check…"), card 3 at +0.1 min ("Two more minutes…"), then the outcome at +15.1 min. `t3_codecard.py` shows the same in the UI: the clock doesn't move between cards.
- **Why it matters:** The cards say time passed and it didn't. The 2-minute CPR cycle the cards teach never happens on the clock. The board stands still for the whole decision sequence, then nothing happens for 15 minutes. For a real-time sim that sells "every minute without a doctor lowers the odds", that is a broken timing model.
- **Fix:** Store `p.code.next = G.t + 2` after each answer, and have `flowTick` raise the next card when `G.t >= next`. Resolve the outcome after the last check, at about 2 minutes × number of checks, instead of on a fixed 15-minute task.
- **Effort:** S.

### R3.2-05 · Low · `inStream` now throws inside the live frame loop, and its slot table doesn't match how the streams are seeded (Phase 1)
- **Location:** `src/engine.js:56-60` and `:847`.
- **What's wrong:**
  - A future unknown stream key throws from `E.step`. Because R3-04 is open, a player gets a silently frozen shift, not a failed test. Failing loudly is right in a test and wrong in production with no crash guard.
  - The table says `rngS: 5`, but `newGame` seeds `rngS` with `seedOf(seed, 6)`. Slot 5 is used only if a save lacks `rngS`, which gives a different sequence than a fresh game.
  - The comment says "every stream has its own slot: a shared one would desync class shifts", yet `rngE` is shared by `regionTick` and `eventsTick`.
- **Fix:**
  - Validate the keys at load. They are literals, so a `lintStreams()` next to `lintCases()` can check them.
  - Keep the runtime throw behind a dev flag.
  - Seed every stream from one table in both places.
- **Effort:** S.

### R3.2-06 · Low · The version bump: 2.1% of live codes still play, as a different shift, and the golden codes break on every release (release and Phase 0)
- **Location:** `src/ui.js:1967` (`PAST_V = ['']`), `test/golden.js:66`.
- **Measured (`e5_codes.js`):**
  - Of the 131,072 default-setup codes made on v0.29.0 (live), **2,768 (2.1%) read on v0.30.0 as current codes**, with the same settings and seed. They start without any warning, on a changed engine, so they are a different shift from the one students who started before the deploy are playing. The docs promise "about 63 in 64" refused; the real rate is 1 in 47.
  - Single-character typos of v0.30.0 codes: 1.13% start a different valid shift, and 1.44% are told the code was "made on another version".
- **Also:**
  - Every golden code string is salted with `VERSION`, so the codes section fails on every version bump. The release commit `f59708d` had to rewrite all 20. A safety net that breaks on every release teaches people to run `golden:update` without reading it.
  - Until the `ver` column exists, results from both versions under the same code string are mixed in `cb_class` with no version tag.
- **Fix:**
  - Golden: pin the codes with a fixed test salt, and test the version salt separately.
  - Correct the docs to about 1 in 47 for a release with one past version.
  - Apply the `ver` migration before v0.30.0 ships.
- **Effort:** S.

### R3.2-07 · Low · New console exports: the ACLS answer key and a "kill any patient" function (Phase 1, adds to R3-19)
- **Location:** `src/engine.js:4655` (OC export line).
- **What's wrong:**
  - `OC.CODE_Q` is the full answer key, with the right choice flagged.
  - `OC.codeSteps(OC.pt(OC.G.card.ctx.pid))[OC.G.card.ctx.step].c.find(x => x[2])` names the right button on the card on screen.
  - `OC.toArrest(p)` arrests anyone.
  - The card's choice order comes from `vhash(p.id + 'cq' + step + i)`, so it is identical for every student with the same patient id, and "pick the second one" can be passed around a classroom.
- **Why it matters:** It adds to R3-01. Class scores are self-reported and now trivially perfect in the attending's code cards too.
- **Fix:** As R3-19: expose test hooks only on `?test=1`, localhost or `file://`. Shuffle the choices per device (UI-side) rather than per patient. Grading doesn't depend on position.
- **Effort:** S.

### R3.2-08 · Low · In the attending game, "no code team" deaths of patients nobody gave a room are filed under the attending (Phase 1)
- **Location:** `src/engine.js:2113-2123` (`mm(90, …, true)`), `src/ui.js` `mdPrimary0`. For `p.loc !== 'room'` the attending sees "The charge nurse is working on a room" and has no button.
- **Measured (`e7_noteam.js`, 6 autopilot shifts):** all 7 no-team deaths were patients in the waiting room or on the EMS wall. The AI charge nurse never roomed them. In attending mode they land in the player's own M&M as "20 minutes of CPR and no doctor ever ran the code".
- **Fix:** In attending mode, attribute a no-team death outside a room to the charge nurse (`own = false`), or word it "never got a resus bay".
- **Effort:** S.

### R3.2-09 · Low · The new smoke checklist fails on this release, and it skips the risky flows (Phase 0)
- **Location:** `docs/SMOKE.md`.
- **What's wrong:**
  - "Make a code; it shows on screen without sideways scrolling" fails on v0.30.0 (R3-11).
  - It has no lines for:
    - an update deployed while a class shift is saved (R3-08);
    - resuming mid-code;
    - the gate on a slow network (R3-07);
    - what the player sees after an error (R3-04).
- **Fix:** Fix R3-11, or the checklist is fiction. Add the four lines.
- **Effort:** S.

### R3.2-10 · Nitpick · `p.code` is never cleared (Phase 1)
- **What it causes:**
  - `flowTick` evaluates `codeSteps(p)` (two array allocations) for every patient who ever had a code, every 0.1 game minute, until they leave (`src/engine.js:2937`).
  - `taskDone` permanently ignores `eval` and `reassess` for any patient with a past code (`:1525`). It is harmless today only because a ROSC patient never needs either.
- **Fix:** Set `p.code.done`, and test `p.arrest`, not `p.code`.

### R3.2-11 · Nitpick · Dead patients' vitals reuse `arrest: true` to hide the numbers (Phase 1)
- **Location:** `src/engine.js:1081` (`vitalsOf`).
- **What's wrong:** It returns `{ arrest: true, dead: true, … }`. Any future consumer that reads `v.arrest` as "in arrest" (the code alarm, the beacon) will fire for the dead.
- **Fix:** Use `dead` only, and branch on it in `vitalsHTML`.

### R3.2-12 · Nitpick · The code card adds one more dialog with no focus management (Phase 1, part of R3-12)
- **Verified:** focus is not moved in, Tab leaves after four buttons, and Escape does nothing. That last one is right for a forced decision, but it isn't announced.

### R3.2-13 · Nitpick · The page passed 1 MB (release)
- **What's wrong:** It is 1,005,581 bytes, up 19 KB, mostly inline ACLS prose, and still unminified (R3-21).

### R3.2-14 · Nitpick · The `PAST_V` rule is a trap (release)
- **Location:** CLAUDE.md, "set `PAST_V` to the version being replaced".
- **What's wrong:** This release correctly kept `['']`, because the live v0.29.0 codes carry no version. Read literally, the rule would have set `['0.29.1']` and turned every live code into "mistyped". The rule needs to say "the version live on the site, `''` for v0.29.0".

## 4. Coverage

**Read:**
- The whole `git diff 6edcc3d..HEAD` for `src/engine.js`, `src/ui.js`, `sw.js`, `package.json`, `README.md` and `CLAUDE.md`.
- `test/golden.js` in full, the arrest and stream parts of `test/rules11.js`, and `docs/SMOKE.md`.
- The code around every new state field: arrest, code, tasks, orphaning, cards, lytic window, pharmacist and nurse task paths.
- I confirmed by diff that `build.js`, `src/map.js`, `src3d/`, CSS, the template, the manifest and the workflows are unchanged since round 1, so my round-1 reading of them stands.

**Ran:**
- **Node, `e1` to `e9`:**
  - orphaned codes in both roles;
  - v0.29.1 states loaded into v0.30.0;
  - a 72-save fuzz from v0.29.0 and v0.29.1;
  - live-code and typo acceptance across the version bump;
  - save size over a full shift;
  - no-team death causes;
  - rhythm-check timing;
  - lytic-window re-ordering (no double count; not a finding).
- **`npm test` in a scratch copy:** 587 ok, 0 FAIL.
- **Playwright in Chrome:**
  - class and non-class saves from the real v0.29.0 and v0.29.1 builds resumed on v0.30.0 (`t1`);
  - a code card through tap, keyboard, save, reload, resume and the outcome (`t3`; screenshots `shots/t3_code_card.png`, `shots/t3_after_resume.png`);
  - exception injection and class-sheet width (`t4`, `t4b`);
  - the results POST and a resend after reload, with a mocked backend (`t5`);
  - an arrest with the order sheet or diagnosis question open (`t6`: no errors, no stale Sign button).
- **Checked and not a finding:**
  - Code cards don't stack: every `setCard` caller checks `G.card`.
  - They can't deadlock the clock: the sim halts and the player must answer.
  - They survive a save mid-code.
  - `lyticWindowClosed` can't orphan a nurse or pharmacist task: `verified` and `treatDone` guard missing items.

**Couldn't check:**
- The Supabase schema, RLS, rate limits and RPC bodies. They aren't in the repo, and traffic is off-limits.
- Whether the Pages source has been switched. The GitHub Pages API is blocked by the proxy, and only the run history was readable.
- Real phones, WebKit and Firefox.
- WebGL context loss and 3D or render performance. That code is unchanged, so I didn't re-run them.
- The gate under network faults. The code is unchanged, so I didn't re-run it.

## 5. What I'd grudgingly keep

- The code card sits in `G` as plain JSON, halts the sim while it's open, and comes back intact after a reload mid-code.
- Every card-raising call site checks `G.card` first, so the new modal can't overwrite or be overwritten.
- The rhythm and cause come from the patient id, not the dice, so a class sees the same arrest.
- No-team deaths and dead-but-not-yet-gone patients are now counted in the report (except on the R3.2-01 path).
- `golden.js` exists, and it compares whole-state hashes, not just headline numbers.
- `inStream` refusing to share a slot is the right instinct, put in the wrong place.
- `esc()` and number coercion on every database field in the results table are still intact.
