import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

/** Settings → Appearance (Polaris, V 4.7.1): the artwork behind "Polaris" in the sidebar. */
export function SidebarArtworkSetting() {
  const enabled = useClientSettings((settings) => settings.sidebarArtworkEnabled);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsRow
      {...searchableSetting("sidebar-artwork")}
      description="The green artwork behind “Polaris” at the top of the sidebar."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ sidebarArtworkEnabled: Boolean(checked) })
          }
          aria-label="Sidebar artwork"
        />
      }
    />
  );
}
