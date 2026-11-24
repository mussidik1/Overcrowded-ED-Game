# Reviewer 6, round 4: clinical accuracy and medical education

Role: board-certified emergency physician and paramedic educator. Branch `claude/sleepy-rubin-jot35n`, v0.31.0, HEAD ce11887. Phase 2 is `git diff 101e07a..ce11887`. Reviewed 2026-11-24.

**Not re-reported:** items that `docs/audit/round2/STATUS.md` and `round3/STATUS.md` defer or waive, unless they got worse.

**Scripts and screenshots** are in `/tmp/claude-0/-home-user/286dd7cf-48a1-5847-834d-1aabfe7b01a4/scratchpad/round4/r6/`.

**Node scripts** (each runs the real engine through whole shifts):

| Script | What it plays |
|---|---|
| `s1.js` | Attending: perfect, poor and idle play, on the same seeds |
| `s2.js` | Charge nurse: full, slow and idle play |
| `s3.js` | The idle attending's report |
| `s4.js` | The idle attending's ledger |
| `s5.js` | An attending who only answers the radio |

**Playwright scripts** (Chrome, 390×844). `fetch` is replaced in the page, and every non-file request is aborted:

| Script | What it shows |
|---|---|
| `ui1.py` | The About page |
| `ui2.py` | A fired attending's class shift: make the code, Send, the instructor's table |
| `ui3.py` | The idle attending's summary |
| `ui4.py` | The radio-only attending's summary |
| `ui5.py` | A shared classroom device |

Screenshots are in `shots/`.

## 0. Did any clinical content change in Phase 2?

**No.** The evidence:

- **The engine is byte-identical.** `src/engine.js` is the same blob at both commits (`dfbf2ad45b868b5a6fe826ba5939ed480601ff4f`). Also identical: `src/map.js`, `src3d/map3d.js`, `test/rules10.js`, `rules11.js`, `rules12.js` and `test/golden.js`.
- **The ui.js changes avoid the clinical text.** The hunks in `src/ui.js` are only at:
  - 1998–2098: the class code sheet and class results
  - 2413–2514: the class-code `ACT` actions
  - 2640: the About page's Privacy section
  - 2817 and 2844: `bind`, the Enter key, and `gatedHost`

  `GLOSS` (line 1226), `LESSONS` (1836), the orders, the cards and Orientation are untouched.
- **Golden.** `test/golden.json` changed only its `"version"` line.
- **The tests pass.** The full `npm test` was killed by the kernel for lack of memory (other reviewers share the container). I ran its 13 steps one at a time.
  - `rules.js` to `rules12.js`: **685 "ok", 0 FAIL**. rules12 now holds 100 checks.
  - `golden.js`: "13 shifts, 3 stream checks, 20 codes, save round trip, **71 answer keys unchanged**", plus the scripted-code and save checks.
- **One payload change, with no effect today.** `p_score` is now `Math.round(+R.avg || 0)`, clamped to 0–100, instead of `R.avg != null ? R.avg : R.care` (ui.js:2490).
  - `avgScore()` has always returned a number since v0.25, so the value sent is unchanged.
  - Only a report from before v0.25 would differ, and such a report can't carry a registered code.
- **What the phase changed is what the instructor and the student are told.** That is reviewed below. The round-3 clinical items are unchanged by this phase, and I did not re-audit them.

## 1. Verdict for use with real students

**Clinical content: still "only after major work"**, unchanged from round 3.

**Class results:**

- **Charge nurse:** usable for discussion, not for grades.
- **Attending:** **not usable**.
  - The one number the instructor gets is mostly the computer's work.
  - An attending who never sees a patient but answers the radio gets 91–94 points and 3 stars.
  - An attending who is fired for 5 of 16 diagnoses ranks above a student who finished the shift.

**Privacy (the point of Phase 2):** a real improvement, but the wording overclaims.

- Names are no longer public. Only the instructor's key reads them, and everything is deleted after 30 days.
- But "only the instructor can see it" is false: the operator can see it too.
- On a shared classroom device, one tap sends a result under the previous student's name.

**Disclosure:** no student or instructor can see that no licensed clinician has reviewed the content.

- The README and CLAUDE.md say it, but the repository is private and the deploy publishes neither file.
- The in-game text never says it.

