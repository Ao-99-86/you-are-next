# Verification Framework (Coding Agents)

## Purpose

Standardize phase gate execution and evidence capture so GO/NO-GO decisions remain reproducible.

## Global Procedure

After each phase implementation:

1. Run static gate commands.
2. Run deterministic runtime checks (scripted where available).
3. Run MCP probes (Playwright + Chrome DevTools).
4. Run Inspector/Spector checks if required by checklist.
5. Update phase checklist with timestamped evidence.
6. Mark explicit GO/NO-GO decision.

## Static Gate Pattern

- `npm run typecheck`
- `npm run build`
- phase-specific static script (`verify:phaseX:static`)

## Runtime Gate Pattern

- `scripts/verify-phase1-runtime-smoke.mjs`
- `scripts/verify-phase2-runtime-smoke.mjs`
- `scripts/verify-phase25-runtime-smoke.mjs`
- `scripts/verify-phase3-runtime-smoke.mjs`
- `scripts/verify-phase4-runtime-smoke.mjs`
- `scripts/verify-phase4-authority.mjs`
- phase-specific manual/MCP checks documented in `doc/verification/phaseX-checklist.md`

## Current Checklists

- `doc/verification/phase1-checklist.md`
- `doc/verification/phase2-checklist.md`
- `doc/verification/phase25-checklist.md`
- `doc/verification/phase3-checklist.md`
- `doc/verification/phase4-checklist.md`
