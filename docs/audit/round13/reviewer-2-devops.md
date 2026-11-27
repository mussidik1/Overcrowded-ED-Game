# Round 13, Reviewer 2 (DevOps, tooling, docs, legal): release review of v0.33.0

Branch `claude/sleepy-rubin-jot35n`, HEAD `895bc15`. Diff: `git diff 78916ef..HEAD` over the brief's paths, plus `package.json`,
`package-lock.json`, `docs/audit/phase4.md`, `docs/SMOKE.md`, `spec/*`. Run in a scratch copy; no contact with supabase.co or
edcodeblack.com.

## 1. Verdict

**Ship behind the gate after R2.13-01 and R2.13-02 (docs, about 30 minutes).** The mechanics are sound:

- Version 0.33.0 and `PAST_V = ['0.32.0']`.
- A clean build matches the committed `index.html`, `sw.js` and `3d/map3d.js` byte for byte.
- Lint is clean, and `npm test` gives 782 ok.
- `crash_test.py` and `career_test.py` pass.
- CI runs on the branch: 11 of the last 12 runs were green.
- The deploy packages `THIRD_PARTY_NOTICES.txt`, and the LICENSE matches the owner's choice.

The paperwork is not done:

- The README has no v0.33.0 paragraph.
- `docs/SMOKE.md` is stale.
- One flaky UI test, `events_test.py`, makes "green at the exact commit" a re-run lottery.
- The lint config doesn't enforce the engine's "never" rules.

## 2. Score: 7/10

## 3. Findings (worst first)

### R2.13-01 Medium: no v0.33.0 release paragraph; the README still advertises the giveaways Phase 6 removed

- **Location:** `README.md`. The newest release paragraph is v0.32.0.
- **Present-tense text that is now wrong on regular shifts:**
  - Line 122: an incomplete workup names what is still needed.
  - Line 134: the wrong consultant says who to call.
  - Line 134: the card explains the workup.
  - Lines 180–181: "under any name".
- **Missing:** career rank, the attending's own-calls grade, the Rush pace cap, the attending's load by level, the crash guard and safe saves, 12 px text and 44 px controls, the replace question, and stale v0.32.0 codes.
- **Fix:** add the paragraph; mark the Orientation-only behaviours; change "any name" to "any initials".
- **Effort:** 20 min.

### R2.13-02 Medium: the pre-merge phone checklist is stale, and one step now fails by design

- **Location:** `docs/SMOKE.md` was not touched this release.
  - Line 33, "Send with a first name says it went", now fails: the Send box takes initials only.
  - Nothing checks the crash screen, the replace question, rank, the own-calls grade, the pace cap, the 44 px strip, or the absence of giveaways.
  - `CLAUDE.md:136` still says "first name or initials".
- **Fix:** update line 33; add about six lines; fix CLAUDE.md.
- **Effort:** 15 min.

### R2.13-03 Medium: `events_test.py` is flaky; the branch's only red CI run was a docs-only commit

- **What fails:**
  - CI run 45935669651 at `220b1ab` (spec changes only) failed at line 73: `#btnMsgs` was inert because a modal was open.
  - Locally it went pass, pass, FAIL, FAIL: the ambulance-animation checks fail after the new arrival-card wait.
- **Fix:** sample the ambulance before waiting for the cards; wait for `#btnMsgs` to be outside `[inert]`.
- **Effort:** 30 min.

### R2.13-04 Low: the lint config doesn't enforce the engine's "never" rules and allows browser globals in a DOM-free file

- **What passes:** appending `status + name + Math.random() + document.title` to `src/engine.js` still lints clean.
- **Fix:**
  - `no-restricted-properties` for `Math.random` in the engine.
  - An explicit short globals list for the engine.
  - `no-restricted-globals` for `name`, `status`, `event`, `length`, `top` and `close`.
- **Effort:** 20 min.

### R2.13-05 Low: stale test counts and commands

- **CLAUDE.md:**
  - Says "rules.js through rules14.js, ~760". It is now through rules15.js, with 782.
  - The Layout line doesn't mention rules15.
  - The line counts are out of date.
- **README Development section:**
  - Says "rules13.js, about 700".
  - Uses `npm install`.
  - Doesn't list lint or the new UI tests.

### R2.13-06 Low: the "initials only" privacy claim is enforced only in the game

The server rule and `client_call.json` still accept up to three words. A direct `cb_submit` call can store a full name. Scope the
public text, and track a server-side migration.

### R2.13-07 Low: the LICENSE

- The copyright holder is a GitHub handle, not a legal name.
- The game is also served at `*.github.io` and as the private Claude copy.
- The LICENSE contradicts GitHub's Terms (view and fork).
- It doesn't carve out `docs/em-model` (ABEM material).
- Every commit is authored as Claude, so how far "all rights reserved" is enforceable is uncertain.
- **Fix:** the owner's legal name, a grant consistent with GitHub's Terms, and an ABEM carve-out.

### R2.13-08 Low: some copies ship third-party code or fonts without their notices

- `3d/map3d.js` drops the meshoptimizer MIT notice (it is a `//` comment).
- `pack3d.js` doesn't copy `THIRD_PARTY_NOTICES.txt`.
- The inlined Cardo fonts carry no OFL comment.

### R2.13-09 Low: no drift check on generated credits and notices; the live check doesn't confirm the notices file

- Nothing regenerates and compares `img/CREDITS.md`.
- An unknown licence string silently gets no link.
- The three.js year is hard-coded.
- The live check doesn't fetch `THIRD_PARTY_NOTICES.txt`.

### R2.13-10 Low: the release goes ahead on a QA FAIL; spec STATUS doesn't record it

Record the v0.33 cycle in STATUS, and get the owner's written sign-off on F-134 to F-144 by ID before the merge.

### R2.13-11 Low: the deploy's packaging job installs about 90 lint-only packages

Use `npm ci --ignore-scripts` in the packaging job, or run lint there too.

### R2.13-12 Nitpick: CI runs twice for an in-repo pull request (push and pull_request refs differ)

### R2.13-13 Nitpick: the crash screen says "send them" to no one

Also, CLAUDE.md says taps run inside the crash guard, but menu taps rethrow.

### R2.13-14 Nitpick: `img/CREDITS.md` wording

- The count reads as 26 pictures.
- The "Shows" column holds file names.
- "BMC neurology" should be capitalised.
- The cropped list is hard-coded.
- Author names aren't escaped.

### R2.13-15 Nitpick: other docs

- `art/blender/README.md` says nothing there is used by the game yet.
- "David Perry" versus "David J. Perry".
- phase4.md says "11 interactive lessons", but 2 are read-through.
- The mesh2motion CC0 claim is unverified.
