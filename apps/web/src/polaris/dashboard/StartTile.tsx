import type { EnvironmentProject } from "@t3tools/client-runtime/state/models";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { useAtomValue } from "@effect/atom-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { shortcutLabelForCommand } from "~/keybindings";
import { primaryServerKeybindingsAtom } from "~/state/server";

function PlusGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A new thread in the latest project, or in any of the next few (Polaris dashboard). */
export function StartTileBody({ projects }: { readonly projects: readonly EnvironmentProject[] }) {
  const handleNewThread = useNewThreadHandler();
  const [failed, setFailed] = useState(false);
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const newThreadShortcut = shortcutLabelForCommand(keybindings, "chat.new");
  const start = (project: EnvironmentProject) => {
    setFailed(false);
    void handleNewThread(scopeProjectRef(project.environmentId, project.id)).catch(() =>
      setFailed(true),
    );
  };
  const [first, ...others] = projects;
  if (first === undefined) {
    return (
      <p className="m-auto max-w-52 text-center text-sm text-muted-foreground">
        Add a project from the sidebar to start a thread.
      </p>
    );
  }
  return (
    <div className="flex flex-1 flex-col gap-3">
      <Button className="justify-start" onClick={() => start(first)}>
        <PlusGlyph />
        <span className="truncate">New thread in {first.title}</span>
      </Button>
      {others.length > 0 ? (
        <ul className="flex flex-col">
          {others.map((project) => (
            <li key={`${project.environmentId} ${project.id}`}>
              <button
                type="button"
                onClick={() => start(project)}
                className="flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <PlusGlyph />
                <span className="truncate">{project.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {newThreadShortcut ? (
        <p className="mt-auto text-xs text-muted-foreground">
          <kbd className="rounded border border-border/80 bg-muted/60 px-1 py-px font-sans text-2xs text-foreground">
            {newThreadShortcut}
          </kbd>{" "}
          starts a thread from anywhere.
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-xs text-destructive">
          The thread could not start. Try again.
        </p>
      ) : null}
    </div>
  );
}
