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
- v1 progress (`blueprint.md` "v1 scope"): item 1 (agent-friendly repo) done and verified on Node 24, including a real dev boot. Item 2 (Discord) and item 3 (usage graph) not started. Item 3 will extend upstream's Usage panel; the gap list is below.
- CI: `.github/workflows/ci.yml` (Polaris, verified commands only, Node from `.nvmrc`). Never executed on GitHub yet.
- Known failing (pre-existing, not fixed): `scripts/build-desktop-artifact.test.ts` > `build-desktop-artifact` > `skips the primary native probe for cross-architecture Windows payloads`. Fails identically on the pristine snapshot. Not in CI. Details in `AGENTS.md`.
- Node: `.nvmrc` is `24.13.1` (the lower bound of `engines.node`); change both together.

### Effective effort: where it is resolved today

Read from source on 2026-10-05, not run. This is for the beam decision "follow the level sent with the turn" (`blueprint.md`, Decisions).

- **Claude:** `compileClaudeModelSelection` in `apps/server/src/claudeModelOptions.ts:28`. Input is the turn's `modelSelection`. It reads the `effort` option, applies the catalog's `effortMap`, and returns `effort` (what the API gets), `promptEffort` (the keyword-level text prefix), `settings` (such as `ultracode`) and `queryIdentity`. Callers in `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`: `makeClaudeQueryOptions` (`:804`, compile at `:830`, `effort` handed to the SDK at `:872-876`), per turn at `:6923`, and the text prefix at `:7187-7189` and `:7396-7398`.
- **How the keyword level reaches the request:** it does not arrive as the saved option in normal flows. The web picker only edits the prompt text (`apps/web/src/components/chat/TraitsPicker.tsx:346-352`), and mobile hides it (`apps/mobile/src/features/threads/thread-settings-options.ts:56`). Typing it in the body changes only the text: T3's server does no text detection (the detector at `packages/shared/src/model.ts:302` is used only by the web composer). The turn is dispatched with `modelSelection: ctxSelectedModelSelection` (for example `apps/web/src/components/ChatView.tsx:9516`) and text from `formatOutgoingPrompt` (`:782-791`).
- **So the two can disagree:** saved level `high` plus the keyword in the body means the picker shows the keyword level, `modelSelection` says `high`, and the text carries the keyword. "Follow what is sent" needs: effective = (keyword in the final outgoing text, and the model lists it) ? keyword level : level id in the turn's selection. Nothing computes that today. Its pieces: the detector, `resolvePromptInjectedEffort` (`packages/shared/src/model.ts:495`) and `compileClaudeModelSelection`. The natural place is the Claude adapter at turn start (`ClaudeAdapterV2.ts` near `:7187` and `:7396`), where the compiled selection and the final text both exist.
- **Other adapters** read their own option from the turn's `modelSelection`: Codex `reasoningEffort` (`CodexAdapterV2.ts:718`), OpenCode `variant` (`OpenCodeAdapterV2.ts:3271`, `OpenCode2AdapterV2.ts:755`), Pi `thinking` (`PiAdapterV2.ts:2117`). Grok, Cursor and ACP were not traced. There is no provider-neutral function.
- **Storing it:** `OrchestrationV2ProviderTurn` has no effort or model field (`packages/contracts/src/orchestrationV2.ts:951-970`), so a frozen per-turn tier needs a new field or event. Where the per-turn `modelSelection` is persisted for UI reads was not traced. `ProviderEventIngestor.ts:101` reads the raw option for analytics at turn completion; it is not a store.
- **Still open:** whether "sent" means the level id in the turn's selection (my reading) or the API value after `effortMap` (see `blueprint.md`, Open questions).

### Before you push (commands for you)

Nothing is pushed and there is no `origin`. I did not run any of the commands in step 2 to 4. The `upstream-snapshot` remote's push URL was a live `https://github.com/pingdotgg/t3code` URL (git copies the fetch URL by default); I changed it to a dead value (`git remote set-url --push upstream-snapshot DISABLED-upstream-snapshot-is-reference-only`). To undo: `git remote set-url --push upstream-snapshot https://github.com/pingdotgg/t3code`, which you should not want.

