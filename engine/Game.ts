import { Engine, Scene } from "@babylonjs/core";
import { GamePhase, GameResult } from "../game/types";
import { FINISH_Z, START_Z } from "../game/constants";
import { buildForest } from "./ForestMap";
import { setupLighting } from "./Lighting";
import { PlayerController } from "./PlayerController";

export class Game {
  private _engine: Engine;
  private _scene!: Scene;
  private _player!: PlayerController;
  private _phase: GamePhase = GamePhase.LOADING;
  private _disposed = false;

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
    this._scene = new Scene(this._engine);
    this._scene.collisionsEnabled = true;

    // Set up world
    setupLighting(this._scene);
    buildForest(this._scene);

    // Create player at start zone
    this._player = new PlayerController(this._scene, START_Z);

    this._phase = GamePhase.PLAYING;

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
      this.onGameOver?.(GameResult.WIN);
    }

    // Debug info
    if (this.onDebug) {
      const fps = this._engine.getFps().toFixed(0);
      const pos = this._player.position;
      const progress = ((pz - START_Z) / (FINISH_Z - START_Z) * 100).toFixed(0);
      this.onDebug(`FPS: ${fps}\nZ: ${pos.z.toFixed(1)}\nProgress: ${progress}%`);
    }
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
    this._engine.stopRenderLoop();
    this._scene?.dispose();
    this._engine.dispose();
  }
}
