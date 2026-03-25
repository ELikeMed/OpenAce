#!/bin/bash
# ═══════════════════════════════════════════════════════════
# OpenAce macOS App Builder
#
# Creates OpenAce.app — a native macOS application bundle
# that users can drag to /Applications and double-click.
# No terminal, no Node.js install, no npm required.
#
# Usage:  ./scripts/build-macos-app.sh
# Output: dist/OpenAce.dmg (+ dist/OpenAce.app)
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/dist/macos-build"
APP_DIR="$BUILD_DIR/OpenAce.app"
CONTENTS="$APP_DIR/Contents"
MACOS_DIR="$CONTENTS/MacOS"
RESOURCES="$CONTENTS/Resources"
OPENACE_DEST="$RESOURCES/openace"

# Versions
VERSION=$(node -e "console.log(require('./package.json').version)" 2>/dev/null || echo "1.6.0")
NODE_VERSION="22.16.0"

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  NODE_ARCH="arm64"
  NODE_PLATFORM="darwin-arm64"
else
  NODE_ARCH="x64"
  NODE_PLATFORM="darwin-x64"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║            OpenAce macOS App Builder v$VERSION              ║"
echo "║            Architecture: $ARCH                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# ── Clean previous build ──
echo "→ Cleaning previous build..."
rm -rf "$BUILD_DIR"
mkdir -p "$MACOS_DIR" "$RESOURCES"

# ═══════════════════════════════════════════════════════════
# Step 1: Download portable Node.js
# ═══════════════════════════════════════════════════════════
NODE_TAR="node-v${NODE_VERSION}-${NODE_PLATFORM}.tar.gz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"
NODE_DIR="$RESOURCES/node"

echo "→ Downloading Node.js v${NODE_VERSION} for ${NODE_PLATFORM}..."

if [ ! -f "/tmp/$NODE_TAR" ]; then
  curl -L --progress-bar -o "/tmp/$NODE_TAR" "$NODE_URL"
else
  echo "  (cached in /tmp)"
fi

echo "→ Extracting Node.js..."
mkdir -p "$NODE_DIR"
tar -xzf "/tmp/$NODE_TAR" -C "$NODE_DIR" --strip-components=1

# Remove unnecessary files to save space
rm -rf "$NODE_DIR/share" "$NODE_DIR/include" "$NODE_DIR/lib/node_modules/npm/docs"
rm -f "$NODE_DIR/CHANGELOG.md" "$NODE_DIR/README.md" "$NODE_DIR/LICENSE"

NODE_SIZE=$(du -sh "$NODE_DIR" | cut -f1)
echo "  Node.js extracted: $NODE_SIZE"

# ═══════════════════════════════════════════════════════════
# Step 2: Copy OpenAce source code
# ═══════════════════════════════════════════════════════════
echo "→ Copying OpenAce source..."

mkdir -p "$OPENACE_DEST"

# Copy essential directories and files (rsync handles broken symlinks gracefully)
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
      "$PROJECT_DIR/$dir/" "$OPENACE_DEST/$dir/"
  fi
done

for file in $COPY_FILES; do
  if [ -f "$PROJECT_DIR/$file" ]; then
    cp "$PROJECT_DIR/$file" "$OPENACE_DEST/$file"
  fi
done

# Copy .env if it exists (has API keys)
if [ -f "$PROJECT_DIR/.env" ]; then
  cp "$PROJECT_DIR/.env" "$OPENACE_DEST/.env"
fi

# ═══════════════════════════════════════════════════════════
# Step 3: Install dependencies using bundled Node
# ═══════════════════════════════════════════════════════════
echo "→ Installing dependencies (this may take a minute)..."

cd "$OPENACE_DEST"

# Use bundled node + npm
export PATH="$NODE_DIR/bin:$PATH"

# Install production dependencies only
npm install --production --no-optional 2>&1 | tail -5

# Now try to install robotjs separately (optional, may fail without Xcode tools)
echo "→ Attempting robotjs install (optional — desktop automation)..."
npm install robotjs 2>/dev/null && echo "  robotjs: installed" || echo "  robotjs: skipped (needs Xcode CLI tools on target machine)"

# Build the dashboard
echo "→ Building dashboard UI..."
cd "$OPENACE_DEST/src/desktop/dashboard-ui"
if [ -f "package.json" ]; then
  npm install 2>&1 | tail -3
  npm run build 2>&1 | tail -3
  # Clean dev dependencies from dashboard to save space
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
# Step 4: Assemble the .app bundle
# ═══════════════════════════════════════════════════════════
echo "→ Assembling OpenAce.app..."

# Copy launcher script
cp "$SCRIPT_DIR/macos-app/OpenAce" "$MACOS_DIR/OpenAce"
chmod +x "$MACOS_DIR/OpenAce"

# Copy Info.plist (update version)
sed "s/1.6.0/$VERSION/g" "$SCRIPT_DIR/macos-app/Info.plist" > "$CONTENTS/Info.plist"

# Generate app icon (use a simple approach — create from text if no .icns exists)
if [ -f "$SCRIPT_DIR/macos-app/AppIcon.icns" ]; then
  cp "$SCRIPT_DIR/macos-app/AppIcon.icns" "$RESOURCES/AppIcon.icns"
else
  echo "  (No custom icon — using default. Place AppIcon.icns in scripts/macos-app/ to customize)"
fi

APP_SIZE=$(du -sh "$APP_DIR" | cut -f1)
echo "  App bundle: $APP_SIZE"

# ═══════════════════════════════════════════════════════════
# Step 5: Create DMG
# ═══════════════════════════════════════════════════════════
DMG_NAME="OpenAce-${VERSION}-${ARCH}.dmg"
DMG_PATH="$PROJECT_DIR/dist/$DMG_NAME"
DMG_STAGING="$BUILD_DIR/dmg-staging"

echo "→ Creating DMG..."

mkdir -p "$DMG_STAGING"
cp -r "$APP_DIR" "$DMG_STAGING/"

# Create a symlink to /Applications for drag-and-drop
ln -s /Applications "$DMG_STAGING/Applications"

# Create the DMG
hdiutil create \
  -volname "OpenAce" \
  -srcfolder "$DMG_STAGING" \
  -ov \
  -format UDZO \
  "$DMG_PATH" 2>&1 | tail -3

DMG_SIZE=$(du -sh "$DMG_PATH" | cut -f1)

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Build Complete!                         ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║  App:  dist/macos-build/OpenAce.app                       ║"
echo "║  DMG:  dist/$DMG_NAME"
echo "║  Size: $DMG_SIZE                                          ║"
echo "║  Arch: $ARCH                                              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "To test: open dist/macos-build/OpenAce.app"
echo "To distribute: upload dist/$DMG_NAME to GitHub Releases"
echo ""
