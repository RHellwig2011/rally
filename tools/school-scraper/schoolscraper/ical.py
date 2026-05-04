"""Generate an iCalendar (RFC 5545) feed of upcoming assessments.

Subscribe a phone or Google Calendar to the URL served at
/api/users/{name}/calendar.ics and the dates show up alongside everything else.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Iterable

from .models import Assignment


_PRODID = "-//schoolscraper//EN"
_NEWLINE = "\r\n"


def _escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", r"\;")
        .replace(",", r"\,")
        .replace("\n", r"\n")
    )


def _fold(line: str) -> str:
    """Fold lines longer than 75 octets per RFC 5545."""
    if len(line) <= 75:
        return line
    out = [line[:75]]
    rest = line[75:]
    while rest:
        out.append(" " + rest[:74])
        rest = rest[74:]
    return _NEWLINE.join(out)


def _utc(dt: datetime) -> str:
    if dt.tzinfo is None:
        return dt.strftime("%Y%m%dT%H%M%SZ")
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _vevent(a: Assignment, *, user: str) -> list[str]:
    if a.due is None:
        return []
    uid_raw = f"{user}|{a.dedup_key()}|{a.id}"
    uid = hashlib.sha1(uid_raw.encode()).hexdigest() + "@schoolscraper"
    summary = f"[{a.type.value.upper()}] {a.title} ({a.course})"
    desc_parts = [a.description or ""]
    if a.url:
        desc_parts.append(f"Link: {a.url}")
    if a.points is not None:
        desc_parts.append(f"Points: {a.points}")
    desc = "\n".join(p for p in desc_parts if p)

    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{_utc(a.fetched_at)}",
        f"DTSTART:{_utc(a.due)}",
        f"DTEND:{_utc(a.due)}",
        f"SUMMARY:{_escape(summary)}",
        f"DESCRIPTION:{_escape(desc)}",
        f"CATEGORIES:{_escape(a.course)},{a.type.value}",
    ]
    if a.url:
        lines.append(f"URL:{a.url}")
    lines.append("END:VEVENT")
    return [_fold(line) for line in lines]


def render(assignments: Iterable[Assignment], *, user: str, calendar_name: str) -> str:
    out = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{_PRODID}",
        f"X-WR-CALNAME:{_escape(calendar_name)}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    for a in assignments:
        out.extend(_vevent(a, user=user))
    out.append("END:VCALENDAR")
    return _NEWLINE.join(out) + _NEWLINE
