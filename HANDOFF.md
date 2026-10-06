# HANDOFF.md — Polaris

Read this at the start of every session. Update it at the end of every session. Newest entry on top. Keep only the last 5 entries; summarize older ones into "History" in two lines.

## How to write an entry

Copy the template below. Every field is required. "None" is a valid answer; a blank is not.

```
### YYYY-MM-DD — <agent / tool> — <one-line goal>
- Status: done | partial | blocked
- What changed: <files and behavior, short>
- How verified: <exact commands run and results>
- Risks: <what could be wrong, what was not tested>
- Next action: <the single next step, concrete enough to start without asking>
- Open questions: <decisions the human must make>
```

## Current state

- Fork created: 2026-10-05 from `pingdotgg/t3code` `main` at `3e6b45028ceec5820dacb37dc3852470ebdc9411`. Remote `upstream-snapshot` is reference-only. There is no `origin` and nothing has been pushed.
- v1 progress (`blueprint.md` "v1 scope"): item 1 (agent-friendly repo) done. Item 2 (Discord Rich Presence) built in session 7 and inert until an Application ID is set. Item 3 (usage graph) has its first slice (activity heatmap, streaks, month projection); tool-call and per-thread views wait on a contract change. Also built in session 7: the quota-low signal and the composer FX slot (beam, flash, accent), which `blueprint.md` had filed under v2 but the human asked for with explicit defaults.
- CI: `.github/workflows/ci.yml` (Polaris, verified commands only, Node from `.nvmrc`). Never executed on GitHub yet.
- Cursor: `.cursor/rules/cursor-cloud.mdc` is a five-line pointer to `AGENTS.md`. Upstream's original notes are `docs/upstream-cursor-cloud.md` (reference only, not instructions). The Cursor provider is untouched and stays (decided in session 5). An existing per-provider "Enable" switch hides a provider from the picker; see "Hiding a provider" below.
- Fonts: upstream's existing customization is the v1 baseline (decided in session 5, nothing to build) and was checked in the running app; see "Fonts page" below. Per-theme fonts are v2, mobile is out of v1, and any bundled typeface must be OFL or Apache-style licensed.
- Known failing (pre-existing, not fixed): `scripts/build-desktop-artifact.test.ts` > `build-desktop-artifact` > `skips the primary native probe for cross-architecture Windows payloads`. Fails identically on the pristine snapshot. Not in CI. Details in `AGENTS.md`.
- Node: `.nvmrc` is `24.13.1` (the lower bound of `engines.node`); change both together.
- Rebrand (session 6): the user-facing name is **Polaris** and the accent is emerald green (tokens in `apps/web/src/index.css`). Internal identifiers are still upstream's on purpose; see the session 6 entry for the list. The logo is a placeholder (a "P" with a north star in its counter); the same entry lists every file to swap for final art.
- Test status on this Mac (session 8, V 4.1.1 gate): contracts 531, shared 1,112, client-runtime 1,998, desktop 1,414 (+44 skipped), web 5,968, scripts 341 (+ the 1 known failure); server 8 failed / 6,430 passed / 21 skipped, exactly the 8 known. v3 gate: contracts 527, shared 1,112, client-runtime 1,998, desktop 1,414 (+44 skipped), web 5,928, scripts 337 (+ the 1 known failure); server 8 failed / 6,430 passed / 21 skipped, exactly the 8 known. (v2 gate: web 5,920, the rest the same.) v1 gate: contracts 520, shared 1,107, desktop 1,413, web 5,890; server 9 failed (the 8 known + 1 flaky watcher test). Session 7, final tree: contracts 510, shared 1,105, client-runtime 1,998, desktop 1,413 (+44 skipped) and web 5,871 all pass; server: 8 failed / 6,422 passed / 21 skipped, the same 8 names as the pre-rebrand baseline (symlinked temp paths, `/var` vs `/private/var`, darwin-environment checks), so no server failure is ours. Session 6 numbers for comparison: desktop 1,399 and web 5,805. The server suites have 8 failures in files the rebrand did not touch (symlinked temp paths, `/var` vs `/private/var`, and darwin-environment checks); see the session 6 entry. The scripts suite has only the known failure above.

### Effective effort: where it is resolved today

Read from source on 2026-10-05, not run. This is for the beam decision "follow the level sent with the turn" (`blueprint.md`, Decisions).

