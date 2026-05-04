from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from .cache import Cache
from .models import Assignment, AssessmentType
from .users import UserStore

log = logging.getLogger(__name__)


# ---------- response builders ----------

def _speak(text: str, end: bool = True) -> dict[str, Any]:
    return {
        "version": "1.0",
        "response": {
            "outputSpeech": {"type": "PlainText", "text": text},
            "shouldEndSession": end,
        },
    }


def _ask(prompt: str, reprompt: str | None = None) -> dict[str, Any]:
    resp = _speak(prompt, end=False)
    if reprompt:
        resp["response"]["reprompt"] = {
            "outputSpeech": {"type": "PlainText", "text": reprompt}
        }
    return resp


# ---------- intent helpers ----------

def _get_slot(intent: dict[str, Any], name: str) -> str | None:
    slot = (intent.get("slots") or {}).get(name) or {}
    value = slot.get("value")
    return value.strip() if isinstance(value, str) and value.strip() else None


def _resolve_user(slot_value: str | None, store: UserStore) -> Any:
    if not slot_value:
        users = store.list()
        if len(users) == 1:
            return users[0]
        return None
    candidate = slot_value.lower().strip()
    user = store.get(candidate)
    if user:
        return user
    # Allow matching by display_name (e.g., "Bob" -> bob)
    for u in store.list():
        if u.display_name.lower() == candidate or u.name == candidate:
            return u
    return None


def _format_due(due: datetime | None, now: datetime) -> str:
    if not due:
        return "no due date"
    delta_days = (due.date() - now.date()).days
    if delta_days == 0:
        return "today"
    if delta_days == 1:
        return "tomorrow"
    if delta_days < 0:
        return "past due"
    if delta_days < 7:
        return due.strftime("%A")
    return due.strftime("%A, %B %d")


def _summarize(items: list[Assignment], now: datetime, limit: int = 5) -> str:
    if not items:
        return "Nothing's coming up."
    parts = []
    for a in items[:limit]:
        parts.append(f"{a.type.value} in {a.course}, {a.title}, {_format_due(a.due, now)}")
    extra = "" if len(items) <= limit else f", and {len(items) - limit} more"
    return "; ".join(parts) + extra + "."


# ---------- intents ----------

def handle_request(
    body: dict[str, Any],
    *,
    store: UserStore,
    cache: Cache,
    expected_skill_id: str = "",
) -> dict[str, Any]:
    """Parse an Alexa Skills Kit request envelope and produce a response."""
    session = body.get("session") or {}
    application = (session.get("application") or {}).get("applicationId") or ""
    if expected_skill_id and application != expected_skill_id:
        log.warning("Rejecting Alexa request with skill id %r", application)
        return _speak("Sorry, this skill is not authorized.")

    request = body.get("request") or {}
    rtype = request.get("type")
    if rtype == "LaunchRequest":
        return _ask(
            "Welcome to Study Buddy. You can ask, what's due this week, "
            "or, do I have any tests tomorrow.",
            "What would you like to know?",
        )
    if rtype == "SessionEndedRequest":
        return _speak("Goodbye.")
    if rtype != "IntentRequest":
        return _speak("I didn't catch that.")

    intent = request.get("intent") or {}
    name = intent.get("name", "")
    return _dispatch_intent(name, intent, store=store, cache=cache)


def _dispatch_intent(
    name: str, intent: dict[str, Any], *, store: UserStore, cache: Cache
) -> dict[str, Any]:
    now = datetime.utcnow()
    if name == "AMAZON.HelpIntent":
        return _ask(
            "You can ask: what's due this week, do I have any tests tomorrow, "
            "or what should I study tonight. If multiple students are set up, "
            "include the name, like, what's due for Bob.",
            "What would you like to know?",
        )
    if name in ("AMAZON.StopIntent", "AMAZON.CancelIntent"):
        return _speak("Okay.")
    if name == "AMAZON.FallbackIntent":
        return _ask("Sorry, I didn't get that. Try asking what's due this week.")

    if name == "UpcomingWorkIntent":
        return _intent_upcoming(intent, store, cache, now)
    if name == "NextStudyIntent":
        return _intent_next_study(intent, store, cache, now)

    log.info("Unknown intent %s", name)
    return _ask("I'm not sure how to help with that. Ask what's due this week?")


def _intent_upcoming(
    intent: dict[str, Any], store: UserStore, cache: Cache, now: datetime
) -> dict[str, Any]:
    user = _resolve_user(_get_slot(intent, "Student"), store)
    if user is None:
        return _ask("Which student? Try, what's due for Bob this week.")

    days = _parse_days_slot(_get_slot(intent, "DateRange")) or 7
    type_filter = _parse_type_slot(_get_slot(intent, "WorkType"))

    items = cache.list(
        user=user.name,
        type_filter=type_filter,
        since=now - timedelta(hours=12),
        until=now + timedelta(days=days),
    )
    if not items:
        kind = type_filter.value + "s" if type_filter else "work"
        return _speak(f"{user.display_name} has no {kind} due in the next {days} days.")
    intro = f"For {user.display_name}, in the next {days} days: "
    return _speak(intro + _summarize(items, now))


def _intent_next_study(
    intent: dict[str, Any], store: UserStore, cache: Cache, now: datetime
) -> dict[str, Any]:
    user = _resolve_user(_get_slot(intent, "Student"), store)
    if user is None:
        return _ask("Which student should I look up?")
    items = cache.list(user=user.name, since=now - timedelta(hours=12))
    if not items:
        return _speak(f"{user.display_name} has nothing upcoming to study for.")
    a = items[0]
    return _speak(
        f"{user.display_name}'s next assessment is {a.title} in {a.course}, "
        f"due {_format_due(a.due, now)}. Open the app to get a study pack."
    )


def _parse_days_slot(value: str | None) -> int | None:
    """Accept ISO-8601 duration / week-keyword from Alexa's AMAZON.DURATION
    or AMAZON.DATE slot values.

    Examples:
      'P7D'   -> 7
      'P1W'   -> 7
      'today' -> 1
      'tomorrow' -> 2
    """
    if not value:
        return None
    v = value.lower().strip()
    if v == "today":
        return 1
    if v == "tomorrow":
        return 2
    if v.startswith("p") and v.endswith("w"):
        try:
            return int(v[1:-1]) * 7
        except ValueError:
            return None
    if v.startswith("p") and v.endswith("d"):
        try:
            return int(v[1:-1])
        except ValueError:
            return None
    if v.endswith("-w"):  # e.g., "2026-W18"
        return 7
    return None


def _parse_type_slot(value: str | None) -> AssessmentType | None:
    if not value:
        return None
    v = value.lower().strip().rstrip("s")
    mapping = {
        "test": AssessmentType.TEST,
        "exam": AssessmentType.TEST,
        "quiz": AssessmentType.QUIZ,
        "assignment": AssessmentType.ASSIGNMENT,
        "homework": AssessmentType.ASSIGNMENT,
        "project": AssessmentType.PROJECT,
    }
    return mapping.get(v)
