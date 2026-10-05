import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as DiscordPresence from "../../polaris/discord/DiscordPresence.ts";
import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

const DiscordPresenceStateSchema = Schema.Struct({
  enabled: Schema.Boolean,
  configured: Schema.Boolean,
  status: Schema.Literals(["stopped", "connecting", "connected", "waiting"]),
});

export const getDiscordPresenceState = makeIpcMethod({
  channel: IpcChannels.POLARIS_DISCORD_PRESENCE_GET_STATE_CHANNEL,
  payload: Schema.Void,
  result: DiscordPresenceStateSchema,
  handler: Effect.fn("desktop.ipc.polaris.discordPresence.getState")(function* () {
    const presence = yield* DiscordPresence.DiscordPresence;
    return yield* presence.getState;
  }),
});

export const setDiscordPresenceEnabled = makeIpcMethod({
  channel: IpcChannels.POLARIS_DISCORD_PRESENCE_SET_ENABLED_CHANNEL,
  payload: Schema.Boolean,
  result: DiscordPresenceStateSchema,
  handler: Effect.fn("desktop.ipc.polaris.discordPresence.setEnabled")(function* (enabled) {
    const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
    const presence = yield* DiscordPresence.DiscordPresence;
    yield* appSettings.setDiscordPresenceEnabled(enabled);
    return yield* presence.syncFromSettings;
  }),
});
