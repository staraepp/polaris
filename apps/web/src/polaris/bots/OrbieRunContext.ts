import { createContext, use } from "react";

import { useClientSettings } from "~/hooks/useSettings";

import type { EffortTier } from "../fx/effortTier";

/** The open thread's running turn, for the Orbies inside its timeline. */
export interface OrbieRun {
  /** The turn's frozen effort tier (the beam's), for Orbie's color while it works. */
  readonly tier: EffortTier;
}

export const OrbieRunContext = createContext<OrbieRun>({ tier: "neutral" });

export function useOrbieRun(): OrbieRun {
  return use(OrbieRunContext);
}

/** Whether Orbie replaces the plain look (Settings → General → Orbie). */
export function useOrbieEnabled(): boolean {
  return useClientSettings((settings) => settings.botAvatarsEnabled);
}