## 2. Score

**4 / 10.** Unchanged.

- The clinical content is byte-for-byte what round 3 scored.
- The Phase 2 privacy design is better than what it replaced.
- That is offset by an assessment number that is invalid for one of the two roles, and by a disclosure no user ever sees.

## 3. Findings, worst first

### High

**R6.4-01 · High · The attending's class result measures the computer, not the student. Seeing no patients earns 3 stars, and a fired student outranks finishers**

- **Location:**
  - **The score.** `avgScore()` and `overallStars()` (engine.js:833–834) average four sub-scores: patients, clinical, admin and staff.
  - **What gates them.** In MD mode `care()` (839) holds only the clinical score to the attending's own work. Admin, staff and patient experience come from the department, which `aiTick()` → `botStep()` runs.
  - **No assignment.** `botStep` never assigns a patient to the player: `s.id !== G.me` (4501).
  - **What is sent.** ui.js:2490 sends `R.avg` as `p_score`.
  - **What is shown.** `cbListHTML` (2093) shows it as "Points", sorted best first, with no fail flag.
  - **Accuracy.** `accuracy()` (607) returns `(0 + 10) / (0 + 0 + 10)` = 100% when nothing was done.
- **What's wrong (verified):**

  | Attending (Manic Monday unless noted) | Points | Stars | What the student did |
  |---|---|---|---|
  | **Answers every radio call, sees no patient** (`s5.js`, five seeds, every level including Full Moon Friday) | **91–94** | **3** | 0 patients seen, 0 of 0 diagnoses, "Clinical accuracy 100%", Clinical 100% |
  | Perfect play (`s1.js`, `mdPlay` at accuracy 1.0) | 91–93 | 3 | |
  | **Fired** (`s1.js`, accuracy 0.3) | **82–86** | 0 | Legal risk 75–76%, accuracy 52–61% |
  | **Idle**: answers only its own cards (`s3.js`) | **68–77** | **2** | 0 patients seen, all four levels |

  - **In the browser (`ui4.py`, `shots/p-radio-only-md-summary.png`):** the radio-only attending's summary shows:
    - all four cards ★★★
    - "100% Clinical accuracy · 0 of 0 Diagnoses right"
    - "Patients you saw 0"
    - "1 patient died in the department. The numbers were good; read the worst moments below."
    - then "M&M: Nothing went badly wrong this shift. Take the win."
  - **The idle attending (`ui3.py`)** is told "Solid shift. The nurses like working with you."
  - **The instructor's view (`ui2.py`, `shots/p-instructor-table.png`):** the fired attending's own summary says:
    - "Your group let you go"
    - "5 of 16 Diagnoses right"
    - "Medical direction calls right 3 of 10"

    The instructor's table shows `Sam MD · 85 · ☆☆☆ · 22m · 0`. It is ranked **second, above the idle `74 · ★★☆`**, and nothing in the row says "fired".
  - The only column that would show a shift cut short, "Played", is hidden on a phone held upright (`.cb-p`, style.css).
- **Standard:**
  - INACSL Healthcare Simulation Standards of Best Practice, *Evaluation of Learning and Performance*: a performance measure must be valid for the construct it reports, and aligned with the objectives.
  - The construct here is the attending's own clinical work.
  - An attending is responsible for the patients in their area. A clinician who sees nobody is not "attending of the year".
- **Fix:**
  - **Hold the attending to the department.** Either:
    - the computer charge nurse assigns patients to the player's queue like any provider (drop `s.id !== G.me` at 4501, so unseen assigned patients cost `md` points); or
    - patients waiting for a provider past their ESI target, while the player has room, count against the player's clinical score.
  - **Send and show the attending's own numbers instead of the average:** patients seen (`R.md.seen`), diagnoses right of total, patients hurt by an order, clinical accuracy and legal risk.
  - **Send and show `R.fail`.** Sort fired and walked-out shifts after completed ones, and mark them "Fired" or "Staff walked out".
  - **No vacuous accuracy.** `accuracy()` returns `null` when no diagnoses or orders were scored. The box shows "—".
  - **No stars and no praise for nobody seen.** With `R.md.seen === 0`, give an attending 0 stars and the verdict "You didn't see a patient."
  - **Database.** The `stats_ok` whitelist (migration 20261124120000) needs the new keys. That is a database change, so it needs the owner's approval.
  - **Tests (rules).**
    - A radio-only attending gets ≤1 star.
    - An idle attending gets 0 stars.
    - A fired shift carries `fail` in the payload.
