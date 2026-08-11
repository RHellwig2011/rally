from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from .cache import Cache
from .history import History
from .notify import send_daily_digest
from .sync_runner import sync_user
from .users import UserStore

log = logging.getLogger(__name__)


def start_scheduler(
    user_store: UserStore,
    cache: Cache,
    history: History,
    *,
    interval_minutes: int = 60,
    timezone: str = "America/New_York",
    digest_hour: int = 7,
    notify_me_access_code: str = "",
) -> BackgroundScheduler:
    sched = BackgroundScheduler(daemon=True, timezone=timezone)

    def _tick() -> None:
        users = user_store.list()
        log.info("Scheduled sync starting for %d users", len(users))
        for u in users:
            try:
                result = sync_user(u, cache, history=history)
                log.info(
                    "[%s] sync ok: %d fetched, %d after dedup, %d errors",
                    u.name, result.fetched, result.deduped, len(result.errors),
                )
            except Exception as e:  # noqa: BLE001
                log.exception("[%s] sync raised: %s", u.name, e)

    def _digest() -> None:
        if not notify_me_access_code:
            return
        for u in user_store.list():
            try:
                send_daily_digest(
                    user=u, cache=cache,
                    timezone=timezone, access_code=notify_me_access_code,
                )
            except Exception as e:  # noqa: BLE001
                log.exception("[%s] digest failed: %s", u.name, e)

    sched.add_job(_tick, "interval", minutes=interval_minutes, id="sync_all")
    if notify_me_access_code:
        sched.add_job(
            _digest,
            CronTrigger(hour=digest_hour, minute=0, timezone=timezone),
            id="daily_digest",
        )
    sched.start()
    return sched
