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

- **CI.** Upstream's 18 workflows were moved to `.github/upstream-workflows/` (reference only, inert). One new `.github/workflows/ci.yml` runs only commands verified locally on Node 24.13.1: format check, lint, typecheck for six packages, tests for three packages, and one Discord release-step test file. No release, deploy, mobile or bot workflows, and nothing that needs secrets.
- **Usage graph (v1 item 3) extends upstream's existing Usage panel.** No second panel. The gap against the wishlist (activity heatmap, cost over time, tool-call graphs, per-thread views) is in `HANDOFF.md`. No code until that is reviewed.
- **Effort colors are keyed on tiers, not provider level names.** Tiers: none, low, medium, high, xhigh, max. A provider-to-tier table maps each provider's levels onto them (see "Chatbox outline"). Do not hard-code provider level names in the beam config.
- **Voice: no code yet.** Upstream's voice-input controller is summarized in `HANDOFF.md` so the provider-interface decision can be made with facts.
- **Upstream doc links** that pointed at headings in the old `AGENTS.md` now point at `docs/upstream-AGENTS.md`.
- **Node**: `.nvmrc` pins Node (`24` in session 2, changed to `24.13.1` in session 3, see below). `.cursor/rules/cursor-cloud.mdc` was kept unedited in session 2 and replaced by a pointer in session 4 (see below).

Decided 2026-10-05 (session 3, by the human):

