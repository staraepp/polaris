import { BOT_ACCESSORIES } from "@t3tools/contracts";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { ORBIE_ACCESSORY_LABELS, ORBIE_NAME } from "../../../polaris/bots/orbie";
import { OrbieAvatar } from "../../../polaris/bots/OrbieAvatar";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

export function BotAvatarsSetting() {
  const enabled = useClientSettings((settings) => settings.botAvatarsEnabled);
  const accessory = useClientSettings((settings) => settings.botAccessory);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsRow
      {...searchableSetting("bot-avatars")}
      description={`${ORBIE_NAME} is the assistant's bot: in the thread header, the working row, the empty thread, each answer and projects without an icon. It hops while the agent works, in the turn's effort color, and dozes while a thread waits or goes quiet. Off brings back the plain look.`}
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ botAvatarsEnabled: Boolean(checked) })
          }
          aria-label={ORBIE_NAME}
        />
      }
    >
      {enabled ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 py-1.5 ps-2 pe-1.5">
          <OrbieAvatar size={32} live />
          <span className="min-w-0 flex-1 truncate text-sm">What {ORBIE_NAME} wears</span>
          <Select
            value={accessory}
            onValueChange={(value) => {
              const next = BOT_ACCESSORIES.find((candidate) => candidate === value);
              if (next !== undefined) void updateSettings({ botAccessory: next });
            }}
          >
            <SelectTrigger size="sm" className="w-32" aria-label={`What ${ORBIE_NAME} wears`}>
              <SelectValue>{ORBIE_ACCESSORY_LABELS[accessory]}</SelectValue>
            </SelectTrigger>
            <SelectPopup align="end" alignItemWithTrigger={false}>
              {BOT_ACCESSORIES.map((option) => (
                <SelectItem key={option} hideIndicator value={option}>
                  {ORBIE_ACCESSORY_LABELS[option]}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      ) : null}
    </SettingsRow>
  );
}
