#!/usr/bin/env node
// Polaris (V 4.7.0): publish a built release to the private update feed.
//
//   node scripts/polaris-publish-update.mjs            # the version in apps/desktop/package.json
//   node scripts/polaris-publish-update.mjs 4.7.0      # a specific version
//   node scripts/polaris-publish-update.mjs --dry-run  # list what would be uploaded
//
// Copies the installers from release/ to the VPS (ssh host `hostinger-vps`, or
// POLARIS_UPDATE_HOST) under /opt/polaris/updates/. Installers go first and the
// latest*.yml lists last, so a client never sees a version whose files are not
// there yet. Keeps the three newest versions of each installer. Needs only ssh
// and scp; never touches anything else on the server.
import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const repoRoot = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const releaseDir = NodePath.join(repoRoot, "release");
const host = process.env.POLARIS_UPDATE_HOST || "hostinger-vps";
const remoteDir = "/opt/polaris/updates";
const keepVersions = 3;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const desktopPackage = JSON.parse(
  NodeFS.readFileSync(NodePath.join(repoRoot, "apps/desktop/package.json"), "utf8"),
);
const version = args.find((arg) => !arg.startsWith("--")) ?? desktopPackage.version;

function fail(message) {
  console.error(`polaris-publish-update: ${message}`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`"${version}" is not a MAJOR.MINOR.PATCH version.`);

function readManifestVersion(file) {
  const match = /^version:\s*['"]?([^'"\s]+)/m.exec(NodeFS.readFileSync(file, "utf8"));
  return match?.[1] ?? null;
}

// Each platform publishes only if its build for this version is present.
const platforms = [
  {
    name: "macOS",
    manifest: "latest-mac.yml",
    files: [`Polaris-${version}-arm64.dmg`, `Polaris-${version}-arm64.dmg.blockmap`],
  },
  {
    name: "Windows",
    manifest: "latest.yml",
    files: [`Polaris-${version}-x64.exe`, `Polaris-${version}-x64.exe.blockmap`],
  },
];

const uploads = [];
const manifests = [];
for (const platform of platforms) {
  const manifestPath = NodePath.join(releaseDir, platform.manifest);
  const installers = platform.files.map((file) => NodePath.join(releaseDir, file));
  if (!installers.every((file) => NodeFS.existsSync(file))) {
    console.log(`skip ${platform.name}: no ${version} build in release/`);
    continue;
  }
  if (!NodeFS.existsSync(manifestPath) || readManifestVersion(manifestPath) !== version) {
    fail(`${platform.manifest} is missing or not for ${version}; rebuild ${platform.name}.`);
  }
  uploads.push(...installers);
  manifests.push(manifestPath);
  console.log(`${platform.name}: ${platform.files.join(", ")} + ${platform.manifest}`);
}
if (uploads.length === 0) fail(`nothing to publish for ${version}.`);

function run(command, commandArgs) {
  if (dryRun) {
    console.log(`[dry run] ${command} ${commandArgs.join(" ")}`);
    return;
  }
  const result = NodeChildProcess.spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) fail(`${command} failed (exit ${result.status}).`);
}

run("scp", ["-q", ...uploads, `${host}:${remoteDir}/`]);
// Each list lands under a temporary name, then moves into place in one step.
for (const manifest of manifests) {
  const name = NodePath.basename(manifest);
  run("scp", ["-q", manifest, `${host}:${remoteDir}/.${name}.tmp`]);
  run("ssh", [host, `mv ${remoteDir}/.${name}.tmp ${remoteDir}/${name}`]);
}
// Prune: keep the newest versions of each installer kind.
const prune = ["arm64.dmg", "x64.exe"]
  .map(
    (suffix) =>
      `ls -1 ${remoteDir}/Polaris-*-${suffix} 2>/dev/null | sort -V | head -n -${keepVersions} | while read f; do rm -f "$f" "$f.blockmap"; done`,
  )
  .join("; ");
run("ssh", [host, prune]);
console.log(dryRun ? "dry run done" : `published ${version}`);
