/**
 * identity.js — Resolves every request to a stable, isolated owner.
 *
 * The rule: NOTHING reads or writes data without an ownerId.
 *
 *   Logged in  → ownerId = JWT userId          (durable, survives devices)
 *   Anonymous  → ownerId = anon_<uuid>          (signed httpOnly cookie)
 *
 * Replaces the old IP+User-Agent fingerprint, which collided: two visitors
 * behind the same NAT running the same browser hashed to the SAME bucket
 * and saw each other's conversations.
 *
 * The cookie is HMAC-signed so a client can't hand us someone else's
 * ownerId by editing it.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { isCloudMode } from './SupabaseClient.js';
import { DatabaseAdapter, isProvisionalEmail } from './DatabaseAdapter.js';
import { getDatabase } from './CloudDatabase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'openace-dev-secret-change-in-production';
const COOKIE_NAME = 'ace_sid';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — anonymous work must survive a return visit

/** HMAC a value so we can detect tampering. */
function sign(value) {
  return crypto.createHmac('sha256', JWT_SECRET).update(value).digest('base64url');
}

/** Verify a `value.signature` cookie payload, returning the value or null. */
function unsign(signed) {
  if (!signed || typeof signed !== 'string') return null;
  const idx = signed.lastIndexOf('.');
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);
  const expected = sign(value);
  // Constant-time compare — lengths must match first or timingSafeEqual throws
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return value;
}

/** Minimal cookie header parser — avoids adding cookie-parser to a live server. */
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

function setOwnerCookie(res, ownerId) {
  const signed = `${ownerId}.${sign(ownerId)}`;
  const attrs = [
    `${COOKIE_NAME}=${encodeURIComponent(signed)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${COOKIE_MAX_AGE}`,
  ];
  // Secure only makes sense over TLS; app.openaceai.com is HTTPS via the tunnel
  if (process.env.OPENACE_INSECURE_COOKIES !== 'true') attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

/**
 * The provisional-account row is created lazily by DatabaseAdapter on its first
 * write, not here. Creating one per request meant every bot and uptime check
 * left a throwaway account behind.
 */
export function ensureProvisionalUser(ownerId) {
  return new DatabaseAdapter(ownerId)._ensureOwnerRow() ?? true;
}

/**
 * Resolve req.ownerId, req.isAuthed, req.userId, req.userEmail and req.data.
 * Mount BEFORE any route that touches data.
 */
export function identityMiddleware(req, res, next) {
  // Local desktop mode — single user, everything belongs to 'local'
  if (!isCloudMode()) {
    req.ownerId = 'local';
    req.isAuthed = true;
    req.userId = 'local';
    req.data = new DatabaseAdapter('local');
    return next();
  }

  // 1. Bearer token wins — a real, logged-in account
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
      req.ownerId = decoded.userId;
      req.userId = decoded.userId;
      req.userEmail = decoded.email;
      req.isAuthed = true;
      req.data = new DatabaseAdapter(req.ownerId);
      return next();
    } catch {
      // Fall through to anonymous — an expired token shouldn't wipe their session
    }
  }

  // 2. Anonymous — stable identity from a signed cookie
  const cookies = parseCookies(req.headers.cookie);
  let ownerId = unsign(cookies[COOKIE_NAME]);

  // Only accept anon_* ids from the cookie. A signed cookie carrying a real
  // userId would otherwise let a stale cookie impersonate an account.
  if (!ownerId || !ownerId.startsWith('anon_')) {
    ownerId = `anon_${crypto.randomUUID()}`;
    setOwnerCookie(res, ownerId);
  }

  req.ownerId = ownerId;
  req.userId = null;
  req.isAuthed = false;
  req.data = new DatabaseAdapter(ownerId);
  next();
}

/**
 * Promote an anonymous visitor to a real account, carrying their work with them.
 * Called the moment ProfileBuilder has enough to activate an account mid-chat.
 */
export function promoteAnonymousOwner(anonId, userId) {
  if (!isCloudMode() || !anonId?.startsWith('anon_') || !userId || anonId === userId) return false;

  const adapter = new DatabaseAdapter(userId);
  const moved = adapter.reassignOwner(anonId, userId);

  // Retire the placeholder account now that nothing points at it. Only ever
  // touches a row that still has a provisional email — never a real account.
  if (moved) {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT email FROM users WHERE id = ?').get(anonId);
      if (row && isProvisionalEmail(row.email)) {
        db.prepare('DELETE FROM users WHERE id = ?').run(anonId);
      }
    } catch (e) {
      console.error('[identity] could not retire provisional user:', e.message);
    }
  }
  return moved;
}

/** Issue the auth cookie for a freshly authenticated user (clears the anon id). */
export function clearAnonymousCookie(res) {
  res.append('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

export { COOKIE_NAME, isProvisionalEmail };
