#!/usr/bin/env node
/**
 * Configure outbound email for magic-link login.
 *
 *   node scripts/setup-email.js
 *
 * Prompts for the address and app password (input hidden, nothing lands in
 * shell history), verifies the credentials against the SMTP server BEFORE
 * saving, writes them into the launch agent, and offers to restart.
 *
 * Gmail needs an App Password, not your normal password:
 *   1. 2-Step Verification must be ON: https://myaccount.google.com/signinoptions/two-step-verification
 *   2. Create one at https://myaccount.google.com/apppasswords
 *   3. Paste the 16-character code below (spaces are fine)
 *
 * For a non-Gmail provider, set SMTP_HOST/SMTP_PORT in the plist too.
 */

import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import readline from 'readline';
import { Writable } from 'stream';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const nodemailer = require('nodemailer');

const PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.openace.server.plist');

const INTERACTIVE = process.stdin.isTTY;

// ── Piped input (tests, automation) ──────────────────────────────────────────
// readline with terminal:true buffers a whole pipe at once, so prompts after
// the first race against input that has already been emitted. When stdin isn't
// a terminal, read it all up front and answer prompts from that queue instead.
let piped = [];
if (!INTERACTIVE) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  piped = Buffer.concat(chunks).toString('utf-8').split('\n');
}

// ── Interactive input ────────────────────────────────────────────────────────
// ONE readline interface for the whole script: creating a fresh one per prompt
// drains stdin on the first close, and later prompts hang on an ended stream.
const out = new Writable({
  write(chunk, encoding, callback) {
    if (!out.muted) process.stdout.write(chunk, encoding);
    callback();
  },
});
out.muted = false;

const rl = INTERACTIVE
  ? readline.createInterface({ input: process.stdin, output: out, terminal: true })
  : null;

/**
 * Prompt on stdin. With { hidden: true } the typed characters are not echoed,
 * so an app password never appears on screen or in a scrollback buffer.
 */
const ask = (question, { hidden = false } = {}) => {
  if (!INTERACTIVE) {
    process.stdout.write(question + (hidden ? '\n' : ''));
    const answer = (piped.shift() || '').trim();
    if (!hidden) process.stdout.write(answer + '\n');
    return Promise.resolve(answer);
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      out.muted = false;
      if (hidden) process.stdout.write('\n');
      resolve((answer || '').trim());
    });
    // Mute only after the question itself has been written
    if (hidden) out.muted = true;
  });
};

/** Exit cleanly — the shared interface holds the process open otherwise. */
const finish = (code) => { rl?.close(); process.exit(code); };

const plistGet = (key) => {
  try {
    return execFileSync('/usr/libexec/PlistBuddy',
      ['-c', `Print :EnvironmentVariables:${key}`, PLIST], { encoding: 'utf-8' }).trim();
  } catch { return null; }
};

const plistSet = (key, value) => {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :EnvironmentVariables:${key} ${value}`, PLIST]);
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :EnvironmentVariables:${key} string ${value}`, PLIST]);
  }
};

console.log('\n  OpenAce — email setup for magic-link login\n');
console.log('  Gmail requires an App Password (not your normal password).');
console.log('  2-Step Verification must be on, then create one at:');
console.log('    https://myaccount.google.com/apppasswords\n');

const email = await ask('  Sending address (e.g. openaceai@gmail.com): ');
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('\n  That is not a valid email address.\n');
  finish(1);
}

const appPassword = (await ask('  App password (input hidden): ', { hidden: true })).replace(/\s+/g, '');
if (appPassword.length < 12) {
  console.error('\n  That looks too short for an app password (expected ~16 characters).\n');
  finish(1);
}

const host = process.env.SMTP_HOST;
const transport = host
  ? { host, port: parseInt(process.env.SMTP_PORT || '587', 10), secure: process.env.SMTP_PORT === '465', auth: { user: email, pass: appPassword } }
  : { service: 'gmail', auth: { user: email, pass: appPassword } };

console.log('\n  Verifying credentials with the mail server...');
const transporter = nodemailer.createTransport(transport);

