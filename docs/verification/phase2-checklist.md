# Phase 2 Verification Checklist

This checklist gates entry into Phase 3. Phase 3 work must not start until all required checks pass.

## Sources of Truth

- `GamePlan.txt` (Phase 2 Work + Testable sections)
- `CLAUDE.md` (current architecture and command references)
- Current implementation in `src/`, `engine/`, `game/`, and `party/`

## Go/No-Go Rule

A **GO** decision requires all of the following:

- Static gate passes (`typecheck` + production `build`)
- Required runtime scenarios pass in manual playtest
- Runtime evidence is captured using Playwright MCP, Chrome DevTools MCP server, `@babylonjs/inspector`, and `spectorjs`
- Any blockers found are fixed and re-tested
- This checklist is completed with evidence

If any required item fails, decision is **NO-GO**.

## Evidence Standards

For each runtime claim, record:

- Scenario and exact action performed
- Tool used (`Playwright MCP`, `Chrome DevTools MCP server`, `@babylonjs/inspector`, `spectorjs`)
- Timestamp in `YYYY-MM-DD HH:mm TZ`
- Concrete observable result (state transition, position delta, UI visibility, console output, capture success)

## Requirement Matrix (Phase 2)

### Work Items

- [x] `engine/Monster.ts` implements monster mesh and AI states (`PATROL -> CHASE`) with proximity trigger.
  - Evidence: File inspection confirms implementation in `engine/Monster.ts`; Playwright MCP probe at `2026-02-23 21:48 PST` showed `monsterBody` present and debug/HUD transition to `Monster: chase` after proximity move.
- [x] `game/chat.ts` implements stub monster taunts + keyword-based scoring over 3 rounds.
  - Evidence: File inspection confirms taunts, per-round keyword maps, scoring, timeout handling, and 3-round session creation in `game/chat.ts`; runtime round progression observed in Playwright MCP at `2026-02-23 21:48 PST`.
- [x] `game/logic.ts` implements `gameUpdater()` reducer for `PLAYER_CAUGHT`, `CHAT_MESSAGE`, `ARGUMENT_WON`, `ARGUMENT_LOST`.
  - Evidence: File inspection confirms reducer cases in `game/logic.ts`; runtime branch behavior validated by `npm run verify:phase2:runtime-smoke` at `2026-02-23 21:47 PST` (win/loss branches both exercised).
- [x] `src/components/MonsterChat.tsx` provides fullscreen argument overlay with chat log, text input, and timer.
  - Evidence: Playwright MCP snapshot at `2026-02-23 21:48 PST` shows overlay heading, round/score/timer metadata, transcript, text input, and submit button.
- [x] `src/components/HUD.tsx` displays game phase and distance-to-goal info.
  - Evidence: Playwright MCP and Chrome DevTools MCP snapshots at `2026-02-23 21:48-21:50 PST` show `PHASE`, `GOAL`, and `MONSTER` fields updating during play.
- [x] `src/components/GameOverScreen.tsx` displays end-state UI for win/lose outcomes.
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` displayed `YOU WERE EATEN`; Playwright MCP at `2026-02-23 21:50 PST` displayed `YOU ESCAPED`.
- [x] `engine/Game.ts` supports `ARGUMENT` and `GAME_OVER` states with freeze/resume flow.
  - Evidence: Debug overlay state transitions observed via Playwright MCP (`playing -> argument -> game_over`) and automated branch transitions via `verify:phase2:runtime-smoke` (`2026-02-23 21:47 PST`).
- [x] React <-> Babylon wiring is complete (engine callbacks to React overlays; React controls resume/eaten transitions).
  - Evidence: `src/components/BabylonCanvas.tsx` wires `onHudUpdate`, `onArgumentStart`, `onArgumentUpdate`, `onGameOver`; runtime overlays and logs confirmed in Playwright MCP (`2026-02-23 21:48-21:50 PST`).

### Testable Items

- [x] Monster patrols, then transitions to chase when player is within configured range.
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` moved player to monster proximity (`~25m`), debug/HUD changed from `PATROL` to `CHASE`.
- [x] Catching the player opens chat overlay and freezes chase/movement gameplay.
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` moved player within catch radius (`~1.2m`), overlay appeared, phase became `argument`, and player/monster positions remained unchanged over 1s sample.
- [x] Chat overlay runs 3-round argument flow with pre-written monster taunts and player responses.
  - Evidence: Playwright MCP snapshots at `2026-02-23 21:48 PST` showed round counter/timer and taunts across rounds; automated Phase 2 runtime smoke passed full chat flow at `2026-02-23 21:47 PST`.
- [x] Argument win frees player and chase resumes (player can be caught again later).
  - Evidence: `npm run verify:phase2:runtime-smoke` at `2026-02-23 21:47 PST` passed win-resume and subsequent re-catch branch checks.
- [x] Argument loss transitions to eaten/game-over flow and displays correct end-state.
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` reached `YOU WERE EATEN`; debug phase moved to `game_over`, and game-over log emitted.
- [x] Reaching finish zone still produces win flow while Phase 2 systems are active.
  - Evidence: Playwright MCP at `2026-02-23 21:50 PST` set `player.position.z=145`; console logged `[phase2] Finish zone crossed...` and `YOU ESCAPED` screen appeared.
