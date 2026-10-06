import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";

import { POLARIS_INVITE_HEADER, POLARIS_UPDATE_FEED_URL } from "@t3tools/shared/polarisUpdateFeed";
import { app, net, shell } from "electron";
import { autoUpdater } from "electron-updater";

import {
  currentInviteCode,
  MISSING_INVITE_CODE_MESSAGE,
} from "../polaris/updates/inviteCodeState.ts";
import { MacManualUpdater } from "../polaris/updates/macManualUpdater.ts";

type AutoUpdater = typeof autoUpdater;

export type ElectronUpdaterFeedUrl = Parameters<AutoUpdater["setFeedURL"]>[0];

export class ElectronUpdaterCheckForUpdatesError extends Schema.TaggedError<ElectronUpdaterCheckForUpdatesError>()(
  "ElectronUpdaterCheckForUpdatesError",
  {
    channel: Schema.NullOr(Schema.String),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Electron updater failed to check for updates on channel ${this.channel ?? "default"}.`;
  }
}

export class ElectronUpdaterDownloadUpdateError extends Schema.TaggedError<ElectronUpdaterDownloadUpdateError>()(
  "ElectronUpdaterDownloadUpdateError",
  {
    channel: Schema.NullOr(Schema.String),
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Electron updater failed to download the update on channel ${this.channel ?? "default"}.`;
  }
}

