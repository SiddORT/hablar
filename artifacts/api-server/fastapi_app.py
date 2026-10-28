from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import os
import re
import secrets
import smtplib
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

import asyncpg
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, EmailStr, Field, StrictBool, field_validator, model_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from email_delivery import (
    admin_notification_message,
    configuration_warnings,
    confirmation_message,
    email_configuration,
    LAUNCH_UPDATE_COPY,
    LAUNCH_UPDATE_SUBJECT,
    launch_update_message,
    SIGN_OFF,
    send_email,
)


CONSENT_VERSION = "waitlist-launch-email-v2"
PRIVACY_NOTICE_VERSION = "draft-2026-10-28"
TERMS_VERSION = "draft-2026-10-27"
ENCRYPTION_KEY_VERSION = 1
PHONE_PATTERN = re.compile(r"^\+[1-9][0-9]{7,14}$")
MAX_BODY_BYTES = 4096
LAUNCH_UPDATE_CAMPAIGN_ID = "hablar-launch-update-v1"
LAUNCH_UPDATE_APPROVAL = "SEND ONE HABLAR LAUNCH UPDATE"
logger = logging.getLogger("hablar.waitlist")


async def _insert_waitlist_email_log(
    connection,
    signup_id: str,
    email_type: str,
    status: str,
    reason_code: str | None,
):
    return await connection.fetchval(
        """
        INSERT INTO waitlist_email_logs (
            signup_id, email_type, status, reason_code,
            attempted_at, completed_at
        )
        VALUES (
            $1, $2, $3, $4,
            CASE WHEN $3 = 'pending' THEN NOW() ELSE NULL END,
            CASE WHEN $3 = 'skipped' THEN NOW() ELSE NULL END
        )
        RETURNING id
        """,
        signup_id,
        email_type,
        status,
        reason_code,
    )


async def _set_waitlist_email_log_status(
    pool,
    log_id,
    status: str,
    reason_code: str | None = None,
) -> bool:
    try:
        async with pool.acquire() as connection:
            await connection.execute(
                """
                UPDATE waitlist_email_logs
                SET status = $2,
                    reason_code = $3,
                    attempted_at = CASE
                        WHEN $2 = 'pending' THEN NOW()
                        ELSE attempted_at
                    END,
                    completed_at = CASE
                        WHEN $2 IN (
                            'accepted_by_smtp', 'failed', 'uncertain', 'skipped'
                        ) THEN NOW()
                        ELSE completed_at
                    END,
                    updated_at = NOW()
                WHERE id = $1
                """,
                log_id,
                status,
                reason_code,
            )
    except Exception:
        logger.error("Waitlist email delivery status could not be saved.")
        return False
    return True


async def _send_waitlist_email_with_log(
    pool,
    log_id,
    mail_config,
    message,
    log_label: str,
) -> None:
    if not await _set_waitlist_email_log_status(pool, log_id, "pending"):
        logger.error(
            "Waitlist email was not attempted because its status could not be saved."
        )
        return

    try:
        await send_email(mail_config, message)
    except asyncio.CancelledError:
        await _set_waitlist_email_log_status(
            pool, log_id, "uncertain", "send_cancelled"
        )
        raise
    except (smtplib.SMTPRecipientsRefused, smtplib.SMTPResponseException):
        await _set_waitlist_email_log_status(
            pool, log_id, "failed", "smtp_rejected"
        )
        logger.warning("%s was rejected by SMTP.", log_label)
    except Exception:
        # Avoid recording exception text because SMTP errors can include addresses.
        await _set_waitlist_email_log_status(
            pool, log_id, "uncertain", "delivery_outcome_unknown"
        )
        logger.warning("%s delivery outcome is uncertain.", log_label)
    else:
        await _set_waitlist_email_log_status(
            pool, log_id, "accepted_by_smtp"
        )


@lru_cache(maxsize=1)
def _protection_keys() -> tuple[bytes, bytes]:
    master_secret = os.environ.get("SESSION_SECRET", "")
    if len(master_secret.encode("utf-8")) < 32:
        raise RuntimeError(
            "SESSION_SECRET must contain at least 32 bytes to protect waitlist data."
        )

    def derive(info: bytes) -> bytes:
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b"hablar-contact-protection-v1",
            info=info,
        ).derive(master_secret.encode("utf-8"))

    return (
        derive(b"email-and-phone-aes-gcm"),
        derive(b"contact-lookup-hmac"),
    )


def _encrypt_contact(value: str, field_name: str) -> bytes:
    encryption_key, _ = _protection_keys()
    nonce = os.urandom(12)
    aad = f"hablar-waitlist-v1:{field_name}".encode("utf-8")
    return nonce + AESGCM(encryption_key).encrypt(nonce, value.encode("utf-8"), aad)


