# QA report (Stage 15a)

Each round is a fresh QA agent with only `spec/00-INTAKE.md`, `spec/02-SPEC.md`, `spec/QA-RUBRIC.md` and a URL
(`spec/PIPELINE-ADDENDUM.md` item 3). Bugs go to `spec/FINDINGS.md`.

## Round 1: Nov 26, 2026, v0.32.0 as released (local copy, no gate)

**Verdict: FAIL.** Three criteria are under threshold. No Critical or High bug.

- **Browser:** Playwright Chromium at 390x844, 360x740, 844x390 (touch, device pixel ratio 2) and 1280x800. WebKit and Firefox weren't
  installed.
- **Server:** Supabase was unreachable from the test machine, so server features were graded on how they handle that.
- **Evidence:** the agent's scripts, logs and 169 screenshots were in its scratch folder (not in the repo).

| Criterion | Score | Threshold | Result | Key evidence |
|---|---|---|---|---|
| Functionality | 7 | 8 | FAIL | Core flows finish in both roles: Rush to report, an attending DKA case to disposition, both Orientations with no tutorial errors, all 32 lessons, class codes (98.9% of 74,400 mistypes refused), resume, offline. Below threshold for QA-4, QA-1, QA-3 and QA-8. Send, results, delete and CSV weren't reachable without the server. |
| Product depth | 7 | 7 | PASS | Vitals trend with treatment, results read as findings, M&M lines match events, radio and code cards explain answers. Shallow: QA-3, QA-9, QA-10, and the 21 text-only case lessons. |
| Visual design and usability | 5 | 7 | FAIL | Consistent look, clear Next button, no page-level sideways scroll at 360, 390, 844 or 1280. Against: 9.5–11 px state text, 21–36 px targets, the clipped gate, upright floor plan forces a turn or the list board, focus not managed, toasts overlap (QA-1, 5, 12, 15, 16). |
| Code quality | 7 | 6 | PASS | `G` JSON round-trips at 300 game minutes (115 KB); no `Math.random`, `document.` or `window.` in the engine; CSP allows the inline scripts by hash and there are no inline handlers; delegated taps; two players on one code got the same arrivals. Deduction: `readSave()` accepts any `G.v === 5` (QA-4). |
| Offline and install | 8 | 8 | PASS | The service worker precaches the core files on the first visit; offline reload plays; 3D works offline after one online shift; the manifest is valid; old caches are deleted; a version bump refuses the class save with an explanation. Not verified: the install prompt and the cache-name swap. |
| Clinical safety | 8 | 10 | FAIL | The notice is on About and every report; the name isn't stored on the device; no POSTs are cached; no personal data in the console. Gaps: full names accepted and sent (QA-2); the notice is incomplete in Lessons, class results and Orientation (QA-7). |

### REQ walk (summary)

- **Pass:** REQ-01, 02, 04 (early endings not triggered), 05, 06, 08, 11, 13, 15 (Share not testable headless), 20, 21.
- **Partial:**
  - REQ-03: the radio pack isn't in Settings (QA-11).
  - REQ-07: QA-8 and QA-10; no gray-zone patient came up.
  - REQ-09: PALS not reached; QA-9.
  - REQ-10: stroke variants not reached in a shift.
  - REQ-12: QA-4.
  - REQ-14: QA-3.
  - REQ-16: QA-2.
  - REQ-18: QA-1.
  - REQ-19: QA-12.
  - REQ-23: QA-7.
  - REQ-24: QA-2.
- **Fail:** REQ-22, accessibility (QA-5, QA-6).
- **Not verifiable:** REQ-17, class results (needs the server).

### Bugs

Critical 0, High 0, Medium 8, Low 14. They are QA-1 to QA-22 in `spec/FINDINGS.md`, as F-048 to F-069.

## Round 2: Nov 27, 2026, the v0.33.0 candidate (work branch at 0928c78; GAME_V still 0.32.0), local copy

**Verdict: FAIL.** One High bug is open, and three criteria are under threshold.

- **Browser:** Playwright Chromium at 360x640, 390x844, 844x390 (touch) and 1280x800.
- **Server:** Supabase was unreachable, so class results, Send and the gate were tested against an in-memory mock of the `cb_`
  functions (client side only).

