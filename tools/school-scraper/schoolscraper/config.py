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
class AppConfig:
    schoology: SchoologyConfig
    powerschool: PowerSchoolConfig
    study: StudyConfig
    cache_path: str


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
        cache_path=os.getenv("SCHOOLSCRAPER_CACHE_PATH", ".schoolscraper.db"),
    )