```sh
cd /Users/brenomenezes/Downloads/polaris-kickoff/polaris-repo

# 1. Checks. Expected results in the comments.
git remote -v                                         # one remote, upstream-snapshot; its (push) line reads DISABLED-...
ls .github/workflows                                  # ci.yml only
git status --short                                    # empty
git log --format='%an <%ae>' 3e6b450..HEAD | sort -u  # the identity that will be public (see below)

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

**Check the commit identity first.** Every commit of ours since `3e6b450` is authored and committed as `5rnkq9b5yf-collab <5rnkq9b5yf@privaterelay.appleid.com>`, taken from `~/.gitconfig`. If you want a different public identity, set it for this repo and rewrite only our local commits (safe because nothing is pushed, and it changes their hashes):

```sh
git config user.name  "<name>"
git config user.email "<email>"
git rebase 3e6b450 --exec 'git commit --amend --no-edit --reset-author'
git log --format='%an <%ae>' 3e6b450..HEAD | sort -u
```

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

## Entries

### 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 3: your decisions, CI fallout, Node pin, push prep

- Status: done. One pre-existing failing upstream test is listed, not fixed. Nothing pushed.
- What changed:
  - **Decisions recorded** in `blueprint.md` "Decisions so far": quota-low trigger, fallback tier by position, neutral default, beam follows the level sent (frozen per turn), upstream's ring kept as the idle indicator, moved-workflow fallout, Node pin, remote. The tier table gained a `neutral` row and a worked fallback table; the Composer FX slot table now has the ring in the idle state and the beam in the running state; the open questions were rewritten.
  - **The failing test was caused by our move** (it passes on the pristine snapshot), so the one minimal upstream edit this session is in `scripts/notify-discord-release.test.ts`: its `release.yml` path now points at `.github/upstream-workflows/release.yml`, with a one-line comment. Docs naming the old workflow paths were updated: `docs/operations/development.md` (Windows lane link), `docs/operations/release.md` (all paths plus a Polaris note), `infra/relay/README.md`, `packaging/aur/README.md`.
  - **A second failing test is pre-existing** and was left alone: `build-desktop-artifact.test.ts` "skips the primary native probe for cross-architecture Windows payloads". Listed by exact name in `AGENTS.md` and above.
  - **`.nvmrc` is `24.13.1`**; `ci.yml` uses `node-version-file: .nvmrc` and also runs `scripts/notify-discord-release.test.ts`. `AGENTS.md` says to change `.nvmrc` and `engines.node` together.
  - **Remote**: `upstream-snapshot`'s push URL was a live pingdotgg URL; it is now a dead value (see "Before you push").
  - "Current state" above gained: where effective effort is resolved, and the push commands.
- How verified (Node v24.13.1 via `fnm exec --using=24.13.1`):
  - **Pristine snapshot**: `git worktree add --detach /tmp/polaris-snapshot-wt 3e6b450`, `pnpm install --ignore-scripts --frozen-lockfile` (49 s, to avoid rewriting the shared hook config). `vp test run scripts/notify-discord-release.test.ts` there: exit 0, 22/22. The same file on our tree: exit 1 (ENOENT on `.github/workflows/release.yml`) before the fix, 22/22 after it.
  - `vp run --filter @t3tools/scripts test`: 1 failed, 337 passed, 2 skipped on our tree and identically on the snapshot, so pre-existing. The worktree was removed afterwards (`git worktree list` shows only the main checkout).
  - **The full CI command list** (one script, exact commands from `ci.yml`), all exit 0: `vp i` 10 s, `ensure:electron`, lint 7 s, typecheck for contracts, shared, client-runtime, `t3` (24 s), web, desktop, tests for contracts (510), shared (1,105), client-runtime (1,998), and `scripts/notify-discord-release.test.ts` (22). The web and desktop typechecks took 0 to 1 s because `tsc` reuses gitignored `tsbuildinfo` files; they are real `tsc --noEmit` runs, and a fresh CI checkout does a full run.
  - **`.nvmrc` support in `setup-vp`**: read `action.yml` and `README.md` from the `main` branch of `voidzero-dev/setup-vp` (read-only fetch): `node-version-file` accepts `.nvmrc`. This is the `main` docs, not the `@v1` tag, and it has not run on GitHub.
  - **Fallback formula**: a throwaway script confirmed your example ([fast, balanced, deep] → low, high, max), that exact integer math equals the float form for every n from 2 to 60, and that results are monotonic with lowest → low and highest → max. The worked table in `blueprint.md` is its output.
  - **References to `.github/workflows`**: searched tracked files (excluding the vendored `.repos` and the lockfile), including a looser search of scripts and configs. There are no CODEOWNERS, dependabot or renovate files. Only the test and the four docs above needed changes.
  - **Pre-push checks**: only `ci.yml` is in `.github/workflows`; secrets scan of added lines is clean; commit identity found (see "Before you push").
  - `vp fmt --check` (run last): exit 0, "All matched files use the correct format" across 4,882 files, on Node 24.13.1.
- Risks:
  - **`ci.yml` has still never run on GitHub.** It now reads `.nvmrc` (24.13.1), which `setup-vp` documents as supported. The runner is Linux and I verified on macOS.
  - **`build-desktop-artifact.test.ts` fails here** (macOS arm64, 24.13.1) and on the snapshot. Not checked on Linux, where it may pass; it is not in CI either way.
  - **Leftovers kept on purpose.** A comment at `packages/shared/src/cliRelease.ts:16` still says `.github/workflows/release.yml` (upstream source, comment only). The inert copies in `.github/upstream-workflows/` still refer to each other as `./.github/workflows/...` (for example `uses: ./.github/workflows/release-desktop.yml`); harmless while inert, broken if someone moves them back.
  - **`vp`'s own Node shim checks `engines.node` before `.nvmrc`**, so a local `vp` may use a newer 24.x than CI's 24.13.1.
  - **Two interpretations of yours** are flagged in `blueprint.md` Open questions: "general quota" (I read: every quota window other than the 5-hour `session` one) and "the level sent" (I read: the level id in the turn's selection plus the keyword-in-text override, not the API value after `effortMap`).
  - **The effort-resolution facts are from reading source**, not from a running turn.
  - **Push size and identity**: about 436 MiB and roughly 4,770 commits, and the commit identity is a private-relay Apple ID address from your global git config (see "Before you push").
  - Still not exercised: the Usage page with real data, an agent turn, the desktop app.
- Next action: Human: work through "Before you push" in "Current state" (check the commit identity first), push, and watch the first `ci.yml` run. After that, an agent starts v1 item 2 (Discord Rich Presence) with a read-only plan: read `apps/desktop/src/main.ts`, `apps/desktop/src/ipc/` and `apps/desktop/src/settings/`, find where an opt-in, desktop-only setting and a main-process service would live, and report before writing code (the implementation needs the Discord Application ID).
- Open questions: all in `blueprint.md` → "Open questions". New or still open, highest priority first: (1) "the level sent" for Claude: level id (my reading) or API value after `effortMap`; (2) quota-low flash: confirm "general quota", whether it applies to the active provider only, how long it flashes, whether it overrides the tier beam, whether 20% is a setting; (3) fix, replace or delete `.cursor/rules/cursor-cloud.mdc`; (4) voice provider interface; (5) the git-text-generation double read of `AGENTS.md`/`CLAUDE.md`. Earlier ones still open: Discord Application ID, app name and branding, desktop vs `npx`, Clide API port.

### 2026-10-05 — Claude Code (Sonnet 5.5, in T3 Code) — session 2: CI, your six decisions, Node 24 verification, dev boot

- Status: done, with one known failing upstream test (see Risks). No upstream source file was edited.
- What changed:
  - **CI (decision 1).** `git mv .github/workflows .github/upstream-workflows` (17 renames, plus upstream's `ci.yml` moved there too; 18 files, byte-identical to the snapshot) and a short README there saying they are inert. New `.github/workflows/ci.yml`: one job on `ubuntu-latest` running `vp fmt --check`, `vp lint --report-unused-disable-directives`, six per-package typechecks (contracts, shared, client-runtime, `t3`, web, desktop) and three per-package test suites (contracts, shared, client-runtime), after `ensure:electron`. No secrets, no release, deploy, mobile or bot jobs.
  - **Usage gap list (decision 2)** and **voice paragraph (decision 4)**: written into "Current state" above so they outlive the entry log. No code.
  - **Effort tiers (decision 3)**: `blueprint.md` color table is now keyed on tiers (none, low, medium, high, xhigh, max) with a drafted `xhigh` row, plus a provider → tier table and your mapping rules. The keyword-level detection is recorded exactly (files and lines) in "How the composer handles the keyword level". The word itself is not spelled anywhere in the docs I wrote.
  - **Links (decision 5)**: `CONTRIBUTING.md`, `docs/README.md` and `docs/operations/development.md` now point at `docs/upstream-AGENTS.md#documentation` / `#test-data` (each target heading checked).
  - **Node (decision 6)**: `.nvmrc` = `24`. `.cursor/rules/cursor-cloud.mdc` is untouched; the comparison is under Risks.
  - **Blueprint**: your six decisions are in "Decisions so far". Open questions were rewritten: answered ones removed, new ones added (tier mapping details, keyword-level behavior, notify-discord test, leftover workflow references, `.nvmrc` vs `engines`, cursor rule).
  - **Also recorded, not built**: your message that the chat outline should flash red when the provider's usage is below 20%. It is a backlog row, a "Quota-low warning" section and six open questions in `blueprint.md`. It is a feature, and this session is hygiene only.
  - **AGENTS.md** (84 lines): Commands re-verified on Node 24, new rows for per-package tests and `ensure:electron`, a "Dev boot" section, a CI pointer and the known failing test.
  - Outside the repo: installed `fnm` with Homebrew and Node 24.21.0 through it. I did not edit any shell profile; use `fnm exec --using=24 <cmd>`.
