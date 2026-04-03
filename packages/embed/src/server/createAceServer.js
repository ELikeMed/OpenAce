/**
 * createAceServer — One-line server setup for the OpenAce embeddable SDK.
 *
 * IMPORTANT: Ace is admin-only. Public visitors should NEVER see the widget.
 * Use `auth` or `adminSecret` to protect all routes.
 *
 * Zero-config usage (auto-detects API keys from environment):
 *   import { createAceServer } from '@openace/embed/server';
 *   export default createAceServer({ licenseKey: process.env.OPENACE_LICENSE_KEY });
 *
 * Explicit keys:
 *   createAceServer({
 *     licenseKey: '...',
 *     ai: { geminiKey: '...', claudeKey: '...' },
 *     adminSecret: process.env.ACE_ADMIN_SECRET,
 *   });
 *
 * Express with custom auth:
 *   app.use('/api/ace', createAceServer({
 *     auth: (req) => req.session?.user?.role === 'admin',
 *   }));
 */

import { EmbedAgent } from './EmbedAgent.js';
import { AceRouter } from './AceRouter.js';
import { LicenseValidator } from './LicenseValidator.js';
import { CronRunner } from './CronRunner.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

let _instance = null; // Singleton — avoid re-initializing on hot reload

// ── Common env var names developers might have ──
const ENV_MAP = {
  gemini: [
    'GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_GEMINI_KEY',
    'GOOGLE_API_KEY', 'GEMINI_KEY',
  ],
  claude: [
    'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'CLAUDE_KEY',
    'ANTHROPIC_KEY',
  ],
  openai: [
    'OPENAI_API_KEY', 'OPENAI_KEY',
  ],
};

/**
 * Auto-detect AI API keys from process.env.
 * Returns { geminiKey, claudeKey, openaiKey, defaultProvider }
 */
function autoDetectKeys() {
  const detected = {};

  for (const [provider, envNames] of Object.entries(ENV_MAP)) {
    for (const envName of envNames) {
      if (process.env[envName]) {
        detected[`${provider}Key`] = process.env[envName];
        break;
      }
    }
  }

  // Pick the best available as default
  if (detected.geminiKey) detected.defaultProvider = 'gemini';
  else if (detected.claudeKey) detected.defaultProvider = 'claude';
  else if (detected.openaiKey) detected.defaultProvider = 'openai';

  return detected;
}

