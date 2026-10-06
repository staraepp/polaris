import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

export function ComposerUsageMeterSetting() {
  const enabled = useClientSettings((settings) => settings.composerUsageMeterEnabled);
  const updateSettings = useUpdateClientSettings();
  return (
    <SettingsRow
      {...searchableSetting("composer-usage-meter")}
      description="Show the selected provider's 5-hour and weekly limits as a small gauge beside the send button. It turns amber only at the low quota warning."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ composerUsageMeterEnabled: Boolean(checked) })
          }
          aria-label="Usage meter in the composer"
        />
      }
    />
  );
}
