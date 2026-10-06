import type { UpdateInviteState } from "@t3tools/shared/polarisBridge";
import { POLARIS_INVITE_CODE_PATTERN } from "@t3tools/shared/polarisUpdateFeed";
import { useEffect, useState } from "react";

import { getPolarisBridge } from "../../../polaris/bridge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

/**
 * Settings → About → Updates (Polaris, V 4.7.0): the invite code for the
 * private update feed. Desktop only; the code goes to the main process, which
 * encrypts it and never hands it back.
 */
export function UpdateInviteSetting() {
  const updates = getPolarisBridge()?.updates;
  const [state, setState] = useState<UpdateInviteState | null>(null);
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    void updates?.getInvite().then(setState);
  }, [updates]);

  if (updates === undefined) return null;
  const saved = state?.hasCode === true;

  const save = () => {
    const code = draft.trim();
    if (!POLARIS_INVITE_CODE_PATTERN.test(code)) {
      setProblem("That doesn't look like an invite code. Check for missing letters or spaces.");
      return;
    }
    setProblem(null);
    void updates.setInvite(code).then((next) => {
      setState(next);
      if (next.hasCode) setDraft("");
    });
  };

  return (
    <SettingsRow
      {...searchableSetting("update-invite")}
      description="Polaris updates come from a private server. Enter the invite code you were given; without it, Polaris cannot check for or download updates."
      status={
        saved ? (
          <span className="text-xs text-success-foreground">Invite code saved</span>
        ) : (
          <span className="text-xs text-muted-foreground">No invite code yet</span>
        )
      }
    >
      <div className="mt-3 flex flex-col gap-1.5">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input
            size="sm"
            type="password"
            aria-label="Invite code"
            aria-invalid={problem !== null}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1"
            placeholder={
              saved ? "Saved (paste a new code to replace it)" : "polaris-xxxx-xxxx-xxxx"
            }
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setProblem(null);
            }}
          />
          <Button size="sm" variant="outline" type="submit" disabled={draft.trim().length === 0}>
            Save
          </Button>
          {saved ? (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={() => void updates.setInvite("").then(setState)}
            >
              Remove
            </Button>
          ) : null}
        </form>
        <p
          className={
            problem === null ? "text-xs text-muted-foreground" : "text-xs text-destructive"
          }
          role={problem === null ? undefined : "alert"}
        >
          {problem ??
            (saved
              ? state?.persistent
                ? "Encrypted with the system keychain; Polaris never shows it again. Updates are checked automatically."
                : "Kept only until Polaris quits (secure storage is unavailable)."
              : "Ask the person who shared Polaris with you for the code.")}
        </p>
      </div>
    </SettingsRow>
  );
}
