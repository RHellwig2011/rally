from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from .cache import DEFAULT_USER, Cache
from .config import load_config
from .crypto import Vault
from .history import History
from .ical import render as ical_render
from .models import Assignment, AssessmentType
from .quiz import QuizStore, prepare_quiz as _prepare_quiz
from .review import REWRITE_REFUSAL, DraftReviewer
from .scaffold import ScaffoldHelper
from .study import StudyHelper
from .sync_runner import sync_user
from .users import UserStore

app = typer.Typer(
    add_completion=False,
    help="Scrape Schoology and PowerSchool, see what's due, and generate study material.",
)
users_app = typer.Typer(help="Manage student profiles for multi-user mode.")
app.add_typer(users_app, name="users")

console = Console()
log = logging.getLogger("schoolscraper")


@app.callback()
def _root(verbose: bool = typer.Option(False, "--verbose", "-v")) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def _open_user_store() -> UserStore | None:
    cfg = load_config()
    if not cfg.master_key:
        return None
    return UserStore(cfg.cache_path, Vault(cfg.master_key))


@app.command()
def sync(
    user: Optional[str] = typer.Option(None, "--user", "-u", help="Sync only this user"),
    all_users: bool = typer.Option(False, "--all", help="Sync every registered user"),
    headed: bool = typer.Option(False, "--headed", help="Show the browser for PowerSchool"),
) -> None:
    """Pull the latest assignments. Defaults to env-based single-user mode
    unless --user or --all is given."""
    cfg = load_config()
    cache = Cache(cfg.cache_path)
    history = History(cfg.cache_path)
    store = _open_user_store()

    if all_users or user:
        if store is None:
            console.print("[red]SCHOOLSCRAPER_MASTER_KEY required for multi-user sync.[/red]")
            raise typer.Exit(1)
        targets = [u for u in store.list() if not user or u.name == user]
        if not targets:
            console.print("[yellow]No matching users.[/yellow]")
            raise typer.Exit(0)
        for u in targets:
            console.print(f"[cyan]Syncing[/cyan] {u.display_name}...")
            r = sync_user(u, cache, headless=not headed, history=history)
            color = "green" if not r.errors else "yellow"
            console.print(f"  [{color}]fetched={r.fetched} deduped={r.deduped} errors={len(r.errors)}[/{color}]")
            for err in r.errors:
                console.print(f"    [red]{err}[/red]")
        return

    from .aggregator import merge as _merge

    fetched: list[Assignment] = []
    if cfg.schoology.configured:
        from .sources.schoology import SchoologyClient

        console.print("[cyan]Fetching Schoology...[/cyan]")
        try:
            fetched.extend(SchoologyClient(cfg.schoology).fetch())
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]Schoology fetch failed:[/red] {e}")
    if cfg.powerschool.configured:
        from .sources.powerschool import PowerSchoolClient

        console.print("[cyan]Fetching PowerSchool...[/cyan]")
        try:
            fetched.extend(PowerSchoolClient(cfg.powerschool, headless=not headed).fetch())
        except Exception as e:  # noqa: BLE001
            console.print(f"[red]PowerSchool fetch failed:[/red] {e}")

    merged = _merge(fetched)
    n = cache.upsert_many(merged, user=DEFAULT_USER)
    console.print(f"[green]Synced {n} assignments[/green] ({len(fetched)} raw -> {len(merged)} after dedup).")


@app.command("list")
def list_cmd(
    user: Optional[str] = typer.Option(None, "--user", "-u"),
    days: int = typer.Option(14, "--days", "-d"),
    type_filter: Optional[str] = typer.Option(None, "--type", "-t", help="test|quiz|assignment|project"),
    include_past: bool = typer.Option(False, "--include-past"),
) -> None:
    """Show upcoming assignments from the cache."""
    cfg = load_config()
    cache = Cache(cfg.cache_path)
    type_arg = AssessmentType(type_filter) if type_filter else None
    now = datetime.utcnow()
    target = user or DEFAULT_USER
    items = cache.list(
        user=target,
        type_filter=type_arg,
        since=None if include_past else now - timedelta(hours=12),
        until=now + timedelta(days=days),
    )
    if not items:
        console.print(
            f"[yellow]Nothing in cache for user '{target}' in that window. "
            "Try `schoolscraper sync` first.[/yellow]"
        )
        raise typer.Exit(0)
    _print_table(items, now)


