# School Scraper & Study Tool

Pulls upcoming assignments, quizzes, and tests from **Schoology** and
**PowerSchool**, surfaces them across multiple students in a household, and
exposes them to **Alexa** so you can ask "what's due this week".

> This is a **study aid**. It does not — and will not — auto-fill answers
> into graded assignments. It generates practice material so you can quiz
> yourself before the real assessment.

---

## What's in the box

- **CLI** for local sync, listing, and study-pack generation.
- **Multi-user** profiles with per-user Schoology/PowerSchool credentials,
  encrypted at rest with a master key.
- **Pi service** — a FastAPI app running under systemd that auto-syncs every
  hour and exposes a small REST API.
- **Alexa Skill** — custom skill that hits the Pi over Cloudflare Tunnel and
  answers natural-language questions about upcoming work.
- **Claude-powered study packs** — concept summaries, flashcards, and
  practice questions for any assessment.

---

## Quick start (laptop, single user)

```bash
cd tools/school-scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

cp .env.example .env
# Edit .env — fill in SCHOOLOGY_*, POWERSCHOOL_*, ANTHROPIC_API_KEY
schoolscraper sync
schoolscraper list --days 14
schoolscraper study --upcoming 1
```

---

## Multi-user mode

Generate a master key first (this encrypts per-user credentials):

```bash
python -c 'import secrets; print(secrets.token_urlsafe(32))' >> .env
# manually move the value to SCHOOLSCRAPER_MASTER_KEY=
```

Add a student:

```bash
schoolscraper users add bob --display-name Bob
# (will prompt for Schoology key/secret and PowerSchool credentials)

schoolscraper users add alice --display-name Alice
schoolscraper users list
```

Sync everyone:

```bash
schoolscraper sync --all
schoolscraper list --user bob --days 7
schoolscraper study --user bob --upcoming 1
```

Credentials live in the SQLite cache encrypted with Fernet — losing the
master key means re-entering credentials.

---

## Run on a Raspberry Pi

Tested on Raspberry Pi 4 / 5 with Raspberry Pi OS (64-bit). For 32-bit OSes
adjust the cloudflared download URL.

```bash
# On the Pi:
git clone <this-repo> /tmp/rally
cd /tmp/rally/tools/school-scraper
sudo bash deploy/pi-install.sh
```

The installer:

- Creates a `schoolscraper` service user.
- Installs into `/opt/schoolscraper` with a venv.
- Installs Playwright + Chromium for PowerSchool scraping.
- Generates a master key and API token in `/etc/schoolscraper/schoolscraper.env`.
- Installs and enables the `schoolscraper.service` systemd unit.

Then:

```bash
# Edit /etc/schoolscraper/schoolscraper.env to add ANTHROPIC_API_KEY (and
# ALEXA_SKILL_ID after you create the skill).
sudo -u schoolscraper /opt/schoolscraper/.venv/bin/schoolscraper users add bob
sudo systemctl start schoolscraper
curl http://localhost:8765/health
```

The service auto-syncs every `SCHOOLSCRAPER_SYNC_MINUTES` (default 60).

### REST API

With `SCHOOLSCRAPER_API_TOKEN` set, requests need
`Authorization: Bearer <token>`:

```
GET  /health
GET  /api/users
GET  /api/users/{name}/upcoming?days=7&type=test
POST /api/users/{name}/sync
POST /api/users/{name}/study/{dedup_key}
```

The `/alexa` endpoint does not use the bearer token; it validates Alexa's
own signature and the configured `ALEXA_SKILL_ID`.

---

## Alexa integration

```
[ Echo ] -> Alexa cloud -> https://study.your-domain.com/alexa
                                     |
                            Cloudflare Tunnel
                                     |
                                  [ Pi:8765 ]
```

1. Set up a Cloudflare Tunnel to your Pi — see
   [`deploy/CLOUDFLARE_TUNNEL.md`](deploy/CLOUDFLARE_TUNNEL.md).
2. Create the skill in the Alexa Developer Console — see
   [`alexa-skill/README.md`](alexa-skill/README.md).
3. Paste the skill ID into `/etc/schoolscraper/schoolscraper.env` and restart.

Try it:

> "Alexa, ask Study Buddy what's due for Bob this week."
> "Alexa, ask Study Buddy what tests Alice has tomorrow."
> "Alexa, ask Study Buddy what should Bob study."

If only one student is registered, you can drop the name:

> "Alexa, ask Study Buddy what's due this week."

### Why a custom skill instead of "Notify Me"?

- A custom skill answers questions on demand. "Notify Me" is one-way only
  (it announces; it doesn't respond to questions).
- The custom skill supports the multi-student `{Student}` slot so each kid
  gets their own answers.

If you'd rather have one-way announcements (e.g. "you have a math test
tomorrow"), it's straightforward to add a `notify` cron that POSTs to the
Notify Me skill's webhook — file an issue and I'll add it.

---

## Auth model

| Source | How |
|--------|-----|
| Schoology | Official REST API, 2-legged OAuth1 (consumer key + secret per student). |
| PowerSchool | Playwright login as the student (form or Google SSO). No public student API exists. |
| Local creds at rest | Encrypted with Fernet, key derived from `SCHOOLSCRAPER_MASTER_KEY`. |
| REST API | Optional `Authorization: Bearer <SCHOOLSCRAPER_API_TOKEN>`. |
| Alexa endpoint | Skill ID check + Alexa request signature verification (when `ask-sdk-webservice-support` is installed). |

---

## What it won't do

- **Submit answers to graded assignments.** That's cheating, full stop.
- **Bypass test lockdown browsers** or proctoring software.
- **Pull material a student doesn't already have access to** — it logs in as
  them, so it sees only what they'd see in a browser.

The study helper is explicitly prompted to generate *practice* material
("here's how a strong answer is structured" / "here's a flashcard set on
this topic") and never produces text that should be pasted into a live
assessment.

---

## Layout

```
tools/school-scraper/
├── README.md                       # this file
├── pyproject.toml / requirements.txt
├── .env.example
├── schoolscraper/
│   ├── cli.py                       # Typer CLI: sync, list, study, users, serve, alexa-model
│   ├── server.py                    # FastAPI app
│   ├── alexa.py                     # Alexa intent dispatch
│   ├── scheduler.py                 # APScheduler hourly sync
│   ├── sync_runner.py               # per-user sync orchestrator
│   ├── users.py                     # UserStore + User dataclass
│   ├── crypto.py                    # Fernet vault
│   ├── cache.py                     # user-scoped SQLite store
│   ├── models.py                    # Assignment / classify_type
│   ├── aggregator.py                # cross-source dedup
│   ├── study.py                     # Claude-powered study pack
│   └── sources/
│       ├── schoology.py
│       └── powerschool.py
├── deploy/
│   ├── pi-install.sh
│   ├── schoolscraper.service
│   ├── cloudflared.service
│   └── CLOUDFLARE_TUNNEL.md
├── alexa-skill/
│   ├── skill-manifest.json
│   ├── interaction-model.json
│   └── README.md
└── tests/
```
