/**
 * Polaris (V 4.7.0): the private update feed on Star's VPS. Every request
 * carries the user's invite code in `POLARIS_INVITE_HEADER`; without a valid
 * code the server answers 401 and reveals nothing. Deploy notes:
 * `infra/polaris-server/README.md`.
 */
export const POLARIS_UPDATE_FEED_URL = "https://polaris.sstarvfx.com/updates/";
export const POLARIS_INVITE_HEADER = "X-Polaris-Invite";

/** Invite codes are short and plain; anything else is a typo or a paste accident. */
export const POLARIS_INVITE_CODE_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function normalizeInviteCode(raw: string): string {
  return raw.trim();
}

function parseVersion(version: string): readonly [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when `candidate` is a higher MAJOR.MINOR.PATCH than `current`. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate);
  const now = parseVersion(current);
  if (next === null || now === null) return false;
  for (let index = 0; index < 3; index += 1) {
    const a = next[index] ?? 0;
    const b = now[index] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

export interface PolarisReleaseFile {
  readonly url: string;
  readonly sha512: string | null;
  readonly size: number | null;
}

export interface PolarisReleaseManifest {
  readonly version: string;
  readonly files: readonly PolarisReleaseFile[];
}

const unquote = (value: string): string => value.trim().replace(/^(['"])(.*)\1$/, "$2");

/**
 * Reads the parts of an electron-builder `latest*.yml` that Polaris needs:
 * the version and each file's url, sha512 and size. The format is fixed by
 * electron-builder (flat keys plus a `files:` list), so a small line reader
 * is enough; anything unexpected yields null rather than a guess.
 */
export function parseReleaseManifest(text: string): PolarisReleaseManifest | null {
  let version: string | null = null;
  const files: { url: string; sha512: string | null; size: number | null }[] = [];
  let inFiles = false;
  for (const rawLine of text.split(/\r?\n/)) {
    if (rawLine.trim() === "" || rawLine.trimStart().startsWith("#")) continue;
    const topLevel = !/^\s/.test(rawLine);
    if (topLevel) {
      inFiles = false;
      const match = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(rawLine);
      if (!match) continue;
      const key = match[1];
      const value = match[2] ?? "";
      if (key === "version") version = unquote(value);
      if (key === "files") inFiles = true;
      continue;
    }
    if (!inFiles) continue;
    const item = /^\s*-\s+url:\s*(.+)$/.exec(rawLine);
    if (item?.[1]) {
      files.push({ url: unquote(item[1]), sha512: null, size: null });
      continue;
    }
    const field = /^\s+(sha512|size):\s*(.+)$/.exec(rawLine);
    const last = files.at(-1);
    if (field && last) {
      if (field[1] === "sha512") last.sha512 = unquote(field[2] ?? "");
      if (field[1] === "size") {
        const size = Number(unquote(field[2] ?? ""));
        last.size = Number.isFinite(size) ? size : null;
      }
    }
  }
  if (version === null || parseVersion(version) === null) return null;
  return { version, files };
}

/** The file to hand a Mac user: the dmg (they drag it into Applications). */
export function pickMacInstaller(manifest: PolarisReleaseManifest): PolarisReleaseFile | null {
  return manifest.files.find((file) => file.url.toLowerCase().endsWith(".dmg")) ?? null;
}

/**
 * A file name from the feed, safe to write into Downloads: no directories,
 * no leading dots, only the characters electron-builder uses.
 */
export function safeInstallerFileName(url: string): string | null {
  const name = decodeURIComponent(url.split(/[?#]/)[0]?.split("/").pop() ?? "");
  return /^[A-Za-z0-9][A-Za-z0-9._ ()-]*\.dmg$/.test(name) ? name : null;
}
