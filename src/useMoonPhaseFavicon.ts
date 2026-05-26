import { useEffect, useLayoutEffect, useState } from "react";
import { getMoonPhase, getNextMoonPhaseChange, renderMoonPhaseFaviconHref } from "./moonPhase";

const MAX_TIMEOUT_MS = 2_147_483_647;

export type MoonPhaseFavicon = {
  href: string;
  label: string;
};

export function useMoonPhaseFavicon() {
  const [icon, setIcon] = useState(() => getMoonPhaseFavicon());

  useEffect(() => {
    let timeoutId = 0;

    const updateAndSchedule = () => {
      const now = new Date();
      const nextIcon = getMoonPhaseFavicon(now);

      setIcon((currentIcon) => (currentIcon.href === nextIcon.href ? currentIcon : nextIcon));

      const nextChangeMs = getNextMoonPhaseChange(now).getTime() - now.getTime();
      timeoutId = window.setTimeout(
        updateAndSchedule,
        Math.max(1_000, Math.min(nextChangeMs + 1_000, MAX_TIMEOUT_MS)),
      );
    };

    updateAndSchedule();

    return () => window.clearTimeout(timeoutId);
  }, []);

  useLayoutEffect(() => {
    updateFavicon(icon);
  }, [icon]);

  return icon;
}

function getMoonPhaseFavicon(date = new Date()): MoonPhaseFavicon {
  const phase = getMoonPhase(date);

  return {
    href: renderMoonPhaseFaviconHref(phase),
    label: phase.label,
  };
}

function updateFavicon(icon: MoonPhaseFavicon) {
  const favicon = getOrCreateFaviconLink();
  favicon.type = "image/svg+xml";
  favicon.href = icon.href;
  favicon.title = icon.label;
}

function getOrCreateFaviconLink() {
  const existing =
    document.querySelector<HTMLLinkElement>('link[data-moon-phase-icon="true"]') ??
    document.querySelector<HTMLLinkElement>('link[rel~="icon"]');

  if (existing) {
    existing.dataset.moonPhaseIcon = "true";
    return existing;
  }

  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.dataset.moonPhaseIcon = "true";
  document.head.appendChild(favicon);
  return favicon;
}
