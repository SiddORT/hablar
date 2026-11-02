"""Offline image regression check; pipe to the image's default-user Python."""

import os
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import email_delivery


assert (os.getuid(), os.getgid()) == (10001, 10001), "Expected UID/GID 10001"
assert Path(email_delivery.__file__).resolve() == Path("/app/email_delivery.py")
assert email_delivery.EMAIL_LOGO_PATH == Path("/app/assets/hablar-email-logo.png")
logo = email_delivery.EMAIL_LOGO_PATH.read_bytes()
assert len(logo) > 8 and logo.startswith(b"\x89PNG\r\n\x1a\n"), "Missing/invalid PNG"
email_delivery._email_logo_bytes.cache_clear()

# Template construction must not send mail. No API import or database is needed.
with (
    patch("smtplib.SMTP", side_effect=AssertionError("SMTP is forbidden")),
    patch("smtplib.SMTP_SSL", side_effect=AssertionError("SMTP is forbidden")),
):
    messages = [
        email_delivery.confirmation_message("offline@example.invalid"),
        email_delivery.launch_update_message("offline@example.invalid"),
        email_delivery.admin_notification_message(
            "offline-admin@example.invalid",
            email="offline@example.invalid",
            phone=None,
            submitted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        ),
    ]
    for message in messages:
        html = message.get_body(preferencelist=("html",)).get_content()
        assert f"cid:{email_delivery.EMAIL_LOGO_CID}" in html
        images = [part for part in message.walk() if part.get_content_type() == "image/png"]
        assert len(images) == 1, "Expected one embedded logo"
        assert images[0]["Content-ID"] == f"<{email_delivery.EMAIL_LOGO_CID}>"
        assert images[0].get_payload(decode=True) == logo, "Embedded logo differs"
        assert message.as_bytes(), "Message serialization failed"

print("Email assets readable as UID/GID 10001; all three branded templates rendered offline.")
