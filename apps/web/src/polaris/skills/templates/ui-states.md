---
name: ui-states
description: "Design and build the loading, empty, error, partial and overflow states of a data-driven screen so it never shows a blank box, a spinner forever or a cryptic error. Use when wiring UI to data."
---

# UI states

A screen that only handles the happy path breaks the first time the network is slow, the list is empty, or the name is very long. Build every state on purpose.

## Inventory

For each data surface, list which of these can happen and make each one real:

1. **Loading** (first load). Prefer a skeleton shaped like the content over a spinner. Delay it about 150 ms so fast loads do not flash.
2. **Refreshing** (data already shown). Keep the old data visible; show a small inline indicator, never a full skeleton.
3. **Empty.** Say what will appear here and give the action that creates it. Distinguish "nothing yet" from "nothing matches your filter" (offer to clear the filter).
4. **Error.** Say what failed in plain words, keep whatever data is still valid, and offer a retry. Never show raw error objects or stack traces.
5. **Partial.** Some sources answered and some did not: show what arrived and name what is missing.
6. **Overflow.** Very long names truncate with the full value available; huge counts abbreviate (12.4k); long lists virtualize or paginate.
7. **Offline / permission denied.** Explain what the user can do about it.

## Build

- Model the state explicitly (a discriminated union or a status field), not as a pile of booleans.
- Keep layout stable across states: the container keeps its size so nothing jumps when data lands.
- Make retry idempotent and visible; disable the control while a retry is in flight.

## Verify

Force each state (mock the request, throttle the network, use an empty account, paste a 200-character name) and screenshot it. A state you have not seen is a state that is broken.
