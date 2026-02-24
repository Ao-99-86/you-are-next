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

- [ ] `engine/Monster.ts` implements monster mesh and AI states (`PATROL -> CHASE`) with proximity trigger.
  - Evidence:
- [ ] `game/chat.ts` implements stub monster taunts + keyword-based scoring over 3 rounds.
  - Evidence:
- [ ] `game/logic.ts` implements `gameUpdater()` reducer for `PLAYER_CAUGHT`, `CHAT_MESSAGE`, `ARGUMENT_WON`, `ARGUMENT_LOST`.
  - Evidence:
- [ ] `src/components/MonsterChat.tsx` provides fullscreen argument overlay with chat log, text input, and timer.
  - Evidence:
- [ ] `src/components/HUD.tsx` displays game phase and distance-to-goal info.
  - Evidence:
- [ ] `src/components/GameOverScreen.tsx` displays end-state UI for win/lose outcomes.
  - Evidence:
- [ ] `engine/Game.ts` supports `ARGUMENT` and `GAME_OVER` states with freeze/resume flow.
  - Evidence:
- [ ] React <-> Babylon wiring is complete (engine callbacks to React overlays; React controls resume/eaten transitions).
  - Evidence:

### Testable Items

- [ ] Monster patrols, then transitions to chase when player is within configured range.
  - Evidence:
- [ ] Catching the player opens chat overlay and freezes chase/movement gameplay.
  - Evidence:
- [ ] Chat overlay runs 3-round argument flow with pre-written monster taunts and player responses.
  - Evidence:
- [ ] Argument win frees player and chase resumes (player can be caught again later).
  - Evidence:
- [ ] Argument loss transitions to eaten/game-over flow and displays correct end-state.
  - Evidence:
- [ ] Reaching finish zone still produces win flow while Phase 2 systems are active.
  - Evidence:
- [ ] Full Phase 2 loop works end-to-end: chase -> catch -> argument -> win/lose branch -> proper continuation/end.
  - Evidence:

## Static Gate Commands

Run and record output status:

1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:phase1:static`

Results:

- [ ] Typecheck pass
  - Evidence:
- [ ] Build pass
  - Evidence:
- [ ] Combined static gate pass
  - Evidence:

## Runtime Playtest Procedure

1. Run `npm run dev`
2. Go to created localhost server
3. Use `@babylonjs/inspector` (`Shift+I`) to inspect active camera, monster mesh/state, and scene graph while scenarios run
4. Use `spectorjs` (`Shift+S`, `Shift+P`) to validate frame capture/pipeline inspection without runtime exceptions
5. Use `Playwright MCP` for deterministic route navigation and repeatable interaction scenarios
6. Use `Chrome DevTools MCP server` for console/network verification and runtime scene/state probes
7. Verify monster chase, catch, chat, resume, eaten, and finish-zone scenarios
8. Record outcomes with timestamps and tool-attributed evidence

Results:

- [ ] Landing -> Play navigation pass
  - Evidence:
- [ ] Monster AI patrol -> chase pass
  - Evidence:
- [ ] Catch -> argument overlay + freeze pass
  - Evidence:
- [ ] Chat 3-round loop pass
  - Evidence:
- [ ] Argument-won resume pass
  - Evidence:
- [ ] Argument-lost eaten/game-over pass
  - Evidence:
- [ ] Finish-zone win pass (with Phase 2 systems active)
  - Evidence:
- [ ] Console/network cleanliness pass (no unexpected runtime errors)
  - Evidence:

## Blocker Triage and Fix Loop

Use this section only if failures are found.

- [ ] Blockers identified and listed
- [ ] Minimal fixes applied for each blocker
- [ ] Affected checks re-run
- [ ] Static gate re-run after fixes

Blockers:

- None yet.

## Final Decision

- [ ] **GO Phase 3**
- [x] **NO-GO Phase 3**

Decision rationale:
- Pending completion of required Phase 2 static/runtime verification items and evidence capture.
