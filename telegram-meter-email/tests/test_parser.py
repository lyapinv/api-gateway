import pytest

from meter_bot.parser import ParseError, parse_readings


@pytest.mark.parametrize(
    ("text", "hot", "cold"),
    [
        ("гор-123, хол-321", 123, 321),
        ("гор:123, хол:321", 123, 321),
        ("гор 123; хол 321", 123, 321),
        ("хол-321, гор-123", 123, 321),
        ("HOT-10, COLD-20", 10, 20),
        ("горячая-5, холодная-7", 5, 7),
    ],
)
def test_parse_ok(text: str, hot: int, cold: int) -> None:
    readings = parse_readings(text)
    assert readings.hot == hot
    assert readings.cold == cold


@pytest.mark.parametrize(
    "text",
    [
        "",
        "привет",
        "гор-123",
        "хол-321",
        "газ-1, эл-2",
        "гор-abc, хол-321",
    ],
)
def test_parse_invalid(text: str) -> None:
    with pytest.raises(ParseError):
        parse_readings(text)