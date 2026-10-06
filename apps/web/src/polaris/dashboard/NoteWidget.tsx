import { useEffect, useLayoutEffect, useRef, useState } from "react";

/** Saves this long after the last keystroke, and always on blur. */
const SAVE_AFTER_MS = 600;

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
  const saveTimer = useRef<number | null>(null);
  const latest = useRef({ draft, text, onChange });
  useLayoutEffect(() => {
    latest.current = { draft, text, onChange };
  });

  const flush = () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const { draft: current, text: saved, onChange: save } = latest.current;
    if (current !== saved) save(current);
  };

  // A pending save still lands if the widget goes away mid-typing.
  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      const { draft: current, text: saved, onChange: save } = latest.current;
      if (current !== saved) save(current);
    },
    [],
  );

  return (
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
  );
}
