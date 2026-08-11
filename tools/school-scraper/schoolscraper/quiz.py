"""Per-user, per-assessment flashcard cache for Alexa quiz mode.

Generating flashcards via Claude takes several seconds — too long for Alexa's
8-second response budget. So we pre-generate them (via CLI or scheduler) and
cache them here for fast playback.
"""

from __future__ import annotations

import json
import re
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator

from .study import StudyHelper
from .users import User
from .cache import Cache as AssignmentCache


SCHEMA = """
CREATE TABLE IF NOT EXISTS quizzes (
    user         TEXT NOT NULL,
    dedup_key    TEXT NOT NULL,
    title        TEXT NOT NULL,
    course       TEXT NOT NULL,
    cards_json   TEXT NOT NULL,
    generated_at TEXT NOT NULL,
    PRIMARY KEY (user, dedup_key)
);
"""


@dataclass
class Card:
    question: str
    answer: str


# Line-anchored question/answer markers, tolerant of the many shapes Claude
# emits: "Q:", "Q.", "Q1:", "Question:", "**Q:**" (bold stripped first),
# leading bullets ("- ", "* ", "• "), and list numbering ("1. Q: ...").
_Q_SPLIT = re.compile(
    r"(?m)^[ \t>*\-•]*(?:\d+[.)]\s*)?Q(?:uestion)?\s*\d*[:.)]\s*",
    re.IGNORECASE,
)
_A_SPLIT = re.compile(
    r"(?m)^[ \t>*\-•]*A(?:nswer)?\s*\d*[:.)]\s*",
    re.IGNORECASE,
)


def _parse_cards(text: str) -> list[Card]:
    """Parse question/answer pairs from Claude flashcard output.

    Handles Q:/A:, Question:/Answer:, Q1:/A1:, markdown-bold variants, and
    bulleted or numbered lists. Robust to multi-line answers.
    """
    if not text:
        return []
    # Strip markdown emphasis so "**Q:**" and "__Answer:__" match cleanly.
    text = text.replace("**", "").replace("__", "")
    cards: list[Card] = []
    for chunk in _Q_SPLIT.split(text)[1:]:  # [0] is any preamble before Q1
        parts = _A_SPLIT.split(chunk, maxsplit=1)
        if len(parts) != 2:
            continue
        q = parts[0].strip().strip("/").strip()
        a = parts[1].strip().strip("/").strip()
        if q and a:
            cards.append(Card(question=q, answer=a))
    return cards


class QuizStore:
    def __init__(self, db_path: str):
        self.db_path = db_path
        with self._conn() as c:
            c.executescript(SCHEMA)

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def get(self, user: str, dedup_key: str) -> list[Card] | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT cards_json FROM quizzes WHERE user = ? AND dedup_key = ?",
                (user, dedup_key),
            ).fetchone()
        if not row:
            return None
        return [Card(**c) for c in json.loads(row["cards_json"])]

    def latest_for_user(self, user: str) -> tuple[str, str, list[Card]] | None:
        """Return (title, course, cards) for the most-recently generated quiz."""
        with self._conn() as c:
            row = c.execute(
                "SELECT title, course, cards_json FROM quizzes WHERE user = ? "
                "ORDER BY generated_at DESC LIMIT 1",
                (user,),
            ).fetchone()
        if not row:
            return None
        return row["title"], row["course"], [Card(**c) for c in json.loads(row["cards_json"])]

    def store(self, *, user: str, dedup_key: str, title: str, course: str, cards: list[Card]) -> None:
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO quizzes (user, dedup_key, title, course, cards_json, generated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user, dedup_key) DO UPDATE SET
                    title=excluded.title, course=excluded.course,
                    cards_json=excluded.cards_json, generated_at=excluded.generated_at
                """,
                (
                    user, dedup_key, title, course,
                    json.dumps([{"question": c.question, "answer": c.answer} for c in cards]),
                    datetime.now(timezone.utc).isoformat(),
                ),
            )


def prepare_quiz(
    *,
    user: User,
    dedup_key: str,
    assignments: AssignmentCache,
    quizzes: QuizStore,
    helper: StudyHelper,
) -> int:
    """Generate flashcards for the given assignment and cache them."""
    a = assignments.get(dedup_key, user=user.name)
    if not a:
        raise ValueError(f"No assignment with key {dedup_key} for {user.name}")
    pack = helper.generate(a)
    cards = _parse_cards(pack.flashcards)
    if not cards:
        # Fallback: store raw text as one card so Alexa still has something
        cards = [Card(question="Review this material", answer=pack.flashcards)]
    quizzes.store(
        user=user.name, dedup_key=dedup_key,
        title=a.title, course=a.course, cards=cards,
    )
    return len(cards)
