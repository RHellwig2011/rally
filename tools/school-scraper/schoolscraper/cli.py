from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .aggregator import merge
from .cache import Cache
from .config import load_config
from .models import Assignment, AssessmentType
from .study import StudyHelper

app = typer.Typer(
    add_completion=False,
    help="Scrape Schoology and PowerSchool, see what's due, and generate study material.",
)
console = Console()
log = logging.getLogger("schoolscraper")


@app.callback()
def _root(verbose: bool = typer.Option(False, "--verbose", "-v")) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


@app.command()
def sync(
    schoology_only: bool = typer.Option(False, "--schoology-only"),
    powerschool_only: bool = typer.Option(False, "--powerschool-only"),
    headed: bool = typer.Option(False, "--headed", help="Show the browser for PowerSchool"),
) -> None:
    """Pull the latest assignments from configured sources into the local cache."""
    cfg = load_config()
    cache = Cache(cfg.cache_path)
    fetched: list[Assignment] = []

    if not powerschool_only and cfg.schoology.configured:
        from .sources.schoology import SchoologyClient

        console.print("[cyan]Fetching Schoology...[/cyan]")
        try:
            fetched.extend(SchoologyClient(cfg.schoology).fetch())
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]Schoology fetch failed:[/red] {e}")
    elif not powerschool_only:
        console.print("[yellow]Schoology not configured; skipping.[/yellow]")

    if not schoology_only and cfg.powerschool.configured:
        from .sources.powerschool import PowerSchoolClient

        console.print("[cyan]Fetching PowerSchool...[/cyan]")
        try:
            fetched.extend(PowerSchoolClient(cfg.powerschool, headless=not headed).fetch())
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]PowerSchool fetch failed:[/red] {e}")
    elif not schoology_only:
        console.print("[yellow]PowerSchool not configured; skipping.[/yellow]")

    merged = merge(fetched)
    n = cache.upsert_many(merged)
    console.print(f"[green]Synced {n} assignments[/green] ({len(fetched)} raw -> {len(merged)} after dedup).")


@app.command("list")
def list_cmd(
    days: int = typer.Option(14, "--days", "-d", help="Show items due within this many days."),
    type_filter: Optional[str] = typer.Option(None, "--type", "-t", help="test|quiz|assignment|project"),
    include_past: bool = typer.Option(False, "--include-past"),
) -> None:
    """Show upcoming assignments from the cache."""
    cfg = load_config()
    cache = Cache(cfg.cache_path)
    type_arg = AssessmentType(type_filter) if type_filter else None
    now = datetime.utcnow()
    items = cache.list(
        type_filter=type_arg,
        since=None if include_past else now - timedelta(hours=12),
        until=now + timedelta(days=days),
    )
    if not items:
        console.print("[yellow]Nothing in cache for that window. Try `schoolscraper sync` first.[/yellow]")
        raise typer.Exit(0)
    _print_table(items, now)


@app.command()
def study(
    assignment: Optional[str] = typer.Argument(
        None, help="Dedup key (first column of `list`) of a specific assignment."
    ),
    upcoming: int = typer.Option(0, "--upcoming", "-n", help="Generate packs for the next N items."),
) -> None:
    """Generate a study pack: summary, flashcards, and practice questions."""
    cfg = load_config()
    if not cfg.study.configured:
        console.print("[red]ANTHROPIC_API_KEY not set; cannot generate study material.[/red]")
        raise typer.Exit(1)
    cache = Cache(cfg.cache_path)
    helper = StudyHelper(cfg.study)

    targets: list[Assignment]
    if assignment:
        a = cache.get(assignment)
        if not a:
            console.print(f"[red]No assignment with key {assignment}.[/red]")
            raise typer.Exit(1)
        targets = [a]
    else:
        n = max(upcoming, 1)
        items = cache.list(since=datetime.utcnow() - timedelta(hours=12))
        targets = items[:n]
        if not targets:
            console.print("[yellow]Nothing upcoming in cache.[/yellow]")
            raise typer.Exit(0)

    for a in targets:
        console.rule(f"[bold]{a.title}[/bold]  ·  {a.course}")
        with console.status("Generating study pack..."):
            pack = helper.generate(a)
        console.print(Panel(pack.summary, title="Summary", border_style="cyan"))
        console.print(Panel(pack.flashcards, title="Flashcards", border_style="green"))
        console.print(Panel(pack.practice_questions, title="Practice Questions", border_style="magenta"))


def _print_table(items: list[Assignment], now: datetime) -> None:
    table = Table(show_lines=False, header_style="bold")
    table.add_column("key", style="dim", no_wrap=True)
    table.add_column("due")
    table.add_column("type")
    table.add_column("course")
    table.add_column("title")
    for a in items:
        due_str = a.due.strftime("%a %m/%d") if a.due else "—"
        urgency = _urgency_color(a.due, now)
        table.add_row(
            a.dedup_key(),
            f"[{urgency}]{due_str}[/{urgency}]",
            a.type.value,
            a.course,
            a.title,
        )
    console.print(table)


def _urgency_color(due: datetime | None, now: datetime) -> str:
    if not due:
        return "white"
    delta = (due - now).total_seconds() / 3600
    if delta < 24:
        return "red"
    if delta < 72:
        return "yellow"
    return "green"


if __name__ == "__main__":
    app()
