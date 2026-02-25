import { Engine, Scene, Vector3 } from "@babylonjs/core";
import {
  CATCH_RADIUS,
  CATCH_SHAKE_DURATION_MS,
  CATCH_SHAKE_INTENSITY,
  FINISH_Z,
  RECATCH_GRACE_MS,
  START_Z,
} from "../game/constants";
import { createInitialGameLogicState, gameUpdater } from "../game/logic";
import {
  GamePhase,
  GameResult,
  type ArgumentSession,
  type HudSnapshot,
} from "../game/types";
import { buildForest } from "./ForestMap";
import { setupLighting, updateLights, registerShadowCaster, type LightingRig } from "./Lighting";
import { resetMaterialCache } from "./MeshFactory";
import { Monster } from "./Monster";
import { AudioSystem } from "./Audio";
import { PlayerController } from "./PlayerController";
import { setupPostProcessing } from "./PostProcessing";

type SpectorLike = {
  displayUI: () => void;
  captureCanvas: (canvas: HTMLCanvasElement) => void;
  spyCanvases: () => void;
};

type SpectorModule = {
  Spector?: new () => SpectorLike;
  default?: { Spector?: new () => SpectorLike };
};

export class Game {
  private _engine: Engine;
  private _scene!: Scene;
  private _player!: PlayerController;
  private _monster!: Monster;
  private _phase: GamePhase = GamePhase.LOADING;
  private _result: GameResult | null = null;
  private _started = false;
  private _disposed = false;
  private _devDebugCleanup: (() => void) | null = null;
  private _logicState = createInitialGameLogicState();
  private _recatchGraceUntilMs = 0;
  private _lightingRig: LightingRig | null = null;
  private _audio: AudioSystem | null = null;

  // Callbacks for React integration
  onDebug: ((info: string) => void) | null = null;
  onPlayerCaught: ((session: ArgumentSession) => void) | null = null;
  onArgumentStart: ((session: ArgumentSession) => void) | null = null;
  onArgumentUpdate: ((session: ArgumentSession) => void) | null = null;
  onPhaseChange: ((phase: GamePhase) => void) | null = null;
  onHudUpdate: ((hud: HudSnapshot) => void) | null = null;
  onGameOver: ((result: GameResult) => void) | null = null;

  constructor(private _canvas: HTMLCanvasElement) {
    this._engine = new Engine(_canvas, true, {
      preserveDrawingBuffer: false,
      stencil: true,
    });
  }

  async start(): Promise<void> {
    if (this._started || this._disposed) return;
    this._started = true;

    this._scene = new Scene(this._engine);
    this._scene.collisionsEnabled = true;

    // Set up world
    this._lightingRig = setupLighting(this._scene);
    buildForest(this._scene);

    // Player + monster
    this._player = new PlayerController(this._scene, START_Z);
    this._monster = new Monster(this._scene, new Vector3(0, 1.6, START_Z + 55));

    // Register monster as shadow caster
    registerShadowCaster(this._lightingRig, this._monster.bodyMesh);

    // Post-processing pipeline
    setupPostProcessing(this._scene, this._player.camera);

    // Audio system
    this._audio = new AudioSystem();

    this._setPhase(GamePhase.PLAYING);
    await this._setupDevDebugTools();
    if (this._disposed) return;

    // Render loop
    this._engine.runRenderLoop(() => {
      if (this._disposed) return;

      const dtSeconds = this._engine.getDeltaTime() / 1000;
      switch (this._phase) {
        case GamePhase.PLAYING:
          this._updatePlaying(dtSeconds);
          break;
        case GamePhase.ARGUMENT:
          this._updateArgument();
          break;
        case GamePhase.GAME_OVER:
          this._updateGameOver(dtSeconds);
          break;
        case GamePhase.LOADING:
        default:
          break;
      }

      if (this._lightingRig) updateLights(this._lightingRig, performance.now());
      this._emitDebug();
      this._emitHud();
      this._scene.render();
    });
  }

