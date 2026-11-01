---
name: API workflow lifecycle
description: Readiness checks when Python reload processes survive workflow restarts.
---

Treat the routed API health response, not the managed workflow's status alone, as proof that the API is serving.

**Why:** Python reload launchers have survived managed workflow stops in this environment, leaving conflicting processes and causing subsequent starts to fail with an occupied port.

**How to apply:** After an occupied-port failure, stop the managed workflow and inspect the remaining API process tree before restarting. Only terminate positively identified stale API processes, not unrelated services. Verify the API through the shared preview router afterward.
