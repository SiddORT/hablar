from __future__ import annotations

import os
import sys
import smtplib
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import fastapi_app
from email_delivery import (
    CONFIRMATION_COPY,
    CONFIRMATION_SUBJECT,
    EMAIL_BLUE,
    EMAIL_GREEN,
    EMAIL_LOGO_CID,
    EMAIL_PAGE_BG,
    SIGN_OFF,
    admin_notification_message,
    confirmation_message,
    email_configuration,
    launch_update_message,
    _send_smtp,
)


class FakeConnection:
    def __init__(self, inserted_signup):
        self.inserted_signup = inserted_signup
        self.query = None
        self.args = None

    async def fetchrow(self, query, *args):
        self.query = query
        self.args = args
        return self.inserted_signup


class FakeAcquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_exc):
        return None


class FakePool:
    def __init__(self, inserted_signup):
        self.connection = FakeConnection(inserted_signup)

    def acquire(self):
        return FakeAcquire(self.connection)


class WaitlistEmailTests(unittest.IsolatedAsyncioTestCase):
    ACKNOWLEDGMENT = (
        "Thanks for signing up — we’ve recorded your contact for one HABLAR "
        "launch update."
    )

    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "SESSION_SECRET": "test-only-session-secret-not-for-real-data-12345",
                "SMTP_HOST": "smtp.example.com",
                "SMTP_PORT": "587",
                "SMTP_USERNAME": "smtp-test-user",
                "SMTP_PASSWORD": "smtp-test-password",
                "SMTP_FROM_EMAIL": "hello@example.com",
                "ADMIN_NOTIFICATION_EMAIL": "admin@example.com",
            },
            clear=True,
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        self.submitted_at = datetime(2026, 10, 28, 12, 34, 56, tzinfo=timezone.utc)
        self.app_state_before = getattr(fastapi_app.app.state, "db_pool", None)
        self.addCleanup(self._restore_pool)

    def _restore_pool(self):
        if self.app_state_before is None:
            fastapi_app.app.state._state.pop("db_pool", None)
        else:
            fastapi_app.app.state.db_pool = self.app_state_before

    async def submit(self, *, email=None, phone=None, inserted=True):
        row = (
            {"id": "test-signup-id", "created_at": self.submitted_at}
            if inserted
            else None
        )
        pool = FakePool(row)
        fastapi_app.app.state.db_pool = pool
        request = SimpleNamespace(app=fastapi_app.app)
        payload = fastapi_app.WaitlistSignupInput(
            email=email,
            phone=phone,
            consent=True,
            termsAccepted=True,
        )
        # Call the original endpoint function so these unit tests do not need
        # an HTTP client or exercise rate limiting.
        response = await fastapi_app.create_waitlist_signup.__wrapped__(
            request, payload
        )
        return response, pool

    def assert_branded_email(self, message):
        html_part = message.get_body(preferencelist=("html",))
        self.assertIsNotNone(html_part)
        html_content = html_part.get_content()
        self.assertIn(f"cid:{EMAIL_LOGO_CID}", html_content)
        self.assertIn(EMAIL_PAGE_BG, html_content)
        self.assertIn(EMAIL_BLUE, html_content)
        self.assertIn(EMAIL_GREEN, html_content)
        logo_parts = [
            part for part in message.walk()
            if part.get_content_type() == "image/png"
        ]
        self.assertEqual(len(logo_parts), 1)
        self.assertEqual(logo_parts[0]["Content-ID"], f"<{EMAIL_LOGO_CID}>")

    async def test_new_email_signup_sends_confirmation_and_admin_notice(self):
        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            response, pool = await self.submit(email="person@example.com")

        self.assertEqual(send.await_count, 2)
        confirmation, admin = [call.args[1] for call in send.await_args_list]
        self.assertEqual(confirmation["To"], "person@example.com")
        self.assertEqual(confirmation["Subject"], CONFIRMATION_SUBJECT)
        self.assertEqual(admin["To"], "admin@example.com")
        admin_text = admin.get_body(preferencelist=("plain",)).get_content()
        self.assertIn(
            "Submission time (Asia/Kolkata): 28 Oct 2026, 06:04 PM IST",
            admin_text,
        )
        self.assertIn("Email address: person@example.com", admin_text)
        self.assertNotIn("consent", admin_text.lower())
        self.assertIn("RETURNING id, created_at", pool.connection.query)
        self.assertEqual(response.message, self.ACKNOWLEDGMENT)

    async def test_phone_only_signup_sends_admin_notice_without_confirmation(self):
        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            await self.submit(phone="+14155550123")

        send.assert_awaited_once()
        admin = send.await_args.args[1]
        self.assertEqual(admin["To"], "admin@example.com")
        admin_text = admin.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("Phone number: +14155550123", admin_text)
        self.assertNotIn("Email address:", admin_text)

    async def test_duplicate_signup_sends_no_messages_and_same_acknowledgment(self):
        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            new_response, _ = await self.submit(email="person@example.com")
            duplicate_response, _ = await self.submit(
                email="person@example.com", inserted=False
            )

        self.assertEqual(send.await_count, 2)
        self.assertEqual(new_response.message, duplicate_response.message)
        self.assertEqual(new_response.message, self.ACKNOWLEDGMENT)
        self.assertNotIn("sent successfully", new_response.message.lower())
        self.assertNotIn("every", new_response.message.lower())

    async def test_smtp_failures_do_not_fail_signup_or_log_contact_details(self):
        contact = "private.person@example.com"
        with patch.object(
            fastapi_app,
            "send_email",
            new_callable=AsyncMock,
            side_effect=RuntimeError(f"SMTP failed for {contact}"),
        ) as send:
            with self.assertLogs("hablar.waitlist", level="WARNING") as logs:
                response, _ = await self.submit(email=contact)

        self.assertEqual(send.await_count, 2)
        self.assertEqual(response.message, self.ACKNOWLEDGMENT)
        self.assertNotIn(contact, response.message)
        self.assertNotIn(contact, "\n".join(logs.output))

    async def test_email_templates_have_html_and_readable_text(self):
        confirmation = confirmation_message("person@example.com")
        text = confirmation.get_body(preferencelist=("plain",)).get_content()
        html = confirmation.get_body(preferencelist=("html",)).get_content()
        self.assertEqual(confirmation["Subject"], CONFIRMATION_SUBJECT)
        self.assertIn(CONFIRMATION_COPY, text)
        self.assertIn(SIGN_OFF, text)
        self.assertIn(CONFIRMATION_COPY, html)
        self.assertIn(SIGN_OFF, html)
        self.assertIn("name=\"viewport\"", html)

        admin = admin_notification_message(
            "admin@example.com",
            email="person@example.com",
            phone="+14155550123",
            submitted_at=self.submitted_at,
        )
        admin_text = admin.get_body(preferencelist=("plain",)).get_content()
        self.assertIn("Submission time (Asia/Kolkata)", admin_text)
        self.assertIn("person@example.com", admin_text)
        self.assertIn("+14155550123", admin_text)
        launch_update = launch_update_message("person@example.com")

        for branded_email in (confirmation, launch_update, admin):
            self.assert_branded_email(branded_email)

    async def test_smtp_recipient_refusal_is_not_treated_as_a_success(self):
        settings, missing = email_configuration()
        self.assertFalse(missing)
        self.assertIsNotNone(settings)
        server = MagicMock()
        server.__enter__.return_value = server
        server.send_message.return_value = {
            "person@example.com": (550, b"Mailbox unavailable")
        }

        with patch("email_delivery.smtplib.SMTP", return_value=server):
            with self.assertRaises(smtplib.SMTPRecipientsRefused):
                _send_smtp(settings, confirmation_message("person@example.com"))

        self.assertEqual(
            server.send_message.call_args.args[0]["From"],
            "HABLAR <hello@example.com>",
        )

    async def test_missing_smtp_settings_are_reported_without_blocking_signup(self):
        os.environ.pop("SMTP_PASSWORD")
        config, missing = email_configuration()
        self.assertIsNone(config)
        self.assertIn("SMTP_PASSWORD", missing)

        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            with self.assertLogs("hablar.waitlist", level="WARNING") as logs:
                response, _ = await self.submit(email="person@example.com")

        send.assert_not_awaited()
        self.assertEqual(response.message, self.ACKNOWLEDGMENT)
        self.assertNotIn("person@example.com", "\n".join(logs.output))


if __name__ == "__main__":
    unittest.main()