@app.command()
def study(
    assignment: Optional[str] = typer.Argument(None),
    user: Optional[str] = typer.Option(None, "--user", "-u"),
    upcoming: int = typer.Option(0, "--upcoming", "-n"),
) -> None:
    """Generate a study pack: summary, flashcards, and practice questions."""
    cfg = load_config()
    if not cfg.study.configured:
        console.print("[red]ANTHROPIC_API_KEY not set; cannot generate study material.[/red]")
        raise typer.Exit(1)
    cache = Cache(cfg.cache_path)
    helper = StudyHelper(cfg.study)
    target = user or DEFAULT_USER

    targets: list[Assignment]
    if assignment:
        a = cache.get(assignment, user=target)
        if not a:
            console.print(f"[red]No assignment with key {assignment} for user {target}.[/red]")
            raise typer.Exit(1)
        targets = [a]
    else:
        n = max(upcoming, 1)
        items = cache.list(user=target, since=datetime.utcnow() - timedelta(hours=12))
        targets = items[:n]
        if not targets:
            console.print(f"[yellow]Nothing upcoming in cache for {target}.[/yellow]")
            raise typer.Exit(0)

    for a in targets:
        console.rule(f"[bold]{a.title}[/bold]  ·  {a.course}")
        with console.status("Generating study pack..."):
            pack = helper.generate(a)
        console.print(Panel(pack.summary, title="Summary", border_style="cyan"))
        console.print(Panel(pack.flashcards, title="Flashcards", border_style="green"))
        console.print(Panel(pack.practice_questions, title="Practice Questions", border_style="magenta"))


@app.command()
def review(
    draft: str = typer.Argument(..., help="Path to a file containing YOUR draft"),
    user: Optional[str] = typer.Option(None, "--user", "-u"),
    assignment: Optional[str] = typer.Option(
        None, "--assignment", "-a", help="Dedup key from `list` to pull the prompt/description"
    ),
    rubric: Optional[str] = typer.Option(
        None, "--rubric", "-r", help="Path to a file containing the grading rubric"
    ),
    rubric_text_opt: Optional[str] = typer.Option(
        None, "--rubric-text", help="Paste the rubric inline instead of a file"
    ),
) -> None:
    """Critique YOUR OWN draft against the assignment/rubric.

    Reads a draft you wrote and tells you how to improve it. It does not
    rewrite it or produce submittable text — the revising stays yours.
    """
    from pathlib import Path

    cfg = load_config()
    if not cfg.study.configured:
        console.print("[red]ANTHROPIC_API_KEY not set; cannot review.[/red]")
        raise typer.Exit(1)

    draft_path = Path(draft)
    if not draft_path.is_file():
        console.print(f"[red]Draft file not found: {draft}[/red]")
        raise typer.Exit(1)
    draft_text = draft_path.read_text(encoding="utf-8")
    if not draft_text.strip():
        console.print("[red]Draft file is empty.[/red]")
        raise typer.Exit(1)

    rubric_text: Optional[str] = None
    if rubric and rubric_text_opt:
        console.print("[red]Pass either --rubric (file) or --rubric-text, not both.[/red]")
        raise typer.Exit(1)
    if rubric_text_opt:
        rubric_text = rubric_text_opt
    elif rubric:
        rubric_path = Path(rubric)
        if not rubric_path.is_file():
            console.print(f"[red]Rubric file not found: {rubric}[/red]")
            raise typer.Exit(1)
        rubric_text = rubric_path.read_text(encoding="utf-8")

    a: Optional[Assignment] = None
    if assignment:
        target = user or DEFAULT_USER
        a = cache_get_assignment(cfg, assignment, target)
        if not a:
            console.print(f"[red]No assignment with key {assignment} for user {target}.[/red]")
            raise typer.Exit(1)

    reviewer = DraftReviewer(cfg.study)
    try:
        with console.status("Reviewing your draft..."):
            result = reviewer.review(draft_text, assignment=a, rubric=rubric_text)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    title = a.title if a else draft_path.name
    console.rule(f"[bold]Review: {title}[/bold]")
    console.print(f"[dim]{REWRITE_REFUSAL}[/dim]")
    console.print(Panel(result.overall, title="Overall", border_style="cyan"))
    console.print(Panel(result.dimension_feedback, title="Against the rubric", border_style="green"))
    console.print(
        Panel(result.prioritized_next_steps, title="Fix first (you write it)", border_style="magenta")
    )
    console.print(Panel(result.grade_estimate, title="Where it lands now", border_style="yellow"))


def cache_get_assignment(cfg, dedup_key: str, user: str) -> Optional[Assignment]:
    return Cache(cfg.cache_path).get(dedup_key, user=user)


