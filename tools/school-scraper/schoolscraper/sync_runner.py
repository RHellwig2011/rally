from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone

from .aggregator import merge
from .cache import Cache
from .history import History
from .models import Assignment
from .users import User

log = logging.getLogger(__name__)


@dataclass
class SyncResult:
    user: str
    fetched: int
    deduped: int
    errors: list[str]


def sync_user(
    user: User,
    cache: Cache,
    *,
    headless: bool = True,
    history: History | None = None,
) -> SyncResult:
    """Fetch from Schoology + PowerSchool for a single user and replace
    that user's cache atomically."""
    started = datetime.now(timezone.utc)
    fetched: list[Assignment] = []
    errors: list[str] = []

    sch_cfg = user.schoology_config()
    if sch_cfg.configured:
        try:
            from .sources.schoology import SchoologyClient

            fetched.extend(SchoologyClient(sch_cfg).fetch())
        except Exception as e:  # noqa: BLE001
            log.warning("[%s] Schoology failed: %s", user.name, e)
            errors.append(f"schoology: {e}")

    ps_cfg = user.powerschool_config()
    if ps_cfg.configured:
        try:
            from .sources.powerschool import PowerSchoolClient

            fetched.extend(PowerSchoolClient(ps_cfg, headless=headless).fetch())
        except Exception as e:  # noqa: BLE001
            log.warning("[%s] PowerSchool failed: %s", user.name, e)
            errors.append(f"powerschool: {e}")

    merged = merge(fetched)
    cache.replace_for_user(user.name, merged)
    if history is not None:
        history.record(
            user=user.name,
            started_at=started,
            fetched=len(fetched),
            deduped=len(merged),
            errors=errors,
        )
    return SyncResult(user=user.name, fetched=len(fetched), deduped=len(merged), errors=errors)
