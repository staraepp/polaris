import { lazy, Suspense, useMemo, useState } from "react";

import { useClientSettings } from "~/hooks/useSettings";

import { useCalmMode } from "../calm/useCalmMode";

import { resolveComposerFx, type ComposerFxInput, type ComposerFxState } from "./composerFxState";
import { readDevFxOverride } from "./devFxOverride";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { useWindowActive } from "./useWindowActive";

/** What ChatView knows about the turn and the quota; the composer adds the idle ring. */
export type ComposerFxSignals = Pick<
  ComposerFxInput,
  "voiceListening" | "quotaFlashing" | "running" | "tier" | "keywordRun"
>;

export const IDLE_COMPOSER_FX_SIGNALS: ComposerFxSignals = {
  voiceListening: false,
  quotaFlashing: false,
  running: false,
  tier: "neutral",
  keywordRun: false,
};

export function useComposerFx(signals: ComposerFxSignals, keywordIdle: boolean): ComposerFxState {
  const reducedMotion = usePrefersReducedMotion();
  // The idle beam is decoration: only while the window is in front of the user.
  const idleBeamSetting = useClientSettings((settings) => settings.composerIdleBeamEnabled);
  const windowActive = useWindowActive();
  const idleBeam = idleBeamSetting && windowActive;
  const calm = useCalmMode();
  // Dev builds only: forced states for screenshots (see devFxOverride.ts).
  const forced = readDevFxOverride();
  const forcedKey = forced === null ? "" : JSON.stringify(forced);
  return useMemo(() => {
    const override = forcedKey === "" ? {} : (readDevFxOverride() ?? {});
    return resolveComposerFx({
      ...signals,
      ...override,
      keywordIdle,
      idleBeam,
      reducedMotion,
      calm,
    });
  }, [signals, keywordIdle, idleBeam, reducedMotion, calm, forcedKey]);
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
// The keyword level's flames (V 5.3.0) load the first time they are needed.
const KeywordFlames = lazy(() =>
  import("./KeywordFlames").then((module) => ({ default: module.KeywordFlames })),
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
  const windowActive = useWindowActive();
  const [flamesUnavailable, setFlamesUnavailable] = useState(false);
  const flamesLive = state.layer === "flames" && state.animated && !flamesUnavailable;
  // Mounted from the first time they burn, so turning them off fades out.
  const [flamesMounted, setFlamesMounted] = useState(false);
  if (flamesLive && !flamesMounted) setFlamesMounted(true);
  // Flames that may not move, or cannot (no WebGL), are a still ember ring.
  const ringLayer =
    state.layer === "flash" || state.layer === "voice"
      ? state.layer
      : state.layer === "flames" && !flamesLive
        ? "embers"
        : "none";
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
      {flamesMounted ? (
        <Suspense fallback={null}>
          <KeywordFlames
            active={flamesLive}
            running={windowActive}
            theme={theme}
            onUnavailable={() => setFlamesUnavailable(true)}
          />
        </Suspense>
      ) : null}
      <div
        aria-hidden
        data-polaris-fx-ring
        data-layer={ringLayer}
        data-tier={state.tier}
        data-animated={state.animated ? "true" : "false"}
        className="polaris-composer-fx-ring"
      />
    </>
  );
}
