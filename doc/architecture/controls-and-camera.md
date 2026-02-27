# Controls and Camera (Coding Agents)

## Purpose

Define control and camera invariants so changes can be regression-tested quickly.

## Controller Contract (`engine/PlayerController.ts`)

- Camera hierarchy: `camRoot -> yTilt -> UniversalCamera`
- Movement: WASD strafe/forward-back
- Mouse look: pointer lock + yaw/pitch clamp
- Collision path: `moveWithCollisions` + ray-ground check
- Feel systems: head bob + camera shake

## Required Runtime Behaviors

- `A/D` strafe without implicit yaw rotation.
- Pointer lock enters on click and exits via `Esc` without destabilizing gameplay.
- Freeze states (argument/game-over) suppress active movement updates.
