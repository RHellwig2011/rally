from datetime import timedelta

from schoolscraper.cache import Cache
from schoolscraper.crypto import Vault
from schoolscraper.models import Assignment, AssessmentType, Source
from schoolscraper.notify import send_daily_digest
from schoolscraper.timeutil import now as tz_now
from schoolscraper.users import UserStore


def _setup_user(tmp_path):
    db = str(tmp_path / "n.db")
    store = UserStore(db, Vault("k"))
    cache = Cache(db)
    store.upsert(name="bob", display_name="Bob")
    return store, cache, store.get("bob")


def test_digest_empty_when_nothing_due(tmp_path):
    _, cache, user = _setup_user(tmp_path)
    text = send_daily_digest(
        user=user, cache=cache, timezone="America/New_York",
        access_code="x", dry_run=True,
    )
    assert "nothing due" in text.lower()


def test_digest_mentions_test_today(tmp_path):
    _, cache, user = _setup_user(tmp_path)
    ref = tz_now("America/New_York")
    cache.upsert_many(
        [
            Assignment(
                id="t", source=Source.SCHOOLOGY,
                title="Cell Bio Test", course="Biology",
                type=AssessmentType.TEST, due=ref + timedelta(hours=4),
            ),
        ],
        user="bob",
    )
    text = send_daily_digest(
        user=user, cache=cache, timezone="America/New_York",
        access_code="x", dry_run=True,
    )
    assert "test today" in text.lower()
    assert "Cell Bio Test" in text


def test_digest_mentions_tomorrow(tmp_path):
    _, cache, user = _setup_user(tmp_path)
    ref = tz_now("America/New_York")
    cache.upsert_many(
        [
            Assignment(
                id="hw", source=Source.SCHOOLOGY,
                title="Algebra HW", course="Algebra II",
                type=AssessmentType.ASSIGNMENT,
                due=ref + timedelta(days=1, hours=4),
            ),
        ],
        user="bob",
    )
    text = send_daily_digest(
        user=user, cache=cache, timezone="America/New_York",
        access_code="x", dry_run=True,
    )
    assert "Tomorrow" in text
    assert "Algebra HW" in text
