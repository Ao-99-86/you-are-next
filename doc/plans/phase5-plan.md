# Phase 5 Implementation Plan: AI Players + Azure LLM Chat

## Context

Phase 4 (complete, all gates GO) established authoritative multiplayer via PartyKit. Phase 5 fills empty lobby slots with server-simulated bot players and upgrades monster dialogue using Azure OpenAI, with deterministic fallback when Azure is absent.

Azure API scope decision for Phase 5: use GA v1 chat completions (`/openai/v1/chat/completions`) now. Do not append dated `api-version` query params on this path.

**Goal:** A single human player can start a game, bots fill remaining slots, bots move/fight/argue autonomously, and the monster uses LLM-generated replies when Azure is configured.

---

## Critical Files

| File | Role |
|---|---|
| `party/index.ts` | Primary change target — bot spawning, tick integration, argument drive |
| `game/types.ts` | Add `isBot: boolean` to `NetworkPlayerState` |
| `game/constants.ts` | Add `BOT_COUNT`, `BOT_SPEED`, `BOT_LATERAL_DRIFT`, `BOT_FILL_TO_MAX` |
| `game/chat.ts` | Reuse `evaluateResponse`, `WINNING_SAMPLE_MESSAGES`, `MONSTER_TAUNTS` |
| `engine/PuppetController.ts` | No changes — bots render as puppets automatically |
| `engine/MultiplayerGame.ts` | No changes — `_syncPuppets()` handles bots from snapshot |
| `src/components/Lobby.tsx` | Update start-gating UI for solo start (min 1 connected ready player) |
| `scripts/verify-phase4-authority.mjs` | Pattern source for Phase 5 bots script |
| `doc/verification/phase4-checklist.md` | Template for Phase 5 checklist |

**BabylonJS verification (via babylon-mcp):** `Vector3.Lerp(start, end, amount)` confirmed valid API. Existing `PuppetController.ts` interpolation is correct. No client-side BabylonJS changes needed.

---

## Implementation Steps

### 1. `game/constants.ts` — Bot constants

Add at end of file:
```ts
// Phase 5 — Bots
export const BOT_COUNT = 3;
export const BOT_SPEED = 0.35;         // slightly slower than PLAYER_SPEED (0.45)
export const BOT_LATERAL_DRIFT = 0.3;  // max sinusoidal lateral wander per tick
export const BOT_FILL_TO_MAX = true;   // fill to MAX_PLAYERS on game start
```

### 2. `game/types.ts` — Add `isBot` to `NetworkPlayerState`

Add `isBot: boolean` as a required field (not optional — forces all construction sites to be explicit).

### 3. New file: `party/aiPlayers.ts`

- `BotRecord` interface: full `PlayerRecord`-compatible shape + `isBot: true` (literal) + `lateralPhase: number` + `chatPending: boolean`
- `createBot(botNumber, roomId, spawnOffset, nowMs)` — factory returning `BotRecord` at `START_Z` with `connected: true`, `isReady: true`
- `tickBotMovement(bot, dtSeconds, nowMs)` — advances bot `+Z` at `BOT_SPEED` with sinusoidal lateral drift, clamped to map bounds; updates `yaw` to face direction of travel
- `pickDeterministicBotMessage(roundIndex)` — rotates through `WINNING_SAMPLE_MESSAGES` from `game/chat.ts`; guaranteed to pass scoring threshold
- `resolveBotChatMessage(roundIndex, generateLlmMessage)` — async: tries LLM, falls back to deterministic on null/error

### 4. New file: `party/azureChat.ts`

Server-side only (never imported by client). Uses `fetch()` directly — no Azure SDK needed.

- `getAzureConfig()` — reads `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME` from `process.env`; returns null if any required var is absent
- `isAzureConfigured()` — synchronous check, cheap to call in tick loop
- `callAzureChat(systemPrompt, userPrompt, maxTokens, temperature)` — normalize endpoint (strip trailing `/`), POST to `{endpoint}/openai/v1/chat/completions` with `Content-Type: application/json` and `api-key` header; body includes `model: AZURE_OPENAI_DEPLOYMENT_NAME`; 8-second `AbortSignal.timeout`; returns `string | null`
- `generateMonsterReply(roundIndex, playerMessage, points)` — dynamic monster taunts; tone varies by score bracket
- `generateBotChatMessage(roundIndex)` — generates pleading bot survival message

### 5. `party/index.ts` — Core integration changes

**a. Imports:** Add `BOT_COUNT`, `BOT_FILL_TO_MAX` from constants; all exports from `aiPlayers.ts` and `azureChat.ts`.

**b. `PlayerRecord`:** Add `isBot: boolean` field.

**c. `MIN_PLAYERS_TO_START`:** Lower from `2` → `1` (bots fill the rest).

**d. `_handleJoinRoom`:** Add `isBot: false` to new player literal.

**e. `_spawnBots()` (new private method):**
```
botsNeeded = MAX_PLAYERS - humanCount (capped at BOT_COUNT, min 0)
Create BotRecord for each, cast to PlayerRecord, insert into _players
```
Bots are NOT spawned during lobby — only on game start.

**f. `_startGame()`:** Call `_spawnBots()` first, then position all players (humans + bots) from `_players` loop.

**g. `_tick()`:** Call new `_tickBots(dtSeconds, now)` before `_updateMonster`.

