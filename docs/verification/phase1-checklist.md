# Phase 1 Verification Checklist

This checklist gates entry into Phase 2. Phase 2 work must not start until all required checks pass.

## Sources of Truth

- `README.md` (Phase 1 Work + Testable sections)
- `CLAUDE.md` (current architecture and command references)
- Current implementation in `src/`, `engine/`, `game/`, and `party/`

## Go/No-Go Rule

A **GO** decision requires all of the following:

- Static gate passes (`typecheck` + production `build`)
- Required runtime scenarios pass in manual playtest
- Any blockers found are fixed and re-tested
- This checklist is completed with evidence

If any required item fails, decision is **NO-GO**.

## Requirement Matrix (Phase 1)

### Work Items

- [x] Vite + React + TypeScript project scaffolding exists and runs.
  - Evidence: `index.html`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx`, `package.json` present; `npm run build` passes.
- [x] Router includes `/` landing and `/play` game route.
  - Evidence: `src/App.tsx` defines routes for `/` and `/play`.
- [x] `BabylonCanvas` uses `useRef` + `useEffect` to create/dispose `Game`.
  - Evidence: `src/components/BabylonCanvas.tsx` uses `canvasRef` + `useEffect`, calls `new Game(canvas)` and `game.dispose()` in cleanup.
- [x] `engine/Game.ts` orchestrates engine, scene, and render loop with game phases.
  - Evidence: `engine/Game.ts` creates Engine/Scene, manages phase switch/render loop, emits callbacks.
- [x] `engine/PlayerController.ts` has over-the-shoulder camera hierarchy and input movement with collisions.
  - Evidence: camera hierarchy `camRoot -> yTilt -> UniversalCamera`, WASD handling, `moveWithCollisions()`, ground raycast.
- [x] `engine/ForestMap.ts` builds ground, dense trees, and boundary walls.
  - Evidence: creates ground, 4 boundary walls, dense tree placement with corridor constraints.
- [x] `engine/Lighting.ts` sets dim lighting and fog atmosphere.
  - Evidence: hemispheric light + `FOGMODE_EXP2` + dark clear/ambient colors.
- [x] `engine/MeshFactory.ts` provides primitive creation helpers and dark materials.
  - Evidence: `createGround/createTree/createRock/createWall` plus cached dark PBR materials.
- [x] `game/constants.ts` and `game/types.ts` contain initial shared values/types.
  - Evidence: map/player/camera/fog/gravity constants and game enums/types exist.
- [x] `party/index.ts`, `partykit.json`, `.env.example`, `.gitignore` stubs exist.
  - Evidence: PartyKit stub server and config/env/gitignore files present.

### Testable Items

- [x] `npm run dev` starts app and `/play` is reachable from landing page.
  - Evidence: confirmed on `2026-02-23 20:34 PST` (`VITE v6.4.1 ready`, `Local: http://127.0.0.1:5173/`) and Playwright route click-through to `http://127.0.0.1:5173/play`.
- [x] Forest scene is dark/foggy and renders successfully.
  - Evidence: verified on `2026-02-24` at `http://127.0.0.1:5174/play`; Playwright screenshot shows visible foggy forest scene (not blank), and camera center ray intersects ground (`hitGround: true`, distance `18.05`).
- [x] WASD/arrow controls move the player; camera follows behind.
  - Evidence: Playwright hold-`W` for 2s on `2026-02-24` moved player `Z: -130.0 -> -77.7`; camera followed with near-constant trailing offset (`cam Z: -138.7 -> -87.1`).
- [x] Boundary walls prevent leaving map bounds.
  - Evidence: collision probe on `2026-02-24` (`player.moveWithCollisions(±80,0,0)` from spawn lane) clamps lateral position near map limits (`X ~= -48.66` and `X ~= 49.33`), confirming wall blocking.
- [x] Crossing finish zone logs completion (`[phase1] Finish zone crossed ...`).
  - Evidence: runtime Playwright run on `2026-02-23 20:34 PST` logged `[phase1] Finish zone crossed at z=140.18` with `Z: 139.7` and `Progress: 100%`.

## Static Gate Commands

Run and record output status:

1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:phase1:static`

Results:

- [x] Typecheck pass
  - Evidence: `npm run typecheck` exited 0 (`npx tsc --noEmit`).
- [x] Build pass
  - Evidence: `npm run build` exited 0 (Vite production build completed).
- [x] Combined static gate pass
  - Evidence: `npm run verify:phase1:static` exited 0 (typecheck + build).

## Runtime Playtest Procedure

1. Run `npm run dev`
2. Go to created localhost server
3. Use debuging tools including babylonjs/inspector, spectorjs, Playwright MCP, Chrome DevTools MCP
4. Verify movement/camera/collision scenarios
5. Traverse to finish zone and verify console logs
6. Run `npm run verify:phase1:runtime-smoke` for automated runtime regression checks

Results:

- [x] Landing -> Play navigation pass
  - Evidence: Playwright clicked `Play` on `/` and reached `/play` with active canvas/debug overlay (`2026-02-23 20:34 PST`).
- [x] Movement + camera pass
  - Evidence: `2026-02-24` Playwright run holding `W` for 2s: player `Z -130.0 -> -77.7`, camera `Z -138.7 -> -87.1` (camera remains behind while tracking player position).
- [x] Boundary collision pass
  - Evidence: `2026-02-24` collision probe via `moveWithCollisions` against ±X walls clamps near boundaries (`X ~= -48.66`, `X ~= 49.33`) instead of exiting map.
- [x] Finish-zone logging pass
  - Evidence: console emitted `[phase1] Finish zone crossed at z=140.18` and `[game] Game over: win` in `/play` run (`2026-02-23 20:34 PST`).
- [x] Automated runtime smoke pass
  - Evidence: `npm run verify:phase1:runtime-smoke` passed on `2026-02-24` (`[runtime-smoke] Passed: render, camera, movement, boundary, and console checks.`).

## Blocker Triage and Fix Loop

Use this section only if failures are found.

- [x] Blockers identified and listed
- [x] Minimal fixes applied for each blocker
- [x] Affected checks re-run
- [x] Static gate re-run after fixes

Blockers:

- Resolved: browser console error `GET /favicon.ico 404` during runtime checks.
  - Fix: added `public/favicon.svg` and linked it from `index.html`.
  - Re-test: Playwright console error count is now 0 at `/` and `/play`.
- Resolved: `/play` could present as a blank screen in dev despite active render loop.
  - Root causes:
    - Camera view direction was inverted by per-frame `setTarget()` on a parented `UniversalCamera` (camera center ray pointed away from expected scene view).
    - Material cache reused stale scene-bound materials across remount/dispose cycles, causing invalid material reuse in subsequent scene instances.
    - Debug setup called `spector.spyCanvases()` during startup, producing runtime `TypeError` noise in current dev verification flow.
  - Fixes:
    - Removed per-frame camera `setTarget()` in `PlayerController` and relied on camera hierarchy transforms for stable over-the-shoulder orientation.
    - Hardened `Game.start()`/debug setup against dispose races and moved Spector canvas spying to on-demand shortcut usage.
    - Reset material cache on `Game.dispose()` and recreate cached materials when scene instance changes.
  - Re-test (`2026-02-24`): `/play` shows visible forest scene, camera center ray hits ground (`hitGround: true`), and Playwright reports 0 console errors.

## Final Decision

- [x] **GO Phase 2**
- [ ] **NO-GO Phase 2**

Decision rationale:
- Static gate passes and required runtime checks now have current dated evidence, including resolved blank-screen blocker and clean runtime console state.
