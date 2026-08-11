"""Timezone-aware datetime helpers.

The SQLite cache stores ISO-format strings; Schoology and PowerSchool emit
dates in mixed formats, sometimes naive. We normalize to UTC for storage and
convert to the configured local timezone for display and "tomorrow"-style
relative phrasing.
"""

from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo


def parse_local(value: str | None, tz: str) -> datetime | None:
    """Parse an ISO-ish string. If naive, assume the configured local zone.
    Always returns a TZ-aware datetime."""
    if not value:
        return None
    from dateutil import parser as dateparser

    try:
        dt = dateparser.parse(value)
    except (ValueError, TypeError):
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=ZoneInfo(tz))
    return dt


def now(tz: str) -> datetime:
    """Current time in the configured timezone (TZ-aware)."""
    return datetime.now(ZoneInfo(tz))


def to_local(dt: datetime | None, tz: str) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ZoneInfo(tz))


def relative_phrase(due: datetime | None, ref: datetime) -> str:
    """Human phrase relative to `ref` (e.g. 'today', 'tomorrow', 'Friday')."""
    if not due:
        return "no due date"
    due_local = to_local(due, str(ref.tzinfo)) or due
    delta_days = (due_local.date() - ref.date()).days
    if delta_days < 0:
        return "past due"
    if delta_days == 0:
        return "today"
    if delta_days == 1:
        return "tomorrow"
    if delta_days < 7:
        return due_local.strftime("%A")
    return due_local.strftime("%A, %B %d")
