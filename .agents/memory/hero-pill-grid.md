---
name: Hero pill grid sizing
description: A layout lesson for wrapping hashtag pills into deliberate desktop rows.
---

When arranging variable-width topic pills around a central illustration, avoid percentage-based absolute coordinates; labels collide as their widths and viewport dimensions change. Use non-overlapping grid slots with reserved center rows on desktop, then put the illustration in normal flow and let pills wrap naturally on narrow screens. Check each full label plus padding.

**Why:** Repeated visual checks showed absolute coordinates could overlap long pills even after individual positions were adjusted.

**How to apply:** Verify all labels and their padding at desktop and tablet widths, confirm the logo’s center area stays clear, and check narrow screens for natural wrapping without clipping or overlap.

Keep the illustration canvas's intrinsic minimum separate from the topic grid's minimum when tightening spacing. Size the grid minimum from explicit tracks, not `max-content`; spanning pills can inflate an intrinsic grid unexpectedly. Preserve clearance for tilted and vertically shifted pills even in the mobile wrapping layout.

**Why:** Intrinsic sizing changes can resize the percentage-width logo or move the copy column, while a seemingly safe mobile gap can still overlap a translated pill.

**How to apply:** Compare logo dimensions and surrounding layout before and after; measure transformed pill bounds as well as full text and padding.
