# AGENTS.md — Polaris

Polaris is a personal **hard fork** of T3 Code (MIT), a GUI that wraps coding-agent CLIs. It is meant to be easy for friends and their agents to fork and change.

Read this file first, then `HANDOFF.md` (current state) and `blueprint.md` (plan). **Before touching server code, read [`docs/upstream-AGENTS.md`](docs/upstream-AGENTS.md)** (upstream's architecture notes, Effect rules, and dev-server safety rules). It is kept unchanged, so read its links as relative to the repo root. Do not delete or rewrite it.

## Commands

Requires Node 24.13.1: `.nvmrc` pins exactly `24.13.1`, the lower bound of `engines.node` (`^24.13.1`), and CI reads `.nvmrc`. **Bumping Node means changing `.nvmrc` and `engines.node` together.** On macOS: `brew install fnm && fnm install 24.13.1`, then `fnm exec --using=24.13.1 <cmd>` (with a global `vp`, its Node shim checks `engines` before `.nvmrc`, so it may pick a newer 24.x). You also need the global `vp` (Vite+) CLI: `curl -fsSL https://vite.plus | bash`. Without a global `vp`, run `pnpm install` once (pnpm 11.10.0, lockfile `pnpm-lock.yaml`), then use `node_modules/.bin/vp`. Run everything from the repo root. `vpr <script>` is short for `vp run <script>`.

Status column: checked 2026-10-05 on Node 24.13.1 (CI's version) unless noted.

| Command                                            | What it does                                                                       | Status                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `vp i`                                             | Install deps; also installs the `vp staged` pre-commit hook (formats staged files) | verified: exit 0                                                               |
| `vp run --filter <pkg-name> typecheck`             | Typecheck one package (names below)                                                | verified, exit 0: contracts, shared, client-runtime, `t3`, web, desktop        |
| `vp test run <path/to/file.test.ts>`               | Run one test file (Vitest via Vite+)                                               | verified: one `packages/shared` and one `apps/server` file passed              |
| `vp run --filter <pkg-name> test`                  | Run one package's whole suite                                                      | verified: contracts 510 tests, shared 1,105, client-runtime 1,998 (≤10 s each) |
| `vp run --filter @t3tools/scripts test`            | Whole scripts suite                                                                | 337 passed, **1 known failing**: see Known failing                             |
| `vp lint --report-unused-disable-directives`       | Lint (= `vp run lint`)                                                             | verified: exit 0, 0 errors, 850 existing warnings, about 7 s                   |
| `vp fmt --check`                                   | Format check, includes Markdown. Fix with `vp fmt <files>`                         | verified: exit 0                                                               |
| `vp run dev --home-dir /tmp/polaris-dev`           | Server + web dev (`scripts/dev-runner.ts`)                                         | verified on 24.21.0: boots, see "Dev boot" below                               |
| `vp run --filter @t3tools/desktop ensure:electron` | Make sure the Electron binary is present (CI runs it before typecheck)             | verified: exit 0                                                               |
| `vp run dev:desktop`                               | Electron dev client                                                                | script exists; not run                                                         |
| `vp run migrate-dev-db`                            | Seed dev DB from a read-only copy of real data (see upstream notes)                | script exists; not run                                                         |
| `vp run knip:check`                                | Unused files, deps and exports                                                     | script exists; not run                                                         |
| `vp run build:desktop`                             | Desktop build. Only when asked                                                     | script exists; not run                                                         |
| `vp run release:smoke`                             | Release smoke test (`node scripts/release-smoke.ts`)                               | script exists; not run                                                         |

Package names for `--filter`: `t3` (apps/server), `@t3tools/web`, `@t3tools/desktop`, `@t3tools/mobile`, `@t3tools/marketing`, `@t3tools/contracts`, `@t3tools/client-runtime`, `@t3tools/shared`, `@t3tools/ssh`, `@t3tools/tailscale`, `effect-acp`, `effect-codex-app-server`, `t3code-relay` (infra/relay), `@t3tools/scripts`.

Prefer file-scoped commands. Do **not** run repo-wide `vp check`, `vp run test` or `vp run typecheck` unless asked (upstream rule). CI is `.github/workflows/ci.yml`: exactly the verified commands above (format, lint, six typechecks, three package test suites, and `scripts/notify-discord-release.test.ts`). Upstream's workflows are inert reference copies in `.github/upstream-workflows/`.

Known failing (pre-existing, not fixed): `scripts/build-desktop-artifact.test.ts` > `build-desktop-artifact` > `skips the primary native probe for cross-architecture Windows payloads` (`AssertionError: expected true to be false`, line 1595). It fails the same way on the pristine snapshot `3e6b450` (checked in a throwaway worktree, macOS arm64, Node 24.13.1); not checked on Linux. It is not in CI, which does not run the whole `scripts` suite. Do not skip it silently: if you fix or remove it, update this line.

### Dev boot

`vp run dev --home-dir /tmp/polaris-dev` starts the server on `127.0.0.1:13773` and Vite on `localhost:5733` (read the real ports from the `[dev-runner]` line). The first page load took about a minute while Vite optimized dependencies. The browser then shows "Pair with this environment": open the `pairingUrl:` printed in the log once. The boot needed no `.env` and no sign-in. Upstream's README says at least one provider CLI must be installed and signed in to run an agent; that was not tested here.

Use `--home-dir` so state stays out of `~/.t3`; never point a dev server at the live `~/.t3/userdata`. To stop it, kill the PIDs you started: SIGTERM to the `vp` wrapper left the dev-runner, Vite and the server running, so each had to be stopped by PID. Ctrl-C in a terminal was not tested. Never kill by name pattern.

## Layout

- `apps/server` (`t3`): Node WebSocket server. Entry `src/bin.ts`. Orchestration in `src/orchestration-v2/` (start at `Orchestrator.ts`). Provider drivers in `src/provider/Drivers/*Driver.ts` (registered in `src/provider/builtInDrivers.ts`). Model and option snapshots (including effort levels) in `src/provider/Layers/*Provider.ts`; the Claude catalog is `src/provider/model-manifest.json`. Usage and cost in `src/usage/`.
- `apps/web`: React/Vite UI. Composer in `src/components/chat/` (`ChatComposer.tsx`, `TraitsPicker.tsx`). UI primitives in `src/components/ui/`. Settings in `src/components/settings/`.
- `apps/desktop`: Electron shell around web. `src/main.ts`, `src/preload.ts`, IPC in `src/ipc/`.
- `apps/mobile`: React Native (Expo). `apps/marketing`: marketing site.
- `packages/contracts`: Effect Schema types for everything on the wire. `packages/client-runtime`: client logic shared by web and mobile. `packages/shared`: runtime utils (subpath exports, no barrel). `packages/effect-acp`, `packages/effect-codex-app-server`: provider protocol clients. `packages/ssh`, `packages/tailscale`: remote access.
- `infra/relay`: T3 Connect relay. `native/`: C/Rust helpers (resource monitor, Linux snap-shot, browser secret). `scripts/`: dev runner, build and release scripts. `oxlint-plugin-t3code/`: custom lint rules.
- `.repos/`: vendored read-only references (`effect-smol`, `alchemy-effect`). Never edit or import from them.
- `docs/internals/` (start at `overview.md`, `glossary.md`, `effect-services.md`), `docs/user/`, `docs/operations/`, `docs/orchestration-v2/`. Read the matching doc before changing a subsystem.
- `.agents/skills/` (also at `.claude/skills`): upstream skills `test-t3-app`, `test-t3-mobile`, `contribution-triage`.
- `.github/workflows/ci.yml`: Polaris CI. `.github/upstream-workflows/`: upstream's workflows, inert.
- Polaris docs at the root: `AGENTS.md` (`CLAUDE.md` is a symlink to it), `HANDOFF.md`, `blueprint.md`, `ref.md`, `clide-api-spec.md`.

## How it works

Clients send typed WebSocket requests. The server turns them into commands. The orchestrator decides events without doing I/O. One transaction commits the events, the projections the UI reads, and outbox effects. An effect worker then runs those effects (start a provider turn, capture a checkpoint) and feeds results back as commands. Provider CLIs run as subprocesses, and per-provider adapters translate their protocols into events. Details: `docs/internals/overview.md`. The server may be remote, so anything that must run on the user's own machine (like Discord presence) belongs in the desktop shell.

## Ground rules

- Upstream snapshot: `pingdotgg/t3code` at `3e6b45028ceec5820dacb37dc3852470ebdc9411` (2026-10-05). The git remote `upstream-snapshot` is reference-only. We do **not** merge upstream. Do not restyle upstream code.
- Keep upstream's `LICENSE` and attribution intact.
- No repo-wide rename or rebrand. Compatibility identifiers (`t3.json`, `.t3`, `T3CODE_*` env vars, package names) must keep working.
- Put new Polaris code in clearly named files or folders (for example `polaris/` subfolders) so fork code is easy to tell from upstream code.
- Small diffs. One feature per branch. Update docs in the same change.

## Conventions

- TypeScript throughout. The server is Effect-heavy: read `docs/internals/effect-services.md` and `.repos/effect-smol/LLMS.md` before writing Effect code. Do not add a second DI or plugin framework.
- A provider-shaped feature needs a decision per driver (Codex, Claude, Cursor, Grok, OpenCode, Antigravity, Pi, ACP registry), even if the decision is "not supported here".
- Keep UI customizable: colors, spacing and behavior come from settings or theme tokens, not hard-coded values.

## Boundaries

- Do: reuse existing components and helpers; add or update a test with every behavior change; update `HANDOFF.md` before ending a session.
- Ask first: adding a dependency, changing the database schema, touching more than one provider adapter, or anything that sends data off the user's machine.
- Never: commit secrets, tokens or API keys; put repo, thread or file names into Discord presence; copy a shader or component without checking its license (Shadertoy defaults to CC BY-NC-SA 3.0, so only use CC0 or CC BY, or write our own); modify files outside the task's scope.

## Polaris-specific rules

- Discord Rich Presence: desktop shell only, **off by default**, silent if Discord is not running, generic text only (for example "Coding with Polaris").
- Effects: only the MIT packages named in `blueprint.md`. One animated glow on the composer at a time. Honor `prefers-reduced-motion`.
- Voice: talk to Clide only through `clide-api-spec.md` (read its "Using the API" section first), from the desktop main process. Store the token with Electron `safeStorage`, never in plain settings JSON or the renderer. Voice must work without Clide installed.
- Agent-friendliness is a feature. If you change how something works, update this file or `docs/`. A stale instruction file is worse than none.
