import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useClientSettings } from "../../hooks/useSettings";
import { useCalmMode } from "../calm/useCalmMode";
import { usePrefersReducedMotion } from "../fx/usePrefersReducedMotion";
import { AA_TEXT_CONTRAST, contrastFloorPercent, UI_TEXT_CONTRAST } from "./backgroundContrast";
import { type PlaybackDecision, videoPlayback } from "./backgroundRules";
import { readThemeTextColors, sampleBackground, type ThemeTextColors } from "./backgroundSampling";
import {
  loadBackground,
  publishContrastFloor,
  subscribeBackgroundChanges,
} from "./backgroundStore";

import "./background.css";

interface LoadedMedia {
  readonly kind: "image" | "video";
  readonly url: string;
}

/** The stored file as an object URL while enabled; revoked on change. */
function useStoredBackground(enabled: boolean): LoadedMedia | null {
  const [media, setMedia] = useState<LoadedMedia | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let url: string | null = null;
    const load = () => {
      loadBackground()
        .then((stored) => {
          if (cancelled) return;
          if (url !== null) URL.revokeObjectURL(url);
          url = stored === null ? null : URL.createObjectURL(stored.blob);
          setMedia(stored === null || url === null ? null : { kind: stored.kind, url });
        })
        .catch(() => {
          if (!cancelled) setMedia(null);
        });
    };
    load();
    const unsubscribe = subscribeBackgroundChanges(load);
    return () => {
      cancelled = true;
      unsubscribe();
      if (url !== null) URL.revokeObjectURL(url);
      setMedia(null);
    };
  }, [enabled]);

  return enabled ? media : null;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
}
const readHidden = () => document.visibilityState === "hidden";
const readFocused = () => document.hasFocus();

interface BatteryLike extends EventTarget {
  readonly charging: boolean;
  readonly level: number;
}

/** The Battery API where Chromium/Electron offers it; null elsewhere. */
function useBattery(active: boolean) {
  const [battery, setBattery] = useState<{ charging: boolean; level: number } | null>(null);
  useEffect(() => {
    if (!active) return;
    const getBattery = (navigator as unknown as { getBattery?: () => Promise<BatteryLike> })
      .getBattery;
    if (typeof getBattery !== "function") return;
    let manager: BatteryLike | null = null;
    const update = () => {
      if (manager !== null) setBattery({ charging: manager.charging, level: manager.level });
    };
    getBattery
      .call(navigator)
      .then((value) => {
        manager = value;
        update();
        value.addEventListener("chargingchange", update);
        value.addEventListener("levelchange", update);
      })
      .catch(() => undefined);
    return () => {
      manager?.removeEventListener("chargingchange", update);
      manager?.removeEventListener("levelchange", update);
    };
  }, [active]);
  return battery;
}

/** Whether a video background may play right now (see `videoPlayback`). */
export function useVideoPlayback(active: boolean): PlaybackDecision {
  const reducedMotion = usePrefersReducedMotion();
  const pageHidden = useSyncExternalStore(subscribeVisibility, readHidden, () => false);
  const windowFocused = useSyncExternalStore(subscribeVisibility, readFocused, () => true);
  const battery = useBattery(active);
  return videoPlayback({ reducedMotion, pageHidden, windowFocused, battery });
}

function BackgroundVideo({ url, style }: { readonly url: string; readonly style: object }) {
  const ref = useRef<HTMLVideoElement>(null);
  const decision = useVideoPlayback(true);

  useEffect(() => {
    const video = ref.current;
    if (video === null) return;
    if (decision.play) void video.play().catch(() => undefined);
    else video.pause();
  }, [decision.play]);

  return (
    <video
      ref={ref}
      src={url}
      muted
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      className="size-full object-cover"
      style={style}
      data-polaris-background-playing={decision.play || undefined}
    />
  );
}

/**
 * The lowest Dim that keeps text readable over this picture in this theme
 * (body text 4.5:1, muted labels 3:1; see backgroundContrast.ts):
 * sampled once per file, re-read when the theme changes, and published for
 * the settings row.
 */
function useContrastFloor(media: LoadedMedia | null): number {
  const [cells, setCells] = useState<{
    readonly url: string;
    readonly cells: Awaited<ReturnType<typeof sampleBackground>>;
  } | null>(null);

  useEffect(() => {
    if (media === null) return;
    let cancelled = false;
    void sampleBackground(media.kind, media.url).then((sampled) => {
      if (!cancelled) setCells({ url: media.url, cells: sampled });
    });
    return () => {
      cancelled = true;
    };
  }, [media]);

  const sampled = media !== null && cells?.url === media.url ? cells.cells : null;
  const colors = useThemeTextColors();
  const floor =
    sampled === null || colors === null
      ? 0
      : contrastFloorPercent(sampled, colors.page, [
          { text: colors.text, target: AA_TEXT_CONTRAST },
          { text: colors.mutedText, target: UI_TEXT_CONTRAST },
        ]);

  useEffect(() => {
    publishContrastFloor(floor);
  }, [floor]);
  useEffect(() => () => publishContrastFloor(0), []);
  return floor;
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme-id", "style"],
  });
  return () => observer.disconnect();
}

/** A stable string for the snapshot; parsed by the hook below. */
function readThemeTextKey(): string {
  const colors = readThemeTextColors();
  return colors === null ? "" : [...colors.page, ...colors.text, ...colors.mutedText].join(",");
}

function useThemeTextColors(): ThemeTextColors | null {
  const key = useSyncExternalStore(subscribeTheme, readThemeTextKey, () => "");
  const parts = key === "" ? [] : key.split(",").map(Number);
  if (parts.length !== 9) return null;
  const [r1 = 0, g1 = 0, b1 = 0, r2 = 0, g2 = 0, b2 = 0, r3 = 0, g3 = 0, b3 = 0] = parts;
  return { page: [r1, g1, b1], text: [r2, g2, b2], mutedText: [r3, g3, b3] };
}

/**
 * The app background (Polaris, V 4.1.0): your own image or video behind the
 * whole window, off by default. A scrim in the page color (Dim, never below
 * the contrast floor) keeps text readable over any picture; the layout's own fills turn transparent and the
 * sidebar turns to glass only while a background is showing (`background.css`).
 */
export function AppBackground() {
  // Calm mode pauses the background; the picture and its setting are kept.
  const calm = useCalmMode();
  const enabled = useClientSettings((settings) => settings.backgroundEnabled) && !calm;
  const dim = useClientSettings((settings) => settings.backgroundDim);
  const blur = useClientSettings((settings) => settings.backgroundBlur);
  const media = useStoredBackground(enabled);
  const floor = useContrastFloor(media);
  const showing = enabled && media !== null;

  useEffect(() => {
    const root = document.documentElement;
    if (showing) root.dataset.polarisBackdrop = "";
    else delete root.dataset.polarisBackdrop;
    return () => {
      delete root.dataset.polarisBackdrop;
    };
  }, [showing]);

  if (!showing) return null;
  // A blur shows the edges; scaling a touch hides them.
  const mediaStyle = blur > 0 ? { filter: `blur(${blur}px)`, transform: "scale(1.06)" } : {};
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      data-polaris-backdrop-layer
    >
      {media.kind === "image" ? (
        <img src={media.url} alt="" className="size-full object-cover" style={mediaStyle} />
      ) : (
        // Keyed by file, so a new video mounts fresh and its play effect runs.
        <BackgroundVideo key={media.url} url={media.url} style={mediaStyle} />
      )}
      <div
        className="absolute inset-0 bg-background"
        style={{ opacity: Math.max(dim, floor) / 100 }}
      />
    </div>
  );
}
