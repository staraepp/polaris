import type { ReactNode } from "react";

import { Button } from "~/components/ui/button";

import { calmT3ImportTitle } from "../calm/calmCopy";
import { useCalmMode } from "../calm/useCalmMode";

/**
 * "Your T3 Code threads are not here yet" (Polaris, V 4.7.1). Shown on the
 * dashboard and on the Import page's Claude Code & Codex tab, because the T3
 * Code import is easy to miss: it is the second tab, and the onboarding offer
 * only exists since V 4.4.0.
 */
export function T3ImportHint({
  newCount,
  action,
  onDismiss,
}: {
  readonly newCount: number;
  /** The button that opens the T3 Code import. */
  readonly action: ReactNode;
  readonly onDismiss?: () => void;
}) {
  // Calm mode: one line, without the explanation.
  const calm = useCalmMode();
  return (
    <section
      aria-label="T3 Code threads"
      className="surface-glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border/70 px-4 py-3 shadow-xs"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">
          {calm
            ? calmT3ImportTitle(newCount)
            : `${newCount} T3 Code ${newCount === 1 ? "thread isn't" : "threads aren't"} in Polaris yet`}
        </p>
        {calm ? null : (
          <p className="text-xs text-muted-foreground">
            They live in the T3 Code app, not in the Claude Code and Codex session files, so they
            are imported separately. T3 Code is only read, never changed.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {onDismiss ? (
          <Button size="xs" variant="ghost" onClick={onDismiss}>
            Not now
          </Button>
        ) : null}
      </div>
    </section>
  );
}