- **Quota-low flash trigger.** Flash the chat outline red when remaining quota is below 20% (more than 80% used) on the 5-hour limit or on the general quota; either one triggers it. Reading of the data (confirmed by the human in session 4): the 5-hour limit is the window with `kind: "session"` (Claude's `five_hour`), and the general quota is every other window (`weekly`, `monthly`, `other`). Not built.
- **Fallback tier by position** (only for level names missing from the provider → tier table; explicit names always win). Ordered active tiers: low, medium, high, xhigh, max. "none" is separate and only for off or none levels. For an unknown value, take the provider's ordered level list, drop off/none and keyword-style levels, and let n be what is left. If n is 1 the tier is medium. Otherwise p = index / (n − 1) and tier = ladder[round(p × 4)], rounding half up (exact integer form: floor((8i + n − 1) / (2(n − 1)))). The provider's lowest level always looks low and its highest always max; middle levels interpolate. Example: [fast, balanced, deep] → low, high, max (accepted; it is a fallback and the explicit table should cover real providers). Clamp, never throw, log once in dev. Checked with a throwaway script: the integer form matches the float form for every n from 2 to 60, and the result is monotonic.
- **Neutral default** (providers with no effort setting, or a value that cannot be resolved): `colorVariant` mono, `size` md, `strength` 0.6, `duration` 2.0. Steady and grey, with no hue that implies a level, and visibly different from low (mono + `pulse-inner`, breathing). It animates only while a turn is running; idle stays the thin static border.
- **The beam follows the level sent with the turn, not the live picker.** The beam is a status indicator for the running turn. Resolve the effective effort once at send time (the same function that builds the request), store it on the turn or event, and freeze it for that turn. Changing the picker mid-run must not recolor a running beam. If the picker display and the sent value disagree (for example the keyword level in the text changes what is sent), the beam follows what is sent. Where effective effort is resolved today: see "How the composer handles the keyword level" and `HANDOFF.md`.
- **Upstream's static ring for the keyword level stays, as the idle/composing indicator only.** It tells the user the prompt contains the keyword before sending, and it is not an animation, so it does not break the one-animated-glow rule. While a turn runs, hide the ring and show the beam at the max tier; when idle again the ring returns if the keyword is still in the text. Never show ring and beam together. The ring's color comes from the same config as the max tier. Reduced motion: the ring stays and the beam does not animate. Upstream's ring code is not deleted; it is wired into the idle state of the Composer FX slot.
- **Moved-workflow fallout.** The `notify-discord-release` test failure was caused by our workflow move (it passes 22/22 on the pristine snapshot), so it was repointed to `.github/upstream-workflows/release.yml` and the docs that named the old workflow paths were updated. A second test, `build-desktop-artifact.test.ts` ("skips the primary native probe for cross-architecture Windows payloads"), fails on the pristine snapshot too, so it is pre-existing: not fixed, listed as known failing, and not in CI. No silent skips.
- **Node pin.** `.nvmrc` is `24.13.1`, exactly the lower bound of `engines.node` (`^24.13.1`), and CI reads `node-version-file: .nvmrc`. Bumping Node means changing `.nvmrc` and `engines.node` together.
- **Remote.** The human creates the remote and pushes. The agent never pushes. A pre-push checklist and the exact commands are in `HANDOFF.md`.

Decided 2026-10-05 (session 4):

- **Commit identity.** The human confirmed that `5rnkq9b5yf-collab <5rnkq9b5yf@privaterelay.appleid.com>` is theirs, so there is no history rewrite. Polaris is the human's own repo: a snapshot of upstream that never merges from it.
- **"The level sent" is the level id in the turn's `modelSelection`, plus the keyword-in-text override.** The human delegated this ("whatever is best"), so it can be overruled. Reasons: the tier tables are keyed on the names the picker shows, so the beam and the picker agree. The API value after `effortMap` would make one picker label show different colors on different Claude profiles (`max` is sent as `high` on one, `xhigh` as `max` on another) and would contradict the decided rule that `ultracode` is max (it is sent as `xhigh`). The manifest also maps the keyword level to `null` in `effortMap` (`apps/server/src/provider/model-manifest.json`), so the API value cannot identify it at all; the keyword travels in the prompt text. `effortMap` is catalog internals that can change between releases. The beam is a status indicator for the user's choice, not a spend meter. If the selection has no effort option, use the model's default level; if there is none, use the neutral default.
- **General quota** for the quota-low flash is every window other than `kind: "session"`. Confirmed.
- **Cursor rule file: replace, do not fix or delete.** The original is kept at `docs/upstream-cursor-cloud.md` under a banner saying it is upstream's notes and not instructions. `.cursor/rules/cursor-cloud.mdc` is now a five-line pointer to `AGENTS.md`, `HANDOFF.md` and `blueprint.md`. `AGENTS.md` lists the reference copy under References.
- **Fonts must be customizable in v1** (human, mid-session 4: "i also want for the font to be customizable in this version"). Not built or changed: this session is repo hygiene only. Finding: upstream already ships font settings in the web UI, so v1 starts from what exists (see "Fonts: what upstream already has" below). What, if anything, is missing is an open question.

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

| Tier                           | colorVariant | size          | strength | duration | extra                                                                                                                         |
| ------------------------------ | ------------ | ------------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| none                           | n/a          | n/a           | n/a      | n/a      | `active={false}`; thin static border                                                                                          |
| low                            | `mono`       | `pulse-inner` | 0.5      | 2.3      | calm breathing                                                                                                                |
| medium                         | `ocean`      | `md`          | 0.8      | 1.96     | blue-purple                                                                                                                   |
| high                           | `sunset`     | `md`          | 1        | 1.5      | orange-red                                                                                                                    |
| xhigh                          | `sunset`     | `md`          | 1        | 1.3      | **draft, interpolated.** Variants cannot blend, so it keeps `sunset`; `hueRange` and `saturation` about halfway to max's bump |
| max                            | `colorful`   | `md`          | 1        | 1.1      | wider `hueRange` (about 60), a bit more `saturation`                                                                          |
| neutral (fallback, not a tier) | `mono`       | `md`          | 0.6      | 2.0      | steady grey, no hue; animates only while a turn is running; idle stays the thin static border                                 |

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

Mapping rules (decided by the human): off or none → none; minimal or low → low; medium → medium; high → high; extra high → xhigh; max, and any keyword-style level whose name starts with "ultra", → max; a provider with no effort setting → neutral default. These names always win. Only a level name that is not in the table goes through the fallback below.

**Fallback by position.** Take the provider's ordered level list, drop off/none and keyword-style levels, and let n be what is left. If n is 1, the tier is medium. Otherwise p = index / (n − 1) and the tier is ladder[round(p × 4)], where the ladder is low, medium, high, xhigh, max and rounding is half up. The lowest level of a provider always looks low and its highest always max. Clamp, never throw, and log once in dev. A value that cannot be resolved at all gets the neutral default. Worked results (computed, see Decisions):

| n (levels left) | tiers, lowest level first                    |
| --------------- | -------------------------------------------- |
| 1               | medium                                       |
| 2               | low, max                                     |
| 3               | low, high, max                               |
| 4               | low, medium, xhigh, max                      |
| 5               | low, medium, high, xhigh, max                |
| 6               | low, medium, high, high, xhigh, max          |
| 7               | low, medium, medium, high, xhigh, xhigh, max |

Display level versus API level: for some Claude profiles the manifest's `effortMap` sends a different value to the API than the picker shows (for example `xhigh`→`max` on one profile, `max`→`high` on another, and `ultracode`→`xhigh`). The tables above are keyed on the level the picker shows. The beam follows the level sent with the turn (see Decisions); that means the level id in the turn's selection, not the API value after `effortMap` (decided in session 4).

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
- **How it reaches the request** (verified by reading on 2026-10-05; not exercised in a running composer).
  - The web client dispatches the turn with `modelSelection: ctxSelectedModelSelection` (the picker's saved options, `ChatComposer.tsx:2307`; for example at `ChatView.tsx:9516`) and the text from `formatOutgoingPrompt` (`ChatView.tsx:782-791`).
  - Picking the keyword level in the web picker never saves an option; it only edits the prompt text (`TraitsPicker.tsx:346-352`). The mobile picker hides it (`apps/mobile/src/features/threads/thread-settings-options.ts:56`). So in the normal flows the saved effort option is never the keyword level, and the prefix added at send (`ChatView.tsx:782-791`, and the server calls below) fires only if stored data holds the keyword as the effort value, for example legacy data.
  - Typing the keyword in the body changes nothing structured. T3's server has no text detection; the detector (`packages/shared/src/model.ts:302`) is used only by the web composer. The turn goes out with the saved level in `modelSelection` and the keyword inside the text. What Claude does with the word is Claude's behavior and was not checked here. Prompt-history recall strips the prefix (`composerPromptHistory.ts:119`).
- **Where effective effort is resolved on the server.** For Claude it is `compileClaudeModelSelection` in `apps/server/src/claudeModelOptions.ts:28`. It reads the `effort` option, applies the catalog's `effortMap`, and returns `effort` (for the API; `undefined` for the keyword level), `promptEffort` (for the text prefix), `settings` (such as `ultracode`, `fastMode`) and `queryIdentity`. Callers, all in `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts`: `makeClaudeQueryOptions` (`:804`, compiles at `:830` and passes `effort` to the SDK at `:872-876`), the per-turn query setup (`:6923`), and the text prefix (`:7187-7189` and `:7396-7398`). Other adapters each read their own option from the turn's `modelSelection`: Codex `reasoningEffort` at `CodexAdapterV2.ts:718`, OpenCode `variant` at `OpenCodeAdapterV2.ts:3271` and `OpenCode2AdapterV2.ts:755`, Pi `thinking` at `PiAdapterV2.ts:2117`. Grok, Cursor and ACP were not traced. The turn input carries `modelSelection` per turn, so the structured part is already fixed at send. There is no single provider-neutral "effective effort" function yet.
- **The disagreement case.** Saved level `high` and the keyword typed in the body: the picker displays the keyword level, `modelSelection` says `high`, and the text contains the keyword. A beam that follows what is sent therefore needs: effective = (keyword present in the final outgoing text, and the model lists it) ? keyword level : the level in the turn's selection. No function computes that today. Its pieces are the detector (`packages/shared/src/model.ts:302`), `resolvePromptInjectedEffort` (`:495`) and `compileClaudeModelSelection`. The natural place is the Claude adapter at turn start, where the compiled selection and the final text both exist.
- **When the beam is built.** Hide upstream's ring while a turn runs and keep its code. Today its gradient is a hard-coded custom property in `apps/web/src/index.css:2075-2118`, so making it read the max-tier color from the beam config is an edit to upstream CSS.

### Quota-low warning (requested 2026-10-05; not built)

The human's request: when the usage of the provider drops below 20%, make the chat outline shader flash **red**. Not implemented: this session is repo hygiene only, and the composer outline is v2. Read from the code, not exercised:

- **Trigger (decided 2026-10-05).** Remaining quota below 20% on the 5-hour limit or on the general quota; either one. Window kinds are `session`, `weekly`, `monthly` and `other` (`providerUsageLimits.ts:22`); Claude's `five_hour` is `session` (`apps/server/src/provider/Layers/claudeUsageLimits.ts:42`). Confirmed by the human: 5-hour = `session`, general = every other window. How Codex's windows are classified was not checked.
- **The data already exists.** Each provider reports quota windows as `ServerProviderUsageWindow`: `usedPercent` (0 to 100), `resetsAt`, `windowDurationMins` and a `label` (`packages/contracts/src/providerUsageLimits.ts:20-26`). A provider can report several windows. The composer already renders them (`apps/web/src/components/chat/ComposerUsageLimits.tsx`); shared logic is in `packages/shared/src/usageLimits.ts`. Accounts that cannot report windows at all exist (the contract's own note at `:46`), so the rule has to stay silent when there are none.
- **Red is not available in `border-beam`.** It only has the four palettes and no custom hex colors (see the candidates table). Red needs the vendored-with-a-`colors`-prop route described above, or an original shader.
- **Flashing is motion.** It has to honor `prefers-reduced-motion` (static red border instead). Upstream's own rule is "no continuously repainting animations; they peg the GPU on high-refresh displays" (`docs/upstream-AGENTS.md`, "Taste"). A flash that runs for as long as quota stays low runs into that rule.
- **It competes for the composer.** Only one animated effect on the composer at a time (see "Composer FX slot").

## Composer FX slot

Only one animated effect on the composer at a time. Swap with a fade (`active` + `onDeactivate`), never stack.

| Composer state     | Effect                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| idle               | thin static border; upstream's static ring instead while the prompt text contains the keyword level (never together with the beam)                                        |
| agent thinking     | `BorderBeam` at the tier of the level sent with the turn, frozen for that turn (max when the keyword level was sent); neutral default if unresolvable; the ring is hidden |
| voice listening    | `VoiceBeam` driven by `level`                                                                                                                                             |
| voice transcribing | `VoiceBeam` with `processing` on                                                                                                                                          |

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

## Fonts: what upstream already has (v1 requirement)

The human wants fonts customizable in v1. Read from the code at snapshot `3e6b450`; not exercised in a running app this session.

- **Settings** (client settings, `packages/contracts/src/settings.ts:118-152` for the size ranges, `:380-398` for the fields): four families, `fontFamilySans` (interface), `fontFamilyComposer`, `fontFamilyCode` and `fontFamilyTerminal` (empty string means the built-in stack); four sizes in CSS pixels, `fontSizeInterface` 12-20 (default 16), `fontSizePrompt` 12-20 (14), `fontSizeCode` 10-18 (13) and `fontSizeTerminal` 8-20 (12); and `fontSmoothing` (default on, no effect off macOS).
- **Applied** by `FontAppearanceSync` (`apps/web/src/routes/__root.tsx:305`), which calls `applyAppearanceFontVariables` (`apps/web/src/appearanceFonts.ts:99`) to set CSS variables on the document root; `index.css` reads them as `var(--font-sans)` and `var(--font-mono)`. The terminal reads its two settings separately (`apps/web/src/components/ThreadTerminalDrawer.tsx:393-400`).
- **UI**: the settings page (`apps/web/src/components/settings/SettingsPanels.tsx`) with `FontFamilyPicker.tsx` and live previews in `SettingsFontPreviews.tsx`. The picker lists installed fonts through the Local Font Access API (`queryLocalFonts`, Chromium and Electron); where that is unavailable it falls back to a plain family-name text input.
- **Rule for Polaris UI**: new Polaris components must take their fonts from these variables and settings, not a hard-coded `font-family` (see `AGENTS.md`, Conventions).

## Non-goals

Merging upstream. Building our own database or block engine. Forking Obsidian (proprietary). Using tldraw (not MIT).

## Open questions

- Which Discord Application ID and art assets for presence?
- What name and branding for the desktop app?
- Do friends run the desktop build, or `npx` of the fork?
- Port and default settings for the Clide Local API.

### Fonts

- Is upstream's existing font customization what you meant (see "Fonts: what upstream already has"), or do you want more: a bundled Polaris default typeface, loading a font file, or per-theme fonts? A default typeface is tied to the open branding question.
- Which surfaces: web and desktop (where the settings are) only, or mobile too? The mobile app was not checked.

### Quota-low flash

- Does it apply to the provider of the active thread only, or to any provider?
- How long does it flash: a few flashes when the threshold is crossed, or until the quota resets? The second conflicts with upstream's no-continuous-animation rule.
- While it is active, does it override the tier beam, or share the composer slot some other way?
- Is the 20% threshold fixed or a setting?

### Other open items found in the code (snapshot `3e6b450`)

- **Voice provider interface.** Plug into upstream's `VoiceTranscriber` and controller (`packages/client-runtime/src/voice-input/`), or stay separate? The facts are in `HANDOFF.md`.
- **Cursor provider.** You said your friends do not use it. It is left in the code untouched. Counted with `git grep -il cursor` over `apps packages infra scripts native`: 561 files mention the word in any case (363 outside tests), which includes unrelated uses such as text cursors and pagination cursors; 32 files name the provider directly (`cursor-agent`, `CursorProvider`, `cursorAgent`, `CursorDriver`), a narrow pattern, so a lower bound. Removing it would touch many files of upstream code. Keep it as is, or remove it from the app in a separate change?
- **T3 Code's git text generation reads the repo's `AGENTS.md`** when the style is "repo conventions" (`apps/server/src/git/GitManager.ts`). With a Claude writer it also reads `CLAUDE.md`, which is now a symlink, so the same text is included twice (upstream's `CLAUDE.md` was just `@AGENTS.md`). Acceptable?
