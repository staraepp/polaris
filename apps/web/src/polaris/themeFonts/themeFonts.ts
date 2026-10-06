import type { ThemeFontOverrides } from "@t3tools/contracts";

/** Key for the stock look, which has no theme id of its own. */
export const DEFAULT_THEME_FONT_KEY = "default";

/**
 * The theme painting the window right now (Polaris): the half for the current
 * appearance when automatic mode mixes two themes, else the chosen theme.
 * The bare modes ("system", "light", "dark") are the stock look.
 */
export function activeThemeFontKey(
  theme: string,
  halves: { readonly light?: string; readonly dark?: string } | null,
  appearance: "light" | "dark",
): string {
  const id = halves?.[appearance] ?? theme;
  return id === "system" || id === "light" || id === "dark" || id.length === 0
    ? DEFAULT_THEME_FONT_KEY
    : id;
}

/** Global families with the active theme's overrides laid over them. */
export function fontsForTheme(
  globals: { readonly sans: string; readonly code: string },
  themeFonts: Readonly<Record<string, ThemeFontOverrides>>,
  key: string,
): { readonly sans: string; readonly code: string } {
  const overrides = themeFonts[key];
  return {
    sans: overrides?.sans?.trim() ? overrides.sans : globals.sans,
    code: overrides?.code?.trim() ? overrides.code : globals.code,
  };
}

/** The map with one theme's family set, or removed when empty. */
export function withThemeFont(
  themeFonts: Readonly<Record<string, ThemeFontOverrides>>,
  key: string,
  role: "sans" | "code",
  family: string,
): Record<string, ThemeFontOverrides> {
  const { [key]: current, ...rest } = themeFonts;
  const next = { ...current, [role]: family.trim() };
  const sans = next.sans ?? "";
  const code = next.code ?? "";
  if (sans.length === 0 && code.length === 0) return rest;
  return {
    ...rest,
    [key]: { ...(sans.length > 0 ? { sans } : {}), ...(code.length > 0 ? { code } : {}) },
  };
}
