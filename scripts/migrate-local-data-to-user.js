#!/usr/bin/env node
/**
 * One-time migration: file-based data → per-user SQLite rows.
 *
 * Cloud mode now reads every business object through DatabaseAdapter, which is
 * scoped by user_id. Data sitting in data/*.json predates that and belongs to
 * nobody, so it would simply stop appearing. This assigns it to a real account.
 *
 *   node scripts/migrate-local-data-to-user.js <email> [--dry-run]
 *
 * Idempotent: rows already carrying the target user_id are left alone, and
 * contacts/leads are matched on email or company so a re-run won't duplicate.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = path.join(ROOT, 'data', 'cloud', 'openace.db');

const email = process.argv[2];
const dryRun = process.argv.includes('--dry-run');

if (!email) {
  console.error('Usage: node scripts/migrate-local-data-to-user.js <email> [--dry-run]');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email.toLowerCase());
if (!user) {
  console.error(`No account found for ${email}. Existing accounts:`);
  for (const u of db.prepare('SELECT email FROM users').all()) console.error(`  ${u.email}`);
  process.exit(1);
}

const USER_ID = user.id;
console.log(`\nMigrating into ${user.email} (${USER_ID})${dryRun ? '  [DRY RUN]' : ''}\n`);

const readJson = async (rel, fallback) => {
  try { return JSON.parse(await fs.readFile(path.join(ROOT, rel), 'utf-8')); }
  catch { return fallback; }
};

let totals = { contacts: 0, leads: 0, notes: 0, businesses: 0, skipped: 0 };

// ── Contacts ──
{
  const raw = await readJson('data/memory/contacts.json', {});
  const list = Array.isArray(raw) ? raw : (raw.contacts || []);
  const insert = db.prepare(`
    INSERT OR IGNORE INTO contacts (id, user_id, name, email, phone, company, role, notes, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const c of list) {
    const dupe = c.email
      ? db.prepare('SELECT id FROM contacts WHERE user_id = ? AND email = ?').get(USER_ID, c.email)
      : db.prepare('SELECT id FROM contacts WHERE user_id = ? AND name = ?').get(USER_ID, c.name);
    if (dupe) { totals.skipped++; continue; }
    if (!dryRun) {
      insert.run(c.id || crypto.randomUUID(), USER_ID, c.name || '', c.email || null,
        c.phone || null, c.company || null, c.role || null,
        typeof c.notes === 'string' ? c.notes : JSON.stringify(c.notes || ''),
        JSON.stringify(c.tags || []));
    }
    totals.contacts++;
  }
}

// ── Leads (from pipeline.json) ──
{
  const pipeline = await readJson('data/pipeline/pipeline.json', {});
  const leads = pipeline.leads || [];
  const insert = db.prepare(`
    INSERT INTO leads (id, user_id, name, company, email, phone, website, stage, source, notes, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const idTaken = db.prepare('SELECT 1 FROM leads WHERE id = ?');
  for (const l of leads) {
    const dupe = l.email
      ? db.prepare('SELECT id FROM leads WHERE user_id = ? AND email = ?').get(USER_ID, l.email)
      : db.prepare('SELECT id FROM leads WHERE user_id = ? AND company = ?').get(USER_ID, l.company);
    if (dupe) { totals.skipped++; continue; }
    // pipeline.json contains repeated ids; mint a fresh one rather than collide
    let id = l.id || crypto.randomUUID();
    if (idTaken.get(id)) id = crypto.randomUUID();
    if (!dryRun) {
      insert.run(id, USER_ID, l.contact_name || l.name || '',
        l.company || '', l.email || null, l.phone || null, l.website || null,
        l.stage || 'new', l.source || 'migrated',
        Array.isArray(l.notes) ? l.notes.join('\n') : (l.notes || ''),
        JSON.stringify({ migrated: true }));
    }
    totals.leads++;
  }

  // Tasks — the table is created on demand by DatabaseAdapter
  const tasks = pipeline.items || [];
  if (tasks.length) {
    if (!dryRun) {
      db.exec(`CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT, description TEXT,
        stage TEXT DEFAULT 'inbox', priority TEXT DEFAULT 'medium',
        assigned_to TEXT, created_by TEXT, due_date TEXT, metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));`);
      const ti = db.prepare(`INSERT OR IGNORE INTO tasks
        (id, user_id, title, description, stage, priority, assigned_to, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const t of tasks) {
        ti.run(t.id || crypto.randomUUID(), USER_ID, t.title || '', t.description || '',
          t.stage || 'inbox', t.priority || 'medium', t.assigned_to || null, t.created_by || 'migrated');
      }
    }
    console.log(`  tasks: ${tasks.length}`);
  }
}

// ── Notes ──
{
  const dir = path.join(ROOT, 'data', 'memory', 'notes');
  let files = [];
  try { files = (await fs.readdir(dir)).filter(f => f.endsWith('.json')); } catch { /* none */ }
  const insert = db.prepare('INSERT OR IGNORE INTO notes (id, user_id, title, content, tags) VALUES (?, ?, ?, ?, ?)');
  for (const f of files) {
    try {
      const n = JSON.parse(await fs.readFile(path.join(dir, f), 'utf-8'));
      const dupe = db.prepare('SELECT id FROM notes WHERE user_id = ? AND title = ?').get(USER_ID, n.title);
      if (dupe) { totals.skipped++; continue; }
      if (!dryRun) {
        insert.run(n.id || crypto.randomUUID(), USER_ID, n.title || '', n.content || '',
          JSON.stringify(n.category ? [n.category] : []));
      }
      totals.notes++;
    } catch { /* skip corrupt */ }
  }
}

// ── Business profile ──
{
  const profiles = await readJson('data/business/profiles.json', null);
  const single = await readJson('data/business/profile.json', null);
  const list = Array.isArray(profiles) ? profiles : (profiles ? [profiles] : (single ? [single] : []));
  const insert = db.prepare(`INSERT INTO businesses (id, user_id, name, website, industry, is_active)
    VALUES (?, ?, ?, ?, ?, ?)`);
  for (const [i, b] of list.entries()) {
    if (!b?.name) continue;
    const dupe = db.prepare('SELECT id FROM businesses WHERE user_id = ? AND name = ?').get(USER_ID, b.name);
    if (dupe) { totals.skipped++; continue; }
    if (!dryRun) {
      insert.run(b.id || crypto.randomUUID(), USER_ID, b.name, b.website || '', b.industry || '', i === 0 ? 1 : 0);
    }
    totals.businesses++;
  }
}

console.log(`  contacts:   ${totals.contacts}`);
console.log(`  leads:      ${totals.leads}`);
console.log(`  notes:      ${totals.notes}`);
console.log(`  businesses: ${totals.businesses}`);
console.log(`  skipped (already present): ${totals.skipped}`);
console.log(dryRun ? '\nDry run — nothing written.\n' : '\nDone.\n');

db.close();
