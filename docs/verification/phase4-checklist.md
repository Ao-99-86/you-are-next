# Phase 4 Verification Checklist

## Phase: Multiplayer (PartyKit)
## Status: GO

---

## Static Gate

- [x] `npm run typecheck` passes
- [x] `npm run build` succeeds
- [x] `npm run verify:phase4:static` passes

## Network Types

- [x] `game/types.ts` contains `RoomPhase`, `PlayerLifeState`, `NetworkPlayerState`
- [x] `game/types.ts` contains `ClientMessage`, `ServerMessage`, `RoomEvent` unions
- [x] `game/types.ts` contains `RoomSnapshot` interface (including `hostId`)

## Authoritative Server (`party/index.ts`)

- [x] 20 Hz tick loop active during `playing` phase
- [x] Pure-math monster AI (patrol/chase/catch) runs server-side
- [x] `JOIN_ROOM` adds player to room with correct initial state
- [x] `SET_READY` toggles ready flag; `REQUEST_START` only accepted from host
- [x] `PLAYER_INPUT` applies movement with boundary clamping
- [x] `CHAT_SUBMIT` rejected if sender is not the caught player
- [x] Argument win → player freed; argument loss → player eaten
- [x] `ASSIST_TARGET` accepted only from eaten players with 5s cooldown
- [x] `ROOM_SNAPSHOT` broadcast every tick
- [x] `ROOM_EVENT` emitted on discrete transitions (catch, argument, eaten, escaped, game over)
- [x] Room capacity hard cap at 4 players
- [x] Minimum 2 players required to start
- [x] Disconnect triggers immediate snapshot broadcast
- [x] Reconnect restores prior player by stable client identity

## Client Networking (`src/hooks/useGameRoom.ts`)

- [x] PartySocket connection with auto-reconnect
- [x] Stable per-session `clientId` sent in `JOIN_ROOM`
- [x] `selfId` populated from `WELCOME` message
- [x] Snapshot state updates on every `ROOM_SNAPSHOT`
- [x] Input send at 20 Hz while in playing phase
- [x] API methods: `connect`, `setReady`, `requestStart`, `sendInput`, `submitChat`, `assistTarget`

## Lobby (`src/components/Lobby.tsx`)

- [x] Name entry form before joining
- [x] Player list with ready status
- [x] Host badge based on `snapshot.hostId` (not `players[0]`)
- [x] Ready toggle button
- [x] Start button visible only for host, enabled when all connected players ready and count >= 2
- [x] Auto-navigates to `/play/:roomId` when game starts

## Remote Player Rendering

- [x] `engine/PuppetController.ts` creates mesh per remote player
- [x] Position interpolation via `Vector3.Lerp`
- [x] Yaw interpolation with shortest-angle wrap
- [x] Puppets added/removed as players join/leave
- [x] Eaten players' puppets hidden

## Multiplayer Game Engine (`engine/MultiplayerGame.ts`)

- [x] Monster mesh driven from server snapshot (not local AI)
- [x] Local player input sampled at 20 Hz
- [x] Argument overlay shown to all; input gated by `activeTyperId`
- [x] Eaten player enters spectator camera mode
- [x] Audio (heartbeat, footsteps, catch sting) driven by network state

## Routing

- [x] `/play` (single-player) remains functional
- [x] `/lobby/:roomId` renders Lobby component
- [x] `/play/:roomId` renders MultiplayerCanvas component
- [x] Landing page has Solo and Multiplayer buttons

## Eaten-Player Assist

- [x] Eaten player sees clickable alive-player buttons
- [x] Clicking sends `ASSIST_TARGET` to server
- [x] Server applies monster target bias for 2s

## Runtime Gate

- [x] `npm run verify:phase4:runtime-smoke` passes
  - Two clients join same room
  - Both see lobby player list
  - Ready and start flow works
  - Both navigate to game
  - Game canvas renders on both tabs
  - HUD active on both tabs
  - No console or page errors

- [x] `npm run verify:phase4:authority` passes
  - Non-host start rejected
  - Host-ready rules enforced
  - Boundary clamping enforced
  - Deterministic catch reaches argument phase
  - Non-caught chat rejected and stale session ignored
  - Disconnect snapshot broadcast observed
  - Host handoff works after host disconnect
  - Reconnect restores same player identity (no duplicates)

## Prior Phases

- [x] `npm run verify:phase3:runtime-smoke` still passes
- [x] Single-player `/play` route still functional

---

## Resolved Blockers

- [x] Immediate disconnect snapshot broadcast added in server `onClose`.
- [x] Lobby host derivation moved to explicit `snapshot.hostId`.
- [x] Reconnect continuity fixed via stable client identity mapping.

## Evidence Log

| Test | Result | Timestamp | Notes |
|------|--------|-----------|-------|
| typecheck | PASS | 2026-02-27 15:09 PST | 0 errors |
| build | PASS | 2026-02-27 15:09 PST | built in 7.92s |
| phase4:static | PASS | 2026-02-27 15:09 PST | typecheck + build both clean |
| phase4:runtime-smoke | PASS | 2026-02-27 15:09 PST | Lobby join, ready, start, game nav, canvas, HUD, no errors |
| phase4:authority | PASS | 2026-02-27 15:09 PST | Host/ready rules, disconnect snapshots, host handoff, reconnect restoration, deterministic argument/chat checks |
| phase3:runtime-smoke (regression) | PASS | 2026-02-27 15:09 PST | Sound readiness, catch-shake, console clean |
| phase1:runtime-smoke | PASS | 2026-02-27 15:12 PST | Landing selector aligned to `Solo`/`Play`; one flaky movement-threshold miss followed by clean re-run pass |
| source inspection: phase4 contracts/components | PASS | 2026-02-27 15:09 PST | Verified against `party/index.ts`, `useGameRoom.ts`, `Lobby.tsx`, `MultiplayerGame.ts`, `PuppetController.ts`, `game/types.ts` |

## Gate Decision

- [x] **GO** for Phase 5 entry
- [ ] **NO-GO** for Phase 5 entry
- Decided by: Codex
- Date: 2026-02-27 15:12 PST
