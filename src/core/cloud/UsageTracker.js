/**
 * UsageTracker — Freemium usage tracking.
 *
 * Anonymous visitors: 50 free messages (tracked by IP+UA fingerprint)
 * Signed-up users: 10-day trial, then credits/subscription
 * Server uses OpenAce's API key for everyone. Cost absorbed during free/trial.
 */

import { getDatabase } from './CloudDatabase.js';
import { isCloudMode } from './SupabaseClient.js';

const FREE_MESSAGE_LIMIT = 50;

const anonymousSessions = new Map();

export class UsageTracker {
  constructor() {
    this.cloud = isCloudMode();
    if (this.cloud) this._ensureTable();
  }

  _ensureTable() {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_tracking (
        session_id TEXT PRIMARY KEY,
        message_count INTEGER DEFAULT 0,
        user_id TEXT,
        first_seen TEXT DEFAULT (datetime('now')),
        last_seen TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  /**
   * Check if request is allowed and increment usage.
   * Returns { allowed, remaining, message } or { allowed: false, reason, message }
   */
  checkAndTrack(req) {
    if (!this.cloud) return { allowed: true };

    if (req.userId && req.userId !== 'local') {
      return { allowed: true }; // Authenticated = trial/credit system handles limits
    }

    const sessionId = this._getSessionId(req);
    return this._checkAnonymous(sessionId);
  }

  _checkAnonymous(sessionId) {
    if (this.cloud) {
      const db = getDatabase();
      let row = db.prepare('SELECT message_count FROM usage_tracking WHERE session_id = ?').get(sessionId);

      if (!row) {
        db.prepare('INSERT INTO usage_tracking (session_id, message_count) VALUES (?, 0)').run(sessionId);
        row = { message_count: 0 };
      }

      if (row.message_count >= FREE_MESSAGE_LIMIT) {
        return {
          allowed: false,
          reason: 'free_limit',
          limit: FREE_MESSAGE_LIMIT,
          used: row.message_count,
          message: `You've used all ${FREE_MESSAGE_LIMIT} free messages. Sign up to keep using Ace — free for 10 days, no credit card needed.`,
        };
      }

      db.prepare("UPDATE usage_tracking SET message_count = message_count + 1, last_seen = datetime('now') WHERE session_id = ?")
        .run(sessionId);

      return { allowed: true, remaining: FREE_MESSAGE_LIMIT - row.message_count - 1 };
    }

    // In-memory fallback
    if (!anonymousSessions.has(sessionId)) {
      anonymousSessions.set(sessionId, { count: 0 });
    }
    const session = anonymousSessions.get(sessionId);

    if (session.count >= FREE_MESSAGE_LIMIT) {
      return {
        allowed: false,
        reason: 'free_limit',
        limit: FREE_MESSAGE_LIMIT,
        used: session.count,
        message: `You've used all ${FREE_MESSAGE_LIMIT} free messages. Sign up to keep using Ace.`,
      };
    }

    session.count++;
    return { allowed: true, remaining: FREE_MESSAGE_LIMIT - session.count };
  }

  getUsageInfo(req) {
    if (!this.cloud) return { mode: 'local', unlimited: true };
    if (req.userId && req.userId !== 'local') return { mode: 'authenticated' };

    const sessionId = this._getSessionId(req);
    if (this.cloud) {
      const db = getDatabase();
      const row = db.prepare('SELECT message_count FROM usage_tracking WHERE session_id = ?').get(sessionId);
      const used = row?.message_count || 0;
      return { mode: 'anonymous', used, limit: FREE_MESSAGE_LIMIT, remaining: Math.max(0, FREE_MESSAGE_LIMIT - used) };
    }
    const session = anonymousSessions.get(sessionId);
    return { mode: 'anonymous', used: session?.count || 0, limit: FREE_MESSAGE_LIMIT, remaining: Math.max(0, FREE_MESSAGE_LIMIT - (session?.count || 0)) };
  }

  _getSessionId(req) {
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    let hash = 0;
    const str = ip + ua;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return `anon_${Math.abs(hash).toString(36)}`;
  }
}
