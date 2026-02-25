import {
  HEARTBEAT_MAX_INTERVAL,
  HEARTBEAT_MIN_INTERVAL,
  HEARTBEAT_MAX_DISTANCE,
  FOOTSTEP_INTERVAL,
  AMBIENT_VOLUME,
} from "../game/constants";

export class AudioSystem {
  private _ctx: AudioContext;
  private _masterGain: GainNode;
  private _ambientSource: AudioBufferSourceNode | null = null;
  private _ambientGain: GainNode;
  private _heartbeatTimer = 0;
  private _heartbeatInterval = HEARTBEAT_MAX_INTERVAL;
  private _footstepTimer = 0;
  private _disposed = false;

  constructor() {
    this._ctx = new AudioContext();
    this._masterGain = this._ctx.createGain();
    this._masterGain.gain.value = 0.7;
    this._masterGain.connect(this._ctx.destination);

    this._ambientGain = this._ctx.createGain();
    this._ambientGain.gain.value = AMBIENT_VOLUME;
    this._ambientGain.connect(this._masterGain);
  }

  resume(): void {
    if (this._ctx.state === "suspended") {
      void this._ctx.resume();
    }
    if (!this._ambientSource) {
      this._startAmbient();
    }
  }

  private _startAmbient(): void {
    // Brown noise: filtered white noise
    const sampleRate = this._ctx.sampleRate;
    const duration = 2;
    const length = sampleRate * duration;
    const buffer = this._ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate brown noise via integration of white noise
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    this._ambientSource = this._ctx.createBufferSource();
    this._ambientSource.buffer = buffer;
    this._ambientSource.loop = true;
    this._ambientSource.connect(this._ambientGain);
    this._ambientSource.start();

    // Low drone oscillator
    const drone = this._ctx.createOscillator();
    drone.type = "sine";
    drone.frequency.value = 38;
    const droneGain = this._ctx.createGain();
    droneGain.gain.value = 0.04;
    drone.connect(droneGain);
    droneGain.connect(this._ambientGain);
    drone.start();
  }

  updateHeartbeat(monsterDistance: number, dtSeconds: number): void {
    if (this._disposed) return;

    // Calculate heartbeat interval based on monster distance
    const t = Math.max(0, Math.min(1, (monsterDistance - 5) / (HEARTBEAT_MAX_DISTANCE - 5)));
    this._heartbeatInterval = HEARTBEAT_MIN_INTERVAL + t * (HEARTBEAT_MAX_INTERVAL - HEARTBEAT_MIN_INTERVAL);

    this._heartbeatTimer += dtSeconds;
    if (this._heartbeatTimer >= this._heartbeatInterval) {
      this._heartbeatTimer = 0;
      this._playHeartbeat();
    }
  }

  private _playHeartbeat(): void {
    const now = this._ctx.currentTime;

    // Two quick low-frequency pulses
    for (let i = 0; i < 2; i++) {
      const osc = this._ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 60;

      const env = this._ctx.createGain();
      env.gain.value = 0;
      osc.connect(env);
      env.connect(this._masterGain);

      const pulseStart = now + i * 0.12;
      env.gain.setValueAtTime(0, pulseStart);
      env.gain.linearRampToValueAtTime(0.35, pulseStart + 0.02);
      env.gain.linearRampToValueAtTime(0, pulseStart + 0.08);

      osc.start(pulseStart);
      osc.stop(pulseStart + 0.1);
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
      this._playFootstep();
    }
  }

  private _playFootstep(): void {
    const now = this._ctx.currentTime;
    const sampleRate = this._ctx.sampleRate;

    // Short filtered noise burst
    const duration = 0.05;
    const length = Math.floor(sampleRate * duration);
    const buffer = this._ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5;
    }

    const source = this._ctx.createBufferSource();
    source.buffer = buffer;

    // Band-pass via high-pass + low-pass
    const hp = this._ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;

    const lp = this._ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2000;

    const gain = this._ctx.createGain();
    gain.gain.value = 0.15 + Math.random() * 0.05;

    source.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    gain.connect(this._masterGain);

    source.start(now);
    source.stop(now + duration);
  }

  playCatchSting(): void {
    if (this._disposed) return;
    const now = this._ctx.currentTime;

    // Dissonant chord with 3 oscillators
    const freqs = [110, 147, 185];
    for (const freq of freqs) {
      const osc = this._ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;

      const env = this._ctx.createGain();
      env.gain.value = 0;
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.25, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

      // Distortion via waveshaper
      const shaper = this._ctx.createWaveShaper();
      const curve = new Float32Array(256);
      for (let i = 0; i < 256; i++) {
        const x = (i / 128) - 1;
        curve[i] = (Math.PI + 3) * x / (Math.PI + 3 * Math.abs(x));
      }
      shaper.curve = curve;

      osc.connect(shaper);
      shaper.connect(env);
      env.connect(this._masterGain);

      osc.start(now);
      osc.stop(now + 1.1);
    }
  }

  dispose(): void {
    this._disposed = true;
    if (this._ambientSource) {
      try { this._ambientSource.stop(); } catch { /* already stopped */ }
      this._ambientSource = null;
    }
    if (this._ctx.state !== "closed") {
      void this._ctx.close();
    }
  }
}
