import { describe, expect, it } from "vite-plus/test";

import {
  AA_TEXT_CONTRAST,
  blend,
  cellsFromPixels,
  contrastFloorPercent,
  contrastRatio,
  type Rgb,
  UI_TEXT_CONTRAST,
} from "./backgroundContrast";

const white: Rgb = [255, 255, 255];
const black: Rgb = [0, 0, 0];

describe("contrast math", () => {
  it("matches WCAG's extremes", () => {
    expect(contrastRatio(white, black)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it("blends the scrim over the picture like CSS opacity", () => {
    expect(blend(white, black, 0.6)).toEqual([153, 153, 153]);
  });
});

describe("contrastFloorPercent", () => {
  const darkPage: Rgb = [10, 10, 10];
  const dark = [
    { text: [245, 245, 245] as Rgb, target: AA_TEXT_CONTRAST },
    { text: [129, 129, 129] as Rgb, target: UI_TEXT_CONTRAST },
  ];
  const lightPage: Rgb = [252, 252, 252];
  const light = [
    { text: [39, 39, 42] as Rgb, target: AA_TEXT_CONTRAST },
    { text: [113, 113, 123] as Rgb, target: UI_TEXT_CONTRAST },
  ];
  const sky: Rgb = [245, 240, 230];
  const ground: Rgb = [30, 40, 30];

  it("needs no floor when the picture already matches the page", () => {
    expect(contrastFloorPercent([darkPage], darkPage, dark)).toBe(0);
  });

  it("raises the floor for a bright sky in dark mode and dark ground in light mode", () => {
    const darkFloor = contrastFloorPercent([sky, ground], darkPage, dark);
    const lightFloor = contrastFloorPercent([sky, ground], lightPage, light);
    expect(darkFloor).toBeGreaterThan(40);
    expect(lightFloor).toBeGreaterThan(40);
    expect(darkFloor).toBeLessThan(95);
    expect(darkFloor % 5).toBe(0);
    // At the floor, every cell meets every target.
    for (const cell of [sky, ground]) {
      const under = blend(darkPage, cell, darkFloor / 100);
      for (const { text, target } of dark) {
        expect(contrastRatio(text, under)).toBeGreaterThanOrEqual(target);
      }
    }
  });

  it("returns 100 when even the plain page color fails, and 0 with nothing to check", () => {
    expect(
      contrastFloorPercent([white], [200, 200, 200], [{ text: white, target: AA_TEXT_CONTRAST }]),
    ).toBe(100);
    expect(contrastFloorPercent([], darkPage, dark)).toBe(0);
    expect(contrastFloorPercent([sky], darkPage, [])).toBe(0);
  });
});

describe("cellsFromPixels", () => {
  it("reads RGBA quads and skips transparent pixels", () => {
    expect(cellsFromPixels([1, 2, 3, 255, 9, 9, 9, 0, 4, 5, 6, 200])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });
});
