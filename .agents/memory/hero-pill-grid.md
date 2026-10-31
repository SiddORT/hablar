---
name: Hero pill sizing
description: Lessons for keeping variable-width topic labels readable without changing adjacent copy.
---

Use normal-flow wrapping for a topic card without an illustration. Do not carry forward the former logo-centered layout's reserved slots or positional offsets. Check each full label plus padding.

**Why:** Repeated visual checks showed absolute coordinates could overlap long pills even after individual positions were adjusted. The requested card replaces the central illustration; reserving its space would undermine balanced rows.

**How to apply:** Verify all labels and their padding at desktop, tablet, and narrow widths, including enlarged text. Preserve adjacent copy and other branding.

When editing intrinsic sizing, check neighboring content as well as the card itself. Avoid `max-content` minimums that can inflate the artwork column.

**Why:** Previous intrinsic-sizing changes unexpectedly moved the copy column. A pill box fitting its container also does not prove its text and padding fit.

**How to apply:** Compare surrounding layout before and after; measure text bounds and padding in addition to container overflow.