**h. `_tickBots()` (new):** Iterates `_players`, calls `tickBotMovement` for each `isBot && lifeState === "alive"` entry.

**i. `_triggerCatch()`:** After setting argument state, if `player.isBot`, call `_driveBotArgument(player.id, sessionId)` (fire-and-forget).

**j. `_driveBotArgument()` / `_driveBotArgumentAsync()` (new):**
- Async loop over 3 rounds with 2.5s delay per round (simulates typing)
- Session-ID guard on every iteration to handle stale drives
- Calls `resolveBotChatMessage(round, generateBotChatMessage)` → injects via `gameUpdater(CHAT_MESSAGE)`
- Handles won/lost/reset, broadcasts events and snapshot
- Fire-and-forget: `.catch(warn)` at call site

**k. `_handleChatSubmit()` — Azure monster reply upgrade:**
After deterministic reply is computed and broadcast, fire-and-forget LLM call:
- `generateMonsterReply(round, playerMsg, points)` → patches `monsterReply` in `_argumentState.session.rounds[round]` if session still active → re-broadcasts snapshot

**l. `_buildSnapshot()`:** Add `isBot: p.isBot` to every `NetworkPlayerState` push.

**m. `_removeBots()` (new):** Delete all `isBot` entries from `_players`. Called at start of `_endGame()` before broadcast.

**n. `src/components/Lobby.tsx` — start gating update:**
- Enable host start when `connectedPlayers.length >= 1 && connectedPlayers.every((p) => p.isReady)`
- Update hint text from "min 2 players" to "min 1 player"
- Keep host-only start button behavior unchanged

### 6. New file: `scripts/verify-phase5-bots.mjs`

Authority-style Node/PartySocket script (no browser). Reuses `RoomClient`, `spawnProcess`, `killProcess`, `waitForServer` pattern from `verify-phase4-authority.mjs`.

**Scenarios:**
1. **Solo start spawns bots** — 1 human joins, sets ready, `REQUEST_START` succeeds (MIN=1), snapshot has `isBot: true` players, bot Z positions advance after 2s
2. **Bot names in snapshot** — `name` starts with "Bot ", `connected: true`, `isReady: true`
3. **Bots absent from lobby** — snapshot has 1 player before start, `BOT_COUNT + 1` after
4. **Bot argument auto-resolves** — wait up to 90s for `phase === "argument"` with a bot caught; then wait for phase to return to `"playing"` without human input

Port: `2200` (avoid conflict with phase4 scripts on `1999`).

### 7. New file: `scripts/verify-phase5-azure.mjs`

Lightweight smoke test (no server needed). Uses `tsx` for TypeScript import.

**Checks:**
- `isAzureConfigured()` → false with no env vars
- `generateMonsterReply()` → null with no env vars
- `resolveBotChatMessage(..., () => null)` → non-empty deterministic fallback
- `pickDeterministicBotMessage(i)` → non-empty for i=0,1,2
- If `AZURE_OPENAI_ENDPOINT` + `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_DEPLOYMENT_NAME` are set: live call returns non-null string

### 8. `package.json` — Add scripts

```json
"verify:phase5:static": "npm run typecheck && npm run build",
"verify:phase5:bots": "node scripts/verify-phase5-bots.mjs",
"verify:phase5:azure": "node --import tsx/esm scripts/verify-phase5-azure.mjs"
```
Add `tsx` as devDependency if not present.

### 9. New file: `doc/verification/phase5-checklist.md`

Mirrors `phase4-checklist.md` structure. Sections:
- Static gate (`typecheck`, `build`)
- Bot player invariants (spawn, movement, argument, cleanup)
- Azure integration invariants (fallback, fire-and-forget, no crash)
- Phase 4 regression (all three gates must still pass)
- Evidence log table
- Gate decision (GO / NO-GO for Phase 6)

### 10. Doc updates

- `doc/roadmap/phase-matrix.md` — Phase 5 row: `Not started` → `In Progress` (then `Complete` after GO)
- `doc/verification/phase6-checklist.md` — Use as the canonical Phase 6 gate + deployment checklist
- `doc/roadmap/phase-details.md` — Update Phase 5 implementation status block

---

## Implementation Order

Dependencies must be respected for `typecheck` to pass:

1. `game/constants.ts`
2. `game/types.ts`
3. `party/aiPlayers.ts`
4. `party/azureChat.ts`
5. `party/index.ts`
6. `src/components/Lobby.tsx`
7. Run `verify:phase5:static`
8. `scripts/verify-phase5-bots.mjs`
9. `scripts/verify-phase5-azure.mjs`
10. `doc/verification/phase5-checklist.md`
11. `package.json` (scripts + tsx dep)
12. Doc updates (phase-matrix, todo-queue, phase-details)

---

## Verification (End-to-End)

```bash
# Static gate
npm run verify:phase5:static

# Phase 4 regression
npm run verify:phase4:static
npm run verify:phase4:runtime-smoke
npm run verify:phase4:authority

# Phase 5 bot authority
npm run verify:phase5:bots

# Phase 5 azure fallback
npm run verify:phase5:azure
```

Manual smoke: open `/lobby/:roomId`, join solo, mark ready, start game (host start should be enabled at 1 ready player) — verify bot players appear and move in the 3D scene (rendered as puppets via existing `MultiplayerGame._syncPuppets()` + `PuppetController`). Confirmed: `Vector3.Lerp` API used for puppet interpolation is valid (babylon-mcp verified).
