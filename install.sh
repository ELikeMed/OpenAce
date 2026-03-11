#!/bin/bash
# ============================================================
# OpenAce Installer — macOS / Linux
# curl -fsSL https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.sh | bash
# ============================================================

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${CYAN}${BOLD}  ♠  OpenAce Installer${NC}"
echo -e "  ${CYAN}────────────────────${NC}"
echo ""

# ── Check Git ──
if command -v git &>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Git found"
else
  echo -e "  ${RED}✗${NC} Git not found."
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "  ${YELLOW}→${NC} Installing via Xcode Command Line Tools..."
    xcode-select --install 2>/dev/null || true
    echo -e "  ${YELLOW}→${NC} After install completes, re-run this script."
    exit 1
  else
    echo -e "  ${YELLOW}→${NC} Install Git first:"
    echo -e "    Ubuntu/Debian: sudo apt install git"
    echo -e "    CentOS/RHEL:   sudo yum install git"
    exit 1
  fi
fi

# ── Check / Install Node.js ──
NODE_MIN=18
if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge "$NODE_MIN" ]; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
  else
    echo -e "  ${YELLOW}!${NC} Node.js $(node -v) is too old (need v${NODE_MIN}+). Upgrading..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>/dev/null
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    nvm install --lts 2>/dev/null
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed"
  fi
else
  echo -e "  ${YELLOW}!${NC} Node.js not found. Installing..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash 2>/dev/null
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  nvm install --lts 2>/dev/null
  echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed"
fi

# ── Clone or Update OpenAce ──
INSTALL_DIR="$HOME/openace"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  ${GREEN}✓${NC} OpenAce found at $INSTALL_DIR"
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
else
  echo -e "  ${CYAN}→${NC} Cloning OpenAce..."
  git clone https://github.com/ELikeMed/OpenAce.git "$INSTALL_DIR" 2>&1 | tail -1
  cd "$INSTALL_DIR"
fi

# ── Install Dependencies ──
echo -e "  ${CYAN}→${NC} Installing dependencies (this may take a minute)..."
npm install --no-audit --no-fund 2>&1 | tail -3

# ── Build Dashboard ──
echo -e "  ${CYAN}→${NC} Building dashboard..."
cd src/desktop/dashboard-ui && npm install --no-audit --no-fund 2>&1 | tail -1 && npm run build 2>&1 | tail -1 && cd ../../..

echo ""
echo -e "  ${GREEN}${BOLD}♠  OpenAce installed successfully!${NC}"
echo ""
echo -e "  To start OpenAce:"
echo -e "    ${CYAN}cd ~/openace && npm start${NC}"
echo ""
echo -e "  Then open: ${CYAN}http://localhost:3333${NC}"
echo ""
