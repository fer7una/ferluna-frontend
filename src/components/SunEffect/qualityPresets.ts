import type { SunEffectQuality, SunQualityPreset } from "./SunEffect.types";

export const SUN_QUALITY_PRESETS: Record<SunEffectQuality, SunQualityPreset> = {
  low: {
    dpr: 1,
    sphereSegments: 56,
    planeSegments: 1,
    bloomMultiplier: 0.55,
    shaderComplexity: 2,
    antialias: false,
  },
  medium: {
    dpr: 1.5,
    sphereSegments: 80,
    planeSegments: 1,
    bloomMultiplier: 0.8,
    shaderComplexity: 3,
    antialias: true,
  },
  high: {
    dpr: 2,
    sphereSegments: 112,
    planeSegments: 1,
    bloomMultiplier: 1,
    shaderComplexity: 4,
    antialias: true,
  },
  ultra: {
    dpr: 2,
    sphereSegments: 144,
    planeSegments: 1,
    bloomMultiplier: 1.12,
    shaderComplexity: 5,
    antialias: true,
  },
};

export function resolveQualityPreset(
  quality: SunEffectQuality,
  isCompactViewport: boolean,
  reducedMotion: boolean,
): SunQualityPreset {
  const preset = SUN_QUALITY_PRESETS[quality];

  if (reducedMotion) {
    return {
      ...SUN_QUALITY_PRESETS.low,
      bloomMultiplier: 0.32,
      shaderComplexity: 1,
    };
  }

  if (!isCompactViewport) {
    return preset;
  }

  return {
    ...preset,
    dpr: Math.min(preset.dpr, quality === "low" ? 1 : 1.35),
    sphereSegments: Math.min(preset.sphereSegments, 80),
    bloomMultiplier: Math.min(preset.bloomMultiplier, 0.75),
    shaderComplexity: Math.min(preset.shaderComplexity, 3),
  };
}

