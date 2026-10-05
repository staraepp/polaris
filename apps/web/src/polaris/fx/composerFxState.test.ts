import { describe, expect, it } from "vite-plus/test";

import { resolveComposerFx, type ComposerFxInput } from "./composerFxState";

const idle: ComposerFxInput = {
  voiceListening: false,
  quotaFlashing: false,
  quotaLow: false,
  running: false,
  tier: "neutral",
  keywordIdle: false,
  reducedMotion: false,
};

describe("resolveComposerFx", () => {
  it("draws nothing while idle", () => {
    expect(resolveComposerFx(idle)).toEqual({
      layer: "none",
      tier: "neutral",
      accent: false,
      animated: false,
    });
  });

  it("orders voice over flash over beam over ring", () => {
    const all = {
      ...idle,
      voiceListening: true,
      quotaFlashing: true,
      running: true,
      tier: "high",
      keywordIdle: true,
    } as const;
    expect(resolveComposerFx(all).layer).toBe("voice");
    expect(resolveComposerFx({ ...all, voiceListening: false }).layer).toBe("flash");
    expect(resolveComposerFx({ ...all, voiceListening: false, quotaFlashing: false }).layer).toBe(
      "beam",
    );
    expect(
      resolveComposerFx({ ...all, voiceListening: false, quotaFlashing: false, running: false })
        .layer,
    ).toBe("ring");
  });

  it("keeps the amber accent under any layer while quota is low", () => {
    expect(resolveComposerFx({ ...idle, quotaLow: true }).accent).toBe(true);
    expect(resolveComposerFx({ ...idle, quotaLow: true, running: true, tier: "max" })).toEqual({
      layer: "beam",
      tier: "max",
      accent: true,
      animated: true,
    });
  });

  it("shows no beam for a tier of none even while running", () => {
    expect(resolveComposerFx({ ...idle, running: true, tier: "none" }).layer).toBe("none");
    expect(
      resolveComposerFx({ ...idle, running: true, tier: "none", keywordIdle: true }).layer,
    ).toBe("ring");
  });

  it("drops the flash and freezes the beam under reduced motion, keeping the ring", () => {
    expect(
      resolveComposerFx({ ...idle, reducedMotion: true, quotaFlashing: true, quotaLow: true }),
    ).toEqual({
      layer: "none",
      tier: "neutral",
      accent: true,
      animated: false,
    });
    expect(
      resolveComposerFx({ ...idle, reducedMotion: true, running: true, tier: "medium" }),
    ).toEqual({
      layer: "beam",
      tier: "medium",
      accent: false,
      animated: false,
    });
    expect(resolveComposerFx({ ...idle, reducedMotion: true, keywordIdle: true }).layer).toBe(
      "ring",
    );
  });
});
