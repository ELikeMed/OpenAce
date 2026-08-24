#!/usr/bin/env node
/**
 * Mint a login token for an account — the break-glass way in.
 *
 * Magic-link login needs GMAIL_USER / GMAIL_APP_PASSWORD configured. Until that
 * exists (or if email ever breaks), this is how you sign in. Run it on the
 * server, open the printed URL, and you're logged in on that browser.
 *
 *   node scripts/mint-token.js openaceai@gmail.com
 *   node scripts/mint-token.js openaceai@gmail.com --days 90
 *
 * Reads JWT_SECRET from the environment — it must match what the server runs
 * with, or the token it prints will be rejected.
 */

import jwt from 'jsonwebtoken';
import path from 'path';
import Database from 'better-sqlite3';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = path.join(ROOT, 'data', 'cloud', 'openace.db');

const email = process.argv[2];
const daysIdx = process.argv.indexOf('--days');
const days = daysIdx > -1 ? parseInt(process.argv[daysIdx + 1], 10) : 30;
const APP_URL = process.env.APP_URL || 'https://app.openaceai.com';
const SECRET = process.env.JWT_SECRET;

if (!email) {
  console.error('Usage: JWT_SECRET=... node scripts/mint-token.js <email> [--days 30]');
  process.exit(1);
}
if (!SECRET) {
  console.error('JWT_SECRET is not set. Run with the same secret the server uses:');
  console.error('  JWT_SECRET="$(grep -A1 JWT_SECRET ~/Library/LaunchAgents/com.openace.server.plist | tail -1 | sed \'s/.*<string>\\(.*\\)<\\/string>.*/\\1/\')" node scripts/mint-token.js ' + email);
  process.exit(1);
}

const db = new Database(DB_PATH, { readonly: true });
const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email.toLowerCase());
if (!user) {
  console.error(`No account for ${email}. Existing:`);
  for (const u of db.prepare('SELECT email FROM users').all()) console.error(`  ${u.email}`);
  process.exit(1);
}

const token = jwt.sign({ userId: user.id, email: user.email }, SECRET, { expiresIn: `${days}d` });

console.log(`\nAccount : ${user.email} (${user.name || 'unnamed'})`);
console.log(`User ID : ${user.id}`);
console.log(`Expires : ${days} days\n`);
console.log('Paste this in the browser console on the app, then reload:\n');
console.log(`  localStorage.setItem('ace_token', '${token}'); location.reload();\n`);
console.log('Or use it directly against the API:\n');
console.log(`  curl -H "Authorization: Bearer ${token}" ${APP_URL}/api/contacts\n`);

db.close();
