from __future__ import annotations

from dataclasses import dataclass

from anthropic import Anthropic

from .config import StudyConfig
from .models import Assignment


SYSTEM_PROMPT = """You are a study coach helping a student prepare for an
upcoming assessment. You generate STUDY MATERIAL — never finished answers
to be submitted.

Rules:
- Produce material that helps the student learn the underlying concepts:
  flashcards, practice questions, worked examples on adjacent (not
  identical) problems, mnemonic summaries, and concept maps.
- Do NOT produce text the student could paste into a graded submission.
  If asked for "the answer to question 3," instead explain the method,
  show a worked example with different numbers/wording, and prompt the
  student to apply it themselves.
- If the assignment description hints at a take-home test, lockdown
  browser test, or any live assessment, gently remind the student that
  what follows is review material — not an answer key — and proceed with
  practice questions only.
- Keep it tight and high-signal. A student studying the night before
  doesn't want filler.
"""


@dataclass
class StudyPack:
    summary: str
    flashcards: str
    practice_questions: str


class StudyHelper:
    def __init__(self, config: StudyConfig):
        if not config.configured:
            raise RuntimeError("ANTHROPIC_API_KEY missing")
        self.config = config
        self.client = Anthropic(api_key=config.api_key)

    def generate(self, a: Assignment) -> StudyPack:
        ctx = self._context(a)
        summary = self._call(
            f"{ctx}\n\nWrite a 5-8 sentence concept summary of what this assessment "
            "is testing. Focus on the key ideas and common pitfalls."
        )
        flashcards = self._call(
            f"{ctx}\n\nProduce 8-12 flashcards as 'Q: ... / A: ...' pairs covering "
            "the most testable points. Keep each answer one or two sentences."
        )
        practice = self._call(
            f"{ctx}\n\nWrite 5 practice questions on this topic, with brief worked "
            "solutions afterwards. Use different numbers/scenarios than any examples "
            "in the assignment description so the student practices the method, not "
            "the specific problem."
        )
        return StudyPack(summary=summary, flashcards=flashcards, practice_questions=practice)

    def _context(self, a: Assignment) -> str:
        due = a.due.strftime("%A, %B %d") if a.due else "no listed due date"
        desc = a.description or "(no description provided)"
        return (
            f"Assessment: {a.title}\n"
            f"Course: {a.course}\n"
            f"Type: {a.type.value}\n"
            f"Due: {due}\n"
            f"Description: {desc}"
        )

    def _call(self, user_prompt: str) -> str:
        msg = self.client.messages.create(
            model=self.config.model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return "".join(
            block.text for block in msg.content if getattr(block, "type", None) == "text"
        ).strip()
