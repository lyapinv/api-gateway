from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class MeterReadings:
    hot: int
    cold: int


_PAIR = re.compile(
    r"(?is)^\s*"
    r"(?:гор(?:ячая)?|hot)\s*[-–:]?\s*(?P<hot>\d+)"
    r"\s*[,;]\s*"
    r"(?:хол(?:одная)?|cold)\s*[-–:]?\s*(?P<cold>\d+)"
    r"\s*$"
)

_PAIR_REVERSED = re.compile(
    r"(?is)^\s*"
    r"(?:хол(?:одная)?|cold)\s*[-–:]?\s*(?P<cold>\d+)"
    r"\s*[,;]\s*"
    r"(?:гор(?:ячая)?|hot)\s*[-–:]?\s*(?P<hot>\d+)"
    r"\s*$"
)

FORMAT_HINT = "Ожидаемый формат: «гор-123, хол-321»"


class ParseError(ValueError):
    """Message text is not a valid meter readings payload."""


def parse_readings(text: str) -> MeterReadings:
    raw = (text or "").strip()
    for pattern in (_PAIR, _PAIR_REVERSED):
        match = pattern.match(raw)
        if match:
            return MeterReadings(
                hot=int(match.group("hot")),
                cold=int(match.group("cold")),
            )
    raise ParseError(FORMAT_HINT)