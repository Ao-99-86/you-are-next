import {
  Scene,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  ShadowGenerator,
  Vector3,
  Color3,
  Color4,
  AbstractMesh,
} from "@babylonjs/core";
import {
  FOG_DENSITY,
  HEMI_INTENSITY,
  SHADOW_MAP_SIZE,
  FLICKER_LIGHT_COUNT,
  FLICKER_LIGHT_RANGE,
  START_Z,
  FINISH_Z,
} from "../game/constants";

export interface LightingRig {
  flickerLights: PointLight[];
  shadowGenerator: ShadowGenerator;
}

export function setupLighting(scene: Scene): LightingRig {
  // Dim ambient light from above
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = HEMI_INTENSITY;
  hemi.diffuse = new Color3(0.62, 0.58, 0.7);
  hemi.groundColor = new Color3(0.08, 0.08, 0.1);

  // Exponential fog — denser for Phase 3
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_DENSITY;
  scene.fogColor = new Color3(0.05, 0.05, 0.07);

  // Dark clear color
  scene.clearColor = new Color4(0.03, 0.03, 0.05, 1);

  // Ambient color
  scene.ambientColor = new Color3(0.1, 0.1, 0.12);

  // Directional light for shadow casting
  const dirLight = new DirectionalLight("dirLight", new Vector3(-0.3, -1, 0.5), scene);
  dirLight.intensity = 0.2;
  dirLight.diffuse = new Color3(0.55, 0.5, 0.6);
  dirLight.position = new Vector3(0, 30, 0);

  const shadowGen = new ShadowGenerator(SHADOW_MAP_SIZE, dirLight);
  shadowGen.useBlurExponentialShadowMap = true;
  shadowGen.blurKernel = 16;

  // Flickering point lights along the corridor
  const flickerLights: PointLight[] = [];
  const corridorLen = FINISH_Z - START_Z;
  for (let i = 0; i < FLICKER_LIGHT_COUNT; i++) {
    const t = (i + 0.5) / FLICKER_LIGHT_COUNT;
    const z = START_Z + t * corridorLen;
    const x = Math.sin((z - START_Z) * 0.03) * 8; // follow corridor center
    const light = new PointLight(`flicker_${i}`, new Vector3(x, 3.5, z), scene);
    light.diffuse = new Color3(0.9, 0.45, 0.15);
    light.intensity = 0.4 + Math.random() * 0.4;
    light.range = FLICKER_LIGHT_RANGE;
    flickerLights.push(light);
  }

  return { flickerLights, shadowGenerator: shadowGen };
}

export function updateLights(rig: LightingRig, timeMs: number): void {
  const t = timeMs / 1000;
  for (let i = 0; i < rig.flickerLights.length; i++) {
    const light = rig.flickerLights[i];
    const base = 0.5;
    const amplitude = 0.25;
    const freq = 2.5 + i * 0.7;
    const phase = i * 1.3;
    light.intensity = base + Math.sin(t * freq + phase) * amplitude +
      Math.sin(t * freq * 2.3 + phase * 0.7) * amplitude * 0.3;
  }
}

export function registerShadowCaster(rig: LightingRig, mesh: AbstractMesh): void {
  rig.shadowGenerator.addShadowCaster(mesh, false);
}
