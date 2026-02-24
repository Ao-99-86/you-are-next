import { Engine, Scene } from "@babylonjs/core";
import { GamePhase, GameResult } from "../game/types";
import { FINISH_Z, START_Z } from "../game/constants";
import { buildForest } from "./ForestMap";
import { setupLighting } from "./Lighting";
import { resetMaterialCache } from "./MeshFactory";
import { PlayerController } from "./PlayerController";

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
  private _phase: GamePhase = GamePhase.LOADING;
  private _started = false;
  private _disposed = false;
  private _devDebugCleanup: (() => void) | null = null;

  // Callbacks for React integration
  onDebug: ((info: string) => void) | null = null;
  onPlayerCaught: (() => void) | null = null;
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
    setupLighting(this._scene);
    buildForest(this._scene);

    // Create player at start zone
    this._player = new PlayerController(this._scene, START_Z);

    this._phase = GamePhase.PLAYING;
    await this._setupDevDebugTools();
    if (this._disposed) return;

    // Render loop
    this._engine.runRenderLoop(() => {
      if (this._disposed) return;

      switch (this._phase) {
        case GamePhase.PLAYING:
          this._update();
          this._scene.render();
          break;
        case GamePhase.ARGUMENT:
          // Scene still renders but player is frozen
          this._scene.render();
          break;
        case GamePhase.GAME_OVER:
          this._scene.render();
          break;
      }
    });
  }

  private _update(): void {
    this._player.update();

    // Check finish zone
    const pz = this._player.position.z;
    if (pz >= FINISH_Z) {
      this._phase = GamePhase.GAME_OVER;
      console.log(`[phase1] Finish zone crossed at z=${pz.toFixed(2)}`);
      this.onGameOver?.(GameResult.WIN);
      return;
    }

    // Debug info
    if (this.onDebug) {
      const fps = this._engine.getFps().toFixed(0);
      const pos = this._player.position;
      const progress = ((pz - START_Z) / (FINISH_Z - START_Z) * 100).toFixed(0);
      this.onDebug(
        `FPS: ${fps}\nX: ${pos.x.toFixed(1)}\nZ: ${pos.z.toFixed(1)}\nProgress: ${progress}%`
      );
    }
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
    this._phase = GamePhase.ARGUMENT;
    this._player.freeze();
  }

  /** Resume chase after winning an argument */
  resumeChase(): void {
    this._phase = GamePhase.PLAYING;
    this._player.unfreeze();
  }

  /** Player was eaten */
  playerEaten(): void {
    this._phase = GamePhase.GAME_OVER;
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
    this._scene?.dispose();
    resetMaterialCache();
    this._engine.dispose();
  }
}
