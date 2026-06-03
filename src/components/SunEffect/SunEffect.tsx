import { Component, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SunCanvas } from "./SunCanvas";
import type {
  ResolvedSunEffectConfig,
  SunColorPalette,
  SunEffectProps,
  SunEffectQuality,
} from "./SunEffect.types";
import { usePerformanceQuality } from "./hooks/usePerformanceQuality";
import { usePointerUniforms } from "./hooks/usePointerUniforms";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useWebGLAvailable } from "./hooks/useWebGLAvailable";
import "./SunEffect.css";

const DEFAULT_PALETTE: SunColorPalette = {
  core: "#fff4b0",
  plasma: "#ff8a00",
  corona: "#ff3d00",
  shadow: "#160000",
};

const DEFAULT_QUALITY: SunEffectQuality = "high";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function shouldUseWebGL(available: boolean) {
  const renderer = import.meta.env.VITE_SUN_RENDERER;
  if (!available || renderer === "css") return false;

  return true;
}

class SunCanvasBoundary extends Component<
  { children: ReactNode; onFallback: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("SunEffect WebGL fallback activated", error);
    this.props.onFallback();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

export function SunEffect({
  className,
  style,
  anchorRef,
  quality = DEFAULT_QUALITY,
  interactive = true,
  paused = false,
  intensity = 1.35,
  size = 1,
  plasmaSpeed = 0.35,
  plasmaScale = 2.2,
  coronaSize = 1.25,
  coronaDistortion = 0.45,
  rayStrength = 0.8,
  rayLength = 1.2,
  cursorInfluence = 0.9,
  bloomStrength = 1.6,
  bloomRadius = 0.45,
  colorPalette,
  decorative = true,
  ariaLabel,
  capturePointerEvents = true,
  hoverTargetRadius,
  forceFallback = false,
}: SunEffectProps) {
  const reducedMotion = useReducedMotion();
  const webGLAvailable = useWebGLAvailable();
  const [canvasFailed, setCanvasFailed] = useState(false);
  const useWebGL = shouldUseWebGL(webGLAvailable) && !canvasFailed && !forceFallback;
  const pointerEnabled = interactive && !paused && !reducedMotion;
  const pointer = usePointerUniforms(pointerEnabled, hoverTargetRadius, anchorRef);
  const preset = usePerformanceQuality(quality, reducedMotion);

  const palette = useMemo(
    () => ({
      ...DEFAULT_PALETTE,
      ...colorPalette,
    }),
    [colorPalette],
  );

  const config = useMemo<ResolvedSunEffectConfig>(
    () => ({
      quality,
      interactive: pointerEnabled,
      paused: paused || reducedMotion,
      intensity: clamp(intensity, 0, 3),
      size: clamp(size, 0.08, 2.2),
      plasmaSpeed: clamp(plasmaSpeed, 0, 2),
      plasmaScale: clamp(plasmaScale, 0.5, 6),
      coronaSize: clamp(coronaSize, 0.8, 2.2),
      coronaDistortion: clamp(coronaDistortion, 0, 1.2),
      rayStrength: clamp(rayStrength, 0, 2),
      rayLength: clamp(rayLength, 0.55, 2.4),
      cursorInfluence: clamp(cursorInfluence, 0, 1.6),
      bloomStrength: reducedMotion ? Math.min(bloomStrength, 0.65) : clamp(bloomStrength, 0, 3),
      bloomRadius: clamp(bloomRadius, 0, 1),
      colorPalette: palette,
    }),
    [
      bloomRadius,
      bloomStrength,
      coronaDistortion,
      coronaSize,
      cursorInfluence,
      intensity,
      palette,
      paused,
      plasmaScale,
      plasmaSpeed,
      pointerEnabled,
      quality,
      rayLength,
      rayStrength,
      reducedMotion,
      size,
    ],
  );

  const mergedStyle = {
    "--sun-core-color": palette.core,
    "--sun-plasma-color": palette.plasma,
    "--sun-corona-color": palette.corona,
    "--sun-shadow-color": palette.shadow,
    ...style,
  } as CSSProperties;

  const classes = [
    "sun-effect",
    pointerEnabled && capturePointerEvents ? "sun-effect--interactive" : "",
    reducedMotion ? "sun-effect--reduced-motion" : "",
    !useWebGL ? "sun-effect--fallback" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const accessibilityProps = decorative
    ? { "aria-hidden": true as const }
    : { role: "img", "aria-label": ariaLabel ?? "Animated sun effect" };

  return (
    <div
      className={classes}
      ref={pointer.targetRef}
      style={mergedStyle}
      {...accessibilityProps}
      {...(pointerEnabled && capturePointerEvents ? pointer.handlers : undefined)}
    >
      {useWebGL ? (
        <SunCanvasBoundary onFallback={() => setCanvasFailed(true)}>
          <SunCanvas
            anchorRef={anchorRef}
            config={config}
            pointer={pointer}
            preset={preset}
            reducedMotion={reducedMotion}
          />
        </SunCanvasBoundary>
      ) : (
        <div className="sun-effect__static" />
      )}
    </div>
  );
}
