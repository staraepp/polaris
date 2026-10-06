/**
 * Any CSS color the browser understands (the theme tokens are `oklch()`), as
 * `rgb(r, g, b)` for the bot's canvas renderer, which does its own color math.
 * Painted once into a 1×1 canvas and read back; cached per input. Null where
 * there is no canvas (tests) or the color does not parse.
 */
const cache = new Map<string, string | null>();
let context: CanvasRenderingContext2D | null | undefined;

export function cssColorToRgb(color: string): string | null {
  const key = color.trim();
  if (key === "") return null;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  if (context === undefined) {
    try {
      context =
        typeof document === "undefined"
          ? null
          : document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    } catch {
      context = null;
    }
  }
  if (context === null) return null;
  // A sentinel first: an unparsable color leaves fillStyle unchanged.
  context.fillStyle = "#010203";
  context.fillStyle = key;
  if (context.fillStyle === "#010203" && key !== "#010203") {
    cache.set(key, null);
    return null;
  }
  context.clearRect(0, 0, 1, 1);
  context.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
  const rgb = `rgb(${r}, ${g}, ${b})`;
  cache.set(key, rgb);
  return rgb;
}

/** The first color of a `--polaris-beam-<tier>` palette token, or null when unset. */
export function firstPaletteColor(raw: string): string | null {
  const first = raw.split(",")[0]?.trim() ?? "";
  return first === "" ? null : first;
}