- How verified (Node v24.21.0 via `fnm exec --using=24`, local `node_modules/.bin/vp` v1.0.0, macOS arm64):
  - `vp i`: exit 0, lockfile unchanged, no "Unsupported engine" warning (the Node 26 warning is gone).
  - Typecheck, each exit 0 with no `error TS` lines (only advisory Effect suggestions): `@t3tools/contracts` 1 s, `@t3tools/shared` 2 s, `@t3tools/client-runtime` 4 s, `t3` 32 s, `@t3tools/web` 9 s, `@t3tools/desktop` 3 s.
  - Tests: `vp run --filter @t3tools/contracts test` 37 files / 510 tests, `@t3tools/shared` 77 / 1,105, `@t3tools/client-runtime` 121 / 1,998, all passed. Single files: `packages/shared/src/Array.test.ts` 1/1, `apps/server/src/sourceControl/SourceControlProvider.test.ts` 2/2.
  - `vp lint --report-unused-disable-directives`: exit 0, 0 errors, 850 warnings, about 7 s.
  - `vp run --filter @t3tools/desktop ensure:electron`: exit 0.
  - `.github/workflows/ci.yml`: parsed with the repo's `yaml` package (valid; 1 job, 14 steps; no `secrets.` or token expressions, only `github.*` context in `concurrency`). Its command list is the verified list above.
  - `vp test run scripts/notify-discord-release.test.ts`: **exit 1**, ENOENT on `.github/workflows/release.yml`. Predicted from the move, then confirmed. Not edited.
  - **Dev boot** (exact command): `PATH="<fnm node 24 bin>:$PWD/node_modules/.bin:$PATH" nohup vp run dev --home-dir /tmp/polaris-dev-home > /tmp/polaris-dev.log 2>&1 &`. Worked on the first try.
    - Runner line: `[dev-runner] mode=dev source=default ports serverPort=13773 webPort=5733 baseDir=/tmp/polaris-dev-home`. Server `Listening on http://127.0.0.1:13773` about 3 s after start; Vite on `http://localhost:5733/` (IPv6 loopback).
    - HTTP: `GET :5733/` 200, title "T3 Code (Alpha)"; `GET :13773/` 302; `GET :5733/.well-known/t3/environment` 200 JSON; `GET :5733/api/auth/session` 200 with `authenticated: false`, policy `loopback-browser`, bootstrap `one-time-token`; `/api/health` is 404 (no such route).
    - Browser (T3 Code preview, 1280×800): T3 mark splash, then "Pair with this environment" with a token field. Opening the logged `pairingUrl` made `POST /api/auth/browser-session` return 200 and redirected to `/draft/<id>`, the main UI: sidebar with a project named `server`, "New thread", "Settled (0)", Settings / Pull Requests / Usage buttons, "What should we build in server?", and a composer showing `GPT-6-Astra`, `Medium`, `Full access`, with a right panel showing branch `main`, "Publish repository" and Changes +802 −145. The first load took about a minute while Vite optimized dependencies.
    - Needed: no `.env`, no sign-in (just the one-time pairing URL from the log), no provider CLI to boot. On this machine `codex`, `claude` and `opencode` are on PATH; `cursor-agent` and `grok` are not. I did not run an agent.
    - Observed noise, not diagnosed: Vite warns `Failed to resolve dependency: @clerk/clerk-js, present in client 'optimizeDeps.include'` (it is listed at `apps/web/vite.config.ts:187` but is not a dependency of `apps/web`); the browser logged repeated `net::ERR_ABORTED` for `POST /api/observability/v1/traces` while the server logged 204s; before pairing the WebSocket was refused with 401 (expected).
    - A project named `server` already existed in the empty throwaway home. Why was not investigated.
    - **Stopping it took three steps.** SIGINT to the captured PID did nothing (background jobs ignore it). SIGTERM to the `vp` wrapper (PID 31206) ended only the wrapper. The dev-runner, Vite and the server kept running, and I ended them by PID after tracing each one's ancestry to my spawn. End state: ports 5733 and 13773 free, nothing of mine left running, `/tmp/polaris-dev-home` deleted, `git status` clean (the boot created no files in the repo), `~/.t3/dev` not created.
  - `vp fmt --check` (run last): exit 0, "All matched files use the correct format" across 4,882 files. The first run of the session had failed on the new docs until `vp fmt` was applied to them; the pre-commit hook also formats staged files.
