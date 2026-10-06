import type { BorderBeamColorVariant, BorderBeamSize } from "../vendor/border-beam";
import type { EffortTier } from "./effortTier";

/** How one tier's beam looks: `border-beam` props plus where its colors live. */
export interface BeamLook {
  readonly size: BorderBeamSize;
  /** The stock palette, used as is, or as the fallback when the token is empty. */
  readonly colorVariant: BorderBeamColorVariant;
  /**
   * CSS custom property holding the tier's exact palette (comma-separated hex),
   * with light values on `:root` and dark ones on `.dark` (`composerFx.css`).
   * Null: the stock palette is the look (high's rainbow).
   */
  readonly paletteToken: string | null;
  /** False keeps the library's hue drift (high's rainbow); exact palettes stay put. */
  readonly staticColors: boolean;
  readonly strength: number;
  /** Seconds per revolution (or breath): lower is faster. */
  readonly duration: number;
  readonly brightness?: number;
  readonly hueRange?: number;
}

/** Tiers that draw a beam; `none` is the composer's own static border. */
export type BeamTier = Exclude<EffortTier, "none">;

/**
 * The beam per effort tier (final colors, decided by Star): low a calm true
 * blue breath, medium gold, high the library's rainbow, xhigh an aurora teal,
 * max an icy white-blue shimmer; neutral is the grey fallback for a level
 * that does not resolve. Edit the colors in `composerFx.css`, not here.
 */
export const BEAM_LOOKS = {
  low: {
    size: "pulse-inner",
    colorVariant: "ice",
    paletteToken: "--polaris-beam-low",
    staticColors: true,
    strength: 0.75,
    duration: 2.3,
  },
  medium: {
    size: "md",
    colorVariant: "gold",
    paletteToken: "--polaris-beam-medium",
    staticColors: true,
    strength: 0.9,
    duration: 1.96,
  },
  high: {
    size: "md",
    colorVariant: "colorful",
    paletteToken: null,
    staticColors: false,
    strength: 1,
    duration: 1.5,
  },
  xhigh: {
    size: "md",
    colorVariant: "forest",
    paletteToken: "--polaris-beam-xhigh",
    staticColors: true,
    strength: 1,
    duration: 1.3,
  },
  max: {
    size: "md",
    colorVariant: "ice",
    paletteToken: "--polaris-beam-max",
    staticColors: true,
    strength: 1,
    duration: 1.1,
    brightness: 1.5,
  },
  neutral: {
    size: "md",
    colorVariant: "mono",
    paletteToken: null,
    staticColors: true,
    // mono already paints at half opacity; full strength keeps the grey readable.
    strength: 1,
    duration: 2,
  },
} as const satisfies Record<BeamTier, BeamLook>;

/**
 * The optional idle beam (Settings → Effects, off by default): a slow, faint
 * line in the brand green, so an idle composer reads as alive without looking
 * like a running turn. Colors in `--polaris-beam-idle`.
 */
export const IDLE_BEAM_LOOK: BeamLook = {
  size: "line",
  colorVariant: "forest",
  paletteToken: "--polaris-beam-idle",
  staticColors: true,
  strength: 0.6,
  duration: 7,
};

export function beamLookFor(tier: EffortTier): BeamLook {
  return BEAM_LOOKS[tier === "none" ? "neutral" : tier];
}

/** A palette token's value as a color list; empty when unset. */
export function parsePaletteToken(raw: string): string[] {
  return raw
    .split(",")
    .map((color) => color.trim())
    .filter((color) => color.length > 0);
}
