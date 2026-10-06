import { useEffect, useState } from "react";

/**
 * A number that changes whenever the theme might have (Polaris): the root's
 * class, theme id or inline style. Effects that read resolved token colors
 * depend on it to re-read them.
 */
export function useThemeEpoch(): number {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    const observer = new MutationObserver(() => setEpoch((value) => value + 1));
    try {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class", "data-theme-id", "style"],
      });
    } catch {
      // A stubbed document (some test renderers) has no real root to watch.
      return;
    }
    return () => observer.disconnect();
  }, []);
  return epoch;
}
