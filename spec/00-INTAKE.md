# 00 Intake: Emergency Department: Code Black

Retrofitted Nov 26, 2026, from `README.md` and `CLAUDE.md`, at v0.32.0 (the pipeline was adopted at v0.31.0, after the product existed).
It records what the product is for and who it serves, so an evaluator who never saw the build can judge it.

## What it is

A browser game about running one emergency department shift, 07:00 to 19:00, in a 32-bed ED. It is a teaching tool for nursing,
paramedic and emergency medicine classes, and it must stay fun and credible for working charge nurses and emergency physicians.

## Who uses it

- **Students** (nursing, paramedic, EM residents), mostly on a phone, often held sideways. Some have no medical background at all.
- **Instructors**, who give a class one shift through a six-character class code and read the class's results afterwards.
- **Working clinicians**, who play for fun and will notice clinical nonsense at once.

## The two roles

- **Charge nurse:** runs the board. Registration, triage, beds, providers, cleaning (EVS), consults, diversion, admissions and transfers.
- **Attending:** sees patients, writes orders, picks the diagnosis, makes the disposition call, runs cardiac arrests, and answers EMS
  medical-direction radio calls. The game runs the charge nurse.

## What success looks like

- A lay person can learn the game from Orientation, without a manual, and every term and abbreviation is explained.
- A student's choices change the outcome, and the end-of-shift report says what went well and badly, patient by patient.
- An instructor can give a class the same shift and read who played and how they scored, with only first names or initials.
- It works on a phone first, offline after the first visit, and installs to the home screen.

## Constraints

- One self-contained web page plus an optional 3D floor and imaging pictures. No accounts. Only class results and a testing password gate
  use a server (Supabase).
- Teaching game, not clinical guidance. No licensed clinician has reviewed the clinical content as a whole; the game says so.
- No patient data exists anywhere: every patient is invented. A student may send a first name or initials with a result; nothing else
  personal is collected.
- During private testing the public site shows a password gate. A local copy (localhost or a file) has no gate.
- The player directs the work: nothing that should be a player decision happens on its own.
