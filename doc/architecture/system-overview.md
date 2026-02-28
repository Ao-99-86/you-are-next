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

## Bot and AI Boundary (Phase 5)

- `party/aiPlayers.ts` provides server-side bot logic: creation, movement tick (sinusoidal drift), deterministic chat messages, and LLM-fallback resolver.
- `party/azureChat.ts` provides server-only Azure OpenAI integration. Never imported by client. Reads `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT_NAME` from `process.env`; returns null on any missing var or network failure.
- Bots are spawned in `party/index.ts` at game start to fill empty slots (up to `BOT_COUNT`). They are removed at game end and are invisible in the lobby.
- Monster reply upgrades (Azure LLM) are fire-and-forget: the deterministic reply is broadcast immediately; the LLM reply patches it asynchronously if the session is still active.
