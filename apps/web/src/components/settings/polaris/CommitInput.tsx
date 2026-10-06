import { useState } from "react";

import { Input } from "../../ui/input";

/** A text field that saves on blur or Enter, so typing doesn't write settings per key. */
export function CommitInput({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
  readonly value: string;
  readonly onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // A saved value from elsewhere replaces the draft (adjusting state while rendering).
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <Input
      size="sm"
      autoCapitalize="off"
      autoComplete="off"
      spellCheck={false}
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}
