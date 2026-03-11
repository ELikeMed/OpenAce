# ============================================================
# OpenAce Installer — Windows (PowerShell)
# iwr -useb https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.ps1 | iex
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  ♠  OpenAce Installer" -ForegroundColor Cyan
Write-Host "  ────────────────────" -ForegroundColor Cyan
Write-Host ""

# ── Check Git ──
$git = Get-Command git -ErrorAction SilentlyContinue
if ($git) {
    Write-Host "  ✓ Git found" -ForegroundColor Green
} else {
    Write-Host "  ! Git not found. Installing via winget..." -ForegroundColor Yellow
    try {
        winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "  ✓ Git installed" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Could not install Git automatically." -ForegroundColor Red
        Write-Host "    Download from: https://git-scm.com/download/win" -ForegroundColor Yellow
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
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
        Write-Host "  ✓ Node.js installed" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Could not install Node.js automatically." -ForegroundColor Red
        Write-Host "    Download from: https://nodejs.org" -ForegroundColor Yellow
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
Write-Host "  → Installing dependencies (this may take a minute)..." -ForegroundColor Cyan
npm install --no-audit --no-fund 2>&1 | Select-Object -Last 3

# ── Build Dashboard ──
Write-Host "  → Building dashboard..." -ForegroundColor Cyan
Push-Location src/desktop/dashboard-ui
npm install --no-audit --no-fund 2>&1 | Select-Object -Last 1
npm run build 2>&1 | Select-Object -Last 1
Pop-Location

Write-Host ""
Write-Host "  ♠  OpenAce installed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  To start OpenAce:" -ForegroundColor White
Write-Host "    cd ~/openace; npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Then open: http://localhost:3333" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Note: Desktop automation (mouse/keyboard control) requires macOS." -ForegroundColor Yellow
Write-Host "  All other features work on Windows." -ForegroundColor Yellow
Write-Host ""
