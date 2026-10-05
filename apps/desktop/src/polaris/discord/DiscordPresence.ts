// @effect-diagnostics globalTimers:off -- The controller's timers are handed to it as plain functions; they fire at socket boundaries.

import type { DiscordPresenceState } from "@t3tools/shared/polarisBridge";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as DesktopEnvironment from "../../app/DesktopEnvironment.ts";
import * as DesktopAppSettings from "../../settings/DesktopAppSettings.ts";
import { resolveDiscordApplicationId } from "./discordConfig.ts";
import { discordSocketPaths } from "./discordIpc.ts";
import { DiscordPresenceController } from "./DiscordPresenceController.ts";
import { connectDiscordSocket } from "./discordSocket.ts";

export class DiscordPresence extends Context.Service<
  DiscordPresence,
  {
    readonly getState: Effect.Effect<DiscordPresenceState>;
    /** Starts or stops presence to match the persisted switch. */
    readonly syncFromSettings: Effect.Effect<DiscordPresenceState>;
  }
>()("@t3tools/desktop/polaris/discord/DiscordPresence") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  const appSettings = yield* DesktopAppSettings.DesktopAppSettings;
  const clientId = resolveDiscordApplicationId(process.env);
  const controller =
    clientId === null
      ? null
      : new DiscordPresenceController({
          clientId,
          socketPaths: discordSocketPaths(environment.platform, process.env),
          connect: connectDiscordSocket,
          pid: process.pid,
          setTimer: (callback, delayMs) => setTimeout(callback, delayMs),
          clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
          log: (message, detail) =>
            Effect.runSync(Effect.logDebug(message).pipe(Effect.annotateLogs({ detail }))),
        });

  yield* Effect.addFinalizer(() => Effect.sync(() => controller?.stop()));

  const getState: Effect.Effect<DiscordPresenceState> = Effect.map(appSettings.get, (settings) => ({
    enabled: settings.discordPresenceEnabled,
    configured: controller !== null,
    status: controller?.status ?? "stopped",
  }));

  const syncFromSettings = Effect.gen(function* () {
    const settings = yield* appSettings.get;
    if (controller !== null) {
      if (settings.discordPresenceEnabled) controller.start(yield* Clock.currentTimeMillis);
      else controller.stop();
    }
    return yield* getState;
  }).pipe(Effect.withSpan("desktop.polaris.discordPresence.sync"));

  return DiscordPresence.of({ getState, syncFromSettings });
});

export const layer = Layer.effect(DiscordPresence, make);
