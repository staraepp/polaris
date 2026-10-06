import type { BotAvatarState } from "bot-avatars";
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useClientSettings } from "~/hooks/useSettings";
import { cn } from "~/lib/utils";

import type { EffortTier } from "../fx/effortTier";
import { usePrefersReducedMotion } from "../fx/usePrefersReducedMotion";
import { cssColorToRgb, firstPaletteColor } from "./cssColor";
import {
  ORBIE_ACCESSORY_PROPS,
  ORBIE_SHADING,
  ORBIE_SMALL_BELOW_PX,
  ORBIE_SMALL_SHADING,
  ORBIE_STATE_TEXT,
  ORBIE_TYPE,
} from "./orbie";
import { useThemeEpoch } from "../theme/useThemeEpoch";

// The canvas renderer loads with the first Orbie on screen.
const BotAvatar = lazy(() =>
  import("bot-avatars").then((module) => ({ default: module.BotAvatar })),
);

function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  useEffect(() => {
    if (typeof document === "undefined" || typeof document.addEventListener !== "function") return;
    const update = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/**
 * Bumps whenever the theme changes (the root's class, theme id or inline
 * tokens), so canvas colors read from CSS are read again.
 */
/** high is the rainbow tier: the bot cycles its hue instead of taking one color. */
const RAINBOW_TIER: EffortTier = "high";

/**
 * Orbie, the assistant's bot (`bot-avatars`, MIT). Its body color is the CSS
 * `color` of its box: the brand by default, a project's color when the caller
 * sets one, and the effort tier's color while it works. Only `live` bots
 * animate; every other one holds a still pose (`paused`), and all of them stop
 * while the page is hidden. Reduced motion: the library holds still, and so
 * do we.
 */
export function OrbieAvatar({
  size,
  state = "default",
  live = false,
  tier = null,
  label = null,
  className,
}: {
  /** CSS pixels, or "fill" to take the box size from `className` (project icons). */
  readonly size: number | "fill";
  readonly state?: BotAvatarState;
  /** Animate this one (the header, the working row, the empty state). */
  readonly live?: boolean;
  /** While working, take this effort tier's color. */
  readonly tier?: EffortTier | null;
  /** Spoken name (the state is added); decorative, hidden from assistive tech, when null. */
  readonly label?: string | null;
  /** Sizing and, to recolor it, a text color class. */
  readonly className?: string;
}) {
  const accessory = useClientSettings((settings) => settings.botAccessory);
  const visible = usePageVisible();
  const reducedMotion = usePrefersReducedMotion();
  const epoch = useThemeEpoch();
  const boxRef = useRef<HTMLSpanElement>(null);
  // undefined until read; null when the color could not be resolved (no canvas).
  const [color, setColor] = useState<string | null | undefined>(undefined);

  const working = state === "working";
  const tintTier = working && tier !== null && tier !== "none" && tier !== "neutral" ? tier : null;
  const rainbow = tintTier === RAINBOW_TIER;

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

  const animate = live && visible && !reducedMotion;
  return (
    <span
      ref={boxRef}
      data-polaris-orbie
      data-state={state}
      className={cn(
        "polaris-orbie-body inline-flex shrink-0 items-center justify-center",
        rainbow && animate && "polaris-orbie-rainbow",
        className,
      )}
      {...(size === "fill" ? {} : { style: { width: size, height: size } })}
      {...(label === null ? { "aria-hidden": true } : {})}
    >
      <Suspense fallback={null}>
        {color === undefined ? null : (
          <BotAvatar
            type={ORBIE_TYPE}
            {...(rainbow ? { color: "rgb(255, 92, 138)" } : color === null ? {} : { color })}
            state={state}
            size={size === "fill" ? "100%" : size}
            paused={!animate}
            shading={
              size === "fill" || size < ORBIE_SMALL_BELOW_PX ? ORBIE_SMALL_SHADING : ORBIE_SHADING
            }
            {...ORBIE_ACCESSORY_PROPS[accessory]}
            {...(label === null
              ? { "aria-hidden": true }
              : { "aria-label": `${label} ${ORBIE_STATE_TEXT[state]}` })}
          />
        )}
      </Suspense>
    </span>
  );
}
