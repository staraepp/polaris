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
  return <ComposerFx state={useComposerFx(signals, keywordIdle)} theme="dark" />;
}

describe("ComposerFx", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  let reduceMotion = false;
  const render = async (signals: ComposerFxSignals, keywordIdle = false) => {
    await act(async () => {
      renderer.render(<Harness signals={signals} keywordIdle={keywordIdle} />);
    });
    // The beam is lazy: let its chunk resolve and render.
    await act(() => import("./EffortBeam").then(() => undefined));
  };
  const ring = () => container.querySelector<HTMLElement>("[data-polaris-fx-ring]")!;
  const beam = () => container.querySelector<HTMLElement>("[data-polaris-effort-beam]")!;
  const beamOn = () => beam().hasAttribute("data-active");

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
    vi.restoreAllMocks();
  });

  it("renders both layers off while idle and never touches the page's accessibility tree", async () => {
    await render(IDLE_COMPOSER_FX_SIGNALS);
    expect(ring().dataset.layer).toBe("none");
    expect(beamOn()).toBe(false);
    expect(ring().getAttribute("aria-hidden")).toBe("true");
    expect(beam().getAttribute("aria-hidden")).toBe("true");
  });

  it("runs the border-beam at the turn's tier while running", async () => {
    await render({ ...IDLE_COMPOSER_FX_SIGNALS, running: true, tier: "high" });
    expect(beamOn()).toBe(true);
    expect(beam().dataset.tier).toBe("high");
    expect(ring().dataset.layer).toBe("none");
  });

  it("lets the flash cover the beam for its burst, and draws no quota outline after it", async () => {
    await render({
      ...IDLE_COMPOSER_FX_SIGNALS,
      running: true,
      tier: "max",
      quotaFlashing: true,
    });
    expect(ring().dataset.layer).toBe("flash");
    expect(beamOn()).toBe(false);
    await render({ ...IDLE_COMPOSER_FX_SIGNALS, running: true, tier: "max" });
    expect(ring().dataset.layer).toBe("none");
    expect(beamOn()).toBe(true);
    expect(container.querySelector("[data-polaris-fx-accent]")).toBeNull();
  });

  it("burns for the keyword level, and falls back to the still ember ring without WebGL (V 5.3.0)", async () => {
    // The flames start only in a focused window; jsdom has no WebGL, so they
    // report themselves unavailable.
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    await render(IDLE_COMPOSER_FX_SIGNALS, true);
    await act(() => import("./KeywordFlames").then(() => undefined));
    await act(async () => {});
    expect(container.querySelector("[data-polaris-keyword-flames]")).not.toBeNull();
    expect(ring().dataset.layer).toBe("embers");
    expect(beamOn()).toBe(false);
  });

  it("draws the keyword level as a still ember ring and holds the beam still under reduced motion", async () => {
    reduceMotion = true;
    await render(IDLE_COMPOSER_FX_SIGNALS, true);
    expect(ring().dataset.layer).toBe("embers");
    expect(container.querySelector("[data-polaris-keyword-flames]")).toBeNull();
    await render({
      ...IDLE_COMPOSER_FX_SIGNALS,
      running: true,
      tier: "medium",
      quotaFlashing: true,
    });
    // No flash under reduced motion; the beam shows and its CSS holds it still.
    expect(ring().dataset.layer).toBe("none");
    expect(beamOn()).toBe(true);
    expect(beam().dataset.tier).toBe("medium");
  });
});
