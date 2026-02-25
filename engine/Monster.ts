import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { MONSTER_DETECT_RANGE, MONSTER_SPEED } from "../game/constants";
import type { MonsterState } from "../game/types";
import { createMonsterTexture } from "./ProceduralTextures";

function planarDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export class Monster {
  private _body: Mesh;
  private _head: Mesh;
  private _armL: Mesh;
  private _armR: Mesh;
  private _state: MonsterState = "patrol";
  private _frozen = false;
  private _patrolIndex = 0;
  private _patrolPoints: Vector3[];

  get position(): Vector3 {
    return this._body.position;
  }

  get bodyMesh(): Mesh {
    return this._body;
  }

  get state(): MonsterState {
    return this._state;
  }

  constructor(private _scene: Scene, start: Vector3) {
    // Monster body material with procedural texture
    const bodyMat = new PBRMaterial("monsterBodyMat", _scene);
    bodyMat.albedoColor = Color3.White();
    bodyMat.albedoTexture = createMonsterTexture(_scene);
    bodyMat.roughness = 1;
    bodyMat.metallic = 0;

    // Tapered body cylinder
    this._body = MeshBuilder.CreateCylinder(
      "monsterBody",
      { diameterTop: 1.0, diameterBottom: 1.4, height: 3.2, tessellation: 8 },
      _scene
    );
    this._body.position = new Vector3(start.x, 1.6, start.z);
    this._body.checkCollisions = true;
    this._body.ellipsoid = new Vector3(0.7, 1.6, 0.7);
    this._body.material = bodyMat;

    // Low-poly IcoSphere head
    this._head = MeshBuilder.CreateIcoSphere(
      "monsterHead",
      { radius: 0.5, subdivisions: 1, flat: true },
      _scene
    );
    this._head.parent = this._body;
    this._head.position = new Vector3(0, 1.9, 0);
    this._head.scaling.y = 0.8;
    this._head.material = bodyMat;

    // Tendril arms
    this._armL = MeshBuilder.CreateBox(
      "monsterArmL",
      { width: 0.15, height: 2.0, depth: 0.15 },
      _scene
    );
    this._armL.parent = this._body;
    this._armL.position = new Vector3(-0.65, 0.3, 0);
    this._armL.rotation.z = 0.15;
    this._armL.material = bodyMat;

    this._armR = MeshBuilder.CreateBox(
      "monsterArmR",
      { width: 0.15, height: 2.0, depth: 0.15 },
      _scene
    );
    this._armR.parent = this._body;
    this._armR.position = new Vector3(0.65, 0.3, 0);
    this._armR.rotation.z = -0.15;
    this._armR.material = bodyMat;

    // Glowing red eyes on head
    const eyeMat = new StandardMaterial("monsterEyeMat", _scene);
    eyeMat.diffuseColor = new Color3(0.4, 0.02, 0.02);
    eyeMat.emissiveColor = new Color3(1, 0.1, 0.1);

    const leftEye = MeshBuilder.CreateSphere("monsterEyeL", { diameter: 0.28 }, _scene);
    leftEye.parent = this._head;
    leftEye.position = new Vector3(-0.2, -0.05, 0.4);
    leftEye.material = eyeMat;

    const rightEye = MeshBuilder.CreateSphere("monsterEyeR", { diameter: 0.28 }, _scene);
    rightEye.parent = this._head;
    rightEye.position = new Vector3(0.2, -0.05, 0.4);
    rightEye.material = eyeMat;

    this._patrolPoints = [
      new Vector3(start.x - 8, this._body.position.y, start.z - 10),
      new Vector3(start.x + 8, this._body.position.y, start.z - 2),
      new Vector3(start.x + 10, this._body.position.y, start.z + 8),
      new Vector3(start.x - 10, this._body.position.y, start.z + 14),
    ];
  }

  update(playerPos: Vector3, dtSeconds: number, canChase: boolean): void {
    if (this._frozen) return;

    const dist = this.distanceToPlayer(playerPos);
    if (canChase && dist <= MONSTER_DETECT_RANGE) {
      this._state = "chase";
    } else if (!canChase || dist > MONSTER_DETECT_RANGE * 1.4) {
      this._state = "patrol";
    }

    const dtScale = Math.max(0.25, Math.min(2.5, dtSeconds * 60));
    const target = this._state === "chase"
      ? new Vector3(playerPos.x, this._body.position.y, playerPos.z)
      : this._patrolPoints[this._patrolIndex];

    if (this._state === "patrol" && planarDistance(this._body.position, target) <= 1.2) {
      this._patrolIndex = (this._patrolIndex + 1) % this._patrolPoints.length;
    }

    const toTarget = target.subtract(this._body.position);
    toTarget.y = 0;
    const len = toTarget.length();
    if (len > 0.001) {
      const dir = toTarget.scale(1 / len);
      const move = dir.scale(MONSTER_SPEED * dtScale);
      this._body.moveWithCollisions(move);
      this._body.position.y = 1.6;
      this._body.rotation.y = Math.atan2(move.x, move.z);
    }

    // Subtle idle animation
    const t = performance.now() / 1000;
    this._head.position.y = 1.9 + Math.sin(t * 2) * 0.03;
    this._armL.rotation.z = 0.15 + Math.sin(t * 1.5) * 0.05;
    this._armR.rotation.z = -0.15 + Math.sin(t * 1.5 + 1) * 0.05;
  }

  distanceToPlayer(playerPos: Vector3): number {
    return planarDistance(this._body.position, playerPos);
  }

  freeze(): void {
    this._frozen = true;
  }

  unfreeze(): void {
    this._frozen = false;
  }

  dispose(): void {
    this._body.dispose(false, true);
  }
}
