import type { ServerProviderSkill } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  groupStudioSkills,
  displaySkillPath,
  newSkillDocument,
  newSkillRelativePath,
  readSkillFrontmatter,
  skillBody,
  skillFilePath,
  slugifySkillName,
  workspaceRelativePath,
} from "./skillStudio";

const skill = (name: string, path: string, scope?: string): ServerProviderSkill => ({
  name,
  path,
  enabled: true,
  ...(scope ? { scope } : {}),
});

describe("skill studio", () => {
  it("finds SKILL.md and keeps writes inside the workspace", () => {
    expect(skillFilePath("/w/.claude/skills/a")).toBe("/w/.claude/skills/a/SKILL.md");
    expect(skillFilePath("/w/.claude/skills/a/SKILL.md")).toBe("/w/.claude/skills/a/SKILL.md");
    expect(workspaceRelativePath("/w/.claude/skills/a/SKILL.md", "/w/")).toBe(
      ".claude/skills/a/SKILL.md",
    );
    expect(workspaceRelativePath("/home/me/.claude/skills/a/SKILL.md", "/w")).toBeNull();
    expect(workspaceRelativePath("/w-other/x/SKILL.md", "/w")).toBeNull();
    expect(workspaceRelativePath("/w/a/SKILL.md", null)).toBeNull();
    expect(displaySkillPath("/Users/someone/.claude/skills/a/SKILL.md")).toBe(
      "~/.claude/skills/a/SKILL.md",
    );
    expect(displaySkillPath("/opt/skills/a/SKILL.md")).toBe("/opt/skills/a/SKILL.md");
  });

  it("groups by source with the workspace first, filtered and sorted", () => {
    const groups = groupStudioSkills(
      [
        skill("zeta", "/home/me/.claude/skills/zeta", "user"),
        skill("beta", "/w/.claude/skills/beta", "user"),
        skill("alpha", "/w/.agents/skills/alpha"),
        skill("alpha", "/w/.agents/skills/alpha"),
        skill("sys", "/opt/skills/sys", "system"),
      ],
      "/w",
    );
    expect(groups.map((group) => group.kind)).toEqual(["project", "personal", "system"]);
    expect(groups[0]?.skills.map((entry) => entry.skill.name)).toEqual(["alpha", "beta"]);
    expect(groups[0]?.skills[0]?.relativeFile).toBe(".agents/skills/alpha/SKILL.md");
    expect(groups[1]?.skills[0]?.relativeFile).toBeNull();
    expect(groups[1]?.skills[0]?.readPath).toBe("/home/me/.claude/skills/zeta/SKILL.md");
    expect(groupStudioSkills([skill("zeta", "/x/zeta")], "/w", "nope")).toEqual([]);
  });

  it("writes a new skill with frontmatter the providers read", () => {
    expect(slugifySkillName("  Frontend Design: Review! ")).toBe("frontend-design-review");
    expect(newSkillRelativePath("agents", "my-skill")).toBe(".agents/skills/my-skill/SKILL.md");
    const document = newSkillDocument({
      slug: "my-skill",
      description: "Use it\nwell",
      body: "---\nname: old\ndescription: old\n---\n\n# Body",
    });
    expect(document).toBe('---\nname: my-skill\ndescription: "Use it well"\n---\n\n# Body\n');
    expect(readSkillFrontmatter(document)).toEqual({
      name: "my-skill",
      description: "Use it well",
    });
  });

  it("drops the frontmatter for the preview, and only the frontmatter", () => {
    expect(skillBody("---\nname: a\ndescription: b\n---\n\n# Title\n\nText\n")).toBe(
      "# Title\n\nText",
    );
    expect(skillBody("---\r\nname: a\r\n---\r\n# Title")).toBe("# Title");
    expect(skillBody("# No frontmatter\n\n---\n\nA rule above.")).toBe(
      "# No frontmatter\n\n---\n\nA rule above.",
    );
  });
});
