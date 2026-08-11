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


def _fake_grader(verdict_word, note="ok"):
    from schoolscraper.grading import Verdict

    def grade(*, question, reference, answer):
        return Verdict(verdict=verdict_word, note=note)

    return grade


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
    assert attrs["quiz_grade_mode"] == "self"


def test_quiz_me_auto_mode_prompts_for_answer(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    req = _intent_request("QuizMeIntent", {"Student": "Bob"})
    resp = alexa.handle_request(
        req, store=store, cache=cache, quizzes=quizzes, timezone="UTC",
        grader=_fake_grader("correct"),
    )
    text = resp["response"]["outputSpeech"]["text"]
    assert "Say your answer" in text
    assert "yes or no" not in text
    assert resp["sessionAttributes"]["quiz_grade_mode"] == "auto"
    assert resp["sessionAttributes"]["quiz_pending_question"].startswith("What's")


def test_free_answer_correct_scores_and_advances(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    grader = _fake_grader("correct", note="Spot on.")
    start = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC", grader=grader,
    )
    resp = alexa.handle_request(
        _intent_request("FreeAnswerIntent", {"Answer": "the mitochondria"},
                        attrs=start["sessionAttributes"]),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC", grader=grader,
    )
    text = resp["response"]["outputSpeech"]["text"]
    assert "Correct!" in text
    assert "Spot on." in text
    assert "Mitochondrion." in text          # reveals full reference
    assert "osmosis" in text.lower()          # advanced to next question
    assert resp["sessionAttributes"]["quiz_score"] == 1


def test_free_answer_incorrect_no_score(tmp_path):
    store, cache, quizzes = _setup(tmp_path)
    grader = _fake_grader("incorrect", note="Not the right organelle.")
    start = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC", grader=grader,
    )
    resp = alexa.handle_request(
        _intent_request("FreeAnswerIntent", {"Answer": "the nucleus"},
                        attrs=start["sessionAttributes"]),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC", grader=grader,
    )
    text = resp["response"]["outputSpeech"]["text"]
    assert "Not quite." in text
    assert resp["sessionAttributes"]["quiz_score"] == 0


def test_free_answer_grader_error_falls_back(tmp_path):
    store, cache, quizzes = _setup(tmp_path)

    def boom(*, question, reference, answer):
        raise RuntimeError("model down")

    start = alexa.handle_request(
        _intent_request("QuizMeIntent", {"Student": "Bob"}),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC", grader=boom,
    )
    resp = alexa.handle_request(
        _intent_request("FreeAnswerIntent", {"Answer": "something"},
                        attrs=start["sessionAttributes"]),
        store=store, cache=cache, quizzes=quizzes, timezone="UTC", grader=boom,
    )
    text = resp["response"]["outputSpeech"]["text"]
    assert "couldn't grade" in text
    assert "yes or no" in text
    # Still in the quiz, same question pending.
    assert resp["sessionAttributes"]["quiz_active"] is True


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
