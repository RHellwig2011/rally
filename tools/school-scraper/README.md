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
- **Host service** — a FastAPI app that auto-syncs every hour and exposes
  a small REST API. Runs as a systemd service on Linux/Pi or a Task
  Scheduler entry on Windows.
- **Alexa Skill** — custom skill that hits your host over Cloudflare
  Tunnel and answers natural-language questions about upcoming work, plus
  an interactive flashcard **quiz mode**.
- **Claude-powered study packs** — concept summaries, flashcards, and
  practice questions for any assessment.
- **iCal feed** per user (subscribe phone/Google Calendar to it).
- **Daily morning digest** to Echo via Notify Me ("you have a math test
  tomorrow"), in your local timezone.
- **`status` command** so you can see last sync time and any errors at a glance.

---

## Quick start (laptop, single user)

On macOS / Linux:

```bash
cd tools/school-scraper
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
playwright install chromium

cp .env.example .env
# Edit .env — fill in SCHOOLOGY_*, POWERSCHOOL_*, ANTHROPIC_API_KEY
schoolscraper sync
schoolscraper list --days 14
schoolscraper study --upcoming 1
```

On Windows: see [Run on a Windows PC](#run-on-a-windows-pc) below.

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
schoolscraper users add alice --display-name Alice
schoolscraper users list
schoolscraper users update bob --schoology-secret <new-secret>
```

Sync everyone:

```bash
schoolscraper sync --all
schoolscraper status
schoolscraper list --user bob --days 7
schoolscraper study --user bob --upcoming 1
```

Credentials live in the SQLite cache encrypted with Fernet — losing the
master key means re-entering credentials.

---

## Run on a Raspberry Pi

Tested on Raspberry Pi 4 / 5 with Raspberry Pi OS (64-bit). For 32-bit
OSes adjust the cloudflared download URL.

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

The service auto-syncs every `SCHOOLSCRAPER_SYNC_MINUTES` (default 60).

## Run on a Windows PC

Fully supported — host the service on your normal Windows machine instead
of a Pi. Open PowerShell:

```powershell
cd $HOME
git clone https://github.com/RHellwig2011/rally.git
cd rally
git checkout claude/school-scraper-study-tool-Uv1QN
cd tools\school-scraper

# One-time: allow local PowerShell scripts to run
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# Install (creates venv, installs deps, generates a master key)
.\deploy\windows-install.ps1
```

Edit `.env` (it'll open in Notepad with `notepad .env`) and add:

- `ANTHROPIC_API_KEY=sk-ant-...` (from <https://console.anthropic.com/settings/keys>)
- Optionally `ALEXA_SKILL_ID` (after you create the skill)
- Optionally `NOTIFY_ME_ACCESS_CODE` (for daily Alexa announcements)

Then add a student and try a sync:

```powershell
.\.venv\Scripts\schoolscraper.exe users add bob
.\.venv\Scripts\schoolscraper.exe sync --user bob
.\.venv\Scripts\schoolscraper.exe list --user bob
.\.venv\Scripts\schoolscraper.exe study --user bob --upcoming 1
```

To run the server (so the iCal feed and Alexa endpoint work):

```powershell
.\.venv\Scripts\schoolscraper.exe serve
```

### Auto-start at logon

To have the server start whenever you sign in, re-run the installer with
`-RegisterTask`:

```powershell
.\deploy\windows-install.ps1 -RegisterTask
Start-ScheduledTask -TaskName schoolscraper
```

This registers a Task Scheduler entry. To stop or remove it:

```powershell
Stop-ScheduledTask -TaskName schoolscraper
Unregister-ScheduledTask -TaskName schoolscraper -Confirm:$false
```

> **Note**: A Task Scheduler entry runs as your Windows user when you're
> logged in. If you want it to keep running even when you're signed out
> (or before any user signs in), use the **NSSM** (Non-Sucking Service
> Manager) approach instead — see <https://nssm.cc/>.

### Cloudflare Tunnel on Windows

For Alexa to reach your PC, set up a Cloudflare Tunnel. See
[`deploy/CLOUDFLARE_TUNNEL.md`](deploy/CLOUDFLARE_TUNNEL.md) — it has a
Windows section.

### REST API

With `SCHOOLSCRAPER_API_TOKEN` set, requests need
`Authorization: Bearer <token>`:

```
GET  /health
GET  /api/status                                  # last sync per user, errors
GET  /api/users
GET  /api/users/{name}/upcoming?days=7&type=test
GET  /api/users/{name}/calendar.ics               # subscribe from a calendar app
POST /api/users/{name}/sync
POST /api/users/{name}/study/{dedup_key}
POST /api/users/{name}/quiz/prepare/{dedup_key}   # cache flashcards for Alexa
```

The `/alexa` endpoint does not use the bearer token; it validates Alexa's
own signature and the configured `ALEXA_SKILL_ID`. The `/calendar.ics`
endpoint is unauthenticated by default for easy calendar subscription —
put it behind Cloudflare Access if you need it locked down.

---

## Alexa integration

```
[ Echo ] -> Alexa cloud -> https://study.your-domain.com/alexa
                                     |
                            Cloudflare Tunnel
                                     |
                          [ Pi or Windows PC :8765 ]
```

1. Set up a Cloudflare Tunnel to your host — see
   [`deploy/CLOUDFLARE_TUNNEL.md`](deploy/CLOUDFLARE_TUNNEL.md).
2. Create the skill in the Alexa Developer Console — see
   [`alexa-skill/README.md`](alexa-skill/README.md).
3. Paste the skill ID into your `.env` (or `/etc/schoolscraper/schoolscraper.env`
   on Linux) and restart the service.

Try it:

> "Alexa, ask Study Buddy what's due for Bob this week."
> "Alexa, ask Study Buddy what tests Alice has tomorrow."
> "Alexa, ask Study Buddy what should Bob study."
> "Alexa, ask Study Buddy to quiz Bob."

If only one student is registered you can drop the name.

### Quiz mode

To use the interactive flashcard quiz, first cache flashcards for an
upcoming assessment (one Claude call per assessment):

```bash
schoolscraper list --user bob              # find the dedup key
schoolscraper prepare-quiz <key> --user bob
```

Then on Alexa: *"Alexa, ask Study Buddy to quiz Bob."* The skill reads each
question, you answer aloud, then say **yes** or **no** to self-grade, and
it tracks your score across the deck.

### Daily morning digest

If you set `NOTIFY_ME_ACCESS_CODE` (free skill, register at
<https://www.thomptronics.com/notify-me>), the host pushes a once-a-day
digest to Alexa at `SCHOOLSCRAPER_DIGEST_HOUR`:

> "Good morning, Bob! Heads up: you have a test today — Cell Bio Test in
> Biology. Tomorrow: assignment in Algebra II, HW 4."

Preview without sending: `schoolscraper digest --user bob`.

### Calendar subscription

```
https://study.your-domain.com/api/users/bob/calendar.ics
```

Or export to a file: `schoolscraper ical --user bob -o bob.ics`.

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
- **"Humanize" AI output to defeat detection.** Same reason.
- **Pull material a student doesn't already have access to** — it logs in
  as them, so it sees only what they'd see in a browser.

The study helper is explicitly prompted to generate *practice* material
and never produces text that should be pasted into a live assessment.

---

## Tests

```bash
pip install pytest
pytest tests/ -v
```

48 tests cover dedup, type classification, encryption, user store CRUD,
timezone math, sync history, iCal rendering, Notify Me digest text
building, flashcard parsing/storage, and the full Alexa intent dispatch
including the multi-turn quiz flow.
