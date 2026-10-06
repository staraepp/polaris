// @vitest-environment jsdom
import type { DailyTotals } from "@t3tools/shared/usageMerge";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { UsageModelTrend } from "./UsageModelTrend";

const day = (date: string, models: Record<string, number>): DailyTotals => ({
  day: date,
  costUsd: Object.values(models).reduce((sum, value) => sum + value, 0),
  totalTokens: 0,
  byProvider: new Map(),
  byModel: new Map(
    Object.entries(models).map(([model, costUsd]) => [
      `claude ${model}`,
      { provider: "claude" as const, model, costUsd, totalTokens: costUsd * 1000 },
    ]),
  ),
});

const DAYS = ["2026-01-01", "2026-01-02", "2026-01-03"];
const DAILY = [day("2026-01-01", { opus: 10, sonnet: 2 }), day("2026-01-03", { opus: 4 })];

describe("UsageModelTrend", () => {
  let renderer: Root;
  let container: HTMLDivElement;

  const render = async (daily: readonly DailyTotals[] = DAILY) => {
    await act(() => {
      renderer.render(<UsageModelTrend days={DAYS} daily={daily} metric="cost" />);
    });
  };
  const press = async (target: Element, key: string) => {
    await act(() => {
      target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
  };

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("labels the chart and lists each model with its total", async () => {
    await render();
    const chart = container.querySelector('svg[role="img"]')!;
    expect(chart.getAttribute("aria-label")).toBe(
      "Cost per day by model. Top model: opus, $14.00.",
    );
    const legend = [...container.querySelectorAll("ul li")].map((item) => item.textContent);
    expect(legend).toEqual(["opus$14.00", "sonnet$2.00"]);
    expect(container.querySelectorAll("table tbody tr")).toHaveLength(2);
  });

  it("reads a column out with the arrow keys", async () => {
    await render();
    const chart = container.querySelector('svg[role="img"]')!;
    const readout = () => container.querySelector('[aria-live="polite"]')!.textContent;
    expect(readout()).toContain("arrow keys");
    await press(chart, "ArrowRight");
    expect(readout()).toContain("$12.00");
    expect(readout()).toContain("opus $10.00");
    await press(chart, "End");
    expect(readout()).toContain("opus $4.00");
  });

  it("renders nothing without per-model data", async () => {
    await render([{ day: "2026-01-01", costUsd: 3, totalTokens: 4, byProvider: new Map() }]);
    expect(container.innerHTML).toBe("");
  });
});
