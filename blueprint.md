# blueprint.md — Polaris

## Vision

A personal fork of T3 Code with extra features, themes and built-in skills. Customizable, clearly documented, and easy for friends and their agents to fork and change.

## Decisions so far

- **Hard fork.** Snapshot upstream T3 Code `main`, never merge back. This removes fork-drift worries.
- **No plugin API in v1.** Upstream's plugin host is still an unmerged PR stack. Friends' agents can edit source directly. Revisit if that stops working.
- **"Easy to swap agents" means repo hygiene**: clean `AGENTS.md`, `HANDOFF.md` files, docs. (Not provider switching; upstream already supports several providers.)
- **Discord "RPC" = Discord Rich Presence.**
- **Planning suite**: do not build a database engine. Spike AFFiNE first (see below).
- **Effects come from the libraries.dev family** (`border-beam`, `voice-glow`, `bot-avatars`, `liquid-gooey`). All four are MIT on npm. The paid Studio/Pro tier is optional and not needed.
- **Voice input goes through a provider interface.** Clide (macOS only) is one provider. An OpenAI-compatible transcription server or the browser mic is another. Voice must work without Clide installed.

Decided 2026-10-05 (session 2, by the human):

- **CI.** Upstream's 18 workflows were moved to `.github/upstream-workflows/` (reference only, inert). One new `.github/workflows/ci.yml` runs only commands verified locally on Node 24: format check, lint, typecheck for six packages, and tests for three. No release, deploy, mobile or bot workflows, and nothing that needs secrets.
- **Usage graph (v1 item 3) extends upstream's existing Usage panel.** No second panel. The gap against the wishlist (activity heatmap, cost over time, tool-call graphs, per-thread views) is in `HANDOFF.md`. No code until that is reviewed.
- **Effort colors are keyed on tiers, not provider level names.** Tiers: none, low, medium, high, xhigh, max. A provider-to-tier table maps each provider's levels onto them (see "Chatbox outline"). Do not hard-code provider level names in the beam config.
- **Voice: no code yet.** Upstream's voice-input controller is summarized in `HANDOFF.md` so the provider-interface decision can be made with facts.
- **Upstream doc links** that pointed at headings in the old `AGENTS.md` now point at `docs/upstream-AGENTS.md`.
- **Node**: `.nvmrc` pins `24`. `.cursor/rules/cursor-cloud.mdc` is kept unedited; where it disagrees with `AGENTS.md` is logged in `HANDOFF.md`.

## v1 scope (in order)

1. **Agent-friendly repo**: `AGENTS.md`, `HANDOFF.md`, `docs/`.
   - Done when: a fresh agent can run, test and extend the repo from `AGENTS.md` alone.
2. **Discord Rich Presence** (desktop shell).
   - Opt-in toggle, off by default. Silent when Discord is absent. Reconnects with backoff. Generic text only. No-op on web and mobile.
   - Needs a registered Discord Application ID (human task; not a secret).
3. **Usage / token / cost graph** (flagship).
   - First task: check what token, cost and tool-call data the server already exposes per turn. If it does not, report back before building.
   - Done when: a panel shows tokens, cost and tool calls over time per thread and overall, plus a GitHub-style activity heatmap.

## Spike (parallel, no code)

Self-host AFFiNE with Docker. Open it in T3's built-in browser panel. Build the Prism Shade board on an edgeless canvas. Judge: kanban view, text beside the board, page behind each card. Write findings into `HANDOFF.md`. Check the LICENSE before sharing anything built on it.

## Backlog (v2 / v3)

