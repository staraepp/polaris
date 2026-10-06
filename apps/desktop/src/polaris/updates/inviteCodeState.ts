/**
 * The invite code the update requests carry (Polaris, V 4.7.0), in memory.
 * `PolarisUpdateInvite` loads it from `safeStorage` at startup and keeps it
 * current; `ElectronUpdater` reads it right before each request. A plain
 * module value because the updater layer is built before any service.
 */
let inviteCode: string | null = null;

export function currentInviteCode(): string | null {
  return inviteCode;
}

export function setCurrentInviteCode(code: string | null): void {
  inviteCode = code === null || code.length === 0 ? null : code;
}

/** Shown when an update check runs before the user entered a code. */
export const MISSING_INVITE_CODE_MESSAGE =
  "Add your Polaris invite code in Settings → General → Updates to get updates.";
