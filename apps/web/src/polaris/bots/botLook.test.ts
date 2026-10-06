import { BOT_AVATAR_TYPES } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { projectIconColorClassName } from "~/projectIconColors";
import { deriveProjectIdentity } from "~/projectIdentity";

import { botColorClassFor, botTypeFor } from "./botLook";
import { ORBIE_TYPE } from "./orbie";

const projects = ["polaris", "website", "notes", "game", "api", "docs", "infra", "mobile"];

describe("botTypeFor", () => {
  it("keeps Orbie a ball and gives each project a stable shape when mixed", () => {
    expect(botTypeFor(null, "mixed")).toBe(ORBIE_TYPE);
    for (const project of projects) {
      const type = botTypeFor(project, "mixed");
      expect(BOT_AVATAR_TYPES).toContain(type);
      expect(botTypeFor(project, "mixed")).toBe(type);
      // Case and padding do not change a project's bot.
      expect(botTypeFor(` ${project.toUpperCase()} `, "mixed")).toBe(type);
    }
  });

  it("varies across projects", () => {
    const shapes = new Set(projects.map((project) => botTypeFor(project, "mixed")));
    expect(shapes.size).toBeGreaterThan(3);
  });

  it("gives every bot the chosen shape when fixed", () => {
    expect(botTypeFor(null, "ghost")).toBe("ghost");
    expect(botTypeFor("polaris", "flower")).toBe("flower");
  });
});

describe("botColorClassFor", () => {
  it("wears the project's generated color when varied", () => {
    expect(botColorClassFor("polaris", "varied")).toBe(
      projectIconColorClassName(deriveProjectIdentity("polaris").color),
    );
  });

  it("keeps the brand for Orbie and in brand mode", () => {
    expect(botColorClassFor(null, "varied")).toBeNull();
    expect(botColorClassFor("polaris", "brand")).toBeNull();
  });
});
