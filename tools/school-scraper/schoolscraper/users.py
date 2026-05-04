from __future__ import annotations

import re
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Iterator, Optional

from .config import PowerSchoolConfig, SchoologyConfig
from .crypto import Vault


_NAME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9_-]{0,30}$")


@dataclass
class User:
    name: str  # short identifier, used by Alexa ("Bob", "Alice")
    display_name: str
    schoology_consumer_key: str
    schoology_consumer_secret: str  # decrypted
    schoology_domain: str
    schoology_user_id: str
    powerschool_url: str
    powerschool_username: str
    powerschool_password: str  # decrypted
    powerschool_login_mode: str

    def schoology_config(self) -> SchoologyConfig:
        return SchoologyConfig(
            consumer_key=self.schoology_consumer_key,
            consumer_secret=self.schoology_consumer_secret,
            domain=self.schoology_domain or "https://app.schoology.com",
            user_id=self.schoology_user_id or "me",
        )

    def powerschool_config(self) -> PowerSchoolConfig:
        return PowerSchoolConfig(
            url=self.powerschool_url,
            username=self.powerschool_username,
            password=self.powerschool_password,
            login_mode=self.powerschool_login_mode or "form",
        )


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    name                          TEXT PRIMARY KEY,
    display_name                  TEXT NOT NULL,
    schoology_consumer_key        TEXT NOT NULL DEFAULT '',
    schoology_consumer_secret_enc TEXT NOT NULL DEFAULT '',
    schoology_domain              TEXT NOT NULL DEFAULT '',
    schoology_user_id             TEXT NOT NULL DEFAULT 'me',
    powerschool_url               TEXT NOT NULL DEFAULT '',
    powerschool_username          TEXT NOT NULL DEFAULT '',
    powerschool_password_enc      TEXT NOT NULL DEFAULT '',
    powerschool_login_mode        TEXT NOT NULL DEFAULT 'form'
);
"""


def validate_name(name: str) -> str:
    name = name.strip().lower()
    if not _NAME_RE.match(name):
        raise ValueError(
            "User name must start with a letter and contain only letters, "
            "digits, hyphen, or underscore (max 31 chars)."
        )
    return name


class UserStore:
    def __init__(self, db_path: str, vault: Vault):
        self.db_path = db_path
        self.vault = vault
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

    def upsert(
        self,
        *,
        name: str,
        display_name: str,
        schoology_consumer_key: str = "",
        schoology_consumer_secret: str = "",
        schoology_domain: str = "https://app.schoology.com",
        schoology_user_id: str = "me",
        powerschool_url: str = "",
        powerschool_username: str = "",
        powerschool_password: str = "",
        powerschool_login_mode: str = "form",
    ) -> None:
        name = validate_name(name)
        with self._conn() as c:
            c.execute(
                """
                INSERT INTO users (
                    name, display_name,
                    schoology_consumer_key, schoology_consumer_secret_enc,
                    schoology_domain, schoology_user_id,
                    powerschool_url, powerschool_username,
                    powerschool_password_enc, powerschool_login_mode
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    display_name=excluded.display_name,
                    schoology_consumer_key=excluded.schoology_consumer_key,
                    schoology_consumer_secret_enc=excluded.schoology_consumer_secret_enc,
                    schoology_domain=excluded.schoology_domain,
                    schoology_user_id=excluded.schoology_user_id,
                    powerschool_url=excluded.powerschool_url,
                    powerschool_username=excluded.powerschool_username,
                    powerschool_password_enc=excluded.powerschool_password_enc,
                    powerschool_login_mode=excluded.powerschool_login_mode
                """,
                (
                    name,
                    display_name or name,
                    schoology_consumer_key,
                    self.vault.encrypt(schoology_consumer_secret),
                    schoology_domain,
                    schoology_user_id,
                    powerschool_url,
                    powerschool_username,
                    self.vault.encrypt(powerschool_password),
                    powerschool_login_mode,
                ),
            )

    def remove(self, name: str) -> bool:
        name = validate_name(name)
        with self._conn() as c:
            cur = c.execute("DELETE FROM users WHERE name = ?", (name,))
            return cur.rowcount > 0

    def get(self, name: str) -> Optional[User]:
        name = validate_name(name)
        with self._conn() as c:
            row = c.execute("SELECT * FROM users WHERE name = ?", (name,)).fetchone()
        return self._row_to_user(row) if row else None

    def list(self) -> list[User]:
        with self._conn() as c:
            rows = c.execute("SELECT * FROM users ORDER BY name").fetchall()
        return [self._row_to_user(r) for r in rows]

    def _row_to_user(self, row: sqlite3.Row) -> User:
        return User(
            name=row["name"],
            display_name=row["display_name"],
            schoology_consumer_key=row["schoology_consumer_key"],
            schoology_consumer_secret=self.vault.decrypt(row["schoology_consumer_secret_enc"]),
            schoology_domain=row["schoology_domain"],
            schoology_user_id=row["schoology_user_id"],
            powerschool_url=row["powerschool_url"],
            powerschool_username=row["powerschool_username"],
            powerschool_password=self.vault.decrypt(row["powerschool_password_enc"]),
            powerschool_login_mode=row["powerschool_login_mode"],
        )
