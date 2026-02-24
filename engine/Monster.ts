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

function planarDistance(a: Vector3, b: Vector3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

export class Monster {
  private _body: Mesh;
  private _state: MonsterState = "patrol";
  private _frozen = false;
  private _patrolIndex = 0;
  private _patrolPoints: Vector3[];

  get position(): Vector3 {
    return this._body.position;
  }

  get state(): MonsterState {
    return this._state;
  }

  constructor(private _scene: Scene, start: Vector3) {
    this._body = MeshBuilder.CreateCylinder(
      "monsterBody",
      { height: 3.2, diameter: 1.4, tessellation: 8 },
      _scene
    );
    this._body.position = new Vector3(start.x, 1.6, start.z);
    this._body.checkCollisions = true;
    this._body.ellipsoid = new Vector3(0.7, 1.6, 0.7);

    const bodyMat = new PBRMaterial("monsterBodyMat", _scene);
    bodyMat.albedoColor = new Color3(0.03, 0.03, 0.04);
    bodyMat.roughness = 1;
    bodyMat.metallic = 0;
    this._body.material = bodyMat;

    const eyeMat = new StandardMaterial("monsterEyeMat", _scene);
    eyeMat.diffuseColor = new Color3(0.4, 0.02, 0.02);
    eyeMat.emissiveColor = new Color3(1, 0.1, 0.1);

    const leftEye = MeshBuilder.CreateSphere("monsterEyeL", { diameter: 0.22 }, _scene);
    leftEye.parent = this._body;
    leftEye.position = new Vector3(-0.24, 0.68, 0.62);
    leftEye.material = eyeMat;

    const rightEye = MeshBuilder.CreateSphere("monsterEyeR", { diameter: 0.22 }, _scene);
    rightEye.parent = this._body;
    rightEye.position = new Vector3(0.24, 0.68, 0.62);
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
