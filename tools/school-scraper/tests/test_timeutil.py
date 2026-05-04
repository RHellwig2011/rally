from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from schoolscraper.timeutil import now, parse_local, relative_phrase, to_local


def test_now_is_aware():
    n = now("America/New_York")
    assert n.tzinfo is not None


def test_parse_local_naive_assumed_local():
    dt = parse_local("2026-05-04T15:00:00", "America/New_York")
    assert dt is not None
    assert dt.tzinfo is not None
    assert dt.astimezone(timezone.utc).hour == 19


def test_parse_local_keeps_offset():
    dt = parse_local("2026-05-04T15:00:00+00:00", "America/New_York")
    assert dt is not None
    assert dt.astimezone(timezone.utc).hour == 15


def test_to_local_converts():
    utc = datetime(2026, 5, 4, 18, 0, tzinfo=timezone.utc)
    ny = to_local(utc, "America/New_York")
    assert ny.hour == 14


def test_relative_phrase_today_tomorrow():
    ref = datetime(2026, 5, 4, 9, 0, tzinfo=ZoneInfo("America/New_York"))
    today = ref + timedelta(hours=4)
    tomorrow = ref + timedelta(days=1)
    next_week = ref + timedelta(days=10)
    assert relative_phrase(today, ref) == "today"
    assert relative_phrase(tomorrow, ref) == "tomorrow"
    assert "May" in relative_phrase(next_week, ref)


def test_relative_phrase_handles_naive():
    ref = datetime(2026, 5, 4, 9, 0, tzinfo=ZoneInfo("America/New_York"))
    naive_tomorrow = datetime(2026, 5, 5, 13, 0)
    phrase = relative_phrase(naive_tomorrow, ref)
    assert phrase != "no due date"
