---
name: Container runtime scope
description: Approved API runtime choice and container verification constraint.
---

Package the existing Python/FastAPI API for production containers rather than
recreating a Node backend.

**Why:** The initial container plan assumed an Express API that had already
been removed. The user explicitly approved including the existing Python API
when asked about that scope change.

**How to apply:** Preserve the current API behavior when changing packaging;
do not interpret stale Node-runtime instructions as permission to rewrite it.

Restricted nested Docker environments may start and build containers while
rejecting all exec operations, including health-check commands.

**Why:** This workspace allowed real HTTP traffic to the production containers,
but Docker exec failed before starting even a simple command.

**How to apply:** Distinguish container-runtime restrictions from application
failures. Retain normal health checks for CI/real hosts and report which checks
could actually run locally; do not weaken production health gates to accommodate
the development sandbox.
