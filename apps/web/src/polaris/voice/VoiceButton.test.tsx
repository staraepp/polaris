// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import type { VoiceInput, VoicePhase } from "./useVoiceInput";
import { VoiceButton } from "./VoiceButton";

vi.mock("~/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({
    render,
    children,
  }: {
    render: React.ReactElement;
    children: React.ReactNode;
  }) => <render.type {...(render.props as object)}>{children}</render.type>,
  TooltipPopup: () => null,
}));

describe("VoiceButton", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  let now = 0;
  const voice = (phase: VoicePhase): VoiceInput => ({
    phase,
    error: null,
    glow: null,
    level: () => 0,
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    cancel: vi.fn(),
  });
  const render = (value: VoiceInput) => act(() => renderer.render(<VoiceButton voice={value} />));
  const button = () => container.querySelector("button")!;
  const pointer = (type: string) =>
    act(() => {
      button().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, detail: 1 }));
    });

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.spyOn(performance, "now").mockImplementation(() => now);
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("transcribes on release after a hold", async () => {
    const idle = voice("idle");
    await render(idle);
    now = 0;
    await pointer("pointerdown");
    expect(idle.start).toHaveBeenCalledOnce();
    now = 900;
    await pointer("pointerup");
    expect(idle.stop).toHaveBeenCalledOnce();
  });

  it("keeps listening after a quick click and stops on the next press", async () => {
    const idle = voice("idle");
    await render(idle);
    now = 0;
    await pointer("pointerdown");
    now = 100;
    await pointer("pointerup");
    expect(idle.stop).not.toHaveBeenCalled();
    const listening = voice("listening");
    await render(listening);
    expect(button().getAttribute("aria-pressed")).toBe("true");
    await pointer("pointerdown");
    expect(listening.stop).toHaveBeenCalledOnce();
  });

  it("toggles from the keyboard and cancels on Escape", async () => {
    const idle = voice("idle");
    await render(idle);
    await act(() => {
      button().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
    });
    expect(idle.start).toHaveBeenCalledOnce();
    const listening = voice("listening");
    await render(listening);
    await act(() => {
      button().dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(listening.cancel).toHaveBeenCalledOnce();
    await render(voice("transcribing"));
    expect(button().disabled).toBe(true);
    expect(button().getAttribute("aria-label")).toBe("Transcribing");
  });
});
