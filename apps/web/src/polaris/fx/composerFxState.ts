import type { EffortTier } from "./effortTier";

/** Which single animated effect owns the composer outline right now. */
export type ComposerFxLayer = "voice" | "flash" | "beam" | "ring" | "none";

export interface ComposerFxInput {
  /** Reserved for the voice provider (v2); the web composer has no voice capture yet. */
  readonly voiceListening: boolean;
  readonly quotaFlashing: boolean;
  readonly quotaLow: boolean;
  readonly running: boolean;
  readonly tier: EffortTier;
  /** Upstream's static ring: the prompt text contains the keyword level while idle. */
  readonly keywordIdle: boolean;
  readonly reducedMotion: boolean;
}

export interface ComposerFxState {
  readonly layer: ComposerFxLayer;
  readonly tier: EffortTier;
  /** The persistent amber quota accent, drawn under whatever layer is active. */
  readonly accent: boolean;
  /** False under reduced motion: the layer is drawn static instead. */
  readonly animated: boolean;
}

/**
 * Priority, highest first: voice listening, the quota-low flash, the effort
 * beam of the running turn, then the idle keyword ring. Only one layer at a
 * time; the quota accent is static, so it may sit under any of them.
 */
export function resolveComposerFx(input: ComposerFxInput): ComposerFxState {
  const animated = !input.reducedMotion;
  const base = { tier: input.tier, accent: input.quotaLow } as const;
  if (input.voiceListening) return { ...base, layer: "voice", animated };
  if (input.quotaFlashing && animated) return { ...base, layer: "flash", animated };
  if (input.running && input.tier !== "none") return { ...base, layer: "beam", animated };
  if (input.keywordIdle) return { ...base, layer: "ring", animated: false };
  return { ...base, layer: "none", animated: false };
}
