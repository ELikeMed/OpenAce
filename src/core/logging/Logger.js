/**
 * Logger — Structured Logging for OpenAce
 * 
 * Replaces raw console.log with:
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Component tags ([BrowserAgent], [ActionEngine], etc.)
 * - Timestamps in ISO format
 * - File output for production debugging
 * - Color-coded console output
 * - Log rotation (keeps last N lines)
 * 
 * Usage:
 *   import { Logger } from './logging/Logger.js';
 *   const log = new Logger('BrowserAgent');
 *   
 *   log.info('Navigating to URL', { url });
 *   log.warn('Element not found', { selector });
 *   log.error('Navigation failed', { url, error: err.message });
 *   log.debug('Page content extracted', { length: content.length });
 */

import fs from 'fs/promises';
import path from 'path';

const LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

const LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'];

const COLORS = {
  DEBUG: '\x1b[36m',   // Cyan
  INFO: '\x1b[32m',    // Green
  WARN: '\x1b[33m',    // Yellow
  ERROR: '\x1b[31m',   // Red
  RESET: '\x1b[0m',
  DIM: '\x1b[2m',
  BRIGHT: '\x1b[1m'
};

// Global configuration (shared across all Logger instances)
const config = {
  level: LEVELS.INFO,
  enableConsole: true,
  enableFile: false,
  logDir: './logs',
  maxFileSize: 5 * 1024 * 1024,  // 5MB
  maxFiles: 3,
  currentFile: null,
  buffer: [],
  flushInterval: null
};

/**
 * Configure the global logging system
 * Call once at startup before creating loggers.
 */
export function configureLogging(options = {}) {
  if (options.level !== undefined) {
    config.level = typeof options.level === 'string' ? (LEVELS[options.level.toUpperCase()] ?? LEVELS.INFO) : options.level;
  }
  if (options.enableConsole !== undefined) config.enableConsole = options.enableConsole;
  if (options.enableFile !== undefined) config.enableFile = options.enableFile;
  if (options.logDir) config.logDir = options.logDir;
  
  // Start file logging if enabled
  if (config.enableFile && !config.flushInterval) {
    config.flushInterval = setInterval(() => flushBuffer(), 5000);
    
    // Ensure log directory exists
    fs.mkdir(config.logDir, { recursive: true }).catch(() => {});
  }
}

/**
 * Flush log buffer to file
 */
async function flushBuffer() {
  if (config.buffer.length === 0) return;
  
  const lines = config.buffer.splice(0, config.buffer.length);
  const content = lines.join('\n') + '\n';
  
  try {
    const logFile = path.join(config.logDir, 'openace.log');
    await fs.appendFile(logFile, content);
    
    // Check file size for rotation
    const stats = await fs.stat(logFile);
    if (stats.size > config.maxFileSize) {
      await rotateLog(logFile);
    }
  } catch (error) {
    // Can't log if logging fails — just write to stderr
    process.stderr.write(`[Logger] Failed to write log: ${error.message}\n`);
  }
}

/**
 * Rotate log files
 */
async function rotateLog(logFile) {
  try {
    // Shift existing rotated files
    for (let i = config.maxFiles - 1; i >= 1; i--) {
      const from = `${logFile}.${i}`;
      const to = `${logFile}.${i + 1}`;
      try { await fs.rename(from, to); } catch {}
    }
    // Rotate current file
    await fs.rename(logFile, `${logFile}.1`);
  } catch {}
}

export class Logger {
  /**
   * @param {string} component - Component name (e.g., 'BrowserAgent', 'ActionEngine')
   */
  constructor(component) {
    this.component = component;
  }

  /**
   * Log at DEBUG level
   */
  debug(message, data = null) {
    this._log(LEVELS.DEBUG, message, data);
  }

  /**
   * Log at INFO level
   */
  info(message, data = null) {
    this._log(LEVELS.INFO, message, data);
  }

  /**
   * Log at WARN level
   */
  warn(message, data = null) {
    this._log(LEVELS.WARN, message, data);
  }

  /**
   * Log at ERROR level
   */
  error(message, data = null) {
    this._log(LEVELS.ERROR, message, data);
  }

  /**
   * Internal log implementation
   */
  _log(level, message, data) {
    if (level < config.level) return;
    
    const levelName = LEVEL_NAMES[level];
    const timestamp = new Date().toISOString();
    
    // Console output (with colors)
    if (config.enableConsole) {
      const color = COLORS[levelName] || '';
      const dataStr = data ? ` ${COLORS.DIM}${JSON.stringify(data)}${COLORS.RESET}` : '';
      console.log(
        `${COLORS.DIM}${timestamp}${COLORS.RESET} ${color}${levelName.padEnd(5)}${COLORS.RESET} ${COLORS.BRIGHT}[${this.component}]${COLORS.RESET} ${message}${dataStr}`
      );
    }
    
    // File output (plain text, no colors)
    if (config.enableFile) {
      const dataStr = data ? ` ${JSON.stringify(data)}` : '';
      config.buffer.push(`${timestamp} ${levelName.padEnd(5)} [${this.component}] ${message}${dataStr}`);
    }
  }

  /**
   * Create a child logger with a sub-component name
   * e.g., logger.child('login') → "[BrowserAgent:login]"
   */
  child(subComponent) {
    return new Logger(`${this.component}:${subComponent}`);
  }
}

/**
 * Flush all pending logs (call on shutdown)
 */
export async function flushLogs() {
  if (config.flushInterval) {
    clearInterval(config.flushInterval);
    config.flushInterval = null;
  }
  await flushBuffer();
}

export { LEVELS as LOG_LEVELS };
export default Logger;
