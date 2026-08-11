from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import requests
from dateutil import parser as dateparser
from requests_oauthlib import OAuth1

from ..config import SchoologyConfig
from ..models import Assignment, AssessmentType, Source, classify_type
from .base import AssignmentSource

log = logging.getLogger(__name__)

API_BASE = "/v1"


class SchoologyClient(AssignmentSource):
    """Schoology REST client using 2-legged OAuth1.

    Docs: https://developers.schoology.com/api-documentation/rest-api-v1
    """

    name = "schoology"

    def __init__(self, config: SchoologyConfig):
        if not config.configured:
            raise RuntimeError("Schoology consumer key/secret missing")
        self.config = config
        self.auth = OAuth1(
            config.consumer_key,
            config.consumer_secret,
            signature_type="auth_header",
        )
        self.session = requests.Session()
        self.session.headers.update({"Accept": "application/json"})

    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.config.domain}{API_BASE}{path}"
        resp = self.session.get(url, auth=self.auth, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _resolve_user_id(self) -> str:
        if self.config.user_id and self.config.user_id != "me":
            return self.config.user_id
        data = self._get("/users/me")
        uid = data.get("uid") or data.get("id")
        if not uid:
            raise RuntimeError(f"Could not resolve Schoology user id from /users/me: {data}")
        return str(uid)

    def fetch(self) -> list[Assignment]:
        uid = self._resolve_user_id()
        sections = self._list_sections(uid)
        log.info("Schoology: %d active sections", len(sections))
        out: list[Assignment] = []
        for section in sections:
            section_id = str(section.get("id"))
            course_name = section.get("course_title") or section.get("section_title") or "Unknown"
            try:
                out.extend(self._fetch_section_assignments(section_id, course_name))
            except requests.HTTPError as e:
                log.warning("Schoology: section %s failed: %s", section_id, e)
        return out

    def _list_sections(self, uid: str) -> list[dict[str, Any]]:
        data = self._get(f"/users/{uid}/sections")
        return data.get("section", []) or []

    def _fetch_section_assignments(self, section_id: str, course: str) -> list[Assignment]:
        data = self._get(
            f"/sections/{section_id}/assignments",
            params={"limit": 200},
        )
        items = data.get("assignment", []) or []
        return [self._to_assignment(it, course) for it in items]

    def _to_assignment(self, raw: dict[str, Any], course: str) -> Assignment:
        title = raw.get("title", "Untitled")
        description = _strip_html(raw.get("description", "") or "")
        due_raw = raw.get("due") or None
        due_dt = _parse_due(due_raw)
        kind_raw = (raw.get("type") or "").lower()
        kind = _SCHOOLOGY_TYPE_MAP.get(kind_raw) or classify_type(title, description)
        return Assignment(
            id=f"schoology:{raw.get('id')}",
            source=Source.SCHOOLOGY,
            title=title,
            course=course,
            type=kind,
            due=due_dt,
            description=description,
            url=raw.get("web_url"),
            points=_to_float(raw.get("max_points")),
        )


_SCHOOLOGY_TYPE_MAP = {
    "assignment": AssessmentType.ASSIGNMENT,
    "assessment": AssessmentType.TEST,
    "quiz": AssessmentType.QUIZ,
    "test": AssessmentType.TEST,
    "discussion": AssessmentType.OTHER,
}


def _parse_due(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return dateparser.parse(value)
    except (ValueError, TypeError):
        return None


def _to_float(value: Any) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except (ValueError, TypeError):
        return None


def _strip_html(s: str) -> str:
    import re

    text = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", text).strip()
