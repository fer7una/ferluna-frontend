import { describe, expect, it } from "vitest";

import { contentItemToCardViewModel } from "./cards";
import type { ContentItem } from "../../types";

const baseItem: ContentItem = {
  id: "item-1",
  kind: "project",
  kicker: "Producto",
  title: "Portal solar",
  meta: null,
  description: "Descripción",
  href: null,
  tags: ["React"],
  iconKey: "globe",
  order: 1,
  visibleFrom: null,
  visibleUntil: null,
  featured: false,
};

describe("contentItemToCardViewModel", () => {
  it("maps generic content into a stable card view model", () => {
    expect(contentItemToCardViewModel(baseItem)).toEqual({
      id: "item-1",
      kicker: "Producto",
      title: "Portal solar",
      meta: undefined,
      description: "Descripción",
      tags: ["React"],
      action: undefined,
      iconKey: "globe",
    });
  });

  it("formats post ISO dates and uses the read action label", () => {
    const card = contentItemToCardViewModel({
      ...baseItem,
      kind: "post",
      kicker: "2026-06-04",
      href: "https://example.com/post",
      meta: "Artículo",
    });

    expect(card.kicker).toContain("2026");
    expect(card.meta).toBe("Artículo");
    expect(card.action).toEqual({
      label: "Leer",
      href: "https://example.com/post",
    });
  });
});
