# Spec pipeline addendum (the owner, Nov 26, 2026)

Where this conflicts with the older pipeline instructions, this wins. Saved word for word.

1. NEW CORE RULE. The builder never signs off on its own work. Self-checks before handoff are fine. Only a fresh subagent or I can mark a task, stage or release as passing. A self-graded "looks good" is not evidence.

2. QA RUBRIC. If this project is past Stage 7 and spec/QA-RUBRIC.md does not exist, write it now. Score each criterion 1-10 and give it a hard pass threshold, with one line describing what a 4, a 7 and a 10 look like. Defaults:
- Functionality: every REQ works end to end in the live app. Threshold 8.
- Product depth: features are real, not stubs, fake data or placeholder screens. Threshold 7.
- Visual design and usability: consistent, readable, obvious primary actions, 44 px tap targets. Threshold 7.
- Code quality: matches the ARCHITECTURE contracts, no dead code. Threshold 6.
- PWAs add Offline and install: works offline per SPEC, installs, updates cleanly. Threshold 8.
- Clinical projects add Clinical safety: disclaimers present, no PHI stored, logged, cached or sent anywhere. Threshold 10.
End the file with an empty "## Calibration" section. Show me the thresholds and wait for my OK before using them.

3. STAGE 15 IS NOW TWO STEPS.
15a Evaluator QA. Deploy a preview, or start the dev server if a preview is not possible. Spawn a fresh subagent that can drive a browser: use a Playwright MCP if one is available, otherwise install @playwright/test and have it write and run Playwright scripts. If no browser can run in this environment, stop and tell me. Give the subagent only spec/00-INTAKE.md, spec/02-SPEC.md, spec/QA-RUBRIC.md and the URL. Never pass the builder's reasoning or the chat history. Give it this role:
"You are QA. You did not build this app and you get no credit if it passes. Use it the way the target user would, at a phone-sized viewport and on desktop. Walk every REQ's acceptance criteria in the live app. Test the UI, and the API and database if the app has them. Try empty, huge, malformed and malicious inputs, no network, double-taps and the back button mid-flow. Score every rubric criterion 1-10 with evidence: steps taken, screenshots, console or network output. File every bug with reproduction steps, severity, and file:line when you can find it. Grade what the app does, not what the code intends. Do not round up."
Append its result to spec/QA-REPORT.md as a dated round, and add its bugs to spec/FINDINGS.md. Any criterion under its threshold, or any open Critical or High bug, is a FAIL. Fix through the normal build and automated-gate steps, then rerun 15a. After 3 failed rounds, stop and give me a summary.
15b Device check. Only after 15a passes, give me the phone checklist: install, offline, update, every key flow, Lighthouse, accessibility spot check. Log anything I catch in FINDINGS tagged missed-by-evaluator.

4. STAGE 17. The CTO review also gets the final QA-REPORT round with its scores and my 15b results.

5. STAGE 19 adds two steps. First, compare QA-REPORT against the missed-by-evaluator findings and anything that broke after launch. Add each miss to the Calibration section of QA-RUBRIC.md, in this form: "Missed: X. Should have scored Functionality 5 or lower because Y." Second, in the retro, list any gate that found no Critical or High issues and say whether it is still earning its place. Never suggest cutting security, privacy or clinical-safety gates.

6. LIGHT MODE. Stage 15a still runs, grading only Functionality and Visual design, plus Clinical safety if the project is clinical.

7. Do not rerun stages that are already finished. If this project is already past Stage 15, run 15a once now against the current build. Then tell me where the project stands and what you'll do next.
