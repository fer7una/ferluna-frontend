import { useEffect, useState, type RefObject } from "react";
import {
  LAYOUT_SETTLE_REMEASURE_MS,
  SCROLL_SHADOW_TOLERANCE_PX,
  SECTION_EXIT_MS,
} from "./constants";

export type VerticalScrollShadows = {
  down: boolean;
  up: boolean;
};

export type MeasuredVerticalScrollShadows = VerticalScrollShadows & {
  measured: boolean;
  overflow: boolean;
};

export function measureVerticalScrollShadows(
  element: HTMLElement,
): MeasuredVerticalScrollShadows {
  const tolerance = SCROLL_SHADOW_TOLERANCE_PX;
  const hasOverflow = element.scrollHeight - element.clientHeight > tolerance;

  return {
    down:
      hasOverflow &&
      element.scrollTop + element.clientHeight < element.scrollHeight - tolerance,
    measured: true,
    overflow: hasOverflow,
    up: hasOverflow && element.scrollTop > tolerance,
  };
}

function areShadowsEqual(
  left: MeasuredVerticalScrollShadows,
  right: MeasuredVerticalScrollShadows,
) {
  return (
    left.down === right.down &&
    left.measured === right.measured &&
    left.overflow === right.overflow &&
    left.up === right.up
  );
}

export function useMeasuredScrollShadows(
  ref: RefObject<HTMLElement>,
  enabled: boolean,
  deps: readonly unknown[] = [],
): MeasuredVerticalScrollShadows {
  const [shadows, setShadows] = useState<MeasuredVerticalScrollShadows>({
    down: false,
    measured: false,
    overflow: false,
    up: false,
  });

  useEffect(() => {
    const element = ref.current;

    if (!enabled || !element) {
      setShadows((current) =>
        current.measured || current.overflow || current.up || current.down
          ? { down: false, measured: false, overflow: false, up: false }
          : current,
      );
      return;
    }

    setShadows({ down: false, measured: false, overflow: false, up: false });

    let frame = 0;
    const timers: number[] = [];
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = measureVerticalScrollShadows(element);
        setShadows((current) => (areShadowsEqual(current, next) ? current : next));
      });
    };
    const scheduleLayoutUpdate = () => {
      update();
      timers.push(window.setTimeout(update, LAYOUT_SETTLE_REMEASURE_MS));
      timers.push(window.setTimeout(update, SECTION_EXIT_MS + LAYOUT_SETTLE_REMEASURE_MS));
    };

    scheduleLayoutUpdate();
    element.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", scheduleLayoutUpdate);

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(element);
    Array.from(element.children).forEach((child) => observer?.observe(child));

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      element.removeEventListener("scroll", update);
      window.removeEventListener("resize", scheduleLayoutUpdate);
      observer?.disconnect();
    };
  }, [enabled, ref, ...deps]);

  return shadows;
}

export function scrollShadowClassNames(
  baseClassName: string,
  shadows: Pick<VerticalScrollShadows, "down" | "up">,
) {
  return [
    baseClassName,
    shadows.up ? "can-scroll-up" : "",
    shadows.down ? "can-scroll-down" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
