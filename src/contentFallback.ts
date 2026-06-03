import type { SiteData } from "./types";

// Minimal emergency fallback. The database is the single source of truth for
// all content; this only keeps the site from breaking when the API is
// unreachable. It intentionally carries no section/tab content.
export const fallbackSiteData: SiteData = {
  profile: {
    name: "Fernando Luna",
    role: "Desarrollador y creador de soluciones digitales",
    tagline: "Construyo software claro, documentación útil y experiencias web con intención.",
    location: "España",
    email: "hola@fernandoluna.dev",
    avatarAlt: "Retrato de Fernando Luna en una esfera de cristal",
    links: [],
    highlights: [],
  },
  visualSettings: {
    sectionOrbitDurationSeconds: 34,
    momentaryOrbitDurationSeconds: 18,
  },
  sections: [],
  sectionItems: [],
  momentaryTabs: [],
  momentaryItems: [],
  revision: 0,
};
