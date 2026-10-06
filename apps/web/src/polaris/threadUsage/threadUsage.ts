/**
 * Per-thread usage, derived on the client from the thread projection (Polaris).
 *
 * Tokens come from each provider turn's `turnTokenUsage` (the main agent's
 * report at turn end); tool calls are the tool-shaped turn items of each run.
 * Only what the projection holds is counted, so a thread whose earlier history
 * is not loaded reports the loaded part.
 */
import type { TurnTokenUsage } from "@t3tools/contracts";

/** Turn item types that stand for a tool the agent called. */
export const THREAD_TOOL_ITEM_TYPES: ReadonlySet<string> = new Set([
  "command_execution",
  "file_change",
  "file_search",
  "web_search",
  "dynamic_tool",
  "subagent",
]);

export interface ThreadUsageInput {
  readonly runs: readonly { readonly id: string; readonly ordinal: number }[];
  readonly nodes: readonly { readonly id: string; readonly runId: string | null }[];
  readonly providerTurns: readonly {
    readonly nodeId: string;
    readonly turnTokenUsage?: TurnTokenUsage | undefined;
  }[];
  readonly turnItems: readonly { readonly runId: string | null; readonly type: string }[];
}

export interface RunUsage {
  readonly runId: string;
  readonly ordinal: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly toolCalls: number;
  /** True when no provider turn of the run reported complete usage. */
  readonly tokensUnknown: boolean;
}

export interface ThreadUsage {
  readonly runs: readonly RunUsage[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly toolCalls: number;
  /** Runs with at least one complete token report. */
  readonly runsWithTokens: number;
}

export function deriveThreadUsage(projection: ThreadUsageInput): ThreadUsage {
  const runByNode = new Map<string, string>();
  for (const node of projection.nodes) {
    if (node.runId !== null) runByNode.set(node.id, node.runId);
  }

  const tokens = new Map<string, { input: number; output: number; complete: boolean }>();
  for (const turn of projection.providerTurns) {
    const runId = runByNode.get(turn.nodeId);
    const usage = turn.turnTokenUsage;
    if (runId === undefined || usage === undefined) continue;
    const entry = tokens.get(runId) ?? { input: 0, output: 0, complete: false };
    entry.input += usage.inputTokens ?? 0;
    entry.output += usage.outputTokens ?? 0;
    if (usage.usageStatus === "complete") entry.complete = true;
    tokens.set(runId, entry);
  }

  const tools = new Map<string, number>();
  for (const item of projection.turnItems) {
    if (item.runId === null || !THREAD_TOOL_ITEM_TYPES.has(item.type)) continue;
    tools.set(item.runId, (tools.get(item.runId) ?? 0) + 1);
  }

  const runs = projection.runs
    .map((run): RunUsage => {
      const entry = tokens.get(run.id);
      return {
        runId: run.id,
        ordinal: run.ordinal,
        inputTokens: entry?.input ?? 0,
        outputTokens: entry?.output ?? 0,
        toolCalls: tools.get(run.id) ?? 0,
        tokensUnknown: entry === undefined || (!entry.complete && entry.input + entry.output === 0),
      };
    })
    .toSorted((a, b) => a.ordinal - b.ordinal);

  return {
    runs,
    inputTokens: runs.reduce((sum, run) => sum + run.inputTokens, 0),
    outputTokens: runs.reduce((sum, run) => sum + run.outputTokens, 0),
    toolCalls: runs.reduce((sum, run) => sum + run.toolCalls, 0),
    runsWithTokens: runs.filter((run) => !run.tokensUnknown).length,
  };
}

/** Value equality, so callers can keep one object while nothing changed. */
export function sameThreadUsage(a: ThreadUsage | null, b: ThreadUsage | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (
    a.inputTokens !== b.inputTokens ||
    a.outputTokens !== b.outputTokens ||
    a.toolCalls !== b.toolCalls ||
    a.runsWithTokens !== b.runsWithTokens ||
    a.runs.length !== b.runs.length
  ) {
    return false;
  }
  return a.runs.every((run, index) => {
    const other = b.runs[index];
    return (
      other !== undefined &&
      run.runId === other.runId &&
      run.inputTokens === other.inputTokens &&
      run.outputTokens === other.outputTokens &&
      run.toolCalls === other.toolCalls &&
      run.tokensUnknown === other.tokensUnknown
    );
  });
}