  private _updatePlaying(dtSeconds: number): void {
    this._player.update();
    this._monster.update(this._player.position, dtSeconds, true);

    // Audio updates
    if (this._audio) {
      const monsterDist = this._monster.distanceToPlayer(this._player.position);
      this._audio.updateHeartbeat(monsterDist, dtSeconds);
      this._audio.updateFootsteps(this._player.isMoving, dtSeconds);
    }

    // Check finish zone first.
    const pz = this._player.position.z;
    if (pz >= FINISH_Z) {
      this._result = GameResult.WIN;
      this._setPhase(GamePhase.GAME_OVER);
      this._player.freeze();
      this._monster.freeze();
      this._logicState = gameUpdater(this._logicState, { type: "RESET_ARGUMENT", nowMs: Date.now() });
      console.log(`[phase2] Finish zone crossed at z=${pz.toFixed(2)}`);
      this.onGameOver?.(GameResult.WIN);
      return;
    }

    const now = Date.now();
    if (now < this._recatchGraceUntilMs) return;

    const dist = this._monster.distanceToPlayer(this._player.position);
    if (dist <= CATCH_RADIUS) {
      this._handlePlayerCaught(now);
    }
  }

  private _updateArgument(): void {
    // Player and monster stay frozen while UI drives round submissions.
  }

  private _updateGameOver(dtSeconds: number): void {
    if (this._result === GameResult.EATEN) {
      // Keep the monster alive for spectator camera movement.
      this._monster.update(this._player.position, dtSeconds, false);
      this._player.update();
    }
  }

  private _handlePlayerCaught(nowMs: number): void {
    this._player.shake(CATCH_SHAKE_INTENSITY, CATCH_SHAKE_DURATION_MS);
    this._audio?.playCatchSting();
    this._player.freeze();
    this._monster.freeze();
    this._setPhase(GamePhase.ARGUMENT);

    this._logicState = gameUpdater(this._logicState, {
      type: "PLAYER_CAUGHT",
      nowMs,
    });

    const session = this._logicState.argument;
    if (!session) return;
    this.onPlayerCaught?.(session);
    this.onArgumentStart?.(session);
    this.onArgumentUpdate?.(session);
  }

  private _emitHud(): void {
    if (!this.onHudUpdate || !this._player || !this._monster) return;
    this.onHudUpdate({
      phase: this._phase,
      distanceToGoal: Math.max(0, FINISH_Z - this._player.position.z),
      monsterState: this._monster.state,
    });
  }

