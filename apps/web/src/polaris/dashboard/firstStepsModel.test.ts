import { describe, expect, it } from "vite-plus/test";

import { firstStepsProgress } from "./firstStepsModel";

const none = {
  hasProject: false,
  hasThread: false,
  paletteOpened: false,
  dashboardCustomized: false,
  lookChanged: false,
} as const;

describe("firstStepsProgress", () => {
  it("starts at adding a project", () => {
    const progress = firstStepsProgress(none);
    expect(progress.done.size).toBe(0);
    expect(progress.next).toBe("project");
    expect(progress.complete).toBe(false);
  });

  it("points at the first open step, in order, even when later ones are done", () => {
    const progress = firstStepsProgress({ ...none, hasProject: true, lookChanged: true });
    expect([...progress.done]).toEqual(["project", "look"]);
    expect(progress.next).toBe("thread");
  });

  it("is complete when every signal is true", () => {
    const progress = firstStepsProgress({
      hasProject: true,
      hasThread: true,
      paletteOpened: true,
      dashboardCustomized: true,
      lookChanged: true,
    });
    expect(progress).toMatchObject({ next: null, complete: true });
  });
});
