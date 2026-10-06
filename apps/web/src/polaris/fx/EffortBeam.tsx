import { useLayoutEffect, useRef, useState } from "react";

import { BorderBeam } from "../vendor/border-beam";
import { beamLookFor, IDLE_BEAM_LOOK, parsePaletteToken } from "./beamLooks";
import type { EffortTier } from "./effortTier";

/** The tier's palette from its CSS token, re-read when the theme flips. */
function usePaletteToken(token: string | null, theme: "light" | "dark"): string[] | undefined {
  const [colors, setColors] = useState<string[] | undefined>(undefined);
  useLayoutEffect(() => {
    if (token === null) {
      setColors(undefined);
      return;
    }
    const raw = getComputedStyle(document.documentElement).getPropertyValue(token);
    const parsed = parsePaletteToken(raw);
    setColors(parsed.length > 0 ? parsed : undefined);
  }, [token, theme]);
  return colors;
}

/**
 * The composer's effort beam (vendored `border-beam`), laid over the composer
 * it sits in and matched to its corner radius. Stays mounted so turning it off
 * fades out instead of cutting; nothing paints while it is inactive.
 */
export function EffortBeam({
  tier,
  active,
  idle = false,
  theme,
}: {
  readonly tier: EffortTier;
  readonly active: boolean;
  /** Draw the subtle idle look instead of the tier's. */
  readonly idle?: boolean;
  readonly theme: "light" | "dark";
}) {
  const look = idle ? IDLE_BEAM_LOOK : beamLookFor(tier);
  const colors = usePaletteToken(look.paletteToken, theme);
  const rootRef = useRef<HTMLDivElement>(null);
  const [radius, setRadius] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    const host = rootRef.current?.parentElement;
    if (!host) return;
    const parsed = Number.parseFloat(getComputedStyle(host).borderTopLeftRadius);
    if (Number.isFinite(parsed)) setRadius(parsed);
  }, []);
  return (
    <BorderBeam
      ref={rootRef}
      aria-hidden
      data-polaris-effort-beam
      data-tier={idle ? "idle" : tier}
      active={active}
      size={look.size}
      colorVariant={look.colorVariant}
      {...(colors === undefined ? {} : { colors })}
      staticColors={look.staticColors}
      strength={look.strength}
      duration={look.duration}
      {...(look.brightness === undefined ? {} : { brightness: look.brightness })}
      {...(look.hueRange === undefined ? {} : { hueRange: look.hueRange })}
      {...(radius === undefined ? {} : { borderRadius: radius })}
      theme={theme}
      style={{ position: "absolute", inset: 0, zIndex: 25, pointerEvents: "none" }}
    >
      <span className="block size-full" />
    </BorderBeam>
  );
}
