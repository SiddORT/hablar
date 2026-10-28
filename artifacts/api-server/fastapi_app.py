from __future__ import annotations

import hashlib
import hmac
import logging
import os
import re
from contextlib import asynccontextmanager
from functools import lru_cache
from typing import Annotated
from urllib.parse import parse_qsl, unquote, urlencode, urlsplit, urlunsplit

import asyncpg
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from fastapi import FastAPI, Request
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
    send_email,
)


CONSENT_VERSION = "waitlist-launch-email-v2"
PRIVACY_NOTICE_VERSION = "draft-2026-10-28"
TERMS_VERSION = "draft-2026-10-27"
ENCRYPTION_KEY_VERSION = 1
PHONE_PATTERN = re.compile(r"^\+[1-9][0-9]{7,14}$")
MAX_BODY_BYTES = 4096
logger = logging.getLogger("hablar.waitlist")


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
    async with request.app.state.db_pool.acquire() as connection:
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
        mail_config, missing_settings = email_configuration()
        if missing_settings:
            logger.warning(
                "Waitlist email delivery skipped because required settings are "
                "missing or invalid: %s",
                ", ".join(missing_settings),
            )
        elif mail_config:
            if email:
                try:
                    await send_email(
                        mail_config,
                        confirmation_message(email),
                    )
                except Exception:
                    # Do not log SMTP exceptions; they can include message headers.
                    logger.warning("Waitlist confirmation email could not be sent.")
            if mail_config.admin_recipient:
                try:
                    await send_email(
                        mail_config,
                        admin_notification_message(
                            mail_config.admin_recipient,
                            email=email,
                            phone=phone,
                            submitted_at=inserted_signup["created_at"],
                        ),
                    )
                except Exception:
                    # SMTP exceptions may contain recipient or message data.
                    logger.warning(
                        "Waitlist administrator notification could not be sent."
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
            "Thanks. Your contact has been recorded for one launch update. "
            "For new email signups, a confirmation is sent only when email "
            "delivery is available."
        )
    )
