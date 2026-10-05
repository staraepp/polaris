# ref.md — Polaris research links

Checked 2026-10-05. Treat as starting points; re-verify before relying on a detail.

## T3 Code
- Repo: https://github.com/pingdotgg/t3code (MIT)
- Upstream AGENTS.md (architecture): https://github.com/pingdotgg/t3code/blob/main/AGENTS.md
- Releases (providers, ACP registry, T3 MCP): https://github.com/pingdotgg/t3code/releases
- Unmerged plugin host stack (reference only): https://github.com/pingdotgg/t3code/pull/16055
- Local app integration SDK RFC: https://github.com/pingdotgg/t3code/discussions/6977
- Pi-style extension API proposal: https://github.com/pingdotgg/t3code/discussions/6837

## Discord Rich Presence
- Discord docs, rich presence without authentication: https://discord.com/developers/docs/discord-social-sdk/development-guides/setting-rich-presence
- Pattern to copy (opt-in, silent when Discord is absent, backoff reconnect): https://github.com/preschian/agentcord/pull/156
- Common Node library: `@xhayper/discord-rpc`
- Requirements: Discord desktop client running; registered Application ID; web client cannot do it.

## Planning suite
- AFFiNE (Notion + whiteboard): https://github.com/toeverything/AFFiNE
- BlockSuite (editor framework, MPL-2.0): https://github.com/toeverything/blocksuite
- Excalidraw props (`renderEmbeddable`, `customData`): https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api/props
- tldraw license caveats: https://meetrix.io/blogs/open-source-whiteboard-tools/

## Chatbox outline shaders
- border-beam (MIT; web, React Native, SwiftUI ports): https://github.com/jakubantalik/border-beam
- Magic UI Border Beam (MIT; props table): https://magicui.design/docs/components/border-beam
- Paper Shaders (Apache-2.0; WebGL): https://github.com/paper-design/shaders
- Paper mesh gradient props: https://shaders.paper.design/mesh-gradient
- react-native-animated-glow (MIT; Skia): https://libraries.io/npm/react-native-animated-glow
- Pure CSS animated gradient border: https://codetv.dev/blog/animated-css-gradient-border
- CSS glow layer walkthrough: https://theosoti.com/blog/animated-gradient-borders/
- Preview more border components: https://21st.dev/community/components/s/border
- Shadertoy license warning (default CC BY-NC-SA 3.0): https://www.jwz.org/blog/2025/12/what-are-your-favorite-shadertoys/

## Libraries.dev effects (MIT on npm; Studio/Pro optional)
- Site: https://libraries.dev · Repo: https://github.com/Jakubantalik/Libraries.dev
- border-beam README (props): https://raw.githubusercontent.com/Jakubantalik/Libraries.dev/main/packages/border-beam/README.md
- voice-glow README (level, processing, colors): https://raw.githubusercontent.com/Jakubantalik/Libraries.dev/main/packages/voice-glow/README.md
- bot-avatars README: https://raw.githubusercontent.com/Jakubantalik/Libraries.dev/main/packages/bot-avatars/README.md
- liquid-gooey: https://gooey.jakubantalik.com · https://www.npmjs.com/package/liquid-gooey
- Pricing (Studio is paid, libraries are free): https://libraries.dev/pro.html
- Each library page has a "Copy prompt" button that hands an agent the parameter vocabulary.

## Clide and OpenAI-compatible transcription
- Clide site and docs: https://clide.staraep.fun · https://clide.staraep.fun/docs
- Clide repo (MIT): https://github.com/staraepp/clide_stt
- Servers that already speak `POST /v1/audio/transcriptions` (test the shape against these): https://github.com/fedirz/faster-whisper-server (now Speaches) · whisper.cpp server: https://github.com/erwins-enkel/shepherd-plugin-voice-whisper/issues/16

## AGENTS.md practice
- Factory docs: https://docs.factory.ai/cli/configuration/agents-md
- Best practices summary: https://github.com/devskale/skale-skills/blob/main/docs/agents-md-best-practices.md
- Builder.io tips: https://www.builder.io/blog/agents-md

## Other
- DeepSeek Harness (ideas to borrow, not code): https://habr.com/en/articles/1070958/
