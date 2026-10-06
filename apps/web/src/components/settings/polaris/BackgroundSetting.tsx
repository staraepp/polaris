import { MAX_BACKGROUND_BLUR, MAX_BACKGROUND_DIM, MIN_BACKGROUND_DIM } from "@t3tools/contracts";
import {
  type CSSProperties,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import {
  BACKGROUND_IMAGE_TYPES,
  BACKGROUND_VIDEO_TYPES,
  checkBackgroundFile,
} from "../../../polaris/background/backgroundRules";
import {
  clearBackground,
  loadBackground,
  readContrastFloor,
  saveBackground,
  subscribeContrastFloor,
  subscribeBackgroundChanges,
  type StoredBackground,
} from "../../../polaris/background/backgroundStore";
import { Button } from "../../ui/button";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

const ACCEPT = [...BACKGROUND_IMAGE_TYPES, ...BACKGROUND_VIDEO_TYPES].join(",");

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function sliderStyle(value: number, min: number, max: number): CSSProperties {
  const ratio = (value - min) / (max - min);
  return {
    "--settings-slider-progress": `${ratio * 100}%`,
    "--settings-slider-fill-offset": `${0.5 - ratio}rem`,
  } as CSSProperties;
}

/** The stored file, refreshed whenever it changes. */
function useStoredFile(): StoredBackground | null | "loading" {
  const [stored, setStored] = useState<StoredBackground | null | "loading">("loading");
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      loadBackground()
        .then((value) => {
          if (!cancelled) setStored(value);
        })
        .catch(() => {
          if (!cancelled) setStored(null);
        });
    };
    load();
    const unsubscribe = subscribeBackgroundChanges(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  return stored;
}

function Preview({ stored }: { readonly stored: StoredBackground }) {
  const url = useMemo(() => URL.createObjectURL(stored.blob), [stored.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return stored.kind === "image" ? (
    <img src={url} alt="" className="h-10 w-16 shrink-0 rounded-md object-cover" />
  ) : (
    <video
      src={url}
      muted
      preload="metadata"
      className="h-10 w-16 shrink-0 rounded-md object-cover"
    />
  );
}

function RangeControl({
  id,
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly unit: string;
  readonly onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="w-10 shrink-0 text-xs text-muted-foreground">
        {label}
      </label>
      <input
        id={id}
        type="range"
        className="settings-slider min-w-0 flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        style={sliderStyle(value, min, max)}
        onChange={(event) => {
          const next = Number(event.currentTarget.value);
          if (Number.isInteger(next) && next >= min && next <= max) onChange(next);
        }}
      />
      <output
        htmlFor={id}
        className="min-w-12 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs font-medium tabular-nums text-foreground"
      >
        {value}
        {unit}
      </output>
    </div>
  );
}

/**
 * Polaris: your own image or video behind the app, kept only on this device.
 * Off by default; Dim keeps text readable, video holds still when it should.
 */
export function BackgroundSetting() {
  const enabled = useClientSettings((settings) => settings.backgroundEnabled);
  const dim = useClientSettings((settings) => settings.backgroundDim);
  const blur = useClientSettings((settings) => settings.backgroundBlur);
  const updateSettings = useUpdateClientSettings();
  const stored = useStoredFile();
  const floor = useSyncExternalStore(subscribeContrastFloor, readContrastFloor, () => 0);
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const statusId = useId();
  const dimId = useId();
  const blurId = useId();

  const pick = async (file: File) => {
    const check = checkBackgroundFile(file);
    if (!check.ok) {
      setStatus({ tone: "error", text: check.message });
      return;
    }
    setSaving(true);
    try {
      await saveBackground({ kind: check.kind, name: file.name, blob: file });
      setStatus(null);
      if (!enabled) await updateSettings({ backgroundEnabled: true });
    } catch {
      setStatus({ tone: "error", text: "Could not keep that file in this browser's storage." });
    } finally {
      setSaving(false);
    }
  };

  const hasFile = stored !== "loading" && stored !== null;

  return (
    <SettingsRow
      {...searchableSetting("app-background")}
      description="Your own image or video behind Polaris, kept only on this device. Video plays muted and holds still with Reduce motion, in the background, or on low battery."
      control={
        <Switch
          checked={enabled}
          disabled={!hasFile && !enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ backgroundEnabled: Boolean(checked) })
          }
          aria-label="Show background"
        />
      }
    >
      <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-background/40 p-2.5">
        {/* Wraps on narrow windows: the buttons drop below and the name keeps its room. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {hasFile ? (
            <Preview stored={stored} />
          ) : (
            <span className="h-10 w-16 shrink-0 rounded-md border border-dashed border-border" />
          )}
          <span className="flex min-w-0 flex-1 basis-32 flex-col">
            <span className="line-clamp-2 text-sm break-all">
              {stored === "loading"
                ? "Loading…"
                : stored === null
                  ? "No background chosen"
                  : stored.name}
            </span>
            {hasFile ? (
              <span className="text-xs text-muted-foreground">
                {stored.kind === "image" ? "Image" : "Video"} · {formatBytes(stored.blob.size)}
              </span>
            ) : null}
          </span>
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file !== undefined) void pick(file);
            }}
          />
          <span className="ms-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              aria-describedby={status === null ? undefined : statusId}
              onClick={() => fileInput.current?.click()}
            >
              {saving ? "Saving…" : hasFile ? "Replace…" : "Choose…"}
            </Button>
            {hasFile ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  void clearBackground().then(() => updateSettings({ backgroundEnabled: false }));
                }}
              >
                Remove
              </Button>
            ) : null}
          </span>
        </div>
        {status === null ? null : (
          <p
            id={statusId}
            role={status.tone === "error" ? "alert" : "status"}
            className={
              status.tone === "error"
                ? "text-xs text-destructive-foreground"
                : "text-xs text-muted-foreground"
            }
          >
            {status.text}
          </p>
        )}
        {hasFile ? (
          <>
            <RangeControl
              id={dimId}
              label="Dim"
              value={dim}
              min={MIN_BACKGROUND_DIM}
              max={MAX_BACKGROUND_DIM}
              step={5}
              unit="%"
              onChange={(backgroundDim) => void updateSettings({ backgroundDim })}
            />
            {enabled && floor > dim ? (
              <p className="text-xs text-muted-foreground" role="status">
                Text needs at least {floor}% over this picture in this theme, so Polaris dims it
                that much.
              </p>
            ) : null}
            <RangeControl
              id={blurId}
              label="Blur"
              value={blur}
              min={0}
              max={MAX_BACKGROUND_BLUR}
              step={2}
              unit="px"
              onChange={(backgroundBlur) => void updateSettings({ backgroundBlur })}
            />
          </>
        ) : null}
      </div>
    </SettingsRow>
  );
}
