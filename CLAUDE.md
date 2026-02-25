# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"You Are Next" is an over-the-shoulder 3D multiplayer horror game built with BabylonJS, PartyKit, and React. Players run through a dark forest while being chased by a monster. Getting caught triggers a text-based argument; win and you're freed, lose and you're eaten. Quake 1 visual style (low-poly, dark, foggy).

## Commands

- `npm run dev` — Vite dev server (port 5173)
- `npm run build` — Production build to `dist/`
- `npm run verify:phase2:static` — Phase 2 static gate (`typecheck` + `build`)
- `npm run verify:phase2:runtime-smoke` — Automated Phase 2 runtime branch smoke test
- `npm run verify:phase25:static` — Phase 2.5 static gate (`typecheck` + `build`)
- `npm run verify:phase25:runtime-smoke` — Automated Phase 2.5 controls runtime smoke test
- `npm run verify:phase3:static` — Phase 3 static gate (`typecheck` + `build`)
- `npm run verify:phase3:runtime-smoke` — Automated Phase 3 runtime smoke (audio + camera-feel + regression checks)
- `npm run party:dev` — PartyKit dev server (port 1999, needed for multiplayer)
- `npx tsc --noEmit` — Type-check (party/ is excluded; it's built by PartyKit separately)

## Architecture

Three independent code layers that communicate through callbacks and shared types:

**`engine/`** — Pure TypeScript BabylonJS code (no React). This is the 3D game engine.
- `Game.ts` is the orchestrator: state machine (LOADING/PLAYING/ARGUMENT/GAME_OVER), render loop, and callback hooks for React (`onPlayerCaught`, `onGameOver`, `onDebug`).
- `Monster.ts` owns the primitive monster mesh and patrol/chase movement state.
- `PlayerController.ts` owns the camera hierarchy (camRoot → yTilt → UniversalCamera), WASD strafe movement, pointer-lock mouse look, and `moveWithCollisions()`.
- `ForestMap.ts` procedurally places ~150 trees with a winding corridor path, rocks, and boundary walls.
- `MeshFactory.ts` creates primitives with shared PBR material singletons (call `resetMaterialCache()` on dispose).

**`game/`** — Shared pure TypeScript logic used by both the browser client and PartyKit server. Must NOT import browser APIs (`window`, `document`) or Node APIs.
- `types.ts` — `GamePhase`, `GameResult`, shared interfaces
- `constants.ts` — All tunable game values (speeds, map dimensions, fog density, etc.)

**`src/`** — React UI layer (Vite + React Router).
- `BabylonCanvas.tsx` bridges React and BabylonJS: creates canvas, instantiates `Game`, wires callbacks.
- React renders overlays (HUD, chat, game over) on top of the BabylonJS canvas.

**`party/`** — PartyKit server (multiplayer). Has its own TypeScript context; excluded from the main `tsconfig.json`. Built independently by `npx partykit dev/deploy`.

## Key Patterns

- **React ↔ BabylonJS communication**: Game exposes callback properties (e.g., `game.onPlayerCaught = () => ...`). React calls methods on Game (e.g., `game.resumeChase()`). No shared state object — one-way events in each direction.
- **Camera system**: 3-level TransformNode hierarchy. `camRoot` follows player position and rotates on Y-axis (mouse yaw). `yTilt` applies pitch (mouse look + clamp). Camera is offset behind on local -Z. Default camera inputs are cleared (`camera.inputs.clear()`).
- **Materials**: PBR materials are cached as module-level singletons in MeshFactory to avoid creating duplicates.
- **Collisions**: BabylonJS built-in collision system (`mesh.moveWithCollisions()`, `mesh.checkCollisions`). Ground detection via raycast.

## Implementation Plan

See `README.md` for the canonical phased plan and current progress tracking. Agents must update `README.md` and `docs/verification/phaseX-checklist.md` when phase status changes.
