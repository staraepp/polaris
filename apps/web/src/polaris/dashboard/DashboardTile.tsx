import type { DragEvent, ReactNode } from "react";

import { cn } from "~/lib/utils";

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
}

/**
 * One bento tile (Polaris): a translucent card with a quiet header. In edit
 * mode the whole tile drags, and two buttons move it for keyboard users.
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
        "surface-glass flex min-h-44 min-w-0 flex-col rounded-2xl border border-border/70 shadow-xs transition-[opacity,box-shadow,border-color] duration-150 motion-reduce:transition-none",
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
        <h2 className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">
          {title}
        </h2>
        {editing ? (
          <span className="flex items-center gap-0.5">
            {(["earlier", "later"] as const).map((direction) => {
              const target = direction === "earlier" ? editing.index - 1 : editing.index + 1;
              return (
                <button
                  key={direction}
                  type="button"
                  aria-label={`Move ${title} ${direction}`}
                  disabled={target < 0 || target >= editing.count}
                  onClick={() => editing.onMove(target)}
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35"
                >
                  <ChevronGlyph direction={direction} />
                </button>
              );
            })}
          </span>
        ) : (
          action
        )}
      </header>
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
