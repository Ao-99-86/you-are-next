import { Sound, type Scene } from "@babylonjs/core";
import {
  HEARTBEAT_MAX_INTERVAL,
  HEARTBEAT_MIN_INTERVAL,
  HEARTBEAT_MAX_DISTANCE,
  FOOTSTEP_INTERVAL,
  AMBIENT_VOLUME,
} from "../game/constants";

export class AudioSystem {
  private _ambientSound: Sound;
  private _heartbeatSound: Sound;
  private _footstepSound: Sound;
  private _catchSound: Sound;

  private _heartbeatTimer = 0;
  private _heartbeatInterval = HEARTBEAT_MAX_INTERVAL;
  private _footstepTimer = 0;
  private _disposed = false;
  private _started = false;

  constructor(scene: Scene) {
    this._ambientSound = new Sound(
      "ambient",
      "/sounds/ambient.wav",
      scene,
      () => {
        if (this._disposed || !this._started || this._ambientSound.isPlaying) return;
        this._ambientSound.play();
      },
      { loop: true, volume: AMBIENT_VOLUME, autoplay: false }
    );

    this._heartbeatSound = new Sound(
      "heartbeat",
      "/sounds/heartbeat.wav",
      scene,
      null,
      { volume: 0.5 }
    );

    this._footstepSound = new Sound(
      "footstep",
      "/sounds/footstep.wav",
      scene,
      null,
      { volume: 0.2 }
    );

    this._catchSound = new Sound(
      "catchSting",
      "/sounds/catch-sting.wav",
      scene,
      null,
      { volume: 0.7 }
    );
  }

  resume(): void {
    if (this._disposed) return;
    this._started = true;
    if (!this._ambientSound.isPlaying) {
      this._ambientSound.play();
    }
  }

  updateHeartbeat(monsterDistance: number, dtSeconds: number): void {
    if (this._disposed) return;

    const t = Math.max(0, Math.min(1, (monsterDistance - 5) / (HEARTBEAT_MAX_DISTANCE - 5)));
    this._heartbeatInterval = HEARTBEAT_MIN_INTERVAL + t * (HEARTBEAT_MAX_INTERVAL - HEARTBEAT_MIN_INTERVAL);

    this._heartbeatTimer += dtSeconds;
    if (this._heartbeatTimer >= this._heartbeatInterval) {
      this._heartbeatTimer = 0;
      this._heartbeatSound.play();
    }
  }

  updateFootsteps(isMoving: boolean, dtSeconds: number): void {
    if (this._disposed) return;

    if (!isMoving) {
      this._footstepTimer = 0;
      return;
    }

    this._footstepTimer += dtSeconds;
    if (this._footstepTimer >= FOOTSTEP_INTERVAL) {
      this._footstepTimer = 0;
      this._footstepSound.play();
    }
  }

  playCatchSting(): void {
    if (this._disposed) return;
    this._catchSound.play();
  }

  dispose(): void {
    this._disposed = true;
    this._ambientSound.dispose();
    this._heartbeatSound.dispose();
    this._footstepSound.dispose();
    this._catchSound.dispose();
  }
}
