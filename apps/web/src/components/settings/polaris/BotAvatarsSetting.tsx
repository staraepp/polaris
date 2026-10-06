import { BOT_AVATAR_TYPES, type BotAvatarType } from "@t3tools/contracts";
import { lazy, Suspense } from "react";

import { useTheme } from "../../../hooks/useTheme";
import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { BOT_SETTINGS_DRIVERS, botLookFor, defaultBotType } from "../../../polaris/bots/botConfig";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

const BotAvatar = lazy(() =>
  import("bot-avatars").then((module) => ({ default: module.BotAvatar })),
);

const label = (type: BotAvatarType) => type.charAt(0).toUpperCase() + type.slice(1);

export function BotAvatarsSetting() {
  const enabled = useClientSettings((settings) => settings.botAvatarsEnabled);
  const overrides = useClientSettings((settings) => settings.botAvatarByDriver);
  const updateSettings = useUpdateClientSettings();
  const { resolvedTheme } = useTheme();

  return (
    <SettingsRow
      {...searchableSetting("bot-avatars")}
      description="A small animated bot beside the thread title: it hops while the agent works, waits while it needs you and dozes once the thread goes quiet."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ botAvatarsEnabled: Boolean(checked) })
          }
          aria-label="Bot avatars"
        />
      }
    >
      {enabled ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {BOT_SETTINGS_DRIVERS.map(({ driver, label: providerLabel }) => {
            const look = botLookFor(driver, overrides, resolvedTheme);
            return (
              <li
                key={driver}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 py-1.5 ps-2 pe-1.5"
              >
                <span className="inline-flex size-8 shrink-0 items-center justify-center">
                  <Suspense fallback={null}>
                    <BotAvatar type={look.type} color={look.color} size={32} paused aria-hidden />
                  </Suspense>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{providerLabel}</span>
                <Select
                  value={look.type}
                  onValueChange={(value) => {
                    const type = BOT_AVATAR_TYPES.find((candidate) => candidate === value);
                    if (type === undefined) return;
                    const { [driver]: _previous, ...rest } = overrides;
                    void updateSettings({
                      botAvatarByDriver:
                        type === defaultBotType(driver) ? rest : { ...rest, [driver]: type },
                    });
                  }}
                >
                  <SelectTrigger size="sm" className="w-28" aria-label={`${providerLabel} bot`}>
                    <SelectValue>{label(look.type)}</SelectValue>
                  </SelectTrigger>
                  <SelectPopup align="end" alignItemWithTrigger={false}>
                    {BOT_AVATAR_TYPES.map((type) => (
                      <SelectItem key={type} hideIndicator value={type}>
                        {label(type)}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </li>
            );
          })}
        </ul>
      ) : null}
    </SettingsRow>
  );
}
