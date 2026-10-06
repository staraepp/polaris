import { POLARIS_INVITE_CODE_PATTERN } from "@t3tools/shared/polarisUpdateFeed";
import { ArrowRightIcon } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";

import { getPolarisBridge } from "../bridge";
import { usernameProblem } from "./username";

/** First onboarding step (Polaris): the name friends see in shared spaces. */
export function YouStep({ onContinue }: { readonly onContinue: () => void }) {
  const saved = useClientSettings((settings) => settings.collabUsername);
  const updateSettings = useUpdateClientSettings();
  const [value, setValue] = useState(saved);
  const [touched, setTouched] = useState(false);
  const inputId = useId();
  const hintId = useId();
  const problem = usernameProblem(value);
  const showProblem = touched && problem !== null;
  // The desktop app asks for the update invite code here too (V 4.7.0), once.
  const updates = getPolarisBridge()?.updates;
  const [askInvite, setAskInvite] = useState(false);
  const [invite, setInvite] = useState("");
  const inviteId = useId();
  const inviteHintId = useId();
  const inviteProblem =
    invite.trim().length > 0 && !POLARIS_INVITE_CODE_PATTERN.test(invite.trim())
      ? "That doesn't look like an invite code. Check for missing letters or spaces."
      : null;
  const showInviteProblem = touched && inviteProblem !== null;
  useEffect(() => {
    void updates?.getInvite().then((state) => setAskInvite(!state.hasCode));
  }, [updates]);

  const submit = () => {
    setTouched(true);
    if (problem !== null || inviteProblem !== null) return;
    void updateSettings({ collabUsername: value.trim() });
    if (askInvite && updates !== undefined && invite.trim().length > 0) {
      void updates.setInvite(invite.trim());
    }
    onContinue();
  };

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-tight text-balance">Welcome to Polaris</h2>
        <p className="max-w-prose text-sm text-muted-foreground">
          Your agents, threads and workspace in one place. First, what should your friends call you?
          Your username shows up next to your cursor on whiteboards, in docs and in chat.
        </p>
      </div>
      <div className="flex max-w-sm flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          Username
        </label>
        <Input
          id={inputId}
          nativeInput
          size="lg"
          autoFocus
          autoComplete="username"
          spellCheck={false}
          placeholder="star"
          value={value}
          maxLength={32}
          aria-invalid={showProblem || undefined}
          aria-describedby={hintId}
          onChange={(event) => setValue(event.currentTarget.value)}
          onBlur={() => setTouched(true)}
        />
        <p
          id={hintId}
          className={showProblem ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {showProblem ? problem : "2 to 24 letters, numbers, dots, dashes or underscores."}
        </p>
      </div>
      {askInvite ? (
        <div className="flex max-w-sm flex-col gap-2">
          <label htmlFor={inviteId} className="text-sm font-medium">
            Invite code <span className="font-normal text-muted-foreground">(for updates)</span>
          </label>
          <Input
            id={inviteId}
            nativeInput
            size="lg"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="polaris-xxxx-xxxx-xxxx"
            value={invite}
            aria-invalid={showInviteProblem || undefined}
            aria-describedby={inviteHintId}
            onChange={(event) => setInvite(event.currentTarget.value)}
          />
          <p
            id={inviteHintId}
            className={
              showInviteProblem ? "text-xs text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {showInviteProblem
              ? inviteProblem
              : "From the person who shared Polaris with you. You can add it later in Settings → General → Updates."}
          </p>
        </div>
      ) : null}
      <div className="flex justify-end">
        <Button type="submit">
          Continue
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  );
}
