/**
 * Samples a background into a 32×32 grid of colors (Polaris), once per file:
 * the picture itself, or a video's first frame. Used only to compute the
 * contrast floor; nothing leaves the page.
 */
import { cssColorToRgb } from "../bots/cssColor";
import { cellsFromPixels, type Rgb } from "./backgroundContrast";

const GRID = 32;

function readCanvas(draw: (context: CanvasRenderingContext2D) => void): Rgb[] {
  const canvas = document.createElement("canvas");
  canvas.width = GRID;
  canvas.height = GRID;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (context === null) return [];
  draw(context);
  return cellsFromPixels(context.getImageData(0, 0, GRID, GRID).data);
}

function sampleImage(url: string): Promise<Rgb[]> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () =>
      resolve(readCanvas((context) => context.drawImage(image, 0, 0, GRID, GRID))),
    );
    image.addEventListener("error", () => resolve([]));
    image.src = url;
  });
}

function sampleVideo(url: string): Promise<Rgb[]> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.preload = "auto";
    const done = (cells: Rgb[]) => {
      video.removeAttribute("src");
      video.load();
      resolve(cells);
    };
    video.addEventListener("loadeddata", () =>
      done(readCanvas((context) => context.drawImage(video, 0, 0, GRID, GRID))),
    );
    video.addEventListener("error", () => done([]));
    video.src = url;
  });
}

export function sampleBackground(kind: "image" | "video", url: string): Promise<Rgb[]> {
  if (typeof document === "undefined") return Promise.resolve([]);
  return kind === "image" ? sampleImage(url) : sampleVideo(url);
}

function parseRgb(value: string | null): Rgb | null {
  const match = value === null ? null : /rgb\((\d+), (\d+), (\d+)\)/.exec(value);
  if (match === null) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export interface ThemeTextColors {
  readonly page: Rgb;
  readonly text: Rgb;
  readonly mutedText: Rgb;
}

/** The page color and the body and muted text colors of the current theme. */
export function readThemeTextColors(): ThemeTextColors | null {
  if (typeof document === "undefined") return null;
  const styles = getComputedStyle(document.documentElement);
  const read = (token: string) => parseRgb(cssColorToRgb(styles.getPropertyValue(token)));
  const page = read("--background");
  const text = read("--foreground");
  const mutedText = read("--muted-foreground");
  return page === null || text === null || mutedText === null ? null : { page, text, mutedText };
}
