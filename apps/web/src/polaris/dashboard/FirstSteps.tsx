import { useAtomValue } from "@effect/atom-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

import {
  isCommandPaletteOpen,
  onOpenCommandPalette,
  openCommandPalette,
} from "~/commandPaletteBus";
import { Button } from "~/components/ui/button";
import { useLocalStorage } from "~/hooks/useLocalStorage";
import { shortcutLabelForCommand } from "~/keybindings";
import { cn } from "~/lib/utils";
import { primaryServerKeybindingsAtom } from "~/state/server";

import {
  FIRST_STEP_IDS,
  FIRST_STEP_TEXT,
  FIRST_STEPS_INITIAL,
  FIRST_STEPS_STORAGE_KEY,
  type FirstStepId,
  type FirstStepSignals,
  FirstStepsMemory,
  firstStepsProgress,
} from "./firstStepsModel";

function StepMark({ done, current }: { readonly done: boolean; readonly current: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0",
        done ? "text-primary-text" : current ? "text-foreground" : "text-muted-foreground/60",
      )}
    >
      {done ? (
        <>
          <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.16" />
          <path
            d="M5 8.2 7.1 10.3 11 6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <circle
          cx="8"
          cy="8"
          r="6.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray={current ? undefined : "2.4 2.4"}
        />
      )}
    </svg>
  );
}

/**
 * First steps (Polaris, V 4.1.0): a slim card under the greeting until every
 * step is done or you hide it. Only the next step carries a button, so the
 * card always says what to do now.
 */
export function FirstSteps({
  signals,
  onCustomize,
}: {
  readonly signals: Omit<FirstStepSignals, "paletteOpened">;
  readonly onCustomize: () => void;
}) {
  const [memory, setMemory] = useLocalStorage(
    FIRST_STEPS_STORAGE_KEY,
    FIRST_STEPS_INITIAL,
    FirstStepsMemory,
  );
  const keybindings = useAtomValue(primaryServerKeybindingsAtom);
  const paletteShortcut = shortcutLabelForCommand(keybindings, "commandPalette.toggle");
  const progress = firstStepsProgress({ ...signals, paletteOpened: memory.paletteOpened });

  // The palette counts however it was opened: by key, by click or from here.
  useEffect(() => {
    if (memory.paletteOpened || memory.hidden) return;
    const seen = () => setMemory((current) => ({ ...current, paletteOpened: true }));
    const unsubscribe = onOpenCommandPalette(seen);
    const observer = new MutationObserver(() => {
      if (isCommandPaletteOpen()) seen();
    });
    observer.observe(document.body, { childList: true });
    return () => {
      unsubscribe();
      observer.disconnect();
    };
  }, [memory.hidden, memory.paletteOpened, setMemory]);

  if (memory.hidden || progress.complete) return null;

  const action = (id: FirstStepId) => {
    switch (id) {
      case "project":
        return (
          <Button size="xs" onClick={() => openCommandPalette({ open: "add-project" })}>
            Add project
          </Button>
        );
      case "thread":
        return (
          <Button size="xs" onClick={() => openCommandPalette({ open: "new-thread-in" })}>
            New thread
          </Button>
        );
      case "palette":
        return (
          <Button size="xs" onClick={() => openCommandPalette()}>
            {paletteShortcut ? `Open (${paletteShortcut})` : "Open"}
          </Button>
        );
      case "customize":
        return (
          <Button size="xs" onClick={onCustomize}>
            Customize
          </Button>
        );
      case "look":
        return (
          <Button size="xs" render={<Link to="/settings/appearance" />}>
            Appearance
          </Button>
        );
    }
  };

  const doneCount = progress.done.size;
  return (
    <section
      aria-labelledby="polaris-first-steps-title"
      className="surface-glass rounded-2xl border border-border/70 px-4 py-3 shadow-xs"
    >
      <div className="flex items-center gap-3">
        <h2 id="polaris-first-steps-title" className="text-xs font-medium text-muted-foreground">
          First steps
        </h2>
        <div
          role="progressbar"
          aria-label="First steps done"
          aria-valuemin={0}
          aria-valuemax={FIRST_STEP_IDS.length}
          aria-valuenow={doneCount}
          className="h-1 max-w-40 flex-1 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${(doneCount / FIRST_STEP_IDS.length) * 100}%` }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {doneCount} of {FIRST_STEP_IDS.length}
        </span>
        <Button
          size="xs"
          variant="ghost"
          className="ms-auto"
          onClick={() => setMemory((current) => ({ ...current, hidden: true }))}
        >
          Hide
        </Button>
      </div>
      <ol className="mt-2.5 grid gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-5">
        {FIRST_STEP_IDS.map((id) => {
          const done = progress.done.has(id);
          const current = progress.next === id;
          return (
            <li key={id} className="flex min-w-0 items-start gap-2">
              <span className="pt-0.5">
                <StepMark done={done} current={current} />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <span
                  className={cn(
                    "text-sm",
                    done ? "text-muted-foreground line-through decoration-1" : "text-foreground",
                  )}
                >
                  {FIRST_STEP_TEXT[id].title}
                  <span className="sr-only">{done ? ", done" : current ? ", next" : ""}</span>
                </span>
                {done ? null : (
                  <span className="text-xs text-muted-foreground">{FIRST_STEP_TEXT[id].hint}</span>
                )}
                {current ? <span className="pt-0.5">{action(id)}</span> : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
