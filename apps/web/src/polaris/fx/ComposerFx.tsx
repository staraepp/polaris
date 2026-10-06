import { lazy, Suspense, useMemo } from "react";

import { useClientSettings } from "~/hooks/useSettings";

import { resolveComposerFx, type ComposerFxInput, type ComposerFxState } from "./composerFxState";
import { readDevFxOverride } from "./devFxOverride";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useWindowActive } from "./useWindowActive";

/** What ChatView knows about the turn and the quota; the composer adds the idle ring. */
export type ComposerFxSignals = Pick<
  ComposerFxInput,
  "voiceListening" | "quotaFlashing" | "running" | "tier"
>;

export const IDLE_COMPOSER_FX_SIGNALS: ComposerFxSignals = {
  voiceListening: false,
  quotaFlashing: false,
  running: false,
  tier: "neutral",
};

export function useComposerFx(signals: ComposerFxSignals, keywordIdle: boolean): ComposerFxState {
  const reducedMotion = usePrefersReducedMotion();
  // The idle beam is decoration: only while the window is in front of the user.
  const idleBeamSetting = useClientSettings((settings) => settings.composerIdleBeamEnabled);
  const windowActive = useWindowActive();
  const idleBeam = idleBeamSetting && windowActive;
  // Dev builds only: forced states for screenshots (see devFxOverride.ts).
  const forced = readDevFxOverride();
  const forcedKey = forced === null ? "" : JSON.stringify(forced);
  return useMemo(() => {
    const override = forcedKey === "" ? {} : (readDevFxOverride() ?? {});
    return resolveComposerFx({ ...signals, ...override, keywordIdle, idleBeam, reducedMotion });
  }, [signals, keywordIdle, idleBeam, reducedMotion, forcedKey]);
}

/**
 * The composer's one animated outline. The effort beam is the vendored
 * `border-beam` (`EffortBeam`); the quota flash and the voice ring are a 2 px
 * masked ring. Ring styles and the beam palettes live in `composerFx.css`, so a
 * theme can retune them.
 */
// `voice-glow` loads the first time voice takes the outline.
const VoiceGlow = lazy(() => import("../voice/VoiceGlow"));
// The beam's style generator stays out of the main bundle.
const EffortBeam = lazy(() =>
  import("./EffortBeam").then((module) => ({ default: module.EffortBeam })),
);

export interface ComposerVoiceGlow {
  readonly level: () => number;
  readonly processing: boolean;
  readonly theme: "light" | "dark";
}

export function ComposerFx({
  state,
  theme,
  voice = null,
}: {
  readonly state: ComposerFxState;
  readonly theme: "light" | "dark";
  /** Voice owns the outline: the reactive glow joins the ring while motion is on. */
  readonly voice?: ComposerVoiceGlow | null;
}) {
  const ring = state.layer === "flash" || state.layer === "voice";
  return (
    <>
      <Suspense fallback={null}>
        <EffortBeam
          tier={state.tier}
          active={state.layer === "beam" || state.layer === "idle"}
          idle={state.layer === "idle"}
          theme={theme}
        />
      </Suspense>
      {voice !== null && state.layer === "voice" && state.animated ? (
        <Suspense fallback={null}>
          <VoiceGlow level={voice.level} processing={voice.processing} theme={voice.theme} />
        </Suspense>
      ) : null}
      <div
        aria-hidden
        data-polaris-fx-ring
        data-layer={ring ? state.layer : "none"}
        data-tier={state.tier}
        data-animated={state.animated ? "true" : "false"}
        className="polaris-composer-fx-ring"
      />
    </>
  );
}
