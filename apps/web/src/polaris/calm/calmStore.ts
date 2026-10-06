/**
 * Polaris (V 5.1.0): whether Calm mode is on, outside React. The client
 * setting `calmMode` is the source of truth (`CalmModeSync` copies it here);
 * this copy, mirrored in localStorage, lets the theme module paint the Calm
 * palette on the very first frame, before settings have loaded.
 */
const STORAGE_KEY = "polaris:calm:v1";

function readStored(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let active = readStored();
const listeners = new Set<() => void>();

export const isCalmActive = (): boolean => active;

export function setCalmActive(next: boolean): void {
  if (next === active) return;
  active = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked; only the first frame of the next launch differs.
  }
  for (const listener of listeners) listener();
}

export function subscribeCalm(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
