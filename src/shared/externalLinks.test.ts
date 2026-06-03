import { describe, expect, it } from "vitest";

import { externalLinkProps } from "./externalLinks";

describe("externalLinkProps", () => {
  it("opens http and protocol-relative links in a new tab", () => {
    expect(externalLinkProps("https://example.com")).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
    expect(externalLinkProps("//cdn.example.com/file")).toEqual({
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("keeps relative, hash, and mail links in the current tab", () => {
    expect(externalLinkProps("/cv")).toEqual({});
    expect(externalLinkProps("#top")).toEqual({});
    expect(externalLinkProps("mailto:test@example.com")).toEqual({});
  });
});
