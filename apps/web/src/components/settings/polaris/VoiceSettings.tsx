import type { VoiceSecretKind, VoiceSecretsState } from "@t3tools/shared/polarisBridge";
import { useEffect, useState } from "react";

import { useClientSettings, useUpdateClientSettings } from "../../../hooks/useSettings";
import { getPolarisBridge } from "../../../polaris/bridge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../../ui/select";
import { Switch } from "../../ui/switch";
import { SettingsRow } from "../settingsLayout";
import { searchableSetting } from "../settingsSearch";

const BACKEND_LABEL = {
  clide: "Clide (macOS app)",
  openaiCompatible: "OpenAI-compatible server",
} as const;

/** A text field that saves on blur or Enter, so typing doesn't write settings per key. */
function CommitInput({
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

function SecretField({
  kind,
  label,
  placeholder,
  secrets,
  onChange,
}: {
  readonly kind: VoiceSecretKind;
  readonly label: string;
  readonly placeholder: string;
  readonly secrets: VoiceSecretsState;
  readonly onChange: (state: VoiceSecretsState) => void;
}) {
  const [draft, setDraft] = useState("");
  const voice = getPolarisBridge()?.voice;
  const stored = secrets[kind];
  if (voice === undefined) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <Input
          size="sm"
          type="password"
          aria-label={label}
          autoComplete="off"
          className="min-w-0 flex-1"
          placeholder={stored ? "Saved (paste to replace)" : placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={draft.trim().length === 0}
          onClick={() => {
            void voice.setSecret(kind, draft).then(onChange);
            setDraft("");
          }}
        >
          Save
        </Button>
        {stored ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void voice.clearSecret(kind).then(onChange)}
          >
            Forget
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {stored
          ? secrets.persistent
            ? "Encrypted with the system keychain; Polaris never shows it again."
            : "Kept only until Polaris quits (secure storage is unavailable)."
          : "Stored by the desktop app, encrypted, never in settings files."}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="pt-1.5 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </label>
  );
}

export function VoiceSettings() {
  const enabled = useClientSettings((settings) => settings.voiceInputEnabled);
  const backend = useClientSettings((settings) => settings.voiceBackend);
  const clidePort = useClientSettings((settings) => settings.voiceClidePort);
  const baseUrl = useClientSettings((settings) => settings.voiceOpenAiBaseUrl);
  const model = useClientSettings((settings) => settings.voiceOpenAiModel);
  const language = useClientSettings((settings) => settings.voiceLanguage);
  const updateSettings = useUpdateClientSettings();
  const bridgeVoice = getPolarisBridge()?.voice;
  const [secrets, setSecrets] = useState<VoiceSecretsState>({
    clideToken: false,
    openaiCompatibleKey: false,
    persistent: false,
  });
  useEffect(() => {
    void bridgeVoice?.getSecrets().then(setSecrets);
  }, [bridgeVoice]);

  return (
    <SettingsRow
      {...searchableSetting("voice-input")}
      description="A push-to-talk button in the composer: hold to talk, release to transcribe into the prompt. Audio is kept only for that one request."
      control={
        <Switch
          checked={enabled}
          onCheckedChange={(checked) =>
            void updateSettings({ voiceInputEnabled: Boolean(checked) })
          }
          aria-label="Voice input"
        />
      }
    >
      {enabled ? (
        <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-background/40 p-3">
          <Field label="Transcribe with">
            <Select
              value={backend}
              onValueChange={(value) => {
                if (value === "clide" || value === "openaiCompatible") {
                  void updateSettings({ voiceBackend: value });
                }
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-full sm:w-64"
                aria-label="Transcription backend"
              >
                <SelectValue>{BACKEND_LABEL[backend]}</SelectValue>
              </SelectTrigger>
              <SelectPopup align="start" alignItemWithTrigger={false}>
                <SelectItem hideIndicator value="clide">
                  {BACKEND_LABEL.clide}
                </SelectItem>
                <SelectItem hideIndicator value="openaiCompatible">
                  {BACKEND_LABEL.openaiCompatible}
                </SelectItem>
              </SelectPopup>
            </Select>
          </Field>

          {backend === "clide" ? (
            bridgeVoice === undefined ? (
              <p className="text-xs text-muted-foreground">
                Clide is reached from the Polaris desktop app only. In a browser, use an
                OpenAI-compatible server instead.
              </p>
            ) : (
              <>
                <Field label="Local API port">
                  <CommitInput
                    type="number"
                    min={1}
                    max={65535}
                    aria-label="Clide Local API port"
                    className="w-full sm:w-32"
                    placeholder="From Clide"
                    value={clidePort === 0 ? "" : String(clidePort)}
                    onCommit={(next) => {
                      const port = Number(next);
                      void updateSettings({
                        voiceClidePort:
                          Number.isInteger(port) && port > 0 && port <= 65535 ? port : 0,
                      });
                    }}
                  />
                </Field>
                <Field label="Token">
                  <SecretField
                    kind="clideToken"
                    label="Clide Local API token"
                    placeholder="clide_…"
                    secrets={secrets}
                    onChange={setSecrets}
                  />
                </Field>
                <p className="text-xs text-muted-foreground">
                  Turn on Settings → Developer → Local API in Clide. Polaris talks to it on
                  127.0.0.1 only, and glows while Clide's own dictation listens.
                </p>
              </>
            )
          ) : (
            <>
              <Field label="Server URL">
                <CommitInput
                  type="url"
                  aria-label="Transcription server URL"
                  placeholder="http://localhost:8080/v1"
                  value={baseUrl}
                  onCommit={(next) => void updateSettings({ voiceOpenAiBaseUrl: next.trim() })}
                />
              </Field>
              <Field label="Model">
                <CommitInput
                  aria-label="Transcription model"
                  className="w-full sm:w-48"
                  placeholder="whisper-1"
                  value={model}
                  onCommit={(next) => void updateSettings({ voiceOpenAiModel: next.trim() })}
                />
              </Field>
              {bridgeVoice !== undefined ? (
                <Field label="API key">
                  <SecretField
                    kind="openaiCompatibleKey"
                    label="Transcription server API key"
                    placeholder="Optional"
                    secrets={secrets}
                    onChange={setSecrets}
                  />
                </Field>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Your recording is sent to this server. A local one (for example whisper.cpp) keeps
                it on your machine.
              </p>
            </>
          )}

          <Field label="Language">
            <CommitInput
              aria-label="Transcription language"
              className="w-full sm:w-32"
              placeholder="Detect"
              value={language}
              onCommit={(next) => void updateSettings({ voiceLanguage: next.trim() })}
            />
          </Field>
        </div>
      ) : null}
    </SettingsRow>
  );
}
