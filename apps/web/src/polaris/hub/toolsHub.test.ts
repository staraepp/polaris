// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vite-plus/test";

import { lastTool, rememberTool, toolForPath } from "./toolsHub";

describe("tools hub", () => {
  afterEach(() => localStorage.clear());

  it("maps the tool routes and nothing else", () => {
    expect(toolForPath("/skills")).toBe("skills");
    expect(toolForPath("/import")).toBe("import");
    expect(toolForPath("/usage")).toBe("usage");
    expect(toolForPath("/pull-requests")).toBe("pull-requests");
    expect(toolForPath("/dashboard")).toBeNull();
    expect(toolForPath("/settings/general")).toBeNull();
  });

  it("reopens the last tool, falling back to Skills", () => {
    expect(lastTool(() => true)).toBe("skills");
    rememberTool("usage");
    expect(lastTool(() => true)).toBe("usage");
    localStorage.setItem("polaris:tools-last:v1", "nonsense");
    expect(lastTool(() => true)).toBe("skills");
  });

  it("skips a remembered tool that is not available", () => {
    rememberTool("pull-requests");
    expect(lastTool((tool) => tool !== "pull-requests")).toBe("skills");
  });
});
