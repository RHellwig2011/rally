from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional

from dotenv import load_dotenv


@dataclass(frozen=True)
class SchoologyConfig:
    consumer_key: str
    consumer_secret: str
    domain: str
    user_id: str

    @property
    def configured(self) -> bool:
        return bool(self.consumer_key and self.consumer_secret)


@dataclass(frozen=True)
class PowerSchoolConfig:
    url: str
    username: str
    password: str
    login_mode: str  # "form" | "sso_google"

    @property
    def configured(self) -> bool:
        return bool(self.url and self.username and self.password)


@dataclass(frozen=True)
class StudyConfig:
    api_key: str
    model: str

    @property
    def configured(self) -> bool:
        return bool(self.api_key)


@dataclass(frozen=True)
class ServerConfig:
    host: str
    port: int
    sync_interval_minutes: int
    alexa_skill_id: str
    api_token: str  # shared secret for non-Alexa REST calls
    timezone: str
    notify_me_access_code: str
    daily_digest_hour: int  # 0-23 in the configured timezone


@dataclass(frozen=True)
class AppConfig:
    schoology: SchoologyConfig
    powerschool: PowerSchoolConfig
    study: StudyConfig
    server: ServerConfig
    cache_path: str
    master_key: str


def load_config(env_file: Optional[str] = None) -> AppConfig:
    load_dotenv(env_file, override=False)
    return AppConfig(
        schoology=SchoologyConfig(
            consumer_key=os.getenv("SCHOOLOGY_CONSUMER_KEY", ""),
            consumer_secret=os.getenv("SCHOOLOGY_CONSUMER_SECRET", ""),
            domain=os.getenv("SCHOOLOGY_DOMAIN", "https://app.schoology.com").rstrip("/"),
            user_id=os.getenv("SCHOOLOGY_USER_ID", "me"),
        ),
        powerschool=PowerSchoolConfig(
            url=os.getenv("POWERSCHOOL_URL", "").rstrip("/"),
            username=os.getenv("POWERSCHOOL_USERNAME", ""),
            password=os.getenv("POWERSCHOOL_PASSWORD", ""),
            login_mode=os.getenv("POWERSCHOOL_LOGIN_MODE", "form"),
        ),
        study=StudyConfig(
            api_key=os.getenv("ANTHROPIC_API_KEY", ""),
            model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        ),
        server=ServerConfig(
            host=os.getenv("SCHOOLSCRAPER_HOST", "0.0.0.0"),
            port=int(os.getenv("SCHOOLSCRAPER_PORT", "8765")),
            sync_interval_minutes=int(os.getenv("SCHOOLSCRAPER_SYNC_MINUTES", "60")),
            alexa_skill_id=os.getenv("ALEXA_SKILL_ID", ""),
            api_token=os.getenv("SCHOOLSCRAPER_API_TOKEN", ""),
            timezone=os.getenv("SCHOOLSCRAPER_TIMEZONE", "America/New_York"),
            notify_me_access_code=os.getenv("NOTIFY_ME_ACCESS_CODE", ""),
            daily_digest_hour=int(os.getenv("SCHOOLSCRAPER_DIGEST_HOUR", "7")),
        ),
        cache_path=os.getenv("SCHOOLSCRAPER_CACHE_PATH", ".schoolscraper.db"),
        master_key=os.getenv("SCHOOLSCRAPER_MASTER_KEY", ""),
    )