@app.command()
def outline(
    topic: Optional[str] = typer.Option(None, "--topic", "-t", help="What the work is about"),
    kind: str = typer.Option("essay", "--kind", "-k", help="essay|lab report|presentation|..."),
    user: Optional[str] = typer.Option(None, "--user", "-u"),
    assignment: Optional[str] = typer.Option(
        None, "--assignment", "-a", help="Dedup key from `list` to pull the prompt"
    ),
) -> None:
    """Generate a planning scaffold: structure + guiding questions.

    Gives you the skeleton (sections, their purpose, and the questions each
    must answer) so you write the piece yourself. Produces no prose.
    """
    cfg = load_config()
    if not cfg.study.configured:
        console.print("[red]ANTHROPIC_API_KEY not set; cannot outline.[/red]")
        raise typer.Exit(1)

    a: Optional[Assignment] = None
    if assignment:
        target = user or DEFAULT_USER
        a = cache_get_assignment(cfg, assignment, target)
        if not a:
            console.print(f"[red]No assignment with key {assignment} for user {target}.[/red]")
            raise typer.Exit(1)

    helper = ScaffoldHelper(cfg.study)
    try:
        with console.status("Building your outline..."):
            result = helper.outline(topic=topic, kind=kind, assignment=a)
    except ValueError as e:
        console.print(f"[red]{e}[/red]")
        raise typer.Exit(1)

    heading = a.title if a else (topic or kind)
    console.rule(f"[bold]Outline: {heading}[/bold]")
    console.print("[dim]This is a plan for you to fill in — it contains no writing to copy.[/dim]")
    console.print(Panel(result.structure, title="Scaffold", border_style="cyan"))


@users_app.command("add")
def users_add(
    name: str = typer.Argument(..., help="Short name used by Alexa, e.g. 'bob'"),
    display_name: str = typer.Option("", "--display-name"),
    schoology_key: str = typer.Option("", "--schoology-key", help="Consumer key"),
    schoology_secret: str = typer.Option("", "--schoology-secret", help="Consumer secret"),
    schoology_domain: str = typer.Option("https://app.schoology.com", "--schoology-domain"),
    schoology_uid: str = typer.Option("me", "--schoology-uid"),
    powerschool_url: str = typer.Option("", "--powerschool-url"),
    powerschool_user: str = typer.Option("", "--powerschool-user"),
    powerschool_pass: str = typer.Option("", "--powerschool-pass"),
    powerschool_login: str = typer.Option("form", "--powerschool-login", help="form|sso_google"),
    interactive: bool = typer.Option(True, "--interactive/--no-interactive"),
) -> None:
    """Register a new student profile. Credentials are encrypted at rest."""
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY must be set in .env first.[/red]")
        raise typer.Exit(1)

    if interactive:
        display_name = display_name or typer.prompt("Display name (spoken by Alexa)", default=name.title())
        if not schoology_key:
            schoology_key = typer.prompt("Schoology consumer key (blank to skip)", default="", show_default=False)
        if schoology_key and not schoology_secret:
            schoology_secret = typer.prompt("Schoology consumer secret", hide_input=True)
        if not powerschool_url:
            powerschool_url = typer.prompt("PowerSchool URL (blank to skip)", default="", show_default=False)
        if powerschool_url and not powerschool_user:
            powerschool_user = typer.prompt("PowerSchool username")
        if powerschool_url and not powerschool_pass:
            powerschool_pass = typer.prompt("PowerSchool password", hide_input=True)

    store.upsert(
        name=name,
        display_name=display_name or name.title(),
        schoology_consumer_key=schoology_key,
        schoology_consumer_secret=schoology_secret,
        schoology_domain=schoology_domain,
        schoology_user_id=schoology_uid,
        powerschool_url=powerschool_url,
        powerschool_username=powerschool_user,
        powerschool_password=powerschool_pass,
        powerschool_login_mode=powerschool_login,
    )
    console.print(f"[green]Saved user {name}.[/green]")


@users_app.command("list")
def users_list() -> None:
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY not set.[/red]")
        raise typer.Exit(1)
    users = store.list()
    if not users:
        console.print("[yellow]No users registered yet. Run `schoolscraper users add <name>`.[/yellow]")
        return
    table = Table(header_style="bold")
    table.add_column("name")
    table.add_column("display name")
    table.add_column("schoology")
    table.add_column("powerschool")
    for u in users:
        table.add_row(
            u.name,
            u.display_name,
            "yes" if u.schoology_config().configured else "—",
            "yes" if u.powerschool_config().configured else "—",
        )
    console.print(table)


