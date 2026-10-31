// Native launchd adapter; its generated standalone launcher also runs without Effect.
// @effect-diagnostics nodeBuiltinImport:off
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeUtil from "node:util";

import type { DesktopBackendBootstrap } from "@t3tools/contracts";

const execute = NodeUtil.promisify(NodeChildProcess.execFile);

export interface BackgroundServicePlan {
  readonly baseDir: string;
  readonly homeDirectory: string;
  readonly executablePath: string;
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly bootstrap: DesktopBackendBootstrap;
}

export const serviceDirectory = (baseDir: string) =>
  NodePath.join(baseDir, "userdata", "background-service");
export const serviceLabel = (baseDir: string) =>
  `app.polaris.desktop.service.${NodeCrypto.createHash("sha256").update(baseDir).digest("hex").slice(0, 12)}`;

const xml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** launchd owns the backend, never the Electron window or its shutdown scope. */
export function renderBackgroundServicePlist(plan: BackgroundServicePlan): string {
  const directory = serviceDirectory(plan.baseDir);
  const program = [plan.executablePath, NodePath.join(directory, "launcher.cjs")];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${serviceLabel(plan.baseDir)}</string>
<key>ProgramArguments</key><array>${program.map((arg) => `<string>${xml(arg)}</string>`).join("")}</array>
<key>EnvironmentVariables</key><dict><key>ELECTRON_RUN_AS_NODE</key><string>1</string></dict>
<key>WorkingDirectory</key><string>${xml(plan.homeDirectory)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>5</integer><key>ExitTimeOut</key><integer>90</integer>
<key>ProcessType</key><string>Interactive</string>
<key>StandardOutPath</key><string>${xml(NodePath.join(directory, "service.log"))}</string>
<key>StandardErrorPath</key><string>${xml(NodePath.join(directory, "service.log"))}</string>
</dict></plist>
`;
}

// Contains no secret values. The private plan is read on each launch, including
// login/crash restarts. Bootstrap secrets travel on fd3, never argv or a log.
export const BACKGROUND_SERVICE_LAUNCHER = `const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "plan.json"), "utf8"));
const child = spawn(plan.executablePath, plan.args, {
  cwd: plan.cwd, env: plan.env, stdio: ["ignore", "inherit", "inherit", "pipe"]
});
child.stdio[3].on("error", () => {});
child.stdio[3].end(JSON.stringify(plan.bootstrap) + "\\n");
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => {
  if (stopping) return;
  stopping = true;
  child.kill(signal);
  setTimeout(() => child.kill("SIGKILL"), 80000).unref();
});
child.on("error", () => { console.error("Polaris background server could not start."); process.exit(1); });
child.on("exit", (code) => process.exit(code ?? 1));
`;

async function readOptional(file: string): Promise<string | null> {
  try {
    return await NodeFSP.readFile(file, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
      return null;
    throw new Error("Could not read Polaris background service configuration.", { cause: error });
  }
}

async function writePrivate(file: string, contents: string): Promise<void> {
  const temporary = `${file}.tmp`;
  await NodeFSP.writeFile(temporary, contents, { mode: 0o600 });
  await NodeFSP.chmod(temporary, 0o600);
  await NodeFSP.rename(temporary, file);
}

export async function readBackgroundServicePort(baseDir: string): Promise<number | null> {
  const value = await readOptional(NodePath.join(serviceDirectory(baseDir), "port"));
  if (value === null) return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Invalid Polaris background service port.");
  return port;
}

/** No ambient credentials are persisted; provider CLIs use their own stores. */
export function backgroundServicePayload(plan: BackgroundServicePlan) {
  const {
    desktopTelemetryFd: _telemetry,
    desktopTelemetryControlFd: _control,
    ...bootstrap
  } = plan.bootstrap;
  return {
    executablePath: plan.executablePath,
    args: plan.args,
    cwd: plan.cwd,
    env: {
      PATH: plan.env.PATH,
      HOME: plan.homeDirectory,
      ELECTRON_RUN_AS_NODE: "1",
      T3CODE_HOME: plan.baseDir,
    },
    bootstrap,
  };
}

export async function ensureBackgroundService(plan: BackgroundServicePlan): Promise<void> {
  if (process.getuid === undefined) throw new Error("Background service requires macOS.");
  const directory = serviceDirectory(plan.baseDir);
  const label = serviceLabel(plan.baseDir);
  const domain = `gui/${process.getuid()}`;
  const target = `${domain}/${label}`;
  const agents = NodePath.join(plan.homeDirectory, "Library", "LaunchAgents");
  const plistPath = NodePath.join(agents, `${label}.plist`);
  await NodeFSP.mkdir(directory, { recursive: true, mode: 0o700 });
  await NodeFSP.chmod(directory, 0o700);
  await NodeFSP.mkdir(agents, { recursive: true });
  const payload = JSON.stringify(backgroundServicePayload(plan));
  const plist = renderBackgroundServicePlist(plan);
  const changed =
    (await readOptional(NodePath.join(directory, "plan.json"))) !== payload ||
    (await readOptional(NodePath.join(directory, "launcher.cjs"))) !==
      BACKGROUND_SERVICE_LAUNCHER ||
    (await readOptional(plistPath)) !== plist;
  const launchctl = (args: string[]) =>
    execute("/bin/launchctl", args, { timeout: 100_000, maxBuffer: 1024 * 1024 });
  const loaded = await launchctl(["print", target]).then(
    () => true,
    () => false,
  );
  // Stop only this install's job, and only when its configuration changed.
  if (loaded && changed) await launchctl(["bootout", "--wait", target]);
  if (changed) {
    await writePrivate(NodePath.join(directory, "plan.json"), payload);
    await writePrivate(NodePath.join(directory, "launcher.cjs"), BACKGROUND_SERVICE_LAUNCHER);
    await writePrivate(plistPath, plist);
    await writePrivate(NodePath.join(directory, "port"), String(plan.bootstrap.port));
  }
  if (!loaded || changed) {
    await launchctl(["enable", target]);
    await launchctl(["bootstrap", domain, plistPath]);
  }
}
