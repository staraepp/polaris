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

**Color per thinking effort (draft; tune after seeing it).** Cool to warm as effort rises. Keep it in one config object so users can edit it. `duration` is the cycle time in seconds, so lower = faster. Map whatever effort levels the composer actually exposes (verify the names per provider).

| Effort | colorVariant | size          | strength | duration | extra                                                |
| ------ | ------------ | ------------- | -------- | -------- | ---------------------------------------------------- |
| none   | n/a          | n/a           | n/a      | n/a      | `active={false}`; thin static border                 |
| low    | `mono`       | `pulse-inner` | 0.5      | 2.3      | calm breathing                                       |
| medium | `ocean`      | `md`          | 0.8      | 1.96     | blue-purple                                          |
| high   | `sunset`     | `md`          | 1        | 1.5      | orange-red                                           |
| max    | `colorful`   | `md`          | 1        | 1.1      | wider `hueRange` (about 60), a bit more `saturation` |

If four palettes are not enough or exact hex per effort is wanted, vendor `border-beam` into the repo (MIT, keep the license) and add a `colors` prop like `voice-glow` has. Do not use a CSS `hue-rotate` hack unless it looks right.

`border-beam`'s pulse types honor `prefers-reduced-motion` themselves. Its rotate types do NOT; add the reduced-motion handling ourselves.

**Rules.**

- Honor `prefers-reduced-motion` (fall back to a static border).
- One glowing element per view (the active composer only). Blurred conic layers are expensive.
- Do not clip the halo with `overflow: hidden`.
- Ship a static fallback for engines without `@property`.

**Spike first.** Prototype two options on an isolated page. Pick by look and frame rate on the target machines. Record the result in `HANDOFF.md`.

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
- Which exact effort levels does the composer expose per provider (for the color table)?
- Port and default settings for the Clide Local API.

### Found in the code, 2026-10-05 (snapshot `3e6b450`; facts recorded, decisions open)

- **Effort vocabularies differ per provider, and so does the option id.** The contract treats effort as an open string (`packages/contracts/src/providerRuntime.ts`). The picker is `apps/web/src/components/chat/TraitsPicker.tsx`. Read from source, not seen in a running app:
  - Claude, option `effort`, per model in `apps/server/src/provider/model-manifest.json`. Sets seen: `low,medium,high,max`; `+ultrathink`; `+xhigh,ultrathink`; `+xhigh,ultracode,ultrathink`. `ultrathink` is injected into the prompt and is not an API effort level (`effortMap: null`). `ultracode` maps to `xhigh`.
  - Codex, option `reasoningEffort`, from the live `model/list` response at runtime. Labels the adapter knows: `none, minimal, low, medium, high, xhigh, max, ultra` (`Layers/CodexProvider.ts`).
  - OpenCode, option `variant` (labeled "Reasoning"), from each model's variants. Fallback: `low, medium, high, xhigh`.
  - Pi, option `thinking`: `off, minimal, low, medium, high, xhigh, max` (`Layers/piThinkingCapabilities.ts`).
  - Grok, option `reasoningEffort`: whatever the agent advertises at runtime.
  - Cursor: from SDK model parameters at runtime (`effort` / `reasoning` / `thinking`, `cursorSdkModel.ts`).
  - Antigravity: thinking levels are part of the model ID; there is no separate effort option.
  - ACP registry: whatever the agent's session config exposes.
  - Questions: how do `minimal`, `xhigh`, `ultra`, `ultrathink` and `ultracode` map onto the 5-row beam table (none/low/medium/high/max)? What do providers with runtime-only vocabularies, or no effort option, show?
- **Upstream already has a Usage panel** (`docs/user/usage.md`, `apps/server/src/usage/`): tokens, cache savings, model breakdown, estimated cost and trends across providers. Does v1 item 3 extend that panel, or build a separate one?
- **Upstream already has a voice-input controller** (`docs/internals/voice-input.md`, `packages/client-runtime/src/voice-input/`). Transcription currently runs only on iOS, locally, and edits the draft without sending it. Should the Polaris voice provider interface plug into this controller as a transcriber, or stay separate?
- **Upstream CI comes with the fork**: 18 workflows in `.github/workflows/` (release, relay deploy, mobile EAS, PR vouch/triage bots). Keep, disable, or delete them before pushing to a new remote?
- **`.cursor/rules/cursor-cloud.mdc`** is a Cursor-Cloud-only setup note (with `.mdc` frontmatter), not a copy of `AGENTS.md`, so it was left as is rather than symlinked. Parts of it disagree with upstream's own rules (it says `npm run dev` auto-wires `VITE_HTTP_URL`). Keep, delete, or replace it?
- **Links into `AGENTS.md` anchors now dangle.** `CONTRIBUTING.md`, `docs/README.md` and `docs/operations/development.md` link to `AGENTS.md#documentation` / `#test-data`, which only existed in upstream's file. Repo-relative links inside `docs/upstream-AGENTS.md` now resolve from `docs/`. Fix these upstream docs, or leave them untouched?
- **Node version**: `engines` requires Node `^24.13.1`. This machine ran Node 26.8.1, and install and checks worked with an "Unsupported engine" warning. Add a `.nvmrc` / `.node-version` for friends?
- **T3 Code's git text generation reads the repo's `AGENTS.md`** when the style is "repo conventions" (`apps/server/src/git/GitManager.ts`). With a Claude writer it also reads `CLAUDE.md`, which is now a symlink, so the same text is included twice (upstream's `CLAUDE.md` was just `@AGENTS.md`). Acceptable?