- **Claude:** `compileClaudeModelSelection` in `apps/server/src/claudeModelOptions.ts:28`. Input is the turn's `modelSelection`. It reads the `effort` option, applies the catalog's `effortMap`, and returns `effort` (what the API gets), `promptEffort` (the keyword-level text prefix), `settings` (such as `ultracode`) and `queryIdentity`. Callers in `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`: `makeClaudeQueryOptions` (`:804`, compile at `:830`, `effort` handed to the SDK at `:872-876`), per turn at `:6923`, and the text prefix at `:7187-7189` and `:7396-7398`.
- **How the keyword level reaches the request:** it does not arrive as the saved option in normal flows. The web picker only edits the prompt text (`apps/web/src/components/chat/TraitsPicker.tsx:346-352`), and mobile hides it (`apps/mobile/src/features/threads/thread-settings-options.ts:56`). Typing it in the body changes only the text: T3's server does no text detection (the detector at `packages/shared/src/model.ts:302` is used only by the web composer). The turn is dispatched with `modelSelection: ctxSelectedModelSelection` (for example `apps/web/src/components/ChatView.tsx:9516`) and text from `formatOutgoingPrompt` (`:782-791`).
- **So the two can disagree:** saved level `high` plus the keyword in the body means the picker shows the keyword level, `modelSelection` says `high`, and the text carries the keyword. "Follow what is sent" needs: effective = (keyword in the final outgoing text, and the model lists it) ? keyword level : level id in the turn's selection. Nothing computes that today. Its pieces: the detector, `resolvePromptInjectedEffort` (`packages/shared/src/model.ts:495`) and `compileClaudeModelSelection`. Where to put it is settled by the session 5 decision and trace below, not by the Claude adapter.
- **Other adapters** read their own option from the turn's `modelSelection`: Codex `reasoningEffort` (`CodexAdapterV2.ts:718`), OpenCode `variant` (`OpenCodeAdapterV2.ts:3271`, `OpenCode2AdapterV2.ts:755`), Pi `thinking` (`PiAdapterV2.ts:2117`). Grok, Cursor and ACP were not traced. There is no provider-neutral function.
- **Storing it (traced in session 5; this corrects the earlier "not traced"):** `OrchestrationV2ProviderTurn` has no effort or model field (`packages/contracts/src/orchestrationV2.ts:951-970`), but the **run** does: `OrchestrationV2Run.modelSelection` (`:546`). `decideMessageDispatch` picks `requestedModelSelection ?? thread.modelSelection` (`apps/server/src/orchestration-v2/CommandPolicy.ts:397`) and the run is built with it when the message is dispatched (`Orchestrator.ts:5852` starting, `:4810` queued; `:5160` is a third construction site that was not read). Web clients receive runs (`ChatView.tsx:3561`; `MessagesTimeline.tsx:4504` reads `run.modelSelection`). `ProviderEventIngestor.ts:101` reads the raw option for analytics at turn completion; it is not a store.
- **Decided (session 4, delegated to the agent):** "sent" means the level id in the turn's selection plus the keyword-in-text override, not the API value after `effortMap`. Reasons are in `blueprint.md`, Decisions.
- **Session 5 decision and the verdict on the wiring.** You decided: resolve effective effort once at send time (the picker value for that turn plus the keyword-in-text override), store it on the turn, freeze it, and never recolor a running beam when the picker changes. I checked whether the code already does this. **It does not; half of it exists.**
  - **Exists, so the selection part is already frozen per send:** each run keeps its own `modelSelection` from creation. A picker change dispatches `thread.model-selection.set`, which updates only the thread (`Orchestrator.ts:3074`), so a queued or running run is untouched. One exception: a steering restart of the active run rebuilds it with the new send's selection and message id (`Orchestrator.ts:4141-4150`); that is a new send, so a beam following it still fits "resolve at send".
  - **Missing:** (1) the keyword override is computed nowhere on the server (the web composer's `getComposerPromptInjectionState`, `composerProviderState.tsx:62`, is live UI state only; the detector is `packages/shared/src/model.ts:302`); (2) no stored effective level exists on the run or the provider turn; (3) the tier mapping and the beam. "The turn" here means a run, not `OrchestrationV2ProviderTurn`.
  - **Where it would be resolved, as the decision is worded:** in the orchestrator where the run is built (`Orchestrator.ts:5852`, with `:4810` and `:4141` for queued and restart), from the dispatch command's `modelSelection` and `text`, using `resolvePromptInjectedEffort` (`packages/shared/src/model.ts:495`) and the detector, then stored as a new field on `OrchestrationV2Run` (`packages/contracts/src/orchestrationV2.ts:541`). That is a contract change, so it needs your go-ahead. The alternative with no contract change is to derive it when reading, from `run.modelSelection` plus the text of `run.userMessageId`; see `blueprint.md`, "Where the frozen selection lives".
  - Not exercised: this was read from source; no run was started in the app.

### Hiding a provider (the Cursor question, checked 2026-10-05, session 5)

You decided to keep the Cursor provider and asked whether an existing setting can hide or disable a provider in the picker. **Yes.** Read from source, then exercised in a dev app on an isolated home (`/tmp/...`, removed afterwards).

- **Switch per provider:** Settings → Providers shows one card per configured provider with an "Enable <name>" switch (seen for Codex and Claude). It writes `ProviderInstanceConfig.enabled` (`packages/contracts/src/providerInstance.ts:129`; UI `apps/web/src/components/settings/ProviderInstanceCard.tsx:651`). The picker rail shows enabled instances only (`apps/web/src/providerInstances.ts:105`).
- **Seen live:** with Claude and Codex enabled, the picker's provider rail listed Favorites, Codex and Claude. After switching Claude off, the rail listed Favorites and Codex only. I switched it back on and checked the switch reads on.
- **Single models:** each model has a "Show <model> in the model picker" switch, stored as `providerModelPreferences.hiddenModels` (`packages/contracts/src/settings.ts:425-433`), plus "Disable all" per provider.
- **Cursor on this machine:** no Cursor card and no Cursor entry in the picker, because the Cursor CLI is not installed (`command -v cursor-agent cursor agent` printed nothing). Why uninstalled built-in providers get no card was not traced. "Add provider" does list Cursor (with Grok, OpenCode, Antigravity, Pi and a 20-agent ACP registry). On a machine with the CLI, its card should have the same switch; that was not seen.
- **Cursor usage** reading is a separate switch, "Cursor account usage" under Settings → Providers → Usage providers (`cursorKeychainUsageEnabled`, `packages/contracts/src/settings.ts:1417`), off by default.
- **Nothing parked for v2.** The setting exists, so no code is needed.

### Fonts page (what the running app offers, checked 2026-10-05, session 5)

Checked on Node 24.13.1 with `vp run dev --home-dir /tmp/...`, in a Playwright Chromium on `http://localhost:5733/settings/appearance` (Typography section). Screenshot, outside the repo: `polaris-kickoff/.playwright-mcp/fonts-page-georgia-18.png` (it shows the Interface font set to Georgia at 18 px).

- **Advanced off (default):** an "Interface font" row (family text box with placeholder "SF Pro", size dropdown, 16 px) with a prompt preview, and a "Monospace font" row (family text box with placeholder "SF Mono", dropdown "Code font size", 13 px), described as covering code blocks, diffs, file previews and the terminal. It has live code-diff and terminal previews and a "Word wrap" switch. Whether this one row writes both the code and terminal families was not tested.
- **Advanced on:** four separate rows, "Interface font", "Prompt font" ("Only the box you write prompts in"), "Code font" and "Terminal font", each with a family text box and a size dropdown, plus a "Font smoothing" switch (on by default) and the "Word wrap" switch. That is the four families, four sizes and smoothing toggle upstream's settings describe.
- **The family control is a plain text box:** you type an installed font's name. `window.queryLocalFonts` exists in this Chromium, but the searchable installed-font picker never replaced the text box in my run (its permission flow was not exercised). No font-file or upload control exists.
- **Size dropdown:** the Interface size offered 12 to 20 px, matching the contract. The other dropdowns' ranges were not opened.
- **It works (exercised):** typing `Georgia` in the Interface font family and pressing Enter set `--font-sans` on `<html>` to `Georgia, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`, and the body and headings computed to Georgia. Choosing 18 px set the root font size to 18 px. After a reload both were still applied. Typing `Menlo` in Code font family set `--font-mono` to `Menlo, "SF Mono", ...`.
- **Where it is stored:** `localStorage["t3code:client-settings:v1"]` in the browser, with all eight values and `fontSmoothing`. So it is per browser profile, not on the server. By inference the Electron app has its own copy; that was not checked.
- **Not exercised:** the prompt, terminal and code size dropdowns, the smoothing switch, the reset icon next to "Interface font", the installed-font picker, the desktop app, mobile, and custom themes.
- **Related, same page:** a "Themes" list (T3 Code, T3 Chat, Grove, Ocean, Ember, Iris, with "Create theme" and "Add theme"). That is where per-theme fonts would belong (v2).

### Before you push (commands for you)

Nothing is pushed and there is no `origin`. I did not run any of the commands in step 2 to 4. The `upstream-snapshot` remote's push URL was a live `https://github.com/pingdotgg/t3code` URL (git copies the fetch URL by default); I changed it to a dead value (`git remote set-url --push upstream-snapshot DISABLED-upstream-snapshot-is-reference-only`). To undo: `git remote set-url --push upstream-snapshot https://github.com/pingdotgg/t3code`, which you should not want.

```sh
cd /Users/brenomenezes/Downloads/polaris-kickoff/polaris-repo

# 1. Checks. Expected results in the comments.
git remote -v                                         # one remote, upstream-snapshot; its (push) line reads DISABLED-...
ls .github/workflows                                  # ci.yml only
git status --short                                    # empty
git log --format='%an <%ae>' 3e6b450..HEAD | sort -u  # the identity that will be public (confirmed as yours)

# 2. Create an EMPTY repo on GitHub yourself: no README, license or .gitignore.
#    A private repo is the safest first push. With gh (not checked whether you are signed in):
gh repo create <you>/<name> --private                 # do NOT add --source or --push

# 3. Add the remote and push (SSH or HTTPS, whichever you use)
git remote add origin git@github.com:<you>/<name>.git
git remote -v
git push -u origin main

# 4. Watch the first CI run (it has never run on GitHub)
gh run list --limit 3
```

What the push publishes: the clone is not shallow, so it sends upstream's whole history plus ours (about 4,770 commits; `git rev-list --count HEAD` gives the exact number) and about 436 MiB packed. Upstream's workflows are inert under `.github/upstream-workflows/`, so only `ci.yml` runs.

**Commit identity: confirmed by you on 2026-10-05.** Every commit of ours since `3e6b450` is authored and committed as `5rnkq9b5yf-collab <5rnkq9b5yf@privaterelay.appleid.com>` (from `~/.gitconfig`). No rewrite is needed.

Scans done before the push: added lines since the snapshot contain no token-like strings (GitHub, Anthropic, OpenAI-style, AWS, Slack, private key blocks, bearer tokens, the dev pairing token). Files with "credentials" in the name exist only under `.repos/alchemy-effect/.../test/.../fixtures/`, vendored from upstream with 11 to 20 character placeholder strings.

### Usage panel gap list (v1 item 3)

Decision: extend upstream's Usage panel, no second panel, no code until this list is reviewed. Everything below was read from source on 2026-10-05; the page was not opened with real data.

**What owns the panel.**

- UI: route `apps/web/src/routes/usage.tsx` → `apps/web/src/components/usage/UsagePage.tsx` (1,297 lines). Chart: `UsageProviderChart.tsx`. Breakdown math: `usageBreakdown.ts`. Per-model dialog: `UsageModelDialog.tsx`. Quota windows: `UsageLimits.tsx`, `UsageLimitsPooled.tsx`. Price overrides: `UsagePriceOverrides.tsx`. Preferences (metric and window, in localStorage): `usagePagePreferences.ts`. Web state: `apps/web/src/state/usage.ts`. Shared client logic: `packages/client-runtime/src/state/usage.ts`, `packages/shared/src/usageMerge.ts`, `usageFormat.ts`.
- Wire: RPC `server.getUsageSummary` (`packages/contracts/src/rpc.ts:467`, handler `apps/server/src/ws.ts:2601`) returning `UsageSummary` (`packages/contracts/src/usage.ts`, contract version 6).
- Data: `apps/server/src/usage/UsageService.ts` scans each provider's own session files on the server (Claude `~/.claude/projects`, Codex `sessions`, OpenCode SQLite, Antigravity databases, Cursor's dashboard API), so it also counts work done outside T3 Code. Readers: `usageTranscripts.ts`, `usageTranscriptReader.ts`, `opencodeUsageReader.ts`, `antigravityUsageReader.ts`, `cursorUsageReader.ts`. Aggregation: `usageAggregation.ts`. Cost: `usagePricing.ts` (rate table, plus user overrides). Result is pre-aggregated `UsageBucket`s keyed by `(day, hourStart?, provider, model, sourcePath?)`; raw records never cross the wire.

