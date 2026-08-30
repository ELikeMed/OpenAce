/**
 * CloudDatabase — SQLite-powered cloud database for multi-user OpenAce.
 * Zero external dependencies. Runs on the same server.
 *
 * Creates/opens a SQLite database at data/cloud/openace.db
 * Handles schema creation on first run.
 *
 * Designed to be swappable — when your own platform is ready,
 * replace this file with your platform's adapter (same API).
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data', 'cloud');
const DB_PATH = path.join(DATA_DIR, 'openace.db');

let db = null;

export function getDatabase() {
  if (db) return db;

  // Ensure directory exists
  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // Better concurrent read performance
  db.pragma('foreign_keys = ON');

  // Create schema on first run
  initSchema(db);

  return db;
}

function initSchema(db) {
  db.exec(`
    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Businesses
    CREATE TABLE IF NOT EXISTS businesses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      industry TEXT,
      mission TEXT,
      target_audience TEXT,
      offerings TEXT,
      location TEXT,
      website TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- User settings (AI config, tool prefs, theme, etc.)
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      ai_config TEXT DEFAULT '{}',
      tool_preferences TEXT DEFAULT '{}',
      theme TEXT DEFAULT 'dark',
      autonomy_level TEXT DEFAULT 'collaborative',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Leads / Pipeline
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_id TEXT REFERENCES businesses(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      website TEXT,
      stage TEXT DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'qualified', 'proposal', 'closed', 'lost')),
      source TEXT,
      notes TEXT,
      score INTEGER,
      dnc INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Contacts
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      role TEXT,
      notes TEXT,
      tags TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Conversations
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (id, user_id)
    );

    -- Messages
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('user', 'ace', 'system')),
      content TEXT,
      tools_used TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- SOPs / Processes
    CREATE TABLE IF NOT EXISTS sops (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      triggers TEXT DEFAULT '[]',
      steps TEXT DEFAULT '[]',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- API keys for calling Ace from outside the app.
    -- Only a hash is stored: a leaked database must not yield working keys. The prefix is
    -- kept so a key can be recognised in a list without being recoverable.
    -- unlimited marks the operator's own keys — their model on their machine, so those
    -- calls are recorded for visibility but never metered or charged.
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      unlimited INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT,
      revoked_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

    -- Token usage, one row per model call. Ollama reports exact counts, so this is measured
    -- rather than estimated, and it stands on its own whether or not anything bills from it.
    CREATE TABLE IF NOT EXISTS token_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      api_key_id TEXT,
      model TEXT,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_token_usage_user_day ON token_usage(user_id, created_at);

    -- Forms
    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      fields TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{}',
      published INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Form submissions
    CREATE TABLE IF NOT EXISTS form_submissions (
      id TEXT PRIMARY KEY,
      form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      submitted_at TEXT DEFAULT (datetime('now'))
    );

    -- Notes / Memory
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      content TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Research memory
    CREATE TABLE IF NOT EXISTS research_memory (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      query TEXT NOT NULL,
      results TEXT NOT NULL,
      source TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Scheduled tasks
    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      action TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Credits / Billing
    CREATE TABLE IF NOT EXISTS credits (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT DEFAULT 'trial' CHECK (plan IN ('trial', 'credits', 'subscription', 'byo_key')),
      total INTEGER DEFAULT 0,
      purchased INTEGER DEFAULT 0,
      subscription INTEGER DEFAULT 0,
      trial_start TEXT DEFAULT (datetime('now')),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      auto_reload INTEGER DEFAULT 0,
      auto_reload_amount INTEGER DEFAULT 10,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON leads(user_id, stage);
    CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_sops_user ON sops(user_id);
    CREATE INDEX IF NOT EXISTS idx_forms_slug ON forms(slug);
    CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
  `);
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
