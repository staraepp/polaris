import type { EffortTier } from "./effortTier";

/** Which single animated effect owns the composer outline right now. */
export type ComposerFxLayer = "voice" | "flash" | "beam" | "ring" | "idle" | "none";

export interface ComposerFxInput {
  /** Voice input is listening or transcribing (ours, or Clide's own dictation). */
  readonly voiceListening: boolean;
  readonly quotaFlashing: boolean;
  readonly running: boolean;
  readonly tier: EffortTier;
  /** Upstream's static ring: the prompt text contains the keyword level while idle. */
  readonly keywordIdle: boolean;
  /**
   * The subtle idle beam (Settings → Effects, off by default) may show: the
   * setting is on and the window is visible and focused.
   */
  readonly idleBeam: boolean;
  readonly reducedMotion: boolean;
}

export interface ComposerFxState {
  readonly layer: ComposerFxLayer;
  readonly tier: EffortTier;
  /** False under reduced motion: the layer is drawn static instead. */
  readonly animated: boolean;
}

/**
 * Priority, highest first: voice listening, the quota-low flash, the effort
 * beam of the running turn, the idle keyword ring, then the optional idle
 * beam (decorative, so never under reduced motion). Only one layer at a time. Quota-low after the flash is not an outline: it is a badge beside the
 * usage meter (`ComposerUsageMeter`).
 */
export function resolveComposerFx(input: ComposerFxInput): ComposerFxState {
  const animated = !input.reducedMotion;
  const base = { tier: input.tier } as const;
  if (input.voiceListening) return { ...base, layer: "voice", animated };
  if (input.quotaFlashing && animated) return { ...base, layer: "flash", animated };
  if (input.running && input.tier !== "none") return { ...base, layer: "beam", animated };
  if (input.keywordIdle) return { ...base, layer: "ring", animated: false };
  if (input.idleBeam && animated) return { ...base, layer: "idle", animated };
  return { ...base, layer: "none", animated: false };
}
