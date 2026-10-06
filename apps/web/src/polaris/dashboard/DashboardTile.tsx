import type { DragEvent, ReactNode } from "react";

import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

import {
  DASHBOARD_WIDGET_SIZE_LABELS,
  DASHBOARD_WIDGET_SIZES,
  type DashboardWidgetSize,
} from "./dashboardLayout";

function CloseGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
      <path
        d="M4.5 4.5l7 7M11.5 4.5l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GripGlyph() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3.5">
      {[4, 8, 12].map((y) =>
        [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />),
      )}
    </svg>
  );
}

function ChevronGlyph({ direction }: { readonly direction: "earlier" | "later" }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={cn("size-3.5", direction === "later" && "rotate-180")}
    >
      <path
        d="M10 4 6 8l4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface DashboardTileEditing {
  readonly index: number;
  readonly count: number;
  readonly dragging: boolean;
  readonly dropTarget: boolean;
  readonly onMove: (toIndex: number) => void;
  readonly onDragStart: (event: DragEvent<HTMLElement>) => void;
  readonly onDragEnter: () => void;
  readonly onDragEnd: () => void;
  readonly onDrop: () => void;
  /** The chosen width; "auto" is the widget's own shape. */
  readonly size: DashboardWidgetSize | "auto";
  readonly onResize: (size: DashboardWidgetSize | "auto") => void;
  readonly onRemove: () => void;
  /** Custom widgets: rename in place. */
  readonly onRename?: (title: string) => void;
}

const SIZE_OPTIONS = ["auto", ...DASHBOARD_WIDGET_SIZES] as const;
const sizeLabel = (size: DashboardWidgetSize | "auto") =>
  size === "auto" ? "Auto" : DASHBOARD_WIDGET_SIZE_LABELS[size];

const iconButtonClassName =
  "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35";

/**
 * One bento tile (Polaris): a translucent card with a quiet header. In edit
 * mode the whole tile drags; buttons move it for keyboard users, a size menu
 * resizes it, and it can be removed (and added back from "Add widget").
 */
export function DashboardTile({
  title,
  action,
  editing,
  className,
  children,
}: {
  readonly title: string;
  readonly action?: ReactNode;
  readonly editing: DashboardTileEditing | null;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  // The move arrows sit in the header on narrow windows and beside the size
  // picker on wide ones (sizes only shape the six-column grid).
  const moveButtons =
    editing === null
      ? null
      : (["earlier", "later"] as const).map((direction) => {
          const target = direction === "earlier" ? editing.index - 1 : editing.index + 1;
          return (
            <button
              key={direction}
              type="button"
              aria-label={`Move ${title} ${direction}`}
              disabled={target < 0 || target >= editing.count}
              onClick={() => editing.onMove(target)}
              className={iconButtonClassName}
            >
              <ChevronGlyph direction={direction} />
            </button>
          );
        });

  return (
    <section
      aria-label={title}
      draggable={editing !== null}
      onDragStart={editing?.onDragStart}
      onDragEnter={editing?.onDragEnter}
      onDragOver={editing ? (event) => event.preventDefault() : undefined}
      onDragEnd={editing?.onDragEnd}
      onDrop={
        editing
          ? (event) => {
              event.preventDefault();
              editing.onDrop();
            }
          : undefined
      }
      className={cn(
        "surface-glass flex min-w-0 lg:min-h-44 flex-col rounded-2xl border border-border/70 shadow-xs transition-[opacity,box-shadow,border-color] duration-150 motion-reduce:transition-none",
        editing && "cursor-grab border-dashed active:cursor-grabbing",
        editing?.dragging && "opacity-45",
        editing?.dropTarget && !editing.dragging && "border-primary/60 ring-2 ring-primary/25",
        className,
      )}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 px-4">
        {editing ? (
          <span className="text-muted-foreground/70">
            <GripGlyph />
          </span>
        ) : null}
        {editing?.onRename ? (
          <input
            defaultValue={title}
            aria-label="Widget title"
            maxLength={60}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (next !== "" && next !== title) editing.onRename?.(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className="min-w-0 flex-1 cursor-text rounded-md bg-transparent px-1 text-xs font-medium text-foreground outline-none ring-1 ring-border/60 focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
            {title}
          </h2>
        )}
        {editing ? (
          <span className="flex items-center gap-0.5 lg:hidden">{moveButtons}</span>
        ) : null}
        {editing ? (
          <button
            type="button"
            aria-label={`Remove ${title}`}
            onClick={editing.onRemove}
            className={cn(iconButtonClassName, "hover:text-destructive-foreground")}
          >
            <CloseGlyph />
          </button>
        ) : (
          action
        )}
      </header>
      {editing ? (
        // Its own row on wide windows, so even a small widget keeps a readable title.
        <div className="-mt-1 hidden shrink-0 items-center gap-0.5 px-4 pb-2 lg:flex">
          <Select
            value={editing.size}
            onValueChange={(value) => {
              const next = SIZE_OPTIONS.find((option) => option === value);
              if (next !== undefined) editing.onResize(next);
            }}
          >
            <SelectTrigger size="xs" className="w-28" aria-label={`Size of ${title}`}>
              <SelectValue>{sizeLabel(editing.size)}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="start" alignItemWithTrigger={false}>
              {SIZE_OPTIONS.map((option) => (
                <SelectItem key={option} hideIndicator value={option}>
                  {sizeLabel(option)}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
          <span className="ms-auto" />
          {moveButtons}
        </div>
      ) : null}
      <div
        className={cn("flex min-h-0 flex-1 flex-col px-4 pb-4", editing && "pointer-events-none")}
      >
        {children}
      </div>
    </section>
  );
}

/** A small text link for a tile header ("Open Usage"). */
export const tileActionClassName =
  "rounded-md px-1.5 py-0.5 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
