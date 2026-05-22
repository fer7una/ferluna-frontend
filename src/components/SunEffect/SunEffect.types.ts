import type { CSSProperties, RefObject } from "react";
import type { Vector3 } from "three";

export type SunEffectQuality = "low" | "medium" | "high" | "ultra";

export type SunColorPalette = {
  core: string;
  plasma: string;
  corona: string;
  shadow: string;
};

export type SunEffectProps = {
  className?: string;
  style?: CSSProperties;
  anchorRef?: RefObject<HTMLElement>;
  quality?: SunEffectQuality;
  interactive?: boolean;
  paused?: boolean;
  intensity?: number;
  size?: number;
  plasmaSpeed?: number;
  plasmaScale?: number;
  coronaSize?: number;
  coronaDistortion?: number;
  rayStrength?: number;
  rayLength?: number;
  cursorInfluence?: number;
  bloomStrength?: number;
  bloomRadius?: number;
  colorPalette?: Partial<SunColorPalette>;
  decorative?: boolean;
  ariaLabel?: string;
  capturePointerEvents?: boolean;
  hoverTargetRadius?: number;
};

export type ResolvedSunEffectConfig = {
  quality: SunEffectQuality;
  interactive: boolean;
  paused: boolean;
  intensity: number;
  size: number;
  plasmaSpeed: number;
  plasmaScale: number;
  coronaSize: number;
  coronaDistortion: number;
  rayStrength: number;
  rayLength: number;
  cursorInfluence: number;
  bloomStrength: number;
  bloomRadius: number;
  colorPalette: SunColorPalette;
};

export type SunQualityPreset = {
  dpr: number;
  sphereSegments: number;
  planeSegments: number;
  bloomMultiplier: number;
  shaderComplexity: number;
  antialias: boolean;
};

export type SunFrameState = {
  time: number;
};

export type SunLayoutState = {
  position: Vector3;
  scale: number;
};
