"""Proactive announcements via the Notify Me skill.

Notify Me (https://www.thomptronics.com/notify-me) is a free third-party
Alexa skill that exposes a webhook: POST a JSON body with an `accessCode`
and Alexa will speak (or push as a notification) the included text on the
linked Echo. We use it for once-a-day "what's due today/tomorrow" digests.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Iterable

import requests

from .cache import Cache
from .models import Assignment, AssessmentType
from .timeutil import now as tz_now, relative_phrase
from .users import User

log = logging.getLogger(__name__)

NOTIFY_ME_URL = "https://api.notifymyecho.com/v1/NotifyMe"


def _build_digest(items: Iterable[Assignment], *, user: User, ref) -> str:
    items = list(items)
    if not items:
        return f"Good morning! {user.display_name} has nothing due today or tomorrow. Have a great day."

    today, tomorrow = [], []
    for a in items:
        phrase = relative_phrase(a.due, ref)
        if phrase == "today":
            today.append(a)
        elif phrase == "tomorrow":
            tomorrow.append(a)

    parts: list[str] = [f"Good morning, {user.display_name}!"]
    if today:
        if any(a.type == AssessmentType.TEST for a in today):
            parts.append(
                "Heads up: you have a test today — "
                + ", ".join(f"{a.title} in {a.course}" for a in today if a.type == AssessmentType.TEST)
                + "."
            )
        other_today = [a for a in today if a.type != AssessmentType.TEST]
        if other_today:
            parts.append(
                "Due today: "
                + ", ".join(f"{a.title} ({a.course})" for a in other_today)
                + "."
            )
    if tomorrow:
        parts.append(
            "Tomorrow: "
            + ", ".join(f"{a.type.value} in {a.course}, {a.title}" for a in tomorrow)
            + "."
        )
    if not today and not tomorrow:
        return ""  # nothing relevant; skip
    return " ".join(parts)


def send_daily_digest(
    *, user: User, cache: Cache, timezone: str, access_code: str, dry_run: bool = False
) -> str:
    ref = tz_now(timezone)
    items = cache.list(
        user=user.name,
        since=ref - timedelta(hours=1),
        until=ref + timedelta(days=2),
    )
    text = _build_digest(items, user=user, ref=ref)
    if not text:
        log.info("[%s] digest empty; skipping", user.name)
        return ""
    if dry_run:
        return text
    resp = requests.post(
        NOTIFY_ME_URL,
        json={"notification": text, "accessCode": access_code},
        timeout=15,
    )
    resp.raise_for_status()
    log.info("[%s] digest sent (%d chars)", user.name, len(text))
    return text


def send_alert(text: str, *, access_code: str) -> None:
    """Push an arbitrary alert (e.g. 'sync failed for Bob')."""
    requests.post(
        NOTIFY_ME_URL,
        json={"notification": text, "accessCode": access_code},
        timeout=15,
    ).raise_for_status()