**What it shows today.** Three metric tabs (cost, tokens, limits) and windows of 1, 7, 30 or 90 days (the 1-day window is hourly). A smooth SVG chart of cost or tokens over time, stacked by provider, with a hover readout. Provider share rows. A Totals strip (processed, cached input, uncached input and output tokens, and more). A Breakdown table by provider and model (cost, share, tokens), and a per-model dialog with trend, cache hit rate and cost per million tokens. Cost is an API-equivalent estimate, not a bill.

**Gaps against the wishlist.**

| Wishlist item        | Today                                                                                   | Gap and what it needs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub-style heatmap | Absent                                                                                  | A calendar-grid component. The per-day numbers already exist (`day` in every bucket, with tokens, cost, `records`, `sessions`). The UI window stops at 90 days, so a year-long grid means requesting a longer window (the contract takes any `sinceDay`/`untilDay`); the scan cost of a year is unmeasured (`scanDurationMs` is reported, and `usageScanCache.ts` exists). If "activity" must mean turns or tool calls rather than tokens, see the next rows.                                                                                                                                                                         |
| Cost over time       | Mostly there: daily cost chart (hourly for 24 h), stacked by provider, 1/7/30/90 days   | Not there: per-model series over time (per-model trend only exists inside the model dialog), a cumulative line or projection, windows beyond 90 days, per-thread cost.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Tool-call graphs     | Absent, and the data is not in the usage path                                           | Buckets carry no tool-call counts and the usage scanner does not read tool events (no tool fields in `apps/server/src/usage`). Tool calls do exist as turn items in the orchestration read model (kind `tool_call`, `packages/contracts/src/orchestrationV2.ts:634`; classifier `packages/shared/src/toolActivity.ts`; work log in `packages/client-runtime/src/work-log/presentation.ts`), but only for threads T3 ran. Needs a new aggregation over those items, or extending the transcript readers, plus a new contract field or RPC. Decide which first.                                                                         |
| Per-thread views     | Absent: buckets have no thread or session id (only a `sessions` count and `sourcePath`) | Per-turn token numbers exist in the orchestration model: `OrchestrationV2ProviderTurn.tokenUsage` and `turnTokenUsage` (`packages/contracts/src/orchestrationV2.ts:938-970`), carried into the projection by `apps/server/src/orchestration-v2/ProjectionStore.ts:568` and referenced by the Claude, Codex, ACP, OpenCode and Pi adapters. Not verified: that every provider fills them, that they reach web clients in a thread snapshot, and how to price a turn (that struct has no model, and pricing needs model plus rates). This is a new join between orchestration data and the rate table, not an extension of the buckets. |

### Voice: upstream's voice-input controller

Facts for the provider-interface decision (`docs/internals/voice-input.md`, `packages/client-runtime/src/voice-input/`). **Audio** comes from a `VoiceRecorder` the caller injects (`uri`, `prepareToRecordAsync`, `record({ forDuration })`, `stop`), plus callbacks for permission, configuring, releasing and deleting the recording and for reading and committing the composer draft (`controller.ts:46-62`). The only recorder in the repo is the mobile app's expo-audio one (`apps/mobile/src/features/voice-input/lazyVoiceRecorder.ts`). The recording is a file URI capped at 5 minutes, not a stream, and the controller exposes no audio level (the mobile UI computes its own waveform in `voiceInputMetering`). **Text** comes from a `VoiceTranscriber` (`transcription.ts`): `prepare()` returns `{ locale, transcribe(uri, { signal }) → Promise<string> }`, with cooperative cancellation and typed error codes, and `getTranscriber()` returning null means "unavailable". The text is committed into the draft only if the draft's owner and revision still match, and it never submits a turn. **Interface:** yes, `VoiceTranscriber` is a clean seam a desktop provider (Clide, or an OpenAI-compatible server) could implement, since it is file-in, text-out. But it has no streaming partials, no live level and no `onLevel`/`onState` events, so the blueprint's `start/stop/onLevel/onState/onTranscript` interface is wider than what upstream defines, and a voice glow's `level` would have to come from somewhere else. **iOS-only:** the single transcriber is `apps/mobile/src/native/voiceTranscription.ios.ts` (Apple on-device, via `@react-native-ai/apple`); the non-iOS file returns null; the doc says environment-backed transcription is not implemented. Nothing in `apps/web` or `apps/desktop` uses the controller. Not run on a device.

