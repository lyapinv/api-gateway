from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    telegram_bot_token: str
    telegram_chat_id: int
    telegram_allowed_user_ids: list[int] = Field(default_factory=list)

    smtp_host: str
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    mail_from: str
    mail_to: str
    mail_subject: str = "Показания счетчиков за {date}"
    mail_template_path: Path = Path("templates/meter_email.txt")

    @field_validator("telegram_allowed_user_ids", mode="before")
    @classmethod
    def parse_user_ids(cls, value: object) -> list[int]:
        if value is None or value == "":
            return []
        if isinstance(value, list):
            return [int(v) for v in value]
        return [int(part.strip()) for part in str(value).split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()