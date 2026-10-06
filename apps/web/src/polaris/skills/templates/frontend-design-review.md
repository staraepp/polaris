---
name: frontend-design-review
description: "Review a screen or component like a picky product designer: hierarchy, spacing, type, color, states and polish, then fix the top issues. Use after building or changing UI."
---

# Frontend design review

Look at the UI the way a demanding designer would, find what makes it feel generic or unfinished, and fix the issues that matter most. Judge rendered output, not just code.

## 1. See it first

- Load the screen in a browser at desktop width and a narrow mobile width, in light and dark if the app has both.
- Take screenshots. Every claim below should be something you can point at in a screenshot.
- Note the screen's single most important action. Everything else should support it.

## 2. Check, in this order

1. **Hierarchy.** One clear focal point. Headings, body, and meta text form at most three or four distinct levels. Nothing competes with the primary action.
2. **Spacing.** Use the project's spacing scale only. Related items sit closer than unrelated ones. Card padding, gaps, and section rhythm are consistent across siblings.
3. **Alignment.** Text, icons and controls share edges. Numbers use tabular figures and align right in tables.
4. **Typography.** Line length 45–80 characters for prose. No more than two weights per block. Truncation has a full value available (title or tooltip).
5. **Color.** Only design tokens; no new hues. The accent color marks actions and state, not decoration. Check contrast: 4.5:1 for text, 3:1 for large text and UI boundaries.
6. **States.** Every data surface has loading, empty, error, and overflow states. Empty states say what will appear and how to make it appear.
7. **Interaction.** Hover, focus-visible, active, and disabled are all distinct. Targets are at least 24×24 px (44 px on touch).
8. **Detail.** Consistent radii, icon sizes, and border weights. No orphaned single words in headings. No layout shift when data arrives.

## 3. Fix

- Rank findings by user impact. Fix the top three to five, smallest change first.
- Prefer removing things over adding them. Prefer existing components and tokens over new styles.
- Re-screenshot after each fix and compare with the before shot. Revert anything that is not clearly better.

## 4. Report

List what you changed and why, with before/after screenshot paths, then the findings you left for later.
