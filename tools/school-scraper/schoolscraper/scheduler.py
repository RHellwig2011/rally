from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from .cache import Cache
from .sync_runner import sync_user
from .users import UserStore

log = logging.getLogger(__name__)


def start_scheduler(
    user_store: UserStore,
    cache: Cache,
    *,
    interval_minutes: int = 60,
) -> BackgroundScheduler:
    sched = BackgroundScheduler(daemon=True)

    def _tick() -> None:
        users = user_store.list()
        log.info("Scheduled sync starting for %d users", len(users))
        for u in users:
            try:
                result = sync_user(u, cache)
                log.info(
                    "[%s] sync ok: %d fetched, %d after dedup, %d errors",
                    u.name,
                    result.fetched,
                    result.deduped,
                    len(result.errors),
                )
            except Exception as e:  # noqa: BLE001
                log.exception("[%s] sync raised: %s", u.name, e)

    sched.add_job(_tick, "interval", minutes=interval_minutes, id="sync_all", next_run_time=None)
    sched.start()
    return sched
