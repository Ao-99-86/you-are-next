# You Are Next (Agent Operating README)

This file is the canonical planning, progress, and execution document for coding agents.

## Canonical Rule

- `README.md` is the single source of truth for roadmap and phase progress.
- `GamePlan.txt` is deprecated and removed from the repo.
- Future agents must update this README when roadmap, implementation status, or phase decisions change.

## 1) Project Context

Build an over-the-shoulder 3D multiplayer horror game where 2-4 players run through a dark forest while being chased by a monster. If the monster catches a player, the player enters a text argument sequence; winning frees the player, losing gets them eaten.

Product constraints:

- Solo-first development flow:
  - Phase 1 -> Phase 2 -> Phase 2.5 -> Phase 3 (single-player)
  - Phase 4+ introduces multiplayer
- Visual direction:
  - Dark, low-poly, retro/Quake-like atmosphere
- Networking stack target:
  - PartyKit authoritative server for multiplayer phases
- Chat AI:
  - Starts as deterministic keyword stub
  - Azure Foundry LLM in later phase

## 2) Current Progress Snapshot

Latest verified state (`2026-02-24 23:11 PST`):

- Phase 1 gate: GO (`docs/verification/phase1-checklist.md`)
- Phase 2 gate: GO (`docs/verification/phase2-checklist.md`)
- Phase 2.5 gate: GO (`docs/verification/phase25-checklist.md`)
- Phase 3 gate: NO-GO (`docs/verification/phase3-checklist.md`)
- Phase 3 automated gates: PASS (`verify:phase3:static`, `verify:phase3:runtime-smoke`)

Current Phase 3 open items:

- Manual Playwright MCP + Chrome DevTools MCP + Inspector/Spector evidence needs refresh against latest runtime changes.
- Final GO/NO-GO decision for Phase 4 remains open until that manual evidence is captured in `docs/verification/phase3-checklist.md`.

## 3) Stack and Runtime

- Frontend: Vite + React 19 + TypeScript
- 3D engine: BabylonJS (`@babylonjs/core`)
- Multiplayer backend (planned): PartyKit
- Network client (planned): PartySocket
- Runtime automation: Playwright (`@playwright/test`) via node scripts
- Debug tooling: `@babylonjs/inspector`, `spectorjs`, Chrome DevTools MCP (used only by Codex model), Playwright MCP, babylon-mcp

## 4) Repository Map

```text
src/
  main.tsx
  App.tsx
  styles.css
  components/
    BabylonCanvas.tsx
    HUD.tsx
    MonsterChat.tsx
    GameOverScreen.tsx

engine/
  Game.ts
  PlayerController.ts
  Monster.ts
  ForestMap.ts
  MeshFactory.ts
  ProceduralTextures.ts
  Lighting.ts
  PostProcessing.ts
  Audio.ts

game/
  constants.ts
  types.ts
  chat.ts
  logic.ts

party/
  index.ts

scripts/
  verify-phase1-runtime-smoke.mjs
  verify-phase2-runtime-smoke.mjs
  verify-phase25-runtime-smoke.mjs
  verify-phase3-runtime-smoke.mjs

docs/verification/
  phase1-checklist.md
  phase2-checklist.md
  phase25-checklist.md
  phase3-checklist.md
```

## 5) Environment and Config

From `.env.example`:

- `VITE_PARTYKIT_HOST=127.0.0.1:1999`
- `VITE_DEBUG=false`

Server-side-only placeholders:

- `INVITE_SECRET`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`
- `AZURE_OPENAI_API_VERSION`

Other config:

- PartyKit entrypoint: `partykit.json` -> `party/index.ts`
- MCP config: `.mcp.json` includes `babylon-mcp`

## 6) Architecture (Current Implementation)

### React <-> Engine Boundary

`src/components/BabylonCanvas.tsx` is the integration point:

- Creates/disposes `Game`
- Subscribes to `Game` callbacks (`onDebug`, `onHudUpdate`, `onArgumentStart`, `onArgumentUpdate`, `onGameOver`)
- Sends chat input back through `game.submitChatMessage()`

No global state manager is used for engine data; event callbacks are the contract.

### Game Loop and Phases

`engine/Game.ts` owns core runtime:

- `LOADING` -> `PLAYING` -> `ARGUMENT` -> `GAME_OVER`
- Scene composition:
  - forest
  - lighting/shadows
  - post-processing
  - player
  - monster
  - audio system
- Catch handling:
  - shake + sting trigger
  - freeze player/monster
  - reducer transition to argument session

### Input and Camera

`engine/PlayerController.ts`:

- Camera hierarchy: `camRoot -> yTilt -> UniversalCamera`
- Movement: WASD strafe/forward-back
- Mouse look: pointer lock + yaw/pitch clamp
- Collision path: `moveWithCollisions` + ray-ground check
- Feel systems: head bob + camera shake code paths

### Argument Subsystem

- `game/chat.ts`: deterministic taunts and keyword scoring
- `game/logic.ts`: reducer transitions for argument lifecycle
- `src/components/MonsterChat.tsx`: themed overlay and typewriter effect

## 7) Commands

Current scripts in `package.json`:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`
- `npm run verify:phase1:static`
- `npm run verify:phase1:runtime-smoke`
- `npm run verify:phase2:static`
- `npm run verify:phase2:runtime-smoke`
- `npm run verify:phase25:static`
- `npm run verify:phase25:runtime-smoke`
- `npm run verify:phase3:static`
- `npm run verify:phase3:runtime-smoke`
- `npm run party:dev`
- `npm run party:deploy`

