import { describe, expect, it } from "vitest";

import { emptyDoc, emptySection, emptySectionItem, emptyTab, prepareForSave, validateDoc } from "./document";

describe("admin content document rules", () => {
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
