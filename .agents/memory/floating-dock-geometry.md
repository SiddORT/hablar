---
name: Floating dock geometry
description: Stable overlap calculations for responsive sticky actions.
---

Keep hidden floating actions in layout with `visibility: hidden`, not `display: none`, so overlap checks use a consistent dock footprint. When responsive positioning depends on an action's visibility, wait for that position change to settle before measuring overlaps.

Continuous scroll measurements must not repeatedly cancel a nested animation-frame callback. Keep normal per-frame measurements separate from the one-off wait after the dock changes position. Keep dock clearance deterministic; state-dependent overlap margins can produce different visibility at the same position depending on scroll direction.

**Why:** Removing an action from layout or measuring before a mobile reposition commits can make the overlap result depend on scroll direction. Cancelling nested callbacks on every scroll event can starve measurements until scrolling pauses, producing delayed visibility flashes.

**How to apply:** Preserve control geometry and test continuous movement as well as settled forward-and-reverse positions at desktop and narrow mobile widths. A separate show/hide threshold is useful for the return-to-top arrow, but dock overlap must return to the same state at the same position.
