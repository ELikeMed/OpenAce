/**
 * MagicLink — Passwordless login via email.
 *
 * Flow:
 * 1. User gives email during chat → account created → magic link emailed
 * 2. User returns later → "What's your email?" → magic link emailed
 * 3. User clicks link → logged in with JWT → redirected to app
 *
 * No passwords. Ever.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDatabase } from './CloudDatabase.js';
import { isCloudMode } from './SupabaseClient.js';

const JWT_SECRET = process.env.JWT_SECRET || 'openace-dev-secret-change-in-production';
const APP_URL = process.env.APP_URL || 'https://app.openaceai.com';

// In-memory store for magic link tokens (expire after 15 min)
const pendingTokens = new Map();

export class MagicLink {

  /**
   * Generate a magic link token and return the URL.
   * Call sendMagicLinkEmail() to actually send it.
   */
  generateLink(email) {
    const token = crypto.randomBytes(32).toString('hex');
    pendingTokens.set(token, { email: email.toLowerCase(), createdAt: Date.now() });

    // Clean up expired tokens
    for (const [k, v] of pendingTokens) {
      if (Date.now() - v.createdAt > 15 * 60 * 1000) pendingTokens.delete(k);
    }

    return `${APP_URL}/auth/verify?token=${token}`;
  }

  /**
   * Verify a magic link token and return a JWT if valid.
   */
  verify(token) {
    const entry = pendingTokens.get(token);
    if (!entry) return { success: false, error: 'Invalid or expired link' };

    // Check expiry (15 minutes)
    if (Date.now() - entry.createdAt > 15 * 60 * 1000) {
      pendingTokens.delete(token);
      return { success: false, error: 'Link expired. Request a new one.' };
    }

    pendingTokens.delete(token);

    if (!isCloudMode()) return { success: false, error: 'Not in cloud mode' };

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(entry.email);

    if (!user) {
      return { success: false, error: 'No account found for this email' };
    }

    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return {
      success: true,
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /**
   * Send the magic link email using nodemailer.
   * Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.
   */
  async sendEmail(email, magicUrl) {
    const gmailUser = process.env.GMAIL_USER || process.env.SMTP_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS;

    if (!gmailUser || !gmailPass) {
      console.warn('[MagicLink] No email credentials configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
      console.log(`[MagicLink] Magic link for ${email}: ${magicUrl}`);
      return false;
    }

    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const nodemailer = require('nodemailer');

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });

      await transporter.sendMail({
        from: `"Ace" <${gmailUser}>`,
        to: email,
        subject: 'Your Ace login link',
        html: `
          <div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;color:#1a1a1a">
            <div style="text-align:center;margin-bottom:32px">
              <span style="font-size:24px;color:#C9A96E">♠</span>
              <h1 style="font-size:20px;font-weight:600;margin:8px 0 4px;letter-spacing:0.02em">OPENACE</h1>
            </div>
            <p style="font-size:16px;line-height:1.6;margin-bottom:24px">Click the button below to sign in to your Ace account. This link expires in 15 minutes.</p>
            <div style="text-align:center;margin:32px 0">
              <a href="${magicUrl}" style="display:inline-block;padding:14px 32px;background:#C9A96E;color:#0A0A0A;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">Sign in to Ace</a>
            </div>
            <p style="font-size:13px;color:#888;line-height:1.5">If you didn't request this, you can ignore this email. The link will expire automatically.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
            <p style="font-size:12px;color:#aaa;text-align:center">OpenAce — Find leads. Close deals. Grow your business.</p>
          </div>
        `,
      });

      console.log(`[MagicLink] Email sent to ${email}`);
      return true;
    } catch (e) {
      console.error(`[MagicLink] Failed to send email:`, e.message);
      return false;
    }
  }
}