- Risks:
  - **CI has never run on GitHub.** It was only YAML-parsed. The runner is Linux, I verified on macOS, and the action versions (`actions/checkout@v6`, `voidzero-dev/setup-vp@v1`) were copied from upstream's workflow, not checked.
  - **One upstream test fails** (`scripts/notify-discord-release.test.ts`, ENOENT) because of the workflow move. `ci.yml` does not run the `scripts` package, but repo-wide `vp run test` would fail on it.
  - **Leftover references to the old workflow path**: `docs/operations/development.md:111` links `windows-tests.yml` (dead link), and `docs/operations/release.md`, `infra/relay/README.md` and `packaging/aur/README.md` mention paths under `.github/workflows/`.
  - **`.nvmrc` `24` vs `engines` `^24.13.1`**: a machine whose newest 24.x is older than 24.13.1 passes `.nvmrc` and fails `engines`. This Mac resolved `24` to 24.21.0.
  - **`.cursor/rules/cursor-cloud.mdc` vs AGENTS.md** (kept unedited; it is `alwaysApply: true`, so Cursor agents always load it). It disagrees on: (1) it says `npm run dev` auto-wires `VITE_HTTP_URL`/`VITE_WS_URL`, but for `dev` and `dev:web` the runner deletes them and sets single-origin mode (`scripts/dev-runner.ts:350-363`), and upstream's rule says never set them; (2) it says server state lives in `~/.t3` and dev instances share one DB, while upstream says never run a dev server against `~/.t3/userdata` and the main checkout defaults to `~/.t3/dev/userdata`; (3) it tells agents to run `vp check --fix` before committing, while AGENTS.md says no repo-wide `vp check`; (4) it uses `npm run …`, while the repo is pnpm and AGENTS.md uses `vp`; (5) "unauthenticated by default" does not match the observed `loopback-browser` policy with a one-time token; and it lists only four provider CLIs (omits Grok, Pi, Antigravity). It agrees on Node 24 and on ports 5733 and 13773.
  - **Not exercised**: the Usage page with real data, a running composer with the keyword level, an actual agent turn, the desktop app. The effort and keyword facts are from reading source.
  - **Process slip, recovered.** Mid-session I ran `git stash -u` to compare against the pre-move tree. It conflicted with my new `ci.yml` and half-applied. I checked every file against the stash (my `ci.yml` and README identical, all 18 upstream workflows byte-identical to HEAD) before dropping the stash. Nothing was lost. No further stash use.
  - The T3 Code preview tool saved its screenshots under `~/.t3/userdata/browser-artifacts/` itself; I did not choose that or write anything else there.
