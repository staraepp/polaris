import { describe, expect, it } from "vite-plus/test";

import {
  dashboardTileSpan,
  DASHBOARD_TILE_IDS,
  isDefaultTileOrder,
  moveTile,
  normalizeTileOrder,
} from "./dashboardLayout";

describe("dashboard layout", () => {
  it("repairs a stored order: drops strangers and repeats, appends new tiles", () => {
    expect(normalizeTileOrder([])).toEqual(DASHBOARD_TILE_IDS);
    expect(normalizeTileOrder(["usage", "ghost", "usage", "start"])).toEqual([
      "usage",
      "start",
      "threads",
      "pullRequests",
      "activity",
    ]);
  });

  it("moves a tile and clamps the target", () => {
    const order = normalizeTileOrder([]);
    expect(moveTile(order, "activity", 0)[0]).toBe("activity");
    expect(moveTile(order, "start", 99).at(-1)).toBe("start");
    expect(moveTile(order, "threads", -3)[0]).toBe("threads");
    expect(isDefaultTileOrder(order)).toBe(true);
    expect(isDefaultTileOrder(moveTile(order, "usage", 0))).toBe(false);
  });

  it("only lets the threads tile run two rows when it has rows to fill them", () => {
    expect(dashboardTileSpan("threads", 2)).not.toContain("row-span-2");
    expect(dashboardTileSpan("activity", 2)).toBe("lg:col-span-6");
    expect(dashboardTileSpan("threads", 8)).toContain("row-span-2");
    expect(dashboardTileSpan("activity", 8)).toBe("lg:col-span-3");
  });
});
