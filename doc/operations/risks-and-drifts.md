# Risks and Drifts (Coding Agents)

## Purpose

Track active technical risk items that can affect delivery confidence.

1. Headless runtime variability:
   - Audio/camera behavior can vary by browser environment; keep automated gates plus checklist evidence.
2. Large bundle warning:
   - Build emits chunk-size warning (`index` chunk > 500 kB); not a release blocker but a performance follow-up.
3. Rain particle performance (added `2026-02-28`):
   - Rain `ParticleSystem` emits 3000 particles/frame across the full map footprint (MAP_WIDTH=60, MAP_DEPTH=500). On lower-end GPUs this may cause frame-rate drops. Mitigate by reducing `emitRate` in `engine/ForestMap.ts` if profiling shows >10% GPU budget impact. Observed 60 FPS on test device during post-Phase 6 verification.
4. Increased scene complexity (added `2026-02-28`):
   - TREE_COUNT raised from 150 to 350 and visible path segments (~63 planes) added. If load times become unacceptable, consider instanced mesh rendering for trees (`Mesh.instances`) and merging path segments into a single mesh.