- **Effort:** M

**R6.4-02 · High · No student or instructor can see that no licensed clinician has reviewed the clinical content**

- **Location:**
  - README.md:59 and :112 say it. CLAUDE.md says it.
  - `.github/workflows/pages.yml:38–40` publishes only the game files.
  - `pages.yml:87` **requires** README.md and CLAUDE.md to answer 404 on the live site. The repository is private.
  - In game, the only related line is the About page's "It's a teaching game and isn't clinical guidance. At work, follow your own protocols." (ui.js:2725).
  - `grep -i "clinician\|reviewed\|licensed"` over ui.js finds no player-facing text.
- **What's wrong:**
  - The owner's waiver of the clinician sign-off (round2/STATUS.md) rests on "The README and CLAUDE.md say no licensed clinician has reviewed the content". **No user can read either file.**
  - Phase 2 adds an instructor workflow that collects, ranks and keeps scores built on this content: the instructor key, Class results and Delete. It doesn't add the disclosure to any screen an instructor or student sees.
  - README's "For a class" section, the one written for instructors, doesn't say it either.
- **Standard:**
  - INACSL *Simulation Design*: content is reviewed by subject-matter experts and pilot-tested before use.
  - CAPCE content review for EMS continuing education.
  - Basic honesty in educational material: a learner must know when clinical answers are unverified.
- **Fix:** Add one sentence in three places, with an `about_test.py` check:
  - **About page:** "It's a teaching game and isn't clinical guidance. **No licensed clinician has reviewed its clinical content yet.** At work, follow your own protocols."
  - **The class code sheet's "Make one (instructors)" box, and the instructor-key panel:** "No licensed clinician has reviewed the clinical content yet. Use results for discussion, not grades."
  - **README:** the opening paragraph and "For a class".
- **Effort:** S

### Medium

**R6.4-03 · Medium · Nothing clinical reaches the instructor. Deaths are sent and stored, but never shown**

- **Location:**
  - `cbListHTML` (ui.js:2093–2097) shows Name, Points, Stars, Played, Wait and LWBS.
  - `cb_class_read` returns `stats` with `expired`, `ama`, `seen` and `bedFirst`, plus `level` and `created_at`, none of which is displayed.
- **What's wrong (verified):**
  - **Deaths are hidden.**
    - The payload carries `expired` (`ui2.py` captured `p_stats.expired`), but no column shows it.
    - Charge nurse (`s2.js`): idle shifts had **15–18 deaths**. The table would show "25 · ☆☆☆" and never say why.
    - Two "slow" shifts, one with a death and one without, both scored **72**.
  - **No basis for a debrief.** For the attending, nothing the instructor needs reaches them: accuracy, diagnoses, harm, the radio-call record or the fail flag (R6.4-01).
- **Standard:** INACSL *The Debriefing Process*. The debrief is grounded in performance data tied to the objectives. In emergency medicine, deaths and harm are the first things debriefed.
- **Fix:**
  - **Add a "Died" column now.** `stats.expired` is already stored, so it needs no database change.
  - **For attendings, count only the player's own patients.** Add a new stat (a database change for the owner to approve).
  - **Optionally**, send the four sub-scores and up to three M&M "what" lines. The names in them are fictional patients.
- **Effort:** S (column) / M (new stats)

**R6.4-04 · Medium · On a shared classroom device, one tap sends a result under the previous student's name**

- **Location:**
  - `cbSend` stores the name: `store('oc-cb-name', name)` (ui.js:2485).
  - `cbSendHTML` pre-fills it: `value="${esc(cbName())}"` (2073).
- **What's wrong (verified, `ui5.py`):**
  - With `oc-cb-name = "Sam"` left by an earlier student, the next student's class summary opens with "Sam" in the box. One tap on Send submitted `p_name: "Sam"`.
  - Shared tablets and Chromebook carts are normal in high-school EMT and nursing programs.
  - The name also stays on the device indefinitely. The Privacy section says only "Your shifts, progress and settings stay on this device".
