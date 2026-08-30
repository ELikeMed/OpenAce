/**
 * MagicLink — Passwordless login via email.
 *
 * Flow:
 * 1. User gives an email (in chat, or on the login screen) → link emailed
 * 2. They click it → account created if new, JWT issued, redirected into the app
 * 3. Anything they did anonymously on that device follows them in
 *
 * No passwords. Ever.
 *
 * Tokens are persisted to SQLite and stored as SHA-256 hashes: a restart no
 * longer invalidates every pending link, and a database leak doesn't hand
 * anyone a working login.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDatabase } from './CloudDatabase.js';
import { isCloudMode } from './SupabaseClient.js';

const JWT_SECRET = process.env.JWT_SECRET || 'openace-dev-secret-change-in-production';
const APP_URL = process.env.APP_URL || 'https://app.openaceai.com';

const TTL_MINUTES = 15;

// Abuse limits. The endpoint is public and sends real email — without these,
// one script can burn the daily send quota and get the sending account flagged.
const MAX_PER_EMAIL_PER_HOUR = 5;
const MAX_PER_IP_PER_HOUR = 15;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

export class MagicLink {
  constructor() {
    if (isCloudMode()) this._ensureTable();
  }

  _ensureTable() {
    try {
      getDatabase().exec(`
        CREATE TABLE IF NOT EXISTS magic_links (
          token_hash TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          request_ip TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          expires_at TEXT NOT NULL,
          used_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_magic_email ON magic_links(email, created_at);
        CREATE INDEX IF NOT EXISTS idx_magic_ip ON magic_links(request_ip, created_at);
      `);
    } catch (e) {
      console.error('[MagicLink] table init failed:', e.message);
    }
  }

  /**
   * Has this email / IP asked for too many links lately?
   * Returns null when allowed, or a human-readable reason when not.
   */
  checkRateLimit(email, ip) {
    if (!isCloudMode()) return null;
    try {
      const db = getDatabase();
      const byEmail = db.prepare(
        "SELECT COUNT(*) c FROM magic_links WHERE email = ? AND created_at > datetime('now','-1 hour')"
      ).get(email.toLowerCase());
      if (byEmail.c >= MAX_PER_EMAIL_PER_HOUR) {
        return 'Too many login links requested for this address. Try again in an hour.';
      }
      if (ip) {
        const byIp = db.prepare(
          "SELECT COUNT(*) c FROM magic_links WHERE request_ip = ? AND created_at > datetime('now','-1 hour')"
        ).get(ip);
        if (byIp.c >= MAX_PER_IP_PER_HOUR) {
          return 'Too many login links requested. Try again in an hour.';
        }
      }
      return null;
    } catch {
      return null; // never block a login on a bookkeeping failure
    }
  }

  /**
   * Generate a single-use login link.
   */
  generateLink(email, requestIp = null) {
    const token = crypto.randomBytes(32).toString('hex');

    if (isCloudMode()) {
      try {
        const db = getDatabase();
        db.prepare(`
          INSERT INTO magic_links (token_hash, email, request_ip, expires_at)
          VALUES (?, ?, ?, datetime('now', ?))
        `).run(sha256(token), email.toLowerCase(), requestIp, `+${TTL_MINUTES} minutes`);

        // Housekeeping — drop anything long dead
        db.prepare("DELETE FROM magic_links WHERE created_at < datetime('now','-7 days')").run();
      } catch (e) {
        console.error('[MagicLink] could not persist token:', e.message);
      }
    }

    return `${APP_URL}/auth/verify?token=${token}`;
  }

  /**
   * Verify a link and return a JWT.
   *
   * Creates the account if this is a first-time sign-in — clicking a link sent
   * to an address proves control of it, which is the whole point of the flow.
   */
  verify(token) {
    if (!isCloudMode()) return { success: false, error: 'Not in cloud mode' };
    if (!token) return { success: false, error: 'Missing token' };

    const db = getDatabase();
    const hash = sha256(token);
    const entry = db.prepare('SELECT * FROM magic_links WHERE token_hash = ?').get(hash);

    if (!entry) return { success: false, error: 'This link is not valid. Request a new one.' };
    if (entry.used_at) return { success: false, error: 'This link was already used. Request a new one.' };

    const expired = db.prepare("SELECT datetime('now') > ? AS x").get(entry.expires_at);
    if (expired?.x) {
      return { success: false, error: 'This link expired. Request a new one.' };
    }

    // Single use — burn it before issuing anything
    db.prepare("UPDATE magic_links SET used_at = datetime('now') WHERE token_hash = ?").run(hash);

    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(entry.email);
    // Whether this link created the account, so the app can welcome a genuinely new
    // customer rather than congratulating someone who signs in every week.
    const isNewAccount = !user;

    if (!user) {
      // First sign-in for this address — create the account now.
      const userId = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
        .run(userId, entry.email, bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10), '');
      db.prepare("INSERT INTO credits (user_id, plan, total, trial_start) VALUES (?, 'trial', 0, datetime('now'))")
        .run(userId);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      console.log(`[MagicLink] created account on first sign-in: ${entry.email}`);
    }

    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      success: true,
      token: jwtToken,
      isNewAccount,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /** Are sending credentials configured at all? */
  static isConfigured() {
    return !!((process.env.GMAIL_USER || process.env.SMTP_USER) &&
              (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS));
  }

  /**
   * Send the login link. Returns { sent, error }.
   */
  async sendEmail(email, magicUrl) {
    const user = process.env.GMAIL_USER || process.env.SMTP_USER;
    const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

    if (!user || !pass) {
      console.warn('[MagicLink] No email credentials configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
      console.log(`[MagicLink] Login link for ${email}: ${magicUrl}`);
      return { sent: false, error: 'Email is not configured on this server.' };
    }

    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const nodemailer = require('nodemailer');

      const transporter = nodemailer.createTransport(
        process.env.SMTP_HOST
          ? {
              host: process.env.SMTP_HOST,
              port: parseInt(process.env.SMTP_PORT || '587', 10),
              secure: process.env.SMTP_PORT === '465',
              auth: { user, pass },
            }
          : { service: 'gmail', auth: { user, pass } }
      );

      await transporter.sendMail({
        from: `"Ace" <${user}>`,
        to: email,
        subject: 'Your Ace login link',
        text: `Sign in to Ace: ${magicUrl}\n\nThis link expires in ${TTL_MINUTES} minutes and can only be used once.`,
        html: `
          <div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1a1a1a">
            <div style="text-align:center;margin-bottom:32px">
              <span style="font-size:24px;color:#C9A96E">&#9824;</span>
              <h1 style="font-size:20px;font-weight:600;margin:8px 0 4px;letter-spacing:0.02em">OPENACE</h1>
            </div>
            <p style="font-size:16px;line-height:1.6;margin-bottom:24px">Click below to sign in to your Ace account. This link expires in ${TTL_MINUTES} minutes and works once.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${magicUrl}" style="display:inline-block;padding:14px 32px;background:#C9A96E;color:#0A0A0A;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">Sign in to Ace</a>
            </div>
            <p style="font-size:13px;color:#888;line-height:1.5">If the button doesn't work, paste this into your browser:<br><span style="word-break:break-all;color:#666">${magicUrl}</span></p>
            <p style="font-size:13px;color:#888;line-height:1.5">If you didn't request this, you can ignore this email.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
            <p style="font-size:12px;color:#aaa;text-align:center">OpenAce — Find leads. Close deals. Grow your business.</p>
          </div>
        `,
      });

      console.log(`[MagicLink] Email sent to ${email}`);
      return { sent: true };
    } catch (e) {
      console.error('[MagicLink] Failed to send email:', e.message);
      return { sent: false, error: e.message };
    }
  }
}
