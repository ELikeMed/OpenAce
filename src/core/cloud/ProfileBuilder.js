/**
 * ProfileBuilder — Builds a user profile out of ordinary conversation.
 *
 * The conversation IS the signup. Ace never blocks on "give me your name
 * before we continue" — the visitor asks whatever they want, and we pick up
 * name / email / business / website as they naturally mention them.
 *
 * When we have enough, the account activates silently in the background and
 * everything they already did comes with them. Next visit, they're known.
 *
 * Keyed on ownerId (from identityMiddleware) and persisted to SQLite, so a
 * server restart no longer forgets who someone is.
 */

import { getDatabase } from './CloudDatabase.js';
import { isCloudMode } from './SupabaseClient.js';
import { ProfileScraper } from './ProfileScraper.js';
import { MagicLink } from './MagicLink.js';
import { promoteAnonymousOwner, isProvisionalEmail } from './identity.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const JWT_SECRET = process.env.JWT_SECRET || 'openace-dev-secret-change-in-production';

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const WEBSITE_REGEX = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?)/i;
// Two parts on purpose. The lead-in is matched case-insensitively, but the name
// itself must be matched case-SENSITIVELY — a single /i regex makes [A-Z] match
// lowercase too, which turned "I'm Sam and I run a shop" into the name "Sam and".
const NAME_LEAD_IN = /\b(?:my name is|i'm|i am|call me|this is)\s+/i;
const NAME_CAPTURE = /^([A-Z][a-z'-]+(?:\s+[A-Z][a-z'-]+)?)/;
const BUSINESS_INDICATORS = /\b(?:my (?:business|company|firm|agency|shop|practice) is(?: called)?|we(?:'re| are) called|business name is|company is(?: called)?)\s+([A-Z][\w&'.-]*(?:\s+[A-Z]?[\w&'.-]+){0,3})/i;

// Words that look like names to a regex but aren't. "Hi" and "Hey" got saved
// as real user names before this list existed.
const NOT_A_NAME = new Set([
  'hi', 'hey', 'hello', 'yo', 'sup', 'yes', 'no', 'ok', 'okay', 'sure', 'yeah', 'yep', 'nope',
  'thanks', 'thank', 'bye', 'goodbye', 'morning', 'afternoon', 'evening', 'night',
  'good', 'great', 'cool', 'nice', 'awesome', 'perfect', 'done', 'test', 'testing',
  'help', 'stop', 'wait', 'maybe', 'please', 'sorry', 'here', 'there', 'what', 'who', 'how',
  'and', 'but', 'the', 'a', 'an', 'just', 'still', 'also', 'from', 'with',
]);

function looksLikeName(candidate) {
  if (!candidate) return false;
  const trimmed = candidate.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return false;
  // Every word must be alphabetic and not a filler word
  return trimmed.split(/\s+/).every(w => /^[A-Za-z][a-z'-]*$/.test(w) && !NOT_A_NAME.has(w.toLowerCase()));
}

export class ProfileBuilder {
  constructor() {
    if (isCloudMode()) this._ensureTable();
  }

  _ensureTable() {
    try {
      getDatabase().exec(`
        CREATE TABLE IF NOT EXISTS visitor_profiles (
          owner_id TEXT PRIMARY KEY,
          name TEXT, email TEXT, website TEXT, business TEXT,
          industry TEXT, location TEXT, phone TEXT,
          message_count INTEGER DEFAULT 0,
          account_created INTEGER DEFAULT 0,
          user_id TEXT,
          updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_visitor_email ON visitor_profiles(email);
      `);
    } catch (e) {
      console.error('[ProfileBuilder] table init failed:', e.message);
    }
  }

  _load(ownerId) {
    const row = getDatabase().prepare('SELECT * FROM visitor_profiles WHERE owner_id = ?').get(ownerId);
    if (row) return row;
    getDatabase().prepare('INSERT INTO visitor_profiles (owner_id) VALUES (?)').run(ownerId);
    return getDatabase().prepare('SELECT * FROM visitor_profiles WHERE owner_id = ?').get(ownerId);
  }

  _save(ownerId, p) {
    getDatabase().prepare(`
      UPDATE visitor_profiles SET
        name=?, email=?, website=?, business=?, industry=?, location=?, phone=?,
        message_count=?, account_created=?, user_id=?, updated_at=datetime('now')
      WHERE owner_id = ?
    `).run(p.name, p.email, p.website, p.business, p.industry, p.location, p.phone,
      p.message_count, p.account_created, p.user_id, ownerId);
  }

  /**
   * Read a message for profile signals. Never blocks the conversation —
   * whatever we learn, we learn; whatever we don't, we ask for later, in context.
   *
   * Returns { profileUpdated, accountCreated, token, profile }.
   */
  processMessage(ownerId, userMessage, aceResponse) {
    if (!isCloudMode() || !ownerId) return { profileUpdated: false };

    let p;
    try {
      p = this._load(ownerId);
    } catch (e) {
      console.error('[ProfileBuilder] load failed:', e.message);
      return { profileUpdated: false };
    }

    p.message_count = (p.message_count || 0) + 1;
    const msg = (userMessage || '').trim();
    let updated = false;

    // ── Email ──
    const emailMatch = msg.match(EMAIL_REGEX);
    if (emailMatch && !p.email) {
      p.email = emailMatch[0].toLowerCase();
      updated = true;
    }

    // ── Name ──
    if (!p.name) {
      const leadIn = msg.match(NAME_LEAD_IN);
      const after = leadIn ? msg.slice(leadIn.index + leadIn[0].length) : null;
      const nameMatch = after ? after.match(NAME_CAPTURE) : null;
      if (nameMatch && looksLikeName(nameMatch[1])) {
        p.name = nameMatch[1].trim();
        updated = true;
      } else if (msg.length < 30) {
        // A bare "Eric" in reply to "what should I call you?"
        const words = msg.replace(/[.!,]/g, '').split(/\s+/);
        if (words.length <= 2 && looksLikeName(words.join(' ')) && /^[A-Z]/.test(msg)) {
          p.name = words.join(' ');
          updated = true;
        }
      }
    }

    // ── Business name ──
    if (!p.business) {
      const bizMatch = msg.match(BUSINESS_INDICATORS);
      if (bizMatch) {
        p.business = bizMatch[1].trim();
        updated = true;
      }
    }

    // ── Website (and background scrape to fill the rest) ──
    const websiteMatch = msg.match(WEBSITE_REGEX);
    if (websiteMatch && !p.website && !emailMatch) {
      const domain = websiteMatch[0];
      p.website = domain.startsWith('http') ? domain : `https://${domain}`;
      updated = true;
      this._scrapeInBackground(ownerId, p.website);
    }

    // ── What they do (free-text description from early messages) ──
    if (!p.industry && p.message_count <= 4 && msg.length > 15 && msg.length < 300) {
      if (!msg.includes('?') && !/^(find|search|help|can you|what|how|show|give|make)/i.test(msg)) {
        p.industry = msg;
        updated = true;
      }
    }

    // ── Activation ──
    // Email is required (it's how they get back in). We also want at least a
    // name or a business so the account means something rather than being a
    // bare address. Everything else keeps filling in afterwards.
    let accountCreated = false;
    let token = null;

    if (p.email && !p.account_created && (p.name || p.business || this._emailHasAccount(p.email))) {
      const result = this._createAccount(p, ownerId);
      if (result) {
        p.account_created = 1;
        p.user_id = result.userId;
        accountCreated = true;
        token = result.token;
      }
    }

    try {
      this._save(ownerId, p);
    } catch (e) {
      console.error('[ProfileBuilder] save failed:', e.message);
    }

    return {
      profileUpdated: updated,
      accountCreated,
      token,
      profile: this._shape(p),
    };
  }

  _scrapeInBackground(ownerId, website) {
    new ProfileScraper().scrape(website).then(scraped => {
      if (!scraped) return;
      const p = this._load(ownerId);
      if (scraped.businessName && !p.business) p.business = scraped.businessName;
      if (scraped.industry && !p.industry) p.industry = scraped.industry;
      if (scraped.location && !p.location) p.location = scraped.location;
      if (scraped.email && !p.email) p.email = scraped.email;
      if (scraped.phone && !p.phone) p.phone = scraped.phone;

      if (p.email && !p.account_created && (p.name || p.business)) {
        const result = this._createAccount(p, ownerId);
        if (result) { p.account_created = 1; p.user_id = result.userId; }
      }
      this._save(ownerId, p);
      console.log(`[ProfileBuilder] scraped ${website} → business=${p.business}, location=${p.location}`);
    }).catch(() => {});
  }

  _shape(p) {
    return {
      name: p.name, email: p.email, website: p.website, business: p.business,
      industry: p.industry, location: p.location, phone: p.phone,
    };
  }

  /**
   * Does a real (activated) account already use this email?
   *
   * A returning visitor who just types their address should be logged straight
   * back in — we already know their name, so there's no reason to ask again.
   */
  _emailHasAccount(email) {
    if (!email) return false;
    try {
      const row = getDatabase().prepare('SELECT id, email FROM users WHERE email = ?').get(email.toLowerCase());
      return !!row && !isProvisionalEmail(row.email);
    } catch { return false; }
  }

  /** What we already know about this owner — powers the "welcome back" greeting. */
  getProfile(ownerId) {
    if (!isCloudMode() || !ownerId) return null;
    try {
      const row = getDatabase().prepare('SELECT * FROM visitor_profiles WHERE owner_id = ?').get(ownerId);
      return row ? this._shape(row) : null;
    } catch { return null; }
  }

  /**
   * Create the account and move the visitor's existing work onto it.
   */
  _createAccount(profile, ownerId) {
    try {
      const db = getDatabase();
      const email = profile.email.toLowerCase();

      const byEmail = db.prepare('SELECT id, name FROM users WHERE email = ?').get(email);
      const provisional = ownerId
        ? db.prepare('SELECT id, email FROM users WHERE id = ?').get(ownerId)
        : null;

      // ── Returning user: an account with this email already exists ──
      if (byEmail && byEmail.id !== ownerId) {
        // Fold this session's work into the account they already have, then
        // retire the provisional row so it doesn't linger.
        promoteAnonymousOwner(ownerId, byEmail.id);
        if (provisional && isProvisionalEmail(provisional.email)) {
          try { db.prepare('DELETE FROM users WHERE id = ?').run(ownerId); } catch { /* rows moved already */ }
        }
        const token = jwt.sign({ userId: byEmail.id, email }, JWT_SECRET, { expiresIn: '30d' });
        console.log(`[ProfileBuilder] recognized returning user ${email}`);
        return { token, userId: byEmail.id, isNew: false };
      }

      // ── Activation in place: fill in the provisional row this visitor
      //    already owns. Nothing has to move — their data is attached to it.
      let userId;
      if (provisional && isProvisionalEmail(provisional.email)) {
        db.prepare("UPDATE users SET email = ?, name = ?, updated_at = datetime('now') WHERE id = ?")
          .run(email, profile.name || '', ownerId);
        userId = ownerId;
      } else if (byEmail) {
        userId = byEmail.id; // already activated on an earlier message
      } else {
        // No provisional row (e.g. a non-HTTP caller) — create a fresh account.
        userId = crypto.randomUUID();
        db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
          .run(userId, email, bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10), profile.name || '');
        promoteAnonymousOwner(ownerId, userId);
      }

      if (profile.business || profile.website) {
        const hasBiz = db.prepare('SELECT id FROM businesses WHERE user_id = ? LIMIT 1').get(userId);
        if (!hasBiz) {
          db.prepare('INSERT INTO businesses (id, user_id, name, website, industry, is_active) VALUES (?, ?, ?, ?, ?, 1)')
            .run(crypto.randomUUID(), userId, profile.business || 'My Business',
              profile.website || '', profile.industry || '');
        }
      }

      const hasCredits = db.prepare('SELECT user_id FROM credits WHERE user_id = ?').get(userId);
      if (!hasCredits) {
        db.prepare("INSERT INTO credits (user_id, plan, total, trial_start) VALUES (?, 'trial', 0, datetime('now'))")
          .run(userId);
      }

      const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: '30d' });

      // Email them a way back in
      const ml = new MagicLink();
      ml.sendEmail(email, ml.generateLink(email)).catch(() => {});

      console.log(`[ProfileBuilder] account activated for ${email} (${profile.name || 'unnamed'})`);
      return { token, userId, isNew: true };
    } catch (e) {
      console.error('[ProfileBuilder] account creation failed:', e.message);
      return null;
    }
  }
}