  private _emitDebug(): void {
    if (!this.onDebug || !this._player || !this._monster) return;

    const fps = this._engine.getFps().toFixed(0);
    const pos = this._player.position;
    const progress = (((pos.z - START_Z) / (FINISH_Z - START_Z)) * 100).toFixed(0);
    const graceMs = Math.max(0, this._recatchGraceUntilMs - Date.now());

    this.onDebug(
      `FPS: ${fps}\n` +
        `Phase: ${this._phase}\n` +
        `Monster: ${this._monster.state}\n` +
        `X: ${pos.x.toFixed(1)}\n` +
        `Z: ${pos.z.toFixed(1)}\n` +
        `Look: ${this._player.isPointerLocked ? "locked" : "free"}\n` +
        `Yaw: ${this._player.yaw.toFixed(2)}\n` +
        `Pitch: ${this._player.pitch.toFixed(2)}\n` +
        `Progress: ${progress}%\n` +
        `Catch Grace: ${(graceMs / 1000).toFixed(1)}s`
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

  private async _setupDevDebugTools(): Promise<void> {
    if (!import.meta.env.DEV || this._disposed) return;

    try {
      await import("@babylonjs/inspector");
    } catch (err) {
      console.warn("[debug] Failed to load Babylon Inspector:", err);
    }
    if (this._disposed) return;

    let spector: SpectorLike | null = null;
    try {
      const mod = (await import("spectorjs")) as SpectorModule;
      const SpectorCtor =
        mod.Spector ?? mod.default?.Spector ?? (window as { SPECTOR?: { Spector?: new () => SpectorLike } }).SPECTOR?.Spector;
      if (SpectorCtor) {
        spector = new SpectorCtor();
        (window as { __SPECTOR__?: SpectorLike }).__SPECTOR__ = spector;
      } else {
        console.warn("[debug] SpectorJS loaded but no Spector constructor was found.");
      }
    } catch (err) {
      console.warn("[debug] Failed to load SpectorJS:", err);
    }
    if (this._disposed) return;

    const handleKeyDown = (evt: KeyboardEvent) => {
      if (!evt.shiftKey) return;
      const key = evt.key.toLowerCase();

      if (key === "i") {
        evt.preventDefault();
        if (this._scene.debugLayer.isVisible()) {
          void this._scene.debugLayer.hide();
        } else {
          void this._scene.debugLayer.show({ overlay: true });
        }
      }

      if (key === "s" && spector) {
        evt.preventDefault();
        spector.spyCanvases();
        spector.displayUI();
        console.log("[debug] SpectorJS UI opened.");
      }

      if (key === "p" && spector) {
        evt.preventDefault();
        spector.captureCanvas(this._canvas);
        console.log("[debug] SpectorJS capture requested.");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    console.log("[debug] Shortcuts: Shift+I (Inspector), Shift+S (Spector UI), Shift+P (Spector capture).");

    this._devDebugCleanup = () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (this._scene?.debugLayer?.isVisible()) {
        void this._scene.debugLayer.hide();
      }
      const win = window as { __SPECTOR__?: SpectorLike };
      if (win.__SPECTOR__ === spector) {
        delete win.__SPECTOR__;
      }
    };
  }

  /** Freeze gameplay for argument phase */
  freezeForArgument(): void {
    this._player.freeze();
    this._monster.freeze();
    this._setPhase(GamePhase.ARGUMENT);
  }

  submitChatMessage(text: string): void {
    if (this._phase !== GamePhase.ARGUMENT) return;

    const nowMs = Date.now();
    const trimmed = text.trim();
    this._logicState = gameUpdater(
      this._logicState,
      trimmed.length > 0
        ? { type: "CHAT_MESSAGE", message: trimmed, nowMs }
        : { type: "ROUND_TIMEOUT", nowMs }
    );

    const session = this._logicState.argument;
    if (!session) return;

    this.onArgumentUpdate?.(session);
    if (session.outcome === "won") {
      this._logicState = gameUpdater(this._logicState, { type: "ARGUMENT_WON", nowMs });
      this._logicState = gameUpdater(this._logicState, { type: "RESET_ARGUMENT", nowMs });
      this.resumeChase();
      return;
    }

    if (session.outcome === "lost") {
      this._logicState = gameUpdater(this._logicState, { type: "ARGUMENT_LOST", nowMs });
      this._logicState = gameUpdater(this._logicState, { type: "RESET_ARGUMENT", nowMs });
      this.playerEaten();
    }
  }

  /** Resume chase after winning an argument */
  resumeChase(): void {
    this._recatchGraceUntilMs = Date.now() + RECATCH_GRACE_MS;
    this._player.unfreeze();
    this._monster.unfreeze();
    this._setPhase(GamePhase.PLAYING);
  }

  /** Player was eaten */
  playerEaten(): void {
    this._result = GameResult.EATEN;
    this._player.spectate(() => this._monster.position);
    this._monster.unfreeze();
    this._setPhase(GamePhase.GAME_OVER);
    this.onGameOver?.(GameResult.EATEN);
  }

  resize(): void {
    this._engine.resize();
  }

  dispose(): void {
    this._disposed = true;
    this._devDebugCleanup?.();
    this._devDebugCleanup = null;
    this._engine.stopRenderLoop();
    this._audio?.dispose();
    this._audio = null;
    this._player?.dispose();
    this._monster?.dispose();
    this._scene?.dispose();
    resetMaterialCache();
    this._engine.dispose();
  }
}
