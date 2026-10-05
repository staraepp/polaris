import type { DailyTotals } from "@t3tools/shared/usageMerge";
import { describe, expect, it } from "vite-plus/test";

import { buildModelTrend, columnDaysFor, niceTicks } from "./usageModelSeries";

const day = (
  date: string,
  models: Record<string, number>,
  provider: "claude" | "codex" = "claude",
): DailyTotals => ({
  day: date,
  costUsd: Object.values(models).reduce((sum, value) => sum + value, 0),
  totalTokens: 0,
  byProvider: new Map(),
  byModel: new Map(
    Object.entries(models).map(([model, costUsd]) => [
      `${model.startsWith("gpt") ? "codex" : provider} ${model}`,
      {
        provider: model.startsWith("gpt") ? "codex" : provider,
        model,
        costUsd,
        totalTokens: costUsd * 100,
      },
    ]),
  ),
});

describe("buildModelTrend", () => {
  const days = ["2026-01-01", "2026-01-02", "2026-01-03"];
  const daily = [
    day("2026-01-01", { opus: 10, sonnet: 2, "gpt-6": 4 }),
    day("2026-01-03", { opus: 5, haiku: 1 }),
  ];

  it("ranks models by window total and folds the rest into Other", () => {
    const trend = buildModelTrend({ days, daily, metric: "cost", top: 2 });
    expect(trend.series.map((series) => series.model)).toEqual(["opus", "gpt-6"]);
    expect(trend.otherTotal).toBe(3);
    expect(trend.columns.map((column) => column.total)).toEqual([16, 0, 6]);
    expect(trend.columns[0]?.values).toEqual([10, 4]);
    expect(trend.columns[0]?.other).toBe(2);
    expect(trend.peak).toBe(16);
  });

  it("shades models by their rank within their provider", () => {
    const trend = buildModelTrend({ days, daily, metric: "cost" });
    expect(trend.series.map((series) => [series.model, series.shade])).toEqual([
      ["opus", 0],
      ["gpt-6", 0],
      ["sonnet", 1],
      ["haiku", 2],
    ]);
  });

  it("uses tokens when asked and drops models with no value", () => {
    const trend = buildModelTrend({
      days,
      daily: [...daily, day("2026-01-02", { idle: 0 })],
      metric: "tokens",
    });
    expect(trend.series[0]).toMatchObject({ model: "opus", total: 1500 });
    expect(trend.series.some((series) => series.model === "idle")).toBe(false);
  });

  it("groups long windows into weekly columns", () => {
    const longDays = Array.from({ length: 60 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 0, 1 + index));
      return date.toISOString().slice(0, 10);
    });
    const trend = buildModelTrend({
      days: longDays,
      daily: [day("2026-01-02", { opus: 3 }), day("2026-01-05", { opus: 4 })],
      metric: "cost",
    });
    expect(trend.columnDays).toBe(7);
    expect(trend.columns).toHaveLength(9);
    expect(trend.columns[0]).toMatchObject({ start: "2026-01-01", end: "2026-01-07", total: 7 });
    expect(trend.columns.at(-1)).toMatchObject({ start: "2026-02-26", end: "2026-03-01" });
  });

  it("is empty without per-model data", () => {
    const trend = buildModelTrend({
      days,
      daily: [{ day: "2026-01-01", costUsd: 5, totalTokens: 9, byProvider: new Map() }],
      metric: "cost",
    });
    expect(trend.series).toEqual([]);
    expect(trend.peak).toBe(0);
  });
});

describe("columnDaysFor and niceTicks", () => {
  it("switches to weeks after about six weeks", () => {
    expect(columnDaysFor(30)).toBe(1);
    expect(columnDaysFor(45)).toBe(1);
    expect(columnDaysFor(90)).toBe(7);
  });

  it("picks round tick steps", () => {
    expect(niceTicks(298)).toEqual([100, 200, 300]);
    expect(niceTicks(16)).toEqual([5, 10, 15]);
    expect(niceTicks(0)).toEqual([]);
  });
});
