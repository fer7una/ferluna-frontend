import { describe, expect, it } from "vitest";

import {
  applyVisualOrder,
  emptyDoc,
  emptySection,
  emptySectionItem,
  emptyTab,
  hasUnsavedChanges,
  nextCollectionOrder,
  normalizeOptionalText,
  prepareForSave,
  validateDoc,
} from "./document";

const section = (id: string) => ({
  ...emptySection(),
  id,
  route: id,
  label: id.toUpperCase(),
  eyebrow: "e",
  title: "t",
  description: "d",
});

describe("hasUnsavedChanges", () => {
  it("ignores cross-owner reordering of the flat item arrays", () => {
    const base = emptyDoc();
    base.sections = [section("a"), section("b")];
    base.sectionItems = [
      { ...emptySectionItem("a"), id: "a1" },
      { ...emptySectionItem("b"), id: "b1" },
    ];
    // Same content, but "a"'s slice moved to the end — exactly what
    // replaceSectionItems produces after editing an item in section "a".
    const reordered = {
      ...base,
      sectionItems: [
        { ...emptySectionItem("b"), id: "b1" },
        { ...emptySectionItem("a"), id: "a1" },
      ],
    };

    expect(hasUnsavedChanges(reordered, base)).toBe(false);
  });

  it("treats null and empty optional fields as equal", () => {
    const base = emptyDoc();
    base.sections = [section("a")];
    base.sectionItems = [{ ...emptySectionItem("a"), id: "a1", meta: null, href: null }];
    const edited = {
      ...base,
      sectionItems: [{ ...emptySectionItem("a"), id: "a1", meta: "", href: "  " }],
    };

    expect(hasUnsavedChanges(edited, base)).toBe(false);
  });

  it("still flags a real reorder within a single owner", () => {
    const base = emptyDoc();
    base.sections = [section("a")];
    base.sectionItems = [
      { ...emptySectionItem("a"), id: "a1" },
      { ...emptySectionItem("a"), id: "a2" },
    ];
    const swapped = {
      ...base,
      sectionItems: [
        { ...emptySectionItem("a"), id: "a2" },
        { ...emptySectionItem("a"), id: "a1" },
      ],
    };

    expect(hasUnsavedChanges(swapped, base)).toBe(true);
  });
});

describe("normalizeOptionalText", () => {
  it("treats null, undefined, empty and whitespace as null", () => {
    expect(normalizeOptionalText(null)).toBeNull();
    expect(normalizeOptionalText(undefined)).toBeNull();
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalText("   ")).toBeNull();
  });

  it("trims surrounding whitespace from real values", () => {
    expect(normalizeOptionalText("  hola  ")).toBe("hola");
  });
});

describe("admin content document rules", () => {
  it("assigns persistent order values from the visual collection order", () => {
    const items = [
      { ...emptySectionItem("work"), id: "second", order: 20 },
      { ...emptySectionItem("work"), id: "first", order: 10 },
    ];

    const reordered = applyVisualOrder(items);

    expect(reordered.map((item) => item.id)).toEqual(["second", "first"]);
    expect(reordered.map((item) => item.order)).toEqual([10, 20]);
  });

  it("uses the next available order for new collection items", () => {
    const items = [
      { ...emptySectionItem("work"), id: "first", order: 10 },
      { ...emptySectionItem("work"), id: "second", order: 30 },
    ];

    expect(nextCollectionOrder(items)).toBe(40);
    expect(nextCollectionOrder([])).toBe(10);
  });

  it("normalizes optional timestamps on sections, tabs and items before saving", () => {
    const doc = emptyDoc();
    doc.sections = [{ ...emptySection(), id: "work", route: "work", visibleFrom: "" as unknown as string }];
    doc.momentaryTabs = [{ ...emptyTab(), id: "now", label: "Now", visibleUntil: "  " as unknown as string }];
    doc.sectionItems = [
      { ...emptySectionItem("work"), id: "i", visibleFrom: "" as unknown as string, visibleUntil: "2026-06-03T12:00" },
    ];

    const saved = prepareForSave(doc);

    expect(saved.sections[0].visibleFrom).toBeNull();
    expect(saved.momentaryTabs[0].visibleUntil).toBeNull();
    expect(saved.sectionItems[0].visibleFrom).toBeNull();
    expect(saved.sectionItems[0].visibleUntil).toBe("2026-06-03T12:00");
  });


  it("normalizes optional item text and integer order before saving", () => {
    const doc = emptyDoc();
    doc.profile = {
      name: "Fernando",
      role: "Dev",
      tagline: "Tag",
      location: "ES",
      email: "a@b.c",
      avatarAlt: "Alt",
      links: [],
      highlights: [],
    };
    const section = { ...emptySection(), id: "work", route: "work", label: "Work", eyebrow: "Eyebrow", title: "Title", description: "Desc", order: 1.6 };
    doc.sections = [section];
    doc.sectionItems = [
      {
        ...emptySectionItem("work"),
        id: "item",
        kind: "card",
        kicker: "K",
        title: "T",
        description: "D",
        meta: "  Meta  ",
        href: "   ",
        order: 2.4,
      },
    ];

    const saved = prepareForSave(doc);

    expect(saved.sections[0].order).toBe(2);
    expect(saved.sectionItems[0].order).toBe(2);
    expect(saved.sectionItems[0].meta).toBe("Meta");
    expect(saved.sectionItems[0].href).toBeNull();
  });

  it("reports missing required fields and broken owner references", () => {
    const doc = emptyDoc();
    doc.profile.name = "Fernando";
    doc.sections = [{ ...emptySection(), id: "work", route: "work" }];
    doc.sectionItems = [{ ...emptySectionItem("missing"), id: "item" }];
    doc.momentaryTabs = [{ ...emptyTab(), id: "now", label: "Now" }];

    const errors = validateDoc(doc);

    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((message) => message.includes("missing"))).toBe(true);
  });
});