- **Standard:** Integrity of learner records. Data minimisation for minors: keep a child's name no longer than the task needs.
- **Fix:**
  - Don't pre-fill the name from storage. Keep it only in `U` for the current summary.
  - If the owner wants it remembered, show "Sending as **Sam**. Not you? Change it", and clear it after a successful send.
- **Effort:** S

**R6.4-05 · Medium · The privacy wording overstates who can see results, and misstates what is sent**

- **Location:**
  - About page (ui.js:2727): "Only the instructor who made the code can read them".
  - Send box (2072): "Only they can see it".
  - Its sent state (2070).
- **What's wrong:**
  - **Who can read them.** The game's operator runs the Supabase project (shared with Case Room) and can read every name and result in the SQL editor. `supabase/README.md` documents the owner running SQL there. "Only the instructor" is not true.
  - **What is sent.** The About page lists "your score and stars, the time you played and a few shift numbers (average wait, walkouts, patients seen)". What's actually sent (`ui2.py`) also includes:
    - **patients who died** (`expired`)
    - patients who left against advice
    - patients bedded before registration
    - the scenario, the role, the shift level and the game version
    - a random id
  - **"Patients seen" is mislabeled.** It is `R.seen`, every arrival in the department. The idle attending who saw 0 sends `seen: 52`.
- **Standard:**
  - FTC Act §5: a privacy statement that understates who has access is a deceptive statement.
  - For an audience that includes minors, the notice must be complete and plain.
- **Fix (exact text):**
  - **About page:** "**Class results.** After a class-code shift, **Send** sends the name you type (first name or initials), your overall score (0 to 100) and stars, the time you played, your role and shift, and a few shift numbers: average wait, how many patients arrived, left without being seen, left against advice, died, or were bedded before registration. It goes to the game's database (Supabase, in the US). The instructor who made the code reads it with that code's key. The game's developer, who runs the database, can see it too. Everything sent for a code is deleted 30 days after the code was made. To have yours deleted sooner, ask your instructor."
  - **Send box:** "Your first name or initials, your overall score and a few shift numbers go to the instructor who made {code}. The instructor and the game's developer can see them. They're deleted 30 days after the code was made."
- **Effort:** S

**R6.4-06 · Medium · The number sent to the instructor never appears on the student's summary, and "points" means two different things**

- **Location:**
  - `reportHTML` / `scoreCardsHTML` (ui.js:2771–2810) show four percentage cards and "Where your points came from" in ledger units ("+263 Patients moved").
  - The Send box sits right under them (`shots/p-send-box.png`).
  - The instructor's column header is "Points" (2093).
  - `starLine()` (2813), the only text that explains points, is defined but never called.
- **What's wrong (verified, `ui2.py`):**
  - The fired attending's summary shows:
    - Patients 86%, Clinical 69%, Admin 98%, Staff 86%
    - "5 of 16 Diagnoses right"
    - a ledger in the hundreds
  - The instructor receives **85**, a number that appears nowhere on the student's screen.
  - "Your first name or initials **and these results** go to the instructor" invites the student to think the whole summary goes.
  - In a debrief, student and instructor are quoting different numbers.
- **Standard:** Transparency of assessment. The learner sees exactly what is reported about them.
- **Fix:**
  - **Put the payload in the Send box:** "Sends: Sam · overall 85 (the average of your four scores) · ☆☆☆ · played 18:20 · wait 22m · 0 walkouts · 0 died".
  - **Rename the instructor column** "Overall", or show the four sub-scores (R6.4-03).
- **Effort:** S

**R6.4-07 · Medium · "Self-reported" understates the problem: anyone with the code can send any score under any name, as often as they like, and the instructor can't tell**

- **Location:**
  - `cb_submit` (migration 20261124120000): no per-name or per-device limit. The `cid` is per report, so a replay of the same shift ("Run it back") sends a new result.
  - `cb_class_read` returns `created_at`, which `cbListHTML` never shows.
  - Instructor text (ui.js:2092): "Scores are self-reported: a player can change theirs before sending."
