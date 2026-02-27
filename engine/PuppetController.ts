import {
  Color3,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import type { Vec3 } from "../game/types";

const LERP_RATE = 10; // per-second convergence factor

function shortestAngleDelta(from: number, to: number): number {
  let delta = ((to - from) % (2 * Math.PI)) + 2 * Math.PI;
  delta = (delta % (2 * Math.PI));
  if (delta > Math.PI) delta -= 2 * Math.PI;
  return delta;
}

export class PuppetController {
  private _root: Mesh;
  private _head: Mesh;
  private _nameTag: Mesh | null = null;
  private _targetPos: Vector3;
  private _currentPos: Vector3;
  private _targetYaw: number = 0;
  private _disposed = false;

  readonly id: string;

  get position(): Vector3 {
    return this._root.position;
  }

  get rootMesh(): Mesh {
    return this._root;
  }

  constructor(scene: Scene, id: string, name: string) {
    this.id = id;

    // Dark material matching game aesthetic
    const bodyMat = new PBRMaterial(`puppet_${id}_body`, scene);
    bodyMat.albedoColor = new Color3(0.15, 0.12, 0.1);
    bodyMat.roughness = 0.95;
    bodyMat.metallic = 0;

    // Body cylinder (player-sized)
    this._root = MeshBuilder.CreateCylinder(
      `puppet_${id}`,
      { diameterTop: 0.6, diameterBottom: 0.8, height: 1.8, tessellation: 8 },
      scene
    );
    this._root.material = bodyMat;
    this._root.checkCollisions = false; // puppets don't collide

    // Head
    this._head = MeshBuilder.CreateIcoSphere(
      `puppet_${id}_head`,
      { radius: 0.3, subdivisions: 1, flat: true },
      scene
    );
    this._head.parent = this._root;
    this._head.position = new Vector3(0, 1.2, 0);
    this._head.material = bodyMat;

    // Small eye glow to distinguish from environment
    const eyeMat = new StandardMaterial(`puppet_${id}_eye`, scene);
    eyeMat.diffuseColor = new Color3(0.2, 0.3, 0.2);
    eyeMat.emissiveColor = new Color3(0.15, 0.25, 0.15);

    const leftEye = MeshBuilder.CreateSphere(
      `puppet_${id}_eyeL`,
      { diameter: 0.1 },
      scene
    );
    leftEye.parent = this._head;
    leftEye.position = new Vector3(-0.12, 0, 0.25);
    leftEye.material = eyeMat;

    const rightEye = MeshBuilder.CreateSphere(
      `puppet_${id}_eyeR`,
      { diameter: 0.1 },
      scene
    );
    rightEye.parent = this._head;
    rightEye.position = new Vector3(0.12, 0, 0.25);
    rightEye.material = eyeMat;

    // Initialize positions
    this._currentPos = new Vector3(0, 1.8, 0);
    this._targetPos = this._currentPos.clone();
    this._root.position.copyFrom(this._currentPos);
  }

  applySnapshot(pos: Vec3, yaw: number): void {
    this._targetPos.set(pos.x, pos.y, pos.z);
    this._targetYaw = yaw;
  }

  update(dtSeconds: number): void {
    if (this._disposed) return;

    // Smooth interpolation toward target
    const alpha = Math.min(1, dtSeconds * LERP_RATE);
    this._currentPos = Vector3.Lerp(this._currentPos, this._targetPos, alpha);
    this._root.position.copyFrom(this._currentPos);

    // Yaw interpolation with shortest-path wrap
    const yawDelta = shortestAngleDelta(this._root.rotation.y, this._targetYaw);
    this._root.rotation.y += yawDelta * alpha;
  }

  setVisible(visible: boolean): void {
    this._root.setEnabled(visible);
  }

  dispose(): void {
    this._disposed = true;
    this._root.dispose(false, true);
  }
}
