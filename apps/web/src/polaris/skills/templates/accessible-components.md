---
name: accessible-components
description: "Build or audit an interactive component so it works with a keyboard, a screen reader, zoom and reduced motion. Use when creating menus, dialogs, tabs, custom inputs or anything clickable that is not a plain button or link."
---

# Accessible components

Make the component usable without a mouse and understandable without sight. Prefer native HTML; reach for ARIA only to describe what native elements cannot.

## Structure

- Use the native element when one exists: `button` for actions, `a href` for navigation, `input`/`select`/`textarea` for form data, `dialog` semantics for modals.
- One `h1` per page; headings never skip a level inside a region.
- Every control has an accessible name: visible label, `aria-label`, or `aria-labelledby`. Icon-only buttons always need one.
- Group related controls with `fieldset`/`legend` or `role="group"` plus a label.

## Keyboard

- Everything clickable is reachable with Tab, in visual order, and works with Enter or Space.
- Composite widgets (menus, tabs, listboxes, grids) take one Tab stop and move inside with arrow keys; Home/End jump to the ends.
- Esc closes the innermost popup and returns focus to what opened it.
- Dialogs trap focus while open and restore it on close.
- Focus is always visible: a `:focus-visible` ring with 3:1 contrast against its background.

## Screen readers

- State is exposed, not just drawn: `aria-expanded`, `aria-pressed`, `aria-selected`, `aria-checked`, `aria-invalid`, `aria-current`.
- Live changes that matter (errors, progress, results) are announced with a polite live region.
- Decorative icons and illustrations are `aria-hidden="true"`; charts have a text or table alternative.

## Visual

- Text contrast 4.5:1 (3:1 for 18 px+ or bold 14 px+). Do not use color alone to carry meaning.
- Layout survives 200% zoom and a 320 px wide viewport without horizontal scrolling.
- Respect `prefers-reduced-motion`: drop non-essential animation, keep state changes instant.

## Verify

1. Unplug the mouse mentally: complete the main task with Tab, arrows, Enter, Space, and Esc only.
2. Inspect the accessibility tree (browser devtools) and read each control's role, name, and state.
3. Write a test that drives the component by keyboard and asserts focus and ARIA state.
