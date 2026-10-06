import type { ServerProviderUsageWindow } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { tightestWindow } from "./UsageTile";

const session: ServerProviderUsageWindow = {
  id: "five_hour",
  kind: "session",
  label: "Session",
  usedPercent: 39,
  windowDurationMins: 300,
};
const weekly: ServerProviderUsageWindow = {
  id: "seven_day",
  kind: "weekly",
  label: "Weekly",
  usedPercent: 29,
  windowDurationMins: 10_080,
};

describe("tightestWindow (Calm mode's one bar per provider)", () => {
  it("picks the window with the least left", () => {
    expect(tightestWindow([weekly, session])).toBe(session);
    expect(tightestWindow([{ ...weekly, usedPercent: 90 }, session])?.id).toBe("seven_day");
  });

  it("keeps the first of equal windows and handles none", () => {
    expect(tightestWindow([session, { ...weekly, usedPercent: 39 }])).toBe(session);
    expect(tightestWindow([])).toBeNull();
  });
});
