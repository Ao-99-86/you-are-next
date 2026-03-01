# Repository Map (Coding Agents)

## Purpose

Quick orientation for where to implement behavior and where to verify regressions.

```text
src/
  main.tsx
  App.tsx
  styles.css
  hooks/
    useGameRoom.ts
  components/
    BabylonCanvas.tsx
    MultiplayerCanvas.tsx
    Lobby.tsx
    HUD.tsx
    MonsterChat.tsx
    GameOverScreen.tsx

engine/
  Game.ts
  MultiplayerGame.ts
  PlayerController.ts
  PuppetController.ts
  Monster.ts
  ForestMap.ts
  MeshFactory.ts
  ProceduralTextures.ts
  Lighting.ts
  PostProcessing.ts
  Audio.ts

game/
  constants.ts
  types.ts
  chat.ts
  logic.ts

party/
  index.ts
  aiPlayers.ts       ← Phase 5: bot creation, movement tick, deterministic chat
  azureChat.ts       ← Phase 5: Azure OpenAI client with fallback

scripts/
  verify-phase1-runtime-smoke.mjs
  verify-phase2-runtime-smoke.mjs
  verify-phase25-runtime-smoke.mjs
  verify-phase3-runtime-smoke.mjs
  verify-phase4-authority.mjs
  verify-phase4-runtime-smoke.mjs
  verify-phase5-bots.mjs         ← Phase 5: bot authority checks
  verify-phase5-azure.mjs        ← Phase 5: Azure fallback checks
  verify-phase6-invite.mjs       ← Phase 6: invite gating checks

doc/
  roadmap/
    phase-matrix.md
    phase-details.md
  verification/
    phase1-checklist.md
    phase2-checklist.md
    phase25-checklist.md
    phase3-checklist.md
    phase4-checklist.md
    phase5-checklist.md
    phase6-checklist.md
```
