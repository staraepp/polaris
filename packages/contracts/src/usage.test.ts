import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { UsageBucket } from "./usage.ts";

const decodeBucket = Schema.decodeUnknownSync(UsageBucket);

const BUCKET = {
  day: "2026-10-01",
  provider: "claude",
  model: "claude-opus-5-5",
  totals: {
    uncachedInputTokens: 1,
    cachedInputTokens: 2,
    cacheCreationTokens: 3,
    outputTokens: 4,
    reasoningTokens: 0,
  },
  costUsd: 0.5,
  cacheSavingsUsd: 0,
  costSource: "modelPriced",
  records: 1,
  unpricedRecords: 0,
  sessions: 1,
};

describe("UsageBucket tool calls (Polaris)", () => {
  it("still decodes buckets from servers that do not count tool calls", () => {
    expect(decodeBucket(BUCKET).toolCalls).toBeUndefined();
  });

  it("decodes a tool call count and rejects negative or fractional ones", () => {
    expect(decodeBucket({ ...BUCKET, toolCalls: 7 }).toolCalls).toBe(7);
    expect(() => decodeBucket({ ...BUCKET, toolCalls: -1 })).toThrow();
    expect(() => decodeBucket({ ...BUCKET, toolCalls: 1.5 })).toThrow();
  });
});
