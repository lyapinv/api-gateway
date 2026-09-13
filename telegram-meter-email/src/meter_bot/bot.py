from __future__ import annotations

import logging
from datetime import date

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Filter
from aiogram.types import Message

from meter_bot.config import Settings
from meter_bot.mailer import send_readings_email
from meter_bot.parser import FORMAT_HINT, ParseError, parse_readings

logger = logging.getLogger(__name__)


class AllowedChatFilter(Filter):
    def __init__(self, chat_id: int) -> None:
        self.chat_id = chat_id

    async def __call__(self, message: Message) -> bool:
        return message.chat is not None and message.chat.id == self.chat_id


def _user_label(message: Message) -> str:
    user = message.from_user
    if user is None:
        return "unknown"
    if user.username:
        return f"@{user.username}"
    return f"{user.full_name} ({user.id})"


def create_dispatcher(settings: Settings) -> Dispatcher:
    dp = Dispatcher()

    @dp.message(AllowedChatFilter(settings.telegram_chat_id), F.text)
    async def handle_readings(message: Message) -> None:
        user = message.from_user
        if settings.telegram_allowed_user_ids:
            if user is None or user.id not in settings.telegram_allowed_user_ids:
                await message.answer("Нет прав на отправку показаний.")
                return

        text = message.text or ""
        try:
            readings = parse_readings(text)
        except ParseError as exc:
            await message.answer(str(exc) or FORMAT_HINT)
            return

        today = date.today().isoformat()
        try:
            await send_readings_email(
                settings,
                readings=readings,
                date=today,
                telegram_user=_user_label(message),
            )
        except Exception:
            logger.exception(
                "Failed to send meter email for message_id=%s",
                message.message_id,
            )
            await message.answer("Не удалось отправить email. Попробуйте позже.")
            return

        await message.answer(
            f"Отправлено: гор-{readings.hot}, хол-{readings.cold}"
        )

    return dp


async def run_bot(settings: Settings) -> None:
    bot = Bot(token=settings.telegram_bot_token)
    dp = create_dispatcher(settings)
    logger.info("Starting bot for chat_id=%s", settings.telegram_chat_id)
    await dp.start_polling(bot)