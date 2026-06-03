import { describe, expect, it } from "vitest";

import {
  isVisibleNow,
  momentFromPathname,
  pathSegment,
  sectionFromPathname,
  sortByOrder,
} from "./selectors";
import type { MomentaryTab, SiteSection } from "./types";

const sections: SiteSection[] = [
  {
    id: "projects",
    route: "proyectos",
    label: "Proyectos",
    eyebrow: "Work",
    title: "Projects",
    description: "Project list",
    iconKey: "globe",
    angle: 0,
    order: 20,
    visibleFrom: null,
    visibleUntil: null,
    enabled: true,
  },
];

const tabs: MomentaryTab[] = [
  {
    id: "now",
    label: "Now",
    iconKey: "globe",
    angle: 0,
    order: 10,
    visibleFrom: null,
    visibleUntil: null,
    enabled: true,
  },
];

describe("site selectors", () => {
  it("extracts the first route segment", () => {
    expect(pathSegment("/proyectos/detail")).toBe("proyectos");
    expect(pathSegment("///now///")).toBe("now");
  });

  it("resolves sections and momentary tabs from the current path", () => {
    expect(sectionFromPathname("/proyectos", sections)).toBe("projects");
    expect(sectionFromPathname("/missing", sections)).toBeNull();
    expect(momentFromPathname("/now", tabs)).toBe("now");
    expect(momentFromPathname("/missing", tabs)).toBeNull();
  });

  it("filters disabled and scheduled content using the provided clock", () => {
    const now = Date.parse("2026-06-03T12:00:00Z");

    expect(isVisibleNow({ enabled: true, visibleFrom: null, visibleUntil: null }, now)).toBe(true);
    expect(isVisibleNow({ enabled: false, visibleFrom: null, visibleUntil: null }, now)).toBe(false);
    expect(isVisibleNow({ visibleFrom: "2026-06-04T00:00:00Z" }, now)).toBe(false);
    expect(isVisibleNow({ visibleUntil: "2026-06-03T12:00:00Z" }, now)).toBe(false);
  });

  it("sorts by order and then id without mutating the original list", () => {
    const original = [
      { id: "b", order: 2 },
      { id: "c", order: 1 },
      { id: "a", order: 1 },
    ];

    expect(sortByOrder(original).map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(original.map((item) => item.id)).toEqual(["b", "c", "a"]);
  });
});
