from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any

from dateutil import parser as dateparser

from ..config import PowerSchoolConfig
from ..models import Assignment, Source, classify_type
from .base import AssignmentSource

log = logging.getLogger(__name__)


class PowerSchoolClient(AssignmentSource):
    """PowerSchool student-portal scraper using Playwright.

    PowerSchool has no public student API, so this logs in to the public
    portal and parses the assignments table. Selectors are configurable
    because they differ slightly across district installations.
    """

    name = "powerschool"

    def __init__(self, config: PowerSchoolConfig, headless: bool = True):
        if not config.configured:
            raise RuntimeError("PowerSchool URL/username/password missing")
        self.config = config
        self.headless = headless

    def fetch(self) -> list[Assignment]:
        # Imported lazily so the rest of the tool works without playwright installed.
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=self.headless)
            context = browser.new_context()
            page = context.new_page()
            try:
                self._login(page)
                rows = self._scrape_grades_page(page)
            finally:
                context.close()
                browser.close()
        return rows

    def _login(self, page: Any) -> None:
        page.goto(self.config.url, wait_until="domcontentloaded")
        if self.config.login_mode == "sso_google":
            self._login_sso_google(page)
        else:
            self._login_form(page)
        page.wait_for_load_state("networkidle")

    def _login_form(self, page: Any) -> None:
        # Standard PowerSchool public portal selectors
        page.fill("input[name='account']", self.config.username)
        page.fill("input[name='pw']", self.config.password)
        page.click("button#btn-enter-sign-in, input[type='submit']")

    def _login_sso_google(self, page: Any) -> None:
        page.click("a:has-text('Sign in with Google'), button:has-text('Google')")
        page.fill("input[type='email']", self.config.username)
        page.click("button:has-text('Next'), #identifierNext")
        page.fill("input[type='password']", self.config.password)
        page.click("button:has-text('Next'), #passwordNext")

    def _scrape_grades_page(self, page: Any) -> list[Assignment]:
        # The "Grades and Attendance" page is the entry point. Each course
        # has a link to per-class assignment details.
        page.goto(f"{self.config.url}/guardian/home.html", wait_until="domcontentloaded")
        course_links = page.locator("table.linkDescList a[href*='scores.html']").all()
        course_targets: list[tuple[str, str]] = []
        for link in course_links:
            href = link.get_attribute("href")
            if not href:
                continue
            row = link.locator("xpath=ancestor::tr[1]")
            course_name = (row.locator("td").nth(1).inner_text() or "").strip()
            course_targets.append((course_name, href))

        log.info("PowerSchool: %d courses with assignment views", len(course_targets))
        assignments: list[Assignment] = []
        for course, href in course_targets:
            try:
                assignments.extend(self._scrape_course(page, course, href))
            except Exception as e:  # noqa: BLE001 — selectors vary by district
                log.warning("PowerSchool: course %s failed: %s", course, e)
        return assignments

    def _scrape_course(self, page: Any, course: str, href: str) -> list[Assignment]:
        url = href if href.startswith("http") else f"{self.config.url}/guardian/{href.lstrip('/')}"
        page.goto(url, wait_until="domcontentloaded")
        # Most PowerSchool installs render assignments in a table with id "assignments"
        # or class "grid". We try a few common shapes.
        tables = page.locator("table.zebra, table.grid, table#assignments").all()
        out: list[Assignment] = []
        for table in tables:
            headers = [
                (h.inner_text() or "").strip().lower()
                for h in table.locator("thead th, tr:first-child th").all()
            ]
            if not headers or "assignment" not in " ".join(headers):
                continue
            col = {name: i for i, name in enumerate(headers)}
            for tr in table.locator("tbody tr").all():
                cells = [td.inner_text().strip() for td in tr.locator("td").all()]
                if not cells:
                    continue
                title = _cell(cells, col, ["assignment", "name"]) or ""
                due_raw = _cell(cells, col, ["due", "due date"])
                desc = _cell(cells, col, ["category", "type"]) or ""
                points_raw = _cell(cells, col, ["points", "max points"]) or ""
                if not title:
                    continue
                out.append(
                    Assignment(
                        id=f"powerschool:{course}:{title}",
                        source=Source.POWERSCHOOL,
                        title=title,
                        course=course,
                        type=classify_type(title, desc),
                        due=_parse_date(due_raw),
                        description=desc,
                        url=url,
                        points=_extract_points(points_raw),
                    )
                )
        return out


def _cell(cells: list[str], col: dict[str, int], names: list[str]) -> str | None:
    for n in names:
        if n in col and col[n] < len(cells):
            return cells[col[n]]
    return None


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return dateparser.parse(value)
    except (ValueError, TypeError):
        return None


_POINTS_RE = re.compile(r"(\d+(?:\.\d+)?)")


def _extract_points(s: str) -> float | None:
    m = _POINTS_RE.search(s or "")
    return float(m.group(1)) if m else None
