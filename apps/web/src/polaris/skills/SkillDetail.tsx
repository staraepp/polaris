import type { EnvironmentId } from "@t3tools/contracts";
import { useState } from "react";

import ChatMarkdown from "~/components/ChatMarkdown";
import {
  clearProjectFileQueryData,
  confirmProjectFileQueryData,
  setProjectFileQueryData,
  useProjectFileQuery,
} from "~/components/files/projectFilesQueryState";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Toggle, ToggleGroup } from "~/components/ui/toggle-group";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { projectEnvironment } from "~/state/projects";
import { useAtomCommand } from "~/state/use-atom-command";
import { resolvePathLinkTarget } from "~/terminal-links";

import { displaySkillPath, skillBody, type StudioSkill } from "./skillStudio";
import type { SkillTemplate } from "./skillTemplates";

const editorClassName =
  "min-h-[28rem] w-full flex-1 resize-none rounded-xl border border-input bg-background/60 p-4 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/24";

type SkillView = "preview" | "source";

function ViewToggle({
  view,
  onViewChange,
}: {
  readonly view: SkillView;
  readonly onViewChange: (view: SkillView) => void;
}) {
  return (
    <ToggleGroup
      aria-label="Show SKILL.md as"
      variant="segmented"
      value={[view]}
      onValueChange={(next) => {
        const value = next[0];
        if (value === "preview" || value === "source") onViewChange(value);
      }}
    >
      <Toggle value="preview">Preview</Toggle>
      <Toggle value="source">Source</Toggle>
    </ToggleGroup>
  );
}

/**
 * The SKILL.md rendered as Markdown. The frontmatter is left out: its name
 * and description are already in the header above.
 */
function SkillPreview({
  document,
  cwd,
  environmentId,
  filePath,
}: {
  readonly document: string;
  readonly cwd: string | undefined;
  readonly environmentId?: EnvironmentId | undefined;
  /** The file's path, so relative images and links resolve beside it. */
  readonly filePath?: string | undefined;
}) {
  const body = skillBody(document);
  const separator = filePath === undefined ? -1 : filePath.lastIndexOf("/");
  const imageBaseDir =
    filePath !== undefined && separator >= 0 && cwd !== undefined
      ? resolvePathLinkTarget(filePath.slice(0, separator), cwd)
      : cwd;
  return (
    <div className="min-h-[28rem] rounded-xl border border-input bg-background/60">
      {body.length > 0 ? (
        <ChatMarkdown
          text={body}
          cwd={cwd}
          environmentId={environmentId}
          imageBaseDir={imageBaseDir}
          className="px-6 py-5"
        />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">This SKILL.md has no text yet.</p>
      )}
    </div>
  );
}

