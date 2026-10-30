---
name: Floating dock geometry
description: Stable overlap calculations for responsive sticky actions.
---

Keep hidden floating actions in layout with `visibility: hidden`, not `display: none`, so overlap checks use a consistent dock footprint. When responsive positioning depends on an action's visibility, wait for that position change to settle before measuring overlaps.

**Why:** Removing an action from layout or measuring before a mobile reposition commits can make the overlap result depend on scroll direction, causing the dock to flicker.

**How to apply:** When changing dock visibility or overlap rules, preserve the control geometry and test repeated forward-and-reverse scrolling at both desktop and narrow mobile widths.
