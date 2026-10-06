import { describe, expect, it } from "vite-plus/test";

import {
  composerRectInCanvas,
  FLAME_FRAGMENT_SHADER,
  FLAME_MARGIN,
  FLAME_QUALITY,
  pickFlameQuality,
} from "./flameShader";

describe("the keyword flames", () => {
  it("keeps high quality unless frames come slower than about 45 fps", () => {
    expect(pickFlameQuality([])).toBe(FLAME_QUALITY.high);
    expect(pickFlameQuality([16.7, 16.6, 17, 16.8, 120])).toBe(FLAME_QUALITY.high);
    expect(pickFlameQuality([33, 34, 33.4, 16, 35])).toBe(FLAME_QUALITY.low);
  });

  it("places the composer inside the canvas by the margins, y up", () => {
    expect(composerRectInCanvas(800, 200)).toEqual([
      FLAME_MARGIN.side,
      FLAME_MARGIN.bottom,
      800 - FLAME_MARGIN.side,
      200 - FLAME_MARGIN.top,
    ]);
    // Never inverted, even for a canvas smaller than its margins.
    const [x0, y0, x1, y1] = composerRectInCanvas(10, 10);
    expect(x1).toBeGreaterThanOrEqual(x0);
    expect(y1).toBeGreaterThanOrEqual(y0);
  });

  it("avoids identifiers GLSL ES 1.00 reserves", () => {
    expect(FLAME_FRAGMENT_SHADER).not.toMatch(/\b(half|fixed|input|output|sampler3DRect)\b/);
  });
});
