// @effect-diagnostics nodeBuiltinImport:off - Vite's build plugin runs before an Effect runtime exists.

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

import type { Plugin } from "vite-plus";

/**
 * Polaris (V 5.0.0): Excalidraw's fonts, served by the app at
 * `/excalidraw/fonts/` instead of Excalidraw's CDN, which the desktop app's
 * CSP (`font-src 'self'`) refuses. Dev serves them from node_modules; builds
 * copy them, with their LICENSE (`excalidraw-fonts/LICENSE`: OFL-1.1 and
 * MIT), into the output. Left out: Liberation Sans 1.05 (GPL with a font
 * exception; AGENTS.md allows only OFL or Apache-style fonts), used only by
 * legacy "Helvetica" text, and Xiaolai (CJK, about 12 MB). Text in those
 * falls back to a system font. `src/polaris/workspace/BoardCanvas.tsx`
 * points Excalidraw here.
 */
const FONTS_DIR = NodeURL.fileURLToPath(
  new URL("../node_modules/@excalidraw/excalidraw/dist/prod/fonts", import.meta.url),
);
const URL_PREFIX = "/excalidraw/fonts/";
const SKIPPED_FAMILIES = new Set(["Liberation", "Xiaolai"]);
const LICENSE_FILE = NodeURL.fileURLToPath(new URL("./excalidraw-fonts/LICENSE", import.meta.url));

const isShipped = (relativePath: string) =>
  !SKIPPED_FAMILIES.has(relativePath.split(/[\\/]/)[0] ?? "") && relativePath.endsWith(".woff2");

function listFonts(directory: string, prefix = ""): string[] {
  return NodeFS.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      return SKIPPED_FAMILIES.has(relative)
        ? []
        : listFonts(NodePath.join(directory, entry.name), relative);
    }
    return isShipped(relative) ? [relative] : [];
  });
}

export function excalidrawFontsPlugin(): Plugin {
  return {
    name: "polaris-excalidraw-fonts",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?")[0] ?? "";
        if (!pathname.startsWith(URL_PREFIX)) return next();
        let relative: string;
        try {
          relative = decodeURIComponent(pathname.slice(URL_PREFIX.length));
        } catch {
          return next();
        }
        const file = NodePath.resolve(FONTS_DIR, relative);
        if (
          !file.startsWith(FONTS_DIR + NodePath.sep) ||
          !isShipped(relative) ||
          !NodeFS.existsSync(file)
        ) {
          return next();
        }
        response.setHeader("Content-Type", "font/woff2");
        response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        NodeFS.createReadStream(file).pipe(response);
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "excalidraw/fonts/LICENSE",
        source: NodeFS.readFileSync(LICENSE_FILE),
      });
      for (const relative of listFonts(FONTS_DIR)) {
        this.emitFile({
          type: "asset",
          fileName: `excalidraw/fonts/${relative}`,
          source: NodeFS.readFileSync(NodePath.join(FONTS_DIR, relative)),
        });
      }
    },
  };
}
