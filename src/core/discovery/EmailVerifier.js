/**
 * EmailVerifier — DIY email verification using DNS + SMTP checks
 *
 * Tier 1: Syntax, disposable domain, role-based address (instant, no network)
 * Tier 2: MX record lookup via DNS (fast, reliable)
 * Tier 3: SMTP RCPT TO check (best-effort, may be blocked on Cloud Run)
 *
 * Returns: { status: 'valid'|'invalid'|'risky'|'unknown', reason, checkedAt }
 */

import dns from 'dns/promises';
import net from 'net';

// Common disposable email providers
const DISPOSABLE_DOMAINS = new Set([
  'guerrillamail.com', 'guerrillamailblock.com', 'mailinator.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', 'sharklasers.com', 'guerrillamail.info',
  'grr.la', 'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net',
  'guerrillamail.org', 'temp-mail.org', 'tempail.com', 'dispostable.com',
  'mailnesia.com', 'maildrop.cc', 'trashmail.com', 'trashmail.me',
  'trashmail.net', 'fakeinbox.com', 'getnada.com', 'emailondeck.com',
  'tempinbox.com', 'burnermail.io', 'inboxbear.com', 'mohmal.com',
  'minutemail.com', 'tempr.email', 'discard.email', 'harakirimail.com',
  'mailcatch.com', 'jetable.org', 'mytemp.email', 'trash-mail.com',
  'mailsac.com', 'incognitomail.org', 'spamgourmet.com', '10minutemail.com',
  'guerrillamail.xyz', 'crazymailing.com', 'armyspy.com', 'dayrep.com',
  'einrot.com', 'fleckens.hu', 'jourrapide.com', 'rhyta.com',
  'superrito.com', 'teleworm.us',
]);

// Role-based addresses — real but poor outreach targets
const ROLE_PREFIXES = new Set([
  'info', 'noreply', 'no-reply', 'admin', 'support', 'sales', 'hello',
  'contact', 'office', 'help', 'billing', 'webmaster', 'postmaster',
  'abuse', 'security', 'marketing', 'press', 'media', 'team', 'careers',
  'jobs', 'hr', 'legal', 'feedback', 'newsletter', 'subscribe', 'unsubscribe',
  'donotreply', 'do-not-reply', 'mailer-daemon', 'root', 'hostmaster',
]);

