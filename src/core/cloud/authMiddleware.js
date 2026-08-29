/**
 * Express auth middleware — JWT + bcrypt.
 * Zero external dependencies (no Supabase, no Firebase).
 *
 * In local mode (OPENACE_CLOUD !== 'true'), all requests pass through.
 * In cloud mode, validates JWT tokens and attaches userId to req.
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { isCloudMode } from './SupabaseClient.js';
import { getDatabase } from './CloudDatabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'openace-dev-secret-change-in-production';
const JWT_EXPIRES = '30d';

// Admin emails — full access to all tools, settings, data
const ADMIN_EMAILS = new Set([
  'openaceai@gmail.com',
  'likemindedpro@gmail.com',
]);

export function isAdmin(email) {
  return ADMIN_EMAILS.has(email?.toLowerCase());
}

export function authMiddleware(req, res, next) {
  // Local mode — no auth
  if (!isCloudMode()) {
    req.userId = 'local';
    return next();
  }

  // identityMiddleware runs first and has already resolved req.ownerId /
  // req.isAuthed (JWT if present, otherwise a signed anonymous cookie).

  // Anonymous visitors may reach a small, explicit set of routes. Everything
  // else requires a real account. Deny by default — a new route is private
  // until someone deliberately adds it here.
  if (isAnonAllowed(req.originalUrl || req.path)) return next();

  if (!req.isAuthed) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  next();
}

export function authRoutes(app) {
  // Signup
  app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.json({ success: false, error: 'Email and password required' });
    }
    if (password.length < 6) {
      return res.json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const db = getDatabase();

    // Check if email already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.json({ success: false, error: 'An account with this email already exists' });
    }

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);

    db.prepare('INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)')
      .run(userId, email.toLowerCase(), passwordHash, name || '');

    // Create default credits (trial)
    db.prepare('INSERT INTO credits (user_id, plan, total, trial_start) VALUES (?, ?, ?, datetime(\'now\'))')
      .run(userId, 'trial', 0);

    const token = jwt.sign({ userId, email: email.toLowerCase() }, JWT_SECRET, { expiresIn: JWT_EXPIRES });

    res.json({
      success: true,
      data: {
        user: { id: userId, email: email.toLowerCase(), name },
        token,
      },
    });
  });

  // Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ success: false, error: 'Email and password required' });
    }

    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) {
      return res.json({ success: false, error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      success: true,
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        token,
      },
    });
  });

  // Get current user
  app.get('/api/auth/user', (req, res) => {
    if (!req.userId) {
      return res.json({ success: false, error: 'Not authenticated' });
    }
    const db = getDatabase();
    const user = db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { user } });
  });

  // Logout (client-side — just discard the token)
  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });
}

/**
 * Routes an anonymous visitor may reach.
 *
 * DENY BY DEFAULT — anything not listed here needs a real account. Adding a
 * route to this list makes it reachable by the entire internet, so the bar is:
 * "a first-time visitor genuinely cannot use the product without it."
 *
 * Anonymous requests still get their own isolated data bucket via the signed
 * ace_sid cookie, so "public" here means "no login required", NOT "shared".
 */
const ANON_ALLOWED = [
  '/api/auth/',            // signup, login, magic link — the way in
  '/api/chat',             // talking to Ace IS the onboarding
  '/api/chat-stream',
  '/api/conversations',    // their own chat history (cookie-scoped)
  '/api/onboarding-status',
  '/api/me',               // the caller's own identity only — scoped to req.ownerId
  '/api/usage',            // free-message counter for the trial
  '/api/events',           // SSE stream that backs chat
  '/api/feedback',         // anyone may report a problem
  '/api/billing/webhook',  // Stripe calls this; verified by signature, not JWT
  '/api/speak',            // reading a reply aloud, for visitors as well as accounts
  '/api/attachments/',     // reading a document attached to a message, same as chat itself
  '/api/documents/',       // a generated file — the route itself checks it belongs to the caller
  '/forms/',               // the rendered public form page
  '/health',
];

// Exceptions a prefix cannot express. Deliberately narrow: this opens the submit endpoint
// of one form and nothing else. '/api/forms/' as a prefix would also expose the form list
// and every submission, which are the operator's data.
//
// Without this a published form rendered fine to the open web and then rejected every
// submission with 401, so the form looked like it worked and captured nothing.
const ANON_ALLOWED_PATTERNS = [
  /^\/api\/forms\/[A-Za-z0-9_-]+\/submit$/,
];

function isAnonAllowed(path) {
  // Compare against the path only — a query string must never widen access
  const clean = (path || '').split('?')[0];
  if (ANON_ALLOWED.some(r => clean === r || clean.startsWith(r.endsWith('/') ? r : r + '/') || clean === r)) return true;
  return ANON_ALLOWED_PATTERNS.some(re => re.test(clean));
}
