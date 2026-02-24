import { Scene, TransformNode } from "@babylonjs/core";
import {
  MAP_WIDTH,
  MAP_DEPTH,
  START_Z,
  FINISH_Z,
  TREE_COUNT,
  TREE_MIN_RADIUS,
  TREE_MAX_RADIUS,
  TREE_MIN_HEIGHT,
  TREE_MAX_HEIGHT,
  TREE_SPACING,
  CORRIDOR_WIDTH,
} from "../game/constants";
import { createGround, createTree, createRock, createWall } from "./MeshFactory";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Check if a position is too close to existing positions */
function tooClose(x: number, z: number, placed: { x: number; z: number }[], minDist: number): boolean {
  for (const p of placed) {
    const dx = x - p.x;
    const dz = z - p.z;
    if (dx * dx + dz * dz < minDist * minDist) return true;
  }
  return false;
}

export function buildForest(scene: Scene): TransformNode {
  const root = new TransformNode("forest", scene);
  const START_CLEAR_RADIUS = 16;
  const FINISH_CLEAR_RADIUS = 16;

  // Ground
  createGround(scene, MAP_WIDTH, MAP_DEPTH);

  // Boundary walls (invisible)
  const halfW = MAP_WIDTH / 2;
  const halfD = MAP_DEPTH / 2;
  createWall(scene, 0, -halfD, MAP_WIDTH, 1, root);    // near
  createWall(scene, 0, halfD, MAP_WIDTH, 1, root);     // far
  createWall(scene, -halfW, 0, 1, MAP_DEPTH, root);    // left
  createWall(scene, halfW, 0, 1, MAP_DEPTH, root);     // right

  // Place trees densely, leaving narrow winding paths
  const placed: { x: number; z: number }[] = [];
  const maxAttempts = TREE_COUNT * 10;
  let attempts = 0;
  let treesPlaced = 0;

  while (treesPlaced < TREE_COUNT && attempts < maxAttempts) {
    attempts++;
    const x = rand(-halfW + 2, halfW - 2);
    const z = rand(-halfD + 15, halfD - 15);

    // Leave a narrow winding corridor. Phase-align to spawn so the run starts in a clear lane.
    const corridorCenter = Math.sin((z - START_Z) * 0.03) * 8;
    if (Math.abs(x - corridorCenter) < CORRIDOR_WIDTH) continue;
    if (Math.hypot(x, z - START_Z) < START_CLEAR_RADIUS) continue;
    if (Math.hypot(x, z - FINISH_Z) < FINISH_CLEAR_RADIUS) continue;

    // Minimum spacing between trees
    if (tooClose(x, z, placed, TREE_SPACING)) continue;

    const radius = rand(TREE_MIN_RADIUS, TREE_MAX_RADIUS);
    const height = rand(TREE_MIN_HEIGHT, TREE_MAX_HEIGHT);
    createTree(scene, x, z, radius, height, root);
    placed.push({ x, z });
    treesPlaced++;
  }

  // Scatter some rocks
  const rockCount = 30;
  for (let i = 0; i < rockCount; i++) {
    const x = rand(-halfW + 3, halfW - 3);
    const z = rand(-halfD + 15, halfD - 15);
    const corridorCenter = Math.sin((z - START_Z) * 0.03) * 8;
    if (
      !tooClose(x, z, placed, 1.5) &&
      Math.abs(x - corridorCenter) >= CORRIDOR_WIDTH &&
      Math.hypot(x, z - START_Z) >= START_CLEAR_RADIUS &&
      Math.hypot(x, z - FINISH_Z) >= FINISH_CLEAR_RADIUS
    ) {
      createRock(scene, x, z, rand(0.5, 1.5), root);
      placed.push({ x, z });
    }
  }

  return root;
}
