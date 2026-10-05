// @vitest-environment jsdom
import type { DailyTotals } from "@t3tools/shared/usageMerge";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { UsageActivityHeatmap } from "./UsageActivityHeatmap";

const day = (date: string, costUsd: number, totalTokens = costUsd * 1000): DailyTotals => ({
  day: date,
  costUsd,
  totalTokens,
  byProvider: new Map(),
});

const DAILY = [
  day("2026-01-05", 1),
  day("2026-01-06", 2),
  day("2026-01-07", 3),
  day("2026-02-03", 4),
  day("2026-02-10", 40),
  day("2026-02-14", 5),
];

describe("UsageActivityHeatmap", () => {
  let renderer: Root;
  let container: HTMLDivElement;

  const render = async (props: Partial<Parameters<typeof UsageActivityHeatmap>[0]> = {}) => {
    await act(() => {
      renderer.render(
        <UsageActivityHeatmap
          daily={DAILY}
          sinceDay="2026-01-01"
          untilDay="2026-02-14"
          metric="cost"
          {...props}
        />,
      );
    });
  };
  const cellFor = (date: string) =>
    container.querySelector<HTMLElement>(`[role="gridcell"][data-day="${date}"]`)!;
  const press = async (target: HTMLElement, key: string) => {
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

  it("draws one row per weekday and a labelled cell for every day", async () => {
    await render();
    expect(container.querySelectorAll('[role="row"]')).toHaveLength(7);
    expect(container.querySelectorAll("[data-day]")).toHaveLength(45);
    expect(cellFor("2026-02-10").getAttribute("aria-label")).toBe(
      "Tue, Feb 10, 2026: $40.00, 40K tokens",
    );
    expect(cellFor("2026-01-01").getAttribute("aria-label")).toBe("Thu, Jan 1, 2026: no usage");
    expect(container.querySelector('[role="grid"]')?.getAttribute("aria-label")).toBe(
      "Daily cost activity, Jan 1 to Feb 14",
    );
  });

  it("paints the busiest day at the top level and idle days at level 0", async () => {
    await render();
    expect(cellFor("2026-02-10").dataset.level).toBe("4");
    expect(cellFor("2026-01-01").dataset.level).toBe("0");
  });

  it("is a single tab stop that starts on the busiest day", async () => {
    await render();
    const stops = container.querySelectorAll('[data-day][tabindex="0"]');
    expect(stops).toHaveLength(1);
    expect((stops[0] as HTMLElement).dataset.day).toBe("2026-02-10");
  });

  it("moves between days with the arrow keys and clamps at the ends", async () => {
    await render();
    const start = cellFor("2026-02-03");
    await act(() => start.focus());
    await press(start, "ArrowRight");
    expect(document.activeElement).toBe(cellFor("2026-02-10"));
    await press(document.activeElement as HTMLElement, "ArrowDown");
    expect(document.activeElement).toBe(cellFor("2026-02-11"));
    await press(document.activeElement as HTMLElement, "ArrowUp");
    await press(document.activeElement as HTMLElement, "ArrowLeft");
    expect(document.activeElement).toBe(cellFor("2026-02-03"));
    await press(document.activeElement as HTMLElement, "Home");
    expect(document.activeElement).toBe(cellFor("2026-01-01"));
    await press(document.activeElement as HTMLElement, "ArrowUp");
    expect(document.activeElement).toBe(cellFor("2026-01-01"));
    await press(document.activeElement as HTMLElement, "End");
    expect(document.activeElement).toBe(cellFor("2026-02-14"));
    await press(document.activeElement as HTMLElement, "ArrowRight");
    expect(document.activeElement).toBe(cellFor("2026-02-14"));
  });

  it("ignores keys it does not handle", async () => {
    await render();
    const start = cellFor("2026-02-03");
    await act(() => start.focus());
    await press(start, "a");
    expect(document.activeElement).toBe(start);
  });

  it("shows a day's numbers on click, which is how touch reads it", async () => {
    await render();
    const readout = () =>
      container.querySelector('[data-testid="usage-heatmap-readout"]')!.textContent;
    expect(readout()).toContain("over 45 days");
    await act(() => cellFor("2026-02-03").click());
    expect(readout()).toBe("Tue, Feb 3, 2026: $4.00, 4K tokens");
    expect(cellFor("2026-02-03").getAttribute("aria-selected")).toBe("true");
  });

  it("previews a day while the pointer is over it", async () => {
    await render();
    await act(() => {
      cellFor("2026-01-06").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="usage-heatmap-readout"]')?.textContent).toBe(
      "Tue, Jan 6, 2026: $2.00, 2K tokens",
    );
    await act(() => {
      cellFor("2026-01-06").dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="usage-heatmap-readout"]')?.textContent).toContain(
      "over 45 days",
    );
  });

  it("summarises activity and projects the month for cost only", async () => {
    await render();
    const text = container.textContent ?? "";
    expect(text).toContain("Active days");
    expect(text).toContain("6/45");
    expect(text).toContain("Busiest day");
    expect(container.querySelector('[data-testid="usage-projection"]')?.textContent).toContain(
      "on pace for $",
    );

    await render({ metric: "tokens" });
    expect(container.querySelector('[data-testid="usage-projection"]')).toBeNull();
    expect(container.querySelector('[role="grid"]')?.getAttribute("aria-label")).toContain("token");
  });

  it("renders an empty year without a busiest day", async () => {
    await render({ daily: [] });
    expect(container.textContent).not.toContain("Busiest day");
    expect(container.querySelector('[data-testid="usage-heatmap-readout"]')?.textContent).toBe(
      "$0.00 over 45 days",
    );
    expect(container.querySelectorAll('[data-day][tabindex="0"]')).toHaveLength(1);
  });
});