| Feature                                        | Where it lives        | Notes                                                              |
| ---------------------------------------------- | --------------------- | ------------------------------------------------------------------ |
| Usage meter in input tab                       | core UI               | after the graph exists                                             |
| Chatbox outline shader tied to thinking effort | core UI               | touches the composer; see "Chatbox outline" section                |
| Quota-low red flash on the chat outline        | core UI               | requested 2026-10-05; see "Quota-low warning"                      |
| Bento customizable dashboard (chats, PRs)      | core UI               | drag layout                                                        |
| Skill studio                                   | side panel + tools    |                                                                    |
| Better frontend / unique skills                | built-in skills       |                                                                    |
| Slack-like chat                                | core UI               | multi-user is new territory; server is built around one owner      |
| Planning suite (Notion + whiteboard)           | side panel            | depends on the AFFiNE spike                                        |
| Themes                                         | core                  | upstream already has a modular theme library and editor; extend it |
| Plugin API                                     | server + web          | only if hard-fork editing stops being enough                       |
| Bot avatars (agent status)                     | core UI               | `bot-avatars`; see "Bots" section                                  |
| Gooey composer menu                            | core UI               | `liquid-gooey`; see "Gooey" section                                |
| Voice input + glow                             | desktop + core UI     | `voice-glow` + Clide API; see "Voice" section                      |
| Clide Local API                                | Clide repo (separate) | spec in `clide-api-spec.md`                                        |

## Chatbox outline (v2)

Goal: the composer's outline glows or animates, and its intensity reflects the thinking-effort setting.

**License rule.** Use only code whose license is verified (MIT, Apache-2.0, CC0, CC BY) or code we write ourselves. Shadertoy shaders default to CC BY-NC-SA 3.0 (non-commercial, share-alike) unless the shader header says otherwise. Do not copy a Shadertoy shader unless its header says CC0 or CC BY. A rounded-rectangle border-glow fragment shader is small, so prefer writing an original one.

**Candidates.** Licenses verified from package and listing pages; visual quality NOT yet seen. Check each library's props for intensity-style controls before choosing.

| Option                             | License         | Type                                                                      | Notes                                                                                                                                                                                                                                                                                            |
| ---------------------------------- | --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `border-beam` (jakubantalik)       | MIT             | React; React Native and SwiftUI/Metal ports (native ports not on npm yet) | **Chosen.** Props verified: `size` (`sm`/`md`/`line`/`pulse-inner`/`pulse-outside`), `colorVariant` (`colorful`/`mono`/`ocean`/`sunset`), `theme`, `strength` 0–1, `duration`, `active`, `brightness`, `saturation`, `hueRange`, `staticColors`. **No custom hex colors** (only the 4 variants). |
| Magic UI Border Beam               | MIT             | React + CSS                                                               | Props: size, duration, colorFrom, colorTo, borderWidth, reverse. Duration and size map cleanly to effort.                                                                                                                                                                                        |
| Paper Shaders `MeshGradient`       | Apache-2.0      | WebGL                                                                     | Props: colors, distortion, swirl, speed. Pin the version (breaking changes under 0.0.x). Keep LICENSE and NOTICE if redistributing code. Needs masking to a ring.                                                                                                                                |
| CSS `@property` + `conic-gradient` | write ourselves | CSS                                                                       | Zero dependencies. Must register `@property` with an `<angle>` syntax or the spin does nothing.                                                                                                                                                                                                  |
| `react-native-animated-glow`       | MIT             | React Native + Skia                                                       | For the mobile app only.                                                                                                                                                                                                                                                                         |

**Color per thinking-effort tier (draft; tune after seeing it).** Cool to warm as effort rises. The first column is a **tier**, not a provider's level name: each provider's levels are mapped to a tier by the table below, so the config never hard-codes provider vocabulary. Keep it in one config object so users can edit it. `duration` is the cycle time in seconds, so lower = faster. The `xhigh` row is interpolated from its neighbors and has never been seen rendered.

