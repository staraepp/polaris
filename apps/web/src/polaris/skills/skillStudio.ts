import type { ServerProviderSkill } from "@t3tools/contracts";
import {
  formatProviderSkillDisplayName,
  type ProviderSkillSourceKind,
  resolveProviderSkillSourceKind,
} from "@t3tools/client-runtime/providerSkills";

/** Where a new skill is written inside the workspace. */
export const SKILL_LOCATIONS = [
  { id: "claude", dir: ".claude/skills", label: ".claude/skills (Claude Code)" },
  { id: "agents", dir: ".agents/skills", label: ".agents/skills (Codex and others)" },
] as const;
export type SkillLocationId = (typeof SKILL_LOCATIONS)[number]["id"];

const GROUP_ORDER: readonly ProviderSkillSourceKind[] = [
  "project",
  "repo",
  "personal",
  "app",
  "system",
  "other",
];

export const SKILL_GROUP_LABEL: Record<ProviderSkillSourceKind, string> = {
  project: "This project",
  repo: "Repository",
  personal: "Personal",
  app: "Plugins",
  system: "Built into the provider",
  other: "Other",
};

export interface StudioSkill {
  readonly skill: ServerProviderSkill;
  readonly key: string;
  readonly label: string;
  /** SKILL.md as a workspace-relative path; null outside the workspace (read-only). */
  readonly relativeFile: string | null;
  /** SKILL.md as the server reads it: relative when inside the workspace. */
  readonly readPath: string;
}

export interface StudioSkillGroup {
  readonly kind: ProviderSkillSourceKind;
  readonly label: string;
  readonly skills: readonly StudioSkill[];
}

const normalize = (path: string) => path.replaceAll("\\", "/").replace(/\/+$/, "");

/** The skill's SKILL.md: providers report either the file or its folder. */
export function skillFilePath(path: string): string {
  const clean = normalize(path);
  return /\/SKILL\.md$/i.test(clean) || /\.md$/i.test(clean) ? clean : `${clean}/SKILL.md`;
}

/** `file` relative to `root`, or null when it lies outside it. */
export function workspaceRelativePath(file: string, root: string | null): string | null {
  if (root === null) return null;
  const base = `${normalize(root)}/`;
  const clean = normalize(file);
  if (!clean.startsWith(base)) return null;
  const relative = clean.slice(base.length);
  return relative.length > 0 && !relative.split("/").includes("..") ? relative : null;
}

/** Skills grouped by where they come from, project first, each group by name. */
export function groupStudioSkills(
  skills: readonly ServerProviderSkill[],
  workspaceRoot: string | null,
  query = "",
): readonly StudioSkillGroup[] {
  const needle = query.trim().toLowerCase();
  const byKind = new Map<ProviderSkillSourceKind, StudioSkill[]>();
  for (const skill of skills) {
    const label = formatProviderSkillDisplayName(skill);
    if (
      needle.length > 0 &&
      !`${skill.name} ${label} ${skill.description ?? ""}`.toLowerCase().includes(needle)
    ) {
      continue;
    }
    const file = skillFilePath(skill.path);
    const relativeFile = workspaceRelativePath(file, workspaceRoot);
    // A file inside the workspace is the project's, whatever scope the provider gave it.
    const kind = relativeFile !== null ? "project" : resolveProviderSkillSourceKind(skill);
    const entry: StudioSkill = {
      skill,
      key: `${kind}:${file}`,
      label,
      relativeFile,
      readPath: relativeFile ?? file,
    };
    byKind.set(kind, [...(byKind.get(kind) ?? []), entry]);
  }
  return GROUP_ORDER.flatMap((kind) => {
    const entries = byKind.get(kind);
    if (entries === undefined) return [];
    const unique = [...new Map(entries.map((entry) => [entry.key, entry])).values()];
    return [
      {
        kind,
        label: SKILL_GROUP_LABEL[kind],
        skills: unique.toSorted((left, right) => left.label.localeCompare(right.label)),
      },
    ];
  });
}

/** A path for display, with the user's home folder shortened to `~`. */
export function displaySkillPath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^(\/Users|\/home)\/[^/]+(?=\/)/, "~");
}

/** A folder-safe skill name: lowercase words joined by hyphens. */
export function slugifySkillName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Where a new skill's SKILL.md goes inside the workspace. */
export function newSkillRelativePath(location: SkillLocationId, slug: string): string {
  const dir = SKILL_LOCATIONS.find((entry) => entry.id === location)?.dir ?? ".claude/skills";
  return `${dir}/${slug}/SKILL.md`;
}

const yamlString = (value: string) => JSON.stringify(value.replace(/\s+/g, " ").trim());

/** A SKILL.md without its frontmatter: the part a person reads. */
export function skillBody(document: string): string {
  return document.replace(/^---\r?\n[\s\S]*?\r?\n---[^\S\r\n]*(?:\r?\n)*/, "").trim();
}

/**
 * A SKILL.md with the frontmatter both Claude Code and Codex read. A
 * template's own frontmatter is replaced so the chosen name wins.
 */
export function newSkillDocument(input: {
  readonly slug: string;
  readonly description: string;
  readonly body: string;
}): string {
  const body = skillBody(input.body);
  return [
    "---",
    `name: ${input.slug}`,
    `description: ${yamlString(input.description)}`,
    "---",
    "",
    body.length > 0
      ? body
      : `# ${input.slug}\n\nDescribe when to use this skill and the steps to follow.`,
    "",
  ].join("\n");
}

/** `name` and `description` from a SKILL.md's frontmatter, for templates. */
export function readSkillFrontmatter(document: string): {
  readonly name: string | null;
  readonly description: string | null;
} {
  const match = /^---\n([\s\S]*?)\n---/.exec(document);
  const field = (key: string) => {
    const line = match?.[1]?.split("\n").find((entry) => entry.startsWith(`${key}:`));
    if (line === undefined) return null;
    const raw = line.slice(key.length + 1).trim();
    return raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  };
  return { name: field("name"), description: field("description") };
}
