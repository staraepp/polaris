import type { BotAccessory } from "@t3tools/contracts";
import type { BotAvatarProps, BotAvatarState } from "bot-avatars";

/** The assistant's bot. Rename it here; nothing else spells the name. */
export const ORBIE_NAME = "Orbie";

/** The roundest of the library's 18 shapes: Orbie is a ball. */
export const ORBIE_TYPE = "circle" as const;

/** Plush by default; tiny avatars switch to a smooth finish so fur does not turn to noise. */
export const ORBIE_SHADING = "fabric" as const;
export const ORBIE_SMALL_SHADING = "smooth" as const;
/** Below this many CSS pixels an Orbie uses the small shading. */
export const ORBIE_SMALL_BELOW_PX = 22;

/** What the thread is doing, in the words of the state mapping below. */
export type OrbieStatus = "running" | "idle" | "waiting" | "stale";

/**
 * The library state per thread status (Star's mapping): hopping while a run
 * is in progress, awake while idle, asleep while the thread waits or has gone
 * quiet. Edit here to change what Orbie does.
 */
export const ORBIE_STATE_BY_STATUS = {
  running: "working",
  idle: "default",
  waiting: "sleeping",
  stale: "sleeping",
} as const satisfies Record<OrbieStatus, BotAvatarState>;

/** Spoken after the name, per state. */
export const ORBIE_STATE_TEXT = {
  working: "is working",
  default: "is ready",
  sleeping: "is resting",
} as const satisfies Record<BotAvatarState, string>;

/** Idle this long and Orbie dozes off. */
export const ORBIE_STALE_AFTER_MS = 30 * 60 * 1000;

export function orbieStatusFor(input: {
  readonly running: boolean;
  readonly waitingOnUser: boolean;
  readonly lastActivityAt: number | null;
  readonly now: number;
}): OrbieStatus {
  if (input.running) return "running";
  if (input.waitingOnUser) return "waiting";
  if (input.lastActivityAt !== null && input.now - input.lastActivityAt >= ORBIE_STALE_AFTER_MS) {
    return "stale";
  }
  return "idle";
}

/** The library props for each accessory setting; `none` wears nothing. */
export const ORBIE_ACCESSORY_PROPS = {
  none: {},
  hat: { hat: "beanie" },
  glasses: { glasses: "round" },
  headphones: { headphones: true },
  bowTie: { bowTie: true },
} as const satisfies Record<BotAccessory, Partial<BotAvatarProps>>;

export const ORBIE_ACCESSORY_LABELS = {
  none: "Nothing",
  hat: "Hat",
  glasses: "Glasses",
  headphones: "Headphones",
  bowTie: "Bow tie",
} as const satisfies Record<BotAccessory, string>;
