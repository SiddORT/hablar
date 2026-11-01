"""Opt-in HTTP/database regression checks; temporary tables and mocked SMTP only."""
from __future__ import annotations

import asyncio
import json
import os
import smtplib
import sys
import unittest
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import asyncpg

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import fastapi_app


class ConnectionPool:
    def __init__(self, connection):
        self.connection = connection

    @asynccontextmanager
    async def acquire(self):
        yield self.connection


@unittest.skipUnless(
    os.environ.get("WAITLIST_POSTGRES_TESTS") == "1",
    "Set WAITLIST_POSTGRES_TESTS=1 to check the real PostgreSQL schema.",
)
class WaitlistPostgresTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.connection = await asyncpg.connect(
            **fastapi_app._database_connection_args(os.environ["DATABASE_URL"])
        )
        self.addAsyncCleanup(self.connection.close)
        # Session-local copies shadow application tables. Real signup records
        # cannot be read, changed, or notified by these requests.
        for table in ("waitlist_signups", "waitlist_email_logs"):
            await self.connection.execute(
                f"CREATE TEMP TABLE {table} (LIKE public.{table} INCLUDING ALL)"
            )
            self.assertTrue(await self.connection.fetchval(
                "SELECT $1::regclass = $2::regclass",
                table, f"pg_temp.{table}",
            ))
        old_pool = fastapi_app.app.state.db_pool if hasattr(fastapi_app.app.state, "db_pool") else None
        fastapi_app.app.state.db_pool = ConnectionPool(self.connection)
        self.addCleanup(setattr, fastapi_app.app.state, "db_pool", old_pool)
        self.env = patch.dict(os.environ, {
            "SESSION_SECRET": "isolated-postgres-test-key-not-used-for-real-contacts",
            "SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587",
            "SMTP_USERNAME": "test", "SMTP_PASSWORD": "test",
            "SMTP_FROM_EMAIL": "test@example.com",
            "ADMIN_NOTIFICATION_EMAIL": "admin@example.com",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        fastapi_app._protection_keys.cache_clear()
        self.addCleanup(fastapi_app._protection_keys.cache_clear)

    async def post_signup(self, **fields):
        body = json.dumps({"consent": True, "termsAccepted": True, **fields}).encode()
        scope = {
            "type": "http", "asgi": {"version": "3.0", "spec_version": "2.4"},
            "http_version": "1.1", "method": "POST", "scheme": "http",
            "path": "/api/waitlist", "raw_path": b"/api/waitlist",
            "query_string": b"", "root_path": "",
            "headers": [(b"content-type", b"application/json")],
            "client": ("127.0.0.1", 12345), "server": ("testserver", 80),
        }
        messages = []

        async def receive():
            return {"type": "http.request", "body": body, "more_body": False}

        async def send(message):
            messages.append(message)

        await asyncio.wait_for(fastapi_app.app(scope, receive, send), timeout=10)
        return next(m["status"] for m in messages if m["type"] == "http.response.start")

    async def test_http_signup_persists_logs_and_sends_without_sql_type_errors(self):
        with patch.object(fastapi_app, "send_email", new_callable=AsyncMock) as send:
            self.assertEqual(await self.post_signup(email="new@example.com"), 201)
            logs = await self.connection.fetch(
                "SELECT status, attempted_at, completed_at FROM waitlist_email_logs"
            )
            self.assertEqual(len(logs), 2)
            self.assertTrue(all(row["status"] == "accepted_by_smtp" for row in logs))
            self.assertTrue(all(row["attempted_at"] and row["completed_at"] for row in logs))
            self.assertEqual(send.await_count, 2)
            self.assertEqual(await self.post_signup(email="new@example.com"), 201)
            self.assertEqual(send.await_count, 2, "Duplicates must not resend emails")
            self.assertEqual(await self.post_signup(phone="+14155550123"), 201)
            self.assertEqual(send.await_count, 3)
            skipped = await self.connection.fetchrow(
                "SELECT reason_code, completed_at FROM waitlist_email_logs WHERE status = 'skipped'"
            )
            self.assertEqual(skipped["reason_code"], "no_email_address")
            self.assertIsNotNone(skipped["completed_at"])
            send.side_effect = smtplib.SMTPResponseException(550, b"Test rejection")
            self.assertEqual(await self.post_signup(email="rejected@example.com"), 201)
            self.assertEqual(await self.connection.fetchval(
                "SELECT count(*) FROM waitlist_email_logs WHERE status = 'failed'"
            ), 2)
            self.assertEqual(await self.post_signup(email="invalid@example.com", consent=False), 422)
            self.assertEqual(await self.connection.fetchval(
                "SELECT count(*) FROM waitlist_signups"
            ), 3)
