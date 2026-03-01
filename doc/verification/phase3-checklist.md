# Phase 3 Verification Checklist

This checklist gates entry into Phase 4. Phase 4 work must not start until all required checks pass.

## Sources of Truth

- `doc/roadmap/phase-details.md` (Phase 3 Work + Testable sections)
- `CLAUDE.md` (current architecture and command references)
- Current implementation in `src/`, `engine/`, `game/`, `public/`, and `party/`
- Babylon.js docs/API references validated through Babylon MCP server

## Go/No-Go Rule

A **GO** decision requires all of the following:

- Static gate passes (`typecheck` + production `build`)
- Automated runtime smoke gate passes (`npm run verify:phase3:runtime-smoke`)
- Required runtime scenarios pass in manual playtest
- Runtime evidence is captured using Playwright MCP, Chrome DevTools MCP server, `@babylonjs/inspector`, and `spectorjs`
- All strict Phase 3 plan deliverables are present, including:
  - texture assets in `public/textures/`
  - sound assets in `public/sounds/`
  - BabylonJS `Sound`-class-based audio integration for planned audio features
- Any blockers found are fixed and re-tested
- This checklist is completed with evidence

If any required item fails, decision is **NO-GO**.

## Evidence Standards

For each runtime claim, record:

- Scenario and exact action performed
- Tool used (`Playwright MCP`, `Chrome DevTools MCP server`, `@babylonjs/inspector`, `spectorjs`)
- Timestamp in `YYYY-MM-DD HH:mm TZ`
- Concrete observable result (state transition, property value, visual/audio behavior, console output, capture success)

Use this evidence format per item:

- Evidence: `<tool>`, `<timestamp>`, `<observable result>`

## Requirement Matrix (Phase 3)

### Work Items

- [x] `engine/MeshFactory.ts` uses low-res texture workflow and dark/high-roughness material setup for retro aesthetic.
  - Evidence: Code inspection (`engine/MeshFactory.ts`, `engine/ProceduralTextures.ts`) at `2026-02-24 22:28 PST` confirms dark PBR materials (`roughness=0.95`) and nearest-neighbor dynamic texture sampling (`Texture.NEAREST_SAMPLINGMODE`).
- [x] Texture assets required by the Phase 3 plan exist in `public/textures/`.
  - Evidence: Shell check at `2026-02-24 22:28 PST` shows `public/textures: MISSING`. Fixed `2026-02-24`: `scripts/generate-assets.mjs` generates and writes `bark.png`, `canopy.png`, `ground.png`, `rock.png`, `monster.png` (64×64 PNG, procedural Quake-style dark palette).
- [x] `engine/ForestMap.ts` includes improved organic placement plus fallen logs and rocks.
  - Evidence: Playwright MCP runtime probe at `2026-02-24 22:24 PST` reports `fallenLogCount=18`, `rockCount=75`, `trunkCount=150` from scene mesh names.
- [x] `engine/Lighting.ts` includes deeper fog, flickering point lights, and shadow generator wiring.
  - Evidence: Playwright MCP at `2026-02-24 22:24 PST` reports `fogMode=2 (EXP2)`, `fogDensity=0.035`, `pointLightCount=6`, `hasShadowGen=true`; Chrome DevTools MCP corroborates at `2026-02-24 22:27 PST`.
- [x] `engine/PostProcessing.ts` enables film grain and vignette in Babylon default rendering pipeline.
  - Evidence: Playwright MCP at `2026-02-24 22:24 PST` reports `grainEnabled=true`, `grainIntensity=25`, `grainAnimated=true`, `vignetteEnabled=true`, `vignetteWeight=3.5`.
- [x] `engine/PlayerController.ts` includes head bob while moving and catch-triggered camera shake.
  - Evidence: Source inspection at `2026-02-24 22:28 PST` confirms head-bob and shake code paths exist (`HEAD_BOB_*`, `shake(...)`, `_updateShake()`).
- [x] `engine/Monster.ts` uses a multi-primitive composite mesh and improved chase behavior.
  - Evidence: Playwright MCP scene probe at `2026-02-24 22:24 PST` confirms `monsterBody`, `monsterHead`, `monsterArmL/R`, `monsterEyeL/R` all present.
- [x] Planned audio behaviors are implemented and wired end-to-end: ambient loop, heartbeat on proximity, footsteps, catch sting.
  - Evidence: Source inspection (`engine/Audio.ts`, `engine/Game.ts`) at `2026-02-24 22:28 PST` confirms all four behavior methods are implemented and invoked in game loop/catch flow.
