from datetime import datetime, timezone

from schoolscraper.history import History


def test_record_and_latest(tmp_path):
    h = History(str(tmp_path / "h.db"))
    started = datetime.now(timezone.utc)
    h.record(user="bob", started_at=started, fetched=10, deduped=8, errors=[])
    h.record(user="bob", started_at=started, fetched=12, deduped=10, errors=["schoology: 401"])
    h.record(user="alice", started_at=started, fetched=5, deduped=5, errors=[])
    latest = h.latest_per_user()
    assert set(latest.keys()) == {"bob", "alice"}
    assert latest["bob"].fetched in (10, 12)
    assert latest["alice"].ok is True


def test_recent_for_user(tmp_path):
    h = History(str(tmp_path / "h.db"))
    for i in range(5):
        h.record(
            user="bob",
            started_at=datetime(2026, 1, 1 + i, tzinfo=timezone.utc),
            fetched=i, deduped=i, errors=[],
        )
    recent = h.recent_for_user("bob", limit=3)
    assert len(recent) == 3
    assert recent[0].fetched == 4
