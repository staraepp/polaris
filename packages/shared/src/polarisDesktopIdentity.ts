/**
 * Who the Polaris desktop app is to the operating system (approved by Star,
 * 2026-10-06). Upstream's T3 Code uses `com.t3tools.t3code`, the `t3code://`
 * scheme, the `t3code-v2` Electron profile and `~/.t3`; Polaris uses its own
 * of each, so both apps can be installed side by side without sharing data,
 * the single-instance lock or deep links.
 *
 * Linux-only names (window class, `.desktop` entry, executable) are still
 * upstream's: they must change together with Linux packaging, which Polaris
 * does not build yet.
 */

/** macOS bundle id and Windows AppUserModelID. */
export const POLARIS_DESKTOP_APP_ID = "app.polaris.desktop";
export const POLARIS_DESKTOP_DEV_APP_ID = "app.polaris.desktop.dev";

/** URL schemes the packaged and development apps serve the renderer from and receive links on. */
export const POLARIS_DESKTOP_SCHEME = "polaris";
export const POLARIS_DESKTOP_DEV_SCHEME = "polaris-dev";
export const POLARIS_DESKTOP_SCHEMES = [
  POLARIS_DESKTOP_SCHEME,
  POLARIS_DESKTOP_DEV_SCHEME,
] as const;

export function polarisDesktopScheme(isDevelopment: boolean): string {
  return isDevelopment ? POLARIS_DESKTOP_DEV_SCHEME : POLARIS_DESKTOP_SCHEME;
}

/** Upstream's schemes, accepted only where that is harmless (the server's allowed origins). */
export const UPSTREAM_DESKTOP_SCHEMES = ["t3code", "t3code-dev"] as const;

/** Electron profile folder names under the OS app-data directory. */
export const POLARIS_DESKTOP_PROFILE = "polaris";
export const POLARIS_DESKTOP_DEV_PROFILE = "polaris-dev";

/** Server state folder in the home directory when `T3CODE_HOME` is not set. */
export const POLARIS_HOME_DIR_NAME = ".polaris";
