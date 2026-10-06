import { useNavigate } from "@tanstack/react-router";
import { ChartNoAxesColumnIcon, CheckIcon, ChevronDownIcon, DownloadIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { PullRequestGlyph } from "~/components/pullRequest/pullRequestIcons";
import { readPullRequestListPreferences } from "~/components/pullRequest/pullRequestListPreferences";
import { Button } from "~/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "~/components/ui/menu";
import {
  WorkspaceBreadcrumbItem,
  WorkspaceBreadcrumbSeparator,
} from "~/components/WorkspaceBreadcrumb";
import { usePullRequestsSupported } from "~/state/environments";

import { SkillsGlyph } from "../skills/SkillsGlyph";
import { rememberTool, TOOLS, type ToolId } from "./toolsHub";

const TOOL_ICONS = {
  skills: <SkillsGlyph />,
  import: <DownloadIcon />,
  usage: <ChartNoAxesColumnIcon />,
  "pull-requests": <PullRequestGlyph.pullRequest />,
} as const satisfies Record<ToolId, ReactNode>;

export function ToolIcon({ tool }: { readonly tool: ToolId }) {
  return TOOL_ICONS[tool];
}

/** Opens a tool's page; pull requests restore their saved list filters. */
export function useOpenTool(): (tool: ToolId) => void {
  const navigate = useNavigate();
  return (tool) => {
    if (tool === "pull-requests") {
      void navigate({ to: "/pull-requests", search: readPullRequestListPreferences() });
      return;
    }
    const path = TOOLS.find((candidate) => candidate.id === tool)?.path ?? "/skills";
    void navigate({ to: path });
  };
}

/**
 * The start of a tool page's breadcrumb (Polaris, V 4.6.0): "Tools /" and the
 * current tool as the page heading, which opens a menu of the other tools.
 * Drop it in where the page's own `<h1>` breadcrumb item was.
 */
export function ToolsHubCrumbs({
  current,
  currentItem = true,
}: {
  readonly current: ToolId;
  /** False when the page adds its own current item after this one (Usage's filter). */
  readonly currentItem?: boolean;
}) {
  const openTool = useOpenTool();
  const pullRequestsSupported = usePullRequestsSupported();
  const tools = TOOLS.filter((tool) => tool.id !== "pull-requests" || pullRequestsSupported);
  const label = TOOLS.find((tool) => tool.id === current)?.label ?? "Tools";

  useEffect(() => rememberTool(current), [current]);

  return (
    <>
      <WorkspaceBreadcrumbItem className="max-sm:hidden">Tools</WorkspaceBreadcrumbItem>
      <WorkspaceBreadcrumbSeparator className="max-sm:hidden" />
      <WorkspaceBreadcrumbItem current={currentItem} className={currentItem ? "" : "shrink-0"}>
        <h1 className="min-w-0">
          <Menu>
            <MenuTrigger
              aria-label={`${label}. Switch tool`}
              render={<Button variant="ghost" size="sm" />}
              className="-mx-2.5 min-w-0"
            >
              <span className="truncate">{label}</span>
              <ChevronDownIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            </MenuTrigger>
            <MenuPopup align="start">
              {tools.map((tool) => (
                <MenuItem
                  key={tool.id}
                  onClick={() => openTool(tool.id)}
                  aria-current={tool.id === current ? "page" : undefined}
                >
                  <ToolIcon tool={tool.id} />
                  {tool.label}
                  {tool.id === current ? <CheckIcon aria-hidden className="ms-auto" /> : null}
                </MenuItem>
              ))}
            </MenuPopup>
          </Menu>
        </h1>
      </WorkspaceBreadcrumbItem>
    </>
  );
}
