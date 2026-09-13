from __future__ import annotations

import asyncio
import logging
import sys

from meter_bot.bot import run_bot
from meter_bot.config import get_settings


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        stream=sys.stdout,
    )
    settings = get_settings()
    asyncio.run(run_bot(settings))


if __name__ == "__main__":
    main()