// @effect-diagnostics globalTimers:off -- The reconnect timer runs at a socket callback boundary, outside Effect fibers.

import type { DiscordPresenceStatus } from "@t3tools/shared/polarisBridge";

import {
  DISCORD_OP,
  DiscordFrameDecoder,
  encodeFrame,
  handshakePayload,
  isErrorFrame,
  isReadyFrame,
  polarisActivity,
  setActivityPayload,
  type DiscordFrame,
} from "./discordIpc.ts";

export interface DiscordConnection {
  readonly write: (data: Uint8Array) => void;
  readonly end: () => void;
}

export interface DiscordConnectionHandlers {
  readonly onData: (chunk: Uint8Array) => void;
  readonly onClose: () => void;
  readonly onError: (error: unknown) => void;
}

/** Resolves once the transport is connected; rejects when the path is not listening. */
export type DiscordConnect = (
  path: string,
  handlers: DiscordConnectionHandlers,
) => Promise<DiscordConnection>;

export interface DiscordPresenceControllerOptions {
  readonly clientId: string;
  readonly socketPaths: readonly string[];
  readonly connect: DiscordConnect;
  readonly pid: number;
  readonly setTimer: (callback: () => void, delayMs: number) => unknown;
  readonly clearTimer: (handle: unknown) => void;
  readonly log?: (message: string, detail?: unknown) => void;
  readonly initialRetryMs?: number;
  readonly maxRetryMs?: number;
  readonly readyTimeoutMs?: number;
}

export const DEFAULT_INITIAL_RETRY_MS = 5_000;
export const DEFAULT_MAX_RETRY_MS = 60_000;
const DEFAULT_READY_TIMEOUT_MS = 10_000;

/**
 * Keeps one presence session alive while enabled: finds Discord, handshakes,
 * publishes the generic activity, and reconnects with exponential backoff
 * when Discord is missing or goes away. Silent by design when there is no
 * Discord to talk to.
 */
export class DiscordPresenceController {
  readonly #options: DiscordPresenceControllerOptions;
  #running = false;
  #status: DiscordPresenceStatus = "stopped";
  #generation = 0;
  #connection: DiscordConnection | null = null;
  #retryHandle: unknown = null;
  #readyHandle: unknown = null;
  #retryMs: number;
  #startedAt = 0;
  #nonceCount = 0;

  constructor(options: DiscordPresenceControllerOptions) {
    this.#options = options;
    this.#retryMs = options.initialRetryMs ?? DEFAULT_INITIAL_RETRY_MS;
  }

  get status(): DiscordPresenceStatus {
    return this.#status;
  }

