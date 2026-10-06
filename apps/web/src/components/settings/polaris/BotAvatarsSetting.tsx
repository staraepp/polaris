import { BOT_ACCESSORIES, BOT_COLOR_MODES, BOT_SHAPES } from "@t3tools/contracts";
import type { ReactNode } from "react";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import {
  BOT_COLOR_LABELS,
  botShapeLabel,
  ORBIE_ACCESSORY_LABELS,
  ORBIE_NAME,
} from "../../../polaris/bots/orbie";
import { OrbieAvatar } from "../../../polaris/bots/OrbieAvatar";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

/** Made-up project names for the preview, so it shows the variety without real data. */
const SAMPLE_PROJECTS = ["Website", "Notes", "Game", "API", "Docs", "Mobile"] as const;

function ChoiceRow({ label, control }: { readonly label: string; readonly control: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      {control}
    </div>
  );
}

export function BotAvatarsSetting() {
  const enabled = useClientSettings((settings) => settings.botAvatarsEnabled);
  const accessory = useClientSettings((settings) => settings.botAccessory);
  const shape = useClientSettings((settings) => settings.botShape);
  const colors = useClientSettings((settings) => settings.botColors);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsRow
      {...searchableSetting("bot-avatars")}
      description={`${ORBIE_NAME} is the assistant's bot: in the thread header, the empty thread, each answer and projects without an icon. Each project can have its own bot. It hops while the agent works, in the turn's effort color, and dozes while a thread waits or goes quiet. Off brings back the plain look.`}
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
        <div className="mt-3 flex flex-col gap-1 rounded-lg border border-border/60 bg-background/40 px-2.5 py-2">
          <div
            className="flex flex-wrap items-center gap-3 pb-2"
            role="group"
            aria-label="Preview of the bots"
          >
            <span className="flex flex-col items-center gap-1">
              <OrbieAvatar size={32} live label={ORBIE_NAME} />
              <span className="text-2xs text-muted-foreground">{ORBIE_NAME}</span>
            </span>
            {SAMPLE_PROJECTS.map((project) => (
              <span key={project} className="flex flex-col items-center gap-1">
                <OrbieAvatar size={32} project={project} label={`${project}'s bot`} />
                <span className="text-2xs text-muted-foreground">{project}</span>
              </span>
            ))}
          </div>
          <ChoiceRow
            label="Shape"
            control={
              <Select
                value={shape}
                onValueChange={(value) => {
                  const next = BOT_SHAPES.find((candidate) => candidate === value);
                  if (next !== undefined) void updateSettings({ botShape: next });
                }}
              >
                <SelectTrigger size="sm" className="w-44" aria-label="Bot shape">
                  <SelectValue>{botShapeLabel(shape)}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  {BOT_SHAPES.map((option) => (
                    <SelectItem key={option} hideIndicator value={option}>
                      {botShapeLabel(option)}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            }
          />
          <ChoiceRow
            label="Colors"
            control={
              <Select
                value={colors}
                onValueChange={(value) => {
                  const next = BOT_COLOR_MODES.find((candidate) => candidate === value);
                  if (next !== undefined) void updateSettings({ botColors: next });
                }}
              >
                <SelectTrigger size="sm" className="w-44" aria-label="Bot colors">
                  <SelectValue>{BOT_COLOR_LABELS[colors]}</SelectValue>
                </SelectTrigger>
                <SelectPopup align="end" alignItemWithTrigger={false}>
                  {BOT_COLOR_MODES.map((option) => (
                    <SelectItem key={option} hideIndicator value={option}>
                      {BOT_COLOR_LABELS[option]}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
            }
          />
          <ChoiceRow
            label={`What ${ORBIE_NAME} wears`}
            control={
              <Select
                value={accessory}
                onValueChange={(value) => {
                  const next = BOT_ACCESSORIES.find((candidate) => candidate === value);
                  if (next !== undefined) void updateSettings({ botAccessory: next });
                }}
              >
                <SelectTrigger size="sm" className="w-44" aria-label={`What ${ORBIE_NAME} wears`}>
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
            }
          />
        </div>
      ) : null}
    </SettingsRow>
  );
}
