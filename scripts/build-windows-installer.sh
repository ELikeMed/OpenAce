#!/bin/bash
# ═══════════════════════════════════════════════════════════
# OpenAce Windows Installer Builder
#
# Stages the OpenAce distribution for Windows:
#   1. Downloads portable Node.js for Windows (x64)
#   2. Copies source + installs dependencies
#   3. Creates a ready-to-package staging directory
#
# The staging output can be:
#   a) Zipped as a portable distribution (.zip)
#   b) Compiled into an installer with NSIS (on Windows)
#
# Usage:  ./scripts/build-windows-installer.sh
# Output: dist/OpenAce-<version>-windows.zip (portable)
#         + dist/windows-build/staging/ (for NSIS)
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/dist/windows-build"
STAGING="$BUILD_DIR/staging"
OPENACE_DEST="$STAGING/openace"

# Versions
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "1.6.0")
NODE_VERSION="22.16.0"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         OpenAce Windows Installer Builder v$VERSION         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ── Clean previous build ──
echo "→ Cleaning previous build..."
rm -rf "$BUILD_DIR"
mkdir -p "$STAGING"

# ═══════════════════════════════════════════════════════════
# Step 1: Download portable Node.js for Windows
# ═══════════════════════════════════════════════════════════
NODE_ZIP="node-v${NODE_VERSION}-win-x64.zip"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ZIP}"
NODE_DIR="$STAGING/node"

echo "→ Downloading Node.js v${NODE_VERSION} for Windows x64..."

if [ ! -f "/tmp/$NODE_ZIP" ]; then
  curl -L --progress-bar -o "/tmp/$NODE_ZIP" "$NODE_URL"
else
  echo "  (cached in /tmp)"
fi

echo "→ Extracting Node.js..."
mkdir -p "$NODE_DIR"
cd /tmp
unzip -q -o "$NODE_ZIP" -d "$BUILD_DIR/node-extract"
# Move contents up (strip the top-level directory)
cp -r "$BUILD_DIR/node-extract/node-v${NODE_VERSION}-win-x64/"* "$NODE_DIR/"
rm -rf "$BUILD_DIR/node-extract"

# Remove unnecessary files to save space
rm -rf "$NODE_DIR/share" "$NODE_DIR/include"
rm -f "$NODE_DIR/CHANGELOG.md" "$NODE_DIR/README.md" "$NODE_DIR/LICENSE"
# Keep npm (needed for first launch if node_modules is missing)

NODE_SIZE=$(du -sh "$NODE_DIR" | cut -f1)
echo "  Node.js extracted: $NODE_SIZE"

cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════════════════
# Step 2: Copy OpenAce source code
# ═══════════════════════════════════════════════════════════
echo "→ Copying OpenAce source..."

mkdir -p "$OPENACE_DEST"

COPY_DIRS="src scripts config data"
COPY_FILES="package.json package-lock.json"

for dir in $COPY_DIRS; do
  if [ -d "$PROJECT_DIR/$dir" ]; then
    rsync -a --ignore-errors \
      --exclude="node_modules" \
      --exclude=".DS_Store" \
      --exclude="*.map" \
      --exclude="dist" \
      --exclude="social/sessions" \
      --exclude="training/sessions" \
      --exclude="training/screenshots" \
      --exclude="training/*.png" \
      --exclude="training/*.jpg" \
      --exclude="automation/screenshots" \
      --exclude="sops/*/history" \
      --exclude="sops/*/learning.json" \
      --exclude="sops/custom/desktop_sop_*" \
      --exclude="activity/*.json" \
      --exclude="research/*.json" \
      --exclude="content/plans" \
      --exclude=".update-backups" \
      --exclude="macos-app" \
      "$PROJECT_DIR/$dir/" "$OPENACE_DEST/$dir/"
  fi
done

for file in $COPY_FILES; do
  if [ -f "$PROJECT_DIR/$file" ]; then
    cp "$PROJECT_DIR/$file" "$OPENACE_DEST/$file"
  fi
