import type { DiscordPresenceState } from "@t3tools/shared/polarisBridge";
import { useEffect, useState } from "react";

import { getPolarisBridge } from "../../../polaris/bridge";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

const STATUS_LABEL: Record<DiscordPresenceState["status"], string> = {
  stopped: "Off",
  connecting: "Looking for Discord…",
  connected: "Showing in Discord",
  waiting: "Discord not found. Retrying quietly.",
};

export function DiscordPresenceSetting({ disabled = false }: { readonly disabled?: boolean }) {
  const bridge = getPolarisBridge()?.discordPresence;
  const [state, setState] = useState<DiscordPresenceState | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bridge) return;
    let cancelled = false;
    bridge
      .getState()
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't read the Discord setting.");
      });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  const toggle = async (enabled: boolean) => {
    if (!bridge) return;
    setIsUpdating(true);
    setError(null);
    try {
      setState(await bridge.setEnabled(enabled));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't change this setting.");
    } finally {
      setIsUpdating(false);
    }
  };

  const configured = state?.configured ?? false;
  const enabled = state?.enabled ?? false;
  const status = !bridge
    ? null
    : error !== null
      ? error
      : !configured
        ? "Needs a Discord Application ID before it can show anything."
        : enabled
          ? STATUS_LABEL[state?.status ?? "stopped"]
          : null;

  return (
    <SettingsRow
      {...searchableSetting("discord-presence")}
      title="Discord Rich Presence"
      description="Shows “Coding with Polaris” and how long the app has been open. Never a project, thread, branch or file name. Off by default."
      status={status}
      control={
        <Switch
          checked={enabled}
          disabled={disabled || !bridge || state === null || !configured || isUpdating}
          onCheckedChange={(checked) => void toggle(checked)}
          aria-label="Discord Rich Presence"
        />
      }
    />
  );
}
