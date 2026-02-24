import {
  Scene,
  MeshBuilder,
  Mesh,
  PBRMaterial,
  Color3,
  TransformNode,
} from "@babylonjs/core";

function darkPBR(name: string, scene: Scene, r: number, g: number, b: number): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = new Color3(r, g, b);
  mat.roughness = 0.95;
  mat.metallic = 0;
  return mat;
}

let _barkMat: PBRMaterial | null = null;
let _canopyMat: PBRMaterial | null = null;
let _groundMat: PBRMaterial | null = null;
let _rockMat: PBRMaterial | null = null;

function barkMat(scene: Scene) {
  if (!_barkMat) _barkMat = darkPBR("bark", scene, 0.2, 0.14, 0.08);
  return _barkMat;
}

function canopyMat(scene: Scene) {
  if (!_canopyMat) _canopyMat = darkPBR("canopy", scene, 0.09, 0.18, 0.08);
  return _canopyMat;
}

function groundMat(scene: Scene) {
  if (!_groundMat) _groundMat = darkPBR("ground", scene, 0.15, 0.13, 0.09);
  return _groundMat;
}

function rockMat(scene: Scene) {
  if (!_rockMat) _rockMat = darkPBR("rock", scene, 0.18, 0.18, 0.18);
  return _rockMat;
}

export function createGround(scene: Scene, width: number, depth: number): Mesh {
  const ground = MeshBuilder.CreateGround("ground", { width, height: depth }, scene);
  ground.material = groundMat(scene);
  ground.checkCollisions = false;
  ground.receiveShadows = true;
  return ground;
}

export function createTree(
  scene: Scene,
  x: number,
  z: number,
  radius: number,
  height: number,
  parent: TransformNode
): TransformNode {
  const node = new TransformNode(`tree_${x}_${z}`, scene);
  node.parent = parent;

  const trunk = MeshBuilder.CreateCylinder(
    "trunk",
    { diameter: radius * 2, height, tessellation: 6 },
    scene
  );
  trunk.position.set(x, height / 2, z);
  trunk.material = barkMat(scene);
  trunk.checkCollisions = true;
  trunk.parent = node;

  const canopySize = radius * 3 + Math.random() * radius;
  const canopy = MeshBuilder.CreateSphere(
    "canopy",
    { diameter: canopySize * 2, segments: 4 },
    scene
  );
  canopy.position.set(x, height + canopySize * 0.5, z);
  canopy.material = canopyMat(scene);
  canopy.checkCollisions = false;
  canopy.parent = node;

  return node;
}

export function createRock(
  scene: Scene,
  x: number,
  z: number,
  size: number,
  parent: TransformNode
): Mesh {
  const rock = MeshBuilder.CreateSphere(
    "rock",
    { diameter: size, segments: 3 },
    scene
  );
  rock.position.set(x, size * 0.3, z);
  rock.scaling.y = 0.6;
  rock.material = rockMat(scene);
  rock.checkCollisions = true;
  rock.parent = parent;
  return rock;
}

export function createWall(
  scene: Scene,
  x: number,
  z: number,
  width: number,
  depth: number,
  parent: TransformNode
): Mesh {
  const wall = MeshBuilder.CreateBox(
    "wall",
    { width, height: 10, depth },
    scene
  );
  wall.position.set(x, 5, z);
  wall.isVisible = false;
  wall.checkCollisions = true;
  wall.parent = parent;
  return wall;
}

export function resetMaterialCache() {
  _barkMat = null;
  _canopyMat = null;
  _groundMat = null;
  _rockMat = null;
}
