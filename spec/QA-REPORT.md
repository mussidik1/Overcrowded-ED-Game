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
