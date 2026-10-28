from __future__ import annotations

import asyncio
import html
import os
import re
import smtplib
import ssl
from dataclasses import dataclass
from datetime import datetime, timezone
from email.message import EmailMessage
from email.utils import parseaddr


CONFIRMATION_SUBJECT = "You’re on the list — HABLAR is coming soon"
CONFIRMATION_COPY = (
    "Thank you for signing up for HABLAR’s one launch update. This email "
    "confirms your signup; it isn’t the launch update itself. We’ll send that "
    "update when HABLAR is ready. We’re building a space for honest "
    "conversations and thoughtful listening. More soon."
)
LAUNCH_UPDATE_SUBJECT = "A HABLAR update"
LAUNCH_UPDATE_COPY = (
    "Here is the one launch update you requested. HABLAR is preparing a space "
    "for honest conversations and thoughtful listening. Thank you for being "
    "on the list. This message does not set a launch date or sign you up for "
    "ongoing marketing or SMS."
)
SIGN_OFF = "HABLAR — Come as you are. Speak as you feel."
_EMAIL_PATTERN = re.compile(r"^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$")


@dataclass(frozen=True)
class EmailSettings:
    host: str
    port: int
    username: str
    password: str
    sender: str
    admin_recipient: str | None
    admin_recipient_invalid: bool = False


def _valid_email(value: str) -> bool:
    if any(character in value for character in "\r\n"):
        return False
    parsed_name, parsed_address = parseaddr(value)
    return not parsed_name and parsed_address == value and bool(_EMAIL_PATTERN.fullmatch(value))


def email_configuration() -> tuple[EmailSettings | None, list[str]]:
    """Read SMTP settings without ever exposing their values in diagnostics."""
    required = {
        "SMTP_HOST": os.environ.get("SMTP_HOST", "").strip(),
        "SMTP_PORT": os.environ.get("SMTP_PORT", "").strip(),
        "SMTP_USERNAME": os.environ.get("SMTP_USERNAME", "").strip(),
        "SMTP_PASSWORD": os.environ.get("SMTP_PASSWORD", ""),
        "SMTP_FROM_EMAIL": os.environ.get("SMTP_FROM_EMAIL", "").strip(),
    }
    missing = [name for name, value in required.items() if not value]
    if required["SMTP_FROM_EMAIL"] and not _valid_email(required["SMTP_FROM_EMAIL"]):
        missing.append("SMTP_FROM_EMAIL")
    try:
        port = int(required["SMTP_PORT"]) if required["SMTP_PORT"] else 0
        if not 1 <= port <= 65535:
            raise ValueError
    except ValueError:
        if "SMTP_PORT" not in missing:
            missing.append("SMTP_PORT")
        port = 0

    if missing:
        return None, sorted(set(missing))

    admin_raw = os.environ.get("ADMIN_NOTIFICATION_EMAIL", "").strip()
    admin_invalid = bool(admin_raw) and not _valid_email(admin_raw)
    return (
        EmailSettings(
            host=required["SMTP_HOST"],
            port=port,
            username=required["SMTP_USERNAME"],
            password=required["SMTP_PASSWORD"],
            sender=required["SMTP_FROM_EMAIL"],
            admin_recipient=admin_raw if admin_raw and not admin_invalid else None,
            admin_recipient_invalid=admin_invalid,
        ),
        [],
    )


def configuration_warnings() -> list[str]:
    settings, missing = email_configuration()
    if missing:
        return [f"Waitlist SMTP delivery is missing or has invalid settings: {', '.join(missing)}."]
    if settings and settings.admin_recipient_invalid:
        return ["Waitlist administrator notifications are disabled because ADMIN_NOTIFICATION_EMAIL is invalid."]
    if settings and not settings.admin_recipient:
        return ["Waitlist administrator notifications are disabled because ADMIN_NOTIFICATION_EMAIL is not configured."]
    return []