- **What's wrong:**
  - **Impersonation.** `supabase/README.md` admits "someone who holds a class code can still send made-up results to that class". A student can send a result as a classmate.
  - **Repeats are invisible.** A student can replay and resend until a high score sorts to the top. With no time shown, the instructor can't tell a first attempt from a tenth.
  - **No grading guidance.** Nothing on the instructor screen says not to grade from it.
  - **The README hints the opposite.** It says "Without a code … scores are for discussion, not for ranking". That implies ranking is fine with a code.
- **Standard:** Summative assessment needs authenticated identity and a defined attempt. Formative use needs at least an attempt order.
- **Fix:**
  - **Instructor text:** "Anyone with the code can send a result under any name, as often as they like, and can change their score first. Use these for discussion, not grades."
  - **Show the time each result was sent.** `created_at` already comes back.
  - **Mark a repeated name** "2nd try" and so on.
- **Effort:** S

### Low

**R6.4-08 · Low · An attending's "Wait" and "LWBS" columns are the computer charge nurse's numbers**

- **Location:** `R.wait` = `avgWait()` and `R.lwbs` = `S.lwbs` are department-wide (engine.js:4355, 4400).
- **What's wrong:** In `s1.js`, the wait was 20–27 min and LWBS 0 whether the attending was perfect, fired or idle. The instructor reads them as the student's performance.
- **Fix:** For attending rows, hide them or label them "Dept wait (charge nurse: computer)".
- **Effort:** S

**R6.4-09 · Low · The computer's work is credited to the attending's Clinical score**

- **Location:**
  - `care()` (engine.js:839–840).
  - `'dispo'` is in `MD_TAGS` but not `PT_TAGS`, so it isn't held to `p.mine`.
  - The credits come from charge-nurse-side actions at 2672, 2698, 2731, 2828–2829 and 3047: flight, IFT report, help calls, bedside sugar and a second consult.
- **What's wrong (verified, `s4.js`):**
  - An attending who saw no patients has ledger `dispo: +6` and `+12`.
  - Their Clinical card reads "Best: Disposition calls" (`ui3.py`).
- **Fix:**
  - Add `'dispo'` to `PT_TAGS`, or re-tag those six credits `'flow'`.
  - Add a rules check: an idle attending's ledger has no `dispo` line.
  - Update golden.
- **Effort:** S

**R6.4-10 · Low · Deleting a result depends on a key kept only in browser storage, and there is no other route**

- **Location:**
  - `cbKeySave` uses `oc-ckeys` in localStorage.
  - The Privacy section: "To have yours deleted sooner, ask your instructor".
- **What's wrong:**
  - **The key can vanish.** It is lost if the instructor clears site data or uses a private window. Safari can also clear script-written storage for a site that hasn't been visited for 7 days of browser use (WebKit's 7-day cap; home-screen apps are exempt).
  - **Then nobody can delete early.** Only the operator can delete before day 30, and the Privacy section gives a student or parent no way to reach the operator.
  - The panel says "It's saved on this device", which reads as permanent.
- **Fix:**
  - **Key panel:** "Copy it somewhere safe: clearing this browser's data, or not opening the game for a week in Safari, can lose it."
  - **Privacy section:** add a contact for deletion requests, a project address the owner chooses. CLAUDE.md bars publishing his email without his approval.
- **Effort:** S

**R6.4-11 · Low · "Scores are self-reported." in the student's Send box**

- **Location:** ui.js:2072.
- **What's wrong:** It's an instructor caveat shown to a student without context. A student reads it as meaningless (they typed no score) or as an accusation.
- **Fix:** Drop it from the student box, which then states plainly what is sent (R6.4-06). Keep it on the instructor screen in the R6.4-07 wording.
- **Effort:** S

**R6.4-12 · Low · README claims that aren't accurate**

- **Location:** README.md:55 (v0.31.0) and :171–179 ("For a class").
- **What's wrong:**
  - **"Students no longer see a Class results box."** Every device shows the "Class results (instructors)" box with "Open with an instructor key". `test/class_test.py` asserts exactly that. What changed is that students see no names.
  - **"The Privacy section … says what is sent, who can read it."** It doesn't (R6.4-05).
  - **"For a class" implies ranking is fair on a code.** CLAUDE.md says outcomes "use the main stream and can differ between players". R1.2-03 (events differing on one code) is still deferred. The section also lacks the clinician-review disclaimer (R6.4-02).
