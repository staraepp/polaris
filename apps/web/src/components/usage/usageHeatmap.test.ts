import type { DailyTotals } from "@t3tools/shared/usageMerge";
import { describe, expect, it } from "vite-plus/test";

import {
  buildHeatmap,
  formatDayLong,
  levelsForValues,
  projectMonthCost,
  type HeatmapCell,
} from "./usageHeatmap";

const day = (date: string, costUsd: number, totalTokens = 0): DailyTotals => ({
  day: date,
  costUsd,
  totalTokens,
  byProvider: new Map(),
});

const cellsOf = (model: ReturnType<typeof buildHeatmap>): readonly HeatmapCell[] =>
  model.weeks.flat().filter((cell): cell is HeatmapCell => cell !== null);

describe("buildHeatmap layout", () => {
  it("pads the first week up to the weekday the window starts on", () => {
    // 2026-01-01 is a Thursday, so Sunday to Wednesday are padding.
    const model = buildHeatmap({
      sinceDay: "2026-01-01",
      untilDay: "2026-01-10",
      daily: [],
      metric: "cost",
    });
    expect(model.weeks).toHaveLength(2);
    expect(model.weeks[0]?.map((cell) => cell?.day ?? null)).toEqual([
      null,
      null,
      null,
      null,
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
    ]);
    // The last week is padded after the final day (2026-01-10 is a Saturday).
    expect(model.weeks[1]?.[6]?.day).toBe("2026-01-10");
    expect(model.totalDays).toBe(10);
  });

  it("pads the tail when the window ends mid-week", () => {
    const model = buildHeatmap({
      sinceDay: "2026-01-04",
      untilDay: "2026-01-06",
      daily: [],
      metric: "cost",
    });
    expect(model.weeks).toHaveLength(1);
    expect(model.weeks[0]?.map((cell) => cell?.day ?? null)).toEqual([
      "2026-01-04",
      "2026-01-05",
      "2026-01-06",
      null,
      null,
      null,
      null,
    ]);
  });

  it("returns an empty model for an inverted window", () => {
    const model = buildHeatmap({
      sinceDay: "2026-02-01",
      untilDay: "2026-01-01",
      daily: [],
      metric: "cost",
    });
    expect(model.weeks).toEqual([]);
    expect(model.busiest).toBeNull();
    expect(model.currentStreak).toBe(0);
  });

  it("labels each month once, at the week it first appears", () => {
    const model = buildHeatmap({
      sinceDay: "2026-01-01",
      untilDay: "2026-03-31",
      daily: [],
      metric: "cost",
    });
    expect(model.monthLabels.map((entry) => entry.label)).toEqual(["Jan", "Feb", "Mar"]);
    const indexes = model.monthLabels.map((entry) => entry.weekIndex);
    expect(indexes).toEqual(indexes.toSorted((a, b) => a - b));
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it("drops a first month label that would collide with the second", () => {
    // Starts on the 30th, so January only owns the first week.
    const model = buildHeatmap({
      sinceDay: "2026-01-30",
      untilDay: "2026-03-01",
      daily: [],
      metric: "cost",
    });
    expect(model.monthLabels.map((entry) => entry.label)[0]).toBe("Feb");
  });

  it("drops a last month label that would overflow the right edge", () => {
    // October starts in the final week, so its label has no room.
    const model = buildHeatmap({
      sinceDay: "2026-09-01",
      untilDay: "2026-10-03",
      daily: [],
      metric: "cost",
    });
    expect(model.monthLabels.map((entry) => entry.label)).toEqual(["Sep"]);
  });
});

describe("levelsForValues", () => {
  it("spreads distinct values evenly across the four levels", () => {
    const levels = levelsForValues([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((value) => levels.get(value))).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it("gives tied values one shared mid level and ignores zero and negative values", () => {
    expect(levelsForValues([5, 5, 5, 5]).get(5)).toBe(3);
    expect(levelsForValues([10]).get(10)).toBe(3);
    const levels = levelsForValues([0, -1, 0, 2, 4]);
    expect(levels.has(0)).toBe(false);
    expect(levels.has(-1)).toBe(false);
    expect(levels.get(2)).toBe(2);
    expect(levels.get(4)).toBe(4);
  });

  it("is not skewed by one huge outlier", () => {
    const levels = levelsForValues([1, 2, 3, 4, 1_000_000]);
    expect(levels.get(1_000_000)).toBe(4);
    expect(levels.get(1)).toBe(1);
  });
});

describe("buildHeatmap values", () => {
  it("leaves empty days at level 0 and uses the selected metric", () => {
    const daily = [day("2026-01-02", 3, 3000), day("2026-01-04", 1, 9000)];
    const cost = cellsOf(
      buildHeatmap({ sinceDay: "2026-01-01", untilDay: "2026-01-05", daily, metric: "cost" }),
    );
    expect(cost.map((cell) => cell.level)).toEqual([0, 4, 0, 2, 0]);
    expect(cost.find((cell) => cell.day === "2026-01-02")?.costUsd).toBe(3);

    const tokens = buildHeatmap({
      sinceDay: "2026-01-01",
      untilDay: "2026-01-05",
      daily,
      metric: "tokens",
    });
    expect(tokens.busiest?.day).toBe("2026-01-04");
    expect(tokens.total).toBe(12_000);
    expect(tokens.activeDays).toBe(2);
  });

  it("ignores usage outside the window", () => {
    const model = buildHeatmap({
      sinceDay: "2026-01-02",
      untilDay: "2026-01-03",
      daily: [day("2025-12-31", 99), day("2026-01-02", 1)],
      metric: "cost",
    });
    expect(model.total).toBe(1);
  });
});

describe("streaks", () => {
  const streaks = (pattern: readonly number[]) => {
    const daily = pattern.flatMap((cost, index) =>
      cost > 0 ? [day(`2026-01-${String(index + 1).padStart(2, "0")}`, cost)] : [],
    );
    const model = buildHeatmap({
      sinceDay: "2026-01-01",
      untilDay: `2026-01-${String(pattern.length).padStart(2, "0")}`,
      daily,
      metric: "cost",
    });
    return { longest: model.longestStreak, current: model.currentStreak };
  };

  it("finds the longest run and a current run ending today", () => {
    expect(streaks([1, 1, 0, 1, 1, 1])).toEqual({ longest: 3, current: 3 });
  });

  it("does not end the current streak because today has no usage yet", () => {
    expect(streaks([1, 1, 0, 1, 1, 1, 0])).toEqual({ longest: 3, current: 3 });
  });

  it("ends the current streak after a gap of a full day", () => {
    expect(streaks([1, 1, 1, 0, 0])).toEqual({ longest: 3, current: 0 });
  });

  it("is zero without activity", () => {
    expect(streaks([0, 0, 0])).toEqual({ longest: 0, current: 0 });
  });
});

describe("projectMonthCost", () => {
  it("extrapolates this month's pace to the month's end", () => {
    const projection = projectMonthCost({
      today: "2026-02-14",
      daily: [
        day("2026-01-31", 500),
        day("2026-02-03", 10),
        day("2026-02-14", 18),
        day("2026-02-20", 1000),
      ],
    });
    expect(projection).toEqual({
      monthToDate: 28,
      projected: 56,
      daysElapsed: 14,
      daysInMonth: 28,
    });
  });

  it("stays quiet until there are three days and some spend", () => {
    expect(projectMonthCost({ today: "2026-02-02", daily: [day("2026-02-01", 5)] })).toBeNull();
    expect(projectMonthCost({ today: "2026-02-10", daily: [day("2026-01-10", 5)] })).toBeNull();
  });

  it("knows leap years", () => {
    expect(
      projectMonthCost({ today: "2028-02-10", daily: [day("2028-02-05", 10)] })?.daysInMonth,
    ).toBe(29);
  });
});

describe("formatDayLong", () => {
  it("writes a readable date and passes bad input through", () => {
    expect(formatDayLong("2026-01-01")).toBe("Thu, Jan 1, 2026");
    expect(formatDayLong("nope")).toBe("nope");
  });
});
