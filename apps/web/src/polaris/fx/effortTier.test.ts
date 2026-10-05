import type { OrchestrationV2Run, ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { resolveRunEffort, tierForLevel } from "./effortTier";

describe("tierForLevel", () => {
  const claude = ["low", "medium", "high", "xhigh", "max", "ultrathink"];

  it("maps the decided names one to one", () => {
    expect(
      ["off", "none", "minimal", "low", "medium", "high", "xhigh", "max"].map((id) =>
        tierForLevel(id, claude),
      ),
    ).toEqual(["none", "none", "low", "low", "medium", "high", "xhigh", "max"]);
  });

  it("treats any ultra-prefixed level as max and ignores case and spacing", () => {
    expect(tierForLevel("ultracode", claude)).toBe("max");
    expect(tierForLevel("ULTRATHINK", claude)).toBe("max");
    expect(tierForLevel("Extra High", ["low", "Extra High"])).toBe("xhigh");
    expect(tierForLevel("extra_high", [])).toBe("xhigh");
  });

  it("falls back by position for unknown names, dropping off/none and keyword levels", () => {
    expect(
      ["fast", "balanced", "deep"].map((id) =>
        tierForLevel(id, ["off", "fast", "balanced", "deep", "ultradeep"]),
      ),
    ).toEqual(["low", "high", "max"]);
    expect(tierForLevel("only", ["only"])).toBe("medium");
    const seven = ["a", "b", "c", "d", "e", "f", "g"];
    expect(seven.map((id) => tierForLevel(id, seven))).toEqual([
      "low",
      "medium",
      "medium",
      "high",
      "xhigh",
      "xhigh",
      "max",
    ]);
    const four = ["a", "b", "c", "d"];
    expect(four.map((id) => tierForLevel(id, four))).toEqual(["low", "medium", "xhigh", "max"]);
  });

  it("is neutral for a missing level or one the provider does not list", () => {
    expect(tierForLevel(null, claude)).toBe("neutral");
    expect(tierForLevel("", claude)).toBe("neutral");
    expect(tierForLevel("mystery", claude)).toBe("neutral");
  });
});

describe("resolveRunEffort", () => {
  const provider = {
    instanceId: "claude",
    driver: "claudeAgent",
    models: [
      {
        slug: "claude-opus-5-5",
        capabilities: {
          optionDescriptors: [
            {
              id: "effort",
              label: "Effort",
              type: "select",
              options: [
                { id: "low", label: "Low" },
                { id: "medium", label: "Medium", isDefault: true },
                { id: "high", label: "High" },
                { id: "max", label: "Max" },
                { id: "ultrathink", label: "Ultrathink" },
              ],
              promptInjectedValues: ["ultrathink"],
            },
          ],
        },
      },
    ],
  } as unknown as ServerProvider;
  const codex = {
    instanceId: "codex",
    driver: "codex",
    models: [{ slug: "gpt-6", capabilities: {} }],
  } as unknown as ServerProvider;
  const run = (instanceId: string, model: string, options?: { id: string; value: string }[]) =>
    ({ modelSelection: { instanceId, model, options } }) as unknown as Pick<
      OrchestrationV2Run,
      "modelSelection"
    >;

  it("reads the level the run was sent with", () => {
    expect(
      resolveRunEffort({
        run: run("claude", "claude-opus-5-5", [{ id: "effort", value: "high" }]),
        providers: [provider, codex],
        messageText: "Refactor this",
      }),
    ).toEqual({ tier: "high", levelId: "high", keyword: false });
  });

  it("uses the model default when the run stored no explicit option", () => {
    expect(
      resolveRunEffort({
        run: run("claude", "claude-opus-5-5"),
        providers: [provider],
        messageText: "hi",
      }).tier,
    ).toBe("medium");
  });

  it("lets the keyword in the sent text override the stored level", () => {
    const effort = resolveRunEffort({
      run: run("claude", "claude-opus-5-5", [{ id: "effort", value: "low" }]),
      providers: [provider],
      messageText: "Ultrathink about the migration plan",
    });
    expect(effort).toEqual({ tier: "max", levelId: "ultrathink", keyword: true });
  });

  it("ignores the keyword on a model that does not list it", () => {
    const noKeyword = {
      ...provider,
      instanceId: "claude-old",
      models: [
        {
          slug: "claude-opus-5-5",
          capabilities: {
            optionDescriptors: [
              {
                id: "effort",
                label: "Effort",
                type: "select",
                options: [{ id: "low", label: "Low", isDefault: true }],
              },
            ],
          },
        },
      ],
    } as unknown as ServerProvider;
    expect(
      resolveRunEffort({
        run: run("claude-old", "claude-opus-5-5"),
        providers: [noKeyword],
        messageText: "ultrathink please",
      }),
    ).toEqual({ tier: "low", levelId: "low", keyword: false });
  });

  it("is neutral without a run, provider or effort option", () => {
    expect(resolveRunEffort({ run: null, providers: [provider], messageText: null }).tier).toBe(
      "neutral",
    );
    expect(
      resolveRunEffort({ run: run("missing", "m"), providers: [provider], messageText: null }).tier,
    ).toBe("neutral");
    expect(
      resolveRunEffort({ run: run("codex", "gpt-6"), providers: [codex], messageText: null }).tier,
    ).toBe("neutral");
  });
});
