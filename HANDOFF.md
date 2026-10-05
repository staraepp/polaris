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
- v1 progress (`blueprint.md` "v1 scope"): item 1 (agent-friendly repo) done, pending the human decisions below. Items 2 and 3 not started.

## Entries

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
