/**
 * Rules for the app background (Polaris, V 4.1.0): which files are accepted,
 * and when a video background may play. Pure, so the decisions are testable.
 */

export const BACKGROUND_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/avif",
  "image/gif",
] as const;
export const BACKGROUND_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const BACKGROUND_IMAGE_MAX_BYTES = 25 * 1024 * 1024;
export const BACKGROUND_VIDEO_MAX_BYTES = 200 * 1024 * 1024;

export type BackgroundMediaKind = "image" | "video";

export type BackgroundFileCheck =
  | { readonly ok: true; readonly kind: BackgroundMediaKind }
  | { readonly ok: false; readonly message: string };

const megabytes = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Accepts common still images up to 25 MB and mp4/webm/mov video up to 200 MB. */
export function checkBackgroundFile(file: {
  readonly type: string;
  readonly size: number;
}): BackgroundFileCheck {
  const type = file.type.toLowerCase();
  const kind: BackgroundMediaKind | null = (BACKGROUND_IMAGE_TYPES as readonly string[]).includes(
    type,
  )
    ? "image"
    : (BACKGROUND_VIDEO_TYPES as readonly string[]).includes(type)
      ? "video"
      : null;
  if (kind === null) {
    return {
      ok: false,
      message: "Pick a PNG, JPEG, WebP, AVIF or GIF image, or an MP4, WebM or MOV video.",
    };
  }
  const limit = kind === "image" ? BACKGROUND_IMAGE_MAX_BYTES : BACKGROUND_VIDEO_MAX_BYTES;
  if (file.size > limit) {
    return {
      ok: false,
      message: `That ${kind} is ${megabytes(file.size)}; the limit is ${megabytes(limit)}.`,
    };
  }
  if (file.size === 0) return { ok: false, message: "That file is empty." };
  return { ok: true, kind };
}

/** Below this charge, on battery, a video background holds still. */
export const LOW_BATTERY_LEVEL = 0.2;

export interface PlaybackConditions {
  readonly reducedMotion: boolean;
  readonly pageHidden: boolean;
  readonly windowFocused: boolean;
  /** Null when the Battery API is not available. */
  readonly battery: { readonly charging: boolean; readonly level: number } | null;
}

export type PlaybackDecision =
  | { readonly play: true }
  | {
      readonly play: false;
      readonly reason: "reduced-motion" | "hidden" | "unfocused" | "low-battery";
    };

/**
 * A video background plays only while someone can see it and it costs
 * nothing they asked to save: never under reduced motion, a hidden page, an
 * unfocused window or a low battery.
 */
export function videoPlayback(conditions: PlaybackConditions): PlaybackDecision {
  if (conditions.reducedMotion) return { play: false, reason: "reduced-motion" };
  if (conditions.pageHidden) return { play: false, reason: "hidden" };
  if (!conditions.windowFocused) return { play: false, reason: "unfocused" };
  const { battery } = conditions;
  if (battery !== null && !battery.charging && battery.level < LOW_BATTERY_LEVEL) {
    return { play: false, reason: "low-battery" };
  }
  return { play: true };
}

export const PLAYBACK_PAUSE_TEXT: Record<
  Extract<PlaybackDecision, { play: false }>["reason"],
  string
> = {
  "reduced-motion": "Paused because Reduce motion is on.",
  hidden: "Paused while Polaris is hidden.",
  unfocused: "Paused while the window is in the background.",
  "low-battery": "Paused to save battery.",
};
