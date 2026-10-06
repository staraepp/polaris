// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (
    select: (settings: { botAvatarByDriver: Record<string, string> }) => unknown,
  ) => select({ botAvatarByDriver: { codex: "cat" } }),
}));

vi.mock("bot-avatars", () => ({
  BotAvatar: (props: { type: string; state: string; paused: boolean; "aria-label": string }) => (
    <canvas
      data-type={props.type}
      data-state={props.state}
      data-paused={props.paused}
      aria-label={props["aria-label"]}
    />
  ),
}));

const { ThreadBot } = await import("./ThreadBot");

describe("ThreadBot", () => {
  let renderer: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (running: boolean, lastActivityAt: number | null) => {
    await act(async () => {
      renderer.render(
        <ThreadBot
          driver="codex"
          providerLabel="Codex"
          running={running}
          waitingOnUser={false}
          lastActivityAt={lastActivityAt}
          theme="dark"
        />,
      );
    });
    // The avatar is lazy-loaded.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return container.querySelector("canvas");
  };

  it("uses the user's pick and works during a run", async () => {
    const canvas = await render(true, null);
    expect(canvas?.dataset.type).toBe("cat");
    expect(canvas?.dataset.state).toBe("working");
    expect(canvas?.getAttribute("aria-label")).toBe("Codex is working");
    expect(canvas?.dataset.paused).toBe("false");
  });

  it("dozes on a thread that has been quiet for a while", async () => {
    const canvas = await render(false, Date.now() - 2 * 60 * 60 * 1000);
    expect(canvas?.dataset.state).toBe("sleeping");
    expect(canvas?.getAttribute("aria-label")).toBe("Codex is resting");
  });
});
