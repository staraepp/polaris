import { THEME_COLOR_ROLES, type ThemeColors } from "@t3tools/shared/themePalettes";
import { describe, expect, it } from "vite-plus/test";

import { CALM_DARK, CALM_LIGHT } from "./calmPalette";

const luminance = (hex: string) => {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
};

describe.each([
  ["light", CALM_LIGHT],
  ["dark", CALM_DARK],
] as const)("the Calm palette (%s)", (_mode, colors: ThemeColors) => {
  it("fills every color role with a hex color", () => {
    for (const role of THEME_COLOR_ROLES) expect(colors[role]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps text at WCAG AA on its surfaces", () => {
    for (const [text, surface] of [
      ["text", "canvas"],
      ["text", "surfaceRaised"],
      ["mutedForeground", "canvas"],
      ["mutedForeground", "muted"],
      ["sidebarForeground", "sidebar"],
      ["sidebarMutedForeground", "sidebar"],
      ["messageForeground", "messageSurface"],
      ["messageActionForeground", "messageAction"],
      ["accentForeground", "accent"],
      ["codeForeground", "codeBackground"],
      // calm.css uses this as the link and "done" text color.
      ["updateForeground", "canvas"],
      ["updateForeground", "surface"],
    ] as const) {
      expect(
        contrast(colors[text], colors[surface]),
        `${text} on ${surface}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps placeholders and icons readable (3:1)", () => {
    expect(contrast(colors.placeholder, colors.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(colors.iconMuted, colors.canvas)).toBeGreaterThanOrEqual(3);
  });
});
