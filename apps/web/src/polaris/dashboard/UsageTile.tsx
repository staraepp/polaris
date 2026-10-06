import type { ServerProvider } from "@t3tools/contracts";
import { formatTokens, formatUsd } from "@t3tools/shared/usageFormat";
import { formatResetsIn, remainingPercent } from "@t3tools/shared/usageLimits";
import { Fragment, useState } from "react";

import { barColor } from "~/components/usage/UsageLimits";
import { useClientSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";

/** Providers worth a limits row: reporting windows right now. */
export function providersWithLimits(
  providers: readonly ServerProvider[],
): readonly ServerProvider[] {
  return providers.filter(
    (provider) =>
      provider.usageLimits !== undefined &&
      provider.usageLimits.unavailable === undefined &&
      provider.usageLimits.windows.length > 0,
  );
}

function ProviderLimits({
  provider,
  now,
  thresholdPercent,
}: {
  readonly provider: ServerProvider;
  readonly now: number;
  readonly thresholdPercent: number;
}) {
  const windows = provider.usageLimits?.windows ?? [];
  const color = barColor(provider.driver);
  return (
    <>
      <span className="col-span-3 pt-1 text-2xs font-medium text-muted-foreground/80 first:pt-0">
        {provider.displayName ?? provider.instanceId}
      </span>
      {windows.map((window) => {
        const left = remainingPercent(window);
        const low = thresholdPercent > 0 && left <= thresholdPercent;
        const resets = formatResetsIn(window, now);
        return (
          <Fragment key={window.id}>
            <span className="text-xs whitespace-nowrap text-muted-foreground">{window.label}</span>
            <span className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className={cn("block h-full rounded-full", low && "bg-warning")}
                style={{ width: `${left}%`, ...(low ? {} : { backgroundColor: color }) }}
              />
            </span>
            <span
              className={cn(
                "text-right text-xs font-medium tabular-nums",
                low ? "text-warning-foreground" : "text-foreground",
              )}
            >
              {left}%{resets ? <span className="sr-only">, {resets}</span> : null}
            </span>
          </Fragment>
        );
      })}
    </>
  );
}

/** Today's spend and tokens, then each provider's limit windows (Polaris dashboard). */
export function UsageTileBody({
  today,
  pending,
  providers,
}: {
  readonly today: { readonly costUsd: number; readonly totalTokens: number } | null;
  readonly pending: boolean;
  readonly providers: readonly ServerProvider[];
}) {
  const thresholdPercent = useClientSettings((settings) => settings.quotaLowThresholdPercent);
  // Reset times (read out to screen readers) are taken when the tile mounts.
  const [now] = useState(() => Date.now());
  const limited = providersWithLimits(providers).slice(0, 2);
  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
          {pending ? "–" : formatUsd(today?.costUsd ?? 0)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">
          {pending ? "Reading usage…" : `${formatTokens(today?.totalTokens ?? 0)} tokens today`}
        </span>
      </div>
      {limited.length > 0 ? (
        // One grid for every provider, so all the bars start on the same line.
        <div
          role="group"
          aria-label="Usage left in each limit window"
          className="mt-auto grid grid-cols-[auto_minmax(2.5rem,1fr)_auto] items-center gap-x-3 gap-y-1.5"
        >
          {limited.map((provider) => (
            <ProviderLimits
              key={provider.instanceId}
              provider={provider}
              now={now}
              thresholdPercent={thresholdPercent}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
