from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from .cache import Cache
from .models import Assignment, AssessmentType
from .quiz import QuizStore
from .timeutil import now as tz_now, relative_phrase
from .users import UserStore

log = logging.getLogger(__name__)


# ---------- response builders ----------

def _speak(
    text: str, end: bool = True, attrs: dict[str, Any] | None = None
) -> dict[str, Any]:
    resp: dict[str, Any] = {
        "version": "1.0",
        "response": {
            "outputSpeech": {"type": "PlainText", "text": text},
            "shouldEndSession": end,
        },
    }
    if attrs is not None:
        resp["sessionAttributes"] = attrs
    return resp


def _ask(
    prompt: str,
    reprompt: str | None = None,
    attrs: dict[str, Any] | None = None,
) -> dict[str, Any]:
    resp = _speak(prompt, end=False, attrs=attrs)
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
    for u in store.list():
        if u.display_name.lower() == candidate or u.name == candidate:
            return u
    return None


def _format_due(due: datetime | None, now: datetime) -> str:
    return relative_phrase(due, now)


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
    timezone: str = "America/New_York",
    quizzes: QuizStore | None = None,
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
    session_attrs = body.get("session", {}).get("attributes", {}) or {}
    return _dispatch_intent(
        name, intent, store=store, cache=cache,
        timezone=timezone, session_attrs=session_attrs, quizzes=quizzes,
    )


def _dispatch_intent(
    name: str,
    intent: dict[str, Any],
    *,
    store: UserStore,
    cache: Cache,
    timezone: str,
    session_attrs: dict[str, Any],
    quizzes: QuizStore | None,
) -> dict[str, Any]:
    now = tz_now(timezone)
    in_quiz = bool(session_attrs.get("quiz_active"))

    if in_quiz and name in ("AMAZON.YesIntent", "AMAZON.NoIntent"):
        return _quiz_advance(session_attrs, got_it=(name == "AMAZON.YesIntent"))

    if name == "AMAZON.HelpIntent":
        return _ask(
            "You can ask: what's due this week, do I have any tests tomorrow, "
            "what should I study tonight, or quiz me on my next test.",
            "What would you like to know?",
        )
    if name in ("AMAZON.StopIntent", "AMAZON.CancelIntent"):
        if in_quiz:
            score = session_attrs.get("quiz_score", 0)
            total = session_attrs.get("quiz_index", 0)
            return _speak(f"Quiz ended. You got {score} out of {total}.")
        return _speak("Okay.")
    if name == "AMAZON.FallbackIntent":
        return _ask("Sorry, I didn't get that. Try asking what's due this week.")

    if name == "UpcomingWorkIntent":
        return _intent_upcoming(intent, store, cache, now)
    if name == "NextStudyIntent":
        return _intent_next_study(intent, store, cache, now)
    if name == "QuizMeIntent":
        if quizzes is None:
            return _speak("Quiz mode is not configured on this server.")
        return _intent_quiz_me(intent, store, quizzes)

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


def _intent_quiz_me(
    intent: dict[str, Any], store: UserStore, quizzes: QuizStore
) -> dict[str, Any]:
    user = _resolve_user(_get_slot(intent, "Student"), store)
    if user is None:
        return _ask("Which student should I quiz?")
    latest = quizzes.latest_for_user(user.name)
    if not latest:
        return _speak(
            f"No quiz prepared for {user.display_name} yet. "
            "Ask the server to prepare one, then try again."
        )
    title, course, cards = latest
    if not cards:
        return _speak(f"The quiz set for {user.display_name} is empty.")
    first = cards[0]
    attrs = {
        "quiz_active": True,
        "quiz_user": user.name,
        "quiz_title": title,
        "quiz_index": 1,
        "quiz_total": len(cards),
        "quiz_score": 0,
        "quiz_pending_answer": first.answer,
        "quiz_remaining": [
            {"question": c.question, "answer": c.answer} for c in cards[1:]
        ],
    }
    return _ask(
        f"Quizzing {user.display_name} on {title} from {course}. "
        f"Question 1 of {len(cards)}: {first.question} "
        "Say your answer out loud, then say yes if you got it right, or no if not.",
        "Did you get it right? Say yes or no.",
        attrs=attrs,
    )


def _quiz_advance(attrs: dict[str, Any], *, got_it: bool) -> dict[str, Any]:
    pending_answer = attrs.get("quiz_pending_answer", "")
    score = int(attrs.get("quiz_score", 0)) + (1 if got_it else 0)
    remaining = list(attrs.get("quiz_remaining", []))
    index = int(attrs.get("quiz_index", 1))
    total = int(attrs.get("quiz_total", 0))

    feedback = ("Nice work! " if got_it else "No worries. ")
    feedback += f"The full answer was: {pending_answer}"

    if not remaining:
        final = f" You finished with {score} out of {total}. "
        if score == total:
            final += "Perfect score."
        elif score >= total * 0.7:
            final += "Solid review."
        else:
            final += "Worth another pass before the test."
        return _speak(feedback + final, attrs={})

    nxt = remaining.pop(0)
    new_attrs = dict(attrs)
    new_attrs.update(
        quiz_score=score,
        quiz_index=index + 1,
        quiz_pending_answer=nxt["answer"],
        quiz_remaining=remaining,
    )
    return _ask(
        f"{feedback} Question {index + 1} of {total}: {nxt['question']}",
        "Say your answer, then say yes or no.",
        attrs=new_attrs,
    )


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
    if v.endswith("-w"):
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
