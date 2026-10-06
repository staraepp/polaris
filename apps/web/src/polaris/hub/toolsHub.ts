/**
 * Polaris (V 4.6.0): the Tools hub. Skills, Import, Usage and Pull requests
 * are its subpages; they keep their own routes, and the sidebar's Tools
 * button reopens the one you used last.
 */
export const TOOLS = [
  { id: "skills", label: "Skills", path: "/skills" },
  { id: "import", label: "Import", path: "/import" },
  { id: "usage", label: "Usage", path: "/usage" },
  { id: "pull-requests", label: "Pull requests", path: "/pull-requests" },
] as const;

export type ToolId = (typeof TOOLS)[number]["id"];

const LAST_TOOL_KEY = "polaris:tools-last:v1";
const DEFAULT_TOOL: ToolId = "skills";

const isToolId = (value: unknown): value is ToolId => TOOLS.some((tool) => tool.id === value);

/** The tool a pathname belongs to, or null outside the hub. */
export function toolForPath(pathname: string): ToolId | null {
  return TOOLS.find((tool) => tool.path === pathname)?.id ?? null;
}

/**
 * The tool to open from the sidebar: the last one used, unless it is not
 * available here (pull requests need a connected source control host).
 */
export function lastTool(available: (tool: ToolId) => boolean): ToolId {
  let stored: unknown = null;
  try {
    stored = typeof localStorage === "undefined" ? null : localStorage.getItem(LAST_TOOL_KEY);
  } catch {
    stored = null;
  }
  return isToolId(stored) && available(stored) ? stored : DEFAULT_TOOL;
}

export function rememberTool(tool: ToolId): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(LAST_TOOL_KEY, tool);
  } catch {
    // Storage can be full or blocked; the sidebar then opens the default tool.
  }
}
