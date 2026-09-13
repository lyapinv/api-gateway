from __future__ import annotations

from email.message import EmailMessage
from pathlib import Path

import aiosmtplib

from meter_bot.config import Settings
from meter_bot.parser import MeterReadings


def render_body(
    template: str,
    *,
    readings: MeterReadings,
    date: str,
    telegram_user: str,
) -> str:
    return template.format(
        hot=readings.hot,
        cold=readings.cold,
        date=date,
        telegram_user=telegram_user,
    )


def load_template(path: Path) -> str:
    return path.read_text(encoding="utf-8")


async def send_readings_email(
    settings: Settings,
    *,
    readings: MeterReadings,
    date: str,
    telegram_user: str,
) -> None:
    template = load_template(settings.mail_template_path)
    body = render_body(
        template,
        readings=readings,
        date=date,
        telegram_user=telegram_user,
    )

    message = EmailMessage()
    message["From"] = settings.mail_from
    message["To"] = settings.mail_to
    message["Subject"] = settings.mail_subject.format(date=date)
    message.set_content(body)

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_user or None,
        password=settings.smtp_password or None,
        start_tls=settings.smtp_use_tls,
    )