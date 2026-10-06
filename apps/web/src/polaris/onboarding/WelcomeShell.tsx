import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedHeight } from "~/components/AnimatedHeight";
import { PolarisStar } from "~/components/T3Wordmark";
import { DialogPortal, DialogTitle, DialogViewport } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

import { OrbieAvatar } from "../bots/OrbieAvatar";
import { ORBIE_NAME } from "../bots/orbie";
import "./welcome.css";

/**
 * The Polaris welcome: a full-screen aurora with a two-column card. The left
 * column is the brand, Orbie with a line for the current step, and the step
 * list; the right column is the step itself. On narrow windows the list
 * becomes a row of numbered dots above the step.
 */
export function WelcomeShell({
  title,
  steps,
  currentStep,
  greeting,
  isStepDisabled,
  onStepChange,
  holdHeight = false,
  initialFocus,
  children,
}: {
  readonly title: string;
  readonly steps: readonly string[];
  readonly currentStep: number;
  /** What Orbie says on this step. */
  readonly greeting: string;
  readonly isStepDisabled: (step: number) => boolean;
  readonly onStepChange: (step: number) => void;
  readonly holdHeight?: boolean;
  readonly initialFocus?: DialogPrimitive.Popup.Props["initialFocus"];
  readonly children: ReactNode;
}) {
  return (
    <DialogPortal>
      <DialogPrimitive.Backdrop
        forceRender
        data-slot="dialog-backdrop"
        data-polaris-welcome="backdrop"
        className="fixed inset-0 z-50 overflow-hidden transition-opacity duration-300 data-ending-style:opacity-0 data-starting-style:opacity-0"
      >
        <div data-polaris-welcome="aurora" aria-hidden />
        <div data-polaris-welcome="stars" aria-hidden />
      </DialogPrimitive.Backdrop>
      <DialogViewport className="overflow-y-auto">
        <DialogPrimitive.Popup
          data-slot="dialog-popup"
          initialFocus={initialFocus}
          className="row-start-2 grid w-full max-w-4xl min-w-0 overflow-hidden rounded-3xl border border-border/70 bg-popover/90 text-popover-foreground shadow-2xl ring-1 ring-black/5 backdrop-blur-xl transition-[scale,opacity] duration-300 ease-out outline-none data-ending-style:scale-98 data-ending-style:opacity-0 data-starting-style:scale-98 data-starting-style:opacity-0 md:grid-cols-[16rem_1fr] dark:ring-white/5 [-webkit-app-region:no-drag]"
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <aside className="flex flex-col gap-6 border-border/60 bg-primary/[0.06] p-6 max-md:border-b md:border-r">
            <div className="flex items-center gap-2" role="img" aria-label="Polaris">
              <PolarisStar className="size-5 shrink-0 text-primary" aria-hidden />
              <span className="text-xl font-semibold tracking-tight">Polaris</span>
            </div>
            <div className="flex items-start gap-3 max-md:hidden">
              <OrbieAvatar size={44} live className="text-primary" label={ORBIE_NAME} />
              <p className="rounded-2xl rounded-tl-sm bg-background/80 px-3 py-2 text-sm leading-snug shadow-xs ring-1 ring-border/60">
                {greeting}
              </p>
            </div>
            <ol className="flex gap-1 md:flex-col" aria-label="Setup progress">
              {steps.map((step, index) => {
                const done = index < currentStep;
                const current = index === currentStep;
                return (
                  <li key={step} className="min-w-0 max-md:flex-1">
                    <button
                      type="button"
                      disabled={isStepDisabled(index)}
                      onClick={() => onStepChange(index)}
                      aria-current={current ? "step" : undefined}
                      aria-label={`${step}, step ${index + 1} of ${steps.length}${done ? ", done" : ""}`}
                      className={cn(
                        "flex w-full min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default max-md:justify-center",
                        current
                          ? "bg-background text-foreground shadow-xs ring-1 ring-border/60"
                          : "text-muted-foreground enabled:hover:bg-background/60 enabled:hover:text-foreground",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full text-xs ring-1",
                          done
                            ? "bg-primary text-primary-foreground ring-primary"
                            : current
                              ? "bg-primary/12 text-primary-text ring-primary/40"
                              : "bg-background/70 ring-border",
                        )}
                      >
                        {done ? <CheckIcon className="size-3.5" /> : index + 1}
                      </span>
                      <span className="truncate max-md:sr-only">{step}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>
          <section className="min-w-0 p-6 md:p-8">
            <AnimatedHeight holdHeight={holdHeight}>{children}</AnimatedHeight>
          </section>
        </DialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  );
}
