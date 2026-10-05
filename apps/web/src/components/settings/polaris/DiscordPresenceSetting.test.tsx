// @vitest-environment jsdom
import type { DiscordPresenceState, PolarisBridge } from "@t3tools/shared/polarisBridge";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { DiscordPresenceSetting } from "./DiscordPresenceSetting";

vi.mock("../settingsLayout", () => ({
  SettingsRow: ({
    title,
    description,
    status,
    control,
  }: {
    title: string;
    description: string;
    status?: string | null;
    control: React.ReactNode;
  }) => (
    <div>
      <h3>{title}</h3>
      <p>{description}</p>
      {status ? <p data-testid="status">{status}</p> : null}
      {control}
    </div>
  ),
}));

function fakeBridge(initial: DiscordPresenceState) {
  let state = initial;
  const setEnabled = vi.fn(async (enabled: boolean) => {
    state = { ...state, enabled, status: enabled ? "waiting" : "stopped" };
    return state;
  });
  const bridge: PolarisBridge = {
    discordPresence: { getState: vi.fn(async () => state), setEnabled },
  };
  return { bridge, setEnabled };
}

describe("DiscordPresenceSetting", () => {
  let renderer: Root;
  let container: HTMLDivElement;
  const render = async (props: { disabled?: boolean } = {}) => {
    await act(async () => {
      renderer.render(<DiscordPresenceSetting {...props} />);
    });
  };
  const switchEl = () => container.querySelector<HTMLElement>('[role="switch"]')!;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    renderer = createRoot(container);
  });

  afterEach(async () => {
    await act(() => renderer.unmount());
    container.remove();
    delete window.polarisBridge;
    vi.unstubAllGlobals();
  });

  it("is disabled without the desktop bridge", async () => {
    await render();
    expect(
      switchEl().getAttribute("aria-disabled") ?? switchEl().getAttribute("disabled"),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="status"]')).toBeNull();
  });

  it("explains that an Application ID is missing and keeps the switch off", async () => {
    window.polarisBridge = fakeBridge({
      enabled: false,
      configured: false,
      status: "stopped",
    }).bridge;
    await render();
    expect(container.querySelector('[data-testid="status"]')?.textContent).toContain(
      "Application ID",
    );
    expect(switchEl().getAttribute("aria-checked")).toBe("false");
  });

  it("toggles through the bridge and shows the returned status", async () => {
    const { bridge, setEnabled } = fakeBridge({
      enabled: false,
      configured: true,
      status: "stopped",
    });
    window.polarisBridge = bridge;
    await render();
    expect(container.querySelector('[data-testid="status"]')).toBeNull();
    await act(async () => {
      switchEl().click();
    });
    expect(setEnabled).toHaveBeenCalledWith(true);
    expect(switchEl().getAttribute("aria-checked")).toBe("true");
    expect(container.querySelector('[data-testid="status"]')?.textContent).toContain("Retrying");
  });

  it("never mentions project or thread names in its copy", async () => {
    window.polarisBridge = fakeBridge({
      enabled: true,
      configured: true,
      status: "connected",
    }).bridge;
    await render();
    expect(container.textContent).toContain("Coding with Polaris");
    expect(container.textContent).toContain("Showing in Discord");
  });
});
