# border-beam (vendored)

This folder is a vendored copy of `border-beam` by Jakub Antalik (MIT, see `LICENSE` next to this file).

- Source: https://github.com/Jakubantalik/Libraries.dev, `packages/border-beam/src`, version 1.4.1 (commit `0d448879917f92c2b9f2773c1f91054f4c83dae5`). Site: https://libraries.dev/beam.
- Copied files: `BorderBeam.tsx`, `styles.ts`, `pulseDriver.ts`, `types.ts`, `index.ts`. Reformatted with the repo's formatter.

## Polaris changes

Each one is marked with a `Polaris` comment in the code.

1. **`colors` prop.** An exact palette (`#rgb`, `#rrggbb` or `rgb(r, g, b)`), cycled over the variant's color blobs (`resolvePalette` in `styles.ts`). It works with `md`, `pulse-inner` and `pulse-outside`; `sm` and `line` keep their stock palettes. The stock library only offers fixed variants.
2. **Reduced motion.** The rotate sizes (`sm`, `md`, `line`) ignored `prefers-reduced-motion`, and the pulse sizes cancelled their own fade-in under it, so they never appeared. Every size now keeps only the short opacity fade and holds still (`reducedMotionRule`).
3. **Stricter types.** This repo compiles with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`, so table reads go through small total helpers (`pair`, `sizePair`, `ringSlot`, `blobAt`, `spike`). Behavior is unchanged.
4. **`md` blobs scale to the element.** `md`'s color blobs are authored in fixed pixels for a card of about 350×140, so on a wide composer most of the edge had no color. The component already measured the element for `pulse-outside`; it now measures `md` too and sets `--beam-blob-sx/sy`, which `scaledBlobSize` multiplies into the blob sizes.

Updating: copy the new `src` files over these, re-apply the four changes above, and run `vp test run apps/web/src/polaris/vendor/border-beam`.
