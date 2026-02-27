import { Engine, Scene, Vector3 } from "@babylonjs/core";
import {
  CATCH_SHAKE_DURATION_MS,
  CATCH_SHAKE_INTENSITY,
  FINISH_Z,
  START_Z,
} from "../game/constants";
import {
  GamePhase,
  GameResult,
  type ArgumentSession,
  type HudSnapshot,
  type NetworkPlayerState,
  type RoomSnapshot,
} from "../game/types";
import { buildForest } from "./ForestMap";
import {
  setupLighting,
  updateLights,
  registerShadowCaster,
  type LightingRig,
} from "./Lighting";
import { resetMaterialCache } from "./MeshFactory";
import { Monster } from "./Monster";
import { AudioSystem } from "./Audio";
import { PlayerController } from "./PlayerController";
import { PuppetController } from "./PuppetController";
import { setupPostProcessing } from "./PostProcessing";

const INPUT_SEND_INTERVAL_MS = 50; // 20 Hz

export class MultiplayerGame {
  private _engine: Engine;
  private _scene!: Scene;
  private _player!: PlayerController;
  private _monster!: Monster;
  private _phase: GamePhase = GamePhase.LOADING;
  private _disposed = false;
  private _lightingRig: LightingRig | null = null;
  private _audio: AudioSystem | null = null;
  private _puppets: Map<string, PuppetController> = new Map();
  private _selfId: string | null = null;
  private _latestSnapshot: RoomSnapshot | null = null;
  private _inputSendInterval: ReturnType<typeof setInterval> | null = null;

  // Callbacks for React integration
  onDebug: ((info: string) => void) | null = null;
  onArgumentStart: ((session: ArgumentSession) => void) | null = null;
  onArgumentUpdate: ((session: ArgumentSession) => void) | null = null;
  onPhaseChange: ((phase: GamePhase) => void) | null = null;
  onHudUpdate: ((hud: HudSnapshot) => void) | null = null;
  onGameOver: ((result: GameResult) => void) | null = null;
  onInputSample:
    | ((input: {
        moveH: number;
        moveV: number;
        yaw: number;
        pitch: number;
        dtMs: number;
      }) => void)
    | null = null;

