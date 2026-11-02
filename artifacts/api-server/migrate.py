#!/usr/bin/env python3
import argparse
import asyncio
import hashlib
import os
from pathlib import Path

import asyncpg

MIGRATIONS = Path("/app/migrations")
INITIAL = "0000_initial.sql"
HISTORY = "public.hablar_schema_migrations"
LOCK_ID = 726184203

COLUMNS = {
    "waitlist_signups": {
        "id": ("uuid", True),
        "email_ciphertext": ("bytea", False),
        "email_lookup_hash": ("bytea", False),
        "phone_ciphertext": ("bytea", False),
        "phone_lookup_hash": ("bytea", False),
        "encryption_key_version": ("int2", True),
        "consent_at": ("timestamptz", True),
        "consent_version": ("varchar", True),
        "privacy_notice_version": ("varchar", True),
        "terms_version": ("varchar", True),
        "created_at": ("timestamptz", True),
    },
    "waitlist_email_logs": {
        "id": ("uuid", True),
        "signup_id": ("uuid", True),
        "email_type": ("varchar", True),
        "status": ("varchar", True),
        "reason_code": ("varchar", False),
        "created_at": ("timestamptz", True),
        "updated_at": ("timestamptz", True),
        "attempted_at": ("timestamptz", False),
        "completed_at": ("timestamptz", False),
    },
    "waitlist_launch_email_dispatches": {
        "campaign_id": ("varchar", True),
        "started_at": ("timestamptz", True),
        "completed_at": ("timestamptz", False),
        "attempted_count": ("int4", True),
        "accepted_count": ("int4", True),
        "failed_count": ("int4", True),
    },
}

INDEXES = {
    "waitlist_signups": {
        "waitlist_signups_pkey",
        "waitlist_email_lookup_hash_unique",
        "waitlist_phone_lookup_hash_unique",
        "waitlist_created_at_idx",
    },
    "waitlist_email_logs": {
        "waitlist_email_logs_pkey",
        "waitlist_email_logs_signup_created_idx",
        "waitlist_email_logs_status_created_idx",
    },
    "waitlist_launch_email_dispatches": {
        "waitlist_launch_email_dispatches_pkey",
    },
}

CONSTRAINTS = {
    "waitlist_signups": {"waitlist_signups_pkey"},
    "waitlist_email_logs": {
        "waitlist_email_logs_pkey",
        "waitlist_email_logs_signup_id_waitlist_signups_id_fk",
        "waitlist_email_logs_type_check",
        "waitlist_email_logs_status_check",
    },
    "waitlist_launch_email_dispatches": {
        "waitlist_launch_email_dispatches_pkey",
    },
}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def verify_schema(conn):
    for table, expected in COLUMNS.items():
        rows = await conn.fetch(
            """
            SELECT column_name, udt_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            """,
            table,
        )
        actual = {
            row["column_name"]: (
                row["udt_name"],
                row["is_nullable"] == "NO",
            )
            for row in rows
        }
        if actual != expected:
            raise RuntimeError(f"Column mismatch in {table}: {actual}")

        rows = await conn.fetch(
            """
            SELECT indexname FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = $1
            """,
            table,
        )
        actual = {row["indexname"] for row in rows}
        if actual != INDEXES[table]:
            raise RuntimeError(f"Index mismatch in {table}: {actual}")

        rows = await conn.fetch(
            """
            SELECT conname FROM pg_constraint
            WHERE conrelid = $1::regclass
            """,
            f"public.{table}",
        )
        actual = {row["conname"] for row in rows}
        if actual != CONSTRAINTS[table]:
            raise RuntimeError(f"Constraint mismatch in {table}: {actual}")

    for name in (
        "waitlist_email_lookup_hash_unique",
        "waitlist_phone_lookup_hash_unique",
    ):
        definition = await conn.fetchval(
            "SELECT indexdef FROM pg_indexes "
            "WHERE schemaname = 'public' AND indexname = $1",
            name,
        )
        if not definition or "WHERE" not in definition.upper():
            raise RuntimeError(f"Invalid partial index: {name}")

    fk = await conn.fetchval(
        """
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'public.waitlist_email_logs'::regclass
          AND conname = 'waitlist_email_logs_signup_id_waitlist_signups_id_fk'
        """
    )
    if not fk or "ON DELETE CASCADE" not in fk.upper():
        raise RuntimeError("Cascading foreign key verification failed")

    print("Existing schema verified.")


async def ensure_history(conn):
    await conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {HISTORY} (
            name text PRIMARY KEY,
            checksum text NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
        """
    )


async def baseline(conn):
    path = MIGRATIONS / INITIAL
    if not path.is_file():
        raise RuntimeError(f"Missing migration: {INITIAL}")

    await verify_schema(conn)
    await ensure_history(conn)

    async with conn.transaction():
        existing = await conn.fetchrow(
            f"SELECT checksum FROM {HISTORY} WHERE name = $1",
            INITIAL,
        )
        if existing:
            if existing["checksum"] != digest(path):
                raise RuntimeError("Initial migration checksum mismatch")
            print("Initial migration already baselined.")
            return

        count = await conn.fetchval(f"SELECT count(*) FROM {HISTORY}")
        if count:
            raise RuntimeError("History is not empty; refusing baseline.")

        await conn.execute(
            f"INSERT INTO {HISTORY} (name, checksum) VALUES ($1, $2)",
            INITIAL,
            digest(path),
        )

    print("Initial migration baselined. No application tables were changed.")


async def apply(conn):
    paths = sorted(MIGRATIONS.glob("*.sql"))
    if not paths:
        raise RuntimeError("No SQL migrations found.")

    await ensure_history(conn)

    for path in paths:
        checksum = digest(path)

        async with conn.transaction():
            existing = await conn.fetchrow(
                f"SELECT checksum FROM {HISTORY} WHERE name = $1",
                path.name,
            )

            if existing:
                if existing["checksum"] != checksum:
                    raise RuntimeError(f"Applied migration modified: {path.name}")
                print(f"Already applied: {path.name}")
                continue

            print(f"Applying {path.name}")
            await conn.execute(path.read_text(encoding="utf-8"))
            await conn.execute(
                f"INSERT INTO {HISTORY} (name, checksum) VALUES ($1, $2)",
                path.name,
                checksum,
            )

    print("Migrations complete.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("baseline", "apply"))
    command = parser.parse_args().command

    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is missing")

    conn = await asyncpg.connect(url)
    try:
        await conn.execute("SELECT pg_advisory_lock($1)", LOCK_ID)
        try:
            if command == "baseline":
                await baseline(conn)
            else:
                await apply(conn)
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", LOCK_ID)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
