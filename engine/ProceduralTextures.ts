import { DynamicTexture, Scene, Texture } from "@babylonjs/core";
import { TEXTURE_SIZE } from "../game/constants";

function makeTex(name: string, scene: Scene): { tex: DynamicTexture; ctx: CanvasRenderingContext2D } {
  const tex = new DynamicTexture(name, { width: TEXTURE_SIZE, height: TEXTURE_SIZE }, scene, false);
  tex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
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

  // Base dark brown fill
  ctx.fillStyle = "rgb(42, 30, 18)";
  ctx.fillRect(0, 0, s, s);

  // Vertical streaks
  for (let x = 0; x < s; x++) {
    const brightness = 20 + noise(x, 0, 1) * 25;
    const width = 1 + Math.floor(noise(x, 1, 2) * 2);
    ctx.fillStyle = `rgb(${brightness + 10}, ${brightness}, ${brightness - 5})`;
    ctx.fillRect(x, 0, width, s);
  }

  // Dark knots
  for (let i = 0; i < 6; i++) {
    const kx = Math.floor(noise(i, 0, 10) * s);
    const ky = Math.floor(noise(0, i, 20) * s);
    const kr = 2 + Math.floor(noise(i, i, 30) * 3);
    ctx.fillStyle = "rgba(15, 10, 5, 0.7)";
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, Math.PI * 2);
    ctx.fill();
  }

  tex.update();
  return tex;
}

export function createCanopyTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("canopyTex", scene);
  const s = TEXTURE_SIZE;

  // Dark green base
  ctx.fillStyle = "rgb(18, 38, 16)";
  ctx.fillRect(0, 0, s, s);

  // Lighter spots
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(noise(i, 0, 100) * s);
    const y = Math.floor(noise(0, i, 200) * s);
    const g = 30 + Math.floor(noise(i, i, 300) * 30);
    ctx.fillStyle = `rgb(${g - 10}, ${g + 10}, ${g - 12})`;
    ctx.fillRect(x, y, 2, 2);
  }

  tex.update();
  return tex;
}

export function createGroundTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("groundTex", scene);
  const s = TEXTURE_SIZE;

  // Dark brown dirt base
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

  // Dark patches
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(noise(i, 0, 600) * s);
    const y = Math.floor(noise(0, i, 700) * s);
    ctx.fillStyle = "rgba(10, 8, 5, 0.5)";
    ctx.fillRect(x, y, 4 + Math.floor(noise(i, i, 800) * 6), 3);
  }

  tex.update();
  return tex;
}

export function createRockTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("rockTex", scene);
  const s = TEXTURE_SIZE;

  // Grey base
  ctx.fillStyle = "rgb(40, 40, 42)";
  ctx.fillRect(0, 0, s, s);

  // Per-pixel noise
  const imgData = ctx.getImageData(0, 0, s, s);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const px = (i / 4) % s;
    const py = Math.floor(i / 4 / s);
    const n = (noise(px, py, 900) - 0.5) * 16;
    imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + n));
    imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + n));
    imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + n));
  }
  ctx.putImageData(imgData, 0, 0);

  // Crack lines
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = "rgba(20, 20, 22, 0.6)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    let cx = Math.floor(noise(i, 0, 1000) * s);
    let cy = Math.floor(noise(0, i, 1100) * s);
    ctx.moveTo(cx, cy);
    for (let j = 0; j < 4; j++) {
      cx += Math.floor((noise(i, j, 1200) - 0.5) * 16);
      cy += Math.floor(noise(i, j, 1300) * 10);
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  tex.update();
  return tex;
}

export function createMonsterTexture(scene: Scene): DynamicTexture {
  const { tex, ctx } = makeTex("monsterTex", scene);
  const s = TEXTURE_SIZE;

  // Near-black base
  ctx.fillStyle = "rgb(8, 7, 12)";
  ctx.fillRect(0, 0, s, s);

  // Dark purple veins
  for (let i = 0; i < 8; i++) {
    ctx.strokeStyle = "rgba(30, 10, 35, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    let vx = Math.floor(noise(i, 0, 1400) * s);
    let vy = Math.floor(noise(0, i, 1500) * s);
    ctx.moveTo(vx, vy);
    for (let j = 0; j < 6; j++) {
      vx += Math.floor((noise(i, j, 1600) - 0.5) * 12);
      vy += Math.floor(noise(i, j, 1700) * 8);
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  tex.update();
  return tex;
}
