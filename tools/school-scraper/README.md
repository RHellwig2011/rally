# School Scraper & Study Tool

A Python CLI that pulls upcoming assignments, quizzes, and tests from
**Schoology** and **PowerSchool**, then helps you study by generating
practice questions and topic summaries.

> This is a **study aid**. It does not — and will not — auto-fill answers
> into graded assignments. It generates practice material so you can quiz
> yourself before the real assessment.

---

## What it does

- `schoolscraper sync` — fetches all upcoming assignments from both
  platforms and caches them locally (SQLite).
- `schoolscraper list` — shows what's due, sorted by date, color-coded by
  urgency. Filter by `--type test|quiz|assignment` or `--days 7`.
- `schoolscraper study <assignment-id>` — generates flashcards, practice
  questions, and a concept summary for a specific assignment using the
  Claude API.
- `schoolscraper study --upcoming 3` — generates study packs for the
  next 3 due assessments.

---

## Setup

### 1. Install

```bash
cd tools/school-scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium      # only needed for PowerSchool
```

Requires Python 3.10+.

### 2. Configure

Copy `.env.example` to `.env` and fill in:

```
# --- Schoology ---
# Get these at https://app.schoology.com/api (your account -> API)
SCHOOLOGY_CONSUMER_KEY=...
SCHOOLOGY_CONSUMER_SECRET=...
SCHOOLOGY_DOMAIN=https://app.schoology.com   # or your district subdomain
SCHOOLOGY_USER_ID=me                          # 'me' or numeric UID

# --- PowerSchool ---
# Most districts: https://ps.<district>.org/public/
POWERSCHOOL_URL=https://ps.example.org/public/
POWERSCHOOL_USERNAME=...
POWERSCHOOL_PASSWORD=...

# --- Study helper (Claude) ---
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run

```bash
schoolscraper sync                     # pull latest
schoolscraper list --days 14           # what's due in the next two weeks
schoolscraper study --upcoming 1       # study pack for the next test
```

---

## How auth works

- **Schoology** uses its official REST API with 2-legged OAuth1. Your
  consumer key and secret act on your behalf — no password stored.
- **PowerSchool** has no student-facing public API, so we use Playwright
  to log in headlessly with your credentials and parse the assignments
  page. Credentials live in `.env` and are never sent anywhere except
  PowerSchool.

If your district uses SAML/Google SSO for PowerSchool, set
`POWERSCHOOL_LOGIN_MODE=sso_google` in `.env`.

---

## What it won't do

- **Submit answers to graded assignments.** That's cheating, full stop.
- **Bypass test lockdown browsers** or proctoring software.
- **Pull material you don't already have access to** — it logs in as
  *you*, so it sees only what you'd see in a browser.

The study helper is explicitly prompted to generate *practice* material
("here's how a strong answer is structured" / "here's a flashcard set on
this topic") and to never produce text that should be pasted into a live
assessment.
