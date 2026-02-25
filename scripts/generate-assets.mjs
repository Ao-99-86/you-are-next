#!/usr/bin/env node
/**
 * generate-assets.mjs
 * Generates static texture PNGs and sound WAVs for public/textures/ and public/sounds/.
 * Run once: node scripts/generate-assets.mjs
 */
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// ─── CRC-32 ──────────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── PNG writer ───────────────────────────────────────────────────────────────
function makePng(width, height, getPixel) {
  // Build raw scan lines: filter-byte(0=None) + RGB per pixel
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = getPixel(x, y);
      row[1 + x * 3] = r & 0xff;
      row[1 + x * 3 + 1] = g & 0xff;
      row[1 + x * 3 + 2] = b & 0xff;
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 6 }); // zlib wrapper (correct for PNG IDAT)

  function pngChunk(type, data) {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crcBuf]);
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  // compression=0, filter=0, interlace=0 (already zero)

  return Buffer.concat([
    sig,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── WAV writer ───────────────────────────────────────────────────────────────
const SR = 44100;

function makeWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write("RIFF", 0, "ascii");
  hdr.writeUInt32LE(36 + data.length, 4);
  hdr.write("WAVE", 8, "ascii");
  hdr.write("fmt ", 12, "ascii");
  hdr.writeUInt32LE(16, 16);       // fmt chunk size
  hdr.writeUInt16LE(1, 20);        // PCM
  hdr.writeUInt16LE(1, 22);        // mono
  hdr.writeUInt32LE(SR, 24);
  hdr.writeUInt32LE(SR * 2, 28);   // byte rate
  hdr.writeUInt16LE(2, 32);        // block align
  hdr.writeUInt16LE(16, 34);       // bits per sample
  hdr.write("data", 36, "ascii");
  hdr.writeUInt32LE(data.length, 40);
  return Buffer.concat([hdr, data]);
}

// ─── Simple deterministic noise helper ───────────────────────────────────────
function noise2(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

// ─── Textures ─────────────────────────────────────────────────────────────────
const S = 64;

const textures = {
  "bark.png": (x, y) => {
    const brightness = 20 + noise2(x, 0, 1) * 25;
    const base = 42 + (noise2(x, y, 5) - 0.5) * 12;
    const r = Math.round(Math.min(255, base + brightness * 0.4));
    const g = Math.round(Math.min(255, (base - 4) + brightness * 0.35));
    const b = Math.round(Math.min(255, (base - 8) + brightness * 0.25));
    return [r, g, b];
  },
  "canopy.png": (x, y) => {
    const spot = noise2(x * 0.5, y * 0.5, 200) > 0.65 ? 18 : 0;
    const r = Math.round(18 + spot * 0.6);
    const g = Math.round(38 + spot);
    const bv = Math.round(16 + spot * 0.4);
    return [r, g, bv];
  },
  "ground.png": (x, y) => {
    const n = (noise2(x, y, 500) - 0.5) * 20;
    return [
      Math.round(Math.max(0, Math.min(255, 32 + n))),
      Math.round(Math.max(0, Math.min(255, 28 + n))),
      Math.round(Math.max(0, Math.min(255, 20 + n))),
    ];
  },
  "rock.png": (x, y) => {
    const n = (noise2(x, y, 900) - 0.5) * 16;
    const v = Math.round(Math.max(0, Math.min(255, 40 + n)));
    return [v, v, v + 2];
  },
  "monster.png": (_x, _y) => [8, 7, 12],
};

for (const [fname, getPixel] of Object.entries(textures)) {
  const buf = makePng(S, S, getPixel);
  const out = resolve(root, "public", "textures", fname);
  writeFileSync(out, buf);
  console.log(`  wrote ${fname} (${buf.length} bytes)`);
}

// ─── Sounds ───────────────────────────────────────────────────────────────────

// ambient.wav – 2-second brown noise + 38 Hz sine drone (loopable)
function genAmbient() {
  const len = SR * 2;
  const out = new Float32Array(len);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    const noise = last * 3.5 * 0.08; // ambient volume
    const drone = Math.sin((2 * Math.PI * 38 * i) / SR) * 0.04 * 0.08;
    out[i] = Math.max(-1, Math.min(1, noise + drone));
  }
  return out;
}

// heartbeat.wav – two quick 60 Hz pulses
function genHeartbeat() {
  const len = Math.ceil(SR * 0.3);
  const out = new Float32Array(len);
  for (let pulse = 0; pulse < 2; pulse++) {
    const start = Math.floor((pulse * 0.12) * SR);
    const attackEnd = start + Math.floor(0.02 * SR);
    const releaseEnd = start + Math.floor(0.08 * SR);
    for (let i = start; i < Math.min(len, releaseEnd); i++) {
      let env;
      if (i < attackEnd) {
        env = (i - start) / (attackEnd - start);
      } else {
        env = 1 - (i - attackEnd) / (releaseEnd - attackEnd);
      }
      out[i] += Math.sin((2 * Math.PI * 60 * i) / SR) * 0.35 * env;
    }
  }
  return out;
}

// footstep.wav – short filtered noise burst (0.08 s)
function genFootstep() {
  const len = Math.ceil(SR * 0.08);
  const out = new Float32Array(len);
  // Simple bandpass simulation: high-pass via diff, then scale
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const raw = (Math.random() * 2 - 1) * 0.5;
    const hp = raw - prev * 0.85; // crude high-pass
    prev = raw;
    const env = Math.max(0, 1 - i / len);
    out[i] = hp * 0.3 * env;
  }
  return out;
}

// catch-sting.wav – three detuned sawtooth oscillators, 1.2 s
function genCatchSting() {
  const len = Math.ceil(SR * 1.2);
  const out = new Float32Array(len);
  const freqs = [110, 147, 185];
  for (const freq of freqs) {
    for (let i = 0; i < len; i++) {
      const t = i / SR;
      // sawtooth
      const saw = 2 * ((t * freq) % 1) - 1;
      // soft-clip distortion
      const dist = (Math.PI + 3) * saw / (Math.PI + 3 * Math.abs(saw));
      // envelope: 30 ms attack, exponential decay
      const attackSamples = Math.floor(0.03 * SR);
      let env;
      if (i < attackSamples) {
        env = i / attackSamples;
      } else {
        env = Math.exp(-3 * (i - attackSamples) / SR);
      }
      out[i] += dist * 0.25 * env;
    }
  }
  // normalize to prevent clipping
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  if (peak > 0.95) {
    for (let i = 0; i < out.length; i++) out[i] *= 0.95 / peak;
  }
  return out;
}

const sounds = {
  "ambient.wav": genAmbient(),
  "heartbeat.wav": genHeartbeat(),
  "footstep.wav": genFootstep(),
  "catch-sting.wav": genCatchSting(),
};

for (const [fname, samples] of Object.entries(sounds)) {
  const buf = makeWav(samples);
  const out = resolve(root, "public", "sounds", fname);
  writeFileSync(out, buf);
  console.log(`  wrote ${fname} (${(buf.length / 1024).toFixed(1)} KB)`);
}

console.log("Done.");
