/**
 * The Discord local IPC wire format, with no I/O. Discord listens on a unix
 * socket (or a Windows named pipe) and speaks framed JSON: an int32 little-
 * endian opcode, an int32 little-endian byte length, then UTF-8 JSON.
 */

export const DISCORD_OP = {
  HANDSHAKE: 0,
  FRAME: 1,
  CLOSE: 2,
  PING: 3,
  PONG: 4,
} as const;

export type DiscordOp = (typeof DISCORD_OP)[keyof typeof DISCORD_OP];

export interface DiscordFrame {
  readonly op: DiscordOp;
  readonly payload: unknown;
}

const HEADER_BYTES = 8;
const MAX_FRAME_BYTES = 1024 * 1024;

export class DiscordProtocolError extends Error {
  override readonly name = "DiscordProtocolError";
}

export function encodeFrame(op: DiscordOp, payload: unknown): Buffer {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const frame = Buffer.allocUnsafe(HEADER_BYTES + body.length);
  frame.writeInt32LE(op, 0);
  frame.writeInt32LE(body.length, 4);
  body.copy(frame, HEADER_BYTES);
  return frame;
}

/** Reassembles frames from a byte stream; chunks may split or join frames. */
export class DiscordFrameDecoder {
  #buffer: Buffer = Buffer.alloc(0);

  push(chunk: Uint8Array): DiscordFrame[] {
    this.#buffer =
      this.#buffer.length === 0 ? Buffer.from(chunk) : Buffer.concat([this.#buffer, chunk]);
    const frames: DiscordFrame[] = [];
    while (this.#buffer.length >= HEADER_BYTES) {
      const op = this.#buffer.readInt32LE(0);
      const length = this.#buffer.readInt32LE(4);
      if (!isDiscordOp(op) || length < 0 || length > MAX_FRAME_BYTES) {
        throw new DiscordProtocolError(`Bad frame header (op ${op}, length ${length}).`);
      }
      if (this.#buffer.length < HEADER_BYTES + length) break;
      const body = this.#buffer.subarray(HEADER_BYTES, HEADER_BYTES + length).toString("utf8");
      this.#buffer = this.#buffer.subarray(HEADER_BYTES + length);
      let payload: unknown;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new DiscordProtocolError("Frame body is not JSON.");
      }
      frames.push({ op, payload });
    }
    return frames;
  }
}

function isDiscordOp(value: number): value is DiscordOp {
  return value >= 0 && value <= 4 && Number.isInteger(value);
}

/**
 * Where a running Discord client may be listening, most likely first. Discord
 * tries `discord-ipc-0` through `-9`; sandboxed Linux builds nest the socket
 * under a flatpak or snap directory.
 */
export function discordSocketPaths(
  platform: NodeJS.Platform,
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  const paths: string[] = [];
  if (platform === "win32") {
    for (let index = 0; index < 10; index += 1) paths.push(`\\\\?\\pipe\\discord-ipc-${index}`);
    return paths;
  }
  const bases = [env.XDG_RUNTIME_DIR, env.TMPDIR, env.TMP, env.TEMP, "/tmp"]
    .filter((base): base is string => typeof base === "string" && base.length > 0)
    .map((base) => base.replace(/\/+$/, ""))
    .filter((base, index, all) => all.indexOf(base) === index);
  for (let index = 0; index < 10; index += 1) {
    for (const base of bases) {
      paths.push(`${base}/discord-ipc-${index}`);
      paths.push(`${base}/app/com.discordapp.Discord/discord-ipc-${index}`);
      paths.push(`${base}/snap.discord/discord-ipc-${index}`);
    }
  }
  return paths;
}

export function handshakePayload(clientId: string): { v: 1; client_id: string } {
  return { v: 1, client_id: clientId };
}

export interface DiscordActivity {
  readonly details: string;
  readonly timestamps: { readonly start: number };
  readonly assets?: { readonly large_image: string; readonly large_text: string };
  readonly instance: false;
}

/** Generic by design: never a repo, thread, branch or file name. */
export function polarisActivity(startedAtMs: number): DiscordActivity {
  return {
    details: "Coding with Polaris",
    timestamps: { start: startedAtMs },
    assets: { large_image: "polaris", large_text: "Polaris" },
    instance: false,
  };
}

export function setActivityPayload(input: {
  readonly pid: number;
  readonly nonce: string;
  readonly activity: DiscordActivity | null;
}): { cmd: "SET_ACTIVITY"; args: { pid: number; activity?: DiscordActivity }; nonce: string } {
  return {
    cmd: "SET_ACTIVITY",
    args:
      input.activity === null ? { pid: input.pid } : { pid: input.pid, activity: input.activity },
    nonce: input.nonce,
  };
}

export function isReadyFrame(frame: DiscordFrame): boolean {
  return frame.op === DISCORD_OP.FRAME && eventOf(frame.payload) === "READY";
}

export function isErrorFrame(frame: DiscordFrame): boolean {
  return frame.op === DISCORD_OP.FRAME && eventOf(frame.payload) === "ERROR";
}

function eventOf(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const event = (payload as { evt?: unknown }).evt;
  return typeof event === "string" ? event : null;
}
