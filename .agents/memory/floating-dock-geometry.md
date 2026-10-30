---
name: Floating dock geometry
description: Stable overlap calculations for responsive sticky actions.
---

Keep hidden floating actions in layout with `visibility: hidden`, not `display: none`, so overlap checks use a consistent dock footprint. The dock's viewport anchor must not depend on which action is visible.

Treat dock visibility as one coordinated decision. Evaluate content collisions after scrolling pauses, with a short fade, rather than toggling independently as each section passes behind it. Measure the dock's layout box rather than hover-transformed child buttons. Keep clearance deterministic.

On the homepage, upward scrolling must restore the floating actions and keep them visible after pausing, even where resting collision checks would normally hide them. The return-to-top arrow must stay available until the visitor is actually near the top.

Place the up arrow above, and right-aligned with, the sticky buttons rather than in the opposite corner.

**Why:** The user asked for the arrow above the sticky buttons because they could not find it and thought the buttons were covering it.

**Why:** The user confirmed downward scrolling worked but reported that the hidden state carried into upward scrolling made the actions unavailable. Upward intent intentionally overrides content-collision suppression; it is not an accidental direction-dependent geometry result.

**Why:** Real normal-motion scrolling reproduced disappearing/reappearing controls and a mobile bottom-to-top jump even though settled, reduced-motion tests passed. Faster frame scheduling alone did not fix the independent visibility rules. State-dependent clearance can also return different results at the same position.

**How to apply:** Test continuous normal-motion wheel movement, reversals, pointer-over-control scrolling, and settled overlap behavior on desktop/mobile. Wait for fonts before comparing baseline positions. Preserve focused controls. The return-to-top arrow can use separate show/hide thresholds.
