import { describe, expect, it } from "vite-plus/test";

import { colorPalettes, generateBeamCSS, resolvePalette, toRgbColor } from "./styles";
import type { BorderBeamSize } from "./types";

const baseOptions = {
  id: "t",
  borderRadius: 16,
  borderWidth: 1,
  duration: 2,
  strokeOpacity: 0.3,
  innerOpacity: 0.4,
  bloomOpacity: 0.3,
  innerShadow: "transparent",
  colorVariant: "colorful",
  staticColors: true,
  brightness: 1.3,
  saturation: 1.2,
  hueRange: 30,
  theme: "dark",
} as const;

describe("toRgbColor", () => {
  it("reads short and long hex and rgb()", () => {
    expect(toRgbColor("#F5C542")).toBe("rgb(245, 197, 66)");
    expect(toRgbColor("#fff")).toBe("rgb(255, 255, 255)");
    expect(toRgbColor(" rgb(1, 2, 3) ")).toBe("rgb(1, 2, 3)");
  });

  it("rejects anything else", () => {
    expect(toRgbColor("oklch(0.7 0.1 200)")).toBeNull();
    expect(toRgbColor("#12345")).toBeNull();
    expect(toRgbColor("gold")).toBeNull();
  });
});

describe("resolvePalette", () => {
  it("keeps the variant's palette without colors", () => {
    expect(resolvePalette("ocean", undefined)).toBe(colorPalettes.ocean);
    expect(resolvePalette("ocean", ["nope"])).toBe(colorPalettes.ocean);
  });

  it("cycles custom colors over the variant's blobs and keeps their geometry", () => {
    const palette = resolvePalette("colorful", ["#ff0000", "#00ff00"]);
    expect(palette.border).toHaveLength(colorPalettes.colorful.border.length);
    expect(palette.border.map((blob) => blob.color).slice(0, 3)).toEqual([
      "rgb(255, 0, 0)",
      "rgb(0, 255, 0)",
      "rgb(255, 0, 0)",
    ]);
    expect(palette.border[4]?.pos).toBe(colorPalettes.colorful.border[4]?.pos);
    expect(palette.spike).toEqual({ primary: "rgb(255, 0, 0)", secondary: "rgb(0, 255, 0)" });
  });
});

describe("generateBeamCSS", () => {
  it("paints md and the pulse sizes with the custom colors", () => {
    for (const size of ["md", "pulse-inner", "pulse-outside"] as const) {
      const css = generateBeamCSS({ ...baseOptions, size, colors: ["#F5C542"] });
      expect(css).toContain("245, 197, 66");
      expect(css).not.toContain("255, 50, 100");
    }
  });

  it("holds every size still under reduced motion but keeps the fade", () => {
    const sizes: BorderBeamSize[] = ["sm", "md", "line", "pulse-inner", "pulse-outside"];
    for (const size of sizes) {
      const css = generateBeamCSS({ ...baseOptions, size });
      const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
      expect(reduced, size).toContain("animation: beam-fade-in-t 0.6s ease forwards !important");
      expect(reduced, size).toContain("animation: beam-fade-out-t 0.5s ease forwards !important");
      expect(reduced, size).toContain("animation: none !important");
    }
  });
});
