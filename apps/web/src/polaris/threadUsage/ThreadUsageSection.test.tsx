// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { ThreadUsage } from "./threadUsage";
import { ThreadUsageSection } from "./ThreadUsageSection";

const run = (ordinal: number, inputTokens: number, toolCalls: number, tokensUnknown = false) => ({
  runId: `run-${ordinal}`,
  ordinal,
  inputTokens,
  outputTokens: 0,
  toolCalls,
  tokensUnknown,
});

describe("ThreadUsageSection", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  const render = async (usage: ThreadUsage) => {
    await act(() => renderer.render(<ThreadUsageSection usage={usage} />));
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

  it("shows totals, one bar per run and a note for runs without tokens", async () => {
    await render({
      runs: [run(1, 1200, 3), run(2, 0, 0, true)],
      inputTokens: 1200,
      outputTokens: 300,
      toolCalls: 3,
      runsWithTokens: 1,
    });
    expect(container.textContent).toContain("2 runs");
    expect(container.textContent).toContain("Tool calls3");
    expect(container.querySelectorAll("[data-tools]")).toHaveLength(2);
    expect(container.querySelector('[data-tools="true"]')).not.toBeNull();
    expect(container.textContent).toContain("1 of 2 runs did not report tokens.");
  });

  it("says when no run reported tokens and renders nothing without runs", async () => {
    await render({
      runs: [run(1, 0, 1, true)],
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 1,
      runsWithTokens: 0,
    });
    expect(container.textContent).toContain("Not reported");
    await render({ runs: [], inputTokens: 0, outputTokens: 0, toolCalls: 0, runsWithTokens: 0 });
    expect(container.innerHTML).toBe("");
  });
});
