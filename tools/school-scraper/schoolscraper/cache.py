from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Iterable, Iterator

from .models import Assignment, AssessmentType


def _to_utc_iso(dt: datetime) -> str:
    """Coerce any datetime (naive or aware) to a comparable UTC ISO string."""
    if dt.tzinfo is None:
        return dt.isoformat()
    return dt.astimezone(timezone.utc).replace(tzinfo=None).isoformat()


SCHEMA = """
CREATE TABLE IF NOT EXISTS assignments (
    user        TEXT NOT NULL,
    dedup_key   TEXT NOT NULL,
    id          TEXT NOT NULL,
    source      TEXT NOT NULL,
    title       TEXT NOT NULL,
    course      TEXT NOT NULL,
    type        TEXT NOT NULL,
    due         TEXT,
    description TEXT,
    url         TEXT,
    points      REAL,
    fetched_at  TEXT NOT NULL,
    raw         TEXT,
    PRIMARY KEY (user, dedup_key)
);
CREATE INDEX IF NOT EXISTS idx_user_due ON assignments(user, due);
CREATE INDEX IF NOT EXISTS idx_user_type ON assignments(user, type);
"""

DEFAULT_USER = "_default"


class Cache:
    def __init__(self, path: str):
        self.path = path
        with self._conn() as c:
            c.executescript(SCHEMA)

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def upsert_many(self, assignments: Iterable[Assignment], *, user: str = DEFAULT_USER) -> int:
        rows = [
            (
                user,
                a.dedup_key(),
                a.id,
                a.source.value,
                a.title,
                a.course,
                a.type.value,
                _to_utc_iso(a.due) if a.due else None,
                a.description,
                a.url,
                a.points,
                a.fetched_at.isoformat(),
                json.dumps(a.model_dump(mode="json")),
            )
            for a in assignments
        ]
        if not rows:
            return 0
        with self._conn() as c:
            c.executemany(
                """
                INSERT INTO assignments
                    (user, dedup_key, id, source, title, course, type, due,
                     description, url, points, fetched_at, raw)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user, dedup_key) DO UPDATE SET
                    id=excluded.id,
                    source=excluded.source,
                    title=excluded.title,
                    course=excluded.course,
                    type=excluded.type,
                    due=excluded.due,
                    description=excluded.description,
                    url=excluded.url,
                    points=excluded.points,
                    fetched_at=excluded.fetched_at,
                    raw=excluded.raw
                """,
                rows,
            )
        return len(rows)

    def replace_for_user(self, user: str, assignments: Iterable[Assignment]) -> int:
        """Replace the cache for a single user atomically."""
        with self._conn() as c:
            c.execute("DELETE FROM assignments WHERE user = ?", (user,))
        return self.upsert_many(assignments, user=user)

    def list(
        self,
        *,
        user: str = DEFAULT_USER,
        type_filter: AssessmentType | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[Assignment]:
        sql = "SELECT raw FROM assignments WHERE user = ?"
        params: list[object] = [user]
        if type_filter is not None:
            sql += " AND type = ?"
            params.append(type_filter.value)
        if since is not None:
            sql += " AND (due IS NULL OR due >= ?)"
            params.append(_to_utc_iso(since))
        if until is not None:
            sql += " AND due <= ?"
            params.append(_to_utc_iso(until))
        sql += " ORDER BY due IS NULL, due ASC"
        with self._conn() as c:
            rows = c.execute(sql, params).fetchall()
        return [Assignment.model_validate_json(r["raw"]) for r in rows]

    def get(self, dedup_key: str, *, user: str = DEFAULT_USER) -> Assignment | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT raw FROM assignments WHERE user = ? AND dedup_key = ?",
                (user, dedup_key),
            ).fetchone()
        return Assignment.model_validate_json(row["raw"]) if row else None
