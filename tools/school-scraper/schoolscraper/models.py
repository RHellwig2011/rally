from __future__ import annotations

import hashlib
import re
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AssessmentType(str, Enum):
    TEST = "test"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    PROJECT = "project"
    OTHER = "other"


class Source(str, Enum):
    SCHOOLOGY = "schoology"
    POWERSCHOOL = "powerschool"


class Assignment(BaseModel):
    id: str
    source: Source
    title: str
    course: str
    type: AssessmentType
    due: Optional[datetime] = None
    description: str = ""
    url: Optional[str] = None
    points: Optional[float] = None
    fetched_at: datetime = Field(default_factory=datetime.utcnow)

    def dedup_key(self) -> str:
        # Same title in same course on same due date = same assessment across platforms
        day = self.due.date().isoformat() if self.due else "no-due"
        raw = f"{self.course.lower()}|{self.title.lower().strip()}|{day}"
        return hashlib.sha1(raw.encode()).hexdigest()[:16]


_TYPE_PATTERNS = [
    (re.compile(r"\b(test|exam|midterm|final)\b", re.I), AssessmentType.TEST),
    (re.compile(r"\b(quiz|check[-\s]?in)\b", re.I), AssessmentType.QUIZ),
    (re.compile(r"\b(project|presentation|essay|paper)\b", re.I), AssessmentType.PROJECT),
    (re.compile(r"\b(assignment|homework|hw|worksheet|practice)\b", re.I), AssessmentType.ASSIGNMENT),
]


def classify_type(title: str, description: str = "") -> AssessmentType:
    text = f"{title} {description}"
    for pattern, kind in _TYPE_PATTERNS:
        if pattern.search(text):
            return kind
    return AssessmentType.OTHER
