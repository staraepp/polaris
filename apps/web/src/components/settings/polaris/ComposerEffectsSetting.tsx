import { useState } from "react";

import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";
import { useTheme } from "~/hooks/useTheme";
import { ComposerFx } from "~/polaris/fx/ComposerFx";
import type { ComposerFxState } from "~/polaris/fx/composerFxState";
import type { EffortTier } from "~/polaris/fx/effortTier";
import { usePrefersReducedMotion } from "~/polaris/fx/usePrefersReducedMotion";
import { cn } from "~/lib/utils";

import { Switch } from "../../ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

/** What the preview can show: a running turn per effort tier, the keyword flames, the idle beam, or voice. */
const PREVIEWS = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
  { id: "xhigh", label: "Extra high" },
  { id: "max", label: "Max" },
  { id: "flames", label: "Flames" },
  { id: "idle", label: "Idle" },
  { id: "voice", label: "Voice" },
] as const;
type PreviewId = (typeof PREVIEWS)[number]["id"];

const isPreviewId = (value: unknown): value is PreviewId =>
  PREVIEWS.some((preview) => preview.id === value);

/** A made-up microphone level for the voice preview: a lively, irregular pulse. */
function demoVoiceLevel(): number {
  const t = performance.now() / 1000;
  return 0.3 + 0.25 * Math.abs(Math.sin(t * 3.1)) + 0.15 * Math.abs(Math.sin(t * 7.3));
}

function previewState(preview: PreviewId, animated: boolean): ComposerFxState {
  if (preview === "voice") return { layer: "voice", tier: "neutral", animated };
  if (preview === "idle") return { layer: animated ? "idle" : "none", tier: "neutral", animated };
  if (preview === "flames") return { layer: "flames", tier: "max", animated };
  const tier: EffortTier = preview;
  return { layer: "beam", tier, animated };
}

/**
 * Settings → Effects: what the composer outline does, with a live preview.
 * The beam only shows while a turn runs and voice only while you dictate, so
 * without this a new user never sees either.
 */
export function ComposerEffectsSetting() {
  const idleBeam = useClientSettings((settings) => settings.composerIdleBeamEnabled);
  const voiceEnabled = useClientSettings((settings) => settings.voiceInputEnabled);
  const updateSettings = useUpdateClientSettings();
  const { resolvedTheme } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [preview, setPreview] = useState<PreviewId>("medium");
  const state = previewState(preview, !reducedMotion);

  return (
    <SettingsRow
      {...searchableSetting("composer-effects")}
      description={
        <>
          The beam circles the composer only while the agent works, in the color of the turn's
          effort level. With Claude, the top thinking keyword in your message sets the composer on
          fire, while you type it and while that turn runs. Voice glows while you dictate; voice
          input is {voiceEnabled ? "on" : "off until you turn it on under Voice"}. The idle beam is
          a faint green line when nothing is running (off by default).
          {reducedMotion ? " Reduced motion is on, so the preview stays still." : ""}
        </>
      }
      control={
        <Switch
          checked={idleBeam}
          onCheckedChange={(checked) =>
            void updateSettings({ composerIdleBeamEnabled: Boolean(checked) })
          }
          aria-label="Idle beam"
        />
      }
    >
      <div className="mt-3 flex flex-col gap-2.5">
        <div
          data-polaris-fx-preview
          className={cn(
            "relative flex h-20 items-start rounded-3xl border border-border/70 bg-card px-4 py-3 text-sm text-muted-foreground/70 shadow-xs",
            // Room above for the flames to rise into.
            preview === "flames" && "mt-8",
          )}
        >
          <span className="relative z-30">
            {preview === "voice"
              ? "Listening…"
              : preview === "idle"
                ? "Ask anything…"
                : "The agent is working…"}
          </span>
          <ComposerFx
            state={state}
            theme={resolvedTheme}
            voice={
              preview === "voice"
                ? { level: demoVoiceLevel, processing: false, theme: resolvedTheme }
                : null
            }
          />
        </div>
        <ToggleGroup
          aria-label="Preview"
          variant="segmented"
          className="w-full flex-wrap *:flex-1"
          value={[preview]}
          onValueChange={(value) => {
            const next = value[0];
            if (isPreviewId(next)) setPreview(next);
          }}
        >
          {PREVIEWS.map((option) => (
            <ToggleGroupItem key={option.id} value={option.id} className="whitespace-nowrap">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </SettingsRow>
  );
}
