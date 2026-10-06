import { describe, expect, it } from "vite-plus/test";

import {
  isNewerVersion,
  parseReleaseManifest,
  pickMacInstaller,
  POLARIS_INVITE_CODE_PATTERN,
  safeInstallerFileName,
} from "./polarisUpdateFeed.ts";

const LATEST_MAC = `version: 4.7.0
files:
  - url: Polaris-4.7.0-arm64.zip
    sha512: abc==
    size: 148487551
  - url: Polaris-4.7.0-arm64.dmg
    sha512: 'def=='
    size: 153812468
path: Polaris-4.7.0-arm64.zip
sha512: abc==
releaseDate: '2026-10-06T18:00:00.000Z'
`;

describe("polaris update feed", () => {
  it("compares MAJOR.MINOR.PATCH versions", () => {
    expect(isNewerVersion("4.7.0", "4.6.0")).toBe(true);
    expect(isNewerVersion("4.10.0", "4.9.3")).toBe(true);
    expect(isNewerVersion("5.0.0", "4.99.99")).toBe(true);
    expect(isNewerVersion("4.6.0", "4.6.0")).toBe(false);
    expect(isNewerVersion("4.5.9", "4.6.0")).toBe(false);
    expect(isNewerVersion("nonsense", "4.6.0")).toBe(false);
  });

  it("reads electron-builder's latest-mac.yml and picks the dmg", () => {
    const manifest = parseReleaseManifest(LATEST_MAC);
    expect(manifest?.version).toBe("4.7.0");
    expect(manifest?.files).toHaveLength(2);
    const dmg = manifest === null ? null : pickMacInstaller(manifest);
    expect(dmg).toEqual({ url: "Polaris-4.7.0-arm64.dmg", sha512: "def==", size: 153812468 });
  });

  it("rejects a manifest without a usable version", () => {
    expect(parseReleaseManifest("files:\n  - url: a.dmg\n")).toBeNull();
    expect(parseReleaseManifest("<html>401</html>")).toBeNull();
  });

  it("only accepts plain installer names for Downloads", () => {
    expect(safeInstallerFileName("Polaris-4.7.0-arm64.dmg")).toBe("Polaris-4.7.0-arm64.dmg");
    expect(safeInstallerFileName("sub/Polaris-4.7.0-arm64.dmg")).toBe("Polaris-4.7.0-arm64.dmg");
    expect(safeInstallerFileName("../../evil.dmg")).toBe("evil.dmg");
    expect(safeInstallerFileName(".hidden.dmg")).toBeNull();
    expect(safeInstallerFileName("Polaris.app")).toBeNull();
  });

  it("accepts the generated invite code shape", () => {
    expect(POLARIS_INVITE_CODE_PATTERN.test("polaris-ab2c-de3f-gh4k")).toBe(true);
    expect(POLARIS_INVITE_CODE_PATTERN.test("short")).toBe(false);
    expect(POLARIS_INVITE_CODE_PATTERN.test("has space in it")).toBe(false);
  });
});
