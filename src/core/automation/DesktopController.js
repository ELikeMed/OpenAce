/**
 * DesktopController — Full Mac Desktop Control
 * 
 * High-level Mac control class that extends beyond Chrome:
 * - App management (open, switch, close, list)
 * - File operations (open file, open folder)
 * - Window management (close, minimize)
 * - System actions (spotlight, copy, paste, undo, save, etc.)
 * - Natural language command parser
 * 
 * Uses child_process.exec with osascript for AppleScript,
 * and robotjs for keyboard/mouse control.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';

const execAsync = promisify(exec);

let robot = null;
try {
  const require = createRequire(import.meta.url);
  robot = require('robotjs');
} catch (e) {
  console.warn('[DesktopController] robotjs not available — keyboard/mouse control disabled');
}

export class DesktopController {
  constructor(options = {}) {
    this.onProgress = options.onProgress || ((msg) => console.log(`[DesktopController] ${msg}`));
    this.blockedApps = options.blockedApps || ['System Preferences', 'Disk Utility', 'Terminal'];
    this.requireConfirmation = options.requireConfirmation ?? true;
    this.initialized = false;
  }

  /**
   * Initialize the controller — verify system capabilities
   */
  async initialize() {
    this.onProgress('🖥️ Initializing DesktopController...');
    
    // Verify osascript is available (macOS)
    try {
      await execAsync('which osascript');
      this.onProgress('✅ AppleScript available');
    } catch {
      this.onProgress('⚠️ AppleScript not available — some features disabled');
    }

    if (robot) {
      this.onProgress('✅ robotjs available — keyboard/mouse control enabled');
    } else {
      this.onProgress('⚠️ robotjs not loaded — keyboard/mouse control disabled');
    }

    this.initialized = true;
    return this;
  }

  // ═══════════════════════════════════════════════════════
  // APP MANAGEMENT
  // ═══════════════════════════════════════════════════════

  /**
   * Open an application by name using `open -a`
   * @param {string} name - Application name (e.g., "Finder", "Safari", "VS Code")
   */
  async openApp(name) {
    if (this._isBlocked(name)) {
      this.onProgress(`🚫 Blocked: "${name}" is in the blocked apps list`);
      return { success: false, error: `App "${name}" is blocked by policy` };
    }

    this.onProgress(`🚀 Opening app: ${name}`);
    try {
      await execAsync(`open -a "${name}"`);
      this.onProgress(`✅ Opened: ${name}`);
      return { success: true, app: name, action: 'opened' };
    } catch (err) {
      this.onProgress(`❌ Failed to open ${name}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Bring an app to the foreground via AppleScript
   * @param {string} name - Application name
   */
  async switchToApp(name) {
    if (this._isBlocked(name)) {
      return { success: false, error: `App "${name}" is blocked by policy` };
    }

    this.onProgress(`🔄 Switching to: ${name}`);
    try {
      await this._runAppleScript(`
        tell application "${name}"
          activate
        end tell
      `);
      this.onProgress(`✅ Switched to: ${name}`);
      return { success: true, app: name, action: 'activated' };
    } catch (err) {
      this.onProgress(`❌ Failed to switch to ${name}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Quit an application via AppleScript
   * @param {string} name - Application name
   */
  async closeApp(name) {
    if (this._isBlocked(name)) {
      return { success: false, error: `App "${name}" is blocked by policy` };
    }

    this.onProgress(`🛑 Closing app: ${name}`);
    try {
      await this._runAppleScript(`
        tell application "${name}"
          quit
        end tell
      `);
      this.onProgress(`✅ Closed: ${name}`);
      return { success: true, app: name, action: 'closed' };
    } catch (err) {
      this.onProgress(`❌ Failed to close ${name}: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Get list of running applications via AppleScript
   * @returns {string[]} Array of running app names
   */
  async listOpenApps() {
    this.onProgress('📋 Listing open applications...');
    try {
      const result = await this._runAppleScript(`
        tell application "System Events"
          set appList to name of every application process whose visible is true
          set AppleScript's text item delimiters to ","
          return appList as text
        end tell
      `);
      const apps = result.trim().split(',').map(a => a.trim()).filter(Boolean);
      this.onProgress(`✅ Found ${apps.length} running apps`);
      return { success: true, apps };
    } catch (err) {
      this.onProgress(`❌ Failed to list apps: ${err.message}`);
      return { success: false, error: err.message, apps: [] };
    }
  }

  // ═══════════════════════════════════════════════════════
  // FILE OPERATIONS
  // ═══════════════════════════════════════════════════════

  /**
   * Open a file with its default application
   * @param {string} filePath - Path to the file
   */
  async openFile(filePath) {
    this.onProgress(`📄 Opening file: ${filePath}`);
    try {
      await execAsync(`open "${filePath}"`);
      this.onProgress(`✅ Opened file: ${filePath}`);
      return { success: true, path: filePath, action: 'opened' };
    } catch (err) {
      this.onProgress(`❌ Failed to open file: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Open a folder in Finder
   * @param {string} folderPath - Path to the folder
   */
  async openFolder(folderPath) {
    this.onProgress(`📂 Opening folder: ${folderPath}`);
    try {
      await execAsync(`open "${folderPath}"`);
      this.onProgress(`✅ Opened folder: ${folderPath}`);
      return { success: true, path: folderPath, action: 'opened' };
    } catch (err) {
      this.onProgress(`❌ Failed to open folder: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // WINDOW MANAGEMENT
  // ═══════════════════════════════════════════════════════

  /**
   * Close the current window (Cmd+W)
   */
  async closeWindow() {
    this.onProgress('🪟 Closing current window (Cmd+W)');
    return this._pressKey('w', ['command']);
  }

  /**
   * Minimize the current window (Cmd+M)
   */
  async minimizeWindow() {
    this.onProgress('🪟 Minimizing current window (Cmd+M)');
    return this._pressKey('m', ['command']);
  }

  // ═══════════════════════════════════════════════════════
  // SYSTEM ACTIONS
  // ═══════════════════════════════════════════════════════

  /**
   * Open Spotlight and type a query (Cmd+Space then type)
   * @param {string} query - Search query
   */
  async spotlight(query) {
    this.onProgress(`🔍 Spotlight: "${query}"`);
    try {
      await this._pressKey('space', ['command']);
      await this._delay(500); // Wait for Spotlight to open
      if (robot) {
        robot.typeString(query);
        await this._delay(300);
      }
      this.onProgress(`✅ Spotlight search: "${query}"`);
      return { success: true, query, action: 'spotlight' };
    } catch (err) {
      this.onProgress(`❌ Spotlight failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Copy current selection to clipboard (Cmd+C)
   */
  async copyText() {
    this.onProgress('📋 Copying (Cmd+C)');
    return this._pressKey('c', ['command']);
  }

  /**
   * Put text on clipboard then paste it (Cmd+V)
   * @param {string} text - Text to paste
   */
  async pasteText(text) {
    this.onProgress(`📋 Pasting text (${text.length} chars)`);
    try {
      // Use pbcopy to put text on clipboard
      await execAsync(`echo "${text.replace(/"/g, '\\"')}" | pbcopy`);
      await this._delay(100);
      await this._pressKey('v', ['command']);
      this.onProgress('✅ Text pasted');
      return { success: true, action: 'paste', length: text.length };
    } catch (err) {
      this.onProgress(`❌ Paste failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Select all (Cmd+A)
   */
  async selectAll() {
    this.onProgress('🔤 Select All (Cmd+A)');
    return this._pressKey('a', ['command']);
  }

  /**
   * Undo last action (Cmd+Z)
   */
  async undo() {
    this.onProgress('↩️ Undo (Cmd+Z)');
    return this._pressKey('z', ['command']);
  }

  /**
   * Save current document (Cmd+S)
   */
  async save() {
    this.onProgress('💾 Save (Cmd+S)');
    return this._pressKey('s', ['command']);
  }

  /**
   * Type text character-by-character with human-like delay
   * @param {string} text - Text to type
   * @param {number} delay - Delay in ms between characters (default: 50)
   */
  async typeSlowly(text, delay = 50) {
    this.onProgress(`⌨️ Typing slowly: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
    
    if (!robot) {
      return { success: false, error: 'robotjs not available for typing' };
    }

    try {
      for (const char of text) {
        robot.typeString(char);
        await this._delay(delay + Math.random() * (delay * 0.5));
      }
      this.onProgress(`✅ Typed ${text.length} characters`);
      return { success: true, action: 'typeSlowly', length: text.length };
    } catch (err) {
      this.onProgress(`❌ Typing failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // NATURAL LANGUAGE COMMAND PARSER
  // ═══════════════════════════════════════════════════════

  /**
   * Parse and execute a natural language command
   * @param {string} command - Natural language like "open Finder", "switch to Slack", "copy that"
   */
  async executeCommand(command) {
    const lower = command.toLowerCase().trim();
    this.onProgress(`🗣️ Parsing command: "${command}"`);

    // Open app: "open Finder", "launch Safari", "start VS Code"
    const openMatch = lower.match(/^(?:open|launch|start|run)\s+(.+)$/);
    if (openMatch) {
      const appName = this._normalizeAppName(openMatch[1]);
      return this.openApp(appName);
    }

    // Switch to app: "switch to Slack", "go to Chrome", "focus on Notes"
    const switchMatch = lower.match(/^(?:switch to|go to|focus on|activate|bring up)\s+(.+)$/);
    if (switchMatch) {
      const appName = this._normalizeAppName(switchMatch[1]);
      return this.switchToApp(appName);
    }

    // Close/quit app: "close Safari", "quit Slack"
    const closeAppMatch = lower.match(/^(?:close|quit|exit|kill)\s+(.+)$/);
    if (closeAppMatch) {
      const target = closeAppMatch[1];
      if (/window|tab/.test(target)) {
        return this.closeWindow();
      }
      const appName = this._normalizeAppName(target);
      return this.closeApp(appName);
    }

    // Spotlight: "search for X", "spotlight X", "find X"
    const spotlightMatch = lower.match(/^(?:search for|spotlight|find|look up)\s+(.+)$/);
    if (spotlightMatch) {
      return this.spotlight(spotlightMatch[1]);
    }

    // Copy: "copy", "copy that", "copy text"
    if (/^copy\b/.test(lower)) {
      return this.copyText();
    }

    // Paste: "paste", "paste text"
    if (/^paste\b/.test(lower)) {
      return this.pasteText('');
    }

    // Select all: "select all", "select everything"
    if (/^select\s+(?:all|everything)/.test(lower)) {
      return this.selectAll();
    }

    // Undo: "undo", "undo that"
    if (/^undo\b/.test(lower)) {
      return this.undo();
    }

    // Save: "save", "save file", "save document"
    if (/^save\b/.test(lower)) {
      return this.save();
    }

    // Minimize: "minimize", "minimize window"
    if (/^minimize\b/.test(lower)) {
      return this.minimizeWindow();
    }

    // Close window: "close window", "close tab"
    if (/^close\s+(?:window|tab)/.test(lower)) {
      return this.closeWindow();
    }

    // List apps: "list apps", "what's running", "show running apps"
    if (/(?:list|show|what).*(app|running|open)/.test(lower)) {
      return this.listOpenApps();
    }

    // Open file: "open file /path/to/file"
    const fileMatch = lower.match(/^open\s+file\s+(.+)$/);
    if (fileMatch) {
      return this.openFile(fileMatch[1]);
    }

    // Open folder: "open folder /path/to/folder"
    const folderMatch = lower.match(/^open\s+folder\s+(.+)$/);
    if (folderMatch) {
      return this.openFolder(folderMatch[1]);
    }

    // Type: "type Hello World"
    const typeMatch = lower.match(/^type\s+(.+)$/);
    if (typeMatch) {
      return this.typeSlowly(command.substring(5)); // Use original case
    }

    this.onProgress(`❓ Could not parse command: "${command}"`);
    return { 
      success: false, 
      error: `Unknown command: "${command}"`,
      hint: 'Try: open [app], switch to [app], close [app], spotlight [query], copy, paste, save, undo, select all'
    };
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Run an AppleScript command via osascript
   */
  async _runAppleScript(script) {
    const cleaned = script.replace(/'/g, "'\\''");
    const { stdout } = await execAsync(`osascript -e '${cleaned}'`);
    return stdout;
  }

  /**
   * Press a key with optional modifiers using robotjs
   */
  async _pressKey(key, modifiers = []) {
    if (!robot) {
      // Fallback to AppleScript for basic keyboard shortcuts
      return this._pressKeyAppleScript(key, modifiers);
    }

    try {
      robot.keyTap(key, modifiers);
      return { success: true, key, modifiers };
    } catch (err) {
      this.onProgress(`❌ Key press failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Fallback: press key via AppleScript when robotjs unavailable
   */
  async _pressKeyAppleScript(key, modifiers = []) {
    try {
      const modMap = {
        'command': 'command down',
        'shift': 'shift down',
        'alt': 'option down',
        'option': 'option down',
        'control': 'control down'
      };
      const modStr = modifiers.map(m => modMap[m] || `${m} down`).join(', ');
      const script = modStr
        ? `tell application "System Events" to keystroke "${key}" using {${modStr}}`
        : `tell application "System Events" to keystroke "${key}"`;
      
      await this._runAppleScript(script);
      return { success: true, key, modifiers };
    } catch (err) {
      this.onProgress(`❌ AppleScript key press failed: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Check if an app is in the blocked list
   */
  _isBlocked(appName) {
    return this.blockedApps.some(
      blocked => blocked.toLowerCase() === appName.toLowerCase()
    );
  }

  /**
   * Normalize common app name aliases
   */
  _normalizeAppName(name) {
    const aliases = {
      'chrome': 'Google Chrome',
      'vscode': 'Visual Studio Code',
      'vs code': 'Visual Studio Code',
      'code': 'Visual Studio Code',
      'finder': 'Finder',
      'safari': 'Safari',
      'slack': 'Slack',
      'discord': 'Discord',
      'spotify': 'Spotify',
      'notes': 'Notes',
      'calendar': 'Calendar',
      'mail': 'Mail',
      'messages': 'Messages',
      'terminal': 'Terminal',
      'iterm': 'iTerm',
      'preview': 'Preview',
      'music': 'Music',
      'photos': 'Photos',
      'pages': 'Pages',
      'numbers': 'Numbers',
      'keynote': 'Keynote',
      'zoom': 'zoom.us',
      'teams': 'Microsoft Teams',
      'word': 'Microsoft Word',
      'excel': 'Microsoft Excel',
      'powerpoint': 'Microsoft PowerPoint',
      'notion': 'Notion',
      'figma': 'Figma',
      'postman': 'Postman',
      'contacts': 'Contacts',
      'reminders': 'Reminders',
      'launchpad': 'Launchpad',
      'settings': 'System Settings',
      'system settings': 'System Settings',
      'system preferences': 'System Settings',
      'app store': 'App Store',
      'activity monitor': 'Activity Monitor',
      'textedit': 'TextEdit',
      'text edit': 'TextEdit',
    };

    const lower = name.toLowerCase().trim();
    return aliases[lower] || name.trim();
  }

  /**
   * Async delay helper
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default DesktopController;
