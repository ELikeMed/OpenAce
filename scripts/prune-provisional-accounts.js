#!/usr/bin/env node
/**
 * Remove abandoned provisional accounts.
 *
 * Anonymous visitors get a placeholder `users` row so their work has an owner
 * (every data table has user_id REFERENCES users(id)). Ones that never wrote
 * anything are pure noise and bury the real accounts.
 *
 *   node scripts/prune-provisional-accounts.js            # dry run, 7 days
 *   node scripts/prune-provisional-accounts.js --apply
 *   node scripts/prune-provisional-accounts.js --apply --days 1
 *   node scripts/prune-provisional-accounts.js --apply --days 0   # all empty ones
 *
 * Only ever deletes rows that BOTH carry a provisional email AND own nothing.
 * A real account can't match, and neither can an anonymous visitor mid-session
 * who has actually saved something.
 */

import path from 'path';
import Database from 'better-sqlite3';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = path.join(ROOT, 'data', 'cloud', 'openace.db');
const PROVISIONAL_SUFFIX = '@anonymous.openace.local';

const apply = process.argv.includes('--apply');
const daysIdx = process.argv.indexOf('--days');
const days = daysIdx > -1 ? parseInt(process.argv[daysIdx + 1], 10) : 7;

if (Number.isNaN(days) || days < 0) {
  console.error('--days must be a non-negative number');
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const tableExists = (t) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ?").get(t);

// Every table that could make a provisional account worth keeping
const OWNED = [
  ['leads', 'user_id'], ['contacts', 'user_id'], ['notes', 'user_id'],
  ['sops', 'user_id'], ['tasks', 'user_id'], ['businesses', 'user_id'],
  ['forms', 'user_id'], ['research_memory', 'user_id'], ['scheduled_tasks', 'user_id'],
  ['conversations', 'user_id'], ['messages', 'user_id'],
  ['session_conversations', 'session_id'], ['session_messages', 'session_id'],
].filter(([t]) => tableExists(t));

const emptinessClause = OWNED
  .map(([t, col]) => `NOT EXISTS (SELECT 1 FROM ${t} WHERE ${col} = u.id)`)
  .join('\n    AND ');

// visitor_profiles holds a half-built profile — if there's a name or email in
// there, someone is mid-conversation. Don't delete them out from under it.
const profileClause = tableExists('visitor_profiles')
  ? `\n    AND NOT EXISTS (SELECT 1 FROM visitor_profiles p
       WHERE p.owner_id = u.id AND (p.name IS NOT NULL OR p.email IS NOT NULL))`
  : '';

const where = `
  u.email LIKE '%${PROVISIONAL_SUFFIX}'
    AND u.created_at < datetime('now', '-${days} days')
    AND ${emptinessClause}${profileClause}
`;

const total = db.prepare(`SELECT COUNT(*) c FROM users u WHERE u.email LIKE '%${PROVISIONAL_SUFFIX}'`).get().c;
const victims = db.prepare(`SELECT u.id, u.created_at FROM users u WHERE ${where}`).all();
const real = db.prepare(`SELECT COUNT(*) c FROM users WHERE email NOT LIKE '%${PROVISIONAL_SUFFIX}'`).get().c;

console.log(`\n  Real accounts:            ${real}`);
console.log(`  Provisional accounts:     ${total}`);
console.log(`  Empty + older than ${days}d:   ${victims.length}`);
console.log(`  Keeping (in use or new):  ${total - victims.length}\n`);

if (!victims.length) {
  console.log('  Nothing to prune.\n');
  db.close();
  process.exit(0);
}

if (!apply) {
  console.log('  Dry run — nothing deleted. Re-run with --apply to remove them.\n');
  db.close();
  process.exit(0);
}

const del = db.prepare('DELETE FROM users WHERE id = ?');
const cleanProfiles = tableExists('visitor_profiles')
  ? db.prepare('DELETE FROM visitor_profiles WHERE owner_id = ?')
  : null;

const tx = db.transaction((rows) => {
  for (const r of rows) {
    cleanProfiles?.run(r.id);
    del.run(r.id);
  }
});
tx(victims);

console.log(`  Removed ${victims.length} abandoned provisional accounts.`);
console.log(`  Remaining: ${db.prepare('SELECT COUNT(*) c FROM users').get().c} total users.\n`);

db.close();
