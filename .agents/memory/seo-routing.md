---
name: Static SEO route delivery
description: Why HABLAR's legal-page HTML needs explicit routing in every serving mode.
---

Do not assume a generated directory index will be served for an extensionless legal URL in an SPA. Verify the returned HTML head, not just HTTP success or the presence of the built file.

**Why:** Vite preview's SPA fallback served the homepage head at legal URLs despite route-specific index files being present. A browser could hide this by updating metadata after JavaScript loads, while sharing crawlers would still receive the wrong page.

**How to apply:** When changing public routes or static hosting configuration, verify direct requests to each intended canonical path in the relevant serving modes.
