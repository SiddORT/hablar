from __future__ import annotations

import json
import os
import sys
import unittest
from datetime import datetime, timezone
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import fastapi_app


class IsolatedWaitlistStore:
    """In-memory stand-in for the PostgreSQL insert used by the HTTP endpoint."""

    def __init__(self):
        self.records: list[dict[str, object]] = []

    async def fetchrow(self, query: str, *values: object):
        assert "ON CONFLICT DO NOTHING" in query
        email_ciphertext, email_hash, phone_ciphertext, phone_hash = values[:4]
        if any(
            (email_hash and record["email_hash"] == email_hash)
            or (phone_hash and record["phone_hash"] == phone_hash)
            for record in self.records
        ):
            return None

        record = {
            "email_ciphertext": email_ciphertext,
            "email_hash": email_hash,
            "phone_ciphertext": phone_ciphertext,
            "phone_hash": phone_hash,
        }
        self.records.append(record)
        return {
            "id": f"isolated-test-{len(self.records)}",
            "created_at": datetime.now(timezone.utc),
        }


class IsolatedAcquire:
    def __init__(self, connection: IsolatedWaitlistStore):
        self.connection = connection

    async def __aenter__(self):
        return self.connection

    async def __aexit__(self, *_exc):
        return None


class IsolatedPool:
    def __init__(self, store: IsolatedWaitlistStore):
        self.store = store

    def acquire(self):
        return IsolatedAcquire(self.store)


async def asgi_request(method: str, path: str, payload: dict | None = None):
    body = json.dumps(payload).encode("utf-8") if payload is not None else b""
    events = []
    body_sent = False
    client_port = 40000 + (id(payload) % 20000)

    async def receive():
        nonlocal body_sent
        if body_sent:
            return {"type": "http.disconnect"}
        body_sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(event):
        events.append(event)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.3"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": [(b"content-type", b"application/json")] if body else [],
        "client": ("127.0.0.1", client_port),
        "server": ("testserver", 80),
    }
    await fastapi_app.app(scope, receive, send)

    start = next(event for event in events if event["type"] == "http.response.start")
    response_body = b"".join(
        event.get("body", b"")
        for event in events
        if event["type"] == "http.response.body"
    )
    return start["status"], json.loads(response_body) if response_body else None


class WaitlistHttpIntegrationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.env = patch.dict(
            os.environ,
            {"SESSION_SECRET": "isolated-api-test-secret-never-used-for-real-data"},
            clear=True,
        )
        self.env.start()
        self.addCleanup(self.env.stop)
        fastapi_app._protection_keys.cache_clear()
        self.addCleanup(fastapi_app._protection_keys.cache_clear)

        self.store = IsolatedWaitlistStore()
        self.previous_pool = getattr(fastapi_app.app.state, "db_pool", None)
        fastapi_app.app.state.db_pool = IsolatedPool(self.store)
        self.addCleanup(self.restore_isolated_state)

        self.mail_patch = patch.object(
            fastapi_app, "email_configuration", return_value=(None, ["SMTP_HOST"])
        )
        self.mail_patch.start()
        self.addCleanup(self.mail_patch.stop)

    def restore_isolated_state(self):
        # All test contacts live in this in-memory store and are discarded here.
        self.store.records.clear()
        if self.previous_pool is None:
            fastapi_app.app.state._state.pop("db_pool", None)
        else:
            fastapi_app.app.state.db_pool = self.previous_pool

    async def post_signup(self, **overrides):
        payload = {
            "email": "person@example.com",
            "phone": None,
            "consent": True,
            "termsAccepted": True,
            **overrides,
        }
        return await asgi_request("POST", "/api/waitlist", payload)

    async def test_health_endpoint_is_available(self):
        status, response = await asgi_request("GET", "/api/healthz")
        self.assertEqual(status, 200)
        self.assertEqual(response, {"status": "ok"})

    async def test_email_signup_normalizes_and_stores_encrypted_contact_data(self):
        status, response = await self.post_signup(email="  PERSON@Example.com ")
        self.assertEqual(status, 201)
        self.assertIn("recorded", response["message"])
        self.assertEqual(len(self.store.records), 1)

        record = self.store.records[0]
        encrypted = record["email_ciphertext"]
        self.assertIsInstance(encrypted, bytes)
        self.assertNotIn(b"person@example.com", encrypted)
        encryption_key, _ = fastapi_app._protection_keys()
        decrypted = fastapi_app.AESGCM(encryption_key).decrypt(
            encrypted[:12],
            encrypted[12:],
            b"hablar-waitlist-v1:email",
        )
        self.assertEqual(decrypted, b"person@example.com")
        self.assertEqual(
            record["email_hash"],
            fastapi_app._contact_lookup_hash("person@example.com", "email"),
        )
        self.assertIsNone(record["phone_ciphertext"])

    async def test_phone_signup_normalizes_and_stores_encrypted_contact_data(self):
        status, _ = await self.post_signup(
            email=None,
            phone=" +1 (415) 555-0123 ",
        )
        self.assertEqual(status, 201)
        record = self.store.records[0]
        encrypted = record["phone_ciphertext"]
        self.assertIsInstance(encrypted, bytes)
        self.assertNotIn(b"+14155550123", encrypted)
        encryption_key, _ = fastapi_app._protection_keys()
        decrypted = fastapi_app.AESGCM(encryption_key).decrypt(
            encrypted[:12],
            encrypted[12:],
            b"hablar-waitlist-v1:phone",
        )
        self.assertEqual(decrypted, b"+14155550123")
        self.assertIsNone(record["email_ciphertext"])

    async def test_invalid_email_and_phone_are_rejected_without_persistence(self):
        invalid_email_status, _ = await self.post_signup(email="not-an-email")
        invalid_phone_status, _ = await self.post_signup(
            email=None,
            phone="555-ABC",
        )
        self.assertEqual(invalid_email_status, 422)
        self.assertEqual(invalid_phone_status, 422)
        self.assertEqual(self.store.records, [])

    async def test_contact_and_both_consents_are_required(self):
        missing_contact, _ = await self.post_signup(email=None)
        missing_consent, _ = await self.post_signup(consent=False)
        missing_terms, _ = await self.post_signup(termsAccepted=False)
        self.assertEqual(missing_contact, 422)
        self.assertEqual(missing_consent, 422)
        self.assertEqual(missing_terms, 422)
        self.assertEqual(self.store.records, [])

    async def test_duplicate_email_returns_same_acknowledgment_without_new_record(self):
        first_status, first_response = await self.post_signup()
        duplicate_status, duplicate_response = await self.post_signup(
            email=" PERSON@example.com "
        )
        self.assertEqual((first_status, duplicate_status), (201, 201))
        self.assertEqual(first_response, duplicate_response)
        self.assertEqual(len(self.store.records), 1)

    async def test_duplicate_phone_returns_same_acknowledgment_without_new_record(self):
        first_status, first_response = await self.post_signup(
            email=None,
            phone="+14155550123",
        )
        duplicate_status, duplicate_response = await self.post_signup(
            email=None,
            phone="+1 (415) 555-0123",
        )
        self.assertEqual((first_status, duplicate_status), (201, 201))
        self.assertEqual(first_response, duplicate_response)
        self.assertEqual(len(self.store.records), 1)


if __name__ == "__main__":
    unittest.main()