- Next action: Human: create the remote (`git remote add origin <url>`, then `git push -u origin main`) and watch the first run of `ci.yml`; fix whatever a Linux runner turns up. After that, an agent starts v1 item 2 (Discord Rich Presence) with a read-only plan: read `apps/desktop/src/main.ts`, `apps/desktop/src/ipc/` and `apps/desktop/src/settings/`, find where an opt-in, desktop-only setting and a main-process service would live, and report before writing code (the implementation needs the Discord Application ID).
- Open questions: all in `blueprint.md` → "Open questions". Highest priority: (1) quota-low flash: does "below 20%" mean 20% remaining, and which quota window counts; (2) how "nearest tier by position" is computed and what "neutral default" renders; (3) beam follows the displayed level or the API level; (4) beam reaction to the keyword level while typing, and what happens to the composer's existing static ring; (5) fix, delete or leave the failing notify-discord test and the leftover workflow references; (6) pin `.nvmrc` to `24.13.1` or keep `24`. Earlier ones still open: Discord Application ID, app name and branding, desktop vs `npx`, Clide API port, voice provider interface.

### 2026-10-05 — Claude Code (Opus 5.5, in T3 Code) — v1 item 1: agent-friendly repo

- Status: done. Commands that need a long-running process (`dev`, desktop, build) are listed but were not run; see Risks.
- What changed (docs and agent files only; no upstream source touched):
  - Cloned the upstream snapshot into `polaris-kickoff/polaris-repo` (location chosen by the human because `polaris-kickoff/polaris` holds the kickoff pack). Renamed `origin` to `upstream-snapshot` and ran `git branch --unset-upstream` so `main` does not track upstream.
  - `git mv AGENTS.md docs/upstream-AGENTS.md`, content unchanged.
  - Added `AGENTS.md`, `HANDOFF.md`, `blueprint.md`, `ref.md` and `clide-api-spec.md` from the kickoff pack.
  - `CLAUDE.md` is now a symlink to `AGENTS.md`. Upstream's `CLAUDE.md` only contained `@AGENTS.md`, so nothing unique was lost.
  - `AGENTS.md`: filled in the SHA. Rewrote Commands as a table with a verified/not-run status per command, plus the real `--filter` package names (the server is `t3`, not `@t3tools/server`). Rewrote Layout from the real tree. Linked `docs/upstream-AGENTS.md` and required reading it before server work. 71 lines.
  - `blueprint.md`: added "Found in the code" under Open questions (effort names per provider, existing Usage panel and voice controller, inherited CI, Cursor rule, dangling links, Node version, git text generation).
  - `README.md`: a 2-line hard-fork note with links to upstream and LICENSE. `LICENSE` is unchanged (`git diff 3e6b450..HEAD -- LICENSE` is empty).
  - `ref.md` and `clide-api-spec.md`: formatted with `vp fmt` only (table alignment, semicolons in code samples). The repo's `clide-api-spec.md` is no longer byte-identical to `polaris-kickoff/clide/clide-api-spec.md`; the content is the same.
  - Corrections to the kickoff `AGENTS.md`: the commands were not "verified" before. `node scripts/release-smoke.ts` is exposed as `vp run release:smoke`. Format check failed on the copied docs until they were formatted. Layout was missing `apps/marketing`, `packages/shared`, `effect-acp`, `effect-codex-app-server`, `ssh`, `tailscale`, `infra/relay`, `native/`, `scripts/`, `oxlint-plugin-t3code/`, `.repos/`, `docs/operations/`, `docs/orchestration-v2/` and `.agents/skills/`. "How it works" was reworded to match `docs/internals/overview.md` (orchestrator, transactional outbox, effect worker). "Effect docs vendored (if present)" now names the actual files.
