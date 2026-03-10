/**
 * Windows Platform Implementation — Skeleton for future development.
 *
 * This file exports the same interface as platforms/darwin/index.js
 * so the PlatformAdapter can swap seamlessly between macOS and Windows.
 *
 * Windows approach:
 *   - Browser control: Chrome DevTools Protocol (CDP) via 9222 port
 *   - Screenshots: robotjs (or Nircmd as fallback)
 *   - Clipboard: PowerShell Get-Clipboard / Set-Clipboard
 *   - App focus: PowerShell + COM (Shell.Application)
 *   - Event capture: SetWindowsHookEx via native addon (future)
 */

export const PLATFORM = 'win32';
export const PLATFORM_NAME = 'Windows';

/**
 * Windows uses Chrome DevTools Protocol for browser control.
 */
export const browserEngine = 'cdp';

/**
 * Windows will use a native addon for event capture (future).
 * For now, falls back to robotjs polling.
 */
export const eventEngine = 'native-addon';

/**
 * Modifier key mapping for Windows.
 * Windows uses 'control' as the primary modifier.
 */
export const KEY_MAP = {
  primaryMod: 'control',      // Ctrl on Windows
  secondaryMod: 'alt',        // Alt on Windows
  newTab: ['control', 't'],
  closeTab: ['control', 'w'],
  addressBar: ['control', 'l'],
  back: ['alt', 'Left'],
  forward: ['alt', 'Right'],
  copy: ['control', 'c'],
  paste: ['control', 'v'],
  selectAll: ['control', 'a'],
  undo: ['control', 'z'],
  find: ['control', 'f'],
  refresh: ['control', 'r'],
};

/**
 * Clipboard: Windows uses PowerShell.
 */
export async function clipboardWrite(text) {
  const { execSync } = await import('child_process');
  // Pipe text to Set-Clipboard via PowerShell
  const escaped = text.replace(/"/g, '`"');
  execSync(`powershell -command "Set-Clipboard -Value \\"${escaped}\\""`, { timeout: 5000 });
}

export async function clipboardRead() {
  const { execSync } = await import('child_process');
  return execSync('powershell -command "Get-Clipboard"', { encoding: 'utf8', timeout: 5000 }).trim();
}

/**
 * Focus Chrome: Windows uses PowerShell COM automation.
 */
export async function focusChrome() {
  const { execSync } = await import('child_process');
  try {
    // Try to activate existing Chrome window
    execSync(
      'powershell -command "(New-Object -ComObject WScript.Shell).AppActivate(\'Google Chrome\')"',
      { timeout: 5000 }
    );
  } catch {
    // If Chrome isn't running, launch it
    execSync('start chrome', { timeout: 5000 });
  }
  await new Promise(r => setTimeout(r, 500));
}

/**
 * Run AppleScript: NOT available on Windows.
 * Throws a clear error so callers know to use a different approach.
 */
export async function runAppleScript(_script) {
  throw new Error('AppleScript is not available on Windows. Use CDP or PowerShell instead.');
}

/**
 * Execute JavaScript in Chrome via CDP (Chrome DevTools Protocol).
 *
 * Requires Chrome to be launched with --remote-debugging-port=9222
 * e.g.: chrome.exe --remote-debugging-port=9222
 */
export async function executeJsInChrome(jsCode) {
  const http = await import('http');

  // 1. Get the list of debuggable tabs
  const tabs = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Failed to parse CDP tab list')); }
      });
    }).on('error', () => {
      reject(new Error(
        'Cannot connect to Chrome CDP on port 9222. ' +
        'Launch Chrome with: chrome.exe --remote-debugging-port=9222'
      ));
    });
  });

  // 2. Find the first page tab with a WebSocket URL
  const page = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('No debuggable Chrome tab found via CDP.');

  // 3. Connect via WebSocket and evaluate JS
  const { WebSocket } = await import('ws');

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const id = Date.now();

    ws.on('open', () => {
      ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression: jsCode,
          returnByValue: true,
          awaitPromise: true,
        },
      }));
    });

    ws.on('message', (msg) => {
      try {
        const response = JSON.parse(msg);
        if (response.id === id) {
          ws.close();
          if (response.result?.result?.value !== undefined) {
            resolve(String(response.result.result.value));
          } else if (response.result?.exceptionDetails) {
            reject(new Error(response.result.exceptionDetails.text || 'JS execution error'));
          } else {
            resolve('');
          }
        }
      } catch (e) {
        ws.close();
        reject(e);
      }
    });

    ws.on('error', (err) => {
      reject(new Error(`CDP WebSocket error: ${err.message}`));
    });

    // Timeout after 10 seconds
    setTimeout(() => { ws.close(); reject(new Error('CDP execution timed out')); }, 10000);
  });
}

/**
 * Take screenshot: Windows uses robotjs or PowerShell.
 */
export async function takeScreenshot(outputPath) {
  const { execSync } = await import('child_process');
  // Use PowerShell to capture screen to file
  const ps = `
    Add-Type -AssemblyName System.Windows.Forms
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
    $bitmap.Save('${outputPath.replace(/'/g, "''")}')
    $graphics.Dispose()
    $bitmap.Dispose()
  `.trim();

  execSync(`powershell -command "${ps.replace(/"/g, '\\"')}"`, { timeout: 10000 });
}

/**
 * Get screen bounds: Windows uses PowerShell + .NET.
 */
export async function getScreenBounds() {
  const { execSync } = await import('child_process');
  const result = execSync(
    'powershell -command "[System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ConvertTo-Json"',
    { encoding: 'utf8', timeout: 5000 }
  );
  const bounds = JSON.parse(result);
  return { x: bounds.X, y: bounds.Y, width: bounds.Width, height: bounds.Height };
}

/**
 * Focus an app by name: Windows uses PowerShell COM.
 */
export async function focusApp(appName) {
  const { execSync } = await import('child_process');
  try {
    execSync(
      `powershell -command "(New-Object -ComObject WScript.Shell).AppActivate('${appName.replace(/'/g, "''")}')"`,
      { timeout: 5000 }
    );
  } catch {
    // If app isn't running, try to start it
    execSync(`start "${appName}"`, { timeout: 5000 });
  }
  await new Promise(r => setTimeout(r, 500));
}
