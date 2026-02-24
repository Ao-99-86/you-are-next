import {
  Scene,
  UniversalCamera,
  TransformNode,
  Vector3,
  MeshBuilder,
  ActionManager,
  ExecuteCodeAction,
  Scalar,
  Ray,
} from "@babylonjs/core";
import {
  PLAYER_SPEED,
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  CAMERA_DISTANCE,
  CAMERA_FOV,
  CAMERA_Y_TILT,
  GRAVITY,
} from "../game/constants";

export class PlayerController {
  private _scene: Scene;
  private _mesh: ReturnType<typeof MeshBuilder.CreateCapsule>;
  private _camRoot: TransformNode;
  private _yTilt: TransformNode;
  private _camera: UniversalCamera;

  // Input state
  private _keys: Record<string, boolean> = {};
  private _inputH = 0;
  private _inputV = 0;

  // Current facing angle (Y-axis rotation)
  private _facingAngle = 0;

  // Physics
  private _gravity = new Vector3(0, 0, 0);
  private _grounded = false;
  private _frozen = false;
  private _spectatorTarget: (() => Vector3) | null = null;

  get position(): Vector3 {
    return this._mesh.position;
  }

  constructor(scene: Scene, startZ: number) {
    this._scene = scene;

    // Player mesh (invisible capsule for collisions)
    this._mesh = MeshBuilder.CreateCapsule(
      "player",
      { radius: PLAYER_RADIUS, height: PLAYER_HEIGHT, tessellation: 8 },
      scene
    );
    this._mesh.position = new Vector3(0, PLAYER_HEIGHT / 2, startZ);
    this._mesh.isVisible = false;
    this._mesh.checkCollisions = true;
    this._mesh.ellipsoid = new Vector3(PLAYER_RADIUS, PLAYER_HEIGHT / 2, PLAYER_RADIUS);

    // Camera hierarchy:
    // camRoot (positioned at player, rotates on Y to face direction)
    //   -> yTilt (tilts down to look over shoulder)
    //     -> camera (offset behind the player along local -Z)
    this._camRoot = new TransformNode("camRoot", scene);
    this._camRoot.position = this._mesh.position.clone();

    this._yTilt = new TransformNode("yTilt", scene);
    this._yTilt.parent = this._camRoot;
    this._yTilt.rotation.x = CAMERA_Y_TILT;

    this._camera = new UniversalCamera(
      "playerCam",
      new Vector3(0, 2, -CAMERA_DISTANCE),
      scene
    );
    this._camera.parent = this._yTilt;
    this._camera.fov = CAMERA_FOV;
    this._camera.minZ = 0.05;
    this._camera.maxZ = 1000;
    // No lockedTarget -- the parent hierarchy handles orientation.
    // Camera naturally looks down its local +Z, which points toward camRoot
    // (since it's offset at -Z behind it).
    scene.activeCamera = this._camera;

    // Detach default camera controls so WASD doesn't move camera independently
    this._camera.inputs.clear();

    // Input
    this._setupInput();
  }

  private _setupInput(): void {
    const am = new ActionManager(this._scene);
    this._scene.actionManager = am;

    am.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
        this._keys[evt.sourceEvent.key.toLowerCase()] = true;
      })
    );
    am.registerAction(
      new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
        this._keys[evt.sourceEvent.key.toLowerCase()] = false;
      })
    );
  }

  update(): void {
    if (this._frozen) {
      if (this._spectatorTarget) {
        const target = this._spectatorTarget();
        const desired = new Vector3(target.x, target.y + 2.5, target.z - CAMERA_DISTANCE * 0.75);
        this._camRoot.position = Vector3.Lerp(this._camRoot.position, desired, 0.08);
        const look = target.subtract(this._camRoot.position);
        this._facingAngle = Math.atan2(look.x, look.z);
        this._camRoot.rotation.y = this._facingAngle;
      }
      return;
    }

    const dt = this._scene.getEngine().getDeltaTime() / 1000;

    // Read WASD / arrow keys
    let targetH = 0;
    let targetV = 0;
    if (this._keys["w"] || this._keys["arrowup"]) targetV = 1;
    if (this._keys["s"] || this._keys["arrowdown"]) targetV = -1;
    if (this._keys["a"] || this._keys["arrowleft"]) targetH = -1;
    if (this._keys["d"] || this._keys["arrowright"]) targetH = 1;

    // Smooth input
    this._inputH = Scalar.Lerp(this._inputH, targetH, 0.15);
    this._inputV = Scalar.Lerp(this._inputV, targetV, 0.15);

    const inputMagnitude = Math.min(
      1,
      Math.sqrt(this._inputH ** 2 + this._inputV ** 2)
    );

    // Compute movement in world space:
    // "forward" = +Z (toward the finish), "right" = +X
    // We move relative to the camera's facing direction
    let move = Vector3.Zero();
    if (inputMagnitude > 0.05) {
      const sinA = Math.sin(this._facingAngle);
      const cosA = Math.cos(this._facingAngle);
      // Forward/back relative to facing
      const fwdX = sinA * this._inputV;
      const fwdZ = cosA * this._inputV;
      // Strafe relative to facing
      const rightX = cosA * this._inputH;
      const rightZ = -sinA * this._inputH;

      const moveX = fwdX + rightX;
      const moveZ = fwdZ + rightZ;
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);

      if (len > 0.01) {
        move.x = (moveX / len) * PLAYER_SPEED * inputMagnitude;
        move.z = (moveZ / len) * PLAYER_SPEED * inputMagnitude;

        // Rotate to face movement direction
        const targetAngle = Math.atan2(moveX, moveZ);
        let diff = targetAngle - this._facingAngle;
        // Normalize to [-PI, PI]
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this._facingAngle += diff * 0.1;
      }
    }

    // Ground detection
    this._grounded = this._isGrounded();

    // Gravity
    if (this._grounded) {
      this._gravity.y = 0;
    } else {
      this._gravity.y += GRAVITY * dt;
    }

    // Apply movement + gravity
    const finalMove = move.add(this._gravity);
    this._mesh.moveWithCollisions(finalMove);

    // Keep player above ground
    if (this._mesh.position.y < PLAYER_HEIGHT / 2) {
      this._mesh.position.y = PLAYER_HEIGHT / 2;
      this._gravity.y = 0;
    }

    // Update camera root: follow player position, rotate to face direction
    this._camRoot.position = Vector3.Lerp(
      this._camRoot.position,
      this._mesh.position,
      0.4
    );
    this._camRoot.rotation.y = this._facingAngle;
  }

  private _isGrounded(): boolean {
    const origin = this._mesh.position.clone();
    origin.y += 0.5;
    const ray = new Ray(origin, Vector3.Down(), PLAYER_HEIGHT / 2 + 0.6);
    const pick = this._scene.pickWithRay(ray, (m) => m.name === "ground");
    return pick?.hit === true;
  }

  freeze(): void {
    this._frozen = true;
    this._spectatorTarget = null;
  }

  unfreeze(): void {
    this._frozen = false;
    this._spectatorTarget = null;
  }

  spectate(targetGetter: () => Vector3): void {
    this._frozen = true;
    this._spectatorTarget = targetGetter;
  }
}
