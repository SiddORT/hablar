---
name: Animated card clearance
description: Reserve responsive row spacing for both rotated card bounds and staggered float travel.
---

Check animated-card clearance across the full staggered cycle using transformed bounds, not just the resting layout or the shared keyframe endpoints.

**Why:** Smaller cards can still collide: staggered rows approach each other at different times, and rotation expands their vertical bounds. A visually comfortable resting gap hid a slight collision during movement.

**How to apply:** When changing card size, tilt, travel, or responsive gaps, sample each card's own animation phase across a cycle and compare transformed bounds against neighboring cards, copy, and section edges. Keep reduced-motion cards stationary.
