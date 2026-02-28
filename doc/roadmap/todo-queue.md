# Active TODO Queue (Coding Agents)

## Purpose

Define the ordered, near-term execution queue for active development.

## Phase 6 Verification Queue

1. Run `npm run verify:phase6:static` — confirm typecheck and build pass.
2. Run `npm run verify:phase6:invite` — confirm invite gating (reject invalid, accept valid, dev-mode skip).
3. Run Phase 5 regression gates (`verify:phase5:static`, `verify:phase5:bots`).
4. Update `doc/verification/phase6-checklist.md` with evidence and gate decision.
5. If GO: update `doc/roadmap/phase-matrix.md` to Complete.

## Manual Deployment Queue (post-gate)

6. Set server env: `npx partykit env add INVITE_SECRET <value>`.
7. Deploy PartyKit: `npm run party:deploy`.
8. Update `VITE_PARTYKIT_HOST` in `.env` with production URL.
9. `npm run build` and deploy `dist/` to hosting provider.
10. Production smoke-test: invite gating, lobby, gameplay.
