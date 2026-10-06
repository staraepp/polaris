import { describe, expect, it } from "vite-plus/test";

import { usernameProblem } from "./username";

describe("usernameProblem", () => {
  it("accepts short plain names, trimmed", () => {
    expect(usernameProblem("star")).toBeNull();
    expect(usernameProblem("  breno.m_1  ")).toBeNull();
  });

  it("explains what is wrong", () => {
    expect(usernameProblem("")).toMatch(/Pick a username/);
    expect(usernameProblem("a")).toMatch(/at least 2/);
    expect(usernameProblem("x".repeat(25))).toMatch(/24 characters/);
    expect(usernameProblem("two words")).toMatch(/no spaces/);
  });
});
