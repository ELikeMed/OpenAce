#!/bin/bash
# ============================================================
# OpenAce Installer — macOS / Linux
# curl -fsSL https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.sh | bash
# ============================================================

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
    echo -e "  ${YELLOW}→${NC} Installing Xcode Command Line Tools (this may open a dialog)..."
    xcode-select --install 2>/dev/null || true
    echo ""
    echo -e "  ${YELLOW}A dialog should have appeared to install Command Line Tools.${NC}"
    echo -e "  ${YELLOW}After it finishes, re-run this installer:${NC}"
    echo ""
    echo -e "    ${CYAN}curl -fsSL https://raw.githubusercontent.com/ELikeMed/OpenAce/main/install.sh | bash${NC}"
    echo ""
    exit 0
  else
    echo -e "  ${YELLOW}→${NC} Install Git first:"
    echo -e "    Ubuntu/Debian: sudo apt install git"
    echo -e "    CentOS/RHEL:   sudo yum install git"
    echo -e "  Then re-run this installer."
    exit 1
  fi
fi

# ── Check / Install Node.js ──
NODE_MIN=18
install_node() {
  echo -e "  ${CYAN}→${NC} Installing Node.js via nvm..."
  # Download NVM installer to temp file (avoids stdin conflict when piped via curl|bash)
  NVM_INSTALL=$(mktemp)
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh -o "$NVM_INSTALL" 2>/dev/null
  if [ ! -s "$NVM_INSTALL" ]; then
    rm -f "$NVM_INSTALL"
    echo -e "  ${RED}✗${NC} Failed to download nvm installer."
    echo -e "  ${YELLOW}→${NC} Install Node.js manually from: https://nodejs.org"
    echo -e "  Then re-run this installer."
    exit 1
  fi
  bash "$NVM_INSTALL" 2>/dev/null
  rm -f "$NVM_INSTALL"

  # Load nvm into current shell
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

  # Install LTS
  nvm install --lts 2>/dev/null

  # Verify
  if ! command -v node &>/dev/null; then
    echo -e "  ${RED}✗${NC} Node.js installation failed."
    echo -e "  ${YELLOW}→${NC} Install manually from: https://nodejs.org"
    echo -e "  Then re-run this installer."
    exit 1
  fi
  echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed"
}

if command -v node &>/dev/null; then
  NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_VER" -ge "$NODE_MIN" ]; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
  else
    echo -e "  ${YELLOW}!${NC} Node.js $(node -v) is too old (need v${NODE_MIN}+). Upgrading..."
    install_node
  fi
else
  echo -e "  ${YELLOW}!${NC} Node.js not found. Installing..."
  install_node
fi

# ── Clone or Update OpenAce ──
INSTALL_DIR="$HOME/openace"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  ${GREEN}✓${NC} OpenAce found at $INSTALL_DIR"
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
else
  echo -e "  ${CYAN}→${NC} Cloning OpenAce..."
  if ! git clone https://github.com/ELikeMed/OpenAce.git "$INSTALL_DIR" 2>&1; then
    echo -e "  ${RED}✗${NC} Git clone failed. Check your internet connection."
    exit 1
  fi
  cd "$INSTALL_DIR"
fi

# ── Install Dependencies ──
echo -e "  ${CYAN}→${NC} Installing dependencies (this may take a few minutes)..."
if ! npm install --no-audit --no-fund 2>&1; then
  echo -e "  ${RED}✗${NC} npm install failed. Check the errors above."
  exit 1
fi
echo -e "  ${GREEN}✓${NC} Dependencies installed"

# ── Build Dashboard ──
echo -e "  ${CYAN}→${NC} Building dashboard..."
cd src/desktop/dashboard-ui
npm install --no-audit --no-fund 2>&1 || true
if ! npm run build 2>&1; then
  echo -e "  ${RED}✗${NC} Dashboard build failed."
  cd "$INSTALL_DIR"
  exit 1
fi
cd "$INSTALL_DIR"
echo -e "  ${GREEN}✓${NC} Dashboard built"

# ── Build Studio ──
echo -e "  ${CYAN}→${NC} Building Ace Studio..."
cd src/studio
npm install --no-audit --no-fund 2>&1 || true
if ! npm run build 2>&1; then
  echo -e "  ${YELLOW}!${NC} Studio build failed (non-critical)"
fi
cd "$INSTALL_DIR"
echo -e "  ${GREEN}✓${NC} Studio built"

# ── Done ──
echo ""
echo -e "  ${GREEN}${BOLD}♠  OpenAce installed successfully!${NC}"
echo ""
echo -e "  ┌─────────────────────────────────────────────┐"
echo -e "  │  ${BOLD}TO START OPENACE:${NC}                          │"
echo -e "  │                                             │"
echo -e "  │  1. Open a NEW terminal window              │"
echo -e "  │  2. Run these commands:                     │"
echo -e "  │                                             │"
echo -e "  │     ${CYAN}cd ~/openace && npm start${NC}               │"
echo -e "  │                                             │"
echo -e "  │  3. Open your BROWSER (Chrome/Safari) to:   │"
echo -e "  │     ${CYAN}http://localhost:3333${NC}                    │"
echo -e "  │                                             │"
echo -e "  │  ${YELLOW}(Type the URL in your browser, NOT here)${NC}  │"
echo -e "  └─────────────────────────────────────────────┘"
echo ""
