from datetime import datetime, timezone

from schoolscraper.ical import render
from schoolscraper.models import Assignment, AssessmentType, Source


def _assignment(**overrides):
    base = dict(
        id="x",
        source=Source.SCHOOLOGY,
        title="Cell Bio Test",
        course="Biology",
        type=AssessmentType.TEST,
        due=datetime(2026, 5, 10, 14, 0, tzinfo=timezone.utc),
        description="Covers ch 4-6",
        url="https://example.com",
        points=100.0,
    )
    base.update(overrides)
    return Assignment(**base)


def test_render_basic():
    ics = render([_assignment()], user="bob", calendar_name="Bob's School")
    assert ics.startswith("BEGIN:VCALENDAR\r\n")
    assert ics.endswith("END:VCALENDAR\r\n")
    assert "BEGIN:VEVENT" in ics
    assert "[TEST] Cell Bio Test (Biology)" in ics
    assert "DTSTART:20260510T140000Z" in ics
    assert "URL:https://example.com" in ics


def test_render_skips_no_due():
    a = _assignment(due=None)
    ics = render([a], user="bob", calendar_name="x")
    assert "BEGIN:VEVENT" not in ics


def test_render_escapes_special_chars():
    a = _assignment(title="Algebra; Quiz, part 2", description="line one\nline two")
    ics = render([a], user="bob", calendar_name="x")
    assert r"\;" in ics
    assert r"\," in ics
    assert r"\n" in ics


def test_render_folds_long_lines():
    a = _assignment(description="x" * 200)
    ics = render([a], user="bob", calendar_name="x")
    assert "\r\n " in ics
