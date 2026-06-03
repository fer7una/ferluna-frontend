import { useCallback, useEffect, useRef, useState } from "react";
import {
  createGovernorState,
  currentOutput,
  DEFAULT_GOVERNOR_CONFIG,
  evaluateGovernor,
  qualityToLevel,
  recordFrame,
  recordLongTask,
  resetWindow,
  type GovernorConfig,
  type GovernorOutput,
  type GovernorState,
  type PeakEvent,
} from "./performanceGovernor";
import type { SunEffectQuality } from "../components/SunEffect/SunEffect.types";

const PEAKS_STORAGE_KEY = "ferluna:perf-peaks";

export type UsePerformanceGovernorOptions = {
  /** Quality the page starts at before any measurement (default "high"). */
  initialQuality?: SunEffectQuality;
  /** Disable the monitor entirely (keeps the initial output fixed). */
  enabled?: boolean;
  /** Override any subset of the governor thresholds. */
  config?: Partial<GovernorConfig>;
};

export type PerformanceGovernorResult = GovernorOutput & {
  /** Saturation peaks logged this session (and restored from the last one). */
  peaks: PeakEvent[];
  /** Clear the in-memory and persisted peak log. */
  clearPeaks: () => void;
};

function loadPeaks(max: number): PeakEvent[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(PEAKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PeakEvent[]).slice(-max) : [];
  } catch {
    return [];
  }
}

function savePeaks(peaks: PeakEvent[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(PEAKS_STORAGE_KEY, JSON.stringify(peaks));
  } catch {
    // Storage may be full or blocked (private mode). The in-memory log still works.
  }
}

/**
 * Whole-page performance governor. Samples frame smoothness and long tasks,
 * and lowers the effective render quality when the user's machine is saturated.
 * Returns the current quality/webgl decision plus a session log of peaks.
 *
 * Recovery is sticky: once degraded, it stays degraded until reload. Quality is
 * never persisted across reloads (a reload is a fresh probe); only the peak log
 * is persisted so the user keeps a record of past saturation.
 */
export function usePerformanceGovernor(
  options: UsePerformanceGovernorOptions = {},
): PerformanceGovernorResult {
  const { initialQuality = "high", enabled = true, config } = options;

  // Resolved config is stable for the lifetime of the hook.
  const cfgRef = useRef<GovernorConfig | null>(null);
  if (cfgRef.current === null) {
    cfgRef.current = { ...DEFAULT_GOVERNOR_CONFIG, ...config };
  }
  const cfg = cfgRef.current;

  const stateRef = useRef<GovernorState | null>(null);
  if (stateRef.current === null) {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    stateRef.current = createGovernorState(
      cfg,
      qualityToLevel(initialQuality),
      now,
      loadPeaks(cfg.maxPeaks),
    );
  }
  const state = stateRef.current;

  const [output, setOutput] = useState<GovernorOutput>(() => currentOutput(state));
  const [peaks, setPeaks] = useState<PeakEvent[]>(() => state.peaks.slice());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let rafId = 0;
    let lastFrame = performance.now();
    let wasVisible = document.visibilityState === "visible";

    const tick = (now: number) => {
      const visible = document.visibilityState === "visible";

      if (visible && wasVisible) {
        recordFrame(state, now - lastFrame, now);
        const result = evaluateGovernor(state, now);
        if (result.changed) setOutput(result.output);
        if (result.peakAdded) {
          const snapshot = state.peaks.slice();
          setPeaks(snapshot);
          savePeaks(snapshot);
        }
      } else if (visible && !wasVisible) {
        // Tab just regained focus: the gap is not a real slow frame.
        resetWindow(state, now);
      }

      wasVisible = visible;
      lastFrame = now;
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    let observer: PerformanceObserver | null = null;
    if (typeof PerformanceObserver !== "undefined") {
      try {
        observer = new PerformanceObserver((list) => {
          if (document.visibilityState !== "visible") return;
          const now = performance.now();
          for (const entry of list.getEntries()) {
            recordLongTask(state, entry.duration, now);
          }
        });
        observer.observe({ type: "longtask", buffered: false });
      } catch {
        // longtask is not supported everywhere (Safari/Firefox); frame timing still works.
        observer = null;
      }
    }

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [enabled, state]);

  const clearPeaks = useCallback(() => {
    state.peaks = [];
    setPeaks([]);
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(PEAKS_STORAGE_KEY);
      } catch {
        // ignore storage errors
      }
    }
  }, [state]);

  return { ...output, peaks, clearPeaks };
}
