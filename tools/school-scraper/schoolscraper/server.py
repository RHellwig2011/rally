from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.responses import PlainTextResponse, Response

from . import alexa as alexa_handler
from . import ical as ical_renderer
from .cache import Cache
from .config import AppConfig
from .crypto import Vault
from .history import History
from .models import AssessmentType
from .quiz import QuizStore, prepare_quiz
from .scheduler import start_scheduler
from .study import StudyHelper
from .sync_runner import sync_user
from .users import UserStore

log = logging.getLogger(__name__)


def _verify_alexa_request(request: Request, body: bytes) -> None:
    """Verify an Alexa-signed request when ask-sdk-webservice-support is
    available; otherwise rely on the in-app skill-id check."""
    try:
        from ask_sdk_webservice_support.verifier import (
            RequestVerifier, TimestampVerifier,
        )
    except Exception:
        return

    sig_chain = request.headers.get("SignatureCertChainUrl") or request.headers.get(
        "signaturecertchainurl"
    )
    sig = request.headers.get("Signature") or request.headers.get("signature")
    if not sig_chain or not sig:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Alexa signature headers",
        )
    headers = {"SignatureCertChainUrl": sig_chain, "Signature": sig}
    try:
        TimestampVerifier().verify(body.decode(), headers)
        RequestVerifier().verify(body.decode(), headers)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alexa verification failed: {e}",
        )


def create_app(config: AppConfig) -> FastAPI:
    if not config.master_key:
        raise RuntimeError(
            "SCHOOLSCRAPER_MASTER_KEY must be set to run the server. "
            "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
        )
    vault = Vault(config.master_key)
    user_store = UserStore(config.cache_path, vault)
    cache = Cache(config.cache_path)
    history = History(config.cache_path)
    quizzes = QuizStore(config.cache_path)

    app = FastAPI(title="schoolscraper", version="0.3.0")
    app.state.config = config
    app.state.user_store = user_store
    app.state.cache = cache
    app.state.history = history
    app.state.quizzes = quizzes
    app.state.sched = None

    @app.on_event("startup")
    def _startup() -> None:
        app.state.sched = start_scheduler(
            user_store, cache, history,
            interval_minutes=config.server.sync_interval_minutes,
            timezone=config.server.timezone,
            digest_hour=config.server.daily_digest_hour,
            notify_me_access_code=config.server.notify_me_access_code,
        )

    @app.on_event("shutdown")
    def _shutdown() -> None:
        sched = app.state.sched
        if sched is not None:
            sched.shutdown(wait=False)

    def _require_token(authorization: str | None) -> None:
        if not config.server.api_token:
            return
        expected = f"Bearer {config.server.api_token}"
        if authorization != expected:
            raise HTTPException(status_code=401, detail="Invalid API token")

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"ok": True, "version": "0.3.0"}

    @app.get("/api/status")
    def status_endpoint(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        _require_token(authorization)
        latest = history.latest_per_user()
        out = []
        for u in user_store.list():
            ev = latest.get(u.name)
            out.append({
                "user": u.name,
                "display_name": u.display_name,
                "last_sync": ev.finished_at.isoformat() if ev else None,
                "ok": ev.ok if ev else None,
                "fetched": ev.fetched if ev else 0,
                "errors": ev.errors if ev else [],
            })
        return {"users": out, "scheduler_running": app.state.sched is not None}

    @app.get("/api/users")
    def list_users(authorization: str | None = Header(default=None)) -> list[dict[str, Any]]:
        _require_token(authorization)
        return [{"name": u.name, "display_name": u.display_name} for u in user_store.list()]

    @app.get("/api/users/{name}/upcoming")
    def upcoming(
        name: str, days: int = 7, type: str | None = None,
        authorization: str | None = Header(default=None),
    ) -> list[dict[str, Any]]:
        _require_token(authorization)
        u = user_store.get(name)
        if not u:
            raise HTTPException(404, f"unknown user {name}")
        type_filter = AssessmentType(type) if type else None
        now = datetime.utcnow()
        items = cache.list(
            user=u.name, type_filter=type_filter,
            since=now - timedelta(hours=12),
            until=now + timedelta(days=days),
        )
        return [a.model_dump(mode="json") for a in items]

    @app.post("/api/users/{name}/sync")
    def trigger_sync(
        name: str, authorization: str | None = Header(default=None)
    ) -> dict[str, Any]:
        _require_token(authorization)
        u = user_store.get(name)
        if not u:
            raise HTTPException(404, f"unknown user {name}")
        result = sync_user(u, cache, history=history)
        return {
            "user": result.user, "fetched": result.fetched,
            "deduped": result.deduped, "errors": result.errors,
        }

    @app.post("/api/users/{name}/study/{dedup_key}")
    def study(
        name: str, dedup_key: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, str]:
        _require_token(authorization)
        if not config.study.configured:
            raise HTTPException(503, "Study helper not configured")
        u = user_store.get(name)
        if not u:
            raise HTTPException(404, f"unknown user {name}")
        a = cache.get(dedup_key, user=u.name)
        if not a:
            raise HTTPException(404, "assignment not found in cache")
        helper = StudyHelper(config.study)
        pack = helper.generate(a)
        return {
            "summary": pack.summary,
            "flashcards": pack.flashcards,
            "practice_questions": pack.practice_questions,
        }

    @app.get("/api/users/{name}/calendar.ics")
    def calendar(name: str) -> Response:
        u = user_store.get(name)
        if not u:
            raise HTTPException(404, f"unknown user {name}")
        items = cache.list(user=u.name)
        ics = ical_renderer.render(
            items, user=u.name,
            calendar_name=f"School ({u.display_name})",
        )
        return PlainTextResponse(
            ics,
            media_type="text/calendar; charset=utf-8",
            headers={"Content-Disposition": f'inline; filename="{u.name}.ics"'},
        )

    @app.post("/api/users/{name}/quiz/prepare/{dedup_key}")
    def prepare_quiz_endpoint(
        name: str, dedup_key: str,
        authorization: str | None = Header(default=None),
    ) -> dict[str, Any]:
        _require_token(authorization)
        if not config.study.configured:
            raise HTTPException(503, "Study helper not configured")
        u = user_store.get(name)
        if not u:
            raise HTTPException(404, f"unknown user {name}")
        helper = StudyHelper(config.study)
        n = prepare_quiz(
            user=u, dedup_key=dedup_key,
            assignments=cache, quizzes=quizzes, helper=helper,
        )
        return {"user": u.name, "dedup_key": dedup_key, "cards": n}

    @app.post("/alexa")
    async def alexa(request: Request) -> dict[str, Any]:
        body_bytes = await request.body()
        _verify_alexa_request(request, body_bytes)
        try:
            body = await request.json()
        except Exception:
            raise HTTPException(400, "invalid JSON")
        return alexa_handler.handle_request(
            body, store=user_store, cache=cache,
            expected_skill_id=config.server.alexa_skill_id,
            timezone=config.server.timezone,
            quizzes=quizzes,
        )

    return app


def run(config: AppConfig) -> None:
    import uvicorn

    app = create_app(config)
    uvicorn.run(app, host=config.server.host, port=config.server.port, log_level="info")
