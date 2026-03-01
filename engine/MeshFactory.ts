import {
  Scene,
  MeshBuilder,
  Mesh,
  PBRMaterial,
  Color3,
  TransformNode,
} from "@babylonjs/core";
import {
  createBarkTexture,
  createCanopyTexture,
  createGroundTexture,
  createRockTexture,
} from "./ProceduralTextures";

function spritePBR(name: string, scene: Scene): PBRMaterial {
  const mat = new PBRMaterial(name, scene);
  mat.albedoColor = Color3.White();
  mat.roughness = 1.0;
  mat.metallic = 0;
  mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
  mat.alphaCutOff = 0.1;
  mat.useAlphaFromAlbedoTexture = true;
  mat.backFaceCulling = false;
  return mat;
}

let _barkMat: PBRMaterial | null = null;
let _canopyMat: PBRMaterial | null = null;
let _groundMat: PBRMaterial | null = null;
let _rockMat: PBRMaterial | null = null;

function barkMat(scene: Scene) {
  if (!_barkMat || _barkMat.getScene() !== scene) {
    _barkMat = spritePBR("bark", scene);
    _barkMat.albedoTexture = createBarkTexture(scene);
  }
  return _barkMat;
}

function canopyMat(scene: Scene) {
  if (!_canopyMat || _canopyMat.getScene() !== scene) {
    _canopyMat = spritePBR("canopy", scene);
    _canopyMat.albedoTexture = createCanopyTexture(scene);
  }
  return _canopyMat;
}

function groundMat(scene: Scene) {
  if (!_groundMat || _groundMat.getScene() !== scene) {
    _groundMat = new PBRMaterial("ground", scene);
    _groundMat.albedoColor = Color3.White();
    _groundMat.roughness = 0.95;
    _groundMat.metallic = 0;
    _groundMat.albedoTexture = createGroundTexture(scene);
  }
  return _groundMat;
}

function rockMat(scene: Scene) {
  if (!_rockMat || _rockMat.getScene() !== scene) {
    _rockMat = spritePBR("rock", scene);
    _rockMat.albedoTexture = createRockTexture(scene);
  }
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

  // Use planes with billboard mode for retro look
  const trunk = MeshBuilder.CreatePlane(
    "trunk",
    { width: radius * 3, height },
    scene
  );
  trunk.position.set(x, height / 2, z);
  trunk.material = barkMat(scene);
  trunk.billboardMode = Mesh.BILLBOARDMODE_Y;
  trunk.checkCollisions = true;
  trunk.parent = node;

  const canopySize = radius * 4 + Math.random() * radius;
  const canopy = MeshBuilder.CreatePlane(
    "canopy",
    { width: canopySize * 1.5, height: canopySize },
    scene
  );
  canopy.position.set(x, height + canopySize * 0.3, z);
  canopy.material = canopyMat(scene);
  canopy.billboardMode = Mesh.BILLBOARDMODE_Y;
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
  const rock = MeshBuilder.CreatePlane(
    "rock",
    { width: size * 1.5, height: size * 1.2 },
    scene
  );
  rock.position.set(x, size * 0.5, z);
  rock.material = rockMat(scene);
  rock.billboardMode = Mesh.BILLBOARDMODE_Y;
  rock.checkCollisions = true;
  rock.parent = parent;
  return rock;
}

export function createFallenLog(
  scene: Scene,
  x: number,
  z: number,
  length: number,
  rotation: number,
  parent: TransformNode
): Mesh {
  const logSize = 0.8 + Math.random() * 0.4;
  const log = MeshBuilder.CreatePlane(
    "fallenLog",
    { width: length, height: logSize },
    scene
  );
  log.position.set(x, logSize / 2, z);
  
  // For logs, billboarding might look weird since they lie on ground.
  // Instead, just make them stand up as flat planes, or rotate them to face camera slightly.
  // For true retro 2.5D, they are billboarded or flat on ground. Let's billboard Y.
  log.billboardMode = Mesh.BILLBOARDMODE_Y;
  
  log.material = barkMat(scene);
  log.checkCollisions = true;
  log.parent = parent;
  return log;
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
