# Phase 1 Verification Checklist

This checklist gates entry into Phase 2. Phase 2 work must not start until all required checks pass.

## Sources of Truth

- `GamePlan.txt` (Phase 1 Work + Testable sections)
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
- [ ] Forest scene is dark/foggy and renders successfully.
  - Evidence: render loop confirmed on `/play` (Babylon WebGL logs + live debug overlay updates); explicit visual dark/fog assertion still pending manual check.
- [ ] WASD/arrow controls move the player; camera follows behind.
  - Evidence: movement confirmed in Playwright after focusing canvas and holding `W` for 2s (`Z: -130.0 -> -76.2`, `Progress: 0% -> 20%`); explicit camera-follow assertion still pending manual check.
- [ ] Boundary walls prevent leaving map bounds.
  - Evidence:
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
3. Use debuging tools including @babylonjs/inspector, spectorjs, Playwright MCP, Chrome DevTools MCP
4. Verify movement/camera/collision scenarios
5. Traverse to finish zone and verify console logs

Results:

- [x] Landing -> Play navigation pass
  - Evidence: Playwright clicked `Play` on `/` and reached `/play` with active canvas/debug overlay (`2026-02-23 20:34 PST`).
- [ ] Movement + camera pass
  - Evidence: movement verified via debug delta (`W` key moved `Z: -130.0 -> -76.2`); camera-follow behavior still pending explicit manual assertion.
- [ ] Boundary collision pass
  - Evidence:
- [x] Finish-zone logging pass
  - Evidence: console emitted `[phase1] Finish zone crossed at z=140.18` and `[game] Game over: win` in `/play` run (`2026-02-23 20:34 PST`).

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

## Final Decision

- [ ] **GO Phase 2**
- [x] **NO-GO Phase 2**

Decision rationale:
- Remaining required runtime checks are not complete (`Forest dark/fog visual assertion`, `camera-follow manual assertion`, `boundary collision verification`).
