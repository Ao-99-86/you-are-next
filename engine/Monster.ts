import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
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
  private _sprite: Mesh;
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
    // Monster body collision proxy (invisible cylinder)
    this._body = MeshBuilder.CreateCylinder(
      "monsterBody",
      { diameter: 1.2, height: 3.2, tessellation: 8 },
      _scene
    );
    this._body.position = new Vector3(start.x, 1.6, start.z);
    this._body.checkCollisions = true;
    this._body.ellipsoid = new Vector3(0.7, 1.6, 0.7);
    this._body.isVisible = false; // Collision only

    // Billboard sprite for visuals
    const spriteMat = new PBRMaterial("monsterSpriteMat", _scene);
    spriteMat.albedoColor = Color3.White();
    spriteMat.albedoTexture = createMonsterTexture(_scene);
    spriteMat.roughness = 1;
    spriteMat.metallic = 0;
    spriteMat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
    spriteMat.alphaCutOff = 0.1;
    spriteMat.useAlphaFromAlbedoTexture = true;
    spriteMat.backFaceCulling = false;

    this._sprite = MeshBuilder.CreatePlane("monsterSprite", { width: 3, height: 4 }, _scene);
    this._sprite.parent = this._body;
    this._sprite.position = new Vector3(0, 0.4, 0); // Offset up slightly
    this._sprite.material = spriteMat;
    this._sprite.billboardMode = Mesh.BILLBOARDMODE_Y;

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

    // Sprite bobbing animation
    const t = performance.now() / 1000;
    const isMoving = len > 0.001;
    if (isMoving) {
      this._sprite.position.y = 0.4 + Math.abs(Math.sin(t * 8)) * 0.15;
    } else {
      this._sprite.position.y = 0.4 + Math.sin(t * 2) * 0.05;
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
