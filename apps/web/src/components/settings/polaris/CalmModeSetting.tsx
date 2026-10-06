import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

/**
 * Settings → Appearance (Polaris, V 5.1.0): Calm mode, a quieter look modelled
 * on the Claude app. It pauses effects without changing their own settings.
 */
export function CalmModeSetting() {
  const enabled = useClientSettings((settings) => settings.calmMode);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsRow
      {...searchableSetting("calm-mode")}
      description="Softer colors, less text and nothing moving. Your theme and effects come back when you turn it off."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) => void updateSettings({ calmMode: Boolean(checked) })}
          aria-label="Calm mode"
        />
      }
    />
  );
}

/** Shown above effect settings while Calm mode pauses them. */
export function CalmPausedNote() {
  const calm = useClientSettings((settings) => settings.calmMode);
  if (!calm) return null;
  return (
    <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">
      Paused while Calm mode is on. Your choices are kept.
    </p>
  );
}
