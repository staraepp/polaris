import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

export function GooeyComposerMenuSetting() {
  const enabled = useClientSettings((settings) => settings.gooeyComposerMenuEnabled);
  const updateSettings = useUpdateClientSettings();
  return (
    <SettingsRow
      {...searchableSetting("gooey-composer-menu")}
      description="Swap the composer's paperclip for a “+” whose actions (attach, commands and skills, file mentions) pop out as liquid chips."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ gooeyComposerMenuEnabled: Boolean(checked) })
          }
          aria-label="Liquid composer menu"
        />
      }
    />
  );
}
