import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo } from "react";

import { Button } from "~/components/ui/button";
import { RefreshIcon } from "~/components/ui/refresh-icon";
import { ScrollArea } from "~/components/ui/scroll-area";
import { SidebarInset } from "~/components/ui/sidebar";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { ToolsHubCrumbs } from "~/polaris/hub/ToolsHubCrumbs";
import { isElectron } from "~/env";
import { useEscapeToGoBack } from "~/hooks/useNavigateBack";
import { useProjectScans } from "~/onboarding/useProjectScans";
import { usePrimaryEnvironmentId } from "~/state/environments";

import { HubTabPanel, HubTabs, type HubTab } from "../hub/HubTabs";
import { SessionsPanel } from "./SessionsPanel";
import { T3HistoryPanel } from "./T3HistoryPanel";
import { useT3HistoryScan } from "./useT3HistoryScan";

const NO_ENVIRONMENTS: readonly EnvironmentId[] = [];

type ImportSource = "sessions" | "t3";
const SOURCES: readonly HubTab<ImportSource>[] = [
  { id: "sessions", label: "Claude Code & Codex" },
  { id: "t3", label: "T3 Code" },
];

/**
 * Import any time (Polaris): bring threads in from the agent CLIs' session
 * files or from the T3 Code app. Only this computer's server is scanned.
 */
export function ImportSessionsPage() {
  useEscapeToGoBack();
  const navigate = useNavigate();
  const search = useSearch({ from: "/import" });
  const source: ImportSource = search.source === "t3" ? "t3" : "sessions";

  const environmentId = usePrimaryEnvironmentId();
  const environmentIds = useMemo(
    () => (environmentId === null ? NO_ENVIRONMENTS : [environmentId]),
    [environmentId],
  );
  const scan = useProjectScans(environmentIds)[0] ?? null;
  const t3Scan = useT3HistoryScan(environmentId);
  const scanning = source === "t3" ? t3Scan.isPending : scan !== null && scan.isPending;

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Import breadcrumb" className="min-w-0 flex-1">
            <ToolsHubCrumbs current="import" />
          </WorkspaceBreadcrumb>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={scanning ? "Looking again" : "Look again"}
            disabled={environmentId === null || scanning}
            onClick={() => (source === "t3" ? t3Scan.refresh() : scan?.refresh())}
          >
            <RefreshIcon refreshing={scanning} />
          </Button>
        </WorkspacePageHeader>

        <ScrollArea scrollFade className="min-h-0 flex-1">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8">
            <HubTabs
              tabs={SOURCES}
              value={source}
              onValueChange={(next) =>
                void navigate({
                  to: "/import",
                  search: next === "t3" ? { source: "t3" } : {},
                  replace: true,
                })
              }
              ariaLabel="Import from"
              className="gap-6"
            >
              <HubTabPanel value="sessions">
                <SessionsPanel environmentId={environmentId} scan={scan} />
              </HubTabPanel>
              <HubTabPanel value="t3">
                <T3HistoryPanel environmentId={environmentId} />
              </HubTabPanel>
            </HubTabs>
          </div>
        </ScrollArea>
      </div>
    </SidebarInset>
  );
}
