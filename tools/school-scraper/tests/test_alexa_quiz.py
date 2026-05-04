from schoolscraper import alexa
from schoolscraper.cache import Cache
from schoolscraper.crypto import Vault
from schoolscraper.quiz import Card, QuizStore
from schoolscraper.users import UserStore


def _setup(tmp_path):
    db = str(tmp_path / "q.db")
    store = UserStore(db, Vault("k"))
    cache = Cache(db)
    quizzes = QuizStore(db)
    store.upsert(name="bob", display_name="Bob")
    quizzes.store(
        user="bob", dedup_key="abc", title="Cell Test", course="Biology",
        cards=[
            Card(question="What's the powerhouse of the cell?", answer="Mitochondrion."),
            Card(question="Define osmosis.", answer="Water moving across a membrane."),
        ],
    )
    return store, cache, quizzes


def _intent_request(intent_name, slots=None, attrs=None):
    return {
        "session": {
            "application": {"applicationId": "amzn1.ask.skill.test"},
            "attributes": attrs or {},
        },
        "request": {
            "type": "IntentRequest",
            "intent": {
                "name": intent_name,
                "slots": {k: {"name": k, "value": v} for k, v in (slots or {}).items()},
            },
        },
    }


def test_quiz_me_starts_session(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    req = _intent_request("QuizMeIntent", {"Student": "Bob"})
    resp = alexa.handle_request(req, store=store, cache=cache, quizzes=quizzes, timezone="UTC")
    text = resp["response"]["outputSpeech"]["text"]
    assert "powerhouse" in text
    assert resp["response"]["shouldEndSession"] is False
    attrs = resp["sessionAttributes"]
    assert attrs["quiz_active"] is True
    assert attrs["quiz_total"] == 2
    assert attrs["quiz_index"] == 1


def test_quiz_yes_advances(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    open_resp = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    attrs = open_resp["sessionAttributes"]
    yes = alexa.handle_request(
        _intent_request("AMAZON.YesIntent", attrs=attrs),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    text = yes["response"]["outputSpeech"]["text"]
    assert "Mitochondrion" in text
    assert "osmosis" in text.lower() or "Define" in text
    assert yes["sessionAttributes"]["quiz_score"] == 1


def test_quiz_no_advances_without_score(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    open_resp = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    attrs = open_resp["sessionAttributes"]
    no_resp = alexa.handle_request(
        _intent_request("AMAZON.NoIntent", attrs=attrs),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    assert no_resp["sessionAttributes"]["quiz_score"] == 0


def test_quiz_finishes(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    state = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    state = alexa.handle_request(
        _intent_request("AMAZON.YesIntent", attrs=state["sessionAttributes"]),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    final = alexa.handle_request(
        _intent_request("AMAZON.YesIntent", attrs=state["sessionAttributes"]),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    text = final["response"]["outputSpeech"]["text"]
    assert "2 out of 2" in text
    assert final["response"]["shouldEndSession"] is True


def test_quiz_no_prepared(tmp_path):
    db = str(tmp_path / "q.db")
    store = UserStore(db, Vault("k"))
    cache = Cache(db)
    quizzes = QuizStore(db)
    store.upsert(name="bob", display_name="Bob")
    resp = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    assert "No quiz prepared" in resp["response"]["outputSpeech"]["text"]


def test_yes_outside_quiz_falls_through(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    resp = alexa.handle_request(
        _intent_request("AMAZON.YesIntent", attrs={}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC",
    )
    assert "not sure how to help" in resp["response"]["outputSpeech"]["text"]