## 8) Roadmap and Phase Plan

This section replaces prior plan-file content. Keep this updated as work progresses.

### Phase Matrix

| Phase | Goal | Status | Gate |
| --- | --- | --- | --- |
| 1 | Project scaffolding + core 3D single-player loop | Complete | GO (`docs/verification/phase1-checklist.md`) |
| 2 | Monster + catch + argument loop | Complete | GO (`docs/verification/phase2-checklist.md`) |
| 2.5 | Controls modernization (WASD strafe + mouse look) | Complete | GO (`docs/verification/phase25-checklist.md`) |
| 3 | Polish and atmosphere | Partial | NO-GO (`docs/verification/phase3-checklist.md`) |
| 4 | Multiplayer (PartyKit) | Not started | Planned |
| 5 | AI players + Azure LLM chat | Not started | Planned |
| 6 | Deployment + invite gating | Not started | Planned |

### Phase 1: Project Scaffolding and Core 3D Engine

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

### Phase 2: Game Mechanics (Monster, Catching, Chat Stub)

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

### Phase 2.5: Controls Modernization

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

### Phase 3: Polish and Atmosphere (Quake Aesthetic)

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
  - Manual evidence refresh pending
  - NO-GO for Phase 4 entry (current)

### Phase 4: Multiplayer (PartyKit)

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

Implementation status:

- Not started.

### Phase 5: AI Players and Azure LLM

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

Implementation status:

- Not started.

### Phase 6: Deployment and Invite System

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

Implementation status:

- Not started.

## 9) Verification Framework

### Global Procedure

After each phase implementation:

1. Run static gate commands.
2. Run deterministic runtime checks (scripted where available).
3. Run MCP probes (Playwright + Chrome DevTools).
4. Run Inspector/Spector checks if required by checklist.
5. Update phase checklist with timestamped evidence.
6. Mark explicit GO/NO-GO decision.

### Static Gate Pattern

- `npm run typecheck`
- `npm run build`
- phase-specific static script (`verify:phaseX:static`)

### Runtime Gate Pattern

- `scripts/verify-phase1-runtime-smoke.mjs`
- `scripts/verify-phase2-runtime-smoke.mjs`
- `scripts/verify-phase25-runtime-smoke.mjs`
- `scripts/verify-phase3-runtime-smoke.mjs`
- phase-specific manual/MCP checks documented in `docs/verification/phaseX-checklist.md`

## 10) Current Risks and Drifts

1. Phase 3 verification evidence drift:
   - Manual evidence set in checklist still contains stale pre-fix observations and must be refreshed.
2. Headless runtime variability:
   - Audio/camera behavior can vary by browser environment; keep automated gate plus manual evidence.
3. Debug tooling noise:
   - Spector warnings can pollute console cleanliness checks
4. Documentation consistency:
   - planning/progress must be updated here, not in external plan files

## 11) Active TODO Queue (Execution Order)

When resuming work toward Phase 3 GO:

1. Refresh manual runtime evidence in `docs/verification/phase3-checklist.md` (Playwright MCP + Chrome DevTools MCP + Inspector/Spector).
2. Confirm final GO/NO-GO for Phase 4 and update checklist + README snapshot.
3. If GO, begin Phase 4 multiplayer implementation.

## 12) Agent Workflow Contract

Every agent touching roadmap or progress must:

1. Update this README:
   - phase matrix status
   - phase implementation status notes
   - active TODO queue
2. Update relevant `docs/verification/phaseX-checklist.md` with evidence.
3. Keep README and verification docs consistent.
4. Do not create a new standalone plan file for phase tracking.

## 13) Fast Navigation

- Engine orchestrator: `engine/Game.ts`
- Input/camera: `engine/PlayerController.ts`
- Monster logic: `engine/Monster.ts`
- Chat scoring: `game/chat.ts`
- Reducer: `game/logic.ts`
- React bridge: `src/components/BabylonCanvas.tsx`
- Current gate status: `docs/verification/phase3-checklist.md`