- [x] Sound assets required by the Phase 3 plan exist in `public/sounds/`.
  - Evidence: Shell check at `2026-02-24 22:28 PST` shows `public/sounds: MISSING`. Fixed `2026-02-24`: `scripts/generate-assets.mjs` generates `ambient.wav` (2 s brown-noise loop), `heartbeat.wav`, `footstep.wav`, `catch-sting.wav` — all 44100 Hz 16-bit mono PCM WAV.
- [x] Audio implementation uses BabylonJS `Sound` class per strict Phase 3 plan requirement.
  - Evidence: Code search at `2026-02-24 22:28 PST` finds no `new Sound(...)` usage and no Babylon audio imports. Fixed `2026-02-24`: `engine/Audio.ts` rewritten to `import { Sound } from "@babylonjs/core"`; four `new Sound(name, url, scene, null, options)` instances created for ambient, heartbeat, footstep, and catch-sting. `Game.ts` passes `this._scene` to `AudioSystem` constructor.
- [x] `src/components/MonsterChat.tsx` + `src/styles.css` provide horror styling and typewriter effect.
  - Evidence: Playwright MCP at `2026-02-24 22:27 PST` shows overlay style (`rgba(0,0,0,0.86)`, red title) and typewriter progression (`len 1 -> 16` over 450ms).

### Testable Items

- [x] Fog limits practical visibility to roughly 30 world units in corridor play.
  - Evidence: Runtime visual check plus configured `fogDensity=0.035` (`EXP2`) observed in Playwright/Chrome DevTools at `2026-02-24 22:24-22:27 PST`; distant corridor geometry heavily attenuated.
- [x] Flickering lights visibly modulate over time and shadow casting/receiving is active.
  - Evidence: Playwright probe at `2026-02-24 22:24 PST` shows time-varying point-light intensities and `ground.receiveShadows=true` with shadow generator present.
- [x] Grain and vignette post-processing are both active in runtime.
  - Evidence: Playwright + Chrome DevTools probes at `2026-02-24 22:24-22:27 PST` confirm grain and vignette flags enabled with expected values.
- [x] Head bob is active while moving and absent while idle/frozen.
  - Evidence: Playwright MCP at `2026-02-24 22:25 PST` measured `camRoot.y` sampling range `0.2887` during movement input and `0.0000` while idle.
- [x] Catch event triggers a visible short camera shake.
  - Evidence: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` observed non-zero catch camera ranges (`xRange > 0`, `yRange > 0`) in the argument transition window.
- [x] Monster becomes audibly threatening before it is visually obvious (proximity heartbeat behavior).
  - Evidence: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` validated heartbeat playback activity in a pre-catch proximity setup.
- [x] Chat overlay horror theming renders correctly and active taunt uses typewriter reveal.
  - Evidence: Playwright MCP at `2026-02-24 22:27 PST` confirms themed overlay and progressive taunt text reveal.
- [x] Core gameplay continuity remains intact under Phase 3 changes (catch -> argument -> win/loss -> continuation/end).
  - Evidence: Playwright runtime branch test at `2026-02-24 22:26 PST` returned `debugAfterWin: Phase: playing`, `gameOverText: YOU WERE EATEN`.
- [x] Finish-zone win still functions with Phase 3 systems active.
  - Evidence: Playwright branch test at `2026-02-24 22:26 PST` returned `finishText: YOU ESCAPED` and console logged finish-zone crossing.
