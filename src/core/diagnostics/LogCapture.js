/**
 * LogCapture — Intercepts console output and stores in a ring buffer
 *
 * Hooks into console.log/warn/error, stores last N entries,
 * and emits events through EventBus for SSE streaming to dashboard.
 */

import { eventBus } from '../events/EventBus.js';

const MAX_ENTRIES = 1000;
const LOG_EVENT = 'console:log';

class LogCapture {
  constructor() {
    this.buffer = [];
    this.idCounter = 0;
    this.capturing = false;
    this._emitting = false; // Guard against recursion

    // Store originals
    this._originalLog = console.log;
    this._originalWarn = console.warn;
    this._originalError = console.error;
    this._originalInfo = console.info;
    this._originalDebug = console.debug;
  }

  /**
   * Start capturing console output
   */
  start() {
    if (this.capturing) return;
    this.capturing = true;

    console.log = (...args) => {
      this._capture('info', args);
      this._originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this._capture('warn', args);
      this._originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this._capture('error', args);
      this._originalError.apply(console, args);
    };

    console.info = (...args) => {
      this._capture('info', args);
      this._originalInfo.apply(console, args);
    };

    console.debug = (...args) => {
      this._capture('debug', args);
      this._originalDebug.apply(console, args);
    };

    // Capture uncaught errors
    process.on('uncaughtException', (err) => {
      this._capture('error', [`[UNCAUGHT] ${err.stack || err.message || err}`]);
    });

    process.on('unhandledRejection', (reason) => {
      const msg = reason?.stack || reason?.message || String(reason);
      this._capture('error', [`[UNHANDLED REJECTION] ${msg}`]);
    });

    this._originalLog('[LogCapture] Started — capturing console output');
  }

  /**
   * Stop capturing (restore original console methods)
   */
  stop() {
    if (!this.capturing) return;
    this.capturing = false;

    console.log = this._originalLog;
    console.warn = this._originalWarn;
    console.error = this._originalError;
    console.info = this._originalInfo;
    console.debug = this._originalDebug;
  }

  /**
   * Capture a log entry
   */
  _capture(level, args) {
    const message = args.map(a => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a, null, 0); }
      catch { return String(a); }
    }).join(' ');

    // Truncate very long messages
    const truncated = message.length > 2000 ? message.substring(0, 2000) + '...[truncated]' : message;

    const entry = {
      id: ++this.idCounter,
      level,
      message: truncated,
      timestamp: new Date().toISOString()
    };

    // Add to ring buffer
    this.buffer.push(entry);
    if (this.buffer.length > MAX_ENTRIES) {
      this.buffer.shift();
    }

    // Emit to EventBus (with recursion guard)
    if (!this._emitting) {
      this._emitting = true;
      try {
        eventBus.emit(LOG_EVENT, entry);
      } catch {
        // Silently fail — don't let EventBus errors break logging
      }
      this._emitting = false;
    }
  }

  /**
   * Get recent log entries
   * @param {number} count - Number of entries to return (default 200)
   * @param {string} level - Optional filter: 'info', 'warn', 'error', 'debug'
   * @param {string} search - Optional text search
   */
  getRecent(count = 200, level = null, search = null) {
    let entries = this.buffer;

    if (level) {
      entries = entries.filter(e => e.level === level);
    }

    if (search) {
      const lower = search.toLowerCase();
      entries = entries.filter(e => e.message.toLowerCase().includes(lower));
    }

    return entries.slice(-count);
  }

  /**
   * Clear the buffer
   */
  clear() {
    this.buffer = [];
    this.idCounter = 0;
  }

  /**
   * Get stats
   */
  getStats() {
    const counts = { info: 0, warn: 0, error: 0, debug: 0 };
    for (const entry of this.buffer) {
      counts[entry.level] = (counts[entry.level] || 0) + 1;
    }
    return {
      total: this.buffer.length,
      maxSize: MAX_ENTRIES,
      counts,
      capturing: this.capturing
    };
  }
}

// Singleton
export const logCapture = new LogCapture();
export default logCapture;