| Criterion | Score | Threshold | Result | Key evidence |
|---|---|---|---|---|
| Functionality | 7 | 8 | FAIL | Core flows complete in both roles, including class code, Send, results (mock), resume, offline and the gate. REQ-07 AC5 fails (QA2-1); AC4, REQ-14 and REQ-22 are partial. |
| Product depth | 8 | 7 | PASS | Full order sheet, results read as findings, harm flagged with reasons, code cards explain, radio calls sound, real class results and CSV. Weak: the syncope score has no parts (QA2-3). |
| Visual design and usability | 6 | 7 | FAIL | No sideways scroll; menus 44 px; Next names the task. Against: map tokens 14–21 px; 36 px chips; desktop map text 8.6–11 px; floating buttons and toasts cover content; keyboard gaps (QA2-4, 6, 7, 8). |
| Code quality | 7 | 6 | PASS | No `Math.random` in the engine; no inline handlers; strict CSP; delegated taps; exact resume; same arrivals on one code. |
| Offline and install | 8 | 8 | PASS | The service worker controls after the first load; offline reload plays; network-first update; valid manifest; class save across a version is explained. |
| Clinical safety | 9 | 10 | FAIL | Notices on first visit, About, Learn, Lessons, report, class results and CSV; the name isn't stored; no outside requests in play. Gap: no notice on the screens where the attending meets the clinical content in a regular shift (order sheet, code cards), or on Play a shift and Class code. |

### REQ walk (summary)

- **Pass:** REQ-01–06, 08, 09 (adult), 10, 11, 12, 13, 15, 16, 17 (mock), 18, 20, 21, 23, 24.
- **Partial:** REQ-14 (QA2-5), REQ-19 (QA2-6, 7, 8).
- **Fail:** REQ-07 (AC5, QA2-1); REQ-22 (QA2-4).

### Bugs

High 1, Medium 4, Low 7. They are QA2-1 to QA2-12 in `spec/FINDINGS.md`, as F-070 to F-081.

## Round 3: Nov 27, 2026, v0.33.0 candidate (work branch at ca0a1e5; GAME_V 0.33.0), local copy

**Verdict: FAIL.** Two criteria are under threshold. No Critical or High bug. This is the third failed round: per the addendum, work
stops here and the owner gets a summary.

- **Browser:** Playwright Chromium at 390x844, 844x390 (touch), 360x640 and 1280x800.
- **Server:** Supabase mocked with request routing: success, down, 500, 429 and timeout. The gate was tested as edcodeblack.com.

| Criterion | Score | Threshold | Result | Key evidence |
|---|---|---|---|---|
| Functionality | 7 | 8 | FAIL | Every core flow finished in both roles. Three acceptance criteria fail: REQ-07 AC2 (QA3-1), AC5 (QA3-2) and REQ-22 (QA3-3, QA3-4). |
| Product depth | 8 | 7 | PASS | Lessons labelled by kind; HEART built from the patient; code cards and radio calls explained; real M&M and points breakdown; arrivals grow with the level. |
| Visual design and usability | 7 | 7 | PASS | Consistent; one obvious next action; no sideways scroll; "!" beside colour. Small leftovers: 36 px chips, 32 px jump chips and 11–12 px text at 360 px. |
| Code quality | 7 | 6 | PASS | No `Math.random` in the engine; CSP with hashes; delegated taps; JSON state; same arrivals on one code. |
| Offline and install | 8 | 8 | PASS | Manifest and icons; offline play including 3D once cached; a new version is served on the next load. |
| Clinical safety | 9 | 10 | FAIL | The notice is on every listed screen and on the order sheet and code cards; no personal data. Gap: the radio medical-direction cards (QA3-7). |

### REQ walk (summary)

- **Pass:** REQ-01–06, 08, 09, 10 (partial), 11–21, 23, 24.
- **Fail:** REQ-07 (AC2, AC5); REQ-22.

### Bugs

Medium 4, Low 9. They are QA3-1 to QA3-13 in `spec/FINDINGS.md`, as F-082 to F-094.
