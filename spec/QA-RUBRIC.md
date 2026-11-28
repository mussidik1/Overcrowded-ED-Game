# QA rubric: Emergency Department: Code Black

Written Nov 26, 2026, under `spec/PIPELINE-ADDENDUM.md` item 2. Thresholds approved by the owner on Nov 26, 2026.

Each criterion is scored 1 to 10 by a fresh QA agent (Stage 15a), with evidence. A score under its threshold is a FAIL. So is any open
Critical or High bug.

The requirements (REQs) and the ARCHITECTURE contracts are in `spec/02-SPEC.md`; the product brief is `spec/00-INTAKE.md`.

| Criterion | Threshold | 4 looks like | 7 looks like | 10 looks like |
|---|---|---|---|---|
| **Functionality:** every REQ works end to end in the live app | 8 | A core flow (a shift, Orientation, a class code, Send) breaks or dead-ends in at least one role | Every core flow completes in both roles; a few edge flows misbehave (a lesson step, a resumed save, an odd tap order) | Every REQ, in both roles, at phone and desktop size, completes with no errors, including resume, offline and class codes |
| **Product depth:** features are real, not stubs, fake data or placeholder screens | 7 | Several menu items are thin or placeholders; results or scores don't follow from play | Every feature does real work; a few are shallow (generic text, one-path lessons) | Every case, lesson, score and report line follows from what the player did, with real clinical data and reasons |
| **Visual design and usability:** consistent, readable, obvious primary actions, 44 px tap targets | 7 | Text under 12 px carries state; primary actions hidden or ambiguous; many tap targets under 44 px; overflow at 360 px | Consistent and readable at phone size; the next action is clear; a few small targets or crowded screens remain | Every screen readable at 360 px and on desktop, one obvious next action, 44 px targets everywhere, keyboard and screen reader work, meaning never carried by colour alone |
| **Code quality:** matches the ARCHITECTURE contracts, no dead code | 6 | Game state outside `G`, `Math.random()` in the engine, inline handlers, build outputs hand-edited, dead code | Contracts held (one JSON-safe `G`, seeded streams, `OC` boundary, delegated taps, committed builds match source); lint clean; large files | Contracts held and tested, no dead code, clear module boundaries, every rule backed by a test |
| **Offline and install** (PWA): works offline per SPEC, installs, updates cleanly | 8 | Doesn't load offline after a first visit, or an update leaves an old version or a broken mix | Installs to the home screen, plays offline after one visit, updates on the next visit with a short glitch | Installs, plays fully offline (3D included once cached), updates to the new version on the next load with no mixed files, and a saved shift survives the update or says why it can't |
| **Clinical safety** (clinical project): disclaimers present, no PHI stored, logged, cached or sent anywhere | 10 | A missing disclaimer on a teaching screen, or real patient-like data stored or sent | Disclaimers on About and reports; only first names or initials sent; one gap (a screen without the notice, a log line with a name) | The "teaching game, not clinical guidance" and "no licensed clinician has reviewed it" notices where a learner meets clinical content; no patient data exists; only a student's chosen first name or initials and game numbers are sent, the name never stored on the device; nothing personal in logs, caches or the service worker |

## Calibration
