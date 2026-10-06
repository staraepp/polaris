import { formatContextWindowTokens } from "~/lib/contextWindow";

import type { ThreadUsage } from "./threadUsage";

/** Bars shown at most; older runs still count in the totals. */
const RECENT_RUNS = 24;

/**
 * "This thread" block for the context window popover (Polaris): totals plus a
 * strip of the latest runs, each bar sized by its tokens.
 */
export function ThreadUsageSection({ usage }: { readonly usage: ThreadUsage }) {
  if (usage.runs.length === 0) return null;
  const recent = usage.runs.slice(-RECENT_RUNS);
  const peak = recent.reduce((max, run) => Math.max(max, run.inputTokens + run.outputTokens), 0);
  const runLabel = `${usage.runs.length} ${usage.runs.length === 1 ? "run" : "runs"}`;

  return (
    <section
      aria-label="This thread's usage"
      className="mt-1 flex flex-col gap-2 border-t border-border/60 pt-2"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium text-muted-foreground text-xs">This thread</div>
        <div className="text-secondary-label text-2xs tabular-nums">{runLabel}</div>
      </div>
      {peak > 0 ? (
        <div aria-hidden="true" className="flex h-6 items-end gap-0.5">
          {recent.map((run) => {
            const total = run.inputTokens + run.outputTokens;
            return (
              <span
                key={run.runId}
                className="min-w-0.5 flex-1 rounded-xs bg-muted-foreground/40 data-[tools=true]:bg-primary/70"
                data-tools={run.toolCalls > 0}
                style={{ height: `${Math.max(8, (total / peak) * 100)}%` }}
              />
            );
          })}
        </div>
      ) : null}
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-2xs leading-4">
        <dt className="text-secondary-label">Tokens in / out</dt>
        <dd className="font-medium tabular-nums text-secondary-label">
          {usage.runsWithTokens === 0
            ? "Not reported"
            : `${formatContextWindowTokens(usage.inputTokens)} / ${formatContextWindowTokens(usage.outputTokens)}`}
        </dd>
        <dt className="text-secondary-label">Tool calls</dt>
        <dd className="font-medium tabular-nums text-secondary-label">{usage.toolCalls}</dd>
      </dl>
      {usage.runsWithTokens > 0 && usage.runsWithTokens < usage.runs.length ? (
        <div className="text-pretty text-secondary-label text-2xs">
          {usage.runs.length - usage.runsWithTokens} of {runLabel} did not report tokens.
        </div>
      ) : null}
    </section>
  );
}