| Tier   | colorVariant | size          | strength | duration | extra                                                                                                                         |
| ------ | ------------ | ------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| none   | n/a          | n/a           | n/a      | n/a      | `active={false}`; thin static border                                                                                          |
| low    | `mono`       | `pulse-inner` | 0.5      | 2.3      | calm breathing                                                                                                                |
| medium | `ocean`      | `md`          | 0.8      | 1.96     | blue-purple                                                                                                                   |
| high   | `sunset`     | `md`          | 1        | 1.5      | orange-red                                                                                                                    |
| xhigh  | `sunset`     | `md`          | 1        | 1.3      | **draft, interpolated.** Variants cannot blend, so it keeps `sunset`; `hueRange` and `saturation` about halfway to max's bump |
| max    | `colorful`   | `md`          | 1        | 1.1      | wider `hueRange` (about 60), a bit more `saturation`                                                                          |

**Provider → tier.** Read from the source on 2026-10-05 (snapshot `3e6b450`). Not seen rendered, except that the composer I loaded showed the Codex model `GPT-6-Astra` at `Medium`. The Claude set matches what the human described seeing in the composer.

| Provider (driver)      | Option id                                             | Levels the code knows                                                                                                                                                                                                 | Maps to                                                                                                               |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Claude (`claudeAgent`) | `effort`                                              | Per model, from `apps/server/src/provider/model-manifest.json`: low, medium, high, xhigh ("Extra High"), max; some models add `ultracode`; most add the keyword level (below); the oldest profile has only low to max | low→low, medium→medium, high→high, xhigh→xhigh, max→max, `ultracode`→max (ultra-prefixed), keyword level→max          |
| Codex                  | `reasoningEffort`                                     | Runtime list from Codex `model/list`. Labels the adapter knows: none, minimal, low, medium, high, xhigh ("Extra High"), max, ultra                                                                                    | none→none, minimal→low, low→low, medium→medium, high→high, xhigh→xhigh, max→max, ultra→max; anything else by position |
| OpenCode               | `variant` (labeled "Reasoning")                       | Each model's variants at runtime. Fallback when a model lists none: low, medium, high, xhigh                                                                                                                          | Known names as above; other variant names by position                                                                 |
| Pi                     | `thinking`                                            | off, minimal, low, medium, high, xhigh, max (`Layers/piThinkingCapabilities.ts`)                                                                                                                                      | off→none, minimal→low, the rest one-to-one                                                                            |
| Grok                   | `reasoningEffort`                                     | Whatever tokens the agent advertises at runtime (any `^[a-z0-9][a-z0-9._-]{0,31}$`)                                                                                                                                   | Known names as above; others by position                                                                              |
| Cursor                 | SDK model param (`effort`, `reasoning` or `thinking`) | Runtime (`provider/cursorSdkModel.ts`)                                                                                                                                                                                | Known names as above; others by position                                                                              |
| ACP registry           | the agent's own session config option                 | Runtime                                                                                                                                                                                                               | Known names as above; others by position                                                                              |
| Antigravity            | none                                                  | The thinking level is part of the model ID; there is no separate effort option                                                                                                                                        | neutral default                                                                                                       |

Mapping rules (decided by the human): off or none → none; minimal or low → low; medium → medium; high → high; extra high → xhigh; max, and any keyword-style level whose name starts with "ultra", → max; an unknown level → the nearest tier by its position in that provider's own list; a provider with no effort setting → neutral default. How "nearest by position" is computed and what "neutral default" renders are not defined yet (see Open questions).

Display level versus API level: for some Claude profiles the manifest's `effortMap` sends a different value to the API than the picker shows (for example `xhigh`→`max` on one profile, `max`→`high` on another, and `ultracode`→`xhigh`). The tables above use the level the picker shows.

### How the composer handles the keyword level

Claude's picker has one top level that is not a saved setting. Typing the keyword in the prompt text triggers it. **This file never spells the keyword**: typing it into a T3 or Claude prompt triggers the behavior described here. Search for it with a regex that splits the word, for example a character class around one of its letters. Read from the code on 2026-10-05; not exercised in a running composer.