  /** `startedAtMs` is what Discord shows as the elapsed time. */
  start(startedAtMs: number): void {
    if (this.#running) return;
    this.#running = true;
    this.#startedAt = startedAtMs;
    this.#retryMs = this.#options.initialRetryMs ?? DEFAULT_INITIAL_RETRY_MS;
    void this.#attempt(++this.#generation);
  }

  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    this.#generation += 1;
    this.#clearTimers();
    const connection = this.#connection;
    this.#connection = null;
    if (connection !== null) {
      if (this.#status === "connected") {
        try {
          connection.write(
            encodeFrame(
              DISCORD_OP.FRAME,
              setActivityPayload({ pid: this.#options.pid, nonce: this.#nonce(), activity: null }),
            ),
          );
        } catch {
          // Discord is gone; nothing to clear.
        }
      }
      connection.end();
    }
    this.#status = "stopped";
  }

  async #attempt(generation: number): Promise<void> {
    if (!this.#isCurrent(generation)) return;
    this.#status = "connecting";
    const decoder = new DiscordFrameDecoder();
    for (const path of this.#options.socketPaths) {
      if (!this.#isCurrent(generation)) return;
      let connection: DiscordConnection;
      try {
        connection = await this.#options.connect(path, {
          onData: (chunk) => this.#onData(generation, decoder, chunk),
          onClose: () => this.#onClose(generation),
          onError: (error) => this.#onError(generation, error),
        });
      } catch {
        continue;
      }
      if (!this.#isCurrent(generation)) {
        connection.end();
        return;
      }
      this.#connection = connection;
      connection.write(encodeFrame(DISCORD_OP.HANDSHAKE, handshakePayload(this.#options.clientId)));
      this.#readyHandle = this.#options.setTimer(() => {
        this.#readyHandle = null;
        if (!this.#isCurrent(generation)) return;
        this.#options.log?.("Discord did not answer the handshake; retrying later.");
        this.#dropConnection(generation);
      }, this.#options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS);
      return;
    }
    this.#scheduleRetry(generation);
  }

  #onData(generation: number, decoder: DiscordFrameDecoder, chunk: Uint8Array): void {
    if (!this.#isCurrent(generation)) return;
    let frames: DiscordFrame[];
    try {
      frames = decoder.push(chunk);
    } catch (error) {
      this.#options.log?.("Discord sent a frame Polaris could not read.", error);
      this.#dropConnection(generation);
      return;
    }
    for (const frame of frames) {
      if (!this.#isCurrent(generation) || this.#connection === null) return;
      if (frame.op === DISCORD_OP.PING) {
        this.#connection.write(encodeFrame(DISCORD_OP.PONG, frame.payload));
      } else if (frame.op === DISCORD_OP.CLOSE) {
        this.#dropConnection(generation);
        return;
      } else if (isReadyFrame(frame)) {
        this.#clearReadyTimer();
        this.#status = "connected";
        this.#retryMs = this.#options.initialRetryMs ?? DEFAULT_INITIAL_RETRY_MS;
        this.#connection.write(
          encodeFrame(
            DISCORD_OP.FRAME,
            setActivityPayload({
              pid: this.#options.pid,
              nonce: this.#nonce(),
              activity: polarisActivity(this.#startedAt),
            }),
          ),
        );
      } else if (isErrorFrame(frame)) {
        this.#options.log?.("Discord rejected the presence request.", frame.payload);
        this.#dropConnection(generation);
        return;
      }
    }
  }

  #onClose(generation: number): void {
    if (!this.#isCurrent(generation)) return;
    this.#connection = null;
    this.#clearReadyTimer();
    this.#scheduleRetry(generation);
  }

  #onError(generation: number, error: unknown): void {
    if (!this.#isCurrent(generation)) return;
    this.#options.log?.("Discord connection failed.", error);
    this.#dropConnection(generation);
  }

  #dropConnection(generation: number): void {
    const connection = this.#connection;
    this.#connection = null;
    this.#clearReadyTimer();
    // Ending triggers onClose on real sockets; bump the generation so that
    // callback is ignored and exactly one retry is scheduled here.
    this.#generation += 1;
    connection?.end();
    this.#scheduleRetry(this.#generation);
    void generation;
  }

  #scheduleRetry(generation: number): void {
    if (!this.#running || generation !== this.#generation) return;
    this.#status = "waiting";
    const delay = this.#retryMs;
    this.#retryMs = Math.min(this.#retryMs * 2, this.#options.maxRetryMs ?? DEFAULT_MAX_RETRY_MS);
    this.#retryHandle = this.#options.setTimer(() => {
      this.#retryHandle = null;
      void this.#attempt(generation);
    }, delay);
  }

  #nonce(): string {
    this.#nonceCount += 1;
    return `polaris-${this.#nonceCount}`;
  }

  #isCurrent(generation: number): boolean {
    return this.#running && generation === this.#generation;
  }

  #clearReadyTimer(): void {
    if (this.#readyHandle !== null) {
      this.#options.clearTimer(this.#readyHandle);
      this.#readyHandle = null;
    }
  }

  #clearTimers(): void {
    this.#clearReadyTimer();
    if (this.#retryHandle !== null) {
      this.#options.clearTimer(this.#retryHandle);
      this.#retryHandle = null;
    }
  }
}
