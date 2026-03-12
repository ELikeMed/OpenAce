# ============================================================
# OpenAce Installer — Windows (PowerShell)
# iwr -useb https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.ps1 | iex
# ============================================================

$ErrorActionPreference = "Stop"

# Allow scripts to run permanently for this user (fixes npm.ps1 blocked error)
try { Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force } catch {}
# Also set for current session as fallback
try { Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force } catch {}

Write-Host ""
Write-Host "  ♠  OpenAce Installer" -ForegroundColor Cyan
Write-Host "  ────────────────────" -ForegroundColor Cyan
Write-Host ""

# Helper: refresh PATH from registry (picks up winget installs)
function Refresh-Path {
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# ── Check Git ──
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    Write-Host "  ✓ Git found" -ForegroundColor Green
} else {
    Write-Host "  → Git not found. Installing via winget..." -ForegroundColor Yellow
    try {
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
        Refresh-Path
        # Verify git is now available
        $git = Get-Command git -ErrorAction SilentlyContinue
        if (-not $git) {
            Write-Host ""
            Write-Host "  ! Git was installed but requires a terminal restart." -ForegroundColor Yellow
            Write-Host "  → Close this window, open a NEW PowerShell, and re-run:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "    iwr -useb https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.ps1 | iex" -ForegroundColor Cyan
            Write-Host ""
            exit 0
        }
        Write-Host "  ✓ Git installed" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Could not install Git automatically." -ForegroundColor Red
        Write-Host "    Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
        Write-Host "    Then re-run this installer." -ForegroundColor Yellow
        exit 1
    }
}

# ── Check Node.js ──
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeOk = $false
if ($node) {
    $ver = (node -v) -replace 'v','' -split '\.' | Select-Object -First 1
    if ([int]$ver -ge 18) {
        Write-Host "  ✓ Node.js v$((node -v))" -ForegroundColor Green
        $nodeOk = $true
    } else {
        Write-Host "  ! Node.js v$((node -v)) is too old (need v18+). Upgrading..." -ForegroundColor Yellow
    }
}

if (-not $nodeOk) {
    Write-Host "  → Installing Node.js LTS via winget..." -ForegroundColor Cyan
    try {
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        Refresh-Path
        # Verify node is now available
        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) {
            Write-Host ""
            Write-Host "  ! Node.js was installed but requires a terminal restart." -ForegroundColor Yellow
            Write-Host "  → Close this window, open a NEW PowerShell, and re-run:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "    iwr -useb https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.ps1 | iex" -ForegroundColor Cyan
            Write-Host ""
            exit 0
        }
        Write-Host "  ✓ Node.js installed" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Could not install Node.js automatically." -ForegroundColor Red
        Write-Host "    Download from: https://nodejs.org" -ForegroundColor Yellow
        Write-Host "    Then re-run this installer." -ForegroundColor Yellow
        exit 1
    }
}

# ── Clone or Update OpenAce ──
$installDir = "$env:USERPROFILE\openace"
if (Test-Path "$installDir\.git") {
    Write-Host "  ✓ OpenAce found at $installDir" -ForegroundColor Green
    Set-Location $installDir
    git pull --ff-only 2>$null
} else {
    Write-Host "  → Cloning OpenAce..." -ForegroundColor Cyan
    git clone https://github.com/ELikeMed/OpenAce.git $installDir
    Set-Location $installDir
}

# ── Install Dependencies ──
# npm writes warnings to stderr which PowerShell treats as errors — suppress that
$ErrorActionPreference = "Continue"
Write-Host "  → Installing dependencies (this may take a minute)..." -ForegroundColor Cyan
& npm.cmd install --no-audit --no-fund 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green

# ── Build Dashboard ──
Write-Host "  → Building dashboard..." -ForegroundColor Cyan
Push-Location src/desktop/dashboard-ui
& npm.cmd install --no-audit --no-fund 2>$null
& npm.cmd run build 2>$null
Pop-Location
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Dashboard build failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Dashboard built" -ForegroundColor Green

# ── Build Studio ──
Write-Host "  → Building Ace Studio..." -ForegroundColor Cyan
Push-Location src/studio
& npm.cmd install --no-audit --no-fund 2>$null
& npm.cmd run build 2>$null
Pop-Location
Write-Host "  ✓ Studio built" -ForegroundColor Green

# ── Done ──
Write-Host ""
Write-Host "  ♠  OpenAce installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  ┌─────────────────────────────────────────────┐" -ForegroundColor White
Write-Host "  │  TO START OPENACE:                          │" -ForegroundColor White
Write-Host "  │                                             │" -ForegroundColor White
Write-Host "  │  1. Open a NEW terminal (PowerShell or CMD) │" -ForegroundColor White
Write-Host "  │  2. Run these commands:                     │" -ForegroundColor White
Write-Host "  │                                             │" -ForegroundColor White
Write-Host "  │     cd %USERPROFILE%\openace                │" -ForegroundColor Cyan
Write-Host "  │     .\start.cmd                             │" -ForegroundColor Cyan
Write-Host "  │                                             │" -ForegroundColor White
Write-Host "  │  3. Open your BROWSER and go to:            │" -ForegroundColor White
Write-Host "  │     http://localhost:3333                    │" -ForegroundColor Cyan
Write-Host "  │                                             │" -ForegroundColor White
Write-Host "  │  (Do NOT type the URL in the terminal —     │" -ForegroundColor Yellow
Write-Host "  │   open it in Chrome, Edge, or Firefox)      │" -ForegroundColor Yellow
Write-Host "  └─────────────────────────────────────────────┘" -ForegroundColor White
Write-Host ""
Write-Host "  Note: Desktop automation (mouse/keyboard) requires macOS." -ForegroundColor Yellow
Write-Host "  All other features work on Windows." -ForegroundColor Yellow
Write-Host ""
