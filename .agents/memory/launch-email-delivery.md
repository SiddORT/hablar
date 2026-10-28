---
name: One-time launch email behavior
description: The at-most-once delivery choice for HABLAR's single launch email.
---

Treat the launch email as an at-most-once campaign: once an approved send is claimed, do not retry it, even if delivery is interrupted. Count successful SMTP acceptance separately from confirmed inbox delivery, and report unresolved attempts as uncertain.

**Why:** SMTP outcomes can be ambiguous after a timeout or process interruption. Retrying could send the consented one-time update twice, so avoiding duplicates takes priority over automatic recovery.

**How to apply:** Preserve the permanent campaign claim and count-only summaries. A future recovery process must not re-send uncertain recipients without an explicitly approved new campaign.
