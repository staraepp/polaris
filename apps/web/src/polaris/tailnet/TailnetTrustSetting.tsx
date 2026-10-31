/**
 * Polaris "Trust my tailnet" in Settings → Connections (desktop app only).
 * Turning it on or off restarts Polaris, so both directions ask first.
 */
import type {
  AdvertisedEndpoint,
  DesktopBridge,
  DesktopServerExposureState,
} from "@t3tools/contracts";
import { useCallback, useState } from "react";

import { SettingsRow } from "~/components/settings/settingsLayout";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Spinner } from "~/components/ui/spinner";
import { Switch } from "~/components/ui/switch";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";
import { readLocalApi } from "~/localApi";

import {
  formatNodeNames,
  httpsNote,
  parseNodeNamesInput,
  phoneAddress,
  TAILSCALE_DNS_ADMIN_URL,
} from "./tailnetTrust";

export function OpenToTailnetBadge() {
  return (
    <span className="shrink-0 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-3xs font-medium text-primary-text">
      Open to your tailnet
    </span>
  );
}

function HttpsHint({ note }: { readonly note: ReturnType<typeof httpsNote> }) {
  if (note === "none") return null;
  const openAdminConsole = () => {
    void readLocalApi()?.shell.openExternal(TAILSCALE_DNS_ADMIN_URL);
  };
  return note === "enable-certificates" ? (
    <span className="block">
      HTTPS certificates are off for your tailnet, so this is plain HTTP. Tailscale still encrypts
      it end to end. For an HTTPS address, turn on HTTPS Certificates in the{" "}
      <button
        type="button"
        className="underline underline-offset-2 hover:text-foreground"
        onClick={openAdminConsole}
      >
        Tailscale admin console (DNS page)
      </button>
      , then switch on Tailscale HTTPS below.
    </span>
  ) : (
    <span className="block">
      Plain HTTP over Tailscale, which encrypts it end to end. Switch on Tailscale HTTPS below for
      an HTTPS address.
    </span>
  );
}

export function TailnetTrustSetting({
  bridge,
  state,
  endpoints,
}: {
  readonly bridge: Pick<DesktopBridge, "setTailnetTrust">;
  readonly state: DesktopServerExposureState;
  readonly endpoints: ReadonlyArray<AdvertisedEndpoint>;
}) {
  const [pendingEnabled, setPendingEnabled] = useState<boolean | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [nodeNamesInput, setNodeNamesInput] = useState(() =>
    formatNodeNames(state.tailnetTrustedNodeNames),
  );
  const address = phoneAddress(endpoints);
  const note = httpsNote({ state, address });
  const typedNodeNames = parseNodeNamesInput(nodeNamesInput);
  const nodeNamesChanged =
    formatNodeNames(typedNodeNames) !== formatNodeNames(state.tailnetTrustedNodeNames);

  const apply = useCallback(
    async (input: { readonly enabled: boolean; readonly nodeNames?: ReadonlyArray<string> }) => {
      setIsRestarting(true);
      try {
        await bridge.setTailnetTrust(input);
      } catch (error) {
        toastManager.add(
          stackedThreadToast({
            type: "error",
            title: "Could not change Trust my tailnet",
            description: error instanceof Error ? error.message : "The setting was not saved.",
          }),
        );
        setIsRestarting(false);
        setPendingEnabled(null);
      }
    },
    [bridge],
  );

  return (
    <>
      <SettingsRow
        id="tailnet-trust"
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Trust my tailnet
            {state.tailnetTrustEnabled ? <OpenToTailnetBadge /> : null}
          </span>
        }
        description={
          state.tailnetTrustEnabled
            ? "Your own devices on Tailscale open Polaris without pairing. Everything else still pairs, and the local network cannot reach it."
            : "Let your own devices on Tailscale open Polaris without pairing. Polaris then listens only on this machine and Tailscale."
        }
        status={
          state.tailnetTrustEnabled ? (
            <span className="block space-y-1 text-muted-foreground">
              {address ? (
                <span className="block">
                  On your phone, open{" "}
                  <span className="font-mono text-foreground select-all">{address.url}</span>
                </span>
              ) : (
                <span className="block">Start Tailscale on this machine to get an address.</span>
              )}
              <HttpsHint note={note} />
            </span>
          ) : null
        }
        control={
          <Switch
            checked={state.tailnetTrustEnabled}
            disabled={isRestarting}
            onCheckedChange={(checked) => setPendingEnabled(checked)}
            aria-label="Trust my tailnet"
          />
        }
      />
      {state.tailnetTrustEnabled ? (
        <SettingsRow
          title="Also trust these devices"
          description="Node names of other people's devices in your tailnet, separated by commas. Your own devices are always trusted."
          className="bg-muted/20 pl-7 sm:pl-8"
          control={
            <form
              className="flex w-full items-center gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                if (!nodeNamesChanged) return;
                void apply({ enabled: true, nodeNames: typedNodeNames });
              }}
            >
              <Input
                size="sm"
                value={nodeNamesInput}
                onChange={(event) => setNodeNamesInput(event.target.value)}
                placeholder="kiosk, family-ipad"
                aria-label="Other trusted tailnet devices"
                className="min-w-0 sm:w-56"
                disabled={isRestarting}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!nodeNamesChanged || isRestarting}
              >
                {isRestarting ? "Restarting…" : "Save"}
              </Button>
            </form>
          }
        />
      ) : null}
      <AlertDialog
        open={pendingEnabled !== null}
        onOpenChange={(open) => {
          if (isRestarting) return;
          if (!open) setPendingEnabled(null);
        }}
      >
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingEnabled ? "Trust your tailnet?" : "Stop trusting your tailnet?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEnabled
                ? "Devices that Tailscale confirms are yours open Polaris without pairing. Polaris stops listening on the local network. Every other device still needs a pairing link. Polaris will restart."
                : "Your tailnet devices will need a pairing link again, and the sessions they got from this setting end. Polaris will restart."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose
              disabled={isRestarting}
              render={<Button variant="outline" disabled={isRestarting} />}
            >
              <span className="[text-box:trim-both_cap_alphabetic]">Cancel</span>
            </AlertDialogClose>
            <Button
              variant="default"
              disabled={pendingEnabled === null || isRestarting}
              onClick={() => {
                if (pendingEnabled === null) return;
                void apply({ enabled: pendingEnabled });
              }}
            >
              {isRestarting && <Spinner size="sm" />}
              <span className="[text-box:trim-both_cap_alphabetic]">
                {isRestarting
                  ? "Restarting…"
                  : pendingEnabled
                    ? "Restart and trust"
                    : "Restart and stop"}
              </span>
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </>
  );
}
