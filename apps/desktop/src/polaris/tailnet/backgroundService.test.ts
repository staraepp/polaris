// Exercises the native launchd boundary with a disposable home and Node backend.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeNet from "node:net";
import * as NodeHttp from "node:http";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import { describe, expect, it } from "vite-plus/test";

import {
  backgroundServicePayload,
  ensureBackgroundService,
  readBackgroundServicePort,
  renderBackgroundServicePlist,
  serviceDirectory,
  serviceLabel,
  type BackgroundServicePlan,
} from "./backgroundService.ts";

const execute = NodeUtil.promisify(NodeChildProcess.execFile);
const getText = (url: string) =>
  new Promise<string>((resolve, reject) => {
    NodeHttp.get(url, (response) => {
      let text = "";
      response.on("data", (chunk: Buffer) => {
        text += chunk.toString("utf8");
      });
      response.on("end", () => resolve(text));
      response.on("error", reject);
    }).on("error", reject);
  });
const plan: BackgroundServicePlan = {
  baseDir: "/tmp/a&b",
  homeDirectory: "/tmp/home",
  executablePath: process.execPath,
  args: ["/tmp/server.cjs", "--bootstrap-fd", "3"],
  cwd: "/tmp",
  env: { PATH: "/usr/bin", SECRET_TEST_KEY: "do-not-persist" },
  bootstrap: {
    mode: "desktop",
    noBrowser: true,
    port: 4891,
    host: "127.0.0.1",
    desktopBootstrapToken: "test-only-credential",
    desktopTelemetryFd: 4,
    desktopTelemetryControlFd: 5,
    tailscaleServeEnabled: false,
    tailscaleServePort: 443,
  },
};

describe("Polaris background service", () => {
  it("launches at login, restarts on exit, escapes paths, and puts no credential in its plist", () => {
    const plist = renderBackgroundServicePlist(plan);
    expect(plist).toContain("<key>RunAtLoad</key><true/>");
    expect(plist).toContain("<key>KeepAlive</key><true/>");
    expect(plist).toContain("a&amp;b");
    expect(plist).not.toContain(plan.bootstrap.desktopBootstrapToken);
    expect(serviceLabel(plan.baseDir)).not.toEqual(serviceLabel("/tmp/other-install"));
  });

  it("does not persist ambient credentials or the desktop's short-lived telemetry pipes", () => {
    const payload = backgroundServicePayload(plan);
    expect(payload.env).not.toHaveProperty("SECRET_TEST_KEY");
    expect(payload.bootstrap).not.toHaveProperty("desktopTelemetryFd");
    expect(payload.bootstrap).not.toHaveProperty("desktopTelemetryControlFd");
    expect(payload.bootstrap.desktopBootstrapToken).toBe(plan.bootstrap.desktopBootstrapToken);
  });

  it.skipIf(process.env.POLARIS_TEST_LAUNCHD !== "1")(
    "serves independently, survives a crash, and reuses the service when the UI returns",
    async () => {
      const homeDirectory = await NodeFSP.mkdtemp(
        NodePath.join(NodeOS.tmpdir(), "polaris-launchd-test-"),
      );
      const baseDir = NodePath.join(homeDirectory, "state");
      const serverFile = NodePath.join(homeDirectory, "server.cjs");
      const readyFile = NodePath.join(homeDirectory, "ready");
      const probe = NodeNet.createServer();
      await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
      const address = probe.address();
      if (address === null || typeof address === "string") throw new Error("Expected TCP port");
      const port = address.port;
      await new Promise<void>((resolve, reject) =>
        probe.close((error) => (error ? reject(error) : resolve())),
      );
      await NodeFSP.writeFile(
        serverFile,
        `const fs = require("node:fs");
const http = require("node:http");
const bootstrap = JSON.parse(fs.readFileSync(3, "utf8"));
http.createServer((req, res) => {
  if (req.url === "/crash") { res.end("crashing"); res.on("finish", () => process.exit(7)); return; }
  res.end(String(process.pid));
}).listen(bootstrap.port, "127.0.0.1", () => fs.writeFileSync(${JSON.stringify(readyFile)}, String(process.pid)));
`,
      );
      const input: BackgroundServicePlan = {
        ...plan,
        baseDir,
        homeDirectory,
        args: [serverFile],
        cwd: homeDirectory,
        bootstrap: { ...plan.bootstrap, port, t3Home: baseDir },
      };
      const target = `gui/${process.getuid?.()}/${serviceLabel(baseDir)}`;
      const nextReady = (previous: string | null) =>
        new Promise<string>((resolve, reject) => {
          const timeout = AbortSignal.timeout(25_000);
          const expired = () => {
            watcher.close();
            reject(new Error("Service did not become ready"));
          };
          timeout.addEventListener("abort", expired, { once: true });
          const watcher = NodeFS.watch(homeDirectory, () => {
            void NodeFSP.readFile(readyFile, "utf8").then(
              (pid) => {
                if (pid.length === 0 || pid === previous) return;
                timeout.removeEventListener("abort", expired);
                watcher.close();
                resolve(pid);
              },
              () => {},
            );
          });
        });
      try {
        const ready = nextReady(null);
        await ensureBackgroundService(input);
        const firstPid = await ready;
        expect(await getText(`http://127.0.0.1:${port}`)).toBe(firstPid);
        expect(await readBackgroundServicePort(baseDir)).toBe(port);
        const permissions = await NodeFSP.stat(
          NodePath.join(serviceDirectory(baseDir), "plan.json"),
        );
        expect(permissions.mode & 0o777).toBe(0o600);
        await ensureBackgroundService(input);
        expect(await getText(`http://127.0.0.1:${port}`)).toBe(firstPid);
        const restarted = nextReady(firstPid);
        await getText(`http://127.0.0.1:${port}/crash`);
        const secondPid = await restarted;
        expect(secondPid).not.toBe(firstPid);
        expect(await getText(`http://127.0.0.1:${port}`)).toBe(secondPid);
      } finally {
        await execute("/bin/launchctl", ["bootout", "--wait", target], { timeout: 30_000 }).catch(
          () => {},
        );
        await NodeFSP.rm(homeDirectory, { recursive: true, force: true });
      }
    },
    60_000,
  );
});