@users_app.command("update")
def users_update(
    name: str = typer.Argument(...),
    display_name: str = typer.Option("", "--display-name"),
    schoology_key: str = typer.Option("", "--schoology-key"),
    schoology_secret: str = typer.Option("", "--schoology-secret"),
    schoology_domain: str = typer.Option("", "--schoology-domain"),
    schoology_uid: str = typer.Option("", "--schoology-uid"),
    powerschool_url: str = typer.Option("", "--powerschool-url"),
    powerschool_user: str = typer.Option("", "--powerschool-user"),
    powerschool_pass: str = typer.Option("", "--powerschool-pass"),
    powerschool_login: str = typer.Option("", "--powerschool-login"),
) -> None:
    """Update only the fields you pass; everything else stays as-is."""
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY not set.[/red]")
        raise typer.Exit(1)
    existing = store.get(name)
    if existing is None:
        console.print(f"[red]No user named {name}.[/red]")
        raise typer.Exit(1)
    store.upsert(
        name=existing.name,
        display_name=display_name or existing.display_name,
        schoology_consumer_key=schoology_key or existing.schoology_consumer_key,
        schoology_consumer_secret=schoology_secret or existing.schoology_consumer_secret,
        schoology_domain=schoology_domain or existing.schoology_domain,
        schoology_user_id=schoology_uid or existing.schoology_user_id,
        powerschool_url=powerschool_url or existing.powerschool_url,
        powerschool_username=powerschool_user or existing.powerschool_username,
        powerschool_password=powerschool_pass or existing.powerschool_password,
        powerschool_login_mode=powerschool_login or existing.powerschool_login_mode,
    )
    console.print(f"[green]Updated {existing.name}.[/green]")


@users_app.command("remove")
def users_remove(name: str = typer.Argument(...)) -> None:
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY not set.[/red]")
        raise typer.Exit(1)
    if store.remove(name):
        console.print(f"[green]Removed {name}.[/green]")
    else:
        console.print(f"[yellow]No user named {name}.[/yellow]")


@app.command()
def status() -> None:
    """Show last sync time, item count, and any errors per user."""
    cfg = load_config()
    history = History(cfg.cache_path)
    cache = Cache(cfg.cache_path)
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY not set.[/red]")
        raise typer.Exit(1)
    latest = history.latest_per_user()
    table = Table(header_style="bold")
    table.add_column("user")
    table.add_column("last sync")
    table.add_column("ok")
    table.add_column("items")
    table.add_column("errors")
    for u in store.list():
        ev = latest.get(u.name)
        items = len(cache.list(user=u.name))
        if ev is None:
            table.add_row(u.name, "—", "—", str(items), "")
            continue
        ok = "[green]yes[/green]" if ev.ok else "[red]no[/red]"
        errs = "; ".join(ev.errors) if ev.errors else ""
        table.add_row(
            u.name,
            ev.finished_at.strftime("%Y-%m-%d %H:%M"),
            ok, str(items), errs,
        )
    console.print(table)


@app.command()
def ical(
    user: Optional[str] = typer.Option(None, "--user", "-u"),
    output: Optional[str] = typer.Option(None, "--output", "-o", help="Write to file instead of stdout"),
) -> None:
    """Export upcoming work as an iCalendar (.ics) feed."""
    cfg = load_config()
    cache = Cache(cfg.cache_path)
    target = user or DEFAULT_USER
    items = cache.list(user=target)
    label = target if target != DEFAULT_USER else "School"
    ics = ical_render(items, user=target, calendar_name=f"School ({label})")
    if output:
        from pathlib import Path

        Path(output).write_text(ics, encoding="utf-8")
        console.print(f"[green]Wrote {len(items)} events to {output}[/green]")
    else:
        typer.echo(ics)


@app.command("prepare-quiz")
def prepare_quiz_cmd(
    assignment: str = typer.Argument(..., help="Dedup key from `list`"),
    user: Optional[str] = typer.Option(None, "--user", "-u"),
) -> None:
    """Pre-generate flashcards for an assessment so Alexa can quiz on it."""
    cfg = load_config()
    if not cfg.study.configured:
        console.print("[red]ANTHROPIC_API_KEY not set.[/red]")
        raise typer.Exit(1)
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY not set.[/red]")
        raise typer.Exit(1)
    user_obj = store.get(user) if user else None
    if user_obj is None:
        console.print(f"[red]Unknown user {user}.[/red]")
        raise typer.Exit(1)
    helper = StudyHelper(cfg.study)
    cache = Cache(cfg.cache_path)
    quizzes = QuizStore(cfg.cache_path)
    with console.status("Generating flashcards..."):
        n = _prepare_quiz(
            user=user_obj, dedup_key=assignment,
            assignments=cache, quizzes=quizzes, helper=helper,
        )
    console.print(f"[green]Cached {n} flashcards for {user_obj.display_name}.[/green]")


