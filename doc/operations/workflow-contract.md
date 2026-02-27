# Agent Workflow Contract

## Purpose

Define required documentation updates when coding agents change roadmap, implementation status, or gate outcomes.

Every agent touching roadmap or progress must:

1. Update relevant files in `doc/roadmap/`:
   - `phase-matrix.md`
   - `phase-details.md`
   - `todo-queue.md`
2. Update relevant `doc/verification/phaseX-checklist.md` with evidence.
3. Keep `README.md` links aligned with canonical docs in `/doc`.
4. Keep `CLAUDE.md` references aligned with current canonical docs policy.
5. Avoid creating standalone plan files for active phase tracking outside `/doc/roadmap`.
