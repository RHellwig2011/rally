from datetime import datetime, timedelta

from schoolscraper import alexa
from schoolscraper.cache import Cache
from schoolscraper.crypto import Vault
from schoolscraper.models import Assignment, AssessmentType, Source
from schoolscraper.users import UserStore


def _setup(tmp_path):
    db = str(tmp_path / "test.db")
    vault = Vault("k")
    store = UserStore(db, vault)
    cache = Cache(db)
    store.upsert(name="bob", display_name="Bob")
    cache.upsert_many(
        [
            Assignment(
                id="a1",
                source=Source.SCHOOLOGY,
                title="Cell Bio Test",
                course="Biology",
                type=AssessmentType.TEST,
                due=datetime.utcnow() + timedelta(days=2),
            ),
            Assignment(
                id="a2",
                source=Source.SCHOOLOGY,
                title="Algebra HW 4",
                course="Algebra II",
                type=AssessmentType.ASSIGNMENT,
                due=datetime.utcnow() + timedelta(days=5),
            ),
        ],
        user="bob",
    )
    return store, cache


def _intent_request(intent_name: str, slots: dict | None = None) -> dict:
    slot_envelope = {
        k: {"name": k, "value": v} for k, v in (slots or {}).items()
    }
    return {
        "session": {"application": {"applicationId": "amzn1.ask.skill.test"}},
        "request": {
            "type": "IntentRequest",
            "intent": {"name": intent_name, "slots": slot_envelope},
        },
    }


def test_launch_request(tmp_path):
    store, cache = _setup(tmp_path)
    body = {"session": {}, "request": {"type": "LaunchRequest"}}
    resp = alexa.handle_request(body, store=store, cache=cache)
    assert "Welcome" in resp["response"]["outputSpeech"]["text"]
    assert resp["response"]["shouldEndSession"] is False


def test_upcoming_intent_finds_items(tmp_path):
    store, cache = _setup(tmp_path)
    req = _intent_request("UpcomingWorkIntent", {"Student": "Bob"})
    resp = alexa.handle_request(req, store=store, cache=cache)
    text = resp["response"]["outputSpeech"]["text"]
    assert "Bob" in text
    assert "Cell Bio Test" in text


def test_upcoming_intent_filters_by_type(tmp_path):
    store, cache = _setup(tmp_path)
    req = _intent_request(
        "UpcomingWorkIntent", {"Student": "Bob", "WorkType": "test"}
    )
    resp = alexa.handle_request(req, store=store, cache=cache)
    text = resp["response"]["outputSpeech"]["text"]
    assert "Cell Bio Test" in text
    assert "Algebra HW 4" not in text


def test_next_study_intent(tmp_path):
    store, cache = _setup(tmp_path)
    req = _intent_request("NextStudyIntent", {"Student": "Bob"})
    resp = alexa.handle_request(req, store=store, cache=cache)
    text = resp["response"]["outputSpeech"]["text"]
    assert "Cell Bio Test" in text


def test_unknown_user(tmp_path):
    store, cache = _setup(tmp_path)
    req = _intent_request("UpcomingWorkIntent", {"Student": "Carol"})
    resp = alexa.handle_request(req, store=store, cache=cache)
    text = resp["response"]["outputSpeech"]["text"]
    assert "Which student" in text


def test_skill_id_check(tmp_path):
    store, cache = _setup(tmp_path)
    req = _intent_request("UpcomingWorkIntent", {"Student": "Bob"})
    resp = alexa.handle_request(
        req, store=store, cache=cache, expected_skill_id="amzn1.ask.skill.OTHER"
    )
    assert "not authorized" in resp["response"]["outputSpeech"]["text"]


def test_single_user_no_slot(tmp_path):
    store, cache = _setup(tmp_path)
    # No Student slot — should still resolve since only one user
    req = _intent_request("UpcomingWorkIntent", {})
    resp = alexa.handle_request(req, store=store, cache=cache)
    text = resp["response"]["outputSpeech"]["text"]
    assert "Bob" in text


def test_parse_days_slot():
    assert alexa._parse_days_slot("P7D") == 7
    assert alexa._parse_days_slot("P2W") == 14
    assert alexa._parse_days_slot("today") == 1
    assert alexa._parse_days_slot("tomorrow") == 2
    assert alexa._parse_days_slot(None) is None
    assert alexa._parse_days_slot("garbage") is None


def test_parse_type_slot():
    assert alexa._parse_type_slot("tests") == AssessmentType.TEST
    assert alexa._parse_type_slot("Quiz") == AssessmentType.QUIZ
    assert alexa._parse_type_slot("homework") == AssessmentType.ASSIGNMENT
    assert alexa._parse_type_slot(None) is None
