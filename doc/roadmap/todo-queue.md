# Active TODO Queue (Coding Agents)

## Purpose

Define the ordered, near-term execution queue for active development.

## Phase 5 Verification Queue

1. Run `npm run verify:phase5:static` — confirm typecheck and build pass.
2. Run `npm run verify:phase5:bots` — confirm bot spawn, movement, argument auto-resolve.
3. Run `npm run verify:phase5:azure` — confirm deterministic fallback and Azure config detection.
4. Run Phase 4 regression gates (`verify:phase4:static`, `verify:phase4:runtime-smoke`, `verify:phase4:authority`).
5. Update `doc/verification/phase5-checklist.md` with evidence and gate decision.
6. If GO: update `doc/roadmap/phase-matrix.md` to Complete and begin Phase 6 planning.
