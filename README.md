# Polaris

A desktop home for your coding agents. Polaris runs Claude Code, Codex, OpenCode, Cursor, Grok Build and Google Antigravity side by side, with your own subscriptions, and wraps them in a calmer, more personal workspace.

Polaris is an open-source hard fork of [T3 Code](https://github.com/pingdotgg/t3code) by T3 Tools (MIT). It started from upstream commit `3e6b450` and is developed separately; it does not track upstream.

## Download

| Platform              | Link                                                                             |
| --------------------- | -------------------------------------------------------------------------------- |
| macOS (Apple Silicon) | [Polaris-mac.dmg](https://polaris.sstarvfx.com/download/Polaris-mac.dmg)         |
| Windows (x64)         | [Polaris-windows.exe](https://polaris.sstarvfx.com/download/Polaris-windows.exe) |

Both links always point to the newest release. The builds are not code-signed yet, so the first launch needs one extra step:

- **macOS:** open the dmg and drag **Polaris (Alpha)** into Applications. The first time, right-click the app and choose **Open**, then **Open** again. If macOS says the app is damaged, run `xattr -dr com.apple.quarantine "/Applications/Polaris (Alpha).app"` in Terminal.
- **Windows:** SmartScreen shows "Windows protected your PC". Click **More info**, then **Run anyway**.

In-app updates come from a private feed and need an invite code (Settings → General → Updates). Without one, download the new version from the links above.

## Before you start

Polaris drives the agent CLIs already on your computer. Install and sign in to at least one:

- Claude Code: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
- Codex: install the [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
- OpenCode: install [OpenCode](https://opencode.ai), run `opencode auth login`, then turn it on in Settings → Providers
- Cursor: install the [Cursor CLI](https://cursor.com/cli) and run `agent login`
- Grok Build: install the [Grok Build CLI](https://x.ai/cli) and run `grok login`
- Google Antigravity: turn it on in Settings, then use **Install Antigravity** and **Sign in with Google**

## What Polaris adds

- **A dashboard as home.** A greeting, the thread that is waiting on you, first steps, and widgets you can move, resize and remove (recent threads, usage, pull requests, notes, links).
- **Calm mode.** A quieter look with warm neutrals, fewer words and no decorative motion (Settings → Appearance → Calm, or the command palette).
- **Workspace.** Docs with a "/" menu and Markdown export, and Excalidraw whiteboards. They are stored in this app on your computer.
- **Usage.** What each provider costs, tokens over time, how much of each limit is left, and a warning when a quota runs low.
- **Composer effects.** A beam whose color follows the thinking effort, and real shader flames at the top thinking level. All of it respects Reduce Motion and turns off in Calm mode.
- **Orbie.** A small bot for the assistant and for each project, with thinking orbs while an agent works.
- **Make it yours.** Per-theme fonts, your own image or video background, and icons for chats.
- **Voice input.** Dictate into the composer through [Clide](https://github.com/staraepp/clide_stt) or any OpenAI-compatible transcription server.
- **Import your history.** Bring in sessions from Claude Code, Codex and OpenCode, and threads from the T3 Code app. Their files are only read, never changed.
- **Skill studio and Tools hub.** Write agent skills (`SKILL.md`) from templates, and find the extra tools in one place.

Everything runs on your machine. Polaris talks to the providers you sign in to and, for updates, to its update feed.

## Build from source

You need macOS or Linux, [Node.js 24.13.1](./.nvmrc) and [pnpm](https://pnpm.io) 11.

```sh
pnpm install
node scripts/polaris-dev.mjs start    # isolated dev stack in a temporary home; prints the pairing URL
node scripts/polaris-dev.mjs stop <pgid>
```

The dev stack keeps its state in a temporary folder, so it never touches an installed Polaris or T3 Code. Open the printed `pairingUrl` once in your browser.

Checks, with the repository's own tools in `node_modules/.bin`:

```sh
node_modules/.bin/vp fmt
node_modules/.bin/vp lint
cd apps/web && ../../node_modules/.bin/vp test run
```

Packaging the desktop app (needs Rust 1.95):

```sh
# macOS Apple Silicon: writes release/Polaris-<version>-arm64.dmg
RUSTUP_TOOLCHAIN=1.95.0 node_modules/.bin/vp run dist:desktop:dmg:arm64

# Windows x64, cross-built on a Mac (needs cargo-xwin): writes release/Polaris-<version>-x64.exe
XWIN_ACCEPT_LICENSE=1 RUSTUP_TOOLCHAIN=1.95.0 node scripts/build-desktop-artifact.ts --platform win --target nsis --arch x64
```

Set `POLARIS_UPDATE_FEED=off` to build without the private update feed.

## Repository map

| Path           | What lives there                                                      |
| -------------- | --------------------------------------------------------------------- |
| `apps/web`     | The React app (most Polaris features are in `apps/web/src/polaris/`)  |
| `apps/server`  | The local server that runs the agents (Effect, SQLite)                |
| `apps/desktop` | The Electron shell, packaging and updates                             |
| `packages/`    | Shared contracts, client runtime and helpers                          |
| `infra/`       | The update server's configuration                                     |
| `docs/`        | Upstream's user and internals docs, still mostly accurate for Polaris |
| `AGENTS.md`    | How to work on this repository (for people and coding agents)         |

Internal package names (`@t3tools/*`, the `t3` server) are kept from upstream on purpose.

## Contributing

Polaris is a personal project shared in the open. Issues and small pull requests are welcome; read [AGENTS.md](./AGENTS.md) first for the conventions and checks. For bugs in T3 Code itself, please go to [upstream](https://github.com/pingdotgg/t3code).

## License

[MIT](./LICENSE). Copyright T3 Tools Inc. for T3 Code, and staraepp for the Polaris changes. Third-party notices for bundled code are kept next to that code (for example `apps/web/src/polaris/vendor/border-beam/NOTICE.md`).
