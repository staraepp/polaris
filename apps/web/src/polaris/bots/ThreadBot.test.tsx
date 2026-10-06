// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const settings = { botAccessory: "bowTie", botShape: "mixed", botColors: "varied" };
vi.mock("~/hooks/useSettings", () => ({
  useClientSettings: (select: (value: typeof settings) => unknown) => select(settings),
}));

vi.mock("bot-avatars", () => ({
  BotAvatar: (props: {
    type: string;
    state: string;
    paused: boolean;
    bowTie?: boolean;
    "aria-label"?: string;
  }) => (
    <canvas
      data-type={props.type}
      data-state={props.state}
      data-paused={props.paused}
      data-bow-tie={props.bowTie === true}
      aria-label={props["aria-label"]}
    />
  ),
}));

const { ThreadBot } = await import("./ThreadBot");
const { botTypeFor } = await import("./botLook");

describe("ThreadBot (Orbie)", () => {
  let renderer: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const render = async (props: {
    running: boolean;
    waitingOnUser?: boolean;
    lastActivityAt?: number | null;
    project?: string | null;
  }) => {
    await act(async () => {
      renderer.render(
        <ThreadBot
          running={props.running}
          waitingOnUser={props.waitingOnUser ?? false}
          lastActivityAt={props.lastActivityAt ?? null}
          tier="medium"
          project={props.project ?? null}
        />,
      );
    });
    // The avatar is lazy-loaded.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return container.querySelector("canvas");
  };

  it("is the round Orbie, working and animated during a run, wearing the chosen accessory", async () => {
    const canvas = await render({ running: true });
    expect(canvas?.dataset.type).toBe("circle");
    expect(canvas?.dataset.state).toBe("working");
    expect(canvas?.getAttribute("aria-label")).toBe("Orbie is working");
    expect(canvas?.dataset.paused).toBe("false");
    expect(canvas?.dataset.bowTie).toBe("true");
  });

  it("is the project's own bot in a project's thread (V 4.5.0)", async () => {
    const canvas = await render({ running: false, project: "Website" });
    expect(canvas?.dataset.type).toBe(botTypeFor("Website", "mixed"));
  });

  it("sleeps while the thread waits on you or has gone quiet", async () => {
    expect((await render({ running: false, waitingOnUser: true }))?.dataset.state).toBe("sleeping");
    const stale = await render({ running: false, lastActivityAt: Date.now() - 2 * 60 * 60 * 1000 });
    expect(stale?.dataset.state).toBe("sleeping");
    expect(stale?.getAttribute("aria-label")).toBe("Orbie is resting");
  });

  it("is awake while idle", async () => {
    expect((await render({ running: false, lastActivityAt: Date.now() }))?.dataset.state).toBe(
      "default",
    );
  });
});
