# Phase Details (Coding Agents)

## Purpose

Define per-phase goals, planned work, testable outcomes, and current implementation status.

## Phase 1: Project Scaffolding and Core 3D Engine

Goal:

- Playable single-player forest run loop with over-the-shoulder camera.

Planned work:

1. Scaffold Vite + React + TypeScript.
2. Add router routes `/` and `/play`.
3. Implement `BabylonCanvas` lifecycle integration.
4. Build `engine/Game.ts` render loop and phase handling.
5. Build `engine/PlayerController.ts` movement and camera hierarchy.
6. Build `engine/ForestMap.ts` with ground, trees, boundaries, start/finish zones.
7. Build `engine/Lighting.ts` baseline fog and lighting.
8. Build `engine/MeshFactory.ts` primitive helpers.
9. Add `game/constants.ts` and `game/types.ts`.
10. Add PartyKit stub + configs.

Testable outcomes:

- Dev server loads and `/play` route works.
- Forest renders with fog.
- Movement and camera follow works.
- Boundaries block movement.
- Finish-zone event logs.

Implementation status:

- Complete and gated GO.

## Phase 2: Game Mechanics (Monster, Catching, Chat Stub)

Goal:

- Full single-player run/catch/argue/win-lose loop.

Planned work:

1. Build `engine/Monster.ts` mesh + patrol/chase AI.
2. Build `game/chat.ts` keyword scoring + taunts.
3. Build `game/logic.ts` reducer actions.
4. Build `MonsterChat` fullscreen overlay.
5. Build `HUD`.
6. Build `GameOverScreen`.
7. Extend `engine/Game.ts` with argument/game-over flow.
8. Wire React overlays through engine callbacks.

Testable outcomes:

- Monster patrols/chases.
- Catch opens chat and freezes world.
- Argument win/loss branches work.
- Finish zone still wins.

Implementation status:

- Complete and gated GO.

## Phase 2.5: Controls Modernization

Goal:

- Standard third-person controls before polish/multiplayer.

Planned work:

1. Update movement to WASD strafe + forward/back.
2. Add pointer-lock mouse look.
3. Add control tuning constants.
4. Extend debug output with pointer-lock/yaw/pitch values.
5. Keep Phase 2 branch behavior intact.
6. Add phase2.5 runtime smoke script.
7. Add phase2.5 verification gate doc.

Testable outcomes:

- A/D strafes without heading turn.
- Mouse look under pointer lock works.
- `Esc` unlock path stable.
- Catch/argument/game-over/finish loops remain intact.

Implementation status:

- Complete and gated GO.

## Phase 3: Polish and Atmosphere (Quake Aesthetic)

Goal:

- Deliver dark retro horror look and feel.

Planned work:

1. Low-res textures with nearest filtering and rough/dark materials.
2. Forest placement polish with logs/rocks.
3. Deeper fog, flickering lights, shadows, grain, vignette.
4. Head bob and catch shake.
5. Monster mesh/behavior improvements.
6. Audio behaviors: ambient, heartbeat, footsteps, catch sting using Babylon `Sound` class.
7. Horror chat UI + typewriter effect.
8. Add textures in `public/textures/` and sounds in `public/sounds/`.

Testable outcomes:

- Visibility reduced by fog (~30 units target feel).
- Monster audible before visible.
- Grain + vignette active.
- Chat theming and typewriter effect active.
- Overall tuning pass on fog/light/audio levels.

Implementation status (actual):

- Implemented:
  - procedural 64x64 textures (nearest sampling)
  - generated texture/sound assets in `public/textures/` and `public/sounds/`
  - forest, lighting, shadows, post effects
  - head bob + catch shake behavior
  - monster mesh upgrade
  - horror chat styling + typewriter
  - Babylon `Sound`-class audio path (ambient, heartbeat, footsteps, catch sting)
  - automated Phase 3 runtime smoke gate (`verify:phase3:runtime-smoke`)
- Gate status:
  - Static gate PASS
  - Automated runtime gate PASS
  - Manual/runtime evidence captured in checklist
  - GO for Phase 4 entry

## Phase 4: Multiplayer (PartyKit)

Goal:

- 2-4 players in same room with shared monster and argument events.

Planned work:

1. Expand shared game types/state for multiplayer.
2. Expand reducer for multiplayer action set.
3. Rewrite `party/index.ts` as authoritative server tick/broadcast.
4. Build room/network hook (`useGameRoom`).
5. Build remote-player puppet rendering/interpolation.
6. Add lobby route and room UX.
7. Synchronize argument visibility/permissions.
8. Add eaten-player monster-assistant mechanic.
9. Wire Babylon layer to room state.

Testable outcomes:

- Two tabs in same room see each other.
- Monster logic respects multiplayer state.
- Shared chat visibility with single active typer when caught.
- Correct end conditions.

Implementation status (actual):

