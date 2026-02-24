import {
  Scene,
  HemisphericLight,
  Vector3,
  Color3,
  Color4,
} from "@babylonjs/core";
import { FOG_DENSITY } from "../game/constants";

export function setupLighting(scene: Scene): void {
  // Dim ambient light from above
  const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.3;
  hemi.diffuse = new Color3(0.4, 0.35, 0.5);
  hemi.groundColor = new Color3(0.02, 0.02, 0.04);

  // Exponential fog
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = FOG_DENSITY;
  scene.fogColor = new Color3(0.03, 0.03, 0.05);

  // Dark clear color
  scene.clearColor = new Color4(0.02, 0.02, 0.04, 1);

  // Ambient color
  scene.ambientColor = new Color3(0.05, 0.05, 0.08);
}
