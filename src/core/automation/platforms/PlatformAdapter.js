/**
 * PlatformAdapter — Loads the correct platform module at runtime.
 *
 * Usage:
 *   import { platform } from './platforms/PlatformAdapter.js';
 *
 *   await platform.focusChrome();
 *   await platform.executeJsInChrome('document.title');
 *   await platform.clipboardWrite('hello');
 *   const bounds = await platform.getScreenBounds();
 *
 * The adapter detects `process.platform` and loads:
 *   - darwin  → platforms/darwin/index.js  (AppleScript-based)
 *   - win32   → platforms/win32/index.js   (CDP + PowerShell-based)
 *
 * All platform modules export the same interface:
 *   Constants: PLATFORM, PLATFORM_NAME, browserEngine, eventEngine, KEY_MAP
 *   Functions: clipboardWrite, clipboardRead, focusChrome, runAppleScript,
 *              executeJsInChrome, takeScreenshot, getScreenBounds, focusApp
 */

let _platform = null;
let _loading = null;

/**
 * Load the platform module for the current OS.
 * Caches the result so subsequent calls are instant.
 */
export async function loadPlatform() {
  if (_platform) return _platform;

  // Prevent concurrent loads
  if (_loading) return _loading;

  _loading = (async () => {
    const os = process.platform; // 'darwin', 'win32', 'linux'

    try {
      if (os === 'darwin') {
        _platform = await import('./darwin/index.js');
      } else if (os === 'win32') {
        _platform = await import('./win32/index.js');
      } else {
        // Linux and others: fall back to darwin for now
        // (most Linux desktop automation would be similar to macOS with xdotool)
        console.warn(`[PlatformAdapter] Unsupported platform "${os}", falling back to darwin`);
        _platform = await import('./darwin/index.js');
      }

      console.log(`[PlatformAdapter] Loaded ${_platform.PLATFORM_NAME} (${_platform.PLATFORM}) — browser: ${_platform.browserEngine}, events: ${_platform.eventEngine}`);
      return _platform;
    } catch (err) {
      console.error(`[PlatformAdapter] Failed to load platform "${os}":`, err.message);
      throw err;
    }
  })();

  return _loading;
}

/**
 * Get the platform module synchronously (must call loadPlatform() first).
 * Returns null if not yet loaded.
 */
export function getPlatform() {
  return _platform;
}

/**
 * Convenience: pre-load and return the platform.
 * This is the default export for quick access.
 */
export const platform = await loadPlatform();