- [x] No unexpected runtime errors during extended visual/audio playtest.
  - Evidence: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` completed with zero console errors, zero page errors, and zero autoplay warnings.
- [x] Debug tooling remains operational (`Shift+I`, `Shift+S`, `Shift+P`).
  - Evidence: Playwright debug-tool validation at `2026-02-24 22:27 PST` showed inspector toggle `false -> true -> false` and console logs for Spector UI/capture.

## Babylon.js Verification Anchors (MCP-grounded)

Validate the following Babylon runtime properties/objects during evidence collection:

- Fog:
  - `scene.fogMode === Scene.FOGMODE_EXP2`
  - `scene.fogDensity` configured to Phase 3 target
  - `scene.fogColor` set to dark atmospheric palette
- Post-processing (`DefaultRenderingPipeline`):
  - `grainEnabled === true`
  - `grain.intensity` matches configured constant
  - `grain.animated === true`
  - `imageProcessingEnabled === true`
  - `imageProcessing.vignetteEnabled === true`
  - `imageProcessing.vignetteWeight` matches configured constant
- Texturing:
  - Dynamic/procedural textures use nearest-neighbor sampling mode
- Lighting/shadows:
  - `ShadowGenerator` instantiated with configured map size
  - `addShadowCaster(...)` used for monster mesh
  - blur exponential shadow option active if configured
  - intended receivers (for example ground) have `receiveShadows = true`
- Movement/collision continuity:
  - Player and monster movement remains collision-driven (`moveWithCollisions` path)
- Audio strict-plan anchor:
  - BabylonJS `Sound` usage is present for ambient/spatial/catch sounds (strict gate item)

Observed runtime values (`2026-02-24 22:24-22:27 PST`):

- `fogMode=2`, `fogDensity=0.035`, `fogColor=[0.05,0.05,0.07]`
- `DefaultRenderingPipeline`: grain enabled/intensity `25`/animated `true`, vignette enabled/weight `3.5`
- Nearest texture sampling confirmed (`barkSampling=1`)
- Lighting/shadows: `pointLightCount=6`, shadow generator present, ground receives shadows
- Movement remains collision path (`moveWithCollisions` in player/monster source)
- Strict audio anchor passed: Babylon `Sound` usage present and runtime smoke validated audio activity (`2026-02-24 23:10 PST`)

## Gate Commands

Run and record output status:

1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:phase3:static`
4. `npm run verify:phase3:runtime-smoke`

Results:

- [x] Typecheck pass
  - Evidence: `npm run typecheck` exit 0 at `2026-02-24 22:23 PST`.
- [x] Build pass
  - Evidence: `npm run build` exit 0 at `2026-02-24 22:23 PST`.
- [x] Combined static gate pass
  - Evidence: `npm run verify:phase3:static` exit 0 at `2026-02-24 22:24 PST`; re-run exit 0 at `2026-02-24 23:11 PST`; latest re-run exit 0 at `2026-02-24 23:24 PST`.
- [x] Automated runtime smoke gate pass
  - Evidence: `npm run verify:phase3:runtime-smoke` exit 0 at `2026-02-24 23:10 PST` (`ambient+heartbeat+footstep+catch-sting` activity, catch-shake, and console checks); latest re-run exit 0 at `2026-02-24 23:25 PST`.

## Runtime Playtest Procedure

1. Run `npm run verify:phase3:runtime-smoke` (required automated runtime gate)
2. Run `npm run dev`
3. Open localhost play route (`/play`)
4. Use Playwright MCP for deterministic navigation and repeatable interaction scenarios
5. Use Chrome DevTools MCP server for console/network checks and runtime probes
6. Use `@babylonjs/inspector` (`Shift+I`) to inspect scene graph, lighting, post-process, and material state
7. Use `spectorjs` (`Shift+S`, `Shift+P`) to validate capture path and frame inspection
8. Verify visual atmosphere pass:
   - fog density/visibility
   - flicker lights
   - shadows
   - grain/vignette
9. Verify camera-feel pass:
   - head bob during movement
   - shake on catch
10. Verify audio pass:
   - ambient layer
   - monster proximity heartbeat
   - footsteps cadence
   - catch sting trigger
11. Verify gameplay-regression pass:
    - catch -> argument overlay -> outcome branches
    - finish-zone win
12. Verify strict-plan asset/compliance pass:
    - `public/textures/` asset set present
    - `public/sounds/` asset set present
    - BabylonJS `Sound` class integration present and exercised
13. Record timestamped evidence for each required item

Results:

- [x] Landing/Play route runtime boot pass
  - Evidence: Playwright navigation `/ -> /play` succeeded with active HUD/debug overlays at `2026-02-24 22:24 PST`.
- [x] Visual atmosphere pass
  - Evidence: Playwright and Chrome DevTools probes at `2026-02-24 22:24-22:27 PST` confirm fog/lights/shadows/post effects active with expected values.
- [x] Camera-feel pass
  - Evidence: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` reported observable catch-shake (`xRange > 0`, `yRange > 0`) plus head-bob checks.
- [x] Audio behavior pass
  - Evidence: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` validated Babylon audio unlock and runtime activity for ambient, heartbeat, footsteps, and catch-sting with zero autoplay warnings.
