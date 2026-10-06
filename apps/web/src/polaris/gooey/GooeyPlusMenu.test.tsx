// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("liquid-gooey", () => {
  const Liquid = ({ children }: { children: ReactNode }) => <div>{children}</div>;
  Liquid.Item = ({ children, y }: { children: ReactNode; y?: number }) => (
    <div data-y={y ?? 0}>{children}</div>
  );
  return { Liquid };
});

const { default: GooeyPlusMenu } = await import("./GooeyPlusMenu");
const { composerPlusActions } = await import("./gooeyPlusActions");

describe("GooeyPlusMenu", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  const onAttach = vi.fn();
  const onCommand = vi.fn();
  const onMention = vi.fn();

  beforeEach(async () => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
    await act(() =>
      renderer.render(
        <GooeyPlusMenu actions={composerPlusActions({ onAttach, onCommand, onMention })} />,
      ),
    );
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  const trigger = () => container.querySelector<HTMLButtonElement>("button[aria-haspopup]")!;
  const items = () => [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
  const press = async (key: string) => {
    await act(() => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
      );
    });
  };

  it("keeps the chips out of the tab order until opened", async () => {
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(items().every((item) => item.tabIndex === -1)).toBe(true);
    await act(() => trigger().click());
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(items().map((item) => item.tabIndex)).toEqual([0, 0, 0]);
    expect(document.activeElement).toBe(items()[0]);
    expect(container.querySelectorAll('[data-y="-120"]')).toHaveLength(1);
  });

  it("walks the chips with the arrow keys and closes on Escape", async () => {
    await act(() => trigger().click());
    await press("ArrowUp");
    expect(document.activeElement?.textContent).toBe("Commands & skills");
    await press("Escape");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger());
  });

  it("leaves focus alone when opened by pointer, and still closes on Escape", async () => {
    await act(() => {
      trigger().dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
    });
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    expect(items()).not.toContain(document.activeElement);
    await act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });

  it("runs the chosen action and closes", async () => {
    await act(() => trigger().click());
    await act(() => items()[2]!.click());
    expect(onMention).toHaveBeenCalledOnce();
    expect(onAttach).not.toHaveBeenCalled();
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
  });
});
