/**
 * DatabaseAdapter — Abstraction layer for OpenAce data storage.
 *
 * OPENACE_CLOUD=true → SQLite database (multi-user, cloud-ready)
 * Otherwise → existing file-based storage (local mode, unchanged)
 *
 * Same API either way. When your own platform is ready,
 * swap this file's cloud implementation — zero changes elsewhere.
 */

import { isCloudMode } from './SupabaseClient.js';
import { getDatabase } from './CloudDatabase.js';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');

/** Domain used for the placeholder email on a not-yet-activated visitor. */
export const PROVISIONAL_DOMAIN = 'anonymous.openace.local';

export function isProvisionalEmail(email) {
  return typeof email === 'string' && email.endsWith(`@${PROVISIONAL_DOMAIN}`);
}

export class DatabaseAdapter {
  constructor(userId = 'local') {
    this.userId = userId;
    this.cloud = isCloudMode();
    this.db = this.cloud ? getDatabase() : null;
    this._ownerChecked = false;
  }

  /**
   * Every data table has `user_id REFERENCES users(id)`, so an anonymous owner
   * needs a row before it can own anything.
   *
   * Called lazily, on the first WRITE only. Creating it on every request
   * instead filled the users table with a throwaway row per bot, crawler and
   * uptime check — 74 empty accounts in the first hour — burying the real ones.
   */
  _ensureOwnerRow() {
    if (!this.cloud || this._ownerChecked || !this.userId || this.userId === 'local') return;
    this._ownerChecked = true;
    try {
      const exists = this.db.prepare('SELECT 1 FROM users WHERE id = ?').get(this.userId);
      if (exists) return;
      this.db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
        .run(this.userId, `${this.userId}@${PROVISIONAL_DOMAIN}`,
          bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10), '');
    } catch (e) {
      console.error('[DatabaseAdapter] could not create owner row:', e.message);
    }
  }

  // ═══ Leads / Pipeline ═══

  getLeads({ stage, businessId, limit = 500 } = {}) {
    if (this.cloud) {
      let sql = 'SELECT * FROM leads WHERE user_id = ?';
      const params = [this.userId];
      if (stage) { sql += ' AND stage = ?'; params.push(stage); }
      if (businessId) { sql += ' AND business_id = ?'; params.push(businessId); }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);
      return this.db.prepare(sql).all(...params).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
    }
    return this._readJson('pipeline/leads.json', []);
  }

  saveLead(lead) {
    if (this.cloud) {
      this._ensureOwnerRow();
      const id = lead.id || crypto.randomUUID();
      // name/company are NOT NULL in the schema, and callers legitimately supply
      // only one of them (a company with no named contact, say). Default rather
      // than throw — losing a lead to a constraint error helps nobody.
      this.db.prepare(`
        INSERT INTO leads (id, user_id, name, company, email, phone, website, stage, source, notes, score, dnc, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, company=excluded.company, email=excluded.email, phone=excluded.phone,
          website=excluded.website, stage=excluded.stage, source=excluded.source, notes=excluded.notes,
          score=excluded.score, dnc=excluded.dnc, metadata=excluded.metadata, updated_at=datetime('now')
      `).run(id, this.userId, lead.name ?? lead.contact_name ?? '', lead.company ?? '',
        lead.email ?? null, lead.phone ?? null, lead.website ?? null,
        lead.stage || 'new', lead.source ?? null, lead.notes ?? null,
        lead.score ?? null, lead.dnc ? 1 : 0,
        JSON.stringify(lead.metadata || {}));
      return { ...lead, id };
    }
    return this._updateJsonArray('pipeline/leads.json', lead);
  }

  saveLeads(newLeads) {
    if (this.cloud) {
      this._ensureOwnerRow();
      const insert = this.db.prepare(`
        INSERT INTO leads (id, user_id, name, company, email, phone, website, stage, source, notes, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = this.db.transaction((leads) => {
        for (const l of leads) {
          insert.run(l.id || crypto.randomUUID(), this.userId,
            l.name ?? l.contact_name ?? '', l.company ?? '',
            l.email ?? null, l.phone ?? null, l.website ?? null,
            l.stage || 'new', l.source ?? null, l.notes ?? null,
            JSON.stringify(l.metadata || {}));
        }
      });
      tx(newLeads);
      return newLeads;
    }
    return this._appendJsonArray('pipeline/leads.json', newLeads);
  }

  moveLead(leadId, stage) {
    if (this.cloud) {
      this.db.prepare("UPDATE leads SET stage = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
        .run(stage, leadId, this.userId);
      return true;
    }
    return this._readJson('pipeline/leads.json', []).then(leads => {
      const lead = leads.find(l => l.id === leadId);
      if (lead) { lead.stage = stage; lead.updatedAt = new Date().toISOString(); }
      return this._writeJson('pipeline/leads.json', leads);
    });
  }

  // ═══ Contacts ═══

  getContacts() {
    if (this.cloud) {
      return this.db.prepare('SELECT * FROM contacts WHERE user_id = ? ORDER BY created_at DESC')
        .all(this.userId).map(r => ({ ...r, tags: JSON.parse(r.tags || '[]'), metadata: JSON.parse(r.metadata || '{}') }));
    }
    return this._readJson('memory/contacts.json', []);
  }

  saveContact(contact) {
    if (this.cloud) {
      this._ensureOwnerRow();
      const id = contact.id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO contacts (id, user_id, name, email, phone, company, role, notes, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, email=excluded.email, phone=excluded.phone,
          company=excluded.company, role=excluded.role, notes=excluded.notes, tags=excluded.tags
      `).run(id, this.userId, contact.name, contact.email, contact.phone,
        contact.company, contact.role, contact.notes, JSON.stringify(contact.tags || []));
      return { ...contact, id };
    }
    return this._updateJsonArray('memory/contacts.json', contact);
  }

  deleteContact(contactId) {
    if (this.cloud) {
      const r = this.db.prepare('DELETE FROM contacts WHERE id = ? AND user_id = ?').run(contactId, this.userId);
      return r.changes > 0;
    }
    return this._removeFromJsonArray('memory/contacts.json', contactId);
  }

  deleteLead(leadId) {
    if (this.cloud) {
      const r = this.db.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').run(leadId, this.userId);
      return r.changes > 0;
    }
    return this._removeFromJsonArray('pipeline/leads.json', leadId);
  }

  // ═══ Tasks ═══
  // The cloud schema shipped with `leads` but no `tasks` table, so the pipeline's
  // task board had nowhere user-scoped to live. Created on demand.

  _ensureTasksTable() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT, description TEXT,
        stage TEXT DEFAULT 'inbox', priority TEXT DEFAULT 'medium',
        assigned_to TEXT, created_by TEXT,
        due_date TEXT, metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
    `);
  }

  getTasks() {
    if (this.cloud) {
      this._ensureTasksTable();
      return this.db.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC')
        .all(this.userId)
        .map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') }));
    }
    return this._readJson('pipeline/tasks.json', []);
  }

  saveTask(task) {
    if (this.cloud) {
      this._ensureOwnerRow();
      this._ensureTasksTable();
      const id = task.id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO tasks (id, user_id, title, description, stage, priority, assigned_to, created_by, due_date, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title, description=excluded.description, stage=excluded.stage,
          priority=excluded.priority, assigned_to=excluded.assigned_to, due_date=excluded.due_date,
          metadata=excluded.metadata, updated_at=datetime('now')
      `).run(id, this.userId, task.title, task.description, task.stage || 'inbox',
        task.priority || 'medium', task.assigned_to, task.created_by, task.due_date,
        JSON.stringify(task.metadata || {}));
      return { ...task, id };
    }
    return this._updateJsonArray('pipeline/tasks.json', task);
  }

  moveTask(taskId, stage) {
    if (this.cloud) {
      this._ensureTasksTable();
      const r = this.db.prepare("UPDATE tasks SET stage = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
        .run(stage, taskId, this.userId);
      return r.changes > 0;
    }
    return this._updateJsonArray('pipeline/tasks.json', { id: taskId, stage });
  }

  deleteTask(taskId) {
    if (this.cloud) {
      this._ensureTasksTable();
      const r = this.db.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?').run(taskId, this.userId);
      return r.changes > 0;
    }
    return this._removeFromJsonArray('pipeline/tasks.json', taskId);
  }

  // ═══ Business profile ═══

  getBusinessProfile() {
    if (this.cloud) {
      return this.db.prepare('SELECT * FROM businesses WHERE user_id = ? ORDER BY is_active DESC LIMIT 1')
        .get(this.userId) || null;
    }
    return this._readJson('business/profile.json', null);
  }

  saveBusinessProfile(profile) {
    if (this.cloud) {
      this._ensureOwnerRow();
      const existing = this.db.prepare('SELECT id FROM businesses WHERE user_id = ? LIMIT 1').get(this.userId);
      const id = existing?.id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO businesses (id, user_id, name, website, industry, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, website=excluded.website, industry=excluded.industry
      `).run(id, this.userId, profile.name, profile.website, profile.industry);
      return { ...profile, id };
    }
    return this._writeJson('business/profile.json', profile);
  }

  // ═══ Conversations ═══

  getConversations() {
    if (this.cloud) {
      return this.db.prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC')
        .all(this.userId);
    }
    return this._readJson('conversations/index.json', []);
  }

  getMessages(conversationId) {
    if (this.cloud) {
      return this.db.prepare('SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC')
        .all(conversationId, this.userId)
        .map(r => ({ ...r, tools_used: JSON.parse(r.tools_used || '[]'), metadata: JSON.parse(r.metadata || '{}') }));
    }
    return this._readJson(`conversations/${conversationId}.json`, []);
  }

  saveMessage(conversationId, message) {
    if (this.cloud) {
      this._ensureOwnerRow();
      this.db.prepare(`
        INSERT INTO messages (id, conversation_id, user_id, sender, content, tools_used, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), conversationId, this.userId, message.sender,
        message.content, JSON.stringify(message.tools_used || []), JSON.stringify(message.metadata || {}));
      // Upsert conversation
      this.db.prepare(`
        INSERT INTO conversations (id, user_id, title, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(id, user_id) DO UPDATE SET title=excluded.title, updated_at=datetime('now')
      `).run(conversationId, this.userId, (message.content || '').substring(0, 80));
      return true;
    }
    return this._appendToConversation(conversationId, message);
  }

  // ═══ SOPs ═══

  getSOPs() {
    if (this.cloud) {
      return this.db.prepare('SELECT * FROM sops WHERE user_id = ? ORDER BY created_at DESC')
        .all(this.userId)
        .map(r => ({ ...r, triggers: JSON.parse(r.triggers || '[]'), steps: JSON.parse(r.steps || '[]'), metadata: JSON.parse(r.metadata || '{}') }));
    }
    return this._readJson('sops/procedures.json', []);
  }

  saveSOP(sop) {
    if (this.cloud) {
      this._ensureOwnerRow();
      const id = sop.id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO sops (id, user_id, name, description, triggers, steps, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, description=excluded.description, triggers=excluded.triggers,
          steps=excluded.steps, metadata=excluded.metadata, updated_at=datetime('now')
      `).run(id, this.userId, sop.name, sop.description,
        JSON.stringify(sop.triggers || []), JSON.stringify(sop.steps || []), JSON.stringify(sop.metadata || {}));
      return { ...sop, id };
    }
    return this._updateJsonArray('sops/procedures.json', sop);
  }

  // ═══ Notes ═══

  getNotes(query) {
    if (this.cloud) {
      if (query) {
        return this.db.prepare('SELECT * FROM notes WHERE user_id = ? AND content LIKE ? ORDER BY created_at DESC LIMIT 50')
          .all(this.userId, `%${query}%`);
      }
      return this.db.prepare('SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT 50')
        .all(this.userId);
    }
    return this._readJson('memory/notes.json', []);
  }

  saveNote(note) {
    if (this.cloud) {
      this._ensureOwnerRow();
      const id = crypto.randomUUID();
      this.db.prepare('INSERT INTO notes (id, user_id, title, content, tags) VALUES (?, ?, ?, ?, ?)')
        .run(id, this.userId, note.title, note.content, JSON.stringify(note.tags || []));
      return { ...note, id };
    }
    return this._appendJsonItem('memory/notes.json', note);
  }

  // ═══ Credits ═══

  getCredits() {
    if (this.cloud) {
      return this.db.prepare('SELECT * FROM credits WHERE user_id = ?').get(this.userId)
        || { plan: 'trial', total: 0, trial_start: new Date().toISOString() };
    }
    return this._readJson('billing/credits.json', { plan: 'trial', total: 0 });
  }

  // ═══ Settings ═══

  getSettings() {
    if (this.cloud) {
      const row = this.db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(this.userId);
      if (!row) return {};
      return { ...row, ai_config: JSON.parse(row.ai_config || '{}'), tool_preferences: JSON.parse(row.tool_preferences || '{}') };
    }
    return this._readJson('config/settings.json', {});
  }

  saveSettings(settings) {
    if (this.cloud) {
      this._ensureOwnerRow();
      this.db.prepare(`
        INSERT INTO user_settings (user_id, ai_config, tool_preferences, theme, autonomy_level)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          ai_config=excluded.ai_config, tool_preferences=excluded.tool_preferences,
          theme=excluded.theme, autonomy_level=excluded.autonomy_level, updated_at=datetime('now')
      `).run(this.userId, JSON.stringify(settings.ai_config || {}),
        JSON.stringify(settings.tool_preferences || {}), settings.theme || 'dark', settings.autonomy_level || 'collaborative');
      return true;
    }
    return this._writeJson('config/settings.json', settings);
  }

  // ═══ Ownership transfer ═══

  /**
   * Move every row owned by `fromOwner` to `toOwner`.
   *
   * Runs when an anonymous visitor gives us enough to activate an account
   * mid-conversation — their chats, leads and notes follow them in rather
   * than being stranded in the anon bucket.
   *
   * Idempotent: re-running for an already-migrated owner is a no-op.
   */
  reassignOwner(fromOwner, toOwner) {
    if (!this.cloud || !fromOwner || !toOwner || fromOwner === toOwner) return false;

    // user_id-keyed tables. credits/user_settings are excluded on purpose:
    // the new account gets its own trial row, and merging would double-grant.
    // form_submissions is deliberately absent — it has no user_id column and is
    // reached through its parent form. Tables are still probed at runtime so a
    // schema that drifts can't abort the whole transfer.
    const USER_TABLES = [
      'leads', 'contacts', 'conversations', 'messages', 'sops', 'notes', 'tasks',
      'businesses', 'forms', 'research_memory', 'scheduled_tasks',
    ];
    // These key on session_id instead of user_id
    const SESSION_TABLES = ['session_conversations', 'session_messages'];

    const hasColumn = (table, column) => {
      const t = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
      if (!t) return false;
      return this.db.prepare(`PRAGMA table_info(${table})`).all().some(c => c.name === column);
    };

    const tx = this.db.transaction(() => {
      for (const t of USER_TABLES) {
        if (!hasColumn(t, 'user_id')) continue;
        this.db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(toOwner, fromOwner);
      }
      for (const t of SESSION_TABLES) {
        if (!hasColumn(t, 'session_id')) continue;
        this.db.prepare(`UPDATE ${t} SET session_id = ? WHERE session_id = ?`).run(toOwner, fromOwner);
      }
    });

    try {
      tx();
      return true;
    } catch (e) {
      console.error(`[DatabaseAdapter] reassignOwner ${fromOwner} → ${toOwner} failed:`, e.message);
      return false;
    }
  }

  // ═══ Local file helpers ═══

  async _readJson(relativePath, defaultValue) {
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, relativePath), 'utf-8');
      return JSON.parse(raw);
    } catch { return defaultValue; }
  }

  async _writeJson(relativePath, data) {
    const fullPath = path.join(DATA_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
  }

  async _updateJsonArray(relativePath, item) {
    const arr = await this._readJson(relativePath, []);
    const idx = arr.findIndex(x => x.id === item.id);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...item };
    else arr.push(item);
    await this._writeJson(relativePath, arr);
    return item;
  }

  async _appendJsonArray(relativePath, items) {
    const arr = await this._readJson(relativePath, []);
    arr.push(...items);
    await this._writeJson(relativePath, arr);
    return items;
  }

  async _appendJsonItem(relativePath, item) {
    const arr = await this._readJson(relativePath, []);
    arr.push(item);
    await this._writeJson(relativePath, arr);
    return item;
  }

  async _removeFromJsonArray(relativePath, id) {
    const arr = await this._readJson(relativePath, []);
    const next = arr.filter(x => x.id !== id);
    await this._writeJson(relativePath, next);
    return next.length !== arr.length;
  }

  async _appendToConversation(conversationId, message) {
    const messages = await this._readJson(`conversations/${conversationId}.json`, []);
    messages.push(message);
    await this._writeJson(`conversations/${conversationId}.json`, messages);
    return true;
  }
}
