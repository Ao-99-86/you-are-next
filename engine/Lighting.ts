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
  CORRIDOR_AMPLITUDE,
  THUNDER_INTERVAL_MIN_MS,
  THUNDER_INTERVAL_MAX_MS,
  THUNDER_FLASH_DURATION_MS,
  START_Z,
  FINISH_Z,
} from "../game/constants";

interface ThunderState {
  nextFlashMs: number;
  flashEndMs: number;
  baseDirIntensity: number;
}

export interface LightingRig {
  flickerLights: PointLight[];
  shadowGenerator: ShadowGenerator;
  dirLight: DirectionalLight;
  thunderState: ThunderState;
}

export function setupLighting(scene: Scene): LightingRig {
  // Ambient light — stormy blue-purple
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = HEMI_INTENSITY;
  hemi.diffuse = new Color3(0.5, 0.58, 0.80);
  hemi.groundColor = new Color3(0.15, 0.15, 0.20);

  // Exponential fog — dark stormy blue-gray
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_DENSITY;
  scene.fogColor = new Color3(0.08, 0.10, 0.15);

  // Clear color matches fog
  scene.clearColor = new Color4(0.08, 0.10, 0.15, 1);

  // Ambient color
  scene.ambientColor = new Color3(0.20, 0.20, 0.25);

  // Directional light — cool blue-white storm lighting
  const dirLight = new DirectionalLight("dirLight", new Vector3(-0.3, -1, 0.5), scene);
  dirLight.intensity = 1.2;
  dirLight.diffuse = new Color3(0.65, 0.72, 0.95);
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
    const x = Math.sin((z - START_Z) * 0.03) * CORRIDOR_AMPLITUDE;
    const light = new PointLight(`flicker_${i}`, new Vector3(x, 3.5, z), scene);
    light.diffuse = new Color3(0.9, 0.45, 0.15);
    light.intensity = 0.6 + Math.random() * 0.4;
    light.range = FLICKER_LIGHT_RANGE;
    flickerLights.push(light);
  }

  const thunderState: ThunderState = {
    nextFlashMs: performance.now() + THUNDER_INTERVAL_MIN_MS + Math.random() * (THUNDER_INTERVAL_MAX_MS - THUNDER_INTERVAL_MIN_MS),
    flashEndMs: 0,
    baseDirIntensity: 1.2,
  };

  return { flickerLights, shadowGenerator: shadowGen, dirLight, thunderState };
}

export function updateLights(rig: LightingRig, timeMs: number): void {
  // Thunder flashes
  const { thunderState, dirLight } = rig;
  if (timeMs >= thunderState.nextFlashMs && timeMs >= thunderState.flashEndMs) {
    dirLight.intensity = 6.0;
    thunderState.flashEndMs = timeMs + THUNDER_FLASH_DURATION_MS;
    thunderState.nextFlashMs = timeMs + THUNDER_INTERVAL_MIN_MS + Math.random() * (THUNDER_INTERVAL_MAX_MS - THUNDER_INTERVAL_MIN_MS);
  } else if (timeMs >= thunderState.flashEndMs && dirLight.intensity > thunderState.baseDirIntensity) {
    dirLight.intensity = thunderState.baseDirIntensity;
  }

  // Flicker lights
  const t = timeMs / 1000;
  for (let i = 0; i < rig.flickerLights.length; i++) {
    const light = rig.flickerLights[i];
    const base = 0.6;
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
