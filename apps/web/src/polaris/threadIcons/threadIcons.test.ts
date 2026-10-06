import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { setThreadIcon, StoredThreadIcons } from "./threadIcons";

describe("thread icons", () => {
  const key = "env-1:thread-9";

  it("sets, replaces and clears an icon without touching others", () => {
    const other = { kind: "emoji", emoji: "📚" } as const;
    let icons = setThreadIcon({ "env-1/a": other }, key, {
      kind: "lucide",
      name: "bug",
      color: "red",
    });
    expect(icons[key]).toEqual({ kind: "lucide", name: "bug", color: "red" });
    icons = setThreadIcon(icons, key, { kind: "monogram", text: "UI", color: "sky" });
    expect(icons[key]).toMatchObject({ kind: "monogram" });
    icons = setThreadIcon(icons, key, null);
    expect(icons).toEqual({ "env-1/a": other });
    expect(setThreadIcon(icons, "missing", null)).toBe(icons);
  });

  it("decodes only valid stored icons", () => {
    const decode = Schema.decodeUnknownSync(StoredThreadIcons);
    expect(decode({ [key]: { kind: "lucide", name: "rocket", color: "teal" } })).toBeTruthy();
    expect(() =>
      decode({ [key]: { kind: "lucide", name: "Not A Name", color: "teal" } }),
    ).toThrow();
  });
});
