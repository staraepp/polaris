import { Button } from "~/components/ui/button";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";

import type { ImportSummary } from "./sessionImport";

/** The result line and the Import button under each source's list. */
export function ImportFooter({
  progress,
  summary,
  selectedCount,
  noun,
  onImport,
}: {
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly summary: ImportSummary | null;
  readonly selectedCount: number;
  readonly noun: readonly [one: string, many: string];
  readonly onImport: () => void;
}) {
  const running = progress !== null;
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <p
        role="status"
        className={cn(
          "mr-auto min-w-0 text-sm",
          summary?.tone === "warning"
            ? "text-warning-foreground"
            : summary?.tone === "success"
              ? "text-success-foreground"
              : "text-muted-foreground",
        )}
      >
        {progress !== null
          ? `Importing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
          : (summary?.text ?? "")}
      </p>
      <Button disabled={running || selectedCount === 0} onClick={onImport}>
        {running ? <Spinner size="sm" /> : null}
        {running
          ? "Importing…"
          : `Import ${selectedCount} ${selectedCount === 1 ? noun[0] : noun[1]}`}
      </Button>
    </div>
  );
}

/** "N of M selected" with Select all / Select none. */
export function SelectionBar({
  selectedCount,
  totalCount,
  disabled,
  onSelectAll,
  onSelectNone,
}: {
  readonly selectedCount: number;
  readonly totalCount: number;
  readonly disabled: boolean;
  readonly onSelectAll: () => void;
  readonly onSelectNone: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        {selectedCount} of {totalCount} selected
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled || selectedCount === totalCount}
          onClick={onSelectAll}
        >
          Select all
        </Button>
        <Button
          variant="ghost"
          size="xs"
          disabled={disabled || selectedCount === 0}
          onClick={onSelectNone}
        >
          Select none
        </Button>
      </div>
    </div>
  );
}
