// @effect-diagnostics nodeBuiltinImport:off -- The test writes real files into a temp Downloads folder.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";

import { setCurrentInviteCode } from "./inviteCodeState.ts";
import { MacManualUpdater, type MacManualUpdaterHost } from "./macManualUpdater.ts";

const DMG = new TextEncoder().encode("pretend this is a disk image");
const sha512 = (bytes: Uint8Array) =>
  NodeCrypto.createHash("sha512").update(bytes).digest("base64");

function manifest(version: string, checksum = sha512(DMG)) {
  return `version: ${version}
files:
  - url: Polaris-${version}-arm64.zip
    sha512: zip==
    size: 10
  - url: Polaris-${version}-arm64.dmg
    sha512: ${checksum}
    size: ${DMG.byteLength}
path: Polaris-${version}-arm64.zip
`;
}

describe("MacManualUpdater (Polaris)", () => {
  let downloads: string;
  let requests: { url: string; code: string | undefined }[];
  let latest: string;
  let opened: string[];
  let quits: number;
  let onQuit: () => void;

  const host = (status = 200): MacManualUpdaterHost => ({
    appVersion: () => "4.6.0",
    downloadsDir: () => downloads,
    fetch: async (url, init) => {
      requests.push({ url, code: init.headers["X-Polaris-Invite"] });
      if (status !== 200) return new Response("no", { status });
      return url.endsWith(".yml") ? new Response(latest) : new Response(DMG);
    },
    openPath: async (path) => {
      opened.push(path);
      return "";
    },
    showItemInFolder: () => {},
    quit: () => {
      quits += 1;
      onQuit();
    },
  });

  const events = (updater: MacManualUpdater) => {
    const seen: string[] = [];
    for (const name of [
      "checking-for-update",
      "update-available",
      "update-not-available",
      "update-downloaded",
    ]) {
      updater.on(name, (info?: { version?: string }) =>
        seen.push(info?.version ? `${name} ${info.version}` : name),
      );
    }
    return seen;
  };

  beforeEach(() => {
    downloads = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "polaris-updates-"));
    requests = [];
    opened = [];
    quits = 0;
    onQuit = () => {};
    latest = manifest("4.7.0");
    setCurrentInviteCode("polaris-test-code");
  });

  afterEach(() => {
    setCurrentInviteCode(null);
    NodeFS.rmSync(downloads, { recursive: true, force: true });
  });

  it("asks for the invite code before contacting the server", async () => {
    setCurrentInviteCode(null);
    const updater = new MacManualUpdater(host());
    await expect(updater.checkForUpdates()).rejects.toThrow(/invite code/);
    expect(requests).toEqual([]);
  });

  it("explains a rejected invite code", async () => {
    const updater = new MacManualUpdater(host(401));
    await expect(updater.checkForUpdates()).rejects.toThrow(/did not accept the invite code/);
  });

  it("reports nothing new when the feed has this version", async () => {
    latest = manifest("4.6.0");
    const updater = new MacManualUpdater(host());
    const seen = events(updater);
    await updater.checkForUpdates();
    expect(seen).toEqual(["checking-for-update", "update-not-available 4.6.0"]);
    expect(requests[0]).toEqual({
      url: "https://polaris.sstarvfx.com/updates/latest-mac.yml",
      code: "polaris-test-code",
    });
  });

  it("downloads the dmg into Downloads, checks it, then opens it and quits", async () => {
    const updater = new MacManualUpdater(host());
    const seen = events(updater);
    await updater.checkForUpdates();
    await updater.downloadUpdate();
    const target = NodePath.join(downloads, "Polaris-4.7.0-arm64.dmg");
    expect(seen).toEqual([
      "checking-for-update",
      "update-available 4.7.0",
      "update-downloaded 4.7.0",
    ]);
    expect(new Uint8Array(NodeFS.readFileSync(target))).toEqual(DMG);
    expect(requests.at(-1)?.code).toBe("polaris-test-code");

    const quitted = new Promise<void>((resolve) => {
      onQuit = resolve;
    });
    updater.quitAndInstall();
    await quitted;
    expect(opened).toEqual([target]);
    expect(quits).toBe(1);
  });

  it("throws away a download whose checksum does not match", async () => {
    latest = manifest("4.7.0", "not-the-real-checksum==");
    const updater = new MacManualUpdater(host());
    await updater.checkForUpdates();
    await expect(updater.downloadUpdate()).rejects.toThrow(/checksum/);
    expect(NodeFS.readdirSync(downloads)).toEqual([]);
  });
});
