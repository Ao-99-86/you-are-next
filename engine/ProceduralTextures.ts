import { DynamicTexture, Scene, Texture } from "@babylonjs/core";
import { TEXTURE_SIZE } from "../game/constants";

function makeTex(name: string, scene: Scene): { tex: DynamicTexture; ctx: CanvasRenderingContext2D } {
  const tex = new DynamicTexture(name, { width: TEXTURE_SIZE, height: TEXTURE_SIZE }, scene, false);
  tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  return { tex, ctx };
}

function noise(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

export function createBarkTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("barkTex", scene);
  const s = TEXTURE_SIZE;

  // Clear transparent
  ctx.clearRect(0, 0, s, s);

  // Draw a log shape (rectangle with some noise)
  const w = s * 0.4;
  const left = (s - w) / 2;
  
  ctx.fillStyle = "rgb(42, 30, 18)";
  ctx.fillRect(left, 0, w, s);

  // Vertical streaks
  for (let x = left; x < left + w; x++) {
    const brightness = 20 + noise(x, 0, 1) * 25;
    const width = 1 + Math.floor(noise(x, 1, 2) * 2);
    ctx.fillStyle = `rgb(${brightness + 10}, ${brightness}, ${brightness - 5})`;
    ctx.fillRect(x, 0, width, s);
  }

  tex.update();
  return tex;
}

export function createCanopyTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("canopyTex", scene);
  const s = TEXTURE_SIZE;

  // Clear transparent
  ctx.clearRect(0, 0, s, s);

  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.45;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx*dx + dy*dy < r*r) {
        // Dark green base with noise
        const n = noise(x, y, 100);
        if (n > 0.2) {
          const g = 18 + Math.floor(n * 30);
          ctx.fillStyle = `rgb(${g - 10}, ${g + 20}, ${g - 12})`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  tex.update();
  return tex;
}

export function createGroundTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("groundTex", scene);
  const s = TEXTURE_SIZE;

  // Dark brown dirt base (Opaque since ground is not a sprite)
  ctx.fillStyle = "rgb(32, 28, 20)";
  ctx.fillRect(0, 0, s, s);

  // Per-pixel noise
  const imgData = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const px = (i / 4) % s;
    const py = Math.floor(i / 4 / s);
    const n = (noise(px, py, 500) - 0.5) * 20;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + n));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  tex.update();
  return tex;
}

export function createRockTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("rockTex", scene);
  const s = TEXTURE_SIZE;

  ctx.clearRect(0, 0, s, s);

  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.4;

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const dx = x - cx;
      const dy = (y - cy) * 1.5; // flatten it a bit
      if (dx*dx + dy*dy < r*r) {
        const n = noise(x, y, 900);
        const val = 30 + Math.floor(n * 20);
        ctx.fillStyle = `rgb(${val}, ${val}, ${val + 2})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  tex.update();
  return tex;
}

export function createMonsterTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("monsterTex", scene);
  const s = TEXTURE_SIZE;

  ctx.clearRect(0, 0, s, s);

  // Draw a creepy silhouette
  const cx = s / 2;
  const baseW = s * 0.3;
  
  for (let y = s * 0.1; y < s * 0.9; y++) {
    for (let x = cx - baseW; x < cx + baseW; x++) {
      const n = noise(x, y, 1400);
      // Create a tapered shape with noise edges
      const taper = (y / s); // 0 at top, 1 at bottom
      const width = baseW * (0.5 + 0.5 * taper);
      if (Math.abs(x - cx) < width - n * 10) {
        ctx.fillStyle = "rgb(8, 7, 12)";
        ctx.fillRect(x, y, 1, 1);
        
        // Add purple veins
        if (n > 0.8) {
          ctx.fillStyle = "rgba(100, 20, 110, 0.8)";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  // Glowing eyes
  ctx.fillStyle = "rgb(255, 20, 20)";
  ctx.fillRect(cx - 6, s * 0.25, 4, 3);
  ctx.fillRect(cx + 2, s * 0.25, 4, 3);

  tex.update();
  return tex;
}

export function createSkyTexture(scene: Scene): DynamicTexture {
  const s = 256;
  const tex = new DynamicTexture("skyTex", { width: s, height: s }, scene, false);
  tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  const ctx = tex.getContext() as CanvasRenderingContext2D;

  // Vertical gradient: deep navy at top → fog-matching dark blue-gray at bottom
  for (let y = 0; y < s; y++) {
    const t = y / s;
    const r = Math.floor(8 + t * 12);   // 8 → 20
    const g = Math.floor(10 + t * 16);  // 10 → 26
    const b = Math.floor(30 + t * 8);   // 30 → 38
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(0, y, s, 1);
  }

  // Storm clouds — dark blue-gray noise
  for (let y = 0; y < s; y += 2) {
    for (let x = 0; x < s; x += 2) {
      const n = noise(x * 0.03, y * 0.03, 123);
      if (n > 0.3) {
        const val = Math.floor((n - 0.3) * 50);
        ctx.fillStyle = `rgba(${val + 15}, ${val + 10}, ${val + 25}, 0.5)`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  // Blood moon
  ctx.fillStyle = "rgb(200, 30, 30)";
  ctx.beginPath();
  ctx.arc(s * 0.8, s * 0.2, 18, 0, Math.PI * 2);
  ctx.fill();

  // Moon glow
  ctx.fillStyle = "rgba(200, 30, 30, 0.2)";
  ctx.beginPath();
  ctx.arc(s * 0.8, s * 0.2, 30, 0, Math.PI * 2);
  ctx.fill();

  tex.update();
  return tex;
}

export function createParticleTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("particleTex", { width: 8, height: 8 }, scene, false);
  tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 8, 8);
  ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
  ctx.fillRect(2, 2, 4, 4);
  tex.update();
  return tex;
}

export function createRainTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("rainTex", { width: 4, height: 16 }, scene, false);
  tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  tex.hasAlpha = true;
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, 4, 16);
  for (let y = 0; y < 16; y++) {
    const alpha = Math.sin((y / 16) * Math.PI) * 0.8;
    ctx.fillStyle = `rgba(180, 210, 255, ${alpha.toFixed(2)})`;
    ctx.fillRect(1, y, 2, 1);
  }
  tex.update();
  return tex;
}
