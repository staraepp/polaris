import type { ReactNode } from "react";

import { APP_DISPLAY_NAME, APP_STAGE_LABEL } from "../../branding";
import { resolveSidebarStageBackdropVariant, StageBackdropArt } from "../SidebarStageBackdrop";
import { StandalonePage } from "../ui/standalone-page";

/**
 * Branded masthead for the CLI-connect authorize and callback pages.
 */
export function AuthSurfaceShell({ children }: { readonly children: ReactNode }) {
  const stageVariant = resolveSidebarStageBackdropVariant(APP_STAGE_LABEL);

  return (
    <StandalonePage
      tone="brand"
      masthead={
        <header className="relative h-24 overflow-hidden bg-[linear-gradient(135deg,var(--primary),var(--stage-art-bottom))] text-white">
          {stageVariant ? (
            <div className="absolute inset-0" aria-hidden>
              <StageBackdropArt variant={stageVariant} />
            </div>
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(circle_at_75%_25%,color-mix(in_oklab,var(--stage-art-top)_55%,transparent),transparent_38%),linear-gradient(135deg,var(--primary),var(--stage-art-bottom))]"
            />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_20%,rgba(2,20,15,0.46)_100%)]" />
          <div className="relative h-full p-5 sm:p-6">
            <p className="text-3xs font-semibold tracking-widest text-white/80 uppercase">
              {APP_DISPLAY_NAME}
            </p>
          </div>
        </header>
      }
    >
      {children}
    </StandalonePage>
  );
}