def _decrypt_contact(value: bytes, field_name: str) -> str:
    encryption_key, _ = _protection_keys()
    nonce = value[:12]
    aad = f"hablar-waitlist-v1:{field_name}".encode("utf-8")
    return AESGCM(encryption_key).decrypt(nonce, value[12:], aad).decode("utf-8")


def _contact_lookup_hash(value: str, field_name: str) -> bytes:
    _, lookup_key = _protection_keys()
    message = f"{field_name}:{value}".encode("utf-8")
    return hmac.new(lookup_key, message, hashlib.sha256).digest()


def _database_connection_args(database_url: str) -> dict[str, object]:
    parsed = urlsplit(database_url)
    if parsed.scheme not in {"postgres", "postgresql"} or not parsed.hostname:
        raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL.")

    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    sslmode = query.pop("sslmode", None)
    ssl: bool | str = False if sslmode == "disable" else "require"
    database = unquote(parsed.path.lstrip("/"))
    if not database:
        raise RuntimeError("DATABASE_URL must include a database name.")

    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
        "database": database,
        "ssl": ssl,
        "server_settings": {"application_name": "hablar-fastapi"},
    }


class WaitlistSignupInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")

    email: EmailStr | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)
    consent: StrictBool
    terms_accepted: StrictBool = Field(alias="termsAccepted")

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip().lower()
            return value or None
        return value

    @field_validator("phone", mode="before")
    @classmethod
    def normalize_phone(cls, value: object) -> object:
        if isinstance(value, str):
            value = re.sub(r"[\s().-]", "", value.strip())
            return value or None
        return value

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: str | None) -> str | None:
        if value is not None and not PHONE_PATTERN.fullmatch(value):
            raise ValueError("Use an international number with country code.")
        return value

    @model_validator(mode="after")
    def require_contact_and_consent(self) -> "WaitlistSignupInput":
        if not self.email and not self.phone:
            raise ValueError("Provide an email address or phone number.")
        if not self.consent:
            raise ValueError("Consent is required for a launch update.")
        if not self.terms_accepted:
            raise ValueError("Terms acceptance is required.")
        return self


class WaitlistSignupResponse(BaseModel):
    message: str


class HealthResponse(BaseModel):
    status: str


