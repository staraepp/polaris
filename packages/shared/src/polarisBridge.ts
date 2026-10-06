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

/** Where a recorded clip is transcribed. */
export type VoiceBackend = "clide" | "openaiCompatible";

/** Secrets the desktop main process keeps for voice; the renderer never reads them back. */
export type VoiceSecretKind = "clideToken" | "openaiCompatibleKey";

export interface VoiceSecretsState {
  readonly clideToken: boolean;
  readonly openaiCompatibleKey: boolean;
  /** False when `safeStorage` is unavailable: secrets then last until the app quits. */
  readonly persistent: boolean;
}

export interface VoiceTranscribeRequest {
  readonly backend: VoiceBackend;
  /** 16 kHz mono 16-bit PCM WAV. */
  readonly wav: Uint8Array;
  readonly clidePort?: number | undefined;
  readonly baseUrl?: string | undefined;
  readonly model?: string | undefined;
  readonly language?: string | undefined;
}

export type VoiceTranscribeResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type ClideDictationState = "idle" | "recording" | "transcribing" | "inserting" | "error";

/** Clide's own dictation, forwarded so the composer can glow while it listens. */
export type ClideLiveEvent =
  | { readonly type: "state"; readonly state: ClideDictationState }
  | { readonly type: "level"; readonly level: number }
  | {
      readonly type: "connection";
      readonly status: "connected" | "reconnecting" | "unauthorized" | "stopped";
    };

export interface PolarisBridge {
  readonly discordPresence: {
    readonly getState: () => Promise<DiscordPresenceState>;
    readonly setEnabled: (enabled: boolean) => Promise<DiscordPresenceState>;
  };
  /** Absent on desktop builds older than v2. */
  readonly voice?: {
    readonly getSecrets: () => Promise<VoiceSecretsState>;
    readonly setSecret: (kind: VoiceSecretKind, value: string) => Promise<VoiceSecretsState>;
    readonly clearSecret: (kind: VoiceSecretKind) => Promise<VoiceSecretsState>;
    readonly transcribe: (request: VoiceTranscribeRequest) => Promise<VoiceTranscribeResult>;
    /** Follows Clide's event stream on this port; `null` stops following. */
    readonly watchClide: (port: number | null) => Promise<void>;
    readonly onClideEvent: (listener: (event: ClideLiveEvent) => void) => () => void;
  };
}
