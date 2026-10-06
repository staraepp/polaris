import { describe, expect, it } from "vite-plus/test";

import { parseDevFxOverride } from "./devFxOverride";

describe("parseDevFxOverride", () => {
  it("keeps known flags and tiers", () => {
    expect(parseDevFxOverride('{"running":true,"tier":"max","quotaLow":false}')).toEqual({
      running: true,
      tier: "max",
      quotaLow: false,
    });
    expect(parseDevFxOverride('{"running":true,"keywordRun":true}')).toEqual({
      running: true,
      keywordRun: true,
    });
  });

  it("drops unknown fields, wrong types and junk", () => {
    expect(parseDevFxOverride('{"running":"yes","tier":"ultra","x":1}')).toBeNull();
    expect(parseDevFxOverride("not json")).toBeNull();
    expect(parseDevFxOverride("[1]")).toBeNull();
    expect(parseDevFxOverride(null)).toBeNull();
    expect(parseDevFxOverride("")).toBeNull();
  });
});
