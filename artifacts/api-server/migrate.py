cat > artifacts / api - server / migrate.py << "PY"
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

EXPECTED_COLUMNS = {
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

EXPECTED_INDEXES = {
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

EXPECTED_CONSTRAINTS = {
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


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


async def verify_schema(conn):
    for table, expected in EXPECTED_COLUMNS.items():
        rows = await conn.fetch(
            """
            SELECT column_name, udt_name, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = $1
            """,
            table,
        )
        actual = {
            r["column_name"]: (
                r["udt_name"],
                r["is_nullable"] == "NO",
            )
            for r in rows
        }
        if actual != expected:
            raise RuntimeError(
                f"Schema mismatch in {table}.\nExpected: {expected}\nActual: {actual}"
            )

        indexes = await conn.fetch(
            """
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public' AND tablename = $1
            """,
            table,
        )
        actual_indexes = {r["indexname"] for r in indexes}
        if actual_indexes != EXPECTED_INDEXES[table]:
            raise RuntimeError(f"Index mismatch in {table}: {actual_indexes}")

        constraints = await conn.fetch(
            """
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = $1::regclass
            """,
            f"public.{table}",
        )
        actual_constraints = {r["conname"] for r in constraints}
        if actual_constraints != EXPECTED_CONSTRAINTS[table]:
            raise RuntimeError(f"Constraint mismatch in {table}: {actual_constraints}")

    indexes = await conn.fetch(
        """
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND indexname IN (
            'waitlist_email_lookup_hash_unique',
            'waitlist_phone_lookup_hash_unique'
        )
        """
    )
    for row in indexes:
        definition = row["indexdef"].lower()
        if "where" not in definition or "is not null" not in definition:
            raise RuntimeError(f"Expected partial unique index: {row['indexname']}")

    fk = await conn.fetchval(
        """
        SELECT pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conname = 'waitlist_email_logs_signup_id_waitlist_signups_id_fk'
        AND conrelid = 'public.waitlist_email_logs'::regclass
        """
    )
    if not fk or "ON DELETE CASCADE" not in fk.upper():
        raise RuntimeError("Expected cascading signup foreign key not found")

    print("Existing UAT schema verified successfully.")


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
    await verify_schema(conn)

    path = MIGRATIONS / INITIAL
    if not path.is_file():
        raise RuntimeError(f"Missing initial migration: {path}")

    digest = checksum(path)

    async with conn.transaction():
        await ensure_history(conn)
        existing = await conn.fetchrow(
            f"SELECT checksum FROM {HISTORY} WHERE name = $1",
            INITIAL,
        )

        if existing:
            if existing["checksum"] != digest:
                raise RuntimeError("Initial migration checksum mismatch")
            print("Initial migration already baselined.")
            return

        count = await conn.fetchval(f"SELECT count(*) FROM {HISTORY}")
        if count:
            raise RuntimeError("Migration history already exists; refusing baseline.")

        await conn.execute(
            f"INSERT INTO {HISTORY} (name, checksum) VALUES ($1, $2)",
            INITIAL,
            digest,
        )

    print(f"Baselined {INITIAL} ({digest}).")


async def apply(conn):
    paths = sorted(MIGRATIONS.glob("*.sql"))
    if not paths:
        raise RuntimeError("No SQL migrations found.")

    async with conn.transaction():
        await ensure_history(conn)

    for path in paths:
        digest = checksum(path)

        async with conn.transaction():
            existing = await conn.fetchrow(
                f"SELECT checksum FROM {HISTORY} WHERE name = $1",
                path.name,
            )

            if existing:
                if existing["checksum"] != digest:
                    raise RuntimeError(f"Applied migration was modified: {path.name}")
                print(f"Already applied: {path.name}")
                continue

            print(f"Applying: {path.name}")
            await conn.execute(path.read_text(encoding="utf-8"))
            await conn.execute(
                f"INSERT INTO {HISTORY} (name, checksum) VALUES ($1, $2)",
                path.name,
                digest,
            )

    print("Migrations complete.")


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["baseline", "apply"])
    args = parser.parse_args()

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")

    conn = await asyncpg.connect(database_url)
    try:
        await conn.execute("SELECT pg_advisory_lock($1)", LOCK_ID)
        try:
            if args.command == "baseline":
                await baseline(conn)
            else:
                await apply(conn)
        finally:
            await conn.execute("SELECT pg_advisory_unlock($1)", LOCK_ID)
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
PY
