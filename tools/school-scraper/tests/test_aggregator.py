from datetime import datetime

from schoolscraper.aggregator import merge
from schoolscraper.models import Assignment, AssessmentType, Source, classify_type


def _make(source: Source, **overrides) -> Assignment:
    base = dict(
        id="x",
        source=source,
        title="Cell Biology Test",
        course="Biology 101",
        type=AssessmentType.TEST,
        due=datetime(2026, 5, 10, 14, 0),
        description="",
        url=None,
        points=None,
    )
    base.update(overrides)
    return Assignment(**base)


def test_merge_dedups_across_sources():
    a = _make(Source.SCHOOLOGY, description="Covers chapters 4-6", points=100)
    b = _make(Source.POWERSCHOOL)
    merged = merge([a, b])
    assert len(merged) == 1
    assert merged[0].source == Source.SCHOOLOGY


def test_merge_keeps_distinct():
    a = _make(Source.SCHOOLOGY)
    b = _make(Source.POWERSCHOOL, title="Math Quiz", course="Algebra II")
    merged = merge([a, b])
    assert len(merged) == 2


def test_classify_type_test():
    assert classify_type("Unit 4 Exam", "") == AssessmentType.TEST


def test_classify_type_quiz():
    assert classify_type("Pop Quiz", "") == AssessmentType.QUIZ


def test_classify_type_falls_back():
    assert classify_type("Reading", "") == AssessmentType.OTHER
