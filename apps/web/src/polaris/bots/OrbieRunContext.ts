import { createContext, use } from "react";

import { useClientSettings } from "~/hooks/useSettings";

import { useCalmMode } from "../calm/useCalmMode";

import type { EffortTier } from "../fx/effortTier";

/** The open thread's running turn, for the Orbies and orbs inside its timeline. */
export interface OrbieRun {
  /** The turn's frozen effort tier (the beam's), for the color while it works. */
  readonly tier: EffortTier;
  /** The thread's project name: its bot is that project's bot. */
  readonly project: string | null;
}

export const OrbieRunContext = createContext<OrbieRun>({ tier: "neutral", project: null });

export function useOrbieRun(): OrbieRun {
  return use(OrbieRunContext);
}

/** Whether Orbie replaces the plain look (Settings → Effects → Orbie; paused in Calm mode). */
export function useOrbieEnabled(): boolean {
  const enabled = useClientSettings((settings) => settings.botAvatarsEnabled);
  const calm = useCalmMode();
  return enabled && !calm;
}

/** Whether the working and thinking rows show `thinking-orbs` (Settings → Effects). */
export function useActivityOrbsEnabled(): boolean {
  const enabled = useClientSettings((settings) => settings.activityOrbsEnabled);
  const calm = useCalmMode();
  return enabled && !calm;
}
