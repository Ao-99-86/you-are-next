import {
  Camera,
  Color4,
  DefaultRenderingPipeline,
  Scene,
  PostProcess,
  Effect,
} from "@babylonjs/core";
import { GRAIN_INTENSITY, VIGNETTE_WEIGHT } from "../game/constants";

Effect.ShadersStore["retroDitherFragmentShader"] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;

float getBayer(vec2 pos) {
    vec2 p = floor(mod(pos, 4.0));
    if (p.x == 0.0) {
        if (p.y == 0.0) return 0.0;
        if (p.y == 1.0) return 12.0/16.0;
        if (p.y == 2.0) return 3.0/16.0;
        return 15.0/16.0;
    } else if (p.x == 1.0) {
        if (p.y == 0.0) return 8.0/16.0;
        if (p.y == 1.0) return 4.0/16.0;
        if (p.y == 2.0) return 11.0/16.0;
        return 7.0/16.0;
    } else if (p.x == 2.0) {
        if (p.y == 0.0) return 2.0/16.0;
        if (p.y == 1.0) return 14.0/16.0;
        if (p.y == 2.0) return 1.0/16.0;
        return 13.0/16.0;
    } else {
        if (p.y == 0.0) return 10.0/16.0;
        if (p.y == 1.0) return 6.0/16.0;
        if (p.y == 2.0) return 9.0/16.0;
        return 5.0/16.0;
    }
}

void main(void) {
    vec4 color = texture2D(textureSampler, vUV);
    
    // Add dither noise based on Bayer matrix (reduced intensity)
    float dither = (getBayer(gl_FragCoord.xy) - 0.5) * 0.08;
    color.rgb += dither;
    
    // Posterize to restricted color palette (increased levels for better visibility in dark areas)
    float levels = 32.0;
    color.rgb = floor(color.rgb * levels + 0.5) / levels;
    
    gl_FragColor = color;
}
`;

export function setupPostProcessing(scene: Scene, camera: Camera): DefaultRenderingPipeline {
  const pipeline = new DefaultRenderingPipeline("defaultPipeline", true, scene, [camera]);

  // Film grain
  pipeline.grainEnabled = true;
  pipeline.grain.intensity = GRAIN_INTENSITY / 100.0; // Normalize grain intensity
  pipeline.grain.animated = true;

  // Vignette and Contrast
  pipeline.imageProcessingEnabled = true;
  pipeline.imageProcessing.vignetteEnabled = true;
  pipeline.imageProcessing.vignetteWeight = VIGNETTE_WEIGHT;
  pipeline.imageProcessing.vignetteStretch = 0.5;
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 1);
  pipeline.imageProcessing.contrast = 1.2;
  pipeline.imageProcessing.exposure = 1.1;

  const retroPostProcess = new PostProcess(
    "retroDither",
    "retroDither",
    [],
    null,
    1.0,
    camera
  );

  return pipeline;
}
