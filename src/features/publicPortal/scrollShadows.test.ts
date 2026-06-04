import { describe, expect, it } from "vitest";

import { measureVerticalScrollShadows, scrollShadowClassNames } from "./scrollShadows";

function mockScrollElement({
  clientHeight,
  scrollHeight,
  scrollTop,
}: {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}) {
  return {
    clientHeight,
    scrollHeight,
    scrollTop,
  } as HTMLElement;
}

describe("scroll shadow helpers", () => {
  it("measures top and bottom overflow with tolerance", () => {
    expect(
      measureVerticalScrollShadows(
        mockScrollElement({ clientHeight: 100, scrollHeight: 240, scrollTop: 50 }),
      ),
    ).toEqual({
      down: true,
      measured: true,
      overflow: true,
      up: true,
    });
  });

  it("does not show shadows when content fits", () => {
    expect(
      measureVerticalScrollShadows(
        mockScrollElement({ clientHeight: 100, scrollHeight: 101, scrollTop: 0 }),
      ),
    ).toEqual({
      down: false,
      measured: true,
      overflow: false,
      up: false,
    });
  });

  it("builds stable scroll shadow class names", () => {
    expect(scrollShadowClassNames("panel-scroll", { down: true, up: false })).toBe(
      "panel-scroll can-scroll-down",
    );
  });
});
