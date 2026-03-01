# Phase Matrix (Coding Agents)

## Latest Verified State

As of `2026-02-28`:

- Phase 1 gate: GO (`doc/verification/phase1-checklist.md`)
- Phase 2 gate: GO (`doc/verification/phase2-checklist.md`)
- Phase 2.5 gate: GO (`doc/verification/phase25-checklist.md`)
- Phase 3 gate: GO (`doc/verification/phase3-checklist.md`)
- Phase 3 automated gates: PASS (`verify:phase3:static`, `verify:phase3:runtime-smoke`)
- Phase 4 static gate: PASS (`verify:phase4:static`)
- Phase 4 runtime smoke gate: PASS (`verify:phase4:runtime-smoke`)
- Phase 4 authority gate: PASS (`verify:phase4:authority`)
- Phase 4 gate decision: GO (`doc/verification/phase4-checklist.md`)
- Phase 5 static gate: PASS (`verify:phase5:static`)
- Phase 5 bot gate: PASS (`verify:phase5:bots`)
- Phase 5 azure gate: PASS (`verify:phase5:azure`)
- Phase 5 gate decision: GO (`doc/verification/phase5-checklist.md`)
- Phase 6 static gate: PASS (`verify:phase6:static`)
- Phase 6 invite gate: PASS (`verify:phase6:invite`)
- Phase 6 Phase-5 regression gates: PASS (`verify:phase5:static`, `verify:phase5:bots`, `verify:phase5:azure`)
- Phase 6 gate decision: GO (`doc/verification/phase6-checklist.md`)

Current open items:

- Manual deployment checklist execution remains operator-owned (`doc/verification/phase6-checklist.md`).

## Matrix

| Phase | Goal | Status | Gate |
| --- | --- | --- | --- |
| 1 | Project scaffolding + core 3D single-player loop | Complete | GO (`doc/verification/phase1-checklist.md`) |
| 2 | Monster + catch + argument loop | Complete | GO (`doc/verification/phase2-checklist.md`) |
| 2.5 | Controls modernization (WASD strafe + mouse look) | Complete | GO (`doc/verification/phase25-checklist.md`) |
| 3 | Polish and atmosphere | Complete | GO (`doc/verification/phase3-checklist.md`) |
| 4 | Multiplayer (PartyKit) | Complete | GO (`doc/verification/phase4-checklist.md`) |
| 5 | AI players + Azure LLM chat | Complete | GO (`doc/verification/phase5-checklist.md`) |
| 6 | Deployment + invite gating | Complete | GO (`doc/verification/phase6-checklist.md`) |
