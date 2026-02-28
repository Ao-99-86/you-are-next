# Phase 5 Verification Checklist

## Phase: AI Players + Azure LLM Chat
## Status: GO

---

## Static Gate

- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] `npm run verify:phase5:static` passes

## Bot Player Invariants

- [x] `game/constants.ts` contains `BOT_COUNT`, `BOT_SPEED`, `BOT_LATERAL_DRIFT`, `BOT_FILL_TO_MAX`
- [x] `game/types.ts` `NetworkPlayerState` has `isBot: boolean` field
- [x] `party/aiPlayers.ts` exports `createBot`, `tickBotMovement`, `pickDeterministicBotMessage`, `resolveBotChatMessage`
- [x] Bots NOT present in lobby phase (spawned only on game start)
- [x] Bots spawn with `isBot: true`, `connected: true`, `isReady: true`
- [x] Bot names start with "Bot "
- [x] Bot Z positions advance over time (forward movement confirmed)
- [x] Bot lateral drift produces sinusoidal X movement
- [x] Bot argument auto-drives: 3 rounds with 2.5s delay, resolves without human input
- [x] Bot argument uses deterministic fallback messages that pass scoring threshold
- [x] Bots removed from `_players` on `_endGame()`
- [x] `MIN_PLAYERS_TO_START` lowered from 2 to 1

## Azure Integration Invariants

- [x] `party/azureChat.ts` exports `isAzureConfigured`, `callAzureChat`, `generateMonsterReply`, `generateBotChatMessage`
- [x] `isAzureConfigured()` returns false when env vars absent
- [x] `generateMonsterReply()` returns null when Azure not configured
- [x] `generateBotChatMessage()` returns null when Azure not configured
- [x] `resolveBotChatMessage()` falls back to deterministic on null/error
- [x] Azure monster reply upgrade fires as fire-and-forget after deterministic reply
- [x] Stale session guard prevents late LLM reply from corrupting new session
- [x] No crash when Azure env vars absent (all paths gracefully degrade)

## Lobby Update

- [x] Host can start game with 1 ready player (solo start)
- [x] Hint text says "min 1 player"

## Phase 4 Regression

- [x] `npm run verify:phase4:static` passes
- [x] `npm run verify:phase4:authority` passes

## Evidence Log

| Test | Result | Timestamp | Notes |
|------|--------|-----------|-------|
| typecheck | PASS | 2026-02-27 | 0 errors |
| build | PASS | 2026-02-27 | built in 8.26s |
| phase5:static | PASS | 2026-02-27 | typecheck + build both clean |
| phase5:bots | PASS | 2026-02-27 | Solo start spawns 3 bots, movement confirmed, bot argument auto-resolve confirmed |
| phase5:azure | PASS | 2026-02-27 | All 6 fallback checks pass, live call skipped (no Azure env) |
| phase4:authority (regression) | PASS | 2026-02-27 | All 4 scenarios pass with bots present (spawn immunity prevents interference) |
| source inspection | PASS | 2026-02-27 | Verified party/index.ts, party/aiPlayers.ts, party/azureChat.ts, game/types.ts, game/constants.ts, Lobby.tsx |

## Gate Decision

- [x] **GO** for Phase 6 entry
- [ ] **NO-GO** for Phase 6 entry
- Decided by: Claude
- Date: 2026-02-27
