import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type SaveStatus = "saved" | "pending" | "saving" | "error";

export const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  saved: "Saved on this device",
  pending: "Editing…",
  saving: "Saving…",
  error: "Not saved. Keep this page open and try again.",
};

/**
 * Debounced saving for the Workspace editors. `schedule` takes a function
 * that reads the latest content, so nothing is serialized per keystroke.
 * Saves run one at a time, in order. Leaving the page, hiding the window or
 * unmounting the editor flushes what is pending at once.
 */
export function useAutosave<T>(save: (value: T) => Promise<unknown>, delayMs: number) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const saveRef = useRef(save);
  useLayoutEffect(() => {
    saveRef.current = save;
  });
  const pending = useRef<(() => T) | null>(null);
  const timer = useRef<number | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());

  const flush = useCallback((): Promise<void> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const read = pending.current;
    if (read === null) return queue.current;
    pending.current = null;
    const value = read();
    setStatus("saving");
    queue.current = queue.current
      .then(() => saveRef.current(value))
      .then(
        () => {
          if (pending.current === null) setStatus("saved");
        },
        () => setStatus("error"),
      );
    return queue.current;
  }, []);

  const schedule = useCallback(
    (read: () => T) => {
      pending.current = read;
      setStatus("pending");
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  useEffect(() => {
    const flushNow = () => void flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    window.addEventListener("pagehide", flushNow);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushNow);
      document.removeEventListener("visibilitychange", onVisibility);
      flushNow();
    };
  }, [flush]);

  return { status, schedule, flush };
}
