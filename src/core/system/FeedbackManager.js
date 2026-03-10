/**
 * FeedbackManager — User feedback submission, storage, and Telegram forwarding.
 *
 * Data stored in: data/feedback/feedback_{timestamp}_{hash}.json
 * Forwards to admin via Telegram (if configured).
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class FeedbackManager {
  constructor({ dataDir = 'data/feedback' } = {}) {
    this.dataDir = dataDir;
    this.telegramBot = null;
    this.appVersion = '1.0.0';
  }

  async initialize(telegramBot) {
    this.telegramBot = telegramBot || null;
    await fs.mkdir(this.dataDir, { recursive: true });

    // Read version
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf8'));
      this.appVersion = pkg.version || '1.0.0';
    } catch { /* keep default */ }

    const count = (await this._listFiles()).length;
    console.log(`[FeedbackManager] Initialized — ${count} feedback entries`);
    return this;
  }

  async submitFeedback({ type = 'general', message, metadata = {} }) {
    if (!message || !message.trim()) {
      throw new Error('Feedback message is required');
    }

    const timestamp = Date.now();
    const hash = crypto.randomBytes(4).toString('hex');
    const id = `feedback_${timestamp}_${hash}`;

    const entry = {
      id,
      type, // 'bug' | 'feature' | 'general'
      message: message.trim(),
      status: 'new',
      timestamp: new Date().toISOString(),
      appVersion: this.appVersion,
      platform: process.platform,
      nodeVersion: process.version,
      ...metadata,
    };

    // Save to file
    const filePath = path.join(this.dataDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2));

    // Forward to Telegram
    if (this.telegramBot && this.telegramBot.isRunning) {
      const typeEmoji = type === 'bug' ? '🐛' : type === 'feature' ? '💡' : '💬';
      const text = `${typeEmoji} *New Feedback* (${type})\n\n${message.trim()}\n\n_v${this.appVersion} • ${process.platform}_`;
      try {
        await this.telegramBot.notify(text, 'normal');
      } catch (e) {
        console.error('[FeedbackManager] Telegram forward failed:', e.message);
      }
    }

    console.log(`[FeedbackManager] Feedback submitted: ${id} (${type})`);
    return entry;
  }

  async listFeedback() {
    const files = await this._listFiles();
    const entries = [];

    for (const file of files) {
      try {
        const raw = await fs.readFile(path.join(this.dataDir, file), 'utf8');
        entries.push(JSON.parse(raw));
      } catch { /* skip corrupt */ }
    }

    // Most recent first
    return entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async getFeedback(id) {
    const filePath = path.join(this.dataDir, `${id}.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  }

  async _listFiles() {
    try {
      return (await fs.readdir(this.dataDir)).filter(f => f.startsWith('feedback_') && f.endsWith('.json'));
    } catch {
      return [];
    }
  }
}
