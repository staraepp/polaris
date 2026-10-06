/**
 * Readable text over any background (Polaris, V 4.1.0). The scrim (the page
 * color at the Dim opacity) is blended over the picture in sRGB, as CSS
 * opacity does; this finds the lowest Dim at which each kind of text keeps
 * its contrast target over every sampled cell: body text AA (4.5:1), muted
 * labels 3:1 (WCAG's level for large and UI text). Asking 4.5:1 of muted text
 * too would need a 95–100% scrim over a high-contrast photo, hiding it.
 */
export type Rgb = readonly [number, number, number];

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.040_45 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** The scrim at opacity `dim` (0–1) over `under`. */
export function blend(scrim: Rgb, under: Rgb, dim: number): Rgb {
  return [
    scrim[0] * dim + under[0] * (1 - dim),
    scrim[1] * dim + under[1] * (1 - dim),
    scrim[2] * dim + under[2] * (1 - dim),
  ];
}

export const AA_TEXT_CONTRAST = 4.5;
export const UI_TEXT_CONTRAST = 3;

export interface TextRequirement {
  readonly text: Rgb;
  readonly target: number;
}

/**
 * The lowest Dim, in whole percent rounded up to a step of 5, at which every
 * requirement holds over every cell. 100 when even the plain page color fails.
 */
export function contrastFloorPercent(
  cells: readonly Rgb[],
  scrim: Rgb,
  requirements: readonly TextRequirement[],
): number {
  if (cells.length === 0 || requirements.length === 0) return 0;
  const passes = (dim: number) =>
    cells.every((cell) => {
      const under = blend(scrim, cell, dim);
      return requirements.every(({ text, target }) => contrastRatio(text, under) >= target);
    });
  if (!passes(1)) return 100;
  if (passes(0)) return 0;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 18; step += 1) {
    const mid = (low + high) / 2;
    if (passes(mid)) high = mid;
    else low = mid;
  }
  return Math.min(100, Math.ceil((high * 100) / 5) * 5);
}

/** RGBA pixel data (as from a canvas) into opaque cells; transparent pixels skipped. */
export function cellsFromPixels(data: ArrayLike<number>): Rgb[] {
  const cells: Rgb[] = [];
  for (let index = 0; index + 3 < data.length; index += 4) {
    if ((data[index + 3] ?? 0) < 8) continue;
    cells.push([data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0]);
  }
  return cells;
}
