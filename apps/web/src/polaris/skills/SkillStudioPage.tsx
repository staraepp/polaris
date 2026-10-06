import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import {
  hasCompleteProviderWorkspaceSnapshot,
  resolveProviderSkillsForCwd,
} from "@t3tools/client-runtime/providerSkills";
import type { ServerProvider } from "@t3tools/contracts";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SidebarInset } from "~/components/ui/sidebar";
import { sortScopedProjectsForSidebar } from "~/components/Sidebar.logic";
import { WorkspaceBreadcrumb, WorkspaceBreadcrumbItem } from "~/components/WorkspaceBreadcrumb";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useEscapeToGoBack } from "~/hooks/useNavigateBack";
import { useProjects, useServerConfigs, useThreadShells } from "~/state/entities";
import { projectEnvironment } from "~/state/projects";
import { serverEnvironment } from "~/state/server";
import { useAtomCommand } from "~/state/use-atom-command";

import { NewSkillDialog, type NewSkillRequest } from "./NewSkillDialog";
import { SkillDetail, TemplateDetail } from "./SkillDetail";
import { SkillList, type StudioSelection } from "./SkillList";
import { groupStudioSkills, type SkillLocationId } from "./skillStudio";
import { SKILL_TEMPLATES } from "./skillTemplates";

const projectKey = (project: EnvironmentProject) => `${project.environmentId} ${project.id}`;
const providerLabel = (provider: ServerProvider) => provider.displayName ?? provider.instanceId;
const trimSlash = (path: string) => path.replaceAll("\\", "/").replace(/\/+$/, "");

/**
 * The Polaris skill studio: a side panel of the skills an agent sees in a
 * project, grouped by where they live, beside an editor for the project's
 * own SKILL.md files and Polaris's frontend templates.
 */
