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
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');

export class DatabaseAdapter {
  constructor(userId = 'local') {
    this.userId = userId;
    this.cloud = isCloudMode();
    this.db = this.cloud ? getDatabase() : null;
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
      const id = lead.id || crypto.randomUUID();
      this.db.prepare(`
        INSERT INTO leads (id, user_id, name, company, email, phone, website, stage, source, notes, score, dnc, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, company=excluded.company, email=excluded.email, phone=excluded.phone,
          website=excluded.website, stage=excluded.stage, source=excluded.source, notes=excluded.notes,
          score=excluded.score, dnc=excluded.dnc, metadata=excluded.metadata, updated_at=datetime('now')
      `).run(id, this.userId, lead.name, lead.company, lead.email, lead.phone, lead.website,
        lead.stage || 'new', lead.source, lead.notes, lead.score, lead.dnc ? 1 : 0,
        JSON.stringify(lead.metadata || {}));
      return { ...lead, id };
    }
    return this._updateJsonArray('pipeline/leads.json', lead);
  }

  saveLeads(newLeads) {
    if (this.cloud) {
      const insert = this.db.prepare(`
        INSERT INTO leads (id, user_id, name, company, email, phone, website, stage, source, notes, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const tx = this.db.transaction((leads) => {
        for (const l of leads) {
          insert.run(l.id || crypto.randomUUID(), this.userId, l.name, l.company, l.email,
            l.phone, l.website, l.stage || 'new', l.source, l.notes, JSON.stringify(l.metadata || {}));
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

  async _appendToConversation(conversationId, message) {
    const messages = await this._readJson(`conversations/${conversationId}.json`, []);
    messages.push(message);
    await this._writeJson(`conversations/${conversationId}.json`, messages);
    return true;
  }
}