- **Detection** is a case-insensitive whole-word regex over the prompt text: `packages/shared/src/model.ts:302` (the function name contains the keyword). It matches the word anywhere in the prompt, not only at the start.
- **When it runs.** `apps/web/src/components/chat/ChatComposer.tsx:2275-2291` memoizes `getComposerPromptInjectionState(prompt)` (`composerProviderState.tsx:62`), so it re-evaluates on every prompt change. Typing or deleting the word flips it live.
- **Only on models that list it.** The state counts only if the model's first select option has the level in `promptInjectedValues` (`composerProviderState.tsx:142-144`; the field is in `packages/contracts/src/model.ts:29`). The manifest lists it on most Claude profiles. Codex, Pi, OpenCode and the others never trigger it.
- **What the UI does when detected.**
  - The picker shows the keyword level whatever the saved level is (`TraitsPicker.tsx:175-186`).
  - The composer gets a frame class and the model icon gets a chroma class (`composerProviderState.tsx:152-158`; both class names contain the keyword). The CSS is at `apps/web/src/index.css:2075-2118`: a **static** gradient ring, with no animation and no reduced-motion handling.
- **Two ways in.**
  - _Picked in the picker._ Choosing the level does not save an option. It edits the prompt: an empty prompt becomes `"<Keyword>:\n"`, otherwise the prompt is prefixed with that line (`TraitsPicker.tsx:346-352`, prefix constant at `:93`, `applyClaudePromptEffortPrefix` at `packages/shared/src/model.ts:510`). The prefix is skipped when the prompt starts with a slash command (`/name`), and it is never doubled. Picking any other level strips the prefix and saves that level (`TraitsPicker.tsx:355-359`).
  - _Typed in the body._ The picker control is disabled with a message telling the user to remove the word (`TraitsPicker.tsx:182-183`, `:408-426`).
- **On send.** The web client re-applies the prefix when the effort resolves to the keyword level (`ChatView.tsx:782-791`), and the Claude adapter does it again server-side at two call sites (`apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts:7187` and `:7396`, using `promptEffort` from `apps/server/src/claudeModelOptions.ts:51`). In the manifest the level's `effortMap` entry is `null`, which means no explicit API effort for it. Prompt-history recall strips the prefix (`composerPromptHistory.ts:119`).
- **Not determined.** Whether the UI can ever store the keyword as the saved option value, as opposed to only the text prefix. `resolveDescriptorChoiceValue` (`packages/shared/src/model.ts:119-141`) maps a stored keyword value back to the model's default level when descriptors resolve.
- **What the beam could react to** (facts, not a decision): the pure function of the prompt text above; `getComposerProviderState(...).composerFrameClassName`; or the picker's prompt-controlled flag (`TraitsPicker.tsx:176`). Because the signal comes from the text, a beam keyed on it would change as the user types. The composer already has a static outline treatment for this level, which overlaps the planned beam.

If four palettes are not enough or exact hex per effort is wanted, vendor `border-beam` into the repo (MIT, keep the license) and add a `colors` prop like `voice-glow` has. Do not use a CSS `hue-rotate` hack unless it looks right.

`border-beam`'s pulse types honor `prefers-reduced-motion` themselves. Its rotate types do NOT; add the reduced-motion handling ourselves.

**Rules.**

- Honor `prefers-reduced-motion` (fall back to a static border).
- One glowing element per view (the active composer only). Blurred conic layers are expensive.
- Do not clip the halo with `overflow: hidden`.
- Ship a static fallback for engines without `@property`.

**Spike first.** Prototype two options on an isolated page. Pick by look and frame rate on the target machines. Record the result in `HANDOFF.md`.

### Quota-low warning (requested 2026-10-05; not built)

The human's request: when the usage of the provider drops below 20%, make the chat outline shader flash **red**. Not implemented: this session is repo hygiene only, and the composer outline is v2. Read from the code, not exercised:

- **The data already exists.** Each provider reports quota windows as `ServerProviderUsageWindow`: `usedPercent` (0 to 100), `resetsAt`, `windowDurationMins` and a `label` (`packages/contracts/src/providerUsageLimits.ts:20-26`). A provider can report several windows. The composer already renders them (`apps/web/src/components/chat/ComposerUsageLimits.tsx`); shared logic is in `packages/shared/src/usageLimits.ts`. Accounts that cannot report windows at all exist (the contract's own note at `:46`), so the rule has to stay silent when there are none.
- **Red is not available in `border-beam`.** It only has the four palettes and no custom hex colors (see the candidates table). Red needs the vendored-with-a-`colors`-prop route described above, or an original shader.
- **Flashing is motion.** It has to honor `prefers-reduced-motion` (static red border instead). Upstream's own rule is "no continuously repainting animations; they peg the GPU on high-refresh displays" (`docs/upstream-AGENTS.md`, "Taste"). A flash that runs for as long as quota stays low runs into that rule.
- **It competes for the composer.** Only one animated effect on the composer at a time (see "Composer FX slot").

## Composer FX slot

Only one animated effect on the composer at a time. Swap with a fade (`active` + `onDeactivate`), never stack.

| Composer state     | Effect                                 |
| ------------------ | -------------------------------------- |
| idle               | thin static border                     |
| agent thinking     | `BorderBeam` by the effort table above |
| voice listening    | `VoiceBeam` driven by `level`          |
| voice transcribing | `VoiceBeam` with `processing` on       |

## Bots (thinking / working animation, v2)

`bot-avatars` (MIT, plain 2D canvas, no WebGL). 18 shapes. Three states: `default` (idle), `working`, `sleeping`.

- `state`: run in progress → `working`; idle → `default`; waiting or stale thread → `sleeping`. Keep the mapping in config.
- One bot type per agent or provider; let the user pick it. Optional `hat`, `glasses`, `headphones`, `bowTie`, `color`, `shading` (`fabric` plush by default, or `plastic`, `crisp`, `smooth`, `flat`) for customizability.
- Perf: the README says about 1 ms of main thread per frame per avatar and that each one pauses offscreen. Still animate only visible ones; give the rest `paused`.
- `aria-label` per state is built in; reduced motion is handled by the library.
- Mobile: `bot-avatars-native` is not on npm yet (React Native needs native modules; SwiftUI port is iOS 17+). Web and desktop first.
- Alternative for a loading indicator: `thinking-orbs` from the same repo (nine loading states). Package license not separately checked.

## Gooey (v2)

`liquid-gooey` (MIT). `<Liquid blur contrast fill shadow>` with `<Liquid.Item x y transition="bouncy" delay>`. SVG-filter based.

- Use for: a "+" button on the composer that pops out attach / skills / effort chips; status pills that merge.
- Keep real `<button>` elements inside for accessibility.
- Test performance. WebKit can be slow with SVG filters; the desktop app is Chromium, so mostly a web-in-Safari concern.

## Voice input + Clide API (v2)

`voice-glow` (MIT) takes either a `MediaStream` or a `level` (0–1 number or a getter function), so it does NOT need a browser mic. It also has a `processing` prop for the "transcribing / thinking" sweep, eight palettes plus custom `colors`, and `type="pill"` for a small recording pill.

Provider interface in Polaris: `start()`, `stop()`, `onLevel`, `onState`, `onTranscript`. Implementations:

1. **Clide** (macOS only; Apple Silicon, macOS 13+): Polaris desktop main process subscribes to Clide's local event stream and forwards over IPC. Spec in `clide-api-spec.md`.
2. **Browser mic + any OpenAI-compatible transcription server**: `useMicrophone()` from `voice-glow` for the glow, `POST /v1/audio/transcriptions` for the text. Works on any OS, so friends on Windows are covered.
   - Do NOT upload `MediaRecorder` output to Clide. Chromium records WebM/Opus by default, and Clide returns `415` for it. Capture 16 kHz mono 16-bit PCM with an `AudioWorklet` and wrap it in a WAV header (about 1.9 MB per minute, so a 25 MB cap is roughly 13 minutes).

Build order: Clide API v1 (in the clide repo) → Polaris provider interface → glow wiring → push-to-talk button in the composer.

Security rules for the Clide side are in the spec (token, loopback only, Host/Origin checks). Do not skip them.

Token storage on the Polaris side: the user pastes the token once; Polaris desktop's main process stores it with Electron `safeStorage`. If `safeStorage` is unavailable (for example an unsigned macOS build), keep the token in memory only and ask again next launch. Never store it in plain JSON and never hand it to the renderer.

## Non-goals

Merging upstream. Building our own database or block engine. Forking Obsidian (proprietary). Using tldraw (not MIT).

## Open questions

- Which Discord Application ID and art assets for presence?
- What name and branding for the desktop app?
- Do friends run the desktop build, or `npx` of the fork?
- Port and default settings for the Clide Local API.

### Effort tiers and the beam

Facts are under "Chatbox outline" above. These are still open.

- What does "neutral default" render for a provider with no effort setting (Antigravity)? A tier, a separate look, or no glow?
- How is "nearest tier by position in that provider's own list" computed? One candidate, which is my interpretation and not decided: for a list of n levels, take the level's 0-based index i, drop levels already mapped by name, and map the rest by i/(n-1) onto the order low, medium, high, xhigh, max. Confirm or replace it.
- Should the beam follow the level the picker shows, or the level actually sent to the API? They differ for some Claude profiles (the manifest's `effortMap`), and `ultracode` is sent as `xhigh` but maps to the max tier by the rule above.
- Should the beam react while the user types the keyword level (the signal comes from the prompt text and flips on every keystroke), only after send, or not at all?
- The composer already draws a static gradient ring for the keyword level. Keep it, replace it with the beam's max tier, or suppress it while the beam is active?

### Quota-low flash

- "Below 20%": do you mean 20% of quota **remaining** (`usedPercent` above 80)? That is how I read it, but it could also mean under 20% used.
- When a provider reports several windows (for example a short rolling window and a weekly one), which one counts: any of them, the shortest, or the most used?
- Does it apply to the provider of the active thread only, or to any provider?
- How long does it flash: a few flashes when the threshold is crossed, or until the quota resets? The second conflicts with upstream's no-continuous-animation rule.
- Does it override the effort-tier beam while active, or share the slot some other way?
- Is the 20% threshold fixed or a setting?

### Other open items found in the code (snapshot `3e6b450`)

- **Voice provider interface.** Plug into upstream's `VoiceTranscriber` and controller (`packages/client-runtime/src/voice-input/`), or stay separate? The facts are in `HANDOFF.md`.
- **A test now fails.** `scripts/notify-discord-release.test.ts` reads `.github/workflows/release.yml`, which moved to `.github/upstream-workflows/`, so it fails with ENOENT. Update its path, delete it (it covers upstream's Discord release announcer, which Polaris does not use), or leave it failing? It is upstream source, so it was not edited. `ci.yml` does not run the `scripts` package.
- **Other references to moved workflows.** `docs/operations/development.md:111` links `windows-tests.yml`, and `docs/operations/release.md`, `infra/relay/README.md` and `packaging/aur/README.md` name paths under `.github/workflows/`. Fix or leave?
- **`.nvmrc` is `24`, but `engines` needs `^24.13.1`.** A machine whose newest installed 24.x is older than 24.13.1 passes `.nvmrc` and fails `engines`. Pin `24.13.1`, or keep `24`?
- **`.cursor/rules/cursor-cloud.mdc`** is kept unedited, but it disagrees with `AGENTS.md` and upstream's rules in places (listed in `HANDOFF.md`). Fix, replace or delete it?
- **T3 Code's git text generation reads the repo's `AGENTS.md`** when the style is "repo conventions" (`apps/server/src/git/GitManager.ts`). With a Claude writer it also reads `CLAUDE.md`, which is now a symlink, so the same text is included twice (upstream's `CLAUDE.md` was just `@AGENTS.md`). Acceptable?