// Cache TTL: 24 hours
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export class EmailVerifier {
  constructor(options = {}) {
    this.smtpEnabled = options.smtpEnabled ?? true;
    this.smtpTimeout = options.smtpTimeout ?? 5000;
    this.cache = new Map();
  }

  /**
   * Verify an email address. Returns cached result if available.
   */
  async verify(email) {
    if (!email) return { status: 'invalid', reason: 'Empty email', checkedAt: new Date().toISOString() };

    const normalized = email.toLowerCase().trim();

    // Check cache
    const cached = this.cache.get(normalized);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.result;
    }

    const result = await this._verify(normalized);

    // Cache the result
    this.cache.set(normalized, { result, expiresAt: Date.now() + CACHE_TTL_MS });

    // Prune cache if it gets too large
    if (this.cache.size > 5000) {
      const now = Date.now();
      for (const [key, val] of this.cache) {
        if (now > val.expiresAt) this.cache.delete(key);
      }
    }

    return result;
  }

  async _verify(email) {
    const checkedAt = new Date().toISOString();

    // --- Tier 1: Instant checks ---
    const syntaxResult = this._checkSyntax(email);
    if (syntaxResult) return { status: 'invalid', reason: syntaxResult, checkedAt };

    const [local, domain] = email.split('@');

    if (DISPOSABLE_DOMAINS.has(domain)) {
      return { status: 'invalid', reason: 'Disposable email domain', checkedAt };
    }

    if (ROLE_PREFIXES.has(local.toLowerCase())) {
      return { status: 'risky', reason: `Role-based address (${local}@)`, checkedAt };
    }

    // --- Tier 2: DNS checks ---
    let mxRecords;
    try {
      mxRecords = await dns.resolveMx(domain);
    } catch {
      // No MX records — try A record as fallback
      try {
        await dns.resolve4(domain);
        // Domain exists but no MX — risky (some hosts accept email via A record)
        return { status: 'risky', reason: 'Domain has no MX records (A record only)', checkedAt };
      } catch {
        return { status: 'invalid', reason: 'Domain does not exist', checkedAt };
      }
    }

    if (!mxRecords || mxRecords.length === 0) {
      return { status: 'risky', reason: 'Domain has no MX records', checkedAt };
    }

    // Sort MX records by priority (lowest = highest priority)
    mxRecords.sort((a, b) => a.priority - b.priority);
    const mxHost = mxRecords[0].exchange;

    // --- Tier 3: SMTP check (best effort) ---
    if (this.smtpEnabled) {
      try {
        const smtpResult = await this._checkSMTP(email, mxHost);
        return { status: smtpResult.status, reason: smtpResult.reason, checkedAt };
      } catch {
        // SMTP check failed (port blocked, timeout, etc.) — DNS passed so mark unknown
        return { status: 'unknown', reason: 'DNS valid, SMTP check unavailable', checkedAt };
      }
    }

    // SMTP disabled — DNS passed, mark as unknown (we know the domain is real)
    return { status: 'unknown', reason: 'DNS valid, SMTP check disabled', checkedAt };
  }

  /**
   * Tier 1: Syntax validation
   */
  _checkSyntax(email) {
    if (!email || typeof email !== 'string') return 'Not a string';
    if (!email.includes('@')) return 'Missing @ symbol';

    const parts = email.split('@');
    if (parts.length !== 2) return 'Multiple @ symbols';

    const [local, domain] = parts;
    if (!local || local.length === 0) return 'Empty local part';
    if (!domain || domain.length === 0) return 'Empty domain';
    if (!domain.includes('.')) return 'Domain missing TLD';

    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return 'Invalid TLD';

    // Basic format check
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return 'Invalid email format';
    }

    return null; // Valid syntax
  }

  /**
   * Tier 3: SMTP RCPT TO check
   */
  async _checkSMTP(email, mxHost) {
    // First, check if domain is catch-all (accepts everything)
    const catchAll = await this._isCatchAll(mxHost);
    if (catchAll) {
      return { status: 'unknown', reason: 'Catch-all domain (accepts all addresses)' };
    }

    return new Promise((resolve, reject) => {
      const socket = net.createConnection(25, mxHost);
      let step = 0;
      let response = '';

      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('SMTP timeout'));
      }, this.smtpTimeout);

      socket.setEncoding('utf8');

      socket.on('data', (data) => {
        response += data;

        if (step === 0 && response.includes('220')) {
          // Server ready — send EHLO
          step = 1;
          response = '';
          socket.write('EHLO verify.local\r\n');
        } else if (step === 1 && response.includes('250')) {
          // EHLO accepted — send MAIL FROM
          step = 2;
          response = '';
          socket.write('MAIL FROM:<verify@revenueengine.app>\r\n');
        } else if (step === 2 && response.includes('250')) {
          // MAIL FROM accepted — send RCPT TO (the actual check)
          step = 3;
          response = '';
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (step === 3) {
          clearTimeout(timeout);
          socket.write('QUIT\r\n');
          socket.end();

          if (response.includes('250')) {
            resolve({ status: 'valid', reason: 'SMTP verified (mailbox exists)' });
          } else if (response.includes('550') || response.includes('551') || response.includes('553')) {
            resolve({ status: 'invalid', reason: 'SMTP rejected (mailbox does not exist)' });
          } else if (response.includes('452') || response.includes('421')) {
            // Temporary error — don't mark invalid
            resolve({ status: 'unknown', reason: 'SMTP temporary error' });
          } else {
            resolve({ status: 'unknown', reason: `SMTP ambiguous response: ${response.substring(0, 50)}` });
          }
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        reject(new Error('SMTP connection error'));
      });

      socket.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * Detect catch-all domains by testing a random address
   */
  async _isCatchAll(mxHost) {
    const randomEmail = `definitely-not-real-${Date.now()}@test.local`;

    return new Promise((resolve) => {
      const socket = net.createConnection(25, mxHost);
      let step = 0;
      let response = '';

      const timeout = setTimeout(() => {
        socket.destroy();
        resolve(false); // Can't determine — assume not catch-all
      }, this.smtpTimeout);

      socket.setEncoding('utf8');

      socket.on('data', (data) => {
        response += data;

        if (step === 0 && response.includes('220')) {
          step = 1;
          response = '';
          socket.write('EHLO verify.local\r\n');
        } else if (step === 1 && response.includes('250')) {
          step = 2;
          response = '';
          socket.write('MAIL FROM:<verify@revenueengine.app>\r\n');
        } else if (step === 2 && response.includes('250')) {
          step = 3;
          response = '';
          // Test with clearly fake address
          socket.write(`RCPT TO:<${randomEmail}>\r\n`);
        } else if (step === 3) {
          clearTimeout(timeout);
          socket.write('QUIT\r\n');
          socket.end();
          // If server accepts a random address, it's catch-all
          resolve(response.includes('250'));
        }
      });

      socket.on('error', () => {
        clearTimeout(timeout);
        resolve(false);
      });

      socket.on('close', () => {
        clearTimeout(timeout);
      });
    });
  }
}
