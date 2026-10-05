// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import {
  ComposerFx,
  IDLE_COMPOSER_FX_SIGNALS,
  useComposerFx,
  type ComposerFxSignals,
} from "./ComposerFx";

function Harness({ signals, keywordIdle }: { signals: ComposerFxSignals; keywordIdle: boolean }) {
  return <ComposerFx state={useComposerFx(signals, keywordIdle)} />;
}

describe("ComposerFx", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  let reduceMotion = false;
  const render = async (signals: ComposerFxSignals, keywordIdle = false) => {
    await act(async () => {
      renderer.render(<Harness signals={signals} keywordIdle={keywordIdle} />);
    });
  };
  const ring = () => container.querySelector<HTMLElement>("[data-polaris-fx-ring]")!;
  const accent = () => container.querySelector<HTMLElement>("[data-polaris-fx-accent]")!;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce") && reduceMotion,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    reduceMotion = false;
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it("renders both layers off while idle and never touches the page's accessibility tree", async () => {
    await render(IDLE_COMPOSER_FX_SIGNALS);
    expect(ring().dataset.layer).toBe("none");
    expect(accent().dataset.active).toBe("false");
    expect(ring().getAttribute("aria-hidden")).toBe("true");
  });

  it("spins the beam at the turn's tier while running", async () => {
    await render({ ...IDLE_COMPOSER_FX_SIGNALS, running: true, tier: "high" });
    expect(ring().dataset.layer).toBe("beam");
    expect(ring().dataset.tier).toBe("high");
    expect(ring().dataset.animated).toBe("true");
  });

  it("lets the flash cover the beam and keeps the accent underneath", async () => {
    await render({
      ...IDLE_COMPOSER_FX_SIGNALS,
      running: true,
      tier: "max",
      quotaFlashing: true,
      quotaLow: true,
    });
    expect(ring().dataset.layer).toBe("flash");
    expect(accent().dataset.active).toBe("true");
    await render({ ...IDLE_COMPOSER_FX_SIGNALS, running: true, tier: "max", quotaLow: true });
    expect(ring().dataset.layer).toBe("beam");
    expect(accent().dataset.active).toBe("true");
  });

  it("leaves the ring layer to upstream's keyword frame and holds the beam still under reduced motion", async () => {
    await render(IDLE_COMPOSER_FX_SIGNALS, true);
    expect(ring().dataset.layer).toBe("none");
    reduceMotion = true;
    await render({
      ...IDLE_COMPOSER_FX_SIGNALS,
      running: true,
      tier: "medium",
      quotaFlashing: true,
    });
    expect(ring().dataset.layer).toBe("beam");
    expect(ring().dataset.animated).toBe("false");
  });
});
