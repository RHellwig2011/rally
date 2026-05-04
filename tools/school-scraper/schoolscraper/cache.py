from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from typing import Iterable, Iterator

from .models import Assignment, AssessmentType, Source


SCHEMA = """
CREATE TABLE IF NOT EXISTS assignments (
    dedup_key   TEXT PRIMARY KEY,
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
    raw         TEXT
);
CREATE INDEX IF NOT EXISTS idx_due ON assignments(due);
CREATE INDEX IF NOT EXISTS idx_type ON assignments(type);
"""


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

    def upsert_many(self, assignments: Iterable[Assignment]) -> int:
        rows = [
            (
                a.dedup_key(),
                a.id,
                a.source.value,
                a.title,
                a.course,
                a.type.value,
                a.due.isoformat() if a.due else None,
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
                    (dedup_key, id, source, title, course, type, due,
                     description, url, points, fetched_at, raw)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(dedup_key) DO UPDATE SET
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

    def list(
        self,
        *,
        type_filter: AssessmentType | None = None,
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> list[Assignment]:
        sql = "SELECT raw FROM assignments WHERE 1=1"
        params: list[object] = []
        if type_filter is not None:
            sql += " AND type = ?"
            params.append(type_filter.value)
        if since is not None:
            sql += " AND (due IS NULL OR due >= ?)"
            params.append(since.isoformat())
        if until is not None:
            sql += " AND due <= ?"
            params.append(until.isoformat())
        sql += " ORDER BY due IS NULL, due ASC"
        with self._conn() as c:
            rows = c.execute(sql, params).fetchall()
        return [Assignment.model_validate_json(r["raw"]) for r in rows]

    def get(self, dedup_key: str) -> Assignment | None:
        with self._conn() as c:
            row = c.execute(
                "SELECT raw FROM assignments WHERE dedup_key = ?", (dedup_key,)
            ).fetchone()
        return Assignment.model_validate_json(row["raw"]) if row else None
