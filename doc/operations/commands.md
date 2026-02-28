# Commands (Coding Agents)

## Purpose

Command reference for development, static gates, runtime smoke checks, and multiplayer authority checks.

## Core

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run typecheck`

## Phase Static Gates

- `npm run verify:phase1:static`
- `npm run verify:phase2:static`
- `npm run verify:phase25:static`
- `npm run verify:phase3:static`
- `npm run verify:phase4:static`
- `npm run verify:phase5:static`

## Phase Runtime/Authority Gates

- `npm run verify:phase1:runtime-smoke`
- `npm run verify:phase2:runtime-smoke`
- `npm run verify:phase25:runtime-smoke`
- `npm run verify:phase3:runtime-smoke`
- `npm run verify:phase4:runtime-smoke`
- `npm run verify:phase4:authority`
- `npm run verify:phase5:bots`          ← bot spawn, movement, argument auto-resolve
- `npm run verify:phase5:azure`         ← Azure config detection + deterministic fallback

## PartyKit

- `npm run party:dev`
- `npm run party:deploy`
