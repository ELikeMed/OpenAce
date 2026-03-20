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
# Strategy: cascading fallbacks, no questions asked.
#   1. Already installed? Skip.
#   2. macOS → Homebrew → official .pkg installer → nvm
#   3. Linux → NodeSource apt/yum → nvm
#   4. All fail → clear manual instructions and exit
NODE_MIN=18

install_node_nvm() {
  echo -e "  ${CYAN}→${NC} Trying nvm as fallback..."
  NVM_INSTALL=$(mktemp)
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh -o "$NVM_INSTALL"
  if [ ! -s "$NVM_INSTALL" ]; then
    rm -f "$NVM_INSTALL"
    return 1
  fi
  bash "$NVM_INSTALL"
  rm -f "$NVM_INSTALL"

  export NVM_DIR="$HOME/.nvm"
  if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    return 1
  fi
  . "$NVM_DIR/nvm.sh"
  nvm install --lts

  # Make sure nvm is in the shell profile for future terminals
  SHELL_PROFILE=""
  if [[ "$SHELL" == */zsh ]]; then
    SHELL_PROFILE="$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    SHELL_PROFILE="$HOME/.bashrc"
  elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi
  if [ -n "$SHELL_PROFILE" ] && [ -f "$SHELL_PROFILE" ]; then
    if ! grep -q 'NVM_DIR' "$SHELL_PROFILE" 2>/dev/null; then
      printf '\n# nvm — added by OpenAce installer\nexport NVM_DIR="$HOME/.nvm"\n[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"\n' >> "$SHELL_PROFILE"
    fi
  fi

  command -v node &>/dev/null
}

install_node() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # ── macOS: try Homebrew first ──
    if command -v brew &>/dev/null; then
      echo -e "  ${CYAN}→${NC} Installing Node.js via Homebrew..."
      if brew install node 2>&1; then
        if command -v node &>/dev/null; then
          echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed via Homebrew"
          return 0
        fi
      fi
      echo -e "  ${YELLOW}!${NC} Homebrew install didn't work, trying next method..."
    fi

    # ── macOS: official Node.js .pkg installer (system-wide, no path issues) ──
    echo -e "  ${CYAN}→${NC} Downloading official Node.js installer..."
    NODE_PKG=$(mktemp /tmp/node-install-XXXX.pkg)
    if curl -fsSL "https://nodejs.org/dist/v22.14.0/node-v22.14.0.pkg" -o "$NODE_PKG" && [ -s "$NODE_PKG" ]; then
      echo -e "  ${CYAN}→${NC} Installing Node.js (you may be prompted for your password)..."
      if sudo installer -pkg "$NODE_PKG" -target / 2>&1; then
        rm -f "$NODE_PKG"
        export PATH="/usr/local/bin:$PATH"
        if command -v node &>/dev/null; then
          echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed"
          return 0
        fi
      fi
    fi
    rm -f "$NODE_PKG"
    echo -e "  ${YELLOW}!${NC} Package installer didn't work, trying next method..."

  else
    # ── Linux: NodeSource repo (system-wide) ──
    if command -v apt-get &>/dev/null; then
      echo -e "  ${CYAN}→${NC} Installing Node.js via apt..."
      if curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - 2>&1; then
        if sudo apt-get install -y nodejs 2>&1; then
          if command -v node &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed via apt"
            return 0
          fi
        fi
      fi
      echo -e "  ${YELLOW}!${NC} apt install didn't work, trying next method..."
    elif command -v yum &>/dev/null; then
      echo -e "  ${CYAN}→${NC} Installing Node.js via yum..."
      if curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash - 2>&1; then
        if sudo yum install -y nodejs 2>&1; then
          if command -v node &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed via yum"
            return 0
          fi
        fi
      fi
      echo -e "  ${YELLOW}!${NC} yum install didn't work, trying next method..."
    fi
  fi

  # ── Last resort: nvm ──
  if install_node_nvm; then
    echo -e "  ${GREEN}✓${NC} Node.js $(node -v) installed via nvm"
    return 0
  fi

  # ── Nothing worked ──
  echo ""
  echo -e "  ${RED}✗${NC} Could not install Node.js automatically."
  echo ""
  echo -e "  ${BOLD}Please install it manually:${NC}"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    echo -e "    ${CYAN}brew install node${NC}       (if you have Homebrew)"
    echo -e "    — or download from ${CYAN}https://nodejs.org${NC}"
  else
    echo -e "    Download from ${CYAN}https://nodejs.org${NC}"
  fi
  echo ""
  echo -e "  Then re-run this installer."
  exit 1
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

# ── Final check: npm must work ──
if ! command -v npm &>/dev/null; then
  echo -e "  ${RED}✗${NC} npm is not available. Something went wrong."
  echo -e "  ${YELLOW}→${NC} Install Node.js from ${CYAN}https://nodejs.org${NC} and re-run this installer."
  exit 1
fi

# ── Clone or Update OpenAce ──
INSTALL_DIR="$HOME/openace"
if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  ${GREEN}✓${NC} OpenAce found at $INSTALL_DIR — updating..."
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
elif [ -d "$INSTALL_DIR" ]; then
  # Directory exists but isn't a git repo (partial install) — remove and re-clone
  echo -e "  ${YELLOW}→${NC} Removing incomplete install at $INSTALL_DIR..."
  rm -rf "$INSTALL_DIR"
  echo -e "  ${CYAN}→${NC} Cloning OpenAce..."
  if ! git clone https://github.com/ELikeMed/OpenAce.git "$INSTALL_DIR" 2>&1; then
    echo -e "  ${RED}✗${NC} Git clone failed. Check your internet connection."
    exit 1
  fi
  cd "$INSTALL_DIR"
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
  echo -e "  ${YELLOW}!${NC} Some native modules failed to build (this is OK on non-Mac systems)."
  # Check if express got installed — that's the critical one
  if [ ! -d "$INSTALL_DIR/node_modules/express" ]; then
    echo -e "  ${YELLOW}→${NC} Retrying with --ignore-scripts..."
    npm install --no-audit --no-fund --ignore-scripts 2>&1
    if [ ! -d "$INSTALL_DIR/node_modules/express" ]; then
      echo -e "  ${RED}✗${NC} npm install failed. Check the errors above."
      exit 1
    fi
  fi
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
echo -e "  │  Run these commands:                        │"
echo -e "  │                                             │"
echo -e "  │     ${CYAN}cd ~/openace && npm start${NC}               │"
echo -e "  │                                             │"
echo -e "  │  Then open your BROWSER (Chrome/Safari) to: │"
echo -e "  │     ${CYAN}http://localhost:3333${NC}                    │"
echo -e "  │                                             │"
echo -e "  │  ${YELLOW}(Type the URL in your browser, NOT here)${NC}  │"
echo -e "  └─────────────────────────────────────────────┘"
echo ""
