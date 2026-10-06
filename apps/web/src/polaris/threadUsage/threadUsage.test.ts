import { describe, expect, it } from "vite-plus/test";

import { deriveThreadUsage, sameThreadUsage, type ThreadUsageInput } from "./threadUsage";

const complete = (inputTokens: number, outputTokens: number) => ({
  usageScope: "main_agent" as const,
  usageStatus: "complete" as const,
  hasSubagents: false,
  inputTokens,
  outputTokens,
});

const PROJECTION: ThreadUsageInput = {
  runs: [
    { id: "run-2", ordinal: 2 },
    { id: "run-1", ordinal: 1 },
    { id: "run-3", ordinal: 3 },
  ],
  nodes: [
    { id: "node-1", runId: "run-1" },
    { id: "node-1b", runId: "run-1" },
    { id: "node-2", runId: "run-2" },
    { id: "node-x", runId: null },
  ],
  providerTurns: [
    { nodeId: "node-1", turnTokenUsage: complete(100, 20) },
    { nodeId: "node-1b", turnTokenUsage: complete(50, 5) },
    {
      nodeId: "node-2",
      turnTokenUsage: {
        usageScope: "main_agent",
        usageStatus: "unavailable",
        hasSubagents: false,
      },
    },
    { nodeId: "node-x", turnTokenUsage: complete(999, 999) },
  ],
  turnItems: [
    { runId: "run-1", type: "command_execution" },
    { runId: "run-1", type: "assistant_message" },
    { runId: "run-1", type: "file_change" },
    { runId: "run-2", type: "dynamic_tool" },
    { runId: null, type: "command_execution" },
  ],
};

describe("deriveThreadUsage", () => {
  it("sums tokens per run through its nodes and orders runs", () => {
    const usage = deriveThreadUsage(PROJECTION);
    expect(usage.runs.map((run) => run.runId)).toEqual(["run-1", "run-2", "run-3"]);
    expect(usage.runs[0]).toMatchObject({ inputTokens: 150, outputTokens: 25, toolCalls: 2 });
    expect(usage.inputTokens).toBe(150);
    expect(usage.outputTokens).toBe(25);
  });

  it("counts only tool-shaped items and flags runs without a token report", () => {
    const usage = deriveThreadUsage(PROJECTION);
    expect(usage.toolCalls).toBe(3);
    expect(usage.runs.map((run) => run.tokensUnknown)).toEqual([false, true, true]);
    expect(usage.runsWithTokens).toBe(1);
  });

  it("is empty for a thread with no runs", () => {
    expect(
      deriveThreadUsage({ runs: [], nodes: [], providerTurns: [], turnItems: [] }),
    ).toMatchObject({ runs: [], toolCalls: 0, runsWithTokens: 0 });
  });

  it("treats equal figures as the same usage", () => {
    expect(sameThreadUsage(deriveThreadUsage(PROJECTION), deriveThreadUsage(PROJECTION))).toBe(
      true,
    );
    const changed = {
      ...PROJECTION,
      turnItems: [...PROJECTION.turnItems, { runId: "run-3", type: "web_search" }],
    };
    expect(sameThreadUsage(deriveThreadUsage(PROJECTION), deriveThreadUsage(changed))).toBe(false);
    expect(sameThreadUsage(null, deriveThreadUsage(PROJECTION))).toBe(false);
  });
});
