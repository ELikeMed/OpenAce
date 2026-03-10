/**
 * CrashReporter — Captures unhandled errors, saves crash reports, optionally notifies via Telegram.
 *
 * Crash reports stored in: data/diagnostics/crashes/crash_{timestamp}.json
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const MAX_CRASHES = 100;

export class CrashReporter {
  constructor({ dataDir = 'data/diagnostics/crashes', baseDir } = {}) {
    this.dataDir = dataDir;
    this.baseDir = baseDir || process.cwd();
    this.telegramBot = null;
    this.appVersion = '1.0.0';
  }

  async initialize(telegramBot) {
    this.telegramBot = telegramBot || null;
    await fs.mkdir(this.dataDir, { recursive: true });

    // Read version
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(this.baseDir, 'package.json'), 'utf8'));
      this.appVersion = pkg.version || '1.0.0';
    } catch { /* keep default */ }

    console.log(`[CrashReporter] Initialized — reports dir: ${this.dataDir}`);
    return this;
  }

  async reportCrash(error, context = {}) {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(4).toString('hex');
    const id = `crash_${timestamp}_${hash}`;

    const report = {
      id,
      error: error?.message || String(error),
      stack: error?.stack || null,
      appVersion: this.appVersion,
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      fatal: context.fatal || false,
      context: context.info || null,
    };

    // Save to file
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const filePath = path.join(this.dataDir, `${id}.json`);
      await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    } catch (e) {
      console.error('[CrashReporter] Failed to save crash report:', e.message);
    }

    // Prune old reports
    try {
      await this._pruneOld();
    } catch { /* non-critical */ }

    // Notify via Telegram
    if (this.telegramBot && this.telegramBot.isRunning) {
      const severity = context.fatal ? '🚨 FATAL' : '⚠️ Error';
      const text = `${severity} *Crash Report*\n\n\`${error?.message || String(error)}\`\n\n_v${this.appVersion} • ${process.platform} • Node ${process.version}_`;
      try {
        await this.telegramBot.notify(text, context.fatal ? 'high' : 'normal');
      } catch { /* don't crash the crash reporter */ }
    }

    console.error(`[CrashReporter] Saved: ${id} — ${error?.message || error}`);
    return report;
  }

  async listCrashes(limit = 50) {
    try {
      const files = (await fs.readdir(this.dataDir))
        .filter(f => f.startsWith('crash_') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, limit);

      const reports = [];
      for (const file of files) {
        try {
          const raw = await fs.readFile(path.join(this.dataDir, file), 'utf8');
          reports.push(JSON.parse(raw));
        } catch { /* skip corrupt */ }
      }
      return reports;
    } catch {
      return [];
    }
  }

  async getCrash(id) {
    try {
      const raw = await fs.readFile(path.join(this.dataDir, `${id}.json`), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async _pruneOld() {
    const files = (await fs.readdir(this.dataDir))
      .filter(f => f.startsWith('crash_') && f.endsWith('.json'))
      .sort()
      .reverse();

    for (let i = MAX_CRASHES; i < files.length; i++) {
      await fs.unlink(path.join(this.dataDir, files[i])).catch(() => {});
    }
  }
}
