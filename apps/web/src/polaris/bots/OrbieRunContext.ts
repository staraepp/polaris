import { createContext, use } from "react";

import { useClientSettings } from "~/hooks/useSettings";

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

/** Whether Orbie replaces the plain look (Settings → Effects → Orbie). */
export function useOrbieEnabled(): boolean {
  return useClientSettings((settings) => settings.botAvatarsEnabled);
}

/** Whether the working and thinking rows show `thinking-orbs` (Settings → Effects). */
export function useActivityOrbsEnabled(): boolean {
  return useClientSettings((settings) => settings.activityOrbsEnabled);
}
