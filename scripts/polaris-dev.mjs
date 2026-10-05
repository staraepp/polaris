#!/usr/bin/env node
// Polaris: boot or stop an isolated dev stack. Never touches ~/.t3 or a server on port 3773.
//   node scripts/polaris-dev.mjs start      -> temp home dir, own process group, prints JSON
//   node scripts/polaris-dev.mjs stop <pgid> -> stops only a stack this script started
// The browser pairs once: a fixed dev token (gitignored, under .polaris/) gives the server the
// same reusable session every run, so the localhost cookie from the first pairing keeps working.
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const REAL_SERVER_PORT = 3773;
const repoRoot = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const tempPrefix = NodePath.join(NodeOS.tmpdir(), "polaris-dev-");
const stateFile = (pgid) => NodePath.join(NodeOS.tmpdir(), `polaris-dev-state-${pgid}.json`);
const devTokenFile = NodePath.join(repoRoot, ".polaris", "dev-auth-token");

function fail(message) {
  console.error(`polaris-dev: ${message}`);
  process.exit(1);
}

function listeners(port) {
  const result = NodeChildProcess.spawnSync(
    "lsof",
    ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"],
    {
      encoding: "utf8",
    },
  );
  return result.stdout.split("\n").filter(Boolean).map(Number);
}

function processGroupOf(pid) {
  const result = NodeChildProcess.spawnSync("ps", ["-o", "pgid=", "-p", String(pid)], {
    encoding: "utf8",
  });
  return Number(result.stdout.trim());
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function devAuthToken() {
  const fromEnv = process.env.T3CODE_DEV_AUTH_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  if (NodeFS.existsSync(devTokenFile)) {
    const saved = NodeFS.readFileSync(devTokenFile, "utf8").trim();
    if (saved.length >= 32) return saved;
  }
  const token = NodeCrypto.randomBytes(32).toString("hex");
  NodeFS.mkdirSync(NodePath.dirname(devTokenFile), { recursive: true });
  NodeFS.writeFileSync(devTokenFile, `${token}\n`, { mode: 0o600 });
  return token;
}

async function start() {
  const homeDir = NodeFS.mkdtempSync(tempPrefix);
  const logPath = NodePath.join(homeDir, "dev.log");
  const log = NodeFS.openSync(logPath, "a");
  const vp = NodePath.join(repoRoot, "node_modules", ".bin", "vp");
  if (!NodeFS.existsSync(vp)) fail("run `pnpm install` first (node_modules/.bin/vp is missing)");
  const nodeBin = NodePath.dirname(process.execPath);
  const child = NodeChildProcess.spawn(vp, ["run", "dev", "--home-dir", homeDir], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", log, log],
    env: {
      ...process.env,
      PATH: `${nodeBin}:${NodePath.join(repoRoot, "node_modules", ".bin")}:${process.env.PATH ?? ""}`,
      T3CODE_DEV_AUTH_TOKEN: devAuthToken(),
    },
  });
  child.unref();
  const pgid = child.pid;
  if (pgid === undefined) fail("could not start the dev stack");
  NodeFS.writeFileSync(stateFile(pgid), JSON.stringify({ pgid, homeDir }));

  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const text = NodeFS.readFileSync(logPath, "utf8");
    const ports = /serverPort=(\d+) webPort=(\d+)/.exec(text);
    if (ports && Number(ports[1]) === REAL_SERVER_PORT) {
      process.kill(-pgid, "SIGTERM");
      fail(`refusing to run on ${REAL_SERVER_PORT}: that port belongs to a real server`);
    }
    const pairing = /pairingUrl:\s*(\S+)/.exec(text);
    if (ports && pairing) {
      console.log(
        JSON.stringify(
          {
            pgid,
            homeDir,
            serverPort: Number(ports[1]),
            webPort: Number(ports[2]),
            pairingUrl: pairing[1],
            pairOnce: "open pairingUrl once per browser; the cookie it sets lasts 30 days",
            log: logPath,
            stop: `node scripts/polaris-dev.mjs stop ${pgid}`,
          },
          null,
          2,
        ),
      );
      return;
    }
    await sleep(1000);
  }
  process.kill(-pgid, "SIGTERM");
  fail(`no pairing URL after 180 s; see ${logPath}`);
}

async function stop(pgidArg) {
  const pgid = Number(pgidArg);
  if (!Number.isInteger(pgid) || pgid <= 1) fail("usage: stop <pgid>");
  if (!NodeFS.existsSync(stateFile(pgid))) {
    fail(`pgid ${pgid} was not started by this script; not touching it`);
  }
  const state = JSON.parse(NodeFS.readFileSync(stateFile(pgid), "utf8"));
  const foreign = [13773, 5733]
    .flatMap(listeners)
    .filter((pid) => processGroupOf(pid) !== pgid && processGroupOf(pid) !== 0);
  if (foreign.length > 0) {
    console.error(
      `note: pids ${foreign.join(", ")} listen on dev ports in another group; left alone`,
    );
  }
  try {
    process.kill(-pgid, "SIGTERM");
  } catch {
    // already gone
  }
  await sleep(4000);
  const left = NodeChildProcess.spawnSync("ps", ["-g", String(pgid), "-o", "pid="], {
    encoding: "utf8",
  }).stdout.trim();
  if (left) {
    process.kill(-pgid, "SIGKILL");
    await sleep(1000);
  }
  if (typeof state.homeDir === "string" && state.homeDir.startsWith(tempPrefix)) {
    NodeFS.rmSync(state.homeDir, { recursive: true, force: true });
  }
  NodeFS.rmSync(stateFile(pgid), { force: true });
  console.log(`stopped process group ${pgid} and removed ${state.homeDir}`);
}

const [command, argument] = process.argv.slice(2);
if (command === "start") await start();
else if (command === "stop") await stop(argument);
else fail("usage: start | stop <pgid>");
