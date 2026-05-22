import { useEffect, useMemo, useState } from "react";
import { resolveQualityPreset } from "../qualityPresets";
import type { SunEffectQuality } from "../SunEffect.types";

export function usePerformanceQuality(quality: SunEffectQuality, reducedMotion: boolean) {
  const [isCompactViewport, setIsCompactViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const update = () => setIsCompactViewport(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return useMemo(
    () => resolveQualityPreset(quality, isCompactViewport, reducedMotion),
    [isCompactViewport, quality, reducedMotion],
  );
}

