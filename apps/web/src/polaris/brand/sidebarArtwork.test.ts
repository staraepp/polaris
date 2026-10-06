import { describe, expect, it } from "vite-plus/test";

import { resolveSidebarArtworkVariant } from "./sidebarArtwork";

describe("resolveSidebarArtworkVariant", () => {
  it("keeps the Dev and Nightly art", () => {
    expect(resolveSidebarArtworkVariant("nightly", false)).toBe("nightly");
    expect(resolveSidebarArtworkVariant("dev", true)).toBe("dev");
  });

  it("draws the blueprint on regular builds while the setting is on", () => {
    expect(resolveSidebarArtworkVariant(null, true)).toBe("dev");
    expect(resolveSidebarArtworkVariant(null, false)).toBeNull();
  });
});
