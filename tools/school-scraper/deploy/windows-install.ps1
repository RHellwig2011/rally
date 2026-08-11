# Install schoolscraper on Windows.
#
# Usage (from the tools/school-scraper directory):
#   .\deploy\windows-install.ps1
#
# Optional:
#   .\deploy\windows-install.ps1 -RegisterTask   # auto-start at logon

[CmdletBinding()]
param(
    [switch]$RegisterTask,
    [string]$TaskName = "schoolscraper"
)

$ErrorActionPreference = "Stop"

# Locate the school-scraper directory (parent of the deploy/ folder where
# this script lives). Works whether the user runs it from the repo root or
# from inside deploy/.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $RootDir

Write-Host ""
Write-Host "==> School Scraper Windows installer" -ForegroundColor Cyan
Write-Host "Working directory: $RootDir"
Write-Host ""

# 1. Python check
$pythonVersion = & python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Python is not on PATH. Install Python 3.10+ from https://python.org and re-run."
}
Write-Host "Found $pythonVersion"

# 2. Virtualenv
if (-not (Test-Path ".venv")) {
    Write-Host "==> Creating .venv"
    & python -m venv .venv
}
$venvPython = Join-Path $RootDir ".venv\Scripts\python.exe"
$venvScraper = Join-Path $RootDir ".venv\Scripts\schoolscraper.exe"

# 3. Install deps
Write-Host "==> Installing Python dependencies (this can take a few minutes)"
& $venvPython -m pip install --upgrade pip --quiet
& $venvPython -m pip install -r requirements.txt --quiet
& $venvPython -m pip install -e . --quiet

Write-Host "==> Installing Playwright Chromium (used for PowerSchool scraping)"
& $venvPython -m playwright install chromium

# 4. .env scaffolding
if (-not (Test-Path ".env")) {
    Write-Host "==> Creating .env from .env.example"
    Copy-Item ".env.example" ".env"

    $masterKey = & $venvPython -c "import secrets; print(secrets.token_urlsafe(32))"
    $apiToken  = & $venvPython -c "import secrets; print(secrets.token_urlsafe(24))"

    # Replace the empty placeholders in .env with generated values
    (Get-Content .env) `
        -replace '^SCHOOLSCRAPER_MASTER_KEY=.*', "SCHOOLSCRAPER_MASTER_KEY=$masterKey" `
        -replace '^SCHOOLSCRAPER_API_TOKEN=.*',  "SCHOOLSCRAPER_API_TOKEN=$apiToken" `
        -replace '^SCHOOLSCRAPER_CACHE_PATH=.*', 'SCHOOLSCRAPER_CACHE_PATH=.schoolscraper.db' `
        | Set-Content .env

    Write-Host "    Wrote a fresh master key and API token to .env" -ForegroundColor Green
} else {
    Write-Host "==> .env already exists; leaving it alone" -ForegroundColor Yellow
}

# 5. Optional: Task Scheduler entry that auto-starts the server at logon
if ($RegisterTask) {
    Write-Host "==> Registering scheduled task '$TaskName'"
    $action = New-ScheduledTaskAction `
        -Execute $venvScraper `
        -Argument "serve" `
        -WorkingDirectory $RootDir
    $trigger = New-ScheduledTaskTrigger -AtLogon -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet `
        -StartWhenAvailable `
        -RestartCount 3 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

    Register-ScheduledTask -TaskName $TaskName `
        -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal `
        -Force | Out-Null

    Write-Host "    Task registered. Start it now with:" -ForegroundColor Green
    Write-Host "        Start-ScheduledTask -TaskName $TaskName"
    Write-Host "    Or just sign out and back in."
}

Write-Host ""
Write-Host "Done. Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Edit .env and add ANTHROPIC_API_KEY (and ALEXA_SKILL_ID later)."
Write-Host "  2. Add at least one student profile:"
Write-Host "        .\.venv\Scripts\schoolscraper.exe users add bob"
Write-Host "  3. Try a sync:"
Write-Host "        .\.venv\Scripts\schoolscraper.exe sync --user bob"
Write-Host "        .\.venv\Scripts\schoolscraper.exe list --user bob"
Write-Host ""
if (-not $RegisterTask) {
    Write-Host "  4. Run the server in this window:" -ForegroundColor DarkGray
    Write-Host "        .\.venv\Scripts\schoolscraper.exe serve"
    Write-Host "     OR re-run this installer with -RegisterTask to auto-start at logon."
    Write-Host ""
}
