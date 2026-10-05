import { assert, describe, it } from "@effect/vitest";

import {
  DISCORD_OP,
  DiscordFrameDecoder,
  DiscordProtocolError,
  discordSocketPaths,
  encodeFrame,
  isErrorFrame,
  isReadyFrame,
  polarisActivity,
  setActivityPayload,
} from "./discordIpc.ts";

describe("discordIpc frames", () => {
  it("round-trips a frame through the encoder and decoder", () => {
    const frame = encodeFrame(DISCORD_OP.HANDSHAKE, { v: 1, client_id: "123" });
    assert.strictEqual(frame.readInt32LE(0), 0);
    assert.strictEqual(frame.readInt32LE(4), frame.length - 8);
    const decoder = new DiscordFrameDecoder();
    assert.deepStrictEqual(decoder.push(frame), [{ op: 0, payload: { v: 1, client_id: "123" } }]);
  });

  it("reassembles frames split across chunks and joined in one chunk", () => {
    const first = encodeFrame(DISCORD_OP.FRAME, { evt: "READY" });
    const second = encodeFrame(DISCORD_OP.PING, { n: 2 });
    const joined = Buffer.concat([first, second]);
    const decoder = new DiscordFrameDecoder();
    assert.deepStrictEqual(decoder.push(joined.subarray(0, 5)), []);
    assert.deepStrictEqual(decoder.push(joined.subarray(5, first.length + 3)), [
      { op: 1, payload: { evt: "READY" } },
    ]);
    assert.deepStrictEqual(decoder.push(joined.subarray(first.length + 3)), [
      { op: 3, payload: { n: 2 } },
    ]);
  });

  it("rejects a corrupt header or body instead of reading garbage", () => {
    const bad = Buffer.alloc(8);
    bad.writeInt32LE(9, 0);
    bad.writeInt32LE(1, 4);
    assert.throws(() => new DiscordFrameDecoder().push(bad), DiscordProtocolError);
    const notJson = Buffer.concat([Buffer.alloc(8), Buffer.from("{nope", "utf8")]);
    notJson.writeInt32LE(1, 0);
    notJson.writeInt32LE(5, 4);
    assert.throws(() => new DiscordFrameDecoder().push(notJson), DiscordProtocolError);
  });

  it("recognises READY and ERROR events only on FRAME opcodes", () => {
    assert.isTrue(isReadyFrame({ op: DISCORD_OP.FRAME, payload: { evt: "READY" } }));
    assert.isFalse(isReadyFrame({ op: DISCORD_OP.HANDSHAKE, payload: { evt: "READY" } }));
    assert.isTrue(isErrorFrame({ op: DISCORD_OP.FRAME, payload: { evt: "ERROR", data: {} } }));
    assert.isFalse(isErrorFrame({ op: DISCORD_OP.FRAME, payload: null }));
  });
});

describe("discordSocketPaths", () => {
  it("uses named pipes on Windows", () => {
    const paths = discordSocketPaths("win32", {});
    assert.strictEqual(paths[0], "\\\\?\\pipe\\discord-ipc-0");
    assert.strictEqual(paths.length, 10);
  });

  it("tries the runtime dir first, then temp dirs, including sandboxed layouts", () => {
    const paths = discordSocketPaths("linux", {
      XDG_RUNTIME_DIR: "/run/user/1000/",
      TMPDIR: "/tmp",
    });
    assert.strictEqual(paths[0], "/run/user/1000/discord-ipc-0");
    assert.include(paths, "/run/user/1000/app/com.discordapp.Discord/discord-ipc-0");
    assert.include(paths, "/tmp/snap.discord/discord-ipc-3");
    assert.strictEqual(paths.filter((path) => path.endsWith("/tmp/discord-ipc-0")).length, 1);
  });
});

describe("activity payloads", () => {
  it("publishes only generic text", () => {
    const activity = polarisActivity(1_700_000_000_000);
    assert.strictEqual(activity.details, "Coding with Polaris");
    assert.deepStrictEqual(activity.timestamps, { start: 1_700_000_000_000 });
    assert.notMatch(JSON.stringify(activity), /thread|repo|branch|file/i);
  });

  it("omits the activity when clearing", () => {
    const payload = setActivityPayload({ pid: 42, nonce: "n", activity: null });
    assert.deepStrictEqual(payload, { cmd: "SET_ACTIVITY", args: { pid: 42 }, nonce: "n" });
  });
});
