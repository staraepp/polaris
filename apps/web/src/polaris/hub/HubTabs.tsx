import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Polaris hub tabs: the subpage switcher used inside a hub page (Base UI
 * Tabs, so arrow keys, Home/End and the tab roles come for free). The active
 * tab is controlled so a hub can mirror it into the URL.
 */
export interface HubTab<Id extends string> {
  readonly id: Id;
  readonly label: string;
  readonly icon?: ReactNode;
  /** A short count after the label, for example "64 new". */
  readonly badge?: string | undefined;
}

export function HubTabs<Id extends string>({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  className,
  children,
}: {
  readonly tabs: readonly HubTab<Id>[];
  readonly value: Id;
  readonly onValueChange: (value: Id) => void;
  readonly ariaLabel: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Tabs.Root
      value={value}
      onValueChange={(next) => {
        const match = tabs.find((tab) => tab.id === next);
        if (match) onValueChange(match.id);
      }}
      className={cn("flex min-h-0 flex-col", className)}
    >
      <Tabs.List
        aria-label={ariaLabel}
        className="relative flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-1"
      >
        {tabs.map((tab) => (
          <Tabs.Tab
            key={tab.id}
            value={tab.id}
            className="relative z-10 flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[selected]:text-foreground [&_svg]:size-4"
          >
            {tab.icon}
            {tab.label}
            {tab.badge ? (
              <span className="rounded-full bg-primary-subtle px-1.5 py-px text-2xs font-medium text-primary-text tabular-nums">
                {tab.badge}
              </span>
            ) : null}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator className="absolute top-1/2 left-0 z-0 h-8 w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-1/2 rounded-lg bg-background shadow-xs ring-1 ring-border/60 transition-[translate,width] duration-200 ease-out motion-reduce:transition-none" />
      </Tabs.List>
      {children}
    </Tabs.Root>
  );
}

export function HubTabPanel<Id extends string>({
  value,
  className,
  children,
}: {
  readonly value: Id;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Tabs.Panel value={value} className={cn("min-h-0 outline-none", className)}>
      {children}
    </Tabs.Panel>
  );
}