  constructor(private _canvas: HTMLCanvasElement) {
    this._engine = new Engine(_canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
      audioEngine: true,
    });
  }

  get selfId(): string | null {
    return this._selfId;
  }

  set selfId(id: string | null) {
    this._selfId = id;
  }

  async start(): Promise<void> {
    if (this._disposed) return;

    this._scene = new Scene(this._engine);
    this._scene.collisionsEnabled = true;

    // Set up world (same as single-player)
    this._lightingRig = setupLighting(this._scene);
    buildForest(this._scene);

    // Player + monster (monster is visual only — driven by server)
    this._player = new PlayerController(this._scene, START_Z);
    this._monster = new Monster(this._scene, new Vector3(0, 1.6, START_Z + 55));

    registerShadowCaster(this._lightingRig, this._monster.bodyMesh);
    setupPostProcessing(this._scene, this._player.camera);

    this._audio = new AudioSystem(this._scene);

    this._setPhase(GamePhase.PLAYING);

    // Start input sampling loop (20 Hz)
    this._inputSendInterval = setInterval(() => {
      this._sampleAndSendInput();
    }, INPUT_SEND_INTERVAL_MS);

    // Render loop
    this._engine.runRenderLoop(() => {
      if (this._disposed) return;

      const dtSeconds = this._engine.getDeltaTime() / 1000;

      // Always update local player controller for camera/input feel
      this._player.update();

      // Update puppet interpolation
      for (const puppet of this._puppets.values()) {
        puppet.update(dtSeconds);
      }

      // Audio updates based on monster distance from snapshot
      if (this._audio && this._latestSnapshot) {
        const mPos = this._latestSnapshot.monster.position;
        const pPos = this._player.position;
        const dx = mPos.x - pPos.x;
        const dz = mPos.z - pPos.z;
        const monsterDist = Math.sqrt(dx * dx + dz * dz);
        this._audio.updateHeartbeat(monsterDist, dtSeconds);
        this._audio.updateFootsteps(this._player.isMoving, dtSeconds);
      }

      if (this._lightingRig) updateLights(this._lightingRig, performance.now());
      this._emitDebug();
      this._emitHud();
      this._scene.render();
    });
  }

  applySnapshot(snapshot: RoomSnapshot): void {
    this._latestSnapshot = snapshot;

    // Map room phase to game phase
    const prevPhase = this._phase;
    switch (snapshot.phase) {
      case "lobby":
        this._setPhase(GamePhase.LOADING);
        break;
      case "playing":
        this._setPhase(GamePhase.PLAYING);
        break;
      case "argument":
        this._setPhase(GamePhase.ARGUMENT);
        break;
      case "game_over":
        this._setPhase(GamePhase.GAME_OVER);
        break;
    }

    // Update monster visual from server snapshot
    const mSnap = snapshot.monster;
    this._monster.bodyMesh.position.x = mSnap.position.x;
    this._monster.bodyMesh.position.z = mSnap.position.z;
    this._monster.bodyMesh.rotation.y = mSnap.yaw;

    // Update local player position from authoritative server
    if (this._selfId) {
      const selfSnap = snapshot.players.find((p) => p.id === this._selfId);
      if (selfSnap) {
        // Handle life state transitions
        if (selfSnap.lifeState === "caught" && prevPhase !== GamePhase.ARGUMENT) {
          this._player.shake(CATCH_SHAKE_INTENSITY, CATCH_SHAKE_DURATION_MS);
          this._audio?.playCatchSting();
          this._player.freeze();
          this._monster.freeze();
        } else if (selfSnap.lifeState === "alive" && prevPhase === GamePhase.ARGUMENT) {
          // Freed from argument
          this._player.unfreeze();
          this._monster.unfreeze();
        } else if (selfSnap.lifeState === "eaten") {
          this._player.spectate(() => this._monster.position);
          this._monster.unfreeze();
        } else if (selfSnap.lifeState === "escaped") {
          this._player.freeze();
          this._monster.freeze();
        }
      }
    }

    // Update argument session for React
    if (snapshot.argument.active && snapshot.argument.session) {
      if (prevPhase !== GamePhase.ARGUMENT) {
        this.onArgumentStart?.(snapshot.argument.session);
      }
      this.onArgumentUpdate?.(snapshot.argument.session);
    }

    // Handle game over
    if (snapshot.phase === "game_over" && snapshot.result) {
      const result =
        snapshot.result === "win" ? GameResult.WIN : GameResult.EATEN;
      this.onGameOver?.(result);
    }

    // Sync remote player puppets
    this._syncPuppets(snapshot.players);
  }

  private _syncPuppets(players: NetworkPlayerState[]): void {
    const remotePlayers = players.filter((p) => p.id !== this._selfId);

    // Remove puppets for disconnected/gone players
    for (const [id, puppet] of this._puppets) {
      if (!remotePlayers.find((p) => p.id === id)) {
        puppet.dispose();
        this._puppets.delete(id);
      }
    }

    // Add/update puppets for remote players
    for (const p of remotePlayers) {
      let puppet = this._puppets.get(p.id);
      if (!puppet) {
        puppet = new PuppetController(this._scene, p.id, p.name);
        this._puppets.set(p.id, puppet);
      }

      puppet.applySnapshot(p.position, p.yaw);

      // Hide eaten players' puppets
      puppet.setVisible(p.lifeState !== "eaten");
    }
  }

  private _sampleAndSendInput(): void {
    if (!this.onInputSample || this._phase !== GamePhase.PLAYING) return;

    this.onInputSample({
      moveH: this._player.inputH,
      moveV: this._player.inputV,
      yaw: this._player.yaw,
      pitch: this._player.pitch,
      dtMs: INPUT_SEND_INTERVAL_MS,
    });
  }

  private _emitHud(): void {
    if (!this.onHudUpdate || !this._latestSnapshot) return;
    this.onHudUpdate({
      phase: this._phase,
      distanceToGoal: Math.max(0, FINISH_Z - this._player.position.z),
      monsterState: this._latestSnapshot.monster.state,
    });
  }

  private _emitDebug(): void {
    if (!this.onDebug || !this._player) return;

    const fps = this._engine.getFps().toFixed(0);
    const pos = this._player.position;
    const progress = (
      ((pos.z - START_Z) / (FINISH_Z - START_Z)) *
      100
    ).toFixed(0);
    const puppetCount = this._puppets.size;

    this.onDebug(
      `FPS: ${fps}\n` +
        `Phase: ${this._phase}\n` +
        `X: ${pos.x.toFixed(1)}\n` +
        `Z: ${pos.z.toFixed(1)}\n` +
        `Look: ${this._player.isPointerLocked ? "locked" : "free"}\n` +
        `Yaw: ${this._player.yaw.toFixed(2)}\n` +
        `Pitch: ${this._player.pitch.toFixed(2)}\n` +
        `Progress: ${progress}%\n` +
        `Remote Players: ${puppetCount}\n` +
        `Self: ${this._selfId ?? "?"}`
    );
  }

  private _setPhase(phase: GamePhase): void {
    if (this._phase === phase) return;
    this._phase = phase;
    if (phase === GamePhase.PLAYING) {
      this._audio?.resume();
    }
    this.onPhaseChange?.(phase);
  }

  resize(): void {
    this._engine.resize();
  }

  dispose(): void {
    this._disposed = true;

    if (this._inputSendInterval) {
      clearInterval(this._inputSendInterval);
      this._inputSendInterval = null;
    }

    this._engine.stopRenderLoop();
    this._audio?.dispose();
    this._audio = null;

    for (const puppet of this._puppets.values()) {
      puppet.dispose();
    }
    this._puppets.clear();

    this._player?.dispose();
    this._monster?.dispose();
    this._scene?.dispose();
    resetMaterialCache();
    this._engine.dispose();
  }
}
