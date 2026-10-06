import { describe, expect, it } from "vite-plus/test";

import { activeThemeFontKey, fontsForTheme, withThemeFont } from "./themeFonts";

describe("theme fonts", () => {
  it("finds the theme painting the window", () => {
    expect(activeThemeFontKey("grove", null, "dark")).toBe("grove");
    expect(activeThemeFontKey("system", { light: "ocean", dark: "ember" }, "dark")).toBe("ember");
    expect(activeThemeFontKey("system", { dark: "ember" }, "light")).toBe("default");
    expect(activeThemeFontKey("dark", null, "dark")).toBe("default");
  });

  it("lays the active theme's fonts over the global ones", () => {
    const globals = { sans: "", code: "Menlo" };
    const themeFonts = { grove: { sans: "Inter" }, ember: { code: "  " } };
    expect(fontsForTheme(globals, themeFonts, "grove")).toEqual({ sans: "Inter", code: "Menlo" });
    expect(fontsForTheme(globals, themeFonts, "ember")).toEqual(globals);
    expect(fontsForTheme(globals, themeFonts, "default")).toEqual(globals);
  });

  it("sets and clears one family without touching other themes", () => {
    const start = { grove: { sans: "Inter" }, ocean: { code: "Fira Code" } };
    expect(withThemeFont(start, "grove", "code", "JetBrains Mono")).toEqual({
      grove: { sans: "Inter", code: "JetBrains Mono" },
      ocean: { code: "Fira Code" },
    });
    expect(withThemeFont(start, "grove", "sans", "")).toEqual({ ocean: { code: "Fira Code" } });
  });
});
