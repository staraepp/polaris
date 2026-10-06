import { Liquid, type Transition } from "liquid-gooey";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../fx/usePrefersReducedMotion";
import type { GooeyPlusAction } from "./gooeyPlusActions";

/** Vertical step between popped-out chips, in px. */
const CHIP_STEP = 40;

function PlusGlyph({ open }: { readonly open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 transition-transform duration-200 ease-out motion-reduce:transition-none data-[open=true]:rotate-45"
      data-open={open}
      aria-hidden="true"
    >
      <path
        d="M8 3.25v9.5M3.25 8h9.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * The composer's "+" (Polaris, behind a setting): actions pop out of it as
 * liquid chips that split off and merge back (`liquid-gooey`, MIT). The chips
 * are real buttons in a menu; the goo is only their silhouette.
 */
export default function GooeyPlusMenu({
  actions,
  disabled = false,
}: {
  readonly actions: readonly GooeyPlusAction[];
  readonly disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const menuId = useId();
  const transition: Transition = reducedMotion ? { duration: 0 } : "bouncy";

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement);
    const move = (next: number) => {
      event.preventDefault();
      itemRefs.current[(next + actions.length) % actions.length]?.focus();
    };
    // Chips stack upward, so ArrowUp walks away from the "+".
    if (event.key === "ArrowUp") move(index + 1);
    else if (event.key === "ArrowDown") move(index - 1);
    else if (event.key === "Escape") {
      event.preventDefault();
      close(true);
    }
  };

  return (
    <div ref={rootRef} className="relative size-8 shrink-0" onKeyDown={onMenuKeyDown}>
      {/* The goo filter's region is sized from the Liquid root, so the root
          spans the chips' whole travel; it ignores the pointer except on the
          chips themselves, leaving the composer under it clickable. */}
      <div
        className="pointer-events-none absolute right-0 bottom-0 w-48 *:size-full"
        style={{ height: 32 + CHIP_STEP * actions.length }}
      >
        <Liquid
          blur={5}
          contrast={20}
          fill="var(--popover)"
          shadow="0 1px 2px rgb(0 0 0 / 0.08), 0 6px 18px rgb(0 0 0 / 0.14), inset 0 1px 0 rgb(255 255 255 / 0.12)"
        >
          <div id={menuId} role="menu" aria-label="Composer actions" aria-hidden={!open}>
            {actions.map((action, index) => (
              <Liquid.Item
                key={action.id}
                y={open ? -CHIP_STEP * (index + 1) : 0}
                scale={open ? 1 : 0.35}
                transition={transition}
                delay={open ? index * 35 : 0}
                radius={16}
                className="absolute right-0 bottom-0"
              >
                <button
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={open ? 0 : -1}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => {
                    close(false);
                    action.onSelect();
                  }}
                  className="flex h-8 max-w-8 items-center gap-1.5 overflow-hidden rounded-full ps-2.5 pe-3 text-xs data-[open=true]:max-w-56 font-medium whitespace-nowrap text-popover-foreground opacity-0 transition-[opacity,max-width] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none data-[open=true]:pointer-events-auto data-[open=true]:opacity-100 [&_svg]:size-3.5 [&_svg]:text-muted-foreground"
                  data-open={open}
                >
                  {action.icon}
                  {action.label}
                </button>
              </Liquid.Item>
            ))}
          </div>
          <Liquid.Item radius={16} className="absolute right-0 bottom-0">
            <button
              ref={triggerRef}
              type="button"
              disabled={disabled}
              aria-label={open ? "Close composer actions" : "Composer actions"}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-controls={menuId}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => {
                const next = !open;
                setOpen(next);
                if (next) requestAnimationFrame(() => itemRefs.current[0]?.focus());
              }}
              className="pointer-events-auto flex size-8 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <PlusGlyph open={open} />
            </button>
          </Liquid.Item>
        </Liquid>
      </div>
    </div>
  );
}
