import { describe, expect, it } from "vite-plus/test";

import { isSidebarUtilityPage } from "./mainAppLocation";

describe("isSidebarUtilityPage", () => {
  it("treats settings, usage, skills and pull requests as utility pages", () => {
    for (const path of [
      "/settings",
      "/settings/appearance",
      "/projects/abc",
      "/usage",
      "/skills",
      "/pull-requests",
    ]) {
      expect(isSidebarUtilityPage(path)).toBe(true);
    }
  });

  it("keeps the dashboard, home and threads in the main app", () => {
    for (const path of ["/", "/dashboard", "/env-1/thread-1"]) {
      expect(isSidebarUtilityPage(path)).toBe(false);
    }
  });
});