def confirmation_message(recipient: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = CONFIRMATION_SUBJECT
    message["To"] = recipient
    message.set_content(f"{CONFIRMATION_COPY}\n\n{SIGN_OFF}")
    message.add_alternative(
        f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{html.escape(CONFIRMATION_SUBJECT)}</title>
  </head>
  <body style="margin:0;background:#f7f3ed;color:#28352f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your HABLAR signup is confirmed.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ed;padding:32px 14px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:30px 32px 12px;background:#e9f0e8;color:#35594c;font-size:13px;font-weight:bold;letter-spacing:2px;">HABLAR</td></tr>
          <tr><td style="padding:24px 32px 8px;">
            <h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:#28352f;">You’re on the list</h1>
            <p style="margin:0;font-size:16px;line-height:1.7;">{html.escape(CONFIRMATION_COPY)}</p>
            <p style="margin:26px 0 0;font-size:15px;line-height:1.6;font-weight:bold;color:#35594c;">{html.escape(SIGN_OFF)}</p>
          </td></tr>
          <tr><td style="padding:18px 32px 28px;color:#66716b;font-size:12px;line-height:1.6;">You received this message because an email address was used to sign up for HABLAR updates.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
""",
        subtype="html",
    )
    return message


def launch_update_message(recipient: str) -> EmailMessage:
    message = EmailMessage()
    message["Subject"] = LAUNCH_UPDATE_SUBJECT
    message["To"] = recipient
    message.set_content(f"{LAUNCH_UPDATE_COPY}\n\n{SIGN_OFF}")
    message.add_alternative(
        f"""\
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{html.escape(LAUNCH_UPDATE_SUBJECT)}</title>
  </head>
  <body style="margin:0;background:#f7f3ed;color:#28352f;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ed;padding:32px 14px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:30px 32px 12px;background:#e9f0e8;color:#35594c;font-size:13px;font-weight:bold;letter-spacing:2px;">HABLAR</td></tr>
          <tr><td style="padding:24px 32px 28px;">
            <h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;color:#28352f;">A HABLAR update</h1>
            <p style="margin:0;font-size:16px;line-height:1.7;">{html.escape(LAUNCH_UPDATE_COPY)}</p>
            <p style="margin:26px 0 0;font-size:15px;line-height:1.6;font-weight:bold;color:#35594c;">{html.escape(SIGN_OFF)}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>
""",
        subtype="html",
    )
    return message


def admin_notification_message(
    recipient: str,
    *,
    email: str | None,
    phone: str | None,
    submitted_at: datetime,
) -> EmailMessage:
    if submitted_at.tzinfo is None:
        submitted_at = submitted_at.replace(tzinfo=timezone.utc)
    timestamp = submitted_at.astimezone(timezone.utc).isoformat(timespec="seconds")
    contacts = []
    if email:
        contacts.append(("Email address", email))
    if phone:
        contacts.append(("Phone number", phone))
    contact_text = "\n".join(f"{label}: {value}" for label, value in contacts)
    contact_html = "".join(
        f"<li><strong>{html.escape(label)}:</strong> {html.escape(value)}</li>"
        for label, value in contacts
    )

    message = EmailMessage()
    message["Subject"] = "New HABLAR waitlist signup"
    message["To"] = recipient
    message.set_content(
        f"A new HABLAR waitlist signup was saved.\n\n"
        f"Submission time (UTC): {timestamp}\n{contact_text}"
    )
    message.add_alternative(
        f"""\
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f7f3ed;color:#28352f;font-family:Arial,Helvetica,sans-serif;padding:24px 14px;">
    <main style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;padding:28px;">
      <p style="color:#35594c;font-size:13px;font-weight:bold;letter-spacing:2px;">HABLAR</p>
      <h1 style="font-size:23px;line-height:1.3;">New waitlist signup</h1>
      <p style="line-height:1.6;">A new landing-page signup was saved.</p>
      <p><strong>Submission time (UTC):</strong> {html.escape(timestamp)}</p>
      <ul style="line-height:1.8;">{contact_html}</ul>
    </main>
  </body>
</html>
""",
        subtype="html",
    )
    return message


def _send_smtp(settings: EmailSettings, message: EmailMessage) -> None:
    message["From"] = settings.sender
    context = ssl.create_default_context()
    if settings.port == 465:
        with smtplib.SMTP_SSL(
            settings.host, settings.port, timeout=10, context=context
        ) as server:
            server.login(settings.username, settings.password)
            refused = server.send_message(message)
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)
        return

    with smtplib.SMTP(settings.host, settings.port, timeout=10) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(settings.username, settings.password)
        refused = server.send_message(message)
        if refused:
            raise smtplib.SMTPRecipientsRefused(refused)


async def send_email(settings: EmailSettings, message: EmailMessage) -> None:
    await asyncio.to_thread(_send_smtp, settings, message)
