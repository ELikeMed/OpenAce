/**
 * SessionManager — Per-user conversation isolation for cloud mode.
 *
 * Each visitor gets their own session with their own conversations.
 * Admin sees admin conversations. Visitors see only theirs.
 * No data leaks between users.
 */

import { getDatabase } from './CloudDatabase.js';
import { isCloudMode } from './SupabaseClient.js';
import crypto from 'crypto';

export class SessionManager {
  constructor() {
    this.cloud = isCloudMode();
    if (this.cloud) this._ensureTables();
  }

  _ensureTables() {
    const db = getDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_conversations (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        title TEXT DEFAULT 'New chat',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS session_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_session_conv ON session_conversations(session_id);
      CREATE INDEX IF NOT EXISTS idx_session_msg ON session_messages(conversation_id, session_id);
    `);
  }

  /**
   * Session ID = the request's resolved owner.
   *
   * identityMiddleware sets req.ownerId — the JWT userId when logged in, or a
   * signed per-browser anonymous id otherwise. The previous IP+User-Agent hash
   * was replaced because it collided: visitors sharing an office IP and browser
   * landed in the same bucket and saw each other's conversations.
   */
  getSessionId(req) {
    if (req.ownerId) return req.ownerId;
    // identityMiddleware didn't run — refuse rather than guess and risk a shared bucket
    throw new Error('getSessionId called before identityMiddleware — no ownerId on request');
  }

  /**
   * Get all conversations for a session
   */
  getConversations(sessionId) {
    if (!this.cloud) return [];
    const db = getDatabase();
    return db.prepare('SELECT * FROM session_conversations WHERE session_id = ? ORDER BY updated_at DESC')
      .all(sessionId);
  }

  /**
   * Get messages for a conversation (only if it belongs to this session)
   */
  getMessages(sessionId, conversationId) {
    if (!this.cloud) return [];
    const db = getDatabase();
    return db.prepare('SELECT * FROM session_messages WHERE conversation_id = ? AND session_id = ? ORDER BY created_at ASC')
      .all(conversationId, sessionId);
  }

  /**
   * Save a message to a conversation
   */
  saveMessage(sessionId, conversationId, sender, content, metadata = {}) {
    if (!this.cloud) return;
    const db = getDatabase();

    // Ensure conversation exists
    const existing = db.prepare('SELECT id FROM session_conversations WHERE id = ? AND session_id = ?')
      .get(conversationId, sessionId);

    if (!existing) {
      // Create conversation with first message as title
      const title = sender === 'user' ? (content || '').substring(0, 60) : 'New chat';
      db.prepare('INSERT INTO session_conversations (id, session_id, title) VALUES (?, ?, ?)')
        .run(conversationId, sessionId, title);
    } else {
      // Update timestamp
      db.prepare("UPDATE session_conversations SET updated_at = datetime('now') WHERE id = ?")
        .run(conversationId);

      // Update title if this is the first user message
      if (sender === 'user') {
        const msgCount = db.prepare('SELECT COUNT(*) as c FROM session_messages WHERE conversation_id = ? AND sender = ?')
          .get(conversationId, 'user');
        if (!msgCount || msgCount.c === 0) {
          db.prepare('UPDATE session_conversations SET title = ? WHERE id = ?')
            .run((content || '').substring(0, 60), conversationId);
        }
      }
    }

    // Save message
    db.prepare('INSERT INTO session_messages (id, conversation_id, session_id, sender, content, metadata) VALUES (?, ?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), conversationId, sessionId, sender, content, JSON.stringify(metadata));
  }

  /**
   * Delete a conversation (only if it belongs to this session)
   */
  deleteConversation(sessionId, conversationId) {
    if (!this.cloud) return false;
    const db = getDatabase();
    db.prepare('DELETE FROM session_messages WHERE conversation_id = ? AND session_id = ?')
      .run(conversationId, sessionId);
    const result = db.prepare('DELETE FROM session_conversations WHERE id = ? AND session_id = ?')
      .run(conversationId, sessionId);
    return result.changes > 0;
  }
}
