import {
  Camera,
  Color4,
  DefaultRenderingPipeline,
  Scene,
} from "@babylonjs/core";
import { GRAIN_INTENSITY, VIGNETTE_WEIGHT } from "../game/constants";

export function setupPostProcessing(scene: Scene, camera: Camera): DefaultRenderingPipeline {
  const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);

  // Film grain
  pipeline.grainEnabled = true;
  pipeline.grain.intensity = GRAIN_INTENSITY;
  pipeline.grain.animated = true;

  // Vignette
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = VIGNETTE_WEIGHT;
  pipeline.imageProcessing.vignetteStretch = 0.5;
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 1);

  return pipeline;
}
