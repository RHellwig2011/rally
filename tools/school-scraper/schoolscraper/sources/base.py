from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import Assignment


class AssignmentSource(ABC):
    name: str

    @abstractmethod
    def fetch(self) -> list[Assignment]:
        """Return a list of upcoming assignments from this source."""
