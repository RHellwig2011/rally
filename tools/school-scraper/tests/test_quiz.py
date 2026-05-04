from schoolscraper.quiz import Card, QuizStore, _parse_cards


def test_parse_cards_qa_format():
    text = """
    Q: What is the powerhouse of the cell?
    A: The mitochondrion.

    Q: Name three organelles.
    A: Nucleus, mitochondria, ribosomes.
    """
    cards = _parse_cards(text)
    assert len(cards) == 2
    assert cards[0].question.startswith("What is")
    assert cards[0].answer.startswith("The mitochondrion")


def test_parse_cards_numbered():
    text = """
    1. Q: First?
       A: Yes.
    2. Q: Second?
       A: No.
    """
    cards = _parse_cards(text)
    assert len(cards) == 2


def test_parse_cards_empty():
    assert _parse_cards("") == []


def test_quiz_store_round_trip(tmp_path):
    store = QuizStore(str(tmp_path / "q.db"))
    cards = [Card(question="q1", answer="a1"), Card(question="q2", answer="a2")]
    store.store(user="bob", dedup_key="abc", title="Test", course="Bio", cards=cards)

    fetched = store.get("bob", "abc")
    assert fetched is not None
    assert len(fetched) == 2
    assert fetched[0].question == "q1"


def test_quiz_store_latest_for_user(tmp_path):
    store = QuizStore(str(tmp_path / "q.db"))
    store.store(user="bob", dedup_key="aaa", title="Old", course="X",
                cards=[Card(question="x", answer="y")])
    store.store(user="bob", dedup_key="bbb", title="New", course="Y",
                cards=[Card(question="z", answer="w")])
    latest = store.latest_for_user("bob")
    assert latest is not None
    title, course, cards = latest
    assert title == "New"
    assert cards[0].question == "z"


def test_quiz_store_unknown_user(tmp_path):
    store = QuizStore(str(tmp_path / "q.db"))
    assert store.latest_for_user("alice") is None
    assert store.get("alice", "x") is None
