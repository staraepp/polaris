import { useMemo } from "react";

import { resolveComposerFx, type ComposerFxInput, type ComposerFxState } from "./composerFxState";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** What ChatView knows about the turn and the quota; the composer adds the idle ring. */
export type ComposerFxSignals = Pick<
  ComposerFxInput,
  "voiceListening" | "quotaFlashing" | "quotaLow" | "running" | "tier"
>;

export const IDLE_COMPOSER_FX_SIGNALS: ComposerFxSignals = {
  voiceListening: false,
  quotaFlashing: false,
  quotaLow: false,
  running: false,
  tier: "neutral",
};

export function useComposerFx(signals: ComposerFxSignals, keywordIdle: boolean): ComposerFxState {
  const reducedMotion = usePrefersReducedMotion();
  return useMemo(
    () => resolveComposerFx({ ...signals, keywordIdle, reducedMotion }),
    [signals, keywordIdle, reducedMotion],
  );
}

/**
 * The composer's one animated outline. Two layers: a 2 px masked ring for the
 * beam or the flash, and an unmasked amber halo for the persistent quota
 * accent, so the accent stays visible under a running beam. Styles live in
 * `composerFx.css`, keyed on the data attributes, so a theme can retune them.
 */
export function ComposerFx({ state }: { readonly state: ComposerFxState }) {
  const ring = state.layer === "beam" || state.layer === "flash" || state.layer === "voice";
  return (
    <>
      <div
        aria-hidden
        data-polaris-fx-ring
        data-layer={ring ? state.layer : "none"}
        data-tier={state.tier}
        data-animated={state.animated ? "true" : "false"}
        className="polaris-composer-fx-ring"
      />
      <div
        aria-hidden
        data-polaris-fx-accent
        data-active={state.accent ? "true" : "false"}
        className="polaris-composer-fx-accent"
      />
    </>
  );
}