done

# Copy .env if it exists
if [ -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env" "$OPENACE_DEST/.env"
fi

# ═══════════════════════════════════════════════════════════
# Step 3: Install dependencies using system Node
# ═══════════════════════════════════════════════════════════
echo "→ Installing dependencies (this may take a minute)..."

cd "$OPENACE_DEST"

# Install production dependencies (using system node — deps are platform-independent JS)
npm install --production --no-optional 2>&1 | tail -5

# Note: robotjs is skipped for Windows builds from macOS
# It requires native compilation on the target platform
echo "  (robotjs skipped — requires native build on Windows)"

# Copy C# event monitor source (compiled on first run on Windows)
if [ -f "$PROJECT_DIR/scripts/event-monitor-win.cs" ]; then
  cp "$PROJECT_DIR/scripts/event-monitor-win.cs" "$OPENACE_DEST/scripts/event-monitor-win.cs"
  echo "  Included Windows event monitor source (compiles on first use)"
fi

# Build the dashboard
echo "→ Building dashboard UI..."
cd "$OPENACE_DEST/src/desktop/dashboard-ui"
if [ -f "package.json" ]; then
  npm install 2>&1 | tail -3
  npm run build 2>&1 | tail -3
  # Clean dev dependencies from dashboard
  rm -rf node_modules
fi

cd "$OPENACE_DEST"

# Clean up dev artifacts
rm -rf .git .github .update-backups
find . -name ".DS_Store" -delete 2>/dev/null
find . -name "*.map" -delete 2>/dev/null

OPENACE_SIZE=$(du -sh "$OPENACE_DEST" | cut -f1)
echo "  OpenAce installed: $OPENACE_SIZE"

# ═══════════════════════════════════════════════════════════
# Step 4: Add launcher and installer files
# ═══════════════════════════════════════════════════════════
echo "→ Adding launcher files..."

# Copy the Windows launcher batch file
cp "$SCRIPT_DIR/windows-installer/OpenAce.bat" "$STAGING/OpenAce.bat"

# Copy NSIS installer script (for building .exe installer on Windows)
cp "$SCRIPT_DIR/windows-installer/installer.nsi" "$STAGING/installer.nsi"

# Copy LICENSE if exists
if [ -f "$PROJECT_DIR/LICENSE" ]; then
  cp "$PROJECT_DIR/LICENSE" "$STAGING/LICENSE"
fi

# Create a simple icon placeholder note
if [ -f "$SCRIPT_DIR/windows-installer/icon.ico" ]; then
  cp "$SCRIPT_DIR/windows-installer/icon.ico" "$STAGING/icon.ico"
else
  echo "  (No icon.ico — place one in scripts/windows-installer/ for the installer)"
fi

# ═══════════════════════════════════════════════════════════
# Step 5: Create portable ZIP distribution
# ═══════════════════════════════════════════════════════════
ZIP_NAME="OpenAce-${VERSION}-windows.zip"
ZIP_PATH="$PROJECT_DIR/dist/$ZIP_NAME"

echo "→ Creating portable ZIP..."

cd "$BUILD_DIR"
# Rename staging to OpenAce for a clean zip
mv staging OpenAce
zip -r -q "$ZIP_PATH" OpenAce/
mv OpenAce staging  # Restore for NSIS

ZIP_SIZE=$(du -sh "$ZIP_PATH" | cut -f1)

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Build Complete!                         ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  Portable ZIP: dist/$ZIP_NAME"
echo "║  ZIP Size:     $ZIP_SIZE                                   ║"
echo "║  Staging:      dist/windows-build/staging/                 ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  To create an EXE installer (on Windows):                  ║"
echo "║  1. Install NSIS: https://nsis.sourceforge.io              ║"
echo "║  2. cd dist/windows-build/staging                          ║"
echo "║  3. makensis installer.nsi                                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Portable usage: Unzip → double-click OpenAce.bat"
echo ""
