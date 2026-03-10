/**
 * macOS Platform Implementation — Re-exports existing code.
 *
 * This file exists so that the platform loader can do:
 *   const platform = await import(`./platforms/${process.platform}/index.js`);
 *
 * All actual implementations live in the parent automation/ files.
 * macOS is the reference implementation — this just points to it.
 */

export const PLATFORM = 'darwin';
export const PLATFORM_NAME = 'macOS';

/**
 * macOS uses AppleScript for Chrome control.
 * No changes needed — this is the original implementation.
 */
export const browserEngine = 'applescript';

/**
 * macOS uses a compiled Swift binary (CGEventTap) for event capture.
 */
export const eventEngine = 'swift';

/**
 * Modifier key mapping for macOS.
 * macOS uses 'command' as the primary modifier.
 */
export const KEY_MAP = {
  primaryMod: 'command',    // Cmd on macOS
  secondaryMod: 'option',  // Option/Alt on macOS
  newTab: ['command', 't'],
  closeTab: ['command', 'w'],
  addressBar: ['command', 'l'],
  back: ['command', '['],
  forward: ['command', ']'],
  copy: ['command', 'c'],
  paste: ['command', 'v'],
  selectAll: ['command', 'a'],
  undo: ['command', 'z'],
  find: ['command', 'f'],
  refresh: ['command', 'r'],
};

/**
 * Clipboard: macOS uses pbcopy/pbpaste.
 */
export async function clipboardWrite(text) {
  const { execSync } = await import('child_process');
  execSync(`printf '%s' ${JSON.stringify(text)} | pbcopy`);
}

export async function clipboardRead() {
  const { execSync } = await import('child_process');
  return execSync('pbpaste', { encoding: 'utf8' });
}

/**
 * Focus Chrome: macOS uses AppleScript.
 */
export async function focusChrome() {
  const { execSync } = await import('child_process');
  execSync('osascript -e \'tell application "Google Chrome" to activate\'', { timeout: 3000 });
  await new Promise(r => setTimeout(r, 300));
}

/**
 * Run AppleScript: macOS-only helper.
 */
export async function runAppleScript(script) {
  const { exec } = await import('child_process');
  return new Promise((resolve, reject) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

/**
 * Execute JavaScript in Chrome via AppleScript.
 */
export async function executeJsInChrome(jsCode) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');
  const { exec } = await import('child_process');

  const tmpFile = path.join(os.tmpdir(), `ace_js_${Date.now()}.js`);
  await fs.writeFile(tmpFile, jsCode, 'utf8');

  const script = `
    set jsFile to POSIX file "${tmpFile}"
    set jsCode to read jsFile as «class utf8»
    tell application "Google Chrome"
      execute front window's active tab javascript jsCode
    end tell
  `;

  return new Promise((resolve, reject) => {
    exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, async (err, stdout) => {
      try { await fs.unlink(tmpFile); } catch {}
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

/**
 * Take screenshot: macOS uses screencapture or robotjs.
 */
export async function takeScreenshot(outputPath) {
  const { execSync } = await import('child_process');
  execSync(`screencapture -x "${outputPath}"`, { timeout: 5000 });
}

/**
 * Get screen bounds: macOS uses Finder AppleScript.
 */
export async function getScreenBounds() {
  const result = await runAppleScript('tell application "Finder" to get bounds of window of desktop');
  const parts = result.split(',').map(s => parseInt(s.trim()));
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/**
 * Focus an app by name: macOS uses AppleScript.
 */
export async function focusApp(appName) {
  await runAppleScript(`tell application "${appName}" to activate`);
  await new Promise(r => setTimeout(r, 300));
}
