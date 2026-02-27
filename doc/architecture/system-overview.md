# System Overview (Coding Agents)

## Purpose

Define the boundary contracts between React UI, engine runtime, and network authority.

## React <-> Engine Boundary

`src/components/BabylonCanvas.tsx` is the single-player integration point.

- Creates/disposes `Game`.
- Subscribes to engine callbacks: `onDebug`, `onHudUpdate`, `onArgumentStart`, `onArgumentUpdate`, `onGameOver`.
- Sends chat input through `game.submitChatMessage()`.

No global state manager is used for engine data; callback events are the contract.

## Engine Runtime Ownership

- `engine/Game.ts`: single-player orchestration.
- `engine/MultiplayerGame.ts`: snapshot-driven multiplayer orchestration.
- `engine/PlayerController.ts`: movement, camera, look, feel systems.
- `engine/PuppetController.ts`: remote-player visuals.

## Multiplayer Ownership Boundary

- `party/index.ts` is authoritative for room state, monster behavior, argument sessions, and win/loss transitions.
- Client submits intent/input; server resolves world state and broadcasts snapshots/events.
- `src/hooks/useGameRoom.ts` maintains PartySocket connection, stable `clientId`, and send/receive loop.
