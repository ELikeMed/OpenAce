#!/usr/bin/env node

/**
 * Gmail App Password Setup
 *
 * Saves your Gmail address and App Password so Ace can send emails
 * instantly without browser automation.
 *
 * How to get an App Password:
 *   1. Go to myaccount.google.com/security
 *   2. Under "How you sign in to Google" → 2-Step Verification (must be ON)
 *   3. Scroll down → "App passwords"
 *   4. Create → name it "OpenAce" → copy the 16-character password
 *
 * Run this script once:  npm run setup-gmail
 */

import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDS_FILE = path.join(__dirname, '../data/memory/credentials/gmail-smtp.json');

console.log('\n📧  Gmail App Password Setup for OpenAce\n');
console.log('How to get your App Password:');
console.log('  1. Go to myaccount.google.com/security');
console.log('  2. Enable 2-Step Verification if not already on');
console.log('  3. Search "App passwords" → Create one named "OpenAce"');
console.log('  4. Copy the 16-character password (no spaces)\n');

const answers = await inquirer.prompt([
  {
    type: 'input',
    name: 'email',
    message: 'Your Gmail address:',
    validate: (v) => v.includes('@') || 'Please enter a valid email address',
  },
  {
    type: 'input',
    name: 'displayName',
    message: 'Your display name (shown as sender):',
    default: 'Ace',
  },
  {
    type: 'password',
    name: 'appPassword',
    message: 'App Password (16 characters, no spaces):',
    mask: '*',
    validate: (v) => {
      const clean = v.replace(/\s/g, '');
      return clean.length === 16 || `App Passwords are exactly 16 characters (you entered ${clean.length})`;
    },
  },
]);

const email = answers.email.trim();
const appPassword = answers.appPassword.replace(/\s/g, ''); // Remove any spaces
const displayName = answers.displayName.trim();

// Test the connection before saving
console.log('\n🔄 Testing connection...');
try {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: appPassword },
  });

  await transporter.verify();
  console.log('✅ Connection successful!\n');
} catch (err) {
  console.error(`\n❌ Connection failed: ${err.message}`);
  console.error('\nCommon causes:');
  console.error('  - Wrong App Password (must be exactly 16 chars from Google)');
  console.error('  - 2-Step Verification not enabled on your Google account');
  console.error('  - "Less secure app access" issues (App Passwords bypass this)\n');
  process.exit(1);
}

// Save credentials
await fs.mkdir(path.dirname(CREDS_FILE), { recursive: true });
await fs.writeFile(CREDS_FILE, JSON.stringify({ email, appPassword, displayName }, null, 2));

console.log(`✅ Gmail SMTP configured for: ${email}`);
console.log(`📁 Saved to: ${CREDS_FILE}`);
console.log('\nAce can now send emails instantly. Restart OpenAce and try:');
console.log('  "Send an email to someone@example.com, subject: Hello, body: Hi there!"\n');
