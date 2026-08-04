/**
 * DatabaseAdapter — Abstraction layer that lets OpenAce work with both
 * local file storage (default) and Supabase cloud database.
 *
 * When SUPABASE_URL is set → uses PostgreSQL via Supabase
 * When not set → uses the existing file-based storage (unchanged behavior)
 *
 * Usage: const db = new DatabaseAdapter(userId);
 *        const leads = await db.getLeads({ stage: 'new' });
 */

import { getSupabaseAdmin, isCloudMode } from './SupabaseClient.js';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export class DatabaseAdapter {
  constructor(userId = 'local') {
    this.userId = userId;
    this.cloud = isCloudMode();
    this.supabase = this.cloud ? getSupabaseAdmin() : null;
  }

  // ═══ Leads / Pipeline ═══

  async getLeads({ stage, businessId, limit = 500 } = {}) {
    if (this.cloud) {
      let query = this.supabase.from('leads').select('*').eq('user_id', this.userId).order('created_at', { ascending: false }).limit(limit);
      if (stage) query = query.eq('stage', stage);
      if (businessId) query = query.eq('business_id', businessId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    // Local: read from pipeline JSON
    return this._readJson('pipeline/leads.json', []);
  }

  async saveLead(lead) {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('leads')
        .upsert({ ...lead, user_id: this.userId }, { onConflict: 'id' })
        .select().single();
      if (error) throw error;
      return data;
    }
    const leads = await this._readJson('pipeline/leads.json', []);
    const existing = leads.findIndex(l => l.id === lead.id);
    if (existing >= 0) leads[existing] = { ...leads[existing], ...lead };
    else leads.push(lead);
    await this._writeJson('pipeline/leads.json', leads);
    return lead;
  }

  async saveLeads(newLeads) {
    if (this.cloud) {
      const rows = newLeads.map(l => ({ ...l, user_id: this.userId }));
      const { data, error } = await this.supabase.from('leads').insert(rows).select();
      if (error) throw error;
      return data;
    }
    const leads = await this._readJson('pipeline/leads.json', []);
    leads.push(...newLeads);
    await this._writeJson('pipeline/leads.json', leads);
    return newLeads;
  }

  async moveLead(leadId, stage) {
    if (this.cloud) {
      const { error } = await this.supabase.from('leads')
        .update({ stage, updated_at: new Date().toISOString() })
        .eq('id', leadId).eq('user_id', this.userId);
      if (error) throw error;
      return true;
    }
    const leads = await this._readJson('pipeline/leads.json', []);
    const lead = leads.find(l => l.id === leadId);
    if (lead) { lead.stage = stage; lead.updatedAt = new Date().toISOString(); }
    await this._writeJson('pipeline/leads.json', leads);
    return true;
  }

  // ═══ Contacts ═══

  async getContacts() {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('contacts')
        .select('*').eq('user_id', this.userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return this._readJson('memory/contacts.json', []);
  }

  async saveContact(contact) {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('contacts')
        .upsert({ ...contact, user_id: this.userId }, { onConflict: 'id' })
        .select().single();
      if (error) throw error;
      return data;
    }
    const contacts = await this._readJson('memory/contacts.json', []);
    const existing = contacts.findIndex(c => c.id === contact.id);
    if (existing >= 0) contacts[existing] = { ...contacts[existing], ...contact };
    else contacts.push(contact);
    await this._writeJson('memory/contacts.json', contacts);
    return contact;
  }

  // ═══ Conversations ═══

  async getConversations() {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('conversations')
        .select('*').eq('user_id', this.userId).order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return this._readJson('conversations/index.json', []);
  }

  async getMessages(conversationId) {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('messages')
        .select('*').eq('conversation_id', conversationId).eq('user_id', this.userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    }
    return this._readJson(`conversations/${conversationId}.json`, []);
  }

  async saveMessage(conversationId, message) {
    if (this.cloud) {
      const { error } = await this.supabase.from('messages')
        .insert({ ...message, conversation_id: conversationId, user_id: this.userId });
      if (error) throw error;
      // Update conversation timestamp
      await this.supabase.from('conversations')
        .upsert({ id: conversationId, user_id: this.userId, title: message.content?.substring(0, 80), updated_at: new Date().toISOString() },
          { onConflict: 'id,user_id' });
      return true;
    }
    const messages = await this._readJson(`conversations/${conversationId}.json`, []);
    messages.push(message);
    await this._writeJson(`conversations/${conversationId}.json`, messages);
    return true;
  }

  // ═══ SOPs ═══

  async getSOPs() {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('sops')
        .select('*').eq('user_id', this.userId).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
    return this._readJson('sops/procedures.json', []);
  }

  async saveSOP(sop) {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('sops')
        .upsert({ ...sop, user_id: this.userId }, { onConflict: 'id' })
        .select().single();
      if (error) throw error;
      return data;
    }
    const sops = await this._readJson('sops/procedures.json', []);
    const existing = sops.findIndex(s => s.id === sop.id);
    if (existing >= 0) sops[existing] = { ...sops[existing], ...sop };
    else sops.push(sop);
    await this._writeJson('sops/procedures.json', sops);
    return sop;
  }

  // ═══ Notes / Memory ═══

  async getNotes(query) {
    if (this.cloud) {
      let q = this.supabase.from('notes').select('*').eq('user_id', this.userId);
      if (query) q = q.ilike('content', `%${query}%`);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    }
    return this._readJson('memory/notes.json', []);
  }

  async saveNote(note) {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('notes')
        .insert({ ...note, user_id: this.userId }).select().single();
      if (error) throw error;
      return data;
    }
    const notes = await this._readJson('memory/notes.json', []);
    notes.push(note);
    await this._writeJson('memory/notes.json', notes);
    return note;
  }

  // ═══ Credits ═══

  async getCredits() {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('credits')
        .select('*').eq('user_id', this.userId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || { plan: 'trial', total: 0, trial_start: new Date().toISOString() };
    }
    return this._readJson('billing/credits.json', { plan: 'trial', total: 0 });
  }

  // ═══ Settings ═══

  async getSettings() {
    if (this.cloud) {
      const { data, error } = await this.supabase.from('user_settings')
        .select('*').eq('user_id', this.userId).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data || {};
    }
    return this._readJson('config/settings.json', {});
  }

  async saveSettings(settings) {
    if (this.cloud) {
      const { error } = await this.supabase.from('user_settings')
        .upsert({ user_id: this.userId, ...settings, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' });
      if (error) throw error;
      return true;
    }
    await this._writeJson('config/settings.json', settings);
    return true;
  }

  // ═══ Local file helpers ═══

  async _readJson(relativePath, defaultValue) {
    try {
      const fullPath = path.join(DATA_DIR, relativePath);
      const raw = await fs.readFile(fullPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return defaultValue;
    }
  }

  async _writeJson(relativePath, data) {
    const fullPath = path.join(DATA_DIR, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, JSON.stringify(data, null, 2));
  }
}
