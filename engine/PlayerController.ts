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
  CAMERA_PITCH_MIN,
  CAMERA_PITCH_MAX,
  MOUSE_SENSITIVITY,
  LOOKSPRING_STRENGTH,
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

  // Camera look state
  private _canvas: HTMLCanvasElement | null;
  private _pointerLocked = false;
  private _yaw = 0;
  private _pitch = CAMERA_Y_TILT;

  // Physics
  private _gravity = new Vector3(0, 0, 0);
  private _grounded = false;
  private _frozen = false;
  private _spectatorTarget: (() => Vector3) | null = null;

  get position(): Vector3 {
    return this._mesh.position;
  }

  get isPointerLocked(): boolean {
    return this._pointerLocked;
  }

  get yaw(): number {
    return this._yaw;
  }

  get pitch(): number {
    return this._pitch;
  }

  constructor(scene: Scene, startZ: number) {
    this._scene = scene;
    this._canvas = this._scene.getEngine().getRenderingCanvas();

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
    // camRoot (positioned at player, rotates on Y for yaw)
    //   -> yTilt (pitch)
    //     -> camera (offset behind the player along local -Z)
    this._camRoot = new TransformNode("camRoot", scene);
    this._camRoot.position = this._mesh.position.clone();

    this._yTilt = new TransformNode("yTilt", scene);
    this._yTilt.parent = this._camRoot;
    this._yTilt.rotation.x = this._pitch;

    this._camera = new UniversalCamera(
      "playerCam",
      new Vector3(0, 2, -CAMERA_DISTANCE),
      scene
    );
    this._camera.parent = this._yTilt;
    this._camera.fov = CAMERA_FOV;
    this._camera.minZ = 0.05;
    this._camera.maxZ = 1000;
    scene.activeCamera = this._camera;

    // Detach default camera controls so we own movement + look.
    this._camera.inputs.clear();

    this._setupInput();
    this._setupMouseLook();
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

  private _setupMouseLook(): void {
    if (!this._canvas) return;

    this._canvas.addEventListener("click", this._handleCanvasClick);
    document.addEventListener("pointerlockchange", this._handlePointerLockChange);
    window.addEventListener("mousemove", this._handleMouseMove, { passive: true });
  }

  private _handleCanvasClick = (): void => {
    if (this._frozen || !this._canvas) return;
    if (document.pointerLockElement === this._canvas) return;

    try {
      const maybePromise = this._canvas.requestPointerLock() as unknown;
      if (
        maybePromise &&
        typeof maybePromise === "object" &&
        "catch" in maybePromise &&
        typeof (maybePromise as { catch?: unknown }).catch === "function"
      ) {
        (maybePromise as { catch: (fn: (err: unknown) => void) => void }).catch(() => {
          // Pointer lock can fail under automation/headless; ignore and keep controls stable.
        });
      }
    } catch {
      // Pointer lock can throw synchronously if the document isn't in a valid state.
    }
  };

  private _handlePointerLockChange = (): void => {
    this._pointerLocked = !!this._canvas && document.pointerLockElement === this._canvas;
  };

  private _handleMouseMove = (evt: MouseEvent): void => {
    if (!this._pointerLocked || this._frozen) return;

    this._yaw += evt.movementX * MOUSE_SENSITIVITY;
    this._pitch = Scalar.Clamp(
      this._pitch - evt.movementY * MOUSE_SENSITIVITY,
      CAMERA_PITCH_MIN,
      CAMERA_PITCH_MAX
    );
    this._yTilt.rotation.x = this._pitch;
  };

  private _releasePointerLock(): void {
    if (!this._canvas) return;
    if (document.pointerLockElement === this._canvas) {
      document.exitPointerLock();
    }
    this._pointerLocked = false;
  }

  update(): void {
    if (this._frozen) {
      if (this._spectatorTarget) {
        const target = this._spectatorTarget();
        const desired = new Vector3(target.x, target.y + 2.5, target.z - CAMERA_DISTANCE * 0.75);
        this._camRoot.position = Vector3.Lerp(this._camRoot.position, desired, 0.08);
        const look = target.subtract(this._camRoot.position);
        this._yaw = Math.atan2(look.x, look.z);
        this._camRoot.rotation.y = this._yaw;
        this._pitch = CAMERA_Y_TILT;
        this._yTilt.rotation.x = this._pitch;
      }
      return;
    }

    const dt = this._scene.getEngine().getDeltaTime() / 1000;
    const dtScale = Math.max(0.35, Math.min(3.5, dt * 60));

    // WASD only (no arrow keys fallback)
    let targetH = 0;
    let targetV = 0;
    if (this._keys["w"]) targetV = 1;
    if (this._keys["s"]) targetV = -1;
    if (this._keys["a"]) targetH = -1;
    if (this._keys["d"]) targetH = 1;

    // Smooth movement input.
    this._inputH = Scalar.Lerp(this._inputH, targetH, 0.15);
    this._inputV = Scalar.Lerp(this._inputV, targetV, 0.15);

    const inputMagnitude = Math.min(
      1,
      Math.sqrt(this._inputH ** 2 + this._inputV ** 2)
    );

    let move = Vector3.Zero();
    if (inputMagnitude > 0.05) {
      const sinY = Math.sin(this._yaw);
      const cosY = Math.cos(this._yaw);

      // Forward/back and strafe relative to camera yaw.
      const moveX = sinY * this._inputV + cosY * this._inputH;
      const moveZ = cosY * this._inputV - sinY * this._inputH;
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);

      if (len > 0.01) {
        move.x = (moveX / len) * PLAYER_SPEED * inputMagnitude;
        move.z = (moveZ / len) * PLAYER_SPEED * inputMagnitude;
      }
    }

    // Subtle return-to-neutral pitch when mouse isn't actively locked.
    if (!this._pointerLocked) {
      const spring = Math.min(1, LOOKSPRING_STRENGTH * dtScale);
      this._pitch = Scalar.Lerp(this._pitch, CAMERA_Y_TILT, spring);
      this._pitch = Scalar.Clamp(this._pitch, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX);
      this._yTilt.rotation.x = this._pitch;
    }

    this._grounded = this._isGrounded();

    if (this._grounded) {
      this._gravity.y = 0;
    } else {
      this._gravity.y += GRAVITY * dt;
    }

    const finalMove = move.add(this._gravity);
    this._mesh.moveWithCollisions(finalMove);

    if (this._mesh.position.y < PLAYER_HEIGHT / 2) {
      this._mesh.position.y = PLAYER_HEIGHT / 2;
      this._gravity.y = 0;
    }

    this._camRoot.position = Vector3.Lerp(
      this._camRoot.position,
      this._mesh.position,
      0.4
    );
    this._camRoot.rotation.y = this._yaw;
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
    this._inputH = 0;
    this._inputV = 0;
    this._releasePointerLock();
  }

  unfreeze(): void {
    this._frozen = false;
    this._spectatorTarget = null;
  }

  spectate(targetGetter: () => Vector3): void {
    this._frozen = true;
    this._spectatorTarget = targetGetter;
    this._releasePointerLock();
  }

  dispose(): void {
    if (this._canvas) {
      this._canvas.removeEventListener("click", this._handleCanvasClick);
    }
    document.removeEventListener("pointerlockchange", this._handlePointerLockChange);
    window.removeEventListener("mousemove", this._handleMouseMove);
    this._releasePointerLock();
  }
}