try {
  await transporter.verify();
  console.log('  ✓ Credentials accepted.');
} catch (e) {
  console.error(`\n  ✗ The mail server rejected these credentials:\n    ${e.message}\n`);
  if (/Username and Password not accepted|BadCredentials/i.test(e.message)) {
    console.error('  This usually means it is a regular password rather than an App Password,');
    console.error('  or 2-Step Verification is not enabled on the account.\n');
  }
  console.error('  Nothing was saved.\n');
  finish(1);
}

// Prove it end to end before committing anything to disk
const testTo = (await ask(`  Send a test email to [${email}]: `)) || email;
try {
  await transporter.sendMail({
    from: `"Ace" <${email}>`,
    to: testTo,
    subject: 'Ace email is working',
    text: 'If you are reading this, magic-link login can now reach you.',
    html: '<p style="font-family:sans-serif">If you are reading this, magic-link login can now reach you.</p>',
  });
  console.log(`  ✓ Test email sent to ${testTo}.`);
} catch (e) {
  console.error(`\n  ✗ Could not send the test email: ${e.message}\n  Nothing was saved.\n`);
  finish(1);
}

plistSet('GMAIL_USER', email);
plistSet('GMAIL_APP_PASSWORD', appPassword);
console.log(`\n  ✓ Saved to ${PLIST}`);

const appUrl = plistGet('APP_URL') || 'https://app.openaceai.com';
console.log(`    APP_URL is ${appUrl} — login links point there.\n`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isLoaded = () => {
  try {
    return execFileSync('launchctl', ['list'], { encoding: 'utf-8' }).includes('com.openace.server');
  } catch { return false; }
};

const restart = (await ask('  Restart the server now so it picks these up? [Y/n]: ')).toLowerCase();
const uid = process.getuid();

if (restart === '' || restart === 'y' || restart === 'yes') {
  console.log('\n  Restarting...');
  let ok = false;
  try {
    // launchd caches plist env; kickstart alone will NOT pick up new variables,
    // so the service has to be fully torn down and re-bootstrapped.
    try { execFileSync('launchctl', ['bootout', `gui/${uid}/com.openace.server`], { stdio: 'ignore' }); } catch { /* wasn't loaded */ }

    // bootout is asynchronous. Bootstrapping while the old job is still
    // unloading fails, and the server ends up simply gone — which is exactly
    // what happened the first time this shipped. Wait for it to actually go.
    for (let i = 0; i < 20 && isLoaded(); i++) await sleep(500);

    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try {
        execFileSync('launchctl', ['bootstrap', `gui/${uid}`, PLIST], { stdio: 'ignore' });
        ok = true;
      } catch {
        if (attempt < 3) await sleep(2000);
      }
    }
  } catch { /* fall through to the check below */ }

  // Don't claim success — confirm it. Boot takes a while, so poll.
  if (ok) {
    process.stdout.write('  Waiting for it to come up');
    let healthy = false;
    for (let i = 0; i < 40; i++) {
      await sleep(2000);
      process.stdout.write('.');
      try {
        const res = await fetch(`http://localhost:${plistGet('PORT') || 4000}/health`);
        if (res.ok) { healthy = true; break; }
      } catch { /* not listening yet */ }
    }
    console.log('');
    if (healthy) {
      console.log('  ✓ Server is up. Magic-link login is live.\n');
      finish(0);
    }
    console.error('  ✗ It was bootstrapped but is not answering on /health.');
    console.error('    Check the log: tail -50 /tmp/openace-error.log\n');
    finish(1);
  }

  console.error('  ✗ Could not restart automatically. The server is currently DOWN.');
  console.error('    Bring it back with:');
  console.error(`      launchctl bootout gui/${uid}/com.openace.server`);
  console.error('      sleep 4');
  console.error(`      launchctl bootstrap gui/${uid} ${PLIST}\n`);
  finish(1);
} else {
  console.log('\n  Not restarted — the new settings are saved but not yet in effect.');
  console.log('  When ready:');
  console.log(`      launchctl bootout gui/${uid}/com.openace.server`);
  console.log('      sleep 4');
  console.log(`      launchctl bootstrap gui/${uid} ${PLIST}\n`);
}

finish(0);
