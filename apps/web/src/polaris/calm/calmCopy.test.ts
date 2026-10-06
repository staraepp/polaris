import { describe, expect, it } from "vite-plus/test";

import { CALM_COPY, calmGreeting, calmPlaceholder, calmT3ImportTitle } from "./calmCopy";

describe("Calm mode wording", () => {
  it("greets by name when there is one", () => {
    expect(calmGreeting("Good morning", "Star")).toBe("Good morning, Star");
    expect(calmGreeting("Good morning", "  ")).toBe("Good morning");
    expect(calmGreeting("Good morning", "")).toBe("Good morning");
  });

  it("asks on a new thread and says Reply in an existing one", () => {
    expect(calmPlaceholder("draft")).toBe(CALM_COPY.newThreadPlaceholder);
    expect(calmPlaceholder("server")).toBe(CALM_COPY.replyPlaceholder);
  });

  it("counts T3 Code threads in one line", () => {
    expect(calmT3ImportTitle(1)).toBe("You have 1 thread in T3 Code");
    expect(calmT3ImportTitle(64)).toBe("You have 64 threads in T3 Code");
  });
});
