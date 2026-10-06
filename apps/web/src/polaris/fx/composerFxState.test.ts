import { describe, expect, it } from "vite-plus/test";

import { resolveComposerFx, type ComposerFxInput } from "./composerFxState";

const idle: ComposerFxInput = {
  voiceListening: false,
  quotaFlashing: false,
  running: false,
  tier: "neutral",
  keywordIdle: false,
  idleBeam: false,
  reducedMotion: false,
  calm: false,
};

describe("resolveComposerFx", () => {
  it("draws the idle beam only when nothing else owns the outline (Polaris)", () => {
    expect(resolveComposerFx({ ...idle, idleBeam: true })).toEqual({
      layer: "idle",
      tier: "neutral",
      animated: true,
    });
    expect(resolveComposerFx({ ...idle, idleBeam: true, keywordIdle: true }).layer).toBe("ring");
    expect(resolveComposerFx({ ...idle, idleBeam: true, running: true, tier: "low" }).layer).toBe(
      "beam",
    );
    // Decorative: reduced motion drops it instead of drawing it still.
    expect(resolveComposerFx({ ...idle, idleBeam: true, reducedMotion: true }).layer).toBe("none");
  });

  it("draws nothing while idle", () => {
    expect(resolveComposerFx(idle)).toEqual({
      layer: "none",
      tier: "neutral",
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

  it("shows no beam for a tier of none even while running", () => {
    expect(resolveComposerFx({ ...idle, running: true, tier: "none" }).layer).toBe("none");
    expect(
      resolveComposerFx({ ...idle, running: true, tier: "none", keywordIdle: true }).layer,
    ).toBe("ring");
  });

  it("drops the flash and freezes the beam under reduced motion, keeping the ring", () => {
    expect(resolveComposerFx({ ...idle, reducedMotion: true, quotaFlashing: true })).toEqual({
      layer: "none",
      tier: "neutral",
      animated: false,
    });
    expect(
      resolveComposerFx({ ...idle, reducedMotion: true, running: true, tier: "medium" }),
    ).toEqual({
      layer: "beam",
      tier: "medium",
      animated: false,
    });
    expect(resolveComposerFx({ ...idle, reducedMotion: true, keywordIdle: true }).layer).toBe(
      "ring",
    );
  });

  it("draws no beam, flash or idle decoration in Calm mode (Polaris, V 5.1.0)", () => {
    const calm = { ...idle, calm: true, idleBeam: true };
    expect(resolveComposerFx({ ...calm, running: true, tier: "high" }).layer).toBe("none");
    expect(resolveComposerFx({ ...calm, quotaFlashing: true }).layer).toBe("none");
    expect(resolveComposerFx(calm).layer).toBe("none");
    expect(resolveComposerFx({ ...calm, keywordIdle: true })).toEqual({
      layer: "ring",
      tier: "neutral",
      animated: false,
    });
    // Listening is feedback, so it still shows, but holds still.
    expect(resolveComposerFx({ ...calm, voiceListening: true })).toEqual({
      layer: "voice",
      tier: "neutral",
      animated: false,
    });
  });
});
