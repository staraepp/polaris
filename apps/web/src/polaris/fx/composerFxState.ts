import type { EffortTier } from "./effortTier";

/** Which single animated effect owns the composer outline right now. */
export type ComposerFxLayer = "voice" | "flash" | "flames" | "beam" | "idle" | "none";

export interface ComposerFxInput {
  /** Voice input is listening or transcribing (ours, or Clide's own dictation). */
  readonly voiceListening: boolean;
  readonly quotaFlashing: boolean;
  readonly running: boolean;
  readonly tier: EffortTier;
  /** The running turn was sent at the keyword level (V 5.3.0: it burns instead of the max beam). */
  readonly keywordRun: boolean;
  /** The prompt text contains the keyword level while idle. */
  readonly keywordIdle: boolean;
  /**
   * The subtle idle beam (Settings → Effects, off by default) may show: the
   * setting is on and the window is visible and focused.
   */
  readonly idleBeam: boolean;
  readonly reducedMotion: boolean;
  /** Calm mode (Polaris, V 5.1.0): no beams, flashes or idle decoration; voice is a still ring. */
  readonly calm: boolean;
}

export interface ComposerFxState {
  readonly layer: ComposerFxLayer;
  readonly tier: EffortTier;
  /** False under reduced motion: the layer is drawn static instead. */
  readonly animated: boolean;
}

/**
 * Priority, highest first: voice listening, the quota-low flash, the running
 * turn (flames at the keyword level, else the effort beam), the keyword in
 * the prompt (flames), then the optional idle beam (decorative, so never under
 * reduced motion). Only one layer at a time. Flames that may not move (reduced
 * motion, Calm mode) are drawn as a still ember ring. Quota-low after the
 * flash is not an outline: it is a badge beside the usage meter
 * (`ComposerUsageMeter`).
 */
export function resolveComposerFx(input: ComposerFxInput): ComposerFxState {
  const animated = !input.reducedMotion && !input.calm;
  const base = { tier: input.tier } as const;
  if (input.voiceListening) return { ...base, layer: "voice", animated };
  // Calm mode: listening still shows (it is feedback, not decoration), the
  // keyword in the prompt is a still ember ring, and nothing else draws.
  if (input.calm) {
    if (input.keywordIdle) return { ...base, layer: "flames", animated: false };
    return { ...base, layer: "none", animated: false };
  }
  if (input.quotaFlashing && animated) return { ...base, layer: "flash", animated };
  if (input.running && input.keywordRun) return { ...base, layer: "flames", animated };
  if (input.running && input.tier !== "none") return { ...base, layer: "beam", animated };
  if (input.keywordIdle) return { ...base, layer: "flames", animated };
  if (input.idleBeam && animated) return { ...base, layer: "idle", animated };
  return { ...base, layer: "none", animated: false };
}
