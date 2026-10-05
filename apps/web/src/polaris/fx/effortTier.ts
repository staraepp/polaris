import type { OrchestrationV2Run, ServerProvider } from "@t3tools/contracts";
import {
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
  isClaudeUltrathinkPrompt,
} from "@t3tools/shared/model";

import { getProviderModelCapabilities } from "~/providerModels";

/** Beam tiers. Keyed on tiers, never on a provider's own level names. */
export type EffortTier = "none" | "low" | "medium" | "high" | "xhigh" | "max" | "neutral";

const LADDER = ["low", "medium", "high", "xhigh", "max"] as const satisfies readonly EffortTier[];

const EXPLICIT_TIERS: Readonly<Record<string, EffortTier>> = {
  off: "none",
  none: "none",
  minimal: "low",
  low: "low",
  medium: "medium",
  high: "high",
  xhigh: "xhigh",
  "extra high": "xhigh",
  extrahigh: "xhigh",
  max: "max",
};

function normalizeLevel(levelId: string): string {
  return levelId
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, " ");
}

function isKeywordStyle(levelId: string): boolean {
  return normalizeLevel(levelId).startsWith("ultra");
}

/**
 * Tier for a picker level. Explicit names always win and any "ultra…" level is
 * max; only unknown names fall back to their position in the provider's own
 * ordered list, so its lowest level looks low and its highest max.
 */
export function tierForLevel(
  levelId: string | null | undefined,
  orderedLevelIds: readonly string[],
): EffortTier {
  if (levelId === null || levelId === undefined || levelId.trim() === "") return "neutral";
  const normalized = normalizeLevel(levelId);
  if (normalized.startsWith("ultra")) return "max";
  const explicit = EXPLICIT_TIERS[normalized];
  if (explicit !== undefined) return explicit;
  const ladder = orderedLevelIds.filter((id) => {
    const key = normalizeLevel(id);
    return key !== "off" && key !== "none" && !isKeywordStyle(id);
  });
  const index = ladder.findIndex((id) => normalizeLevel(id) === normalized);
  if (index < 0) return "neutral";
  const count = ladder.length;
  if (count === 1) return "medium";
  // Integer form of round-half-up(index / (count - 1) * 4), clamped to the ladder.
  const slot = Math.floor((8 * index + count - 1) / (2 * (count - 1)));
  return LADDER[Math.max(0, Math.min(LADDER.length - 1, slot))] ?? "neutral";
}

export interface RunEffort {
  readonly tier: EffortTier;
  /** The level id the turn was sent with, after the keyword override. */
  readonly levelId: string | null;
  readonly keyword: boolean;
}

export const NEUTRAL_RUN_EFFORT: RunEffort = { tier: "neutral", levelId: null, keyword: false };

/**
 * Derived on read from what the run stored: its model selection and, for the
 * keyword override, the text of the user message it was sent with. Nothing is
 * persisted, so a picker change after sending never recolors a running beam.
 */
export function resolveRunEffort(input: {
  readonly run: Pick<OrchestrationV2Run, "modelSelection"> | null;
  readonly providers: readonly ServerProvider[];
  readonly messageText: string | null;
}): RunEffort {
  const run = input.run;
  if (run === null) return NEUTRAL_RUN_EFFORT;
  const provider = input.providers.find(
    (candidate) => candidate.instanceId === run.modelSelection.instanceId,
  );
  if (provider === undefined) return NEUTRAL_RUN_EFFORT;
  const caps = getProviderModelCapabilities(
    provider.models,
    run.modelSelection.model,
    provider.driver,
  );
  const descriptors = getProviderOptionDescriptors({
    caps,
    selections: run.modelSelection.options,
  });
  const select = descriptors.find((descriptor) => descriptor.type === "select");
  if (select === undefined) return NEUTRAL_RUN_EFFORT;
  const injected = select.promptInjectedValues ?? [];
  const keyword = injected.length > 0 && isClaudeUltrathinkPrompt(input.messageText);
  if (keyword) return { tier: "max", levelId: injected[0] ?? null, keyword: true };
  const current = getProviderOptionCurrentValue(select);
  const levelId = typeof current === "string" ? current : null;
  return {
    tier: tierForLevel(
      levelId,
      select.options.map((option) => option.id),
    ),
    levelId,
    keyword: false,
  };
}
