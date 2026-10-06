import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  document.addEventListener("visibilitychange", onChange);
  window.addEventListener("focus", onChange);
  window.addEventListener("blur", onChange);
  return () => {
    document.removeEventListener("visibilitychange", onChange);
    window.removeEventListener("focus", onChange);
    window.removeEventListener("blur", onChange);
  };
}

function read(): boolean {
  return (
    typeof document !== "undefined" &&
    document.visibilityState === "visible" &&
    typeof document.hasFocus === "function" &&
    document.hasFocus()
  );
}

/** Whether the window is visible and focused: decoration may animate. */
export function useWindowActive(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}
