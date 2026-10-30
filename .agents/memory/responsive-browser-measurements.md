---
name: Responsive browser measurements
description: Settle the visible layout before measuring repeated theme, width, and text-scale changes.
---

For browser regression sweeps that repeatedly change viewport size, theme, and root text scaling, bring the measured section into view and let the layout settle before collecting bounds and computed styles.

**Why:** Rapid offscreen measurements returned bounds and inherited styles from the preceding layout even when the root's computed font size was already updated. Scrolling the section into view and allowing a short settling interval produced consistent measurements.

**How to apply:** Keep text-size cases grouped, wait for fonts, and settle after viewport changes before asserting responsive geometry. Do not weaken overflow or readability assertions to accommodate stale measurements.
