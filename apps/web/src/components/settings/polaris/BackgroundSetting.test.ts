import { describe, expect, it } from "vite-plus/test";

import { formatBytes } from "./BackgroundSetting";

describe("formatBytes", () => {
  it("reads like a file size", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(139_671)).toBe("136 KB");
    expect(formatBytes(2_610_465)).toBe("2.5 MB");
    expect(formatBytes(80 * 1024 * 1024)).toBe("80 MB");
  });
});
