import { useState } from "react";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { usernameProblem } from "../../../polaris/onboarding/username";
import { Input } from "../../ui/input";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

/** Polaris: the username friends see in shared whiteboards, docs and chat. */
export function UsernameSetting() {
  const saved = useClientSettings((settings) => settings.collabUsername);
  const updateSettings = useUpdateClientSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? saved;
  const problem = draft === null ? null : usernameProblem(draft);

  const commit = () => {
    if (draft === null) return;
    if (usernameProblem(draft) === null && draft.trim() !== saved) {
      void updateSettings({ collabUsername: draft.trim() });
    }
    if (usernameProblem(draft) === null) setDraft(null);
  };

  return (
    <SettingsRow
      {...searchableSetting("collab-username")}
      description={
        problem ?? "Shown to friends next to your cursor on whiteboards, in docs and in chat."
      }
      control={
        <Input
          nativeInput
          size="sm"
          className="w-40"
          aria-label="Username"
          aria-invalid={problem !== null || undefined}
          autoComplete="username"
          spellCheck={false}
          placeholder="Pick a username"
          maxLength={32}
          value={value}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
            if (event.key === "Escape") setDraft(null);
          }}
        />
      }
    />
  );
}
