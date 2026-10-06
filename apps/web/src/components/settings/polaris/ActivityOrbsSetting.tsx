import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { ActivityOrb } from "../../../polaris/orbs/ActivityOrb";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

export function ActivityOrbsSetting() {
  const enabled = useClientSettings((settings) => settings.activityOrbsEnabled);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsRow
      {...searchableSetting("activity-orbs")}
      description="Dotted orbs beside “Working” and “Thinking” in a thread, in the color of the turn's effort level. They hold still with reduced motion. Off brings back the plain rows."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ activityOrbsEnabled: Boolean(checked) })
          }
          aria-label="Thinking orbs"
        />
      }
    >
      {enabled ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ActivityOrb kind="working" />
            Working
          </span>
          <span className="flex items-center gap-1.5">
            <ActivityOrb kind="thinking" />
            Thinking
          </span>
          <span className="flex items-center gap-1.5">
            <ActivityOrb kind="working" tier="medium" />
            Medium effort
          </span>
          <span className="flex items-center gap-1.5">
            <ActivityOrb kind="thinking" tier="xhigh" />
            Extra high
          </span>
        </div>
      ) : null}
    </SettingsRow>
  );
}
