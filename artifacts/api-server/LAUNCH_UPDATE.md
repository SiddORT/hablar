# One-time launch update

The launch email is a single, operator-triggered send. It is not sent during signup.

## Before sending

1. Add `LAUNCH_UPDATE_ADMIN_TOKEN` in Replit Secrets. Use a random token with at least 32 bytes. Do not reuse `SESSION_SECRET`.
2. Confirm the SMTP settings are configured.
3. Use the API preview endpoint with the operator token:

   ```sh
   curl -sS "$API_BASE_URL/api/admin/launch-update" \
     -H "Authorization: Bearer $LAUNCH_UPDATE_ADMIN_TOKEN"
   ```

   Review the subject, body, and eligible-recipient count. Phone-only signups and signups without the current consent version are excluded.
4. Only after reviewing the exact message, approve the send:

   ```sh
   curl -sS -X POST "$API_BASE_URL/api/admin/launch-update/send" \
     -H "Authorization: Bearer $LAUNCH_UPDATE_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     --data '{"approval":"SEND ONE HABLAR LAUNCH UPDATE"}'
   ```

The response contains counts only. “Accepted by SMTP” means the mail server accepted the message; it does not confirm inbox delivery. The campaign is permanently claimed before sending starts. Failed or interrupted sends cannot be retried through this endpoint, to prevent duplicate launch emails. The preview endpoint then reports the saved summary and any uncertain attempts without exposing contact details.

The message makes no launch-date promise and does not sign recipients up for SMS or ongoing marketing.
