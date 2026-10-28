from __future__ import annotations

import asyncio
import os
import sys
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import fastapi_app
from email_delivery import LAUNCH_UPDATE_COPY, LAUNCH_UPDATE_SUBJECT, SIGN_OFF


def signup(signup_id, *, email=None, phone=None, consent_version=None):
    return {
        "id": signup_id,
        "email_ciphertext": (
            fastapi_app._encrypt_contact(email, "email") if email else None
        ),
        "phone_ciphertext": (
            fastapi_app._encrypt_contact(phone, "phone") if phone else None
        ),
        "consent_at": datetime(2026, 10, 28, tzinfo=timezone.utc),
        "consent_version": consent_version or fastapi_app.CONSENT_VERSION,
    }


class FakeLaunchConnection:
    def __init__(self, signups):
        self.signups = signups
        self.dispatch = None

    def _eligible_signups(self, query, args):
        for predicate in (
            "email_ciphertext IS NOT NULL",
            "consent_at IS NOT NULL",
            "consent_version = $1",
        ):
            if predicate not in query:
                raise AssertionError(f"Missing launch eligibility predicate: {predicate}")
        if not args or args[0] != fastapi_app.CONSENT_VERSION:
            raise AssertionError("Launch eligibility must use the current consent version.")
        return [
            row
            for row in self.signups
            if row["email_ciphertext"] is not None
            and row["consent_at"] is not None
            and row["consent_version"] == args[0]
        ]

    async def fetchval(self, query, *args):
        return len(self._eligible_signups(query, args))

    async def fetchrow(self, query, *_args):
        if "SELECT started_at" in query:
            return self.dispatch
        if "INSERT INTO waitlist_launch_email_dispatches" in query:
            if self.dispatch is not None:
                return None
            self.dispatch = {
                "started_at": datetime(2026, 10, 28, tzinfo=timezone.utc),
                "completed_at": None,
                "attempted_count": 0,
                "accepted_count": 0,
                "failed_count": 0,
            }
            return {"campaign_id": fastapi_app.LAUNCH_UPDATE_CAMPAIGN_ID}
        raise AssertionError(f"Unexpected fetchrow query: {query}")

    async def fetch(self, query, *args):
        return self._eligible_signups(query, args)

    async def execute(self, query, _campaign_id, attempted, delivered, failed):
        if "completed_at = NOW()" in query:
            self.dispatch["completed_at"] = datetime(2026, 10, 28, tzinfo=timezone.utc)
        self.dispatch["attempted_count"] = attempted
        self.dispatch["accepted_count"] = delivered
        self.dispatch["failed_count"] = failed


class FakeAcquire:
    def __init__(self, connection):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_exc):
        return None


class FakeLaunchPool:
    def __init__(self, recipients):
        self.connection = FakeLaunchConnection(recipients)

    def acquire(self):
        return FakeAcquire(self.connection)


class LaunchUpdateTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {
                "SESSION_SECRET": "test-only-session-secret-not-for-real-data-12345",
                "LAUNCH_UPDATE_ADMIN_TOKEN": "operator-token-for-tests-0123456789",
                "SMTP_HOST": "smtp.example.com",
                "SMTP_PORT": "587",
                "SMTP_USERNAME": "smtp-test-user",
                "SMTP_PASSWORD": "smtp-test-password",
                "SMTP_FROM_EMAIL": "hello@example.com",
            },
            clear=True,
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        self.pool_before = getattr(fastapi_app.app.state, "db_pool", None)
        self.addCleanup(self._restore_pool)

    def _restore_pool(self):
        if self.pool_before is None:
            fastapi_app.app.state._state.pop("db_pool", None)
        else:
            fastapi_app.app.state.db_pool = self.pool_before

    def request(self, pool, authorized=True):
        fastapi_app.app.state.db_pool = pool
        headers = (
            {"authorization": "Bearer operator-token-for-tests-0123456789"}
            if authorized
            else {}
        )
        return SimpleNamespace(app=fastapi_app.app, headers=headers)

    async def test_preview_requires_operator_and_contains_no_contact_data(self):
        contact = "private.person@example.com"
        pool = FakeLaunchPool(
            [
                signup("signup-id", email=contact)
            ]
        )
        with self.assertRaises(fastapi_app.HTTPException) as error:
            await fastapi_app.preview_launch_update(self.request(pool, authorized=False))
        self.assertEqual(error.exception.status_code, 401)

        preview = await fastapi_app.preview_launch_update(self.request(pool))
        self.assertEqual(preview["eligible_count"], 1)
        self.assertEqual(preview["subject"], LAUNCH_UPDATE_SUBJECT)
        self.assertEqual(preview["body"], f"{LAUNCH_UPDATE_COPY}\n\n{SIGN_OFF}")
        self.assertNotIn(contact, str(preview))

    async def test_send_requires_approval_and_permanently_claims_campaign(self):
        contact = "private.person@example.com"
        pool = FakeLaunchPool(
            [
                signup("signup-id", email=contact)
            ]
        )
        request = self.request(pool)
        with self.assertRaises(fastapi_app.HTTPException) as error:
            await fastapi_app.send_launch_update(
                request,
                fastapi_app.LaunchUpdateApproval(approval="not the approval phrase"),
            )
        self.assertEqual(error.exception.status_code, 400)

        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            result = await fastapi_app.send_launch_update(
                request,
                fastapi_app.LaunchUpdateApproval(
                    approval=fastapi_app.LAUNCH_UPDATE_APPROVAL
                ),
            )
            with self.assertRaises(fastapi_app.HTTPException) as duplicate:
                await fastapi_app.send_launch_update(
                    request,
                    fastapi_app.LaunchUpdateApproval(
                        approval=fastapi_app.LAUNCH_UPDATE_APPROVAL
                    ),
                )

        self.assertEqual(duplicate.exception.status_code, 409)
        send.assert_awaited_once()
        self.assertEqual(send.await_args.args[1]["To"], contact)
        self.assertEqual(result, {
            "state": "completed",
            "attempted": 1,
            "accepted_by_smtp": 1,
            "failed": 0,
            "uncertain": 0,
        })
        self.assertNotIn(contact, str(result))

    async def test_send_only_current_consented_email_signups_reach_smtp(self):
        eligible_email = "eligible.person@example.com"
        phone_only = "+15551234567"
        stale_consent_email = "old.consent@example.com"
        pool = FakeLaunchPool(
            [
                signup("eligible", email=eligible_email),
                signup("phone-only", phone=phone_only),
                signup(
                    "stale-consent",
                    email=stale_consent_email,
                    consent_version="waitlist-launch-email-v1",
                ),
            ]
        )

        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            result = await fastapi_app.send_launch_update(
                self.request(pool),
                fastapi_app.LaunchUpdateApproval(
                    approval=fastapi_app.LAUNCH_UPDATE_APPROVAL
                ),
            )

        send.assert_awaited_once()
        self.assertEqual(send.await_args.args[1]["To"], eligible_email)
        self.assertEqual(
            result,
            {
                "state": "completed",
                "attempted": 1,
                "accepted_by_smtp": 1,
                "failed": 0,
                "uncertain": 0,
            },
        )
        self.assertNotIn(eligible_email, str(result))
        self.assertNotIn(phone_only, str(result))
        self.assertNotIn(stale_consent_email, str(result))

    async def test_delivery_failure_is_counted_without_contact_details(self):
        contact = "private.person@example.com"
        pool = FakeLaunchPool(
            [
                signup("signup-id", email=contact)
            ]
        )
        with patch.object(
            fastapi_app,
            "send_email",
            new_callable=AsyncMock,
            side_effect=RuntimeError(f"SMTP failed for {contact}"),
        ):
            with self.assertLogs("hablar.waitlist", level="WARNING") as logs:
                result = await fastapi_app.send_launch_update(
                    self.request(pool),
                    fastapi_app.LaunchUpdateApproval(
                        approval=fastapi_app.LAUNCH_UPDATE_APPROVAL
                    ),
                )

        self.assertEqual(result["attempted"], 1)
        self.assertEqual(result["accepted_by_smtp"], 0)
        self.assertEqual(result["failed"], 1)
        self.assertNotIn(contact, "\n".join(logs.output))
        self.assertEqual(pool.connection.dispatch["failed_count"], 1)

    async def test_interrupted_partial_send_is_uncertain_and_cannot_be_retried(self):
        contacts = [
            "first.person@example.com",
            "second.person@example.com",
            "third.person@example.com",
        ]
        pool = FakeLaunchPool(
            [
                {
                    "id": f"signup-{index}",
                    "email_ciphertext": fastapi_app._encrypt_contact(contact, "email"),
                }
                for index, contact in enumerate(contacts)
            ]
        )
        request = self.request(pool)
        approval = fastapi_app.LaunchUpdateApproval(
            approval=fastapi_app.LAUNCH_UPDATE_APPROVAL
        )
        with patch.object(
            fastapi_app,
            "send_email",
            new_callable=AsyncMock,
            side_effect=[None, asyncio.CancelledError()],
        ) as send:
            with self.assertRaises(asyncio.CancelledError):
                await fastapi_app.send_launch_update(request, approval)

            preview = await fastapi_app.preview_launch_update(request)
            self.assertEqual(preview["state"], "interrupted")
            self.assertEqual(
                preview["delivery_summary"],
                {
                    "attempted": 2,
                    "accepted_by_smtp": 1,
                    "failed": 0,
                    "uncertain": 1,
                    "started_at": datetime(2026, 10, 28, tzinfo=timezone.utc),
                    "completed_at": None,
                },
            )
            self.assertNotIn(contacts[0], str(preview["delivery_summary"]))
            self.assertNotIn(contacts[1], str(preview["delivery_summary"]))
            self.assertNotIn(contacts[2], str(preview["delivery_summary"]))
            self.assertEqual(send.await_count, 2)
            self.assertEqual(
                [call.args[1]["To"] for call in send.await_args_list],
                contacts[:2],
            )

            with self.assertRaises(fastapi_app.HTTPException) as duplicate:
                await fastapi_app.send_launch_update(request, approval)

        self.assertEqual(duplicate.exception.status_code, 409)
        self.assertEqual(send.await_count, 2)

    async def test_empty_eligible_list_does_not_claim_campaign(self):
        pool = FakeLaunchPool([])
        with self.assertRaises(fastapi_app.HTTPException) as error:
            await fastapi_app.send_launch_update(
                self.request(pool),
                fastapi_app.LaunchUpdateApproval(
                    approval=fastapi_app.LAUNCH_UPDATE_APPROVAL
                ),
            )

        self.assertEqual(error.exception.status_code, 409)
        self.assertIsNone(pool.connection.dispatch)


if __name__ == "__main__":
    unittest.main()