function DetailHeader({
  title,
  subtitle,
  badges,
  actions,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly badges?: React.ReactNode;
  readonly actions: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {badges}
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}

/** One skill's SKILL.md: editable inside the workspace, read-only elsewhere. */
export function SkillDetail({
  entry,
  environmentId,
  cwd,
  groupLabel,
  draft,
  onDraftChange,
  onRescan,
}: {
  readonly entry: StudioSkill;
  readonly environmentId: EnvironmentId;
  readonly cwd: string;
  readonly groupLabel: string;
  /** Unsaved text, kept by the page so switching skills does not lose it. */
  readonly draft: string | null;
  readonly onDraftChange: (draft: string | null) => void;
  /** Asks the provider to list skills again, for a file that has gone. */
  readonly onRescan: () => void;
}) {
  const file = useProjectFileQuery(environmentId, cwd, entry.readPath);
  const writeFile = useAtomCommand(projectEnvironment.writeFile, { reportFailure: false });
  const [status, setStatus] = useState<{ readonly kind: "saving" | "saved" | "failed" } | null>(
    null,
  );
  const { copyToClipboard, isCopied } = useCopyToClipboard({ target: "skill" });
  const loaded = file.data?.contents ?? "";
  const value = draft ?? loaded;
  const dirty = draft !== null && draft !== loaded;
  const unreadable = file.error !== null && file.data === null;
  const editable = entry.relativeFile !== null && !unreadable;
  const relativeFile = entry.relativeFile;
  // Your own skills open in the editor; everything else reads as a document.
  const [chosenView, setView] = useState<SkillView | null>(null);
  const view = chosenView ?? (editable ? "source" : "preview");
  const reading = file.isPending && file.data === null;

  const save = async () => {
    if (relativeFile === null || !dirty) return;
    setStatus({ kind: "saving" });
    setProjectFileQueryData(environmentId, cwd, relativeFile, value);
    const result = await writeFile({
      environmentId,
      input: { cwd, relativePath: relativeFile, contents: value },
    });
    if (result._tag === "Success") {
      confirmProjectFileQueryData(environmentId, cwd, relativeFile, value);
      onDraftChange(null);
      setStatus({ kind: "saved" });
    } else {
      clearProjectFileQueryData(environmentId, cwd, relativeFile);
      setStatus({ kind: "failed" });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DetailHeader
        title={entry.label}
        subtitle={entry.relativeFile ?? displaySkillPath(entry.readPath)}
        badges={
          <>
            <Badge variant="outline">{groupLabel}</Badge>
            {entry.skill.enabled ? null : <Badge variant="outline">Off</Badge>}
            {entry.skill.userInvocationOnly ? <Badge variant="outline">You start it</Badge> : null}
            {entry.skill.userInvocable === false ? (
              <Badge variant="outline">Agent only</Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyToClipboard(`/${entry.skill.name}`, undefined)}
            >
              {isCopied ? "Copied" : `Copy /${entry.skill.name}`}
            </Button>
            {editable ? (
              <>
                {dirty ? (
                  <Button size="sm" variant="ghost" onClick={() => onDraftChange(null)}>
                    Revert
                  </Button>
                ) : null}
                <Button size="sm" disabled={!dirty || status?.kind === "saving"} onClick={save}>
                  {status?.kind === "saving" ? "Saving…" : "Save"}
                </Button>
              </>
            ) : null}
          </>
        }
      />
      {entry.skill.description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{entry.skill.description}</p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {status?.kind === "saved" ? "Saved." : status?.kind === "failed" ? "Save failed." : ""}
      </p>
      {status?.kind === "failed" ? (
        <p role="alert" className="text-sm text-destructive">
          The file could not be saved. Your edits are still here.
        </p>
      ) : null}
      {unreadable ? (
        // The raw error names full host paths; say what happened instead.
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-4">
          <p className="text-sm text-foreground">This SKILL.md could not be read.</p>
          <p className="text-sm text-muted-foreground">
            It may have been moved or deleted since the provider last listed its skills.
          </p>
          <Button size="sm" variant="outline" onClick={onRescan}>
            Rescan skills
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {editable
              ? view === "source"
                ? "In this project, so you can edit it here."
                : dirty
                  ? "Showing your unsaved edits."
                  : "In this project; switch to Source to edit."
              : "Outside this project, so it is shown read-only."}
          </p>
          <ViewToggle view={view} onViewChange={setView} />
        </div>
      )}
      {unreadable ? null : view === "preview" ? (
        reading ? (
          <p className="text-sm text-muted-foreground">Reading…</p>
        ) : (
          <SkillPreview
            document={value}
            cwd={cwd}
            environmentId={environmentId}
            filePath={entry.readPath}
          />
        )
      ) : editable ? (
        <textarea
          aria-label={`${entry.label} SKILL.md`}
          spellCheck={false}
          className={editorClassName}
          value={value}
          disabled={reading}
          onChange={(event) => {
            onDraftChange(event.target.value);
            if (status?.kind !== "saving") setStatus(null);
          }}
          onKeyDown={(event) => {
            // Esc only leaves the editor; the page's Esc-to-go-back must not
            // fire from here and walk away from the edit.
            if (event.key === "Escape") {
              event.preventDefault();
              event.currentTarget.blur();
              return;
            }
            if ((event.metaKey || event.ctrlKey) && event.key === "s") {
              event.preventDefault();
              void save();
            }
          }}
        />
      ) : (
        <pre className={`${editorClassName} overflow-auto whitespace-pre-wrap`}>
          {reading ? "Reading…" : loaded}
        </pre>
      )}
    </div>
  );
}

/** A Polaris template, read-only, with a way to add it to the project. */
export function TemplateDetail({
  template,
  onAdd,
  canAdd,
}: {
  readonly template: SkillTemplate;
  readonly onAdd: () => void;
  readonly canAdd: boolean;
}) {
  const [view, setView] = useState<SkillView>("preview");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DetailHeader
        title={template.title}
        subtitle={template.id}
        badges={<Badge variant="outline">Template</Badge>}
        actions={
          <Button size="sm" disabled={!canAdd} onClick={onAdd}>
            Add to project
          </Button>
        }
      />
      <p className="max-w-prose text-sm text-muted-foreground">{template.description}</p>
      <div className="flex justify-end">
        <ViewToggle view={view} onViewChange={setView} />
      </div>
      {view === "preview" ? (
        <SkillPreview document={template.document} cwd={undefined} />
      ) : (
        <pre className={`${editorClassName} overflow-auto whitespace-pre-wrap`}>
          {template.document}
        </pre>
      )}
    </div>
  );
}
