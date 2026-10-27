---
name: Contact-data key rotation
description: How to safely rotate the key protecting HABLAR waitlist contact data.
---

HABLAR derives separate AES-GCM encryption and HMAC lookup keys from `SESSION_SECRET` using HKDF. Keep `SESSION_SECRET` stable while encrypted waitlist records exist.

**Why:** Changing the source secret without a coordinated migration makes existing contacts undecryptable and causes duplicate-detection hashes to change.

**How to apply:** Before rotating, build a migration that decrypts and re-encrypts every stored email and phone, recomputes its keyed lookup hash, and updates the recorded key version atomically. Never rotate this secret as a routine config change.
