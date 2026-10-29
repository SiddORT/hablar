---
name: Hero pill grid sizing
description: A layout lesson for wrapping hashtag pills into deliberate desktop rows.
---

When arranging text pills in a fixed-column grid, ensure each span can fit the full label plus horizontal padding. Otherwise `overflow-wrap` can split short words even when the overall row appears balanced. Keep a natural wrapping layout at narrower widths.

**Why:** Visual checks exposed wrapped labels where span widths had been estimated too narrowly.

**How to apply:** Verify the rendered desktop rows include the longest and shortest labels without broken words, then check narrow widths where the layout should return to natural wrapping.
