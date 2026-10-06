import type { OrbState } from "thinking-orbs";

import type { EffortTier } from "../fx/effortTier";

/**
 * Which `thinking-orbs` animation each timeline activity shows (Star picked
 * the library). Working is particles on tilted orbits; thinking is bands that
 * scramble and click back, a puzzle being solved. Edit here to swap them.
 */
export const ACTIVITY_ORB_STATE = {
  working: "working",
  thinking: "solving",
} as const satisfies Record<string, OrbState>;

export type ActivityOrbKind = keyof typeof ACTIVITY_ORB_STATE;

/** What the orb says to assistive tech, per activity. */
export const ACTIVITY_ORB_LABEL = {
  working: "Working",
  thinking: "Thinking",
} as const satisfies Record<ActivityOrbKind, string>;

/** high is the rainbow tier: the orb cycles its hue, like the beam and Orbie. */
export const ORB_RAINBOW_TIER: EffortTier = "high";

/**
 * The effort tier whose beam color the orb takes, or null for the orb's own
 * color (no run tier, the composer's plain border, or a level that did not
 * resolve).
 */
export function orbTintTier(tier: EffortTier | null): EffortTier | null {
  return tier === null || tier === "none" || tier === "neutral" ? null : tier;
}
