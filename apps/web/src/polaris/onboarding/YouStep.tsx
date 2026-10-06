import { ArrowRightIcon } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";

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

  const submit = () => {
    setTouched(true);
    if (problem !== null) return;
    void updateSettings({ collabUsername: value.trim() });
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
      <div className="flex justify-end">
        <Button type="submit">
          Continue
          <ArrowRightIcon />
        </Button>
      </div>
    </form>
  );
}
