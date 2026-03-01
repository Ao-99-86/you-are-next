# Phase 6 Verification Checklist

This checklist gates Phase 6 completion (final phase). All required checks must pass before the game is considered production-ready.

## Sources of Truth

- `doc/roadmap/phase-details.md` (Phase 6 Work + Testable sections)
- `doc/operations/verification-framework.md` (global gate procedure)
- Current implementation in `src/`, `party/`, and `game/`
- Runtime scripts:
  - `scripts/verify-phase6-invite.mjs`

## Go/No-Go Rule

A **GO** decision requires all of the following:

- Static gate passes (`typecheck` + production `build` + `verify:phase6:static`)
- Invite gate passes (`verify:phase6:invite`)
- Phase 5 regression gates pass (`verify:phase5:static`, `verify:phase5:bots`)
- This checklist is completed with timestamped evidence

If any required item fails, decision is **NO-GO**.

## Evidence Standards

For each runtime claim, record:

- Scenario and exact action performed
- Tool/command used
- Timestamp in `YYYY-MM-DD HH:mm TZ`
- Concrete observable result

## Requirement Matrix (Phase 6)

### Work Items

- [x] `game/types.ts` extends `JOIN_ROOM` ClientMessage with `inviteCode?: string`.
- [x] `party/index.ts` validates `INVITE_SECRET` at top of `_handleJoinRoom`; rejects with `INVITE_INVALID` when secret is set and code is missing/wrong.
- [x] `party/index.ts` skips validation when `INVITE_SECRET` is not set (dev mode).
- [x] `src/hooks/useGameRoom.ts` `connect()` accepts and forwards `inviteCode` parameter.
- [x] `src/hooks/useGameRoom.ts` exposes `error` state from server `ERROR` messages.
- [x] `src/components/Lobby.tsx` reads `?invite=CODE` from URL search params.
- [x] `src/components/Lobby.tsx` shows invite code input when no URL param is present.
- [x] `src/components/Lobby.tsx` displays `INVITE_INVALID` error and allows retry.
- [x] `src/App.tsx` Landing page includes invite code input; embeds code in lobby URL.

### Testable Items

- [x] With `INVITE_SECRET` set: JOIN_ROOM without invite code → `INVITE_INVALID` error.
- [x] With `INVITE_SECRET` set: JOIN_ROOM with wrong invite code → `INVITE_INVALID` error.
- [x] With `INVITE_SECRET` set: JOIN_ROOM with correct invite code → `WELCOME` received.
- [x] Without `INVITE_SECRET` (dev): JOIN_ROOM without invite code → `WELCOME` received (no gating).
- [x] Phase 5 regression: bots and azure fallback still operational.

## Static Gate Commands

Run and record output status:

1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:phase6:static`

Results:

- [x] Typecheck pass
- [x] Build pass
- [x] Combined static gate pass

## Runtime Gate Commands

1. `npm run verify:phase6:invite`
2. `npm run verify:phase5:bots` (regression)

Results:

- [x] Invite gate pass
- [x] Phase 5 bot regression pass

## Manual Deployment Checklist

These items are performed by the human operator after code gates pass:

- [ ] Set invite secret: `npx partykit env add INVITE_SECRET <value>`
- [ ] (Optional) Set Azure vars via `npx partykit env add`
- [ ] Deploy PartyKit: `npm run party:deploy`
- [ ] Note production PartyKit URL
- [ ] Update `.env` with `VITE_PARTYKIT_HOST=<production-url>`
- [ ] `npm run build`
- [ ] Deploy `dist/` to hosting provider
- [ ] Smoke-test: visit production URL, enter invite code, join lobby, start game
- [ ] Smoke-test: attempt join without invite code → rejected

## Evidence Log

| Test | Result | Timestamp | Notes |
|------|--------|-----------|-------|
| `verify:phase6:static` | PASS | 2026-02-28 16:31 PST | `typecheck` and production `build` both passed. |
| `verify:phase6:invite` | PASS | 2026-02-28 16:31 PST | Missing/wrong invite rejected with `INVITE_INVALID`; correct invite accepted with `WELCOME`. Initial sandbox run hit local `listen EPERM`, rerun outside sandbox passed. |
| `verify:phase5:static` (regression) | PASS | 2026-02-28 16:32 PST | Regression static gate passed (typecheck + build). |
| `verify:phase5:bots` (regression) | PASS | 2026-02-28 16:32 PST | Solo start spawned 3 bots; movement checks passed; auto-resolve branch completed (non-fatal no-catch timeout accepted by script). Initial sandbox run hit local `listen EPERM`, rerun outside sandbox passed. |
| `verify:phase5:azure` (regression) | PASS | 2026-02-28 16:32 PST | Azure fallback contract checks passed; live call skipped due to missing Azure env vars. |
| Source inspection (`game/types.ts`, `party/index.ts`, `src/hooks/useGameRoom.ts`, `src/components/Lobby.tsx`, `src/App.tsx`) | PASS | 2026-02-28 16:33 PST | Invite code type, server validation, client forwarding, URL param handling, and invite error/retry UI paths confirmed. |

## Gate Decision

- [x] **GO** — Phase 6 complete, game is production-ready
- [ ] **NO-GO** — blockers remain
- Decided by: Codex verification run (with operator approval for local port binding reruns)
- Date: 2026-02-28