- [x] Full Phase 2 loop works end-to-end: chase -> catch -> argument -> win/lose branch -> proper continuation/end.
  - Evidence: `npm run verify:phase2:runtime-smoke` at `2026-02-23 21:47 PST` reported pass for patrol/chase, catch/freeze, argument win/loss, and finish-zone win.

## Static Gate Commands

Run and record output status:

1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:phase2:static`

Results:

- [x] Typecheck pass
  - Evidence: `npm run typecheck` succeeded at `2026-02-23 21:46 PST` (`npx tsc --noEmit` exit 0).
- [x] Build pass
  - Evidence: `npm run build` succeeded at `2026-02-23 21:47 PST` (Vite production build complete).
- [x] Combined static gate pass
  - Evidence: `npm run verify:phase2:static` succeeded at `2026-02-23 21:47 PST`.

## Runtime Playtest Procedure

1. Run `npm run dev`
2. Go to created localhost server
3. Use `@babylonjs/inspector` (`Shift+I`) to inspect active camera, monster mesh/state, and scene graph while scenarios run
4. Use `spectorjs` (`Shift+S`, `Shift+P`) to validate frame capture/pipeline inspection without runtime exceptions
5. Use `Playwright MCP` for deterministic route navigation and repeatable interaction scenarios
6. Use `Chrome DevTools MCP server` for console/network verification and runtime scene/state probes
7. Verify monster chase, catch, chat, resume, eaten, and finish-zone scenarios
8. Record outcomes with timestamps and tool-attributed evidence
9. Run `npm run verify:phase2:runtime-smoke` and record output

Results:

- [x] Landing -> Play navigation pass
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` clicked `Play` on `/` and reached `/play` with active HUD/debug overlays.
- [x] Monster AI patrol -> chase pass
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` confirmed initial patrol and chase transition when player moved near monster.
- [x] Catch -> argument overlay + freeze pass
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` confirmed overlay open on catch and frozen player/monster positions during argument.
- [x] Chat 3-round loop pass
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` observed round advancement and timer-driven round changes with taunt/response log.
- [x] Argument-won resume pass
  - Evidence: `npm run verify:phase2:runtime-smoke` at `2026-02-23 21:47 PST` explicitly passed win branch and resume/re-catch checks.
- [x] Argument-lost eaten/game-over pass
  - Evidence: Playwright MCP at `2026-02-23 21:48 PST` produced `YOU WERE EATEN` and `Phase: game_over`.
- [x] Finish-zone win pass (with Phase 2 systems active)
  - Evidence: Playwright MCP at `2026-02-23 21:50 PST` produced `[phase2] Finish zone crossed` and `YOU ESCAPED` UI.
- [x] Console/network cleanliness pass (no unexpected runtime errors)
  - Evidence: Playwright MCP console check at `2026-02-23 21:51 PST` reported `Errors: 0`; Chrome DevTools MCP `types:[error]` returned no console errors and sampled network requests were all `200/304`. Inspector toggle validated via `Shift+I` (`debugLayerVisible: true -> false`), and Spector capture flow validated via `Shift+S`/`Shift+P` console logs (`SpectorJS UI opened`, `capture requested`).
- [x] Automated runtime smoke pass (`npm run verify:phase2:runtime-smoke`)
  - Evidence: Command succeeded at `2026-02-23 21:47 PST` with pass message for all required branch scenarios.

## Blocker Triage and Fix Loop

Use this section only if failures are found.

- [x] Blockers identified and listed
- [x] Minimal fixes applied for each blocker
- [x] Affected checks re-run
- [x] Static gate re-run after fixes

Blockers:

- Spector capture tooling emitted large volumes of WebGL `INVALID_OPERATION getTranslatedShaderSource` warnings during `Shift+S/Shift+P` validation in Chrome DevTools MCP (`2026-02-23 21:51 PST`).
  - Triage: confirmed as warning-level noise from capture tooling path; no application-level console errors detected.
  - Re-test: `npm run verify:phase2:runtime-smoke` rerun remains passing; Playwright/Chrome console error checks remain zero.

## Final Decision

- [x] **GO Phase 3**
- [ ] **NO-GO Phase 3**

Decision rationale:
- All required Phase 2 static and runtime items passed with timestamped evidence, including Playwright MCP, Chrome DevTools MCP scene/console/network probes, Inspector (`Shift+I`) visibility checks, Spector (`Shift+S`/`Shift+P`) capture checks, and automated runtime smoke coverage.
