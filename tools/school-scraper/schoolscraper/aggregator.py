from __future__ import annotations

from typing import Iterable

from .models import Assignment, Source


def merge(assignments: Iterable[Assignment]) -> list[Assignment]:
    """Merge across sources, preferring Schoology entries (richer data) for
    duplicates that appear in both Schoology and PowerSchool."""
    by_key: dict[str, Assignment] = {}
    for a in assignments:
        key = a.dedup_key()
        existing = by_key.get(key)
        if existing is None:
            by_key[key] = a
            continue
        # Prefer the entry with more info; tiebreak by Schoology
        if _score(a) > _score(existing):
            by_key[key] = a
        elif _score(a) == _score(existing) and a.source == Source.SCHOOLOGY:
            by_key[key] = a
    return list(by_key.values())


def _score(a: Assignment) -> int:
    s = 0
    if a.description:
        s += 2
    if a.url:
        s += 1
    if a.points is not None:
        s += 1
    return s
