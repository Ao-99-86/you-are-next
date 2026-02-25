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
  FALLEN_LOG_COUNT,
  ROCK_COUNT,
} from "../game/constants";
import { createGround, createTree, createRock, createFallenLog, createWall } from "./MeshFactory";

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Simple value noise for organic placement variation */
function valueNoise(x: number, z: number, seed: number): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
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

    // Leave a narrow winding corridor
    const corridorCenter = Math.sin((z - START_Z) * 0.03) * 8;
    if (Math.abs(x - corridorCenter) < CORRIDOR_WIDTH) continue;
    if (Math.hypot(x, z - START_Z) < START_CLEAR_RADIUS) continue;
    if (Math.hypot(x, z - FINISH_Z) < FINISH_CLEAR_RADIUS) continue;

    // Noise-varied minimum spacing for organic clustering (0.7x to 1.3x)
    const spacingVariation = 0.7 + valueNoise(x, z, 42) * 0.6;
    const effectiveSpacing = TREE_SPACING * spacingVariation;
    if (tooClose(x, z, placed, effectiveSpacing)) continue;

    const radius = rand(TREE_MIN_RADIUS, TREE_MAX_RADIUS);
    const height = rand(TREE_MIN_HEIGHT, TREE_MAX_HEIGHT);
    createTree(scene, x, z, radius, height, root);
    placed.push({ x, z });
    treesPlaced++;
  }

  // Fallen logs
  let logsPlaced = 0;
  let logAttempts = 0;
  while (logsPlaced < FALLEN_LOG_COUNT && logAttempts < FALLEN_LOG_COUNT * 10) {
    logAttempts++;
    const x = rand(-halfW + 4, halfW - 4);
    const z = rand(-halfD + 15, halfD - 15);
    const corridorCenter = Math.sin((z - START_Z) * 0.03) * 8;
    if (Math.abs(x - corridorCenter) < CORRIDOR_WIDTH + 1) continue;
    if (Math.hypot(x, z - START_Z) < START_CLEAR_RADIUS) continue;
    if (Math.hypot(x, z - FINISH_Z) < FINISH_CLEAR_RADIUS) continue;
    if (tooClose(x, z, placed, 2.0)) continue;

    const length = rand(2.5, 5.0);
    const rotation = rand(0, Math.PI);
    createFallenLog(scene, x, z, length, rotation, root);
    placed.push({ x, z });
    logsPlaced++;
  }

  // Scatter rocks with size variety and clustering
  let rocksPlaced = 0;
  let rockAttempts = 0;
  while (rocksPlaced < ROCK_COUNT && rockAttempts < ROCK_COUNT * 10) {
    rockAttempts++;
    const x = rand(-halfW + 3, halfW - 3);
    const z = rand(-halfD + 15, halfD - 15);
    const corridorCenter = Math.sin((z - START_Z) * 0.03) * 8;
    if (Math.abs(x - corridorCenter) < CORRIDOR_WIDTH) continue;
    if (Math.hypot(x, z - START_Z) < START_CLEAR_RADIUS) continue;
    if (Math.hypot(x, z - FINISH_Z) < FINISH_CLEAR_RADIUS) continue;
    if (tooClose(x, z, placed, 1.5)) continue;

    // Size variety: small (70%), medium (20%), large (10%)
    const sizeRoll = Math.random();
    const size = sizeRoll < 0.7 ? rand(0.3, 0.8)
      : sizeRoll < 0.9 ? rand(0.8, 1.5)
      : rand(1.5, 2.5);

    createRock(scene, x, z, size, root);
    placed.push({ x, z });
    rocksPlaced++;

    // Rock clustering: 30% chance to spawn 1-2 smaller rocks nearby
    if (Math.random() < 0.3) {
      const clusterCount = 1 + Math.floor(Math.random() * 2);
      for (let c = 0; c < clusterCount; c++) {
        const cx = x + rand(-1.5, 1.5);
        const cz = z + rand(-1.5, 1.5);
        if (!tooClose(cx, cz, placed, 0.8)) {
          createRock(scene, cx, cz, rand(0.2, 0.5), root);
          placed.push({ x: cx, z: cz });
        }
      }
    }
  }

  return root;
}
