import type { MomentaryTab, SectionId, SiteSection } from "./types";

export type VisibilityWindow = {
  enabled?: boolean;
  visibleFrom?: string | null;
  visibleUntil?: string | null;
};

export function pathSegment(pathname: string): string {
  return pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
}

export function sectionFromPathname(pathname: string, sections: SiteSection[]): SectionId | null {
  const segment = pathSegment(pathname);
  const section = sections.find((item) => item.route === segment);
  return section?.id ?? null;
}

export function momentFromPathname(pathname: string, tabs: MomentaryTab[]): string | null {
  const segment = pathSegment(pathname);
  const moment = tabs.find((item) => item.id === segment);
  return moment?.id ?? null;
}

export function isVisibleNow(item: VisibilityWindow, now = Date.now()) {
  if (item.enabled === false) {
    return false;
  }

  const visibleFrom = item.visibleFrom ? Date.parse(item.visibleFrom) : null;
  const visibleUntil = item.visibleUntil ? Date.parse(item.visibleUntil) : null;

  if (visibleFrom !== null && Number.isFinite(visibleFrom) && now < visibleFrom) {
    return false;
  }

  if (visibleUntil !== null && Number.isFinite(visibleUntil) && now >= visibleUntil) {
    return false;
  }

  return true;
}

export function sortByOrder<T extends { order: number; id: string }>(items: T[]) {
  return [...items].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}
