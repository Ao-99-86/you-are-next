# Onboarding Quickstart (Coding Agents)

## Purpose

Fast, reliable startup for coding agents modifying runtime, gameplay, or multiplayer behavior.

## Project Context

Build an over-the-shoulder 3D multiplayer horror game where 1-4 players run through a dark forest while being chased by a monster. Empty lobby slots are filled with server-side AI bots. If the monster catches a player (or bot), they enter a text argument sequence; winning frees the player, losing gets them eaten. Monster dialogue is upgraded with Azure OpenAI replies when configured.

## Product Constraints

- Solo-first flow: Phase 1 -> Phase 2 -> Phase 2.5 -> Phase 3 before multiplayer-heavy work.
- Visual direction: dark, low-poly, retro/Quake-like atmosphere.
- Multiplayer authority: PartyKit authoritative server.
- Chat AI progression: deterministic keyword stub first, Azure Foundry LLM later.

## Stack and Runtime

- Frontend: Vite + React 19 + TypeScript
- 3D engine: BabylonJS (`@babylonjs/core`)
- Multiplayer backend: PartyKit
- Network client: PartySocket
- Runtime automation: Playwright scripts
- Debug tooling: `@babylonjs/inspector`, `spectorjs`, Chrome DevTools MCP, Playwright MCP, babylon-mcp

## Environment and Config

From `.env.example`:

- `VITE_PARTYKIT_HOST=127.0.0.1:1999`
- `VITE_DEBUG=false`

Server-side placeholders:

- `INVITE_SECRET`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_DEPLOYMENT_NAME`

Note: Azure integration uses GA v1 path (`/openai/v1/chat/completions`) — no `api-version` query param needed.

Other config:

- PartyKit entrypoint: `partykit.json` -> `party/index.ts`
- MCP config: `.mcp.json` includes `babylon-mcp`

## First Commands

1. `npm run typecheck`
2. `npm run build`
3. `npm run dev`
4. Phase gates as needed from [Commands](../operations/commands.md)