- [x] Gameplay continuity pass
  - Evidence: Playwright branch test passed win/loss/finish outcomes at `2026-02-24 22:26 PST`.
- [x] Strict-plan asset + Babylon `Sound` compliance pass
  - Evidence: Asset directories/files present (`public/textures/*`, `public/sounds/*`), Babylon `Sound` usage confirmed in source, and automated runtime smoke passed (`2026-02-24 23:10 PST`).
- [x] Console/network cleanliness pass (no unexpected runtime errors)
  - Evidence: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` reported zero console errors, zero page errors, and zero autoplay warnings.
- [x] Inspector + Spector debug-tool pass
  - Evidence: `Shift+I` toggled inspector visibility and `Shift+S`/`Shift+P` emitted expected debug logs at `2026-02-24 22:27 PST`.

## Blocker Triage and Fix Loop

Use this section only if failures are found.

- [x] Blockers identified and listed
- [x] Minimal fixes applied for each blocker
- [x] Affected checks re-run
- [x] Static gate re-run after fixes

Blockers:

- Strict-plan asset/audio deliverables missing: `public/textures/`, `public/sounds/`, and BabylonJS `Sound` integration.
  - Re-test: Shell and code-search checks at `2026-02-24 23:11 PST` confirm assets are present and `new Sound(...)` usage is in `engine/Audio.ts`.
  - Triage: Directly violated strict Phase 3 gate criteria.
  - Resolution: **FIXED** `2026-02-24`. Created `scripts/generate-assets.mjs` (PNG + WAV procedural generators). `engine/Audio.ts` uses `Sound` from `@babylonjs/core` (four `new Sound(...)` instances). Re-runs passed.
- Catch-shake effect not observable during catch transition.
  - Re-test: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` observed non-zero catch-shake ranges.
  - Triage: Root cause: `_updateArgument()` never called `_player.update()`, so `_updateShake()` never ran while in ARGUMENT phase.
  - Resolution: **FIXED** `2026-02-24`. Added `this._player.update()` in `_updateArgument()`. Player is frozen so movement is gated out; only shake runs. Re-test passed.
- Runtime audio validation blocked in automation context.
  - Re-test: `verify:phase3:runtime-smoke` at `2026-02-24 23:10 PST` completed with no autoplay warnings and validated unlock + playback activity.
  - Triage: Unlock was not previously guaranteed from a user gesture in runtime automation.
  - Resolution: **FIXED** `2026-02-24`. Added `Engine.audioEngine?.unlock()` to canvas click handler (`engine/PlayerController.ts`), making unlock deterministic in gesture-driven runtime.

## Final Decision

- [x] **GO Phase 4**
- [ ] **NO-GO Phase 4**

Decision rationale:

- All required Phase 3 checklist items are complete and previously identified blockers are fixed/re-tested.
- Latest gate command re-runs are passing (`verify:phase3:static`, `verify:phase3:runtime-smoke`) as of `2026-02-24 23:24-23:25 PST`.
- Phase 4 is unblocked and may start.

## Subsequent Drifts (Post-Phase 6 Overhaul — `2026-02-28`)

The following constants and implementations have changed since this gate was closed. The gate decision remains GO; these are recorded for traceability only.

| Item | Gate value | Current value |
| --- | --- | --- |
| `MAP_WIDTH` | 100 | 60 |
| `MAP_DEPTH` | 300 | 500 |
| `FOG_DENSITY` | 0.035 (at gate) / 0.02 (pre-overhaul) | 0.015 |
| `fogColor` | `(0.05, 0.05, 0.07)` (at gate) / `(0.02, 0.02, 0.03)` (pre-overhaul) | `(0.08, 0.10, 0.15)` |
| `HEMI_INTENSITY` | 0.5 | 1.0 |
| `FLICKER_LIGHT_COUNT` | 6 | 10 |
| `TREE_COUNT` | 150 | 350 |
| `CORRIDOR_WIDTH` | 6 | 5 |
| Sky texture | Flat blood-red base | Navy-to-fog vertical gradient |
| Rain particles | None | Added (`ParticleSystem`, 5000 cap, 3000/frame) |
| Thunder | None | Random directional light flashes (5–15 s interval, 150 ms, intensity 6.0) |
| Visible path | None | Emissive plane segments along sinusoidal corridor |

Full change details in `doc/roadmap/phase-details.md` — "Post-Phase 6: Visual & Gameplay Overhaul".
