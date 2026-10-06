// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { ComposerUsageMeter } from "./ComposerUsageMeter";
import type { UsageMeterModel } from "./usageMeterModel";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/usage">{children}</a>,
}));

const model = (weeklyRemaining: number, threshold = 20): UsageMeterModel => {
  const bars = [
    { id: "five_hour", label: "5-hour", remainingPercent: 70, low: false },
    {
      id: "weekly",
      label: "Weekly",
      remainingPercent: weeklyRemaining,
      low: weeklyRemaining <= threshold,
    },
  ];
  const tightest = bars.reduce((min, bar) =>
    bar.remainingPercent < min.remainingPercent ? bar : min,
  );
  return {
    driver: "claudeAgent",
    windows: [],
    bars,
    tightest,
    low: bars.some((bar) => bar.low),
    thresholdPercent: threshold,
  } as unknown as UsageMeterModel;
};

describe("ComposerUsageMeter", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  const render = async (value: UsageMeterModel) => {
    await act(() => renderer.render(<ComposerUsageMeter model={value} />));
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

  it("names the tightest window and stays neutral above the warning", async () => {
    await render(model(45));
    const button = container.querySelector("button")!;
    expect(button.getAttribute("aria-label")).toBe("Usage limits: Weekly 45% left");
    expect(button.dataset.low).toBe("false");
    expect(container.querySelectorAll('rect[data-low="true"]')).toHaveLength(0);
  });

  it("turns only the low window's bar amber", async () => {
    await render(model(12));
    expect(container.querySelector("button")!.dataset.low).toBe("true");
    expect(container.querySelectorAll('rect[data-low="true"]')).toHaveLength(1);
    expect(container.querySelectorAll('rect[data-low="false"]')).toHaveLength(1);
  });
});