export function createAceServer(config = {}) {
  const {
    licenseKey,
    dataDir = './data/ace',
    ai = {},
    tools = 'all',
    cron = {},
    businessContext = '',
    auth,           // Function: (req) => boolean | Promise<boolean>
    adminSecret,    // String: shared secret (simpler alternative to auth function)
  } = config;

  // ── Merge AI keys: explicit config > auto-detected env vars > proxy fallback ──
  const envKeys = autoDetectKeys();
  const resolvedAI = {
    geminiKey:       ai.geminiKey       || envKeys.geminiKey       || '',
    claudeKey:       ai.claudeKey       || envKeys.claudeKey       || '',
    openaiKey:       ai.openaiKey       || envKeys.openaiKey       || '',
    geminiModel:     ai.geminiModel     || 'gemini-2.5-flash',
    claudeModel:     ai.claudeModel     || 'claude-sonnet-4-20250514',
    openaiModel:     ai.openaiModel     || 'gpt-4o',
    defaultProvider: ai.defaultProvider || envKeys.defaultProvider || 'gemini',
  };

  const hasLocalKey = !!(resolvedAI.geminiKey || resolvedAI.claudeKey || resolvedAI.openaiKey);
  const useProxy = !hasLocalKey && !!licenseKey;

  if (hasLocalKey) {
    const providers = [];
    if (resolvedAI.geminiKey) providers.push('Gemini');
    if (resolvedAI.claudeKey) providers.push('Claude');
    if (resolvedAI.openaiKey) providers.push('OpenAI');
    console.log(`[OpenAce Embed] AI keys detected: ${providers.join(', ')} (default: ${resolvedAI.defaultProvider})`);
  } else if (useProxy) {
    console.log('[OpenAce Embed] No local AI keys found — using OpenAce proxy (via license key)');
  } else {
    console.warn('\n\u26a0\ufe0f  [OpenAce Embed] WARNING: No AI API keys found!');
    console.warn('   Set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY in your .env');
    console.warn('   Or pass keys via: createAceServer({ ai: { geminiKey: "..." } })');
    console.warn('   Or add a licenseKey to use the OpenAce proxy.\n');
  }

  // ── Auth enforcement ──
  if (!auth && !adminSecret) {
    console.warn('\n\u26a0\ufe0f  [OpenAce Embed] WARNING: No auth configured!');
    console.warn('   Anyone who can reach your API can control Ace (send emails, modify leads, etc.).');
    console.warn('   Set `adminSecret` or `auth` in createAceServer() to protect your routes.\n');
  }

  const sessionTokens = new Set();

  async function isAuthorized(req) {
    if (typeof auth === 'function') {
      try { return !!(await auth(req)); } catch { return false; }
    }
    if (adminSecret) {
      const header = req.headers?.['authorization'] || req.headers?.['Authorization'] || '';
      const token = header.replace(/^Bearer\s+/i, '').trim();
      if (!token) return false;
      if (token === adminSecret) return true;
      if (sessionTokens.has(token)) return true;
      return false;
    }
    return true;
  }

  // ── Initialize on first request (lazy) ──
  async function ensureInitialized() {
    if (_instance) return _instance;

    console.log('[OpenAce Embed] Initializing...');

    const absDataDir = path.resolve(dataDir);
    await fs.mkdir(absDataDir, { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'pipeline'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'forms'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'notes'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'projects'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'cron'), { recursive: true });

    // ── AI Provider ──
    let aiManager;
    try {
      if (useProxy) {
        // Proxy mode: AI calls route through OpenAce servers
        const { ProxyAIProvider } = await import('./ProxyAIProvider.js');
        aiManager = new ProxyAIProvider(licenseKey);
      } else {
        const { AIProviderManager } = await import('./subsystems/AIProviderManager.js');
        aiManager = new AIProviderManager(null);

        const aiConfig = {
          ai_providers: {
            active_provider: resolvedAI.defaultProvider,
            providers: {
              gemini: {
                enabled: !!resolvedAI.geminiKey,
                model: resolvedAI.geminiModel,
                api_key: resolvedAI.geminiKey,
                vision_model: resolvedAI.geminiModel,
              },
              claude: {
                enabled: !!resolvedAI.claudeKey,
                model: resolvedAI.claudeModel,
                api_key: resolvedAI.claudeKey,
                vision_model: resolvedAI.claudeModel,
              },
              openai: {
                enabled: !!resolvedAI.openaiKey,
                model: resolvedAI.openaiModel,
                api_key: resolvedAI.openaiKey,
                vision_model: resolvedAI.openaiModel,
              },
            }
          }
        };
        await aiManager.initialize(aiConfig);
      }
    } catch (err) {
      console.error('[OpenAce Embed] AI Provider init failed:', err.message);
      throw new Error(`AI Provider setup failed: ${err.message}. Set an API key in your .env or pass one via config.`);
    }

    // ── Subsystems ──
    const subsystems = {};

    try {
      const { PipelineManager } = await import('./subsystems/PipelineManager.js');
      subsystems.pipelineManager = new PipelineManager(path.join(absDataDir, 'pipeline'));
      await subsystems.pipelineManager.initialize?.();
    } catch (e) {
      console.warn('[OpenAce Embed] PipelineManager not available:', e.message);
    }

    try {
      const { ContactManager } = await import('./subsystems/ContactManager.js');
      subsystems.contactManager = new ContactManager(absDataDir);
      await subsystems.contactManager.initialize?.();
    } catch (e) {
      console.warn('[OpenAce Embed] ContactManager not available:', e.message);
    }

    try {
      const { FormManager } = await import('./subsystems/FormManager.js');
      subsystems.formManager = new FormManager(path.join(absDataDir, 'forms'));
      await subsystems.formManager.initialize?.();
    } catch (e) {
      console.warn('[OpenAce Embed] FormManager not available:', e.message);
    }

    subsystems.businessContext = businessContext;

    // ── License ──
    const license = new LicenseValidator(licenseKey, absDataDir);
    await license.validate();
    console.log(`[OpenAce Embed] License: ${license.getPlan()} (${license.cachedLicense?.trialDaysLeft || 0} trial days left)`);

    // ── Agent ──
    const agent = new EmbedAgent({
      aiManager,
      subsystems,
      onProgress: (msg) => console.log(`[Ace] ${msg}`),
      license,
      dataDir: absDataDir,
    });

    // ── Cron (Pro tier only) ──
    let cronRunner = null;
    if (Object.keys(cron).length > 0 && license.canUse('cron')) {
      cronRunner = new CronRunner(agent, license, absDataDir);
      cronRunner.start(cron);
      console.log(`[OpenAce Embed] Cron started: ${Object.keys(cron).join(', ')}`);
    }

    // ── Router ──
    const router = new AceRouter({ agent, license, cronRunner, subsystems });

    _instance = { agent, router, license, cronRunner, subsystems };
    console.log('[OpenAce Embed] Ready!');
    return _instance;
  }

  // ── Return request handler ──
  return async function aceHandler(req, res) {
    try {
      if (!res.json) {
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(obj));
        };
      }
      if (!res.status) {
        res.status = (code) => { res.statusCode = code; return res; };
      }

      // Parse body if not already parsed
      if (req.method === 'POST' && !req.body && req.on) {
        await new Promise((resolve, reject) => {
          let data = '';
          req.on('data', chunk => data += chunk);
          req.on('end', () => {
            try { req.body = JSON.parse(data); } catch { req.body = {}; }
            resolve();
          });
          req.on('error', reject);
        });
      }

      // ── Auth check ──
      const url = req.url || req.path || '';
      const route = url.replace(/^\/api\/ace/, '').split('?')[0];

      // /auth endpoint — exchange adminSecret for session token
      if (route === '/auth' && req.method === 'POST') {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        if (adminSecret && body.secret === adminSecret) {
          const token = crypto.randomBytes(32).toString('hex');
          sessionTokens.add(token);
          setTimeout(() => sessionTokens.delete(token), 24 * 60 * 60 * 1000);
          return res.json({ success: true, token });
        }
        res.status?.(401);
        return res.json({ error: 'Invalid secret' });
      }

      // Stripe webhooks bypass auth
      const isWebhook = route === '/webhook/stripe';
      if (!isWebhook) {
        const authorized = await isAuthorized(req);
        if (!authorized) {
          res.status?.(401);
          return res.json({ error: 'Unauthorized. Ace is admin-only.' });
        }
      }

      const instance = await ensureInitialized();
      return await instance.router.handle(req, res);
    } catch (err) {
      console.error('[OpenAce Embed] Handler error:', err.message);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  };
}
