---
name: Signup acknowledgement
description: Keep signup persistence independent of slow or uncertain email delivery.
---

Acknowledge a signup once the contact and email-log records are committed, without waiting for SMTP. Do not automatically retry a submission with an unknown outcome.

**Why:** Email delivery can stall after the contact is already saved, making a successful registration look like a failed request. Retrying uncertain delivery can duplicate messages.

**How to apply:** Preserve deduplication and delivery-status logging. A saved signup does not mean its emails were delivered. Post-response background tasks are best-effort, not a durable worker queue; recovery must distinguish unattempted queued emails from uncertain sends. This does not change the separate one-time launch campaign rules.
