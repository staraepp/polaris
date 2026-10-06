---
name: motion-polish
description: "Add or tune UI animation so it explains change instead of decorating it: timing, easing, choreography, reduced motion and frame-rate cost. Use when something feels abrupt, sluggish or janky."
---

# Motion polish

Motion should answer "what just changed and where did it go?" If an animation does not help with that, shorten it or remove it.

## Decide what moves

- Animate state changes the user caused or needs to notice: opening, closing, adding, removing, reordering, success, error.
- Do not animate on every render, on scroll by default, or on data that updates constantly.
- One focal motion at a time. Stagger siblings by 20–40 ms at most.

## Timing and easing

| Change                        | Duration   | Easing                                        |
| ----------------------------- | ---------- | --------------------------------------------- |
| Hover, press, focus           | 100–150 ms | ease-out                                      |
| Small popups, tooltips, menus | 150–200 ms | ease-out in, ease-in out                      |
| Panels, sheets, dialogs       | 200–300 ms | a soft spring or `cubic-bezier(0.2, 0, 0, 1)` |
| Layout and reorder            | 200–350 ms | spring, no overshoot for dense UI             |

Exits are faster than entrances. Nothing a user waits on lasts longer than 400 ms.

## Keep it smooth

- Animate only `transform` and `opacity`. Avoid animating `width`, `height`, `top`, `left`, `box-shadow`, or `filter` on large areas.
- For size changes, animate a transform or use the platform's layout animation, then settle to real layout.
- Pause decorative loops when the page is hidden (`visibilitychange`) or off screen (`IntersectionObserver`).
- Check a performance recording: no long tasks during the animation, steady frame rate.

## Respect the user

- Honor `prefers-reduced-motion: reduce`: replace movement with an instant change or a short fade.
- Never block input while an animation runs; interrupting it should be immediate and smooth.

## Verify

Record the interaction (or step through it frame by frame in devtools) at normal speed and slowed down. Remove any motion you cannot justify in one sentence.
