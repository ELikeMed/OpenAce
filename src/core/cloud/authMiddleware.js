/**
 * Express auth middleware for cloud mode.
 * Validates Supabase JWT tokens and attaches user to req.
 * In local mode (no Supabase configured), all requests pass through.
 */

import { getSupabase, isCloudMode } from './SupabaseClient.js';

export function authMiddleware(req, res, next) {
  // Local mode — no auth required
  if (!isCloudMode()) {
    req.userId = 'local';
    return next();
  }

  // Cloud mode — validate JWT
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    // Allow unauthenticated access to public routes
    if (isPublicRoute(req.path)) {
      req.userId = null;
      return next();
    }
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ success: false, error: 'Auth not configured' });
  }

  supabase.auth.getUser(token)
    .then(({ data, error }) => {
      if (error || !data.user) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token' });
      }
      req.userId = data.user.id;
      req.userEmail = data.user.email;
      next();
    })
    .catch(() => {
      res.status(401).json({ success: false, error: 'Token validation failed' });
    });
}

// Auth API routes — signup, login, logout, password reset
export function authRoutes(app) {
  const supabase = getSupabase();
  if (!supabase) return;

  app.post('/api/auth/signup', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ success: false, error: 'Email and password required' });
    }
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true, data: { user: data.user, session: data.session } });
  });

  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.json({ success: false, error: 'Email and password required' });
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true, data: { user: data.user, session: data.session } });
  });

  app.post('/api/auth/logout', async (req, res) => {
    await supabase.auth.signOut();
    res.json({ success: true });
  });

  app.get('/api/auth/user', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.json({ success: false, error: 'Not authenticated' });
    }
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error) return res.json({ success: false, error: error.message });
    res.json({ success: true, data: { user: data.user } });
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.json({ success: false, error: 'Email required' });
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return res.json({ success: false, error: error.message });
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