export class ElectronUpdaterQuitAndInstallError extends Schema.TaggedError<ElectronUpdaterQuitAndInstallError>()(
  "ElectronUpdaterQuitAndInstallError",
  {
    channel: Schema.NullOr(Schema.String),
    isSilent: Schema.Boolean,
    isForceRunAfter: Schema.Boolean,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Electron updater failed to quit and install the update on channel ${this.channel ?? "default"} (silent: ${this.isSilent}, force run after: ${this.isForceRunAfter}).`;
  }
}

export const ElectronUpdaterError = Schema.Union([
  ElectronUpdaterCheckForUpdatesError,
  ElectronUpdaterDownloadUpdateError,
  ElectronUpdaterQuitAndInstallError,
]);
export type ElectronUpdaterError = typeof ElectronUpdaterError.Type;

export class ElectronUpdater extends Context.Service<
  ElectronUpdater,
  {
    readonly setFeedURL: (options: ElectronUpdaterFeedUrl) => Effect.Effect<void>;
    readonly setAutoDownload: (value: boolean) => Effect.Effect<void>;
    readonly setAutoInstallOnAppQuit: (value: boolean) => Effect.Effect<void>;
    readonly setChannel: (channel: string) => Effect.Effect<void>;
    readonly setAllowPrerelease: (value: boolean) => Effect.Effect<void>;
    readonly allowDowngrade: Effect.Effect<boolean>;
    readonly setAllowDowngrade: (value: boolean) => Effect.Effect<void>;
    readonly setFullChangelog: (value: boolean) => Effect.Effect<void>;
    readonly setDisableDifferentialDownload: (value: boolean) => Effect.Effect<void>;
    readonly checkForUpdates: Effect.Effect<void, ElectronUpdaterCheckForUpdatesError>;
    readonly downloadUpdate: Effect.Effect<void, ElectronUpdaterDownloadUpdateError>;
    readonly quitAndInstall: (options: {
      readonly isSilent: boolean;
      readonly isForceRunAfter: boolean;
    }) => Effect.Effect<void, ElectronUpdaterQuitAndInstallError>;
    readonly on: <Args extends ReadonlyArray<unknown>>(
      eventName: string,
      listener: (...args: Args) => void,
    ) => Effect.Effect<void, never, Scope.Scope>;
  }
>()("@t3tools/desktop/electron/ElectronUpdater") {}

/** @public Service construction is part of the canonical Effect module API. */
export const make = ElectronUpdater.of({
  setFeedURL: (options) =>
    Effect.suspend(() => {
      autoUpdater.setFeedURL(options);
      return Effect.void;
    }),
  setAutoDownload: (value) =>
    Effect.suspend(() => {
      autoUpdater.autoDownload = value;
      return Effect.void;
    }),
  setAutoInstallOnAppQuit: (value) =>
    Effect.suspend(() => {
      autoUpdater.autoInstallOnAppQuit = value;
      return Effect.void;
    }),
  setChannel: (channel) =>
    Effect.suspend(() => {
      autoUpdater.channel = channel;
      return Effect.void;
    }),
  setAllowPrerelease: (value) =>
    Effect.suspend(() => {
      autoUpdater.allowPrerelease = value;
      return Effect.void;
    }),
  allowDowngrade: Effect.sync(() => autoUpdater.allowDowngrade),
  setAllowDowngrade: (value) =>
    Effect.suspend(() => {
      autoUpdater.allowDowngrade = value;
      return Effect.void;
    }),
  setFullChangelog: (value) =>
    Effect.suspend(() => {
      autoUpdater.fullChangelog = value;
      return Effect.void;
    }),
  setDisableDifferentialDownload: (value) =>
    Effect.suspend(() => {
      autoUpdater.disableDifferentialDownload = value;
      return Effect.void;
    }),
  checkForUpdates: Effect.suspend(() => {
    const channel = autoUpdater.channel;
    return Effect.tryPromise({
      try: () => autoUpdater.checkForUpdates(),
      catch: (cause) => new ElectronUpdaterCheckForUpdatesError({ channel, cause }),
    }).pipe(Effect.asVoid);
  }),
  downloadUpdate: Effect.suspend(() => {
    const channel = autoUpdater.channel;
    return Effect.tryPromise({
      try: () => autoUpdater.downloadUpdate(),
      catch: (cause) => new ElectronUpdaterDownloadUpdateError({ channel, cause }),
    }).pipe(Effect.asVoid);
  }),
  quitAndInstall: ({ isSilent, isForceRunAfter }) =>
    Effect.suspend(() => {
      const channel = autoUpdater.channel;
      return Effect.try({
        try: () => autoUpdater.quitAndInstall(isSilent, isForceRunAfter),
        catch: (cause) =>
          new ElectronUpdaterQuitAndInstallError({
            channel,
            isSilent,
            isForceRunAfter,
            cause,
          }),
      });
    }),
  on: (eventName, listener) => {
    const eventTarget = autoUpdater as unknown as {
      on: (eventName: string, listener: (...args: Array<unknown>) => void) => void;
      removeListener: (eventName: string, listener: (...args: Array<unknown>) => void) => void;
    };
    const untypedListener = listener as unknown as (...args: Array<unknown>) => void;
    return Effect.acquireRelease(
      Effect.sync(() => {
        eventTarget.on(eventName, untypedListener);
      }),
      () =>
        Effect.sync(() => {
          eventTarget.removeListener(eventName, untypedListener);
        }),
    ).pipe(Effect.asVoid);
  },
});

export const layer = Layer.succeed(ElectronUpdater, make);

/**
 * Polaris (V 4.7.0): updates come from the private feed and every request
 * carries the user's invite code. Windows and Linux keep electron-updater,
 * with the code as a request header. macOS uses `MacManualUpdater`: an
 * unsigned app cannot replace itself, so it downloads the dmg and opens it.
 */
function withInviteHeader<A, E>(
  effect: Effect.Effect<A, E>,
  fail: (cause: Error) => E,
): Effect.Effect<A, E> {
  return Effect.suspend(() => {
    const code = currentInviteCode();
    if (code === null) return Effect.fail(fail(new Error(MISSING_INVITE_CODE_MESSAGE)));
    autoUpdater.requestHeaders = { ...autoUpdater.requestHeaders, [POLARIS_INVITE_HEADER]: code };
    return effect;
  });
}

const makePolarisFeedUpdater = (): ElectronUpdater["Service"] =>
  ElectronUpdater.of({
    ...make,
    checkForUpdates: withInviteHeader(
      make.checkForUpdates,
      (cause) => new ElectronUpdaterCheckForUpdatesError({ channel: autoUpdater.channel, cause }),
    ),
    downloadUpdate: withInviteHeader(
      make.downloadUpdate,
      (cause) => new ElectronUpdaterDownloadUpdateError({ channel: autoUpdater.channel, cause }),
    ),
  });

const makePolarisMacUpdater = (): ElectronUpdater["Service"] => {
  const updater = new MacManualUpdater({
    appVersion: () => app.getVersion(),
    downloadsDir: () => app.getPath("downloads"),
    fetch: (url, init) => net.fetch(url, init),
    openPath: (path) => shell.openPath(path),
    showItemInFolder: (path) => shell.showItemInFolder(path),
    quit: () => app.quit(),
  });
  let channel: string | null = null;
  return ElectronUpdater.of({
    setFeedURL: (options) =>
      Effect.sync(() => {
        const url =
          typeof options === "object" && options !== null && "url" in options ? options.url : null;
        updater.feedUrl = typeof url === "string" && url.length > 0 ? url : POLARIS_UPDATE_FEED_URL;
        if (!updater.feedUrl.endsWith("/")) updater.feedUrl += "/";
      }),
    setAutoDownload: () => Effect.void,
    setAutoInstallOnAppQuit: () => Effect.void,
    setChannel: (next) =>
      Effect.sync(() => {
        channel = next;
      }),
    setAllowPrerelease: () => Effect.void,
    allowDowngrade: Effect.sync(() => updater.allowDowngrade),
    setAllowDowngrade: (value) =>
      Effect.sync(() => {
        updater.allowDowngrade = value;
      }),
    setFullChangelog: () => Effect.void,
    setDisableDifferentialDownload: () => Effect.void,
    checkForUpdates: Effect.tryPromise({
      try: () => updater.checkForUpdates(),
      catch: (cause) => new ElectronUpdaterCheckForUpdatesError({ channel, cause }),
    }),
    downloadUpdate: Effect.tryPromise({
      try: () => updater.downloadUpdate(),
      catch: (cause) => new ElectronUpdaterDownloadUpdateError({ channel, cause }),
    }),
    quitAndInstall: ({ isSilent, isForceRunAfter }) =>
      Effect.try({
        try: () => updater.quitAndInstall(),
        catch: (cause) =>
          new ElectronUpdaterQuitAndInstallError({ channel, isSilent, isForceRunAfter, cause }),
      }),
    on: (eventName, listener) => {
      const untypedListener = listener as unknown as (...args: Array<unknown>) => void;
      return Effect.acquireRelease(
        Effect.sync(() => {
          updater.on(eventName, untypedListener);
        }),
        () =>
          Effect.sync(() => {
            updater.removeListener(eventName, untypedListener);
          }),
      ).pipe(Effect.asVoid);
    },
  });
};

/** The layer the Polaris desktop app uses (main.ts); `layer` stays upstream's. */
export const polarisLayer = Layer.sync(ElectronUpdater, () =>
  process.platform === "darwin" ? makePolarisMacUpdater() : makePolarisFeedUpdater(),
);