export function SkillStudioPage() {
  useEscapeToGoBack();
  const projects = useProjects();
  const threads = useThreadShells();
  const sortedProjects = useMemo(
    () => sortScopedProjectsForSidebar(projects, threads, "updated_at"),
    [projects, threads],
  );
  const [projectChoice, setProjectChoice] = useState<string | null>(null);
  const project =
    sortedProjects.find((entry) => projectKey(entry) === projectChoice) ??
    sortedProjects[0] ??
    null;
  const cwd = project?.workspaceRoot ?? null;

  const serverConfigs = useServerConfigs();
  const providers = useMemo(
    () =>
      (project ? (serverConfigs.get(project.environmentId)?.providers ?? []) : []).filter(
        (provider) => provider.enabled && provider.installed,
      ),
    [project, serverConfigs],
  );
  const [providerChoice, setProviderChoice] = useState<string | null>(null);
  const provider =
    providers.find((entry) => entry.instanceId === providerChoice) ??
    providers.find((entry) => resolveProviderSkillsForCwd(entry, cwd).length > 0) ??
    providers[0] ??
    null;

  // Ask the provider to scan this workspace once, the way the composer does.
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  const [scanning, setScanning] = useState(false);
  const scannedKeyRef = useRef<string | null>(null);
  const scan = (fresh: boolean) => {
    if (project === null || provider === null || cwd === null) return Promise.resolve();
    setScanning(true);
    return refreshProviders({
      environmentId: project.environmentId,
      input: { instanceId: provider.instanceId, cwd, ...(fresh ? { fresh: true } : {}) },
    }).finally(() => setScanning(false));
  };
  const snapshotReady = hasCompleteProviderWorkspaceSnapshot(provider, cwd);
  const scanKey =
    project && provider && cwd ? `${project.environmentId}:${provider.instanceId}:${cwd}` : null;
  const scanOnce = useEffectEvent(() => void scan(false));
  useEffect(() => {
    if (scanKey === null || snapshotReady || scannedKeyRef.current === scanKey) return;
    scannedKeyRef.current = scanKey;
    scanOnce();
  }, [scanKey, snapshotReady]);

  const [query, setQuery] = useState("");
  const allGroups = useMemo(
    () => (provider ? groupStudioSkills(resolveProviderSkillsForCwd(provider, cwd), cwd) : []),
    [cwd, provider],
  );
  const groups = useMemo(
    () =>
      query.trim()
        ? groupStudioSkills(provider ? resolveProviderSkillsForCwd(provider, cwd) : [], cwd, query)
        : allGroups,
    [allGroups, cwd, provider, query],
  );
  const allSkills = useMemo(() => allGroups.flatMap((group) => group.skills), [allGroups]);
  const [selection, setSelection] = useState<StudioSelection | null>(null);
  const selectedSkill =
    selection?.type === "skill"
      ? allSkills.find((entry) => entry.key === selection.key)
      : undefined;
  const selectedTemplate =
    selection?.type === "template"
      ? SKILL_TEMPLATES.find((template) => template.id === selection.id)
      : undefined;
  // With nothing picked, open on the project's own first skill, else on a
  // Polaris template, so a huge personal folder does not take over the page.
  const firstProjectSkill = allGroups.find(
    (group) => group.kind === "project" || group.kind === "repo",
  )?.skills[0];
  const shown: StudioSelection | null =
    selectedSkill || selectedTemplate
      ? selection
      : firstProjectSkill
        ? { type: "skill", key: firstProjectSkill.key }
        : SKILL_TEMPLATES[0]
          ? { type: "template", id: SKILL_TEMPLATES[0].id }
          : null;
  const shownSkill =
    shown?.type === "skill" ? allSkills.find((entry) => entry.key === shown.key) : undefined;
  const shownTemplate =
    shown?.type === "template" ? SKILL_TEMPLATES.find((entry) => entry.id === shown.id) : undefined;
  const groupLabelOf = (key: string) =>
    allGroups.find((group) => group.skills.some((entry) => entry.key === key))?.label ?? "";

  const [dialog, setDialog] = useState<{
    readonly templateId: string | null;
    readonly nonce: number;
  } | null>(null);
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const existingPaths = useMemo(
    () => new Set(allSkills.flatMap((entry) => (entry.relativeFile ? [entry.relativeFile] : []))),
    [allSkills],
  );
  const defaultLocation: SkillLocationId = provider?.driver === "claudeAgent" ? "claude" : "agents";
  const createSkill = async (request: NewSkillRequest) => {
    if (project === null || cwd === null) return false;
    const result = await writeFile({
      environmentId: project.environmentId,
      input: { cwd, relativePath: request.relativePath, contents: request.contents },
    });
    if (result._tag !== "Success") return false;
    setDialog(null);
    setSelection({ type: "skill", key: `project:${trimSlash(cwd)}/${request.relativePath}` });
    await scan(true);
    return true;
  };

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        <WorkspacePageHeader electron={isElectron}>
          <WorkspaceBreadcrumb ariaLabel="Skills breadcrumb" className="min-w-0 flex-1">
            <WorkspaceBreadcrumbItem current>
              <h1>Skills</h1>
            </WorkspaceBreadcrumbItem>
          </WorkspaceBreadcrumb>
          {sortedProjects.length > 0 ? (
            <Select
              value={project ? projectKey(project) : ""}
              onValueChange={(value) => {
                setProjectChoice(String(value));
                setSelection(null);
              }}
            >
              <SelectTrigger size="sm" className="w-auto min-w-0 max-w-48" aria-label="Project">
                <SelectValue>{project?.title ?? "Project"}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {sortedProjects.map((entry) => (
                  <SelectItem key={projectKey(entry)} hideIndicator value={projectKey(entry)}>
                    {entry.title}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : null}
          {providers.length > 0 ? (
            <Select
              value={provider?.instanceId ?? ""}
              onValueChange={(value) => {
                setProviderChoice(String(value));
                setSelection(null);
              }}
            >
              <SelectTrigger size="sm" className="w-auto min-w-0 max-w-40" aria-label="Provider">
                <SelectValue>{provider ? providerLabel(provider) : "Provider"}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="end" alignItemWithTrigger={false}>
                {providers.map((entry) => (
                  <SelectItem key={entry.instanceId} hideIndicator value={entry.instanceId}>
                    {providerLabel(entry)}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={provider === null || scanning}
            onClick={() => void scan(true)}
          >
            {scanning ? "Scanning…" : "Rescan"}
          </Button>
          <Button
            size="sm"
            disabled={project === null}
            onClick={() => setDialog({ templateId: null, nonce: Date.now() })}
          >
            New skill
          </Button>
        </WorkspacePageHeader>
        {project === null ? (
          <p className="m-auto max-w-72 text-center text-sm text-muted-foreground">
            Add a project to see and write its skills.
          </p>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 md:grid-cols-[18rem_minmax(0,1fr)]">
            <aside className="surface-glass min-h-0 border-border/60 md:border-r">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <SkillList
                    groups={groups}
                    templates={SKILL_TEMPLATES}
                    query={query}
                    onQueryChange={setQuery}
                    selection={shown}
                    onSelect={setSelection}
                    pending={scanning && allSkills.length === 0}
                  />
                </div>
              </ScrollArea>
            </aside>
            <ScrollArea className="min-h-0">
              <main className="mx-auto flex min-h-full w-full max-w-4xl flex-col p-6">
                {shownSkill && cwd ? (
                  <SkillDetail
                    key={shownSkill.key}
                    entry={shownSkill}
                    environmentId={project.environmentId}
                    cwd={cwd}
                    groupLabel={groupLabelOf(shownSkill.key)}
                  />
                ) : shownTemplate ? (
                  <TemplateDetail
                    template={shownTemplate}
                    canAdd
                    onAdd={() => setDialog({ templateId: shownTemplate.id, nonce: Date.now() })}
                  />
                ) : null}
              </main>
            </ScrollArea>
          </div>
        )}
      </div>
      {dialog ? (
        <NewSkillDialog
          key={dialog.nonce}
          open
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
          templates={SKILL_TEMPLATES}
          initialTemplateId={dialog.templateId}
          defaultLocation={defaultLocation}
          existingPaths={existingPaths}
          onCreate={createSkill}
        />
      ) : null}
    </SidebarInset>
  );
}
