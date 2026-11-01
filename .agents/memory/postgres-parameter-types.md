---
name: PostgreSQL parameter types
description: Avoid asyncpg type-inference failures hidden by mocked database tests.
---

Explicitly type reused SQL parameters when a VARCHAR column assignment and a CASE comparison constrain the same placeholder differently.

**Why:** PostgreSQL has rejected such queries with an ambiguous parameter type (text versus character varying). In the signup transaction this rolled back both the contact and email logs, so working SMTP credentials did not help. Mocked connection tests did not catch it.

**How to apply:** Check both INSERT and UPDATE queries with repeated status placeholders. Verify the actual HTTP/database path against PostgreSQL, using session-local tables cloned from the current schema and mocked SMTP so real contacts and recipients remain untouched.
