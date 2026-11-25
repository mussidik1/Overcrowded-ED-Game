# Reviewer 1, round 10: Senior Software Architect

Review of the round-9 fixes on branch `claude/sleepy-rubin-jot35n` at v0.31.0, HEAD `1ab6fa9`, Nov 25, 2026.

(In progress. Verified so far, to be completed:)

- R1.10-01 Medium: the held-code cap releases the oldest held code first (a real class's), and the taker's own cb_class_new releases and takes it in one call; a revival racing the release loses the class and the student's "ok" result. Reproduced (`held_cap.sql`, `race_*.sql`).
- R1.10-02 Medium: an own patient who arrived in cardiac arrest and is left unrun at the end is never "late" (age falls back to G.t, not tArrive): no penalty, no M&M, arrestLeft 0, mdArrestOpen 0. Reproduced (`arrival_arrest.js`).
- R1.10-03 Medium: fingerprint table parts include every pg_constraint row; PostgreSQL 18 stores NOT NULL there, so every table part changes on a platform upgrade.
- Low: blind spots (owner, column grants, triggers, policies, a changed string literal: two-word names refused, same fingerprint); README remedy for migration-1 functions false; revival test vacuous (mutant passes); cap untested; device key kept shorter than a revived class lives; mdArrestOpen now carries arrestLeft.
