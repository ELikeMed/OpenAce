/**
 * ContactManager — Lightweight address book with email history tracking
 *
 * NOT a CRM replacement. This is a quick-access contact cache so Ace can
 * resolve names → emails for chat-driven email, and track basic follow-up data.
 *
 * Auto-migrates from the old flat format { "Name": "email" } on first load.
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export class ContactManager {
  constructor(options = {}) {
    this.filePath = options.filePath || path.join(process.cwd(), 'data/memory/contacts.json');
    this.contacts = [];
    this.initialized = false;
  }

  async initialize() {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw);

      if (Array.isArray(data.contacts)) {
        // New format — already migrated
        this.contacts = data.contacts;
      } else if (typeof data === 'object' && !Array.isArray(data)) {
        // Old flat format: { "Name": "email" } — migrate
        console.log('[ContactManager] Migrating from flat format...');
        this.contacts = Object.entries(data).map(([name, email]) => ({
          id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          name,
          email: email,
          phone: null,
          tags: [],
          notes: '',
          company: null,
          source: 'migrated',
          created: new Date().toISOString(),
          lastContacted: null,
          emailHistory: [],
        }));
        await this.save();
        console.log(`[ContactManager] Migrated ${this.contacts.length} contacts`);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        console.warn(`[ContactManager] Error loading contacts: ${e.message}`);
      }
      this.contacts = [];
    }

    this.initialized = true;
    console.log(`✅ ContactManager initialized (${this.contacts.length} contacts)`);
    return this;
  }

  async save() {
    const dir = path.dirname(this.filePath);
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(this.filePath, JSON.stringify({ contacts: this.contacts }, null, 2));
  }

  // ─── CRUD ────────────────────────────────────

  addContact({ name, email, phone, tags, notes, company, source }) {
    if (!name || !email) throw new Error('Name and email are required');

    // Dedup by email
    const existing = this.contacts.find(c => c.email?.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error(`Contact with email "${email}" already exists (${existing.name})`);
    }

    const contact = {
      id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name,
      email,
      phone: phone || null,
      tags: tags || [],
      notes: notes || '',
      company: company || null,
      source: source || 'manual',
      created: new Date().toISOString(),
      lastContacted: null,
      emailHistory: [],
    };

    this.contacts.push(contact);
    this.save(); // async, non-blocking
    return contact;
  }

  updateContact(id, updates) {
    const contact = this.contacts.find(c => c.id === id);
    if (!contact) throw new Error(`Contact not found: ${id}`);

    const allowed = ['name', 'email', 'phone', 'tags', 'notes', 'company'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        contact[key] = updates[key];
      }
    }

    this.save();
    return contact;
  }

  deleteContact(id) {
    const index = this.contacts.findIndex(c => c.id === id);
    if (index === -1) throw new Error(`Contact not found: ${id}`);

    const removed = this.contacts.splice(index, 1)[0];
    this.save();
    return removed;
  }

  // ─── Search ──────────────────────────────────

  findByName(name) {
    if (!name) return [];
    const lower = name.toLowerCase();
    return this.contacts.filter(c => {
      const cName = c.name.toLowerCase();
      // Match full name, first name, last name, or partial
      return cName === lower ||
        cName.startsWith(lower) ||
        cName.split(' ').some(part => part.startsWith(lower));
    });
  }

  findByEmail(email) {
    if (!email) return null;
    return this.contacts.find(c => c.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  findByTag(tag) {
    if (!tag) return [];
    const lower = tag.toLowerCase();
    return this.contacts.filter(c => c.tags?.some(t => t.toLowerCase() === lower));
  }

  searchContacts(query) {
    if (!query) return this.contacts;
    const lower = query.toLowerCase();
    return this.contacts.filter(c =>
      c.name?.toLowerCase().includes(lower) ||
      c.email?.toLowerCase().includes(lower) ||
      c.company?.toLowerCase().includes(lower) ||
      c.notes?.toLowerCase().includes(lower) ||
      c.tags?.some(t => t.toLowerCase().includes(lower))
    );
  }

  listContacts({ tag, search, limit = 100, offset = 0 } = {}) {
    let results = this.contacts;

    if (tag) {
      const lower = tag.toLowerCase();
      results = results.filter(c => c.tags?.some(t => t.toLowerCase() === lower));
    }
    if (search) {
      results = this.searchContacts(search).filter(c => results.includes(c));
    }

    return {
      contacts: results.slice(offset, offset + limit),
      total: results.length,
    };
  }

  // ─── Email History ───────────────────────────

  logEmailSent(contactId, { subject, via }) {
    const contact = this.contacts.find(c => c.id === contactId);
    if (!contact) return null;

    const entry = {
      date: new Date().toISOString(),
      subject: subject || '(no subject)',
      via: via || 'unknown',
    };

    if (!contact.emailHistory) contact.emailHistory = [];
    contact.emailHistory.push(entry);
    contact.lastContacted = entry.date;

    // Keep last 50 entries per contact
    if (contact.emailHistory.length > 50) {
      contact.emailHistory = contact.emailHistory.slice(-50);
    }

    this.save();
    return entry;
  }

  /**
   * Find contacts that haven't been emailed in `daysSince` days
   */
  getContactsNeedingFollowUp(daysSince = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysSince);

    return this.contacts.filter(c => {
      if (!c.lastContacted) return true; // Never contacted
      return new Date(c.lastContacted) < cutoff;
    });
  }

  // ─── Bulk Import ─────────────────────────────

  /**
   * Import contacts from an array, deduplicating by email.
   * Returns { imported, skipped, total }.
   */
  importContacts(contactsArray) {
    let imported = 0;
    let skipped = 0;

    for (const c of contactsArray) {
      if (!c.name || !c.email) {
        skipped++;
        continue;
      }
      const existing = this.contacts.find(
        e => e.email?.toLowerCase() === c.email.toLowerCase()
      );
      if (existing) {
        skipped++;
        continue;
      }
      this.contacts.push({
        id: `contact_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: c.name,
        email: c.email,
        phone: c.phone || null,
        tags: c.tags || [],
        notes: c.notes || '',
        company: c.company || null,
        source: c.source || 'import',
        created: new Date().toISOString(),
        lastContacted: null,
        emailHistory: [],
      });
      imported++;
    }

    this.save();
    return { imported, skipped, total: this.contacts.length };
  }

  exportContacts() {
    return this.contacts;
  }

  getContact(id) {
    return this.contacts.find(c => c.id === id) || null;
  }
}

export default ContactManager;
