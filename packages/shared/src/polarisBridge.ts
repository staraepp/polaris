/**
 * Polaris-only desktop bridge, exposed by the Electron preload as
 * `window.polarisBridge`. It is separate from upstream's `desktopBridge` so
 * fork features never touch the upstream contracts. Absent in browsers.
 */

export type DiscordPresenceStatus = "stopped" | "connecting" | "connected" | "waiting";

export interface DiscordPresenceState {
  /** The user's opt-in switch; off by default. */
  readonly enabled: boolean;
  /** False until a Discord Application ID is built in or set in the environment. */
  readonly configured: boolean;
  readonly status: DiscordPresenceStatus;
}

export interface PolarisBridge {
  readonly discordPresence: {
    readonly getState: () => Promise<DiscordPresenceState>;
    readonly setEnabled: (enabled: boolean) => Promise<DiscordPresenceState>;
  };
}