@app.command()
def digest(
    user: Optional[str] = typer.Option(None, "--user", "-u"),
    dry_run: bool = typer.Option(True, "--dry-run/--send", help="Preview text without sending"),
) -> None:
    """Build today's Notify Me digest. Use --send to actually push to Alexa."""
    from .notify import send_daily_digest

    cfg = load_config()
    cache = Cache(cfg.cache_path)
    store = _open_user_store()
    if store is None:
        console.print("[red]SCHOOLSCRAPER_MASTER_KEY not set.[/red]")
        raise typer.Exit(1)
    if not dry_run and not cfg.server.notify_me_access_code:
        console.print("[red]NOTIFY_ME_ACCESS_CODE required to actually send.[/red]")
        raise typer.Exit(1)

    targets = [store.get(user)] if user else store.list()
    targets = [u for u in targets if u]
    if not targets:
        console.print("[yellow]No users.[/yellow]")
        raise typer.Exit(0)
    for u in targets:
        text = send_daily_digest(
            user=u, cache=cache,
            timezone=cfg.server.timezone,
            access_code=cfg.server.notify_me_access_code,
            dry_run=dry_run,
        )
        console.print(f"[bold]{u.display_name}:[/bold] {text or '(empty digest, skipped)'}")


@app.command()
def serve() -> None:
    """Run the FastAPI service (used by the Pi systemd unit)."""
    from .server import run

    cfg = load_config()
    run(cfg)


@app.command("alexa-model")
def alexa_model() -> None:
    """Print the Alexa interaction model JSON, with the {Student} slot type
    populated from the registered users. Paste into the Alexa Developer
    Console -> JSON Editor."""
    store = _open_user_store()
    user_values: list[dict] = []
    if store is not None:
        for u in store.list():
            user_values.append(
                {"name": {"value": u.display_name, "synonyms": [u.name]}}
            )
    if not user_values:
        user_values = [{"name": {"value": "Student"}}]

    model = {
        "interactionModel": {
            "languageModel": {
                "invocationName": "study buddy",
                "intents": [
                    {"name": "AMAZON.HelpIntent", "samples": []},
                    {"name": "AMAZON.StopIntent", "samples": []},
                    {"name": "AMAZON.CancelIntent", "samples": []},
                    {"name": "AMAZON.FallbackIntent", "samples": []},
                    {"name": "AMAZON.YesIntent", "samples": []},
                    {"name": "AMAZON.NoIntent", "samples": []},
                    {
                        "name": "QuizMeIntent",
                        "slots": [{"name": "Student", "type": "StudentName"}],
                        "samples": [
                            "quiz me", "quiz {Student}",
                            "quiz me on my next test", "start a quiz",
                            "start a quiz for {Student}", "test me",
                        ],
                    },
                    {
                        "name": "FreeAnswerIntent",
                        "slots": [{"name": "Answer", "type": "AMAZON.SearchQuery"}],
                        "samples": [
                            "my answer is {Answer}",
                            "the answer is {Answer}",
                            "I think {Answer}",
                            "{Answer}",
                        ],
                    },
                    {
                        "name": "UpcomingWorkIntent",
                        "slots": [
                            {"name": "Student", "type": "StudentName"},
                            {"name": "DateRange", "type": "AMAZON.DURATION"},
                            {"name": "WorkType", "type": "WorkType"},
                        ],
                        "samples": [
                            "what's due", "what's due this week",
                            "what's due for {Student}",
                            "what's due for {Student} this week",
                            "what {WorkType} does {Student} have",
                            "do I have any {WorkType} tomorrow",
                            "what tests does {Student} have this week",
                            "what's coming up in the next {DateRange}",
                        ],
                    },
                    {
                        "name": "NextStudyIntent",
                        "slots": [{"name": "Student", "type": "StudentName"}],
                        "samples": [
                            "what should I study",
                            "what should {Student} study",
                            "what's the next test",
                            "what's {Student}'s next test",
                        ],
                    },
                ],
                "types": [
                    {"name": "StudentName", "values": user_values},
                    {
                        "name": "WorkType",
                        "values": [
                            {"name": {"value": "test", "synonyms": ["exam", "tests", "exams"]}},
                            {"name": {"value": "quiz", "synonyms": ["quizzes"]}},
                            {"name": {"value": "assignment", "synonyms": ["homework", "assignments"]}},
                            {"name": {"value": "project", "synonyms": ["projects"]}},
                        ],
                    },
                ],
            }
        }
    }
    typer.echo(json.dumps(model, indent=2))


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
            a.type.value, a.course, a.title,
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
