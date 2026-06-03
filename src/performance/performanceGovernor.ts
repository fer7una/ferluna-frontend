import type { SunEffectQuality } from "../components/SunEffect/SunEffect.types";

// Pure, DOM-free performance governor.
//
// It watches frame times and long-task density and steps the render quality
// DOWN when the machine is sustainedly saturated. Recovery is intentionally
// sticky for the session (no automatic upgrades): once degraded, it stays put
// until the page is reloaded. All timing inputs are passed in by the caller so
// this module is deterministic and can be exercised without a browser.

export type GovernorOutput = {
  quality: SunEffectQuality;
  webglEnabled: boolean;
};

// Level ladder, lowest first. Level 0 disables WebGL (CSS fallback); the
// `quality` there is irrelevant because the canvas is not mounted.
export const GOVERNOR_LEVELS: GovernorOutput[] = [
  { quality: "low", webglEnabled: false }, // 0: WebGL off
  { quality: "low", webglEnabled: true }, // 1
  { quality: "medium", webglEnabled: true }, // 2
  { quality: "high", webglEnabled: true }, // 3
  { quality: "ultra", webglEnabled: true }, // 4
];

export function qualityToLevel(quality: SunEffectQuality): number {
  switch (quality) {
    case "ultra":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

export type GovernorConfig = {
  /** Rolling window kept for statistics, in ms. */
  windowMs: number;
  /** Minimum gap between heavy evaluations, in ms. */
  evalIntervalMs: number;
  /** Minimum frame samples before any decision is taken. */
  minSamples: number;
  /** Frame time (ms) at or above which a frame counts as saturated. */
  slowFrameMs: number;
  /** How long saturation must persist before stepping down, in ms. */
  sustainMs: number;
  /** Minimum gap between two downgrades, in ms. */
  cooldownMs: number;
  /** Measurements within this window after (re)start are ignored, in ms. */
  warmupMs: number;
  /** Frame deltas above this are discarded as stalls / tab switches, in ms. */
  maxFrameMs: number;
  /** Cumulative long-task time within the window that counts as saturation, in ms. */
  longTaskBurstMs: number;
  /** Maximum number of peak events retained in the log. */
  maxPeaks: number;
};

export const DEFAULT_GOVERNOR_CONFIG: GovernorConfig = {
  windowMs: 2000,
  evalIntervalMs: 250,
  minSamples: 8,
  slowFrameMs: 32, // ~31 fps
  sustainMs: 2000,
  cooldownMs: 4000,
  warmupMs: 2000,
  maxFrameMs: 500,
  longTaskBurstMs: 600,
  maxPeaks: 50,
};

export type PeakKind = "spike" | "downgrade";

export type PeakEvent = {
  /** Wall-clock timestamp (Date.now) for the human-readable log. */
  at: number;
  kind: PeakKind;
  /** Approximate FPS at detection (derived from the p95 frame time). */
  fps: number;
  p95FrameMs: number;
  longTaskMs: number;
  reason: string;
  qualityBefore?: SunEffectQuality;
  qualityAfter?: SunEffectQuality;
  webglEnabledAfter?: boolean;
};

type Sample = { t: number; d: number };

export type GovernorState = {
  config: GovernorConfig;
  level: number;
  frames: Sample[];
  longTasks: Sample[];
  slowSince: number | null;
  startedAt: number;
  lastChangeAt: number;
  lastEvalAt: number;
  peaks: PeakEvent[];
};

export type EvaluateResult = {
  changed: boolean;
  peakAdded: boolean;
  output: GovernorOutput;
};

export function createGovernorState(
  config: GovernorConfig,
  startLevel: number,
  nowPerf: number,
  initialPeaks: PeakEvent[] = [],
): GovernorState {
  const level = clampLevel(startLevel);
  return {
    config,
    level,
    frames: [],
    longTasks: [],
    slowSince: null,
    startedAt: nowPerf,
    // Negative so the first downgrade is not blocked by the cooldown.
    lastChangeAt: nowPerf - config.cooldownMs,
    lastEvalAt: nowPerf,
    peaks: initialPeaks.slice(-config.maxPeaks),
  };
}

export function currentOutput(state: GovernorState): GovernorOutput {
  return GOVERNOR_LEVELS[state.level];
}

/** Record one rendered frame. Cheap; called every animation frame. */
export function recordFrame(state: GovernorState, deltaMs: number, nowPerf: number): void {
  if (deltaMs <= 0 || deltaMs > state.config.maxFrameMs) return;
  state.frames.push({ t: nowPerf, d: deltaMs });
}

/** Record one long task reported by PerformanceObserver. */
export function recordLongTask(state: GovernorState, durationMs: number, nowPerf: number): void {
  if (durationMs <= 0) return;
  state.longTasks.push({ t: nowPerf, d: durationMs });
}

/** Drop measurements and restart the warm-up window (e.g. on tab resume). */
export function resetWindow(state: GovernorState, nowPerf: number): void {
  state.frames = [];
  state.longTasks = [];
  state.slowSince = null;
  state.startedAt = nowPerf;
  state.lastEvalAt = nowPerf;
}

/**
 * Decide whether to step quality down. Mutates `state`. Returns whether the
 * output level changed and whether a new peak was logged. Heavy work is gated
 * by `evalIntervalMs`, so calling this every frame is fine.
 */
export function evaluateGovernor(state: GovernorState, nowPerf: number): EvaluateResult {
  const cfg = state.config;
  const noChange: EvaluateResult = { changed: false, peakAdded: false, output: currentOutput(state) };

  if (nowPerf - state.lastEvalAt < cfg.evalIntervalMs) return noChange;
  state.lastEvalAt = nowPerf;

  const cutoff = nowPerf - cfg.windowMs;
  state.frames = state.frames.filter((f) => f.t >= cutoff);
  state.longTasks = state.longTasks.filter((l) => l.t >= cutoff);

  // Not enough data yet, or still warming up after a (re)start.
  if (state.frames.length < cfg.minSamples || nowPerf - state.startedAt < cfg.warmupMs) {
    state.slowSince = null;
    return noChange;
  }

  const p95FrameMs = percentile(state.frames.map((f) => f.d), 95);
  const longTaskMs = state.longTasks.reduce((sum, l) => sum + l.d, 0);
  const fps = p95FrameMs > 0 ? Math.round(1000 / p95FrameMs) : 60;
  const saturated = p95FrameMs >= cfg.slowFrameMs || longTaskMs >= cfg.longTaskBurstMs;

  if (!saturated) {
    state.slowSince = null;
    return noChange;
  }

  let peakAdded = false;

  // Rising edge: log the saturation peak even if it recovers before sustainMs.
  if (state.slowSince === null) {
    state.slowSince = nowPerf;
    pushPeak(state, {
      at: Date.now(),
      kind: "spike",
      fps,
      p95FrameMs: round1(p95FrameMs),
      longTaskMs: Math.round(longTaskMs),
      reason: p95FrameMs >= cfg.slowFrameMs ? "frame-time" : "long-task",
    });
    peakAdded = true;
  }

  const sustainedFor = nowPerf - state.slowSince;
  const cooledDown = nowPerf - state.lastChangeAt >= cfg.cooldownMs;

  if (sustainedFor >= cfg.sustainMs && cooledDown && state.level > 0) {
    const before = GOVERNOR_LEVELS[state.level];
    state.level = clampLevel(state.level - 1);
    const after = GOVERNOR_LEVELS[state.level];

    pushPeak(state, {
      at: Date.now(),
      kind: "downgrade",
      fps,
      p95FrameMs: round1(p95FrameMs),
      longTaskMs: Math.round(longTaskMs),
      reason: p95FrameMs >= cfg.slowFrameMs ? "frame-time" : "long-task",
      qualityBefore: before.quality,
      qualityAfter: after.quality,
      webglEnabledAfter: after.webglEnabled,
    });

    state.lastChangeAt = nowPerf;
    // Re-measure cleanly at the new level (cooldown + fresh warm-up).
    resetWindow(state, nowPerf);

    return { changed: true, peakAdded: true, output: after };
  }

  return { changed: false, peakAdded, output: currentOutput(state) };
}

function pushPeak(state: GovernorState, peak: PeakEvent): void {
  state.peaks.push(peak);
  if (state.peaks.length > state.config.maxPeaks) state.peaks.shift();
}

function clampLevel(level: number): number {
  if (level < 0) return 0;
  const max = GOVERNOR_LEVELS.length - 1;
  return level > max ? max : Math.floor(level);
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(rank)));
  return sorted[idx];
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
