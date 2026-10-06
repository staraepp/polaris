// @effect-diagnostics nodeBuiltinImport:off -- Like electron-updater, which it stands in for, this streams the download outside any Effect fiber.
import * as NodeCrypto from "node:crypto";
import { EventEmitter } from "node:events";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

import {
  isNewerVersion,
  parseReleaseManifest,
  pickMacInstaller,
  POLARIS_INVITE_HEADER,
  POLARIS_UPDATE_FEED_URL,
  safeInstallerFileName,
  type PolarisReleaseFile,
} from "@t3tools/shared/polarisUpdateFeed";

import { currentInviteCode, MISSING_INVITE_CODE_MESSAGE } from "./inviteCodeState.ts";

/** What the Mac updater needs from Electron; injected so tests run without it. */
export interface MacManualUpdaterHost {
  readonly appVersion: () => string;
  readonly downloadsDir: () => string;
  readonly fetch: (url: string, init: { headers: Record<string, string> }) => Promise<Response>;
  /** Opens the dmg in Finder; resolves to an error message, or "" on success. */
  readonly openPath: (path: string) => Promise<string>;
  readonly showItemInFolder: (path: string) => void;
  readonly quit: () => void;
}

interface PendingUpdate {
  readonly version: string;
  readonly installer: PolarisReleaseFile;
}

/**
 * The Mac side of Polaris updates (V 4.7.0). Polaris is not signed with an
 * Apple Developer ID, so macOS will not let an update replace the app on its
 * own. Instead this finds the new version on the private feed, downloads its
 * dmg into Downloads (checked against the feed's sha512), and on install
 * opens the dmg and quits, so the user drags the new Polaris into
 * Applications. It speaks electron-updater's events, so `DesktopUpdates`
 * drives it exactly like the real updater.
 */
export class MacManualUpdater extends EventEmitter {
  feedUrl = POLARIS_UPDATE_FEED_URL;
  allowDowngrade = false;
  private pending: PendingUpdate | null = null;
  private downloadedPath: string | null = null;
  private readonly host: MacManualUpdaterHost;

  constructor(host: MacManualUpdaterHost) {
    super();
    this.host = host;
  }

  private headers(): Record<string, string> {
    const code = currentInviteCode();
    if (code === null) throw new Error(MISSING_INVITE_CODE_MESSAGE);
    return { [POLARIS_INVITE_HEADER]: code };
  }

  private async request(name: string): Promise<Response> {
    const response = await this.host.fetch(new URL(name, this.feedUrl).toString(), {
      headers: this.headers(),
    });
    if (response.status === 401) {
      throw new Error(
        "The update server did not accept the invite code. Check it in Settings → General → Updates.",
      );
    }
    if (!response.ok) throw new Error(`The update server answered ${response.status}.`);
    return response;
  }

  async checkForUpdates(): Promise<void> {
    this.headers();
    this.emit("checking-for-update");
    const manifest = parseReleaseManifest(await (await this.request("latest-mac.yml")).text());
    if (manifest === null) throw new Error("The update server sent an unreadable release list.");
    const installer = pickMacInstaller(manifest);
    const current = this.host.appVersion();
    const differs = manifest.version !== current;
    const wanted = isNewerVersion(manifest.version, current) || (this.allowDowngrade && differs);
    if (!wanted || installer === null) {
      this.pending = null;
      this.emit("update-not-available", { version: manifest.version });
      return;
    }
    this.pending = { version: manifest.version, installer };
    this.emit("update-available", { version: manifest.version });
  }

  async downloadUpdate(): Promise<void> {
    const pending = this.pending;
    if (pending === null) throw new Error("There is no update to download.");
    const fileName = safeInstallerFileName(pending.installer.url);
    if (fileName === null) throw new Error("The update server offered an unexpected file.");
    const response = await this.request(pending.installer.url);
    if (response.body === null) throw new Error("The update download was empty.");

    const target = NodePath.join(this.host.downloadsDir(), fileName);
    const partial = `${target}.download`;
    const total = pending.installer.size ?? Number(response.headers.get("content-length") ?? 0);
    const hash = NodeCrypto.createHash("sha512");
    const out = NodeFS.createWriteStream(partial, { mode: 0o644 });
    let received = 0;
    let lastPercent = -1;
    try {
      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        hash.update(value);
        received += value.byteLength;
        if (!out.write(value)) await new Promise<void>((resolve) => out.once("drain", resolve));
        if (total > 0) {
          const percent = Math.min(100, (received / total) * 100);
          if (Math.floor(percent) !== lastPercent) {
            lastPercent = Math.floor(percent);
            this.emit("download-progress", { percent });
          }
        }
      }
      await new Promise<void>((resolve, reject) => {
        out.end((error?: Error | null) => (error ? reject(error) : resolve()));
      });
    } catch (error) {
      out.destroy();
      await NodeFS.promises.rm(partial, { force: true });
      throw error;
    }

    const digest = hash.digest("base64");
    if (pending.installer.sha512 !== null && digest !== pending.installer.sha512) {
      await NodeFS.promises.rm(partial, { force: true });
      throw new Error("The downloaded update did not match the server's checksum.");
    }
    await NodeFS.promises.rename(partial, target);
    this.downloadedPath = target;
    this.emit("download-progress", { percent: 100 });
    this.emit("update-downloaded", { version: pending.version });
  }

  quitAndInstall(): void {
    const path = this.downloadedPath;
    if (path === null) throw new Error("The update has not been downloaded yet.");
    void this.host
      .openPath(path)
      .then((failure) => {
        if (failure !== "") this.host.showItemInFolder(path);
      })
      .finally(() => this.host.quit());
  }
}