## Session 7 summary (unattended v1 run, 2026-10-05)

**Shipped** (local commits on `main`, nothing pushed; see the phase entries below for details):

| Commit       | What                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `db6d7a83da` | Phase 0: `scripts/polaris-dev.mjs` (isolated dev stack, pair once), channel icon badges, green stage art |
| `19bbc3747a` | Phase 1: Usage activity heatmap, streaks, month projection                                               |
| `a8b986ec26` | lint fixes for the two above                                                                             |
| `23d22a0f8a` | Phase 2: Discord Rich Presence (desktop, opt-in, own IPC client, inert until an Application ID is set)   |
| `c1435c1b13` | Phase 3: quota-low state machine and hook                                                                |
| `52e8b23236` | Phase 4: composer FX slot (effort beam derived on read, red flash, amber accent)                         |

**Skipped, and why:** tool-call graphs, per-thread usage views, a 1y window button, per-model daily series and a quota-threshold setting all need a contract, keybinding-command or shared-shape change (listed under "Needs Star's approval"). A "working / idle" line in Discord presence needs a renderer signal that does not exist yet. The voice layer of the FX slot is a placeholder because the web composer has no voice capture in v1. The Electron smoke of the Discord switch and a live turn under the beam were not run (no Application ID; a live turn spends your quota).

**Test status vs. baseline:** every client package suite passes (numbers in "Current state"); the server suite result is in "Current state" too, compared with the pre-rebrand baseline of 8 pre-existing failures; the scripts suite keeps its one known failure. `vp fmt --check` and `vp lint` pass with 0 errors.

**Screenshots** (light and dark) in `../.playwright-mcp/`: `p7-01/02` Usage heatmap, `p7-03/04` green stage artwork, `p7-05/06` Discord setting, `p7-fx-*` every composer FX state.

**Needs Star's approval** and **Questions for Star** follow the phase plan below; the pairing note answers your message from during the run.

## Version plan (session 8, started 2026-10-05)

Every remaining version, one at a time, each on its own branch (`vN` from `main`), merged back with `--no-ff` and tagged `vN-done` only after its gate: full fmt + lint, every suite at or above the baseline (only the 8 known server failures and the 1 known scripts failure allowed), light + dark screenshots in `../.playwright-mcp/vN-*`, and a smoke of the dev app via `scripts/polaris-dev.mjs`. After the last version: polish mode on a `polish` branch, logged in `MORNING.md`. Mobile stays out. No real agent turns (states are forced in the UI).

Contract changes are allowed when additive and tested, and are listed under "Contract changes". New dependencies must be maintained and MIT/Apache/BSD/OFL, listed under "New dependencies".

**v1 (finish the leftovers)**

1. Quota-low threshold as a client setting (additive field) wired into the signal.
2. Usage: a "1 year" period (additive keybinding command) for the whole Usage page.
3. Usage: cost and tokens per model over time (client-only; buckets already carry the model).
4. Usage: tool calls over time (additive optional `toolCalls` on `UsageBucket`, counted by the Claude and Codex transcript parsers).
5. Usage: per-thread view (tokens and tool calls per run of the open thread, client-only from the thread projection).

**v2 (composer and atmosphere)**

1. Usage meter in the composer (quota windows; amber only when low; since V 4.0.0 a red-coral badge instead).
2. Bot avatars for run status (`bot-avatars`, MIT), per-provider bot, setting.
3. Gooey "+" composer menu (`liquid-gooey`, MIT), behind a setting, default off.
4. Voice input: provider interface, Clide provider in the desktop main process (spec in `clide-api-spec.md`, token in `safeStorage`), OpenAI-compatible server provider (opt-in, user-configured URL, off by default), `voice-glow` wiring and a push-to-talk button. Voice listening takes the composer FX slot's top priority.
5. Themes: per-theme fonts on top of upstream's theme library.

**v3 (workspace)**

