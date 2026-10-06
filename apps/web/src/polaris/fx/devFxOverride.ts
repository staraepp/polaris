import type { EffortTier } from "./effortTier";

/**
 * Dev builds only: force the composer's FX signals for screenshots, without a
 * real agent turn (which would spend quota). In the dev app's console:
 *
 *   localStorage.setItem("polaris:fx-force", '{"running":true,"tier":"max"}')
 *
 * then reload; remove the key to go back. Production builds never read it.
 */
export const DEV_FX_OVERRIDE_KEY = "polaris:fx-force";

export interface DevFxOverride {
  readonly voiceListening?: boolean;
  readonly quotaFlashing?: boolean;
  readonly quotaLow?: boolean;
  readonly running?: boolean;
  readonly keywordRun?: boolean;
  readonly tier?: EffortTier;
}

const TIERS: readonly EffortTier[] = ["none", "low", "medium", "high", "xhigh", "max", "neutral"];
const isEffortTier = (value: unknown): value is EffortTier => TIERS.some((tier) => tier === value);
const FLAGS = ["voiceListening", "quotaFlashing", "quotaLow", "running", "keywordRun"] as const;

/** Keeps only the known fields with the right types; anything else is dropped. */
export function parseDevFxOverride(raw: string | null): DevFxOverride | null {
  if (raw === null || raw.trim() === "") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const override: { -readonly [K in keyof DevFxOverride]: DevFxOverride[K] } = {};
  for (const flag of FLAGS) {
    const flagValue = record[flag];
    if (typeof flagValue === "boolean") override[flag] = flagValue;
  }
  if (isEffortTier(record.tier)) override.tier = record.tier;
  return Object.keys(override).length > 0 ? override : null;
}

export function readDevFxOverride(): DevFxOverride | null {
  if (!import.meta.env.DEV || typeof localStorage === "undefined") return null;
  try {
    return parseDevFxOverride(localStorage.getItem(DEV_FX_OVERRIDE_KEY));
  } catch {
    return null;
  }
}
