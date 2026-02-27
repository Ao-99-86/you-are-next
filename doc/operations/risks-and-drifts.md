# Risks and Drifts (Coding Agents)

## Purpose

Track active technical risk items that can affect delivery confidence.

1. Headless runtime variability:
   - Audio/camera behavior can vary by browser environment; keep automated gates plus checklist evidence.
2. Large bundle warning:
   - Build emits chunk-size warning (`index` chunk > 500 kB); not a release blocker but a performance follow-up.