1. Bento dashboard (chats, PRs) with a fixed-then-drag layout.
2. Skill studio (side panel for the repo's skills).
3. Better frontend skills (built-in skills content).
4. Slack-like multi-user chat: SKIPPED (the server is built around one owner; needs a design decision, see "Needs Star's approval").
5. Planning suite: SKIPPED (depends on the AFFiNE spike, which is Docker work with no code).
6. Plugin API: SKIPPED by the blueprint's own rule ("only if hard-fork editing stops being enough").

## Amendment from Star (session 8, 2026-10-05; supersedes all earlier amendments)

Recorded in `blueprint.md` "Decisions" (session 8 amendment). Applied at the item boundary after polish cycle 013 (the 13 polish commits were merged into `main` as `9dd159e439`; the amendment is built as **v4** on branch `v4`). In short:

- **New rules.** Every deviation from `blueprint.md` goes under "Deviations" below with its reason; never silently replace a chosen library. A message that is only "continue" means: re-read this file, find the last completed item or polish cycle, resume under the same rules.
- **Chat outline** = vendored `border-beam` with a `colors` prop and reduced-motion handling for its rotate types; the resolver (voice > quota flash > beam > idle ring) stays, one glowing element per view.
- **Effort colors (final):** none static; low true blue; medium gold (`#F5C542` + warm white on dark, `#D99A00` on light); high rainbow; xhigh and max cool, distinct, not purple. Frozen per turn.
- **Quota-low:** no amber, gold or orange. 4 s red flash, then a small red-coral badge with an icon beside the usage meter. The polish taste rule "amber is reserved for quota-low" (it lived only in the mission prompt) is removed.
- **The bot "Orbie"** (`circle`, one constant): the assistant's avatar everywhere, states from config, effort color while working, optional accessory, only visible bots animate.
- **Guards:** no plugin API; design notes for Slack-like chat and the planning suite; AFFiNE docs-only; voice against the spec with a stub provider; gooey keeps real buttons.
- **When finished:** a secrets scan over the whole diff since the first commit, result in `MORNING.md`.

### Audit (answers before any change, read from the tree at `9dd159e439`)

| Question                                | Answer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Is `border-beam` in `package.json`?     | **No.** Not in any `package.json` or the lockfile.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Is `bot-avatars`?                       | **Yes.** `apps/web/package.json`: `"bot-avatars": "0.2.2"` (MIT), loaded lazily. Also present: `voice-glow` 0.3.0 and `liquid-gooey` 0.2.2.                                                                                                                                                                                                                                                                                                                                                |
| What does the effort beam use today?    | **A homemade CSS beam**, as you thought: `apps/web/src/polaris/fx/composerFx.css` (session 7). A 2 px masked ring with a `conic-gradient` spun through an `@property` angle; tiers: low mono breathing, medium blue→violet, high orange→red, xhigh orange→rose, max a rainbow conic; reduced motion holds a static gradient. Priority logic in `composerFxState.ts`, tier logic in `effortTier.ts` (derived on read from the run's `modelSelection` plus the keyword in its user message). |
| Did any version already build the bots? | **Yes, partly: v2 item 2** (`0469a36b8b`). One bot in the **thread header only**, a different shape per provider (`botConfig.ts`), states from `botState.ts`, behind `botAvatarsEnabled` (default **off**). Not in messages, thinking state or empty state; no accessories; no effort color.                                                                                                                                                                                               |
| Planned version in `blueprint.md`       | `border-beam`: "Chatbox outline (v2)", marked **Chosen**; the outline was then built early in v1 (session 7, on your defaults) with our own CSS instead. `bot-avatars`: "Bots (v2)". `voice-glow`: "Voice input + Clide API (v2)". `liquid-gooey`: "Gooey (v2)". All four were built or wired in v2 except `border-beam`.                                                                                                                                                                  |

### Vendoring `border-beam`: how hard it was

Moderate, about half a day of agent time, most of it on looks rather than code.

- **Easy:** the source is public, MIT and small (5 files, about 3,200 lines, no dependencies). Copying it and adding `colors` took one small resolver, because every palette read already went through `colorPalettes[variant].border`.
- **Fiddly:** this repo's stricter compiler (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) rejected about 40 upstream table reads; they now go through small total helpers, no casts or ignores. A case-insensitive file clash (`EffortBeam.tsx` vs `effortBeam.ts` on macOS) broke the lazy import in tests until the config was renamed `beamLooks.ts`.
- **Real problems found:** (1) the rotate sizes ignored `prefers-reduced-motion` and the pulse sizes vanished under it; both now hold still with their fade kept. (2) Its stock look is tuned for small cards: `md`'s color blobs are fixed-pixel, so they barely covered a 736 px composer, and the light stroke is 0.12 opacity. Fixed by measuring the element (the library already did this for `pulse-outside`) and by raising its own opacity hooks in `composerFx.css`.
- **Upkeep:** `NOTICE.md` in the vendor folder lists the four changes; an update is "copy `src`, re-apply four marked changes, run the vendor tests".

## Deviations

Every deviation from `blueprint.md`, with its reason. Newest last.

| When                | Deviation                                                                                                                               | Reason                                                                                                                                                                                                                                                                                                           | Status                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Session 7 (v1)      | The chosen `border-beam` was replaced by a homemade CSS beam without being logged as a deviation.                                       | `border-beam` had only fixed palettes and no custom colors, and the red flash / amber accent needed exact colors; vendoring was not considered.                                                                                                                                                                  | **Fixed in v4**: `border-beam` vendored with a `colors` prop (this amendment).     |
| Session 8 (v2)      | `liquid-gooey` (filed "later version" in the amendment) was already built in v2 behind `gooeyComposerMenuEnabled` (default off).        | It was in the v2 plan; the chips are real `<button>` elements in a `role="menu"`.                                                                                                                                                                                                                                | Kept as is; nothing to undo.                                                       |
| Session 8 (V 4.0.0) | Per-provider bot shapes (v2, blueprint "Bots": "one bot type per agent or provider") are retired in favor of one bot, Orbie (`circle`). | Star's amendment: the bot is "the ball", one named assistant. `botAvatarByDriver` stays in the contract (ignored) so nothing breaks; Settings now offers Orbie's accessory instead.                                                                                                                              | Done                                                                               |
| Session 8 (V 4.1.0) | Over a custom background, muted text is held to 3:1, not the AA 4.5:1 the taste rules ask for.                                          | Body text keeps AA 4.5:1 over every part of the picture. Holding muted labels to 4.5:1 as well needed a 95–100% scrim over a high-contrast photo (measured with the test image), which hides the background the user chose. 3:1 is WCAG's level for large and UI text; the feature is opt-in and off by default. | Done; revisit if you want strict AA (raise the target in `backgroundContrast.ts`). |

## Version numbers (Star, 2026-10-05)

Polaris versions are **V MAJOR.MINOR.PATCH**. An enormous change bumps MAJOR; features bump MINOR; fixes and polish bump PATCH. The amendment is **V 4.0.0** (v1–v3 are V 1.0.0, V 2.0.0 and V 3.0.0). Git tags from now on are `vMAJOR.MINOR.PATCH`; the older `vN-done` tags stay as they are (nothing is renamed or deleted) and get `v1.0.0`, `v2.0.0`, `v3.0.0` tags on the same commits. The app's own version string (Settings, the updater) is **not** changed: the update feed still points at upstream, so that waits for you (see "Questions for Star").

## Version plan: V 4.1.0 (Star, during the run: "customizable everything")

After V 4.0.0 ships: customizable chat icons, customizable backgrounds (image) and video backgrounds, and more surface customization in the same spirit. Behind settings, honoring reduced motion (video pauses), low power and contrast (text stays on readable surfaces). Design note before code.

**Design note (written 2026-10-05, before code).** Research pass on comparable tools (Conductor, the Codex app, Cursor 3's Agents window; sources in MORNING.md) found the same three habits: one place that gathers finished or blocked agent work, status you can read without opening a thread, and personal touches that never cost legibility. Upstream already has the dock badge (`apps/desktop/src/ipc/methods/notificationBadge.ts`) and a welcome wizard (connection, agents, import), so V 4.1.0 does not rebuild those.

1. **Backgrounds (image or video), off by default.** The file is picked by the user and kept in the renderer's IndexedDB on this device (no server change, no network, no path access needed; works in the browser and in Electron). Caps: 25 MB image, 200 MB video. Client settings hold only the non-secret knobs: `backgroundKind` (`none`/`image`/`video`), `backgroundDim` (scrim strength, default 60%, so text on the page keeps AA contrast), `backgroundBlur` (0–24 px). Drawn as a fixed layer behind the app; the existing `surface-glass` utility (`--glass-opacity`) lets the sidebar and cards show it. Video is muted, looped and inline, and **pauses** under reduced motion (first frame stays as a still), when the page is hidden or the window loses focus, and on battery below 20% when the Battery API exists. No presets that ship third-party media; no gradients.
2. **Chat icons.** A per-thread icon from a small custom SVG set plus a token color, chosen from the thread's context menu, kept per device (localStorage map by thread id), shown in the sidebar row. No emoji. Projects keep their existing icon picker.
3. **First steps (onboarding after the wizard).** A dashboard widget with real, checked progress: add a project, start a thread, open the command palette, customize the dashboard, set up voice (optional). Each item is detected from real state, not ticked by hand, and the widget dismisses itself when done or on "Hide".
4. **Needs-you list (real-time feedback).** The dashboard greeting's live line becomes a short list of threads waiting on you (approval, input, plan ready) with one-click jumps, so the dashboard is the review queue.

## Version plan: V 4.0.0 (the amendment)

On branch `v4` from `main`, same gate as v1–v3, merged `--no-ff` and tagged `v4.0.0` (plus `v4-done` for continuity).

1. Vendor `border-beam` with a `colors` prop and reduced-motion handling; replace the homemade beam; final effort colors and `--polaris-beam-*` tokens; forced-state screenshots for every tier.
2. Quota-low: drop amber; red-coral badge with an icon beside the usage meter.
3. Orbie: the assistant's avatar everywhere (message avatars, thinking, empty state), effort color while working, optional accessory, perf guards. Star added during the run: Orbie replaces the initials badges (for example "SR" for the `server` project) as the profile picture, and Orbie is the thinking animation.
4. Dashboard (Star, during the run): opening Polaris lands on the dashboard; it keeps Activity and New chat and supports custom widgets.
5. Guards: design notes for Slack-like chat and the planning suite, AFFiNE docs-only findings and LICENSE check, a Clide stub provider for voice.
6. Secrets scan over the whole diff since the first commit; result in `MORNING.md`.

## Guards (V 4.0.0, item 5)

### Plugin API

Not built (amendment rule 6). Friends change Polaris by editing the fork; `AGENTS.md` is written for their agents.

### Gooey "+" menu

Checked `apps/web/src/polaris/gooey/GooeyPlusMenu.tsx`: the trigger and every chip are real `<button type="button">` elements (chips carry `role="menuitem"` inside a `role="menu"`), with arrow-key handling and Esc; `GooeyPlusMenu.test.tsx` queries them as buttons. Nothing to change.

### Voice: a stub Clide, and voice without Clide

Voice is built against `clide-api-spec.md` and was **tested against a stub, not real Clide**. The stub is `scripts/polaris-clide-stub.ts` (no dependencies; `node scripts/polaris-clide-stub.ts [--port N] [--token clide_…] [--demo]`). It prints `{ port, token }` once; put both into Settings → Voice → Clide. It keeps the spec's rules: loopback only, a `clide_` token kept only as a SHA-256 hash and compared in constant time, `Host` checked against `127.0.0.1`/`localhost` (DNS rebinding), any `Origin` refused, no CORS, 25 MB cap (413), webm refused (415 with the `accepted` list), a rate limit (429), `X-Clide-Version` on every answer, `/v1/events` with the state on connect, `: ping` every 15 s, at most 4 subscribers, `level` at about 30 Hz only while recording. Every transcription returns one fixed sentence; no audio is decoded. `--demo` loops a fake dictation so the voice glow can be seen; otherwise the optional v1.1 `POST /v1/dictation/start|stop|toggle` drives one. `scripts/polaris-clide-stub.test.ts` (4 tests) drives it with Polaris's own client code (`transcribeWithClide`, `takeSseEvents`, `toClideLiveEvent` from `packages/shared/src/polarisVoiceHttp.ts`). Voice still works with no Clide at all through the OpenAI-compatible backend (opt-in, off by default).

### AFFiNE (docs-only spike, 2026-10-05; nothing installed or run)

- **License (read from the repo, `toeverything/AFFiNE`, branch `canary`):** mixed. Everything outside `packages/backend` and `packages/common/native` is **MIT** (`LICENSE-MIT`). Those two folders are under the **AFFiNE Enterprise Edition license** (`packages/backend/server/LICENSE`): production use needs an EE subscription, copying and modifying "for development and testing purposes" is allowed without one, and modifications belong to AFFiNE. Parts shipped as AFFiNE Community Edition or served client-side (JS, CSS, fonts, images) are **MPL-2.0** under that same file. The BlockSuite editor framework (`toeverything/blocksuite`) is **MPL-2.0** (file-level copyleft: changes to its files must stay open; using it unmodified as a dependency is fine).
- **What that means for Polaris:** we can link to or embed a self-hosted AFFiNE in the built-in browser panel without license trouble for personal use, but we must not copy server code into Polaris, and a team self-host of the server is "production" under the EE text; read the EE terms first. Embedding BlockSuite in Polaris would be allowed (MPL-2.0 is compatible with our MIT fork if its files stay MPL and unmodified, or our changes to them are published), but it is a large dependency and not on the blueprint's list.
- **Fit for the blueprint's test (from AFFiNE's public docs, not run):** a kanban view exists (database block, table and kanban views), text can sit beside a board on the edgeless canvas, and database rows open as pages, so all three judging points look covered on paper.
- **Recommendation:** no planning-suite code in Polaris yet. Next step, if you want it: self-host AFFiNE with Docker for yourself (not a team), open it in Polaris's browser panel, and build the Prism Shade board by hand, as the blueprint says. Only then decide between "link out" and "embed BlockSuite".

### Slack-like chat (design note; nothing built)

Two readings, very different in cost:

1. **Several people in one Polaris server** (real multi-user chat). The server is built around one owner: pairing tokens identify devices, not people; threads, approvals and provider credentials have no per-user ownership. It needs identities, per-user permissions (who may approve a tool call or spend quota), presence and message attribution in the contracts and the projections. That is a product and security design, not an additive change. **Needs your approval and a design session.**
2. **A Slack-like layout for your own agent threads.** Projects as channels, threads as threads, unread markers, a mention of a provider ("@claude", "@codex") to start a turn there, and emoji-free reactions as quick replies ("approve", "retry"). Mostly web-only on today's contracts. Smallest safe slice, if you approve this reading: an unread dot plus a "Jump to unread" key in the sidebar, behind a setting, default off.

## Contract changes

Additive only (new optional fields, new RPCs or commands), each covered by tests.

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                           | Reason                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/contracts/src/settings.ts`    | `ClientSettings.quotaLowThresholdPercent` (Int 0..50, default 20; optional in the patch) and the exported option list                                                                                                                                                                                                                                            | v1 leftover: the quota warning threshold as a setting (0 turns it off)                |
| `packages/contracts/src/keybindings.ts` | new command `usage.period.year` (default binding Mod+Shift+5 in `packages/shared/src/keybindings.ts`)                                                                                                                                                                                                                                                            | v1 leftover: one-year Usage period                                                    |
| `packages/contracts/src/usage.ts`       | `UsageBucket.toolCalls` (optional non-negative Int; absent when zero or not counted). No contract version bump: the module's own rule says optional bucket fields are additive                                                                                                                                                                                   | v1 leftover: tool calls over time                                                     |
| `packages/contracts/src/settings.ts`    | `ClientSettings.composerUsageMeterEnabled` (Boolean, default true; optional in the patch)                                                                                                                                                                                                                                                                        | v2: usage meter in the composer                                                       |
| `packages/contracts/src/settings.ts`    | `ClientSettings.botAvatarsEnabled` (Boolean, default false), `ClientSettings.botAvatarByDriver` (record of driver → one of the 18 `BOT_AVATAR_TYPES`, default `{}`); both optional in the patch                                                                                                                                                                  | v2: bot avatars                                                                       |
| `packages/contracts/src/settings.ts`    | `ClientSettings.gooeyComposerMenuEnabled` (Boolean, default false; optional in the patch)                                                                                                                                                                                                                                                                        | v2: liquid "+" composer menu                                                          |
| `packages/contracts/src/settings.ts`    | `ClientSettings.voiceInputEnabled` (default false), `voiceBackend` (`"clide" \| "openaiCompatible"`, default `"clide"`), `voiceClidePort` (Int 0..65535, 0 = unset), `voiceOpenAiBaseUrl`, `voiceOpenAiModel`, `voiceLanguage` (strings, default `""`); all optional in the patch. Secrets are not settings: they live in the desktop shell's `safeStorage` file | v2: voice input                                                                       |
| `packages/contracts/src/settings.ts`    | `ClientSettings.themeFonts`: record of theme id → `{ sans?, code? }` (default `{}`), optional in the patch                                                                                                                                                                                                                                                       | v2: per-theme fonts                                                                   |
| `packages/contracts/src/settings.ts`    | `ClientSettings.botAccessory` (`"none" \| "hat" \| "glasses" \| "headphones" \| "bowTie"`, default `"none"`; optional in the patch) and **`botAvatarsEnabled` default changed from `false` to `true`** (an explicit saved `false` is kept)                                                                                                                       | V 4.0.0: Orbie everywhere, with an optional accessory                                 |
| `packages/contracts/src/settings.ts`    | `ClientSettings.launchPage` (`"dashboard" \| "newThread"`, default `"dashboard"`; optional in the patch)                                                                                                                                                                                                                                                         | V 4.0.0: Polaris opens on the dashboard; the old landing stays one setting away       |
| `packages/contracts/src/settings.ts`    | `ClientSettings.backgroundEnabled` (default `false`), `backgroundDim` (int 30–90, default 60), `backgroundBlur` (int 0–24, default 0); all optional in the patch                                                                                                                                                                                                 | V 4.1.0: your own image or video background; the file itself stays in browser storage |

## New dependencies

| Package        | Version | License | Where      | Why                                                                                   |
| -------------- | ------- | ------- | ---------- | ------------------------------------------------------------------------------------- |
| `bot-avatars`  | 0.2.2   | MIT     | `apps/web` | Thread-header bot (v2 item 2); no dependencies, React peer; loaded lazily             |
| `liquid-gooey` | 0.2.2   | MIT     | `apps/web` | Liquid "+" composer menu (v2 item 3); no dependencies, React peers; loaded lazily     |
| `voice-glow`   | 0.3.0   | MIT     | `apps/web` | Voice-reactive composer glow (v2 item 4); no dependencies, React peers; loaded lazily |

## Needs Star's approval

- **Slack-like chat.** Not built. Design note in "Guards (V 4.0.0)" below: pick between the two readings (several people in one server, or a Slack-like layout for your own agent threads); the second has a safe first slice.
- **Planning suite.** Not built. The AFFiNE docs spike is done (see "Guards (V 4.0.0)"); the recommendation there needs your yes before anything is installed or embedded.
- **Plugin API.** Not built, by the blueprint's rule and the amendment; hard-fork editing still works.
- **A desktop app of its own (your "full desktop app" ask).** The Electron shell in `apps/desktop` builds and its tests pass, but a packaged Polaris would still be **T3 Code to macOS**: app id `com.t3tools.t3code` (`scripts/build-desktop-artifact.ts:57`), Electron profile `~/Library/Application Support/t3code-v2` (`t3code-dev` in dev; `apps/desktop/src/app/DesktopUserData.ts`), server state in `~/.t3`, the `t3code://` scheme and window class `t3code`. Installed next to your real T3 Code, it would share that data and its single-instance lock (whichever opens second gives way), and the auto-updater still follows upstream's feed (see "App version string"). These are the internal identifiers `AGENTS.md` says to leave alone unless you ask, so I did not change them and did not run or package Electron. Proposed change, one branch, when you say yes: app id `app.polaris.desktop` (or a reverse-domain id you own), profile `polaris` / `polaris-dev`, home `~/.polaris` (with `T3CODE_HOME` still honored), scheme `polaris://`, window class `polaris`, the updater feed off until you have releases, then `vp run dist:desktop:dmg:arm64` for an unsigned local `.dmg` (Gatekeeper: right-click → Open). Nothing to migrate: no Polaris desktop data exists yet.

## Questions for Star

- **App version string.** Polaris versions are now V MAJOR.MINOR.PATCH (V 4.0.0 for the amendment), used for tags and notes. The desktop/web `package.json` versions are still upstream's, because the auto-updater compares them against upstream's release feed (`pingdotgg/t3code`). Switching them to 4.0.0 belongs with pointing the feed at your own releases.

- **Usage meter default.** The composer usage meter ships on by default (quiet until a window is low). Upstream keeps its context indicator off by default; if you want the same, set `composerUsageMeterEnabled` to default `false` in `packages/contracts/src/settings.ts`.
- **Discord Application ID.** Register an application at the Discord developer portal, paste its ID into `POLARIS_DISCORD_APPLICATION_ID` in `apps/desktop/src/polaris/discord/discordConfig.ts` (or export the env var of the same name for a dev run), and upload an asset named `polaris` for the large image. Until then the switch is disabled with an explanation.
- **Pairing (your note during the run).** The packaged desktop app does not pair: the Electron shell holds the bootstrap token and signs the renderer in by itself (`apps/desktop/src/backend/DesktopLocalEnvironmentAuth.ts`). The pairing page is the **browser** dev flow (`vp run dev`, policy `loopback-browser`). I made that a one-time step: `scripts/polaris-dev.mjs` now writes a random dev token to the gitignored `.polaris/dev-auth-token` and passes it as `T3CODE_DEV_AUTH_TOKEN`, so the server seeds the same reusable session every run and the 30-day `localhost` cookie from the first pairing keeps working (upstream's own mechanism, `apps/server/src/auth/ReusableDevAuth.ts`). Upstream's caveat: that cookie goes to every port on `localhost`, so any local service you visit in that browser could read the token. If you want **zero** pairing in the browser (auto sign-in for loopback requests), that is a change to the server's auth policy with the same trade-off made permanent; I did not make it without you.

## Entries

### 2026-10-06 — Claude (session 8) — V 4.1.1 gate: passed, merged, tagged `v4.1.1`

- Status: done
- What changed: polish cycles 014 to 023 (branch `polish-2`) merged into `main` with `--no-ff` and tagged `v4.1.1` (patch: polish only, no contract changes, no new dependencies). MORNING has a V 4.1.1 section; polishing stopped at 23 of 25 because the last scans found nothing clearly better.
- How verified: `vp fmt --check` clean; `vp lint --report-unused-disable-directives` exit 0, 0 errors, 867 warnings (same as V 4.1.0). Suites: contracts 531, shared 1,112, client-runtime 1,998, desktop 1,414 (+44 skipped), web 5,968, scripts 341 + the 1 known failure, server 8 known failures / 6,430 passed / 21 skipped. Screenshots light and dark in `.playwright-mcp/v4.1.1/` (dashboard, skills, appearance) and `v4.1.1-sheet.png`. Smoke: `scripts/polaris-dev.mjs start` (pgid 9018, ports 13774/5734) → paired → landed on `/dashboard`, sidebar utility row present, no page errors (`v4.1.1-smoke.png`); stopped with `polaris-dev.mjs stop 9018`.
- Risks: Same as the cycle entries; nothing new.
- Next action: wait for Star. The desktop app still needs the identity decision in MORNING "Needs Star's approval".
- Open questions: Desktop identity (app id, profile, home dir, URL scheme).

### 2026-10-06 — Claude (session 8) — polish 023: first steps in any order

- Status: done
- What changed: `polaris/dashboard/FirstSteps.tsx`: each step that is not done shows its action, not only the next one; the next step's button is `default` (filled), the others `outline`. Doc comment updated. Steps are still checked from real state only.
- How verified: `vp test run apps/web/src/polaris/dashboard` 20 passed; web typecheck and lint clean. Isolated Playwright contexts, 1280 px light and dark and 400 px light: buttons "Open (⌘K) | Customize | Appearance" with only the first filled; Customize entered edit mode and Appearance opened `/settings/appearance`. Shots `.playwright-mcp/polish/023-*`.
- Risks: None known.
- Next action: next polish cycle (024).
- Open questions: None.

### 2026-10-06 — Claude (session 8) — polish 022: skills fit narrow windows

- Status: done
- What changed: `polaris/skills/SkillStudioPage.tsx`: below `md`, the list hides once a skill is explicitly picked and the detail hides while none is, each taking full height; an "All skills" ghost button (`md:hidden`) clears the pick. `SkillDetail.tsx` header: the title block has `basis-56` so actions wrap under it, the title wraps instead of truncating, and the path is `line-clamp-2 break-all`.
- How verified: `vp test run apps/web/src/polaris/skills` 4 passed; web typecheck and lint clean (a native `title` on the path was refused by `no-native-title-tooltip` and dropped). Isolated Playwright contexts at 400 px, light and dark: list only → pick → detail only with the back button → back → list only; at 1280 px both panes show and the back button is hidden. Shots `.playwright-mcp/polish/022-*`.
- Risks: On narrow windows a provider or project switch returns to the list (it already cleared the pick).
- Next action: next polish cycle (023).
- Open questions: None.

### 2026-10-06 — Claude (session 8) — polish 021: the note says it saved

- Status: done
- What changed: `polaris/dashboard/NoteWidget.tsx`: after each save (debounced or on blur) a muted `text-2xs` "Saved" mark shows under the text at the end edge and fades out after 1.6 s (`SAVED_MARK_MS`); its timer is cleared on unmount. The mark is `aria-hidden` (saving is automatic; announcing every pause would be noise) and does not animate under reduced motion.
- How verified: web typecheck and lint clean; `vp test run apps/web/src/polaris/dashboard` 20 passed (no new pure logic). Isolated Playwright contexts, light and dark, with a seeded note: mark opacity 0 at rest, 1 about 1 s after typing, 0 again 2.2 s later; the typed line was in the stored layout. Shots `.playwright-mcp/polish/021-*`.
- Risks: None known.
- Next action: next polish cycle (022).
- Open questions: None.

### 2026-10-06 — Claude (session 8) — polish 020: links show where they go

- Status: done
- What changed: `polaris/dashboard/dashboardLayout.ts`: new pure `dashboardLinkHint(link)` (host without `www.` for web addresses, the path for in-app links, null when the label already says it or the link is refused). `LinksWidget.tsx` shows it in muted `text-xs` after the label; the label keeps its width and the hint truncates first. Tests added.
- How verified: `vp test run apps/web/src/polaris/dashboard` 20 passed; web typecheck and lint clean. Isolated Playwright contexts with a seeded Links widget, 1280 px light and dark and 400 px light: hints `github.com`, `/usage`, `notes.example.org`, none on the `docs.example.com` row. Shots `.playwright-mcp/polish/020-*`.
- Risks: None known; the hint is derived locally, no network.
- Next action: next polish cycle (021).
- Open questions: None.

## History

- 2026-10-06 — Claude (session 8) — polish 019: Threads tile lines up. Rolled up; see `git log`.
- 2026-10-06 — Claude (session 8) — polish 018: chat icons on the dashboard. Rolled up; see `git log`.
- 2026-10-06 — Claude (session 8) — polish 017: the dashboard counts as home in the sidebar. Rolled up; see `git log`.
- 2026-10-06 — Claude (session 8) — polish 016: skills read as documents. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — polish 015: background row fits narrow windows. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — polish 014: Customize fits narrow windows. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.1.0 gate: passed, merged, tagged `v4.1.0`. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.1.0 item 3: First steps. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.1.0 item 4: Review next. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.1.0 item 2: chat icons. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.1.0 item 1: image and video backgrounds. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 gate: passed, merged, tagged `v4.0.0`. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 item 6: secrets scan. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 item 5: guards. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 item 4: the dashboard is home, with your own widgets. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 item 3: Orbie everywhere. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 item 2: quota-low without amber. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — V 4.0.0 item 1: vendored `border-beam` and the final effort colors. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v3 gate: passed, merged, tagged `v3-done`. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v3 items 2–3: skill studio and frontend skills. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v3 item 1: bento dashboard. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v2 gate: passed, merged, tagged `v2-done`. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v2 item 5: per-theme fonts. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v2 item 4: voice input. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v2 item 3: liquid "+" composer menu. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v2 item 2: bot avatars. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v2 item 1: usage meter in the composer. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v1 gate passed, merged as `v1-done`. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v1 item 5: per-thread usage. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v1 item 4: tool calls over time. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v1 item 3: models over time. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v1 item 2: one-year Usage period. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 8) — v1 item 1: quota-low threshold setting. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 7, unattended v1 run) — Phase 4: composer FX slot (effort beam, quota flash and accent). Rolled up; see `git log`.
- 2026-10-05 — Claude (session 7, unattended v1 run) — Phase 3: quota-low signal. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 7, unattended v1 run) — Phase 2: Discord Rich Presence. Rolled up; see `git log`.
- 2026-10-05 — Claude (session 7, unattended v1 run) — Phase 0: known issues, and Phase 1: Usage activity heatmap. Rolled up; see `git log`.
- 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 6: display-level rebrand to Polaris, green accent, placeholder logo. Rolled up; see `git log`.
- 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 5: Cursor stays, fonts checked in the app, quota-low design, effort wiring traced. Full entry rolled up in session 8; see `git log` for details.
- 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 4: your answers, Cursor rule replaced with a pointer. Full entry rolled up in session 8; see `git log` for details.
- 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 3: your decisions, CI fallout, Node pin, push prep. Full entry rolled up in session 8; see `git log` for details.
- 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 2: CI, your six decisions, Node 24 verification, dev boot. Full entry rolled up in session 8; see `git log` for details.
- 2026-10-05, v1 item 1 (Opus 5.5): cloned the upstream snapshot as `polaris-repo`, renamed `origin` to `upstream-snapshot`, moved upstream's `AGENTS.md` to `docs/upstream-AGENTS.md`, and added `AGENTS.md`, `HANDOFF.md`, `blueprint.md`, `ref.md`, `clide-api-spec.md` and the README fork note.
- Open from that session and still true: dangling upstream doc links (`CONTRIBUTING.md`, `docs/README.md`, `docs/operations/development.md` point at `AGENTS.md` anchors that do not exist), and `.cursor/rules/cursor-cloud.mdc` was replaced by a pointer file in session 4.