class LaunchUpdateApproval(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approval: str = Field(max_length=80)


def _require_launch_operator(request: Request) -> None:
    expected_token = os.environ.get("LAUNCH_UPDATE_ADMIN_TOKEN", "")
    if len(expected_token.encode("utf-8")) < 32:
        raise HTTPException(
            status_code=503,
            detail="Launch update operator access is not configured.",
        )
    supplied = request.headers.get("authorization", "")
    scheme, _, token = supplied.partition(" ")
    if (
        scheme.lower() != "bearer"
        or not secrets.compare_digest(
            token.encode("utf-8"), expected_token.encode("utf-8")
        )
    ):
        raise HTTPException(
            status_code=401,
            detail="Launch update operator authorization is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def _launch_dispatch_status(request: Request):
    async with request.app.state.db_pool.acquire() as connection:
        return await connection.fetchrow(
            """
            SELECT started_at, completed_at, attempted_count,
                   accepted_count, failed_count
            FROM waitlist_launch_email_dispatches
            WHERE campaign_id = $1
            """,
            LAUNCH_UPDATE_CAMPAIGN_ID,
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _protection_keys()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required for the HABLAR API.")

    for warning in configuration_warnings():
        logger.warning("%s", warning)

    app.state.db_pool = await asyncpg.create_pool(
        **_database_connection_args(database_url),
        min_size=1,
        max_size=5,
        timeout=10,
        command_timeout=10,
    )
    try:
        yield
    finally:
        await app.state.db_pool.close()


limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app = FastAPI(
    title="HABLAR API",
    version="1.0.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.middleware("http")
async def reject_oversized_requests(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit() and int(content_length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "Request is too large."})
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    _request: Request, _exception: RequestValidationError
) -> JSONResponse:
    # Do not echo Pydantic's `input` field: it can contain contact information.
    return JSONResponse(
        status_code=422,
        content={"detail": "Check your contact details and required consent."},
    )


@app.get("/api/healthz", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/admin/launch-update")
async def preview_launch_update(request: Request) -> dict[str, object]:
    _require_launch_operator(request)
    dispatch = await _launch_dispatch_status(request)
    async with request.app.state.db_pool.acquire() as connection:
        eligible_count = await connection.fetchval(
            """
            SELECT COUNT(*)
            FROM waitlist_signups
            WHERE email_ciphertext IS NOT NULL
              AND consent_at IS NOT NULL
              AND consent_version = $1
            """,
            CONSENT_VERSION,
        )

    response: dict[str, object] = {
        "subject": LAUNCH_UPDATE_SUBJECT,
        "body": f"{LAUNCH_UPDATE_COPY}\n\n{SIGN_OFF}",
        "eligible_count": eligible_count,
        "approval_phrase": LAUNCH_UPDATE_APPROVAL,
        "state": "available" if dispatch is None else (
            "completed" if dispatch["completed_at"] is not None else "interrupted"
        ),
    }
    if dispatch is not None:
        response["delivery_summary"] = {
            "attempted": dispatch["attempted_count"],
            "accepted_by_smtp": dispatch["accepted_count"],
            "failed": dispatch["failed_count"],
            "uncertain": max(
                0,
                dispatch["attempted_count"]
                - dispatch["accepted_count"]
                - dispatch["failed_count"],
            ),
            "started_at": dispatch["started_at"],
            "completed_at": dispatch["completed_at"],
        }
    return response


@app.post("/api/admin/launch-update/send")
async def send_launch_update(
    request: Request,
    payload: LaunchUpdateApproval,
) -> dict[str, int | str]:
    _require_launch_operator(request)
    if not secrets.compare_digest(payload.approval, LAUNCH_UPDATE_APPROVAL):
        raise HTTPException(
            status_code=400,
            detail="Review the message and submit the exact approval phrase.",
        )

    mail_config, missing_settings = email_configuration()
    if missing_settings or mail_config is None:
        raise HTTPException(
            status_code=503,
            detail="Launch email delivery is not configured.",
        )

    async with request.app.state.db_pool.acquire() as connection:
        eligible_count = await connection.fetchval(
            """
            SELECT COUNT(*)
            FROM waitlist_signups
            WHERE email_ciphertext IS NOT NULL
              AND consent_at IS NOT NULL
              AND consent_version = $1
            """,
            CONSENT_VERSION,
        )
        if not eligible_count:
            raise HTTPException(
                status_code=409,
                detail="There are no eligible email signups to receive this update.",
            )

        claimed = await connection.fetchrow(
            """
            INSERT INTO waitlist_launch_email_dispatches (campaign_id)
            VALUES ($1)
            ON CONFLICT DO NOTHING
            RETURNING campaign_id
            """,
            LAUNCH_UPDATE_CAMPAIGN_ID,
        )
        if claimed is None:
            raise HTTPException(
                status_code=409,
                detail="The one-time launch update has already been claimed.",
            )

        recipients = await connection.fetch(
            """
            SELECT id, email_ciphertext
            FROM waitlist_signups
            WHERE email_ciphertext IS NOT NULL
              AND consent_at IS NOT NULL
              AND consent_version = $1
            ORDER BY created_at, id
            """,
            CONSENT_VERSION,
        )

    accepted = 0
    failed = 0
    attempted = 0
    for recipient in recipients:
        attempted += 1
        async with request.app.state.db_pool.acquire() as connection:
            await connection.execute(
                """
                UPDATE waitlist_launch_email_dispatches
                SET attempted_count = $2,
                    accepted_count = $3,
                    failed_count = $4
                WHERE campaign_id = $1
                """,
                LAUNCH_UPDATE_CAMPAIGN_ID,
                attempted,
                accepted,
                failed,
            )
        try:
            email = _decrypt_contact(bytes(recipient["email_ciphertext"]), "email")
            await send_email(mail_config, launch_update_message(email))
            accepted += 1
        except Exception:
            # SMTP exceptions can contain a recipient address or message data.
            failed += 1
            logger.warning("A launch update email could not be delivered.")
        async with request.app.state.db_pool.acquire() as connection:
            await connection.execute(
                """
                UPDATE waitlist_launch_email_dispatches
                SET attempted_count = $2,
                    accepted_count = $3,
                    failed_count = $4
                WHERE campaign_id = $1
                """,
                LAUNCH_UPDATE_CAMPAIGN_ID,
                attempted,
                accepted,
                failed,
            )

    async with request.app.state.db_pool.acquire() as connection:
        await connection.execute(
            """
            UPDATE waitlist_launch_email_dispatches
            SET completed_at = NOW(),
                attempted_count = $2,
                accepted_count = $3,
                failed_count = $4
            WHERE campaign_id = $1
            """,
            LAUNCH_UPDATE_CAMPAIGN_ID,
            attempted,
            accepted,
            failed,
        )
    logger.info(
        "One-time launch update finished: attempted=%d accepted=%d failed=%d",
        attempted,
        accepted,
        failed,
    )
    return {
        "state": "completed",
        "attempted": attempted,
        "accepted_by_smtp": accepted,
        "failed": failed,
        "uncertain": 0,
    }


@app.get("/", response_model=HealthResponse, include_in_schema=False)
async def service_root() -> HealthResponse:
    return HealthResponse(status="ok")


@app.post(
    "/api/waitlist",
    response_model=WaitlistSignupResponse,
    status_code=201,
)
@limiter.limit("60/minute")
async def create_waitlist_signup(
    request: Request,
    payload: WaitlistSignupInput,
) -> WaitlistSignupResponse:
    email = str(payload.email) if payload.email else None
    phone = payload.phone
    email_ciphertext = _encrypt_contact(email, "email") if email else None
    email_lookup_hash = _contact_lookup_hash(email, "email") if email else None
    phone_ciphertext = _encrypt_contact(phone, "phone") if phone else None
    phone_lookup_hash = _contact_lookup_hash(phone, "phone") if phone else None
    mail_config, missing_settings = email_configuration()
    smtp_ready = mail_config is not None and not missing_settings

    query = """
        INSERT INTO waitlist_signups (
            email_ciphertext,
            email_lookup_hash,
            phone_ciphertext,
            phone_lookup_hash,
            encryption_key_version,
            consent_version,
            privacy_notice_version,
            terms_version
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
        RETURNING id, created_at
    """
    confirmation_log_id = None
    admin_log_id = None
    async with request.app.state.db_pool.acquire() as connection:
        async with connection.transaction():
            inserted_signup = await connection.fetchrow(
                query,
                email_ciphertext,
                email_lookup_hash,
                phone_ciphertext,
                phone_lookup_hash,
                ENCRYPTION_KEY_VERSION,
                CONSENT_VERSION,
                PRIVACY_NOTICE_VERSION,
                TERMS_VERSION,
            )
            if inserted_signup:
                if missing_settings:
                    logger.warning(
                        "Waitlist email delivery skipped because required settings are "
                        "missing or invalid: %s",
                        ", ".join(missing_settings),
                    )

                if email and smtp_ready:
                    confirmation_status = "queued"
                    confirmation_reason = None
                elif not email:
                    confirmation_status = "skipped"
                    confirmation_reason = "no_email_address"
                else:
                    confirmation_status = "skipped"
                    confirmation_reason = "smtp_configuration_unavailable"

                if smtp_ready and mail_config.admin_recipient:
                    admin_status = "queued"
                    admin_reason = None
                elif not smtp_ready:
                    admin_status = "skipped"
                    admin_reason = "smtp_configuration_unavailable"
                elif mail_config.admin_recipient_invalid:
                    admin_status = "skipped"
                    admin_reason = "admin_address_invalid"
                else:
                    admin_status = "skipped"
                    admin_reason = "admin_recipient_not_configured"

                confirmation_log_id = await _insert_waitlist_email_log(
                    connection,
                    inserted_signup["id"],
                    "signup_confirmation",
                    confirmation_status,
                    confirmation_reason,
                )
                admin_log_id = await _insert_waitlist_email_log(
                    connection,
                    inserted_signup["id"],
                    "admin_signup_notice",
                    admin_status,
                    admin_reason,
                )

    if inserted_signup:
        if smtp_ready and mail_config:
            if email:
                await _send_waitlist_email_with_log(
                    request.app.state.db_pool,
                    confirmation_log_id,
                    mail_config,
                    confirmation_message(email),
                    "Waitlist confirmation email",
                )
            if mail_config.admin_recipient:
                await _send_waitlist_email_with_log(
                    request.app.state.db_pool,
                    admin_log_id,
                    mail_config,
                    admin_notification_message(
                        mail_config.admin_recipient,
                        email=email,
                        phone=phone,
                        submitted_at=inserted_signup["created_at"],
                    ),
                    "Waitlist administrator notification",
                )
            else:
                if mail_config.admin_recipient_invalid:
                    logger.warning(
                        "Waitlist administrator notification skipped because "
                        "ADMIN_NOTIFICATION_EMAIL is invalid."
                    )
                else:
                    logger.warning(
                        "Waitlist administrator notification skipped because "
                        "ADMIN_NOTIFICATION_EMAIL is not configured."
                    )

    # Keep the response identical for new and existing contacts. It makes no
    # claim that an email was delivered, which may be unavailable or fail.
    return WaitlistSignupResponse(
        message=(
            "Thanks for signing up — we’ve recorded your contact for one HABLAR "
            "launch update."
        )
    )
