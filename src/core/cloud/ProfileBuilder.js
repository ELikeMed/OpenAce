/**
 * ProfileBuilder — Extracts user profile data from chat conversations.
 *
 * Watches for name, email, website, business type, and location
 * in the conversation flow. When enough data is collected (at minimum
 * an email), auto-creates their account.
 *
 * The conversation IS the signup. No forms. No buttons.
 */

import { getDatabase } from './CloudDatabase.js';
import { isCloudMode } from './SupabaseClient.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'openace-dev-secret-change-in-production';

// Patterns to extract data from messages
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const WEBSITE_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i;
const NAME_INDICATORS = /\b(?:my name is|i'm|i am|call me|it's|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;

export class ProfileBuilder {
  constructor() {
    this.sessions = new Map(); // sessionId → { profile, messages }
  }

  /**
   * Process a user message and extract profile data.
   * Returns { profileUpdated, accountCreated, token, profile }
   */
  processMessage(sessionId, userMessage, aceResponse) {
    if (!isCloudMode()) return { profileUpdated: false };

    // Get or create session profile
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, {
        profile: { name: null, email: null, website: null, business: null, industry: null, location: null },
        messageCount: 0,
        accountCreated: false,
      });
    }

    const session = this.sessions.get(sessionId);
    session.messageCount++;
    const profile = session.profile;
    let updated = false;

    // Extract email
    const emailMatch = userMessage.match(EMAIL_REGEX);
    if (emailMatch && !profile.email) {
      profile.email = emailMatch[0].toLowerCase();
      updated = true;
    }

    // Extract website
    const websiteMatch = userMessage.match(WEBSITE_REGEX);
    if (websiteMatch && !profile.website) {
      const domain = websiteMatch[0];
      profile.website = domain.startsWith('http') ? domain : `https://${domain}`;
      updated = true;
    }

    // Extract name
    const nameMatch = userMessage.match(NAME_INDICATORS);
    if (nameMatch && !profile.name) {
      profile.name = nameMatch[1].trim();
      updated = true;
    }
    // Also check if the message is just a first name (1-2 words, capitalized, short)
    if (!profile.name && userMessage.length < 30) {
      const words = userMessage.trim().split(/\s+/);
      if (words.length <= 2 && words.every(w => /^[A-Z][a-z]+$/.test(w))) {
        profile.name = userMessage.trim();
        updated = true;
      }
    }

    // Extract business description (from early messages)
    if (!profile.business && session.messageCount <= 3 && userMessage.length > 10 && userMessage.length < 200) {
      // Skip if it looks like a question or command
      if (!userMessage.includes('?') && !/^(find|search|help|can you|what|how|show)/i.test(userMessage)) {
        profile.business = userMessage.trim();
        updated = true;
      }
    }

    // Auto-create account when we have an email
    let accountCreated = false;
    let token = null;

    if (profile.email && !session.accountCreated) {
      const result = this._createAccount(profile, sessionId);
      if (result) {
        session.accountCreated = true;
        accountCreated = true;
        token = result.token;
      }
    }

    return {
      profileUpdated: updated,
      accountCreated,
      token,
      profile: { ...profile },
    };
  }

  /**
   * Get the current profile for a session.
   */
  getProfile(sessionId) {
    return this.sessions.get(sessionId)?.profile || null;
  }

  /**
   * Create an account from the collected profile data.
   */
  _createAccount(profile, sessionId) {
    try {
      const db = getDatabase();

      // Check if account already exists
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(profile.email);
      if (existing) {
        // User exists — just issue a token (they're returning)
        const token = jwt.sign({ userId: existing.id, email: profile.email }, JWT_SECRET, { expiresIn: '30d' });
        return { token, userId: existing.id, isNew: false };
      }

      // Create new account
      const userId = crypto.randomUUID();
      // Generate a random password (user never sees it — they use magic link to return)
      const tempPassword = crypto.randomBytes(32).toString('hex');
      const passwordHash = bcrypt.hashSync(tempPassword, 10);

      db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
        .run(userId, profile.email, passwordHash, profile.name || '');

      // Create their business profile
      if (profile.business || profile.website) {
        const bizId = crypto.randomUUID();
        db.prepare('INSERT INTO businesses (id, user_id, name, website, industry, is_active) VALUES (?, ?, ?, ?, ?, 1)')
          .run(bizId, userId, profile.business || profile.name || 'My Business', profile.website || '', profile.industry || '');
      }

      // Create trial credits
      db.prepare("INSERT INTO credits (user_id, plan, total, trial_start) VALUES (?, 'trial', 0, datetime('now'))")
        .run(userId);

      const token = jwt.sign({ userId, email: profile.email }, JWT_SECRET, { expiresIn: '30d' });

      console.log(`[ProfileBuilder] Account created for ${profile.email} (${profile.name || 'unnamed'})`);

      return { token, userId, isNew: true };
    } catch (e) {
      console.error(`[ProfileBuilder] Account creation failed:`, e.message);
      return null;
    }
  }
}
