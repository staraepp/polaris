import { describe, expect, it } from "vite-plus/test";

import { botLookFor, defaultBotType } from "./botConfig";
import { BOT_STALE_AFTER_MS, botStateFor } from "./botState";

describe("botStateFor", () => {
  const now = 10 * BOT_STALE_AFTER_MS;
  it("works during a run, even on an old thread", () => {
    expect(botStateFor({ running: true, waitingOnUser: false, lastActivityAt: 0, now })).toBe(
      "working",
    );
  });

  it("stays awake while waiting on the user and sleeps once the thread is stale", () => {
    expect(botStateFor({ running: false, waitingOnUser: true, lastActivityAt: 0, now })).toBe(
      "default",
    );
    expect(botStateFor({ running: false, waitingOnUser: false, lastActivityAt: 0, now })).toBe(
      "sleeping",
    );
    expect(
      botStateFor({ running: false, waitingOnUser: false, lastActivityAt: now - 1000, now }),
    ).toBe("default");
    expect(botStateFor({ running: false, waitingOnUser: false, lastActivityAt: null, now })).toBe(
      "default",
    );
  });
});

describe("botLookFor", () => {
  it("uses the provider's bot and color, a user pick and a theme-aware neutral", () => {
    expect(botLookFor("claudeAgent", {}, "dark")).toEqual({ type: "star", color: "#d97757" });
    expect(botLookFor("claudeAgent", { claudeAgent: "cat" }, "light").type).toBe("cat");
    expect(botLookFor("codex", {}, "light").color).not.toBe(botLookFor("codex", {}, "dark").color);
    expect(botLookFor(null, {}, "light").type).toBe("clover");
    expect(defaultBotType("someNewDriver")).toBe("clover");
  });
});
