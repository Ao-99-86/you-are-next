# Multiplayer Authority (Coding Agents)

## Purpose

Document the non-negotiable authority model for PartyKit-backed gameplay.

## Authority Invariants

- Server (`party/index.ts`) runs authoritative room simulation at 20 Hz during `playing`.
- Monster AI and catch/argument transitions are server-side only.
- Host-only start gating and readiness checks are server-enforced.
- Chat submissions are accepted only from the active caught player.
- Reconnect continuity uses stable client identity (`clientId`) and must not duplicate player entities.
- Snapshot broadcast (`ROOM_SNAPSHOT`) is the canonical world-state stream for clients.

## Client Responsibilities

- `useGameRoom.ts` maintains PartySocket connection and lifecycle methods.
- Client sends intent (`PLAYER_INPUT`, lobby actions, chat, assist) and renders authoritative snapshots.
- Remote puppets interpolate toward snapshot state; local prediction must not override authority.

## Verification Hooks

- Runtime smoke: `npm run verify:phase4:runtime-smoke`
- Authority validation: `npm run verify:phase4:authority`
- Phase gate evidence: `doc/verification/phase4-checklist.md`
