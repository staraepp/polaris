import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "~/lib/utils";

/** Saves this long after the last keystroke, and always on blur. */
const SAVE_AFTER_MS = 600;
/** How long the quiet "Saved" mark stays after a save. */
const SAVED_MARK_MS = 1600;

/**
 * A note on the dashboard (Polaris): plain text kept on this device with the
 * layout. Typing saves on its own shortly after you stop, and on leaving the
 * field; Esc leaves it without leaving the page.
 */
export function NoteWidgetBody({
  title,
  text,
  onChange,
}: {
  readonly title: string;
  readonly text: string;
  readonly onChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState(text);
  const [showSaved, setShowSaved] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const savedTimer = useRef<number | null>(null);
  const latest = useRef({ draft, text, onChange });
  useLayoutEffect(() => {
    latest.current = { draft, text, onChange };
  });

  const flush = () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const { draft: current, text: saved, onChange: save } = latest.current;
    if (current === saved) return;
    save(current);
    setShowSaved(true);
    if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setShowSaved(false), SAVED_MARK_MS);
  };

  // A pending save still lands if the widget goes away mid-typing.
  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      if (savedTimer.current !== null) window.clearTimeout(savedTimer.current);
      const { draft: current, text: saved, onChange: save } = latest.current;
      if (current !== saved) save(current);
    },
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <textarea
        value={draft}
        aria-label={`${title} text`}
        placeholder="Write anything: a plan, a reminder, a command you keep retyping…"
        onChange={(event) => {
          setDraft(event.target.value);
          if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
          saveTimer.current = window.setTimeout(flush, SAVE_AFTER_MS);
        }}
        onBlur={flush}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.preventDefault();
          event.currentTarget.blur();
        }}
        className="min-h-28 w-full flex-1 resize-none rounded-lg bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      />
      {/* Saving is automatic and cannot be missed, so the mark is for the
          eye only; announcing every pause in typing would be noise. */}
      <span
        aria-hidden="true"
        className={cn(
          "h-3 self-end text-2xs leading-3 text-muted-foreground transition-opacity duration-300 motion-reduce:transition-none",
          showSaved ? "opacity-100" : "opacity-0",
        )}
      >
        Saved
      </span>
    </div>
  );
}
