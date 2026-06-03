import { describe, expect, it } from "vitest";

import { fallbackSiteData, normalizeSiteData, normalizeVisualSettings } from "./siteApi";

describe("siteApi normalization", () => {
  it("fills missing site blocks from fallback data", () => {
    const normalized = normalizeSiteData({});

    expect(normalized.profile).toBe(fallbackSiteData.profile);
    expect(normalized.sections).toBe(fallbackSiteData.sections);
    expect(normalized.revision).toBe(0);
  });

  it("keeps positive visual settings and falls back for invalid values", () => {
    expect(
      normalizeVisualSettings({
        sectionOrbitDurationSeconds: 11,
        momentaryOrbitDurationSeconds: 7,
      }),
    ).toEqual({
      sectionOrbitDurationSeconds: 11,
      momentaryOrbitDurationSeconds: 7,
    });

    expect(
      normalizeVisualSettings({
        sectionOrbitDurationSeconds: 0,
        momentaryOrbitDurationSeconds: Number.NaN,
      }),
    ).toEqual(fallbackSiteData.visualSettings);
  });
});
