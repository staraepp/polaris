// @vitest-environment jsdom
import type { ServerProvider } from "@t3tools/contracts";
import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { useQuotaLowSignal, type QuotaLowSignal } from "./useQuotaLowSignal";

const provider = (instanceId: string, usedPercent: number, unavailable = false) =>
  ({
    instanceId,
    usageLimits: {
      checkedAt: "2026-10-05T00:00:00.000Z",
      windows: [{ id: "weekly", kind: "weekly", label: "Week", usedPercent }],
      ...(unavailable ? { unavailable: { reason: "probeFailed" } } : {}),
    },
  }) as unknown as ServerProvider;

describe("useQuotaLowSignal", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  let latest: QuotaLowSignal | null = null;
  let reduceMotion = false;

  function Probe({
    provider,
    threshold,
  }: {
    readonly provider: ServerProvider | null;
    readonly threshold?: number | undefined;
  }) {
    const signal = useQuotaLowSignal(provider, threshold);
    useEffect(() => {
      latest = signal;
    });
    return null;
  }
  const render = async (current: ServerProvider | null, threshold?: number) => {
    await act(async () => {
      renderer.render(<Probe provider={current} threshold={threshold} />);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce") && reduceMotion,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    reduceMotion = false;
    latest = null;
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("is idle without a provider", async () => {
    await render(null);
    expect(latest).toEqual({ low: false, flashing: false, lowWindows: [], thresholdPercent: 20 });
  });

  it("flashes for four seconds on a crossing, then keeps the low signal", async () => {
    await render(provider("claude", 50));
    expect(latest?.low).toBe(false);
    await render(provider("claude", 85));
    expect(latest?.low).toBe(true);
    expect(latest?.flashing).toBe(true);
    expect(latest?.lowWindows.map((window) => window.remainingPercent)).toEqual([15]);
    await act(async () => {
      vi.advanceTimersByTime(3_999);
    });
    expect(latest?.flashing).toBe(true);
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(latest?.flashing).toBe(false);
    expect(latest?.low).toBe(true);
  });

  it("does not re-flash for the same crossing when an identical snapshot arrives", async () => {
    await render(provider("claude", 85));
    await act(async () => {
      vi.advanceTimersByTime(4_000);
    });
    expect(latest?.flashing).toBe(false);
    await render(provider("claude", 85));
    expect(latest?.flashing).toBe(false);
    expect(latest?.low).toBe(true);
  });

  it("skips the flash under reduced motion but still reports low", async () => {
    reduceMotion = true;
    await render(provider("claude", 90));
    expect(latest?.low).toBe(true);
    expect(latest?.flashing).toBe(false);
  });

  it("goes quiet when the account stops reporting limits", async () => {
    await render(provider("claude", 90));
    expect(latest?.low).toBe(true);
    await render(provider("claude", 90, true));
    expect(latest?.low).toBe(false);
  });

  it("follows a custom threshold and stays silent when it is 0", async () => {
    await render(provider("claude", 75), 30);
    expect(latest?.low).toBe(true);
    expect(latest?.thresholdPercent).toBe(30);
    await render(provider("claude", 75), 20);
    expect(latest?.low).toBe(false);
    await render(provider("claude", 99), 0);
    expect(latest?.low).toBe(false);
    expect(latest?.flashing).toBe(false);
  });
});