- How verified (Node v26.8.1, pnpm 11.10.0, local `node_modules/.bin/vp` v1.0.0, because global `vp` is not installed on this machine):
  - `pnpm install`: done in 2m21s. Warnings: `Unsupported engine: wanted node ^24.13.1`, peer-dependency issues, and "Failed to create bin" for `vite`/`vitest` in workspace packages (did not affect `vp test`). The `prepare` script set `core.hooksPath=.vite-hooks/_` (pre-commit runs `vp staged`, which formats staged files).
  - `vp i`: exit 0, 8.5s.
  - `vp run --filter @t3tools/contracts typecheck`: exit 0, plus 1 advisory Effect suggestion in `src/baseSchemas.test.ts`.
  - `vp test run packages/shared/src/Array.test.ts`: exit 0, 1/1 passed.
  - `vp test run apps/server/src/sourceControl/SourceControlProvider.test.ts`: exit 0, 2/2 passed.
  - `vp lint --report-unused-disable-directives`: exit 0, 0 errors, about 850 pre-existing warnings (mostly React Compiler memoization warnings in `apps/web`), about 8s.
  - `vp fmt --check`: exit 1 at first (only on the 4 copied Polaris docs). After `vp fmt` on them: exit 0, "All matched files use the correct format" (4,880 files).
  - Every command in the AGENTS.md table was checked against root `package.json` `scripts`. All 11 exist.
  - `git diff --quiet 3e6b450:AGENTS.md HEAD:docs/upstream-AGENTS.md`: identical. `git diff --stat 3e6b450..HEAD` touches only the 8 doc and agent files.
  - Not run, as instructed or because they are long-lived: `vp run dev`, `vp run dev:desktop`, `vp run migrate-dev-db`, `vp run knip:check`, `vp run build:desktop`, `vp run release:smoke`, repo-wide typecheck and test.