- **Fix:**
  - "Students see no names: the Class results box opens only with an instructor key."
  - Correct the Privacy claim once R6.4-05 is done.
  - Add to "For a class": "Even on one code, results are for discussion, not grades. No licensed clinician has reviewed the clinical content yet."
- **Effort:** S

### Nitpick

**R6.4-13 · Nitpick · Instructor table polish**

- Every row carries an "MD" badge, but the role is fixed by the code.
- "LWBS" is unglossed for paramedic instructors. The glossary has it; the table doesn't.
- On a phone held upright, "Played" is hidden (≤460 px). It's the only hint that a shift was cut short.
- On wider screens, "#" ranks students by the number R6.4-01 shows is invalid.

**R6.4-14 · Nitpick · Speed isn't sent**

- The make-a-code note says "Each summary shows the code, the real time played, and the speed used".
- The speed (`spdSec`) isn't sent, so the instructor's table can't tell a shift played at 4× from one played at 1×.

**Counts:** Critical 0 · High 2 · Medium 5 · Low 5 · Nitpick 2.

## 4. Coverage

**Reviewed:**

- **Content-change check:**
  - The whole Phase 2 diff, by file and by hunk.
  - Blob identity of the clinical files.
  - The golden.json diff.
  - `rules.js`–`rules12.js` and `golden.js`, run one at a time (685 ok, 0 FAIL; "71 answer keys unchanged").
- **The class-results flow end to end, in Chrome at phone size:**
  - making a code
  - the instructor-key panel
  - playing the code as the attending, fired
  - the summary and the Send box
  - sending
  - the instructor's table, fed with the real payload and two measured rows
  - the About page's Privacy text
  - the name pre-fill on a shared device
- **Database:** the SQL of both migrations, for what is stored, returned and validated (`stats_ok`, `clean_name`, `cb_submit`, `cb_class_read`), and `supabase/README.md`.
- **Engine paths behind the numbers:** `avgScore`, `overallStars`, `scoreStars`, `SC_PRIOR`, `care` gating (`MD_TAGS`, `PT_TAGS`), `accuracy`, `aiTick` → `botStep` provider assignment, `endShift` report fields, `avgWait`.
- **Measured shifts:**
  - 15 attending shifts in `s1.js` (perfect, poor, idle)
  - 4 idle attending shifts in `s3.js`
  - 5 radio-only attending shifts in `s5.js`
  - 9 charge nurse shifts in `s2.js`
- **Texts:** README "For a class", the v0.31.0 paragraph, and the clinician-review statements at README:59 and :112. Also the `pages.yml` publish list and its 404 check.

**Not checked, and why:**

- **The live database and site.** Off limits by the brief. I took the US-East region claim from `supabase/README.md`.
- **`npm run db:test`.** It's security and privacy territory (Reviewer 3). I read the SQL instead.
- **The round-3 clinical findings.** Not re-audited: the engine is identical, so their state is whatever round 3's fixes left. rules12 (100 checks) passes.
- **Already reported, seen again:** the fired summary's Staff card says "They walked out" at 86% morale. That's R4-15, deferred to Phase 6.

**Network note:**

- My first Playwright run used a route pattern that didn't match. The page tried to reach the Supabase host twice, and the container's egress proxy refused both connections (403, connect_rejected), so nothing reached it.
- Every later run replaced `fetch` in the page and aborted all non-file requests. Their `leaked` lists are empty.

## 5. What I'd keep

- **Names behind a key.** The instructor key, names visible only through it, and one generic answer for a wrong key, an unknown code or an expired class.
- **The name rule.** First name or initials, enforced in the browser and in the database. An email or phone number is refused. That's right for minors.
- **Retention.** 30-day deletion, shown to the instructor as a date ("deleted on Dec 24").
- **Instructor deletes.** Delete one result or all of them, with a confirm step.
- **Rate limits** keyed on a hashed address, not the address, and explained in plain words.
- **The 8-second timeout.** No screen hangs on "Sending…".
- **A clean phase.** Phase 2 touched no clinical content, so it introduced no clinical regressions.
