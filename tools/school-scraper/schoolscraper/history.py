"""Sync history: which user synced when, with how many items, and any errors."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterator


SCHEMA = """
CREATE TABLE IF NOT EXISTS sync_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user        TEXT NOT NULL,
    started_at  TEXT NOT NULL,
    finished_at TEXT NOT NULL,
    fetched     INTEGER NOT NULL DEFAULT 0,
    deduped     INTEGER NOT NULL DEFAULT 0,
    errors_json TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_sync_user ON sync_history(user, started_at DESC);
"""


@dataclass
class SyncEvent:
    user: str
    started_at: datetime
    finished_at: datetime
    fetched: int
    deduped: int
    errors: list[str]

    @property
    def ok(self) -> bool:
        return not self.errors


class History:
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

    def record(
        self,
        *,
        user: str,
        started_at: datetime,
        fetched: int,
        deduped: int,
        errors: list[str],
    ) -> None:
        finished = datetime.now(timezone.utc).isoformat()
        with self._conn() as c:
            c.execute(
                "INSERT INTO sync_history (user, started_at, finished_at, fetched, deduped, errors_json) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    user,
                    started_at.astimezone(timezone.utc).isoformat() if started_at.tzinfo else started_at.isoformat(),
                    finished,
                    fetched,
                    deduped,
                    json.dumps(errors),
                ),
            )

    def latest_per_user(self) -> dict[str, SyncEvent]:
        with self._conn() as c:
            rows = c.execute(
                """
                SELECT s.* FROM sync_history s
                JOIN (
                    SELECT user, MAX(started_at) AS max_at
                    FROM sync_history GROUP BY user
                ) m ON m.user = s.user AND m.max_at = s.started_at
                """
            ).fetchall()
        return {r["user"]: self._row_to_event(r) for r in rows}

    def recent_for_user(self, user: str, limit: int = 10) -> list[SyncEvent]:
        with self._conn() as c:
            rows = c.execute(
                "SELECT * FROM sync_history WHERE user = ? "
                "ORDER BY started_at DESC LIMIT ?",
                (user, limit),
            ).fetchall()
        return [self._row_to_event(r) for r in rows]

    def _row_to_event(self, row: sqlite3.Row) -> SyncEvent:
        return SyncEvent(
            user=row["user"],
            started_at=datetime.fromisoformat(row["started_at"]),
            finished_at=datetime.fromisoformat(row["finished_at"]),
            fetched=row["fetched"],
            deduped=row["deduped"],
            errors=json.loads(row["errors_json"]),
        )