- Implemented:
  - `game/types.ts` expanded with `RoomPhase`, `PlayerLifeState`, `NetworkPlayerState`, `NetworkMonsterState`, `NetworkArgumentState`, `RoomSnapshot`, `ClientMessage`, `ServerMessage`, `RoomEvent`
  - `party/index.ts` rewritten as authoritative server with 20 Hz tick, pure-math monster AI, argument scoring, room lifecycle, assist mechanic
  - `party/index.ts` restores reconnecting players via stable `clientId` identity and broadcasts immediate disconnect snapshots
  - `src/hooks/useGameRoom.ts` provides PartySocket connection state, input loop, and API methods
  - `engine/PuppetController.ts` provides remote player mesh interpolation
  - `engine/MultiplayerGame.ts` renders network-driven runtime from snapshots
  - `src/components/Lobby.tsx` provides room lobby with host derivation from `snapshot.hostId`
  - `src/components/MultiplayerCanvas.tsx` bridges React to multiplayer engine
  - `src/App.tsx` includes `/lobby/:roomId` and `/play/:roomId` routes
  - `src/components/MonsterChat.tsx` supports input gating via `isActiveTyper`
  - `src/components/HUD.tsx` supports eaten-player assist actions
  - `scripts/verify-phase4-runtime-smoke.mjs` and `scripts/verify-phase4-authority.mjs` provide automated verification
  - `doc/verification/phase4-checklist.md` contains gate checklist and evidence
- Gate status:
  - Static gate: PASS (`verify:phase4:static`)
  - Runtime smoke gate: PASS (`verify:phase4:runtime-smoke`)
  - Authority gate: PASS (`verify:phase4:authority`)
  - Phase gate decision: GO (Phase 5 entry unblocked)

## Phase 5: AI Players and Azure LLM

Goal:

- Fill empty slots with bots and upgrade monster chat using Azure Foundry.

Planned work:

1. Add AI player behavior and server-side simulation integration.
2. Add Azure OpenAI client/server integration for chat scoring/replies.
3. Keep deterministic fallback when Azure env is absent.

Testable outcomes:

- Bots spawn/move and participate in flow.
- Azure path works when configured.
- Fallback path remains operational.

Implementation status (actual):

- Implemented:
  - `game/constants.ts` expanded with `BOT_COUNT`, `BOT_SPEED`, `BOT_LATERAL_DRIFT`, `BOT_FILL_TO_MAX`
  - `game/types.ts` `NetworkPlayerState` expanded with `isBot: boolean`
  - `party/aiPlayers.ts` provides bot creation, movement tick, deterministic message picker, LLM-fallback chat resolver
  - `party/azureChat.ts` provides Azure OpenAI chat client with config detection, monster reply generation, bot message generation
  - `party/index.ts` integrates bot spawning on game start, bot tick movement, bot argument auto-drive, Azure monster reply fire-and-forget upgrade, bot cleanup on game end
  - `src/components/Lobby.tsx` updated for solo start (min 1 player)
  - `scripts/verify-phase5-bots.mjs` provides bot authority verification
  - `scripts/verify-phase5-azure.mjs` provides Azure fallback verification
  - `doc/verification/phase5-checklist.md` contains gate checklist
- Gate status:
  - Static gate: PASS (`verify:phase5:static`)
  - Bot gate: PASS (`verify:phase5:bots`)
  - Azure gate: PASS (`verify:phase5:azure`)
  - Phase 4 regression: PASS (`verify:phase4:authority`)
  - Phase gate decision: GO (Phase 6 entry unblocked)

## Phase 6: Deployment and Invite System

Goal:

- Production deployment with invite-only access.

Planned work:

1. Validate invite code at PartyKit connect boundary.
2. Add secure invite generation path.
3. Add invite input flow in UI.
4. Deploy PartyKit and frontend.
5. Validate production URLs and invite rejection behavior.

Testable outcomes:

- Invite required in production.
- Invalid codes rejected.
- Multiplayer works over internet.

Implementation status (actual):

- Implemented:
  - `game/types.ts` extended `JOIN_ROOM` ClientMessage with `inviteCode?: string`
  - `party/index.ts` validates `INVITE_SECRET` env var at top of `_handleJoinRoom`; rejects with `INVITE_INVALID` when set and code is missing/wrong; skips validation in dev (no secret)
  - `src/hooks/useGameRoom.ts` `connect()` accepts and forwards `inviteCode` parameter; exposes `error` state
  - `src/components/Lobby.tsx` reads `?invite=CODE` from URL search params; shows invite code input when not provided; displays `INVITE_INVALID` error with retry
  - `src/App.tsx` Landing page includes invite code input; embeds code in lobby URL query param
  - `scripts/verify-phase6-invite.mjs` provides invite gating verification (spawns PartyKit with `INVITE_SECRET`, tests reject/accept)
  - `doc/verification/phase6-checklist.md` contains gate checklist
- Gate status:
  - Static gate: PASS (`verify:phase6:static`)
  - Invite gate: PASS (`verify:phase6:invite`)
  - Phase 5 regression: PASS (`verify:phase5:static`, `verify:phase5:bots`, `verify:phase5:azure`)
  - Phase gate decision: GO (`doc/verification/phase6-checklist.md`)
  - Manual deployment checklist execution remains operator-owned.
