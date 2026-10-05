# AGENTS.md — Polaris

Polaris is a personal **hard fork** of T3 Code (a GUI that wraps coding-agent CLIs). It adds features, themes and built-in skills, and it is meant to be easy for friends (and their agents) to fork and change.

Read this file first. Then read `HANDOFF.md` (current state) and `blueprint.md` (plan). Keep this file short; deep detail lives in `docs/`.

## Ground rules

- Upstream is a snapshot at `<UPSTREAM_SHA>` (fill in when the fork is created). We do **not** merge upstream. Do not rewrite upstream code just to restyle it.
- Upstream is MIT. Keep its LICENSE and attribution intact.
- Upstream ships its own agent notes (architecture, Effect rules). They are kept at `docs/upstream-AGENTS.md`. Read them before touching server code. Do not delete them.
- Put new Polaris code in clearly named files or folders (for example `polaris/` subfolders) so a reader can tell fork code from upstream code.
- Small diffs. One feature per branch. Update docs in the same change.

## Commands

Verified from upstream PR descriptions; confirm against `package.json` and fix this list if it drifts.

```
vp run dev                                  # run the app in dev
vp run --filter <pkg> typecheck             # typecheck one package
vp test run <path/to/file.test.ts>          # run one test file
vp lint --report-unused-disable-directives  # lint
vp fmt --check                              # format check
vp run knip:check                           # unused code check
vp run build:desktop                        # desktop build
node scripts/release-smoke.ts               # release smoke test
```

Prefer file-scoped commands. Run the full build only when asked.

## Layout (from upstream; verify)

- `apps/server` — Node WebSocket server. Wraps provider CLIs, turns requests into commands, persists events.
- `apps/web` — web client. `apps/desktop` — Electron shell around web (IPC lives here). `apps/mobile` — React Native.
- `packages/client-runtime` — client logic shared by web and mobile. `packages/contracts` — shared types and RPC shapes.
- `docs/user`, `docs/internals` — read the matching doc before changing a subsystem.

## How it works (one paragraph)

Clients send typed WebSocket requests. The server turns them into commands, a pure decider turns commands into persisted events, and a projector builds the read model the UI renders. Provider CLIs run as subprocesses; per-provider adapters translate their protocols into events. The server may be remote, so anything that must run on the user's own machine (like Discord presence) belongs in the desktop shell, not the server.

## Conventions

- TypeScript throughout. The server is Effect-heavy: read the Effect docs vendored in the repo (if present) before writing Effect code. Do not mix in a second DI or plugin framework.
- A provider-shaped feature needs a decision per adapter, even if the decision is "not supported here".
- Keep UI customizable: colors, spacing and behavior come from settings or theme tokens, not hard-coded values.

## Boundaries

Do:
- Check an existing component or helper before writing a new one.
- Add or update a test with every behavior change.
- Update `HANDOFF.md` before ending a session.

Ask first:
- Adding a dependency, changing the database schema, or touching more than one provider adapter.
- Anything that sends data off the user's machine.

Never:
- Commit secrets, tokens, or API keys. Never put them in this file.
- Put repo, thread, or file names into Discord presence.
- Copy a shader or component without checking its license. Shadertoy shaders default to CC BY-NC-SA 3.0; only use ones marked CC0 or CC BY, or write our own.
- Modify files outside the task's scope "while you're there".

## Polaris-specific rules

- Discord Rich Presence: desktop shell only, **off by default**, silent if Discord is not running, generic text only (for example "Coding with Polaris").
- Effects: use only the MIT packages named in `blueprint.md`. One animated glow on the composer at a time. Honor `prefers-reduced-motion` (border-beam's rotate types need us to add it).
- Voice: talk to Clide only through its documented local API (`clide-api-spec.md`), from the desktop main process, with the token encrypted via Electron `safeStorage` (main process only; never in plain settings JSON, never in the renderer). Voice must work without Clide installed. Before writing voice code, read the "Using the API" section of `clide-api-spec.md`.
- Agent-friendliness is a feature. If you change how something works, update `AGENTS.md` or `docs/` so the next agent is not misled. A stale instruction file is worse than none.

## References

- Plan: `blueprint.md` · State: `HANDOFF.md` · Links and research: `ref.md`
