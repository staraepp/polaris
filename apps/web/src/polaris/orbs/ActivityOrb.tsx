import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

import { cssColorToRgb, firstPaletteColor } from "../bots/cssColor";
import type { EffortTier } from "../fx/effortTier";
import { useThemeEpoch } from "../theme/useThemeEpoch";
import {
  ACTIVITY_ORB_LABEL,
  ACTIVITY_ORB_STATE,
  ORB_RAINBOW_TIER,
  orbTintTier,
  type ActivityOrbKind,
} from "./orbStates";

// The canvas painter loads with the first orb on screen.
const ThinkingOrb = lazy(() =>
  import("thinking-orbs").then((module) => ({ default: module.ThinkingOrb })),
);

/** Bolder dots than the library's tuned 20 px mark, so the orb reads beside body text. */
const ORB_DOT_SIZE = 1.35;

/** A saturated base for the rainbow tier's hue cycle (the same one Orbie uses). */
const RAINBOW_BASE = "rgb(255, 92, 138)";

/**
 * A `thinking-orbs` dotted orb (MIT) for the timeline's working and thinking
 * rows. Its ink is the CSS `color` of its box (the brand by default), or the
 * run's effort tier color while a turn works. The library honors reduced
 * motion (a still frame), pauses offscreen and while the tab is hidden, and
 * follows the root `dark` class for its shading.
 */
export function ActivityOrb({
  kind,
  tier = null,
  labelled = false,
  className,
}: {
  readonly kind: ActivityOrbKind;
  /** The run's effort tier: the orb takes that tier's beam color. */
  readonly tier?: EffortTier | null;
  /** Spoken as the activity's name; decorative (hidden) by default, next to a visible label. */
  readonly labelled?: boolean;
  /** Recolor with a text color class. */
  readonly className?: string;
}) {
  const epoch = useThemeEpoch();
  const boxRef = useRef<HTMLSpanElement>(null);
  // undefined until read; null when the color could not be resolved (no canvas).
  const [color, setColor] = useState<string | null | undefined>(undefined);

  const tintTier = orbTintTier(tier);
  const rainbow = tintTier === ORB_RAINBOW_TIER;

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box || typeof getComputedStyle !== "function") return;
    let source = getComputedStyle(box).color;
    if (tintTier !== null && !rainbow) {
      const raw = getComputedStyle(document.documentElement).getPropertyValue(
        `--polaris-beam-${tintTier}`,
      );
      source = firstPaletteColor(raw) ?? source;
    }
    setColor(cssColorToRgb(source));
  }, [epoch, tintTier, rainbow, className]);

  return (
    <span
      ref={boxRef}
      data-polaris-orb={kind}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center text-primary",
        // Reuses Orbie's hue cycle; it stops under reduced motion (orbie.css).
        rainbow && "polaris-orbie-rainbow",
        className,
      )}
      {...(labelled ? {} : { "aria-hidden": true })}
    >
      <Suspense fallback={null}>
        {color === undefined ? null : (
          <ThinkingOrb
            state={ACTIVITY_ORB_STATE[kind]}
            size={20}
            dotSize={ORB_DOT_SIZE}
            {...(rainbow ? { color: RAINBOW_BASE } : color === null ? {} : { color })}
            {...(labelled
              ? { "aria-label": ACTIVITY_ORB_LABEL[kind] }
              : { "aria-hidden": true, role: "presentation" })}
          />
        )}
      </Suspense>
    </span>
  );
}
