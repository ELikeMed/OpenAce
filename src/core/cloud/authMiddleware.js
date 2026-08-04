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

export function authMiddleware(req, res, next) {
  // Local mode — no auth
  if (!isCloudMode()) {
    req.userId = 'local';
    return next();
  }

  // Public routes — no auth required
  if (isPublicRoute(req.path)) {
    req.userId = null;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  try {
    const token = authHeader.slice(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
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

const PUBLIC_ROUTES = [
  '/api/auth/',
  '/api/onboarding-status',
  '/forms/',
  '/health',
];

function isPublicRoute(path) {
  return PUBLIC_ROUTES.some(r => path.startsWith(r));
}
