from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from schoolscraper.cache import Cache
from schoolscraper.crypto import Vault
from schoolscraper.models import Assignment, AssessmentType, Source
from schoolscraper.notify import _build_digest, send_daily_digest
from schoolscraper.users import UserStore

# Fixed reference at 8am so "+4h" stays today and "+1d 4h" stays tomorrow,
# independent of the wall clock the suite happens to run at.
REF = datetime(2026, 5, 4, 8, 0, tzinfo=ZoneInfo("America/New_York"))


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
    _, _, user = _setup_user(tmp_path)
    items = [
        Assignment(
            id="t", source=Source.SCHOOLOGY,
            title="Cell Bio Test", course="Biology",
            type=AssessmentType.TEST, due=REF + timedelta(hours=4),
        ),
    ]
    text = _build_digest(items, user=user, ref=REF)
    assert "test today" in text.lower()
    assert "Cell Bio Test" in text


def test_digest_mentions_tomorrow(tmp_path):
    _, _, user = _setup_user(tmp_path)
    items = [
        Assignment(
            id="hw", source=Source.SCHOOLOGY,
            title="Algebra HW", course="Algebra II",
            type=AssessmentType.ASSIGNMENT,
            due=REF + timedelta(days=1, hours=4),
        ),
    ]
    text = _build_digest(items, user=user, ref=REF)
    assert "Tomorrow" in text
    assert "Algebra HW" in text
