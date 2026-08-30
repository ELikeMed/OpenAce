/**
 * ApiKeyService — keys for calling Ace from outside the app, and the token accounting
 * that goes with it.
 *
 * Keys are shown once at creation and never again: only a SHA-256 hash is stored, so a
 * copy of the database yields no working keys. A short prefix is kept so a key can be
 * identified in a list.
 *
 * Keys marked unlimited belong to the operator — their own model on their own machine —
 * and are never metered or charged. Usage is still recorded for them, because knowing what
 * the machine is doing is useful even when nobody is paying for it.
 */
import crypto from 'crypto';
import { getDatabase } from '../cloud/CloudDatabase.js';

const PREFIX = 'ace_live_';

export class ApiKeyService {
  static _hash(key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /** Returns the key in plain text exactly once. It cannot be recovered later. */
  static create({ userId, name, unlimited = false }) {
    if (!userId) throw new Error('userId is required');
    const db = getDatabase();

    const secret = crypto.randomBytes(24).toString('base64url');
    const key = `${PREFIX}${secret}`;
    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, unlimited)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, name || 'Untitled key', this._hash(key), key.slice(0, PREFIX.length + 6), unlimited ? 1 : 0);

    return { id, key, name: name || 'Untitled key', unlimited: !!unlimited };
  }

  /** The key record for a presented key, or null. Revoked keys never resolve. */
  static verify(presented) {
    if (!presented || !String(presented).startsWith(PREFIX)) return null;
    const db = getDatabase();
    const row = db.prepare(`
      SELECT id, user_id, name, unlimited, revoked_at
      FROM api_keys WHERE key_hash = ?
    `).get(this._hash(String(presented).trim()));

    if (!row || row.revoked_at) return null;
    db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?").run(row.id);
    return { id: row.id, userId: row.user_id, name: row.name, unlimited: !!row.unlimited };
  }

  static list(userId) {
    return getDatabase().prepare(`
      SELECT id, name, key_prefix, unlimited, created_at, last_used_at, revoked_at
      FROM api_keys WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId).map(r => ({ ...r, unlimited: !!r.unlimited, revoked: !!r.revoked_at }));
  }

  static revoke(userId, id) {
    const r = getDatabase()
      .prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL")
      .run(id, userId);
    return r.changes > 0;
  }

  /**
   * Record one model call. Counts come from the provider, so this is measured rather than
   * estimated. Never throws: usage accounting must not be able to fail a user's request.
   */
  static recordUsage({ userId, apiKeyId = null, model, promptTokens = 0, completionTokens = 0, durationMs = 0, source = 'app' }) {
    try {
      getDatabase().prepare(`
        INSERT INTO token_usage (user_id, api_key_id, model, prompt_tokens, completion_tokens, duration_ms, source)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId || null, apiKeyId, model || null,
        Math.max(0, promptTokens | 0), Math.max(0, completionTokens | 0), Math.max(0, durationMs | 0), source);
    } catch (e) {
      console.warn('[ApiKeys] could not record usage:', e.message);
    }
  }

  static usageSummary(userId, days = 30) {
    const db = getDatabase();
    const totals = db.prepare(`
      SELECT COUNT(*) AS calls,
             COALESCE(SUM(prompt_tokens), 0) AS prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) AS completion_tokens
      FROM token_usage
      WHERE user_id = ? AND created_at >= datetime('now', ?)
    `).get(userId, `-${Math.max(1, days | 0)} days`);

    const daily = db.prepare(`
      SELECT date(created_at) AS day,
             COUNT(*) AS calls,
             COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS tokens
      FROM token_usage
      WHERE user_id = ? AND created_at >= datetime('now', ?)
      GROUP BY day ORDER BY day DESC
    `).all(userId, `-${Math.max(1, days | 0)} days`);

    return {
      days,
      calls: totals.calls,
      promptTokens: totals.prompt_tokens,
      completionTokens: totals.completion_tokens,
      totalTokens: totals.prompt_tokens + totals.completion_tokens,
      daily,
    };
  }
}
