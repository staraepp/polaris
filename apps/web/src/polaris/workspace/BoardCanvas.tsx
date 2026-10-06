/**
 * The Excalidraw canvas of a Workspace board (Polaris, V 5.0.0). Imported
 * lazily by `BoardPage`, so Excalidraw's bundle loads only with a board.
 */
import {
  Excalidraw,
  hashElementsVersion,
  serializeAsJSON,
  WelcomeScreen,
} from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { useMemo, useRef } from "react";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

// Excalidraw's fonts ship with the app at /excalidraw/fonts (see
// `vite/excalidrawFonts.ts`): the desktop app's CSP allows fonts only from the
// app itself, not Excalidraw's CDN. The app is served from its origin's root.
window.EXCALIDRAW_ASSET_PATH = `${window.location.origin}/excalidraw/`;

/** A stored `.excalidraw` scene back into Excalidraw's initial data; null if unreadable. */
export function parseStoredScene(scene: string | null): ExcalidrawInitialDataState | null {
  if (scene === null) return null;
  try {
    const value: unknown = JSON.parse(scene);
    if (typeof value !== "object" || value === null) return null;
    const record = value as Record<string, unknown>;
    if (!Array.isArray(record.elements)) return null;
    // Excalidraw runs initial data through its own `restore`, which repairs
    // and fills in every element and app state field.
    return record as ExcalidrawInitialDataState;
  } catch {
    return null;
  }
}

const sceneSignature = (
  elements: readonly OrderedExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles,
) =>
  `${hashElementsVersion(elements)}:${Object.keys(files).length}:${appState.viewBackgroundColor}`;

export default function BoardCanvas({
  initialScene,
  name,
  theme,
  onSceneChange,
}: {
  readonly initialScene: string | null;
  readonly name: string;
  readonly theme: "light" | "dark";
  /** Called only when the drawing changed; reading the scene is deferred. */
  readonly onSceneChange: (readScene: () => string) => void;
}) {
  const initialData = useMemo(() => parseStoredScene(initialScene), [initialScene]);
  const lastSignature = useRef<string | null>(null);

  return (
    <Excalidraw
      initialData={initialData}
      theme={theme}
      name={name}
      UIOptions={{
        canvasActions: {
          toggleTheme: false,
          saveToActiveFile: false,
          loadScene: true,
          export: { saveFileToDisk: true },
          saveAsImage: true,
        },
      }}
      onChange={(elements, appState, files) => {
        // Excalidraw reports every pointer move and selection; save only edits.
        const signature = sceneSignature(elements, appState, files);
        if (lastSignature.current === null || lastSignature.current === signature) {
          lastSignature.current = signature;
          return;
        }
        lastSignature.current = signature;
        onSceneChange(() => serializeAsJSON(elements, appState, files, "local"));
      }}
    >
      <WelcomeScreen>
        <WelcomeScreen.Hints.MenuHint />
        <WelcomeScreen.Hints.ToolbarHint />
        <WelcomeScreen.Hints.HelpHint />
        <WelcomeScreen.Center>
          <WelcomeScreen.Center.Heading>
            Sketch it out. Everything saves on this device as you draw.
          </WelcomeScreen.Center.Heading>
        </WelcomeScreen.Center>
      </WelcomeScreen>
    </Excalidraw>
  );
}
