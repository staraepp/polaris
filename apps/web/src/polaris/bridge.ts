import type { PolarisBridge } from "@t3tools/shared/polarisBridge";

declare global {
  interface Window {
    polarisBridge?: PolarisBridge;
  }
}

/** The Polaris desktop bridge, or undefined in a browser or on an older desktop build. */
export function getPolarisBridge(): PolarisBridge | undefined {
  return typeof window === "undefined" ? undefined : window.polarisBridge;
}
