# Gameplay Loop (Coding Agents)

## Purpose

Capture gameplay state transitions and argument lifecycle contracts used by runtime and verification docs.

## Single-Player Core Phase Flow

`engine/Game.ts` owns runtime state transitions:

- `LOADING` -> `PLAYING` -> `ARGUMENT` -> `GAME_OVER`

Scene composition in active play:

- forest
- lighting/shadows
- post-processing
- player
- monster
- audio system

Catch handling:

- trigger camera shake + catch sting
- freeze player and monster updates
- transition reducer/session to argument state

## Argument Subsystem

- `game/chat.ts`: deterministic taunts + keyword scoring.
- `game/logic.ts`: reducer transitions for argument lifecycle.
- `src/components/MonsterChat.tsx`: themed overlay + typewriter presentation.

## Multiplayer Lifecycle Notes

In multiplayer, authoritative phase and argument state come from server snapshots (`RoomSnapshot` / `RoomEvent`) rather than local simulation.
