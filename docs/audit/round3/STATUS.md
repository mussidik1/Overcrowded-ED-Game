# Round 3: what was fixed (Nov 24, 2026)

Round 3 re-reviewed the round-2 fixes. The six reports are in this folder; the fixes are the five "round-3 ... fixes" commits
(`git log --grep "round-3"`). Items deferred or waived in `docs/audit/round2/STATUS.md` stay deferred or waived.

| Reviewer | Score (round 2 → 3) | Fixed in round 3 |
|---|---|---|
| R1 architecture | 3 → 3 | R1.3-01 to 09 |
| R2 tooling | 4 → 5 | R2.3-01, 02, 03, 05, 06 |
| R3 game tech | 4 → 5 | R3.3-01, 02, 03 |
| R4 UI/UX | 4 → 4 | R4.3-01, 02, 03; R4.2-02 (the end-of-code card) |
| R5 player | 4 → 4 | R5.3-01 to 07 |
| R6 clinical | 3 → 4 | R6.3-01 to 07, 09, 10, 12 to 15 |

Not fixed in round 3:
- **R2.3-04:** three commits still record the accidental `node_modules` symlink (`eb88030`, `46033b8`, `d1da54a`). The current tree is clean, and `.gitignore` now stops a repeat. Removing it from history needs a force-push, which the session's permission check refused. Closed, won't fix: the owner chose to leave it (Nov 24, 2026). The link holds only a folder path from a throwaway cloud machine, and rewriting `main` and `3d` would change every commit id since round 2.
- **R6.3-08:** fixed after release. The README said three clinicians reviewed v0.15. The owner confirmed they were not real people (Nov 24, 2026); the v0.16 paragraph now says they were AI reviewers role-playing those parts.
- **R6.3-11:** some contraindication reasons are generic. The worst ones were fixed under R1.3-04.
- **Lows and nitpicks:** the remaining ones in the six reports go to the phases in `docs/PRO_AUDIT.md`.

The round-3 fixes were treated as bug fixes under the six-reviewer rule: each one answers a finding. So no round 4 was run before the merge.
