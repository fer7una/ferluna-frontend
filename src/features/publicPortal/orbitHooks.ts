import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  ORBIT_GLIDE_MS,
  ORBIT_HOVER_PLAYBACK_RATE,
  type LayoutMode,
  type OrbPhase,
} from "./constants";

export type { LayoutMode, OrbPhase };
export { ORBIT_GLIDE_MS, ORBIT_HOVER_PLAYBACK_RATE };

export function setOrbitPlaybackRate(
  container: HTMLElement | null,
  animationSelector: string,
  playbackRate: number,
) {
  if (!animationSelector) {
    return;
  }

  container?.querySelectorAll<HTMLElement>(animationSelector).forEach((element) => {
    element.getAnimations().forEach((animation) => {
      animation.updatePlaybackRate(playbackRate);
    });
  });
}

export function useOrbitPointerHover(
  containerRef: RefObject<HTMLElement>,
  hitSelector: string,
  animationSelector: string,
  enabled: boolean,
  targetsKey: number = 0,
) {
  const activeElementRef = useRef<HTMLElement | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, hasPointer: false });

  useEffect(() => {
    const clearActive = () => {
      if (activeElementRef.current) {
        activeElementRef.current.classList.remove("is-pointer-hover");
        activeElementRef.current = null;
        setOrbitPlaybackRate(containerRef.current, animationSelector, 1);
      }
    };

    if (!enabled) {
      clearActive();
      return;
    }

    const container = containerRef.current;
    const targets = container
      ? Array.from(container.querySelectorAll<HTMLElement>(hitSelector))
      : [];

    const setActiveElement = (nextElement: HTMLElement | null) => {
      if (activeElementRef.current === nextElement) {
        return;
      }
      activeElementRef.current?.classList.remove("is-pointer-hover");
      nextElement?.classList.add("is-pointer-hover");
      activeElementRef.current = nextElement;
      setOrbitPlaybackRate(
        containerRef.current,
        animationSelector,
        nextElement ? ORBIT_HOVER_PLAYBACK_RATE : 1,
      );
    };

    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, hasPointer: true };
    };

    const clearHover = () => {
      pointerRef.current.hasPointer = false;
      setActiveElement(null);
    };

    const tick = () => {
      const pointer = pointerRef.current;
      let found: HTMLElement | null = null;

      if (pointer.hasPointer) {
        for (const element of targets) {
          const rect = element.getBoundingClientRect();
          if (
            pointer.x >= rect.left &&
            pointer.x <= rect.right &&
            pointer.y >= rect.top &&
            pointer.y <= rect.bottom
          ) {
            found = element;
            break;
          }
        }
      }

      setActiveElement(found);
      frame = window.requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", clearHover);
    window.addEventListener("blur", clearHover);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", clearHover);
      window.removeEventListener("blur", clearHover);
      clearActive();
    };
  }, [enabled, animationSelector, containerRef, hitSelector, targetsKey]);
}

export function useOrbPhase(routeMode: LayoutMode) {
  const [orbPhase, setOrbPhase] = useState<OrbPhase>(() =>
    routeMode === "section" ? "gliding-to-section" : "hub",
  );
  const previousRouteModeRef = useRef<LayoutMode>(routeMode);

  useLayoutEffect(() => {
    const previousRouteMode = previousRouteModeRef.current;
    previousRouteModeRef.current = routeMode;

    let frame = 0;
    let timer = 0;

    if (routeMode === "section") {
      setOrbPhase("gliding-to-section");
      timer = window.setTimeout(() => setOrbPhase("rail"), ORBIT_GLIDE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }

    if (previousRouteMode === "section") {
      setOrbPhase("preparing-hub-glide");
      frame = window.requestAnimationFrame(() => {
        setOrbPhase("gliding-to-hub");
        timer = window.setTimeout(() => setOrbPhase("hub"), ORBIT_GLIDE_MS);
      });

      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }

    setOrbPhase("hub");
    return undefined;
  }, [routeMode]);

  return orbPhase;
}
