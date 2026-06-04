export type LayoutMode = "hub" | "section";

export type OrbPhase =
  | "hub"
  | "gliding-to-section"
  | "rail"
  | "preparing-hub-glide"
  | "gliding-to-hub";

export const SECTION_EXIT_MS = 460;
export const ORBIT_GLIDE_MS = 860;
export const ORBIT_HOVER_PLAYBACK_RATE = 0.5;
export const CAROUSEL_ROTATE_MS = 5200;
export const SCROLL_SHADOW_TOLERANCE_PX = 2;
export const LAYOUT_SETTLE_REMEASURE_MS = 80;

export const ORB_SECTION_PHASES: readonly OrbPhase[] = [
  "gliding-to-section",
  "rail",
  "preparing-hub-glide",
];

export const PORTAL_LABELS = {
  brandHome: "Fernando Luna inicio",
  defaultOrb: "Portal de Fernando Luna",
  momentaryEyebrow: "Pestaña momentánea",
  momentaryTabsNav: "pestañas momentáneas",
  sectionTabsNav: "Secciones del portal",
  returnHome: "Volver al inicio",
} as const;