- Risks:
  - `vp run dev` was never started, so "a fresh agent can run the app" is untested here. The script and `scripts/dev-runner.ts` exist.
  - All checks ran on Node 26, not the required Node 24. Results on Node 24 are expected to match but were not tested.
  - Effort-level names in `blueprint.md` come from reading the source, not from a running app. Codex, Grok, Cursor and ACP vocabularies are only known at runtime.
  - Dangling links: `CONTRIBUTING.md`, `docs/README.md` and `docs/operations/development.md` point at `AGENTS.md#documentation` / `#test-data`, which now resolve to the Polaris file (no such anchors). Repo-relative links inside `docs/upstream-AGENTS.md` break when opened from `docs/`. Left as-is because the rules say not to modify upstream files.
  - `.cursor/rules/cursor-cloud.mdc` was not symlinked. It is Cursor-Cloud-specific with `.mdc` frontmatter, and symlinking it would wipe unique content. Some of its advice conflicts with upstream's rules.
  - The 18 upstream GitHub workflows in `.github/workflows/` will run if this repo is pushed to GitHub with Actions enabled.
- Next action: Human: answer the CI question below, then create your remote (`git remote add origin <url>`, then `git push -u origin main`). Agent, after that: start v1 item 2 (Discord Rich Presence) by reading `apps/desktop/src/main.ts`, `apps/desktop/src/ipc/` and `apps/desktop/src/settings/` to find where an opt-in, desktop-only setting and a main-process service would live. Report the plan before writing code. Implementation needs the Discord Application ID.
- Open questions: all recorded in `blueprint.md` → "Open questions" → "Found in the code, 2026-10-05". The most urgent: (1) what to do with the 18 upstream CI workflows before the first push, (2) whether v1 item 3 extends upstream's existing Usage panel, (3) how the provider effort vocabularies map onto the beam table, (4) whether to fix the dangling upstream doc links, (5) keep or delete `.cursor/rules/cursor-cloud.mdc`, (6) whether to pin Node 24 with `.nvmrc`. Earlier questions still open: Discord App ID, app name and branding, desktop vs `npx`, Clide API port.

## History

(none yet)
