/**
 * createAceServer — One-line server setup for the OpenAce embeddable SDK.
 *
 * Ace is a website management assistant for site owners. It helps with:
 *   - SEO analysis & optimization
 *   - Blog post & content generation
 *   - Code/file editing
 *   - Lead research
 *   - Form creation (contact forms, surveys)
 *
 * IMPORTANT: Ace is admin-only. Public visitors should NEVER see the widget.
 * Use `auth` or `adminSecret` to protect all routes.
 *
 * Usage:
 *   import { createAceServer } from '@openace/embed/server';
 *   export default createAceServer({
 *     siteUrl: 'https://mysite.com',         // Your website URL
 *     adminSecret: process.env.ACE_SECRET,    // Protect the widget
 *   });
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

/**
 * Fetch a URL and extract useful text content (title, description, body text).
 * Used to auto-learn about the host website on init.
 */
async function fetchPageContext(url, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'OpenAce-Embed/1.0 (+https://openaceai.com)',
        'Accept': 'text/html',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;

    const html = await resp.text();

    // Extract key info
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)
      || html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract headings
    const headings = [];
    const hRe = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hm;
    while ((hm = hRe.exec(html)) !== null && headings.length < 15) {
      const text = hm[1].replace(/<[^>]+>/g, '').trim();
      if (text.length > 2 && text.length < 200) headings.push(text);
    }

    // Extract navigation links (internal pages)
    const navLinks = [];
    const baseUrl = new URL(url);
    const linkRe = /<a[^>]+href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let lm;
    while ((lm = linkRe.exec(html)) !== null && navLinks.length < 20) {
      const href = lm[1];
      const text = lm[2].replace(/<[^>]+>/g, '').trim();
      if (!text || text.length > 60) continue;
      // Only internal links
      if (href.startsWith('/') || href.startsWith(baseUrl.origin)) {
        const fullUrl = href.startsWith('/') ? `${baseUrl.origin}${href}` : href;
        const pathname = new URL(fullUrl).pathname;
        if (pathname !== '/' && !navLinks.some(n => n.path === pathname)) {
          navLinks.push({ path: pathname, text });
        }
      }
    }

    // Extract body text (cleaned)
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000);

    return { url, title, description, headings, navLinks, bodyText };
  } catch (e) {
    console.warn(`[OpenAce Embed] Could not fetch ${url}: ${e.message}`);
    return null;
  }
}


export function createAceServer(config = {}) {
  const {
    licenseKey,
    dataDir = './data/ace',
    ai = {},
    tools = 'all',
    cron = {},
    businessContext = '',
    siteUrl = '',        // Host website URL — enables website awareness
    sourceDir = '',      // Path to site's source code — enables direct file editing
    auth,                // Function: (req) => boolean | Promise<boolean>
    adminSecret,         // String: shared secret (simpler alternative to auth function)
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
    console.error('\n\u274c [OpenAce Embed] FATAL: No AI API keys found!');
    console.error('   Ace cannot work without an AI provider. Set one of these in your .env:');
    console.error('     GEMINI_API_KEY=...    (free tier — recommended)');
    console.error('     OPENAI_API_KEY=...    (enables DALL-E image generation too)');
    console.error('     ANTHROPIC_API_KEY=... (Claude)');
    console.error('   Or pass directly: createAceServer({ ai: { geminiKey: "..." } })');
    console.error('   Get a free Gemini key at: https://aistudio.google.com/apikey\n');
    throw new Error('OpenAce Embed requires at least one AI API key. See console output above.');
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
    await fs.mkdir(path.join(absDataDir, 'forms'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'notes'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'projects'), { recursive: true });
    await fs.mkdir(path.join(absDataDir, 'cron'), { recursive: true });

    // ── AI Provider ──
    let aiManager;
    try {
      if (useProxy) {
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

    // ── Subsystems (only what a site management widget actually needs) ──
    const subsystems = {};

    // Forms — site owners can create contact/lead capture forms with live URLs
    try {
      const { FormManager } = await import('./subsystems/FormManager.js');
      subsystems.formManager = new FormManager(path.join(absDataDir, 'forms'));
      await subsystems.formManager.initialize?.();
    } catch (e) {
      console.warn('[OpenAce Embed] FormManager not available:', e.message);
    }

    // ── Source directory (direct site file access) ──
    // If not explicitly configured, auto-detect common project structures
    let resolvedSourceDir = sourceDir;
    if (!resolvedSourceDir) {
      const cwd = process.cwd();
      const candidates = [
        'src', 'app', 'pages', 'components', 'public',  // common app dirs
        'content', 'posts', 'blog',                       // content dirs
      ];
      // Check if cwd itself has source files (package.json = it's a project root)
      try {
        await fs.access(path.join(cwd, 'package.json'));
        resolvedSourceDir = '.';  // project root
      } catch {
        // Try common subdirectories
        for (const dir of candidates) {
          try {
            await fs.access(path.join(cwd, dir));
            resolvedSourceDir = '.';  // found project structure, use root
            break;
          } catch { /* skip */ }
        }
      }
    }

    if (resolvedSourceDir) {
      const absSourceDir = path.resolve(resolvedSourceDir);
      try {
        await fs.access(absSourceDir);
        subsystems.sourceDir = absSourceDir;
        console.log(`[OpenAce Embed] Source directory: ${absSourceDir}${!sourceDir ? ' (auto-detected)' : ''}`);
      } catch {
        console.warn(`[OpenAce Embed] sourceDir "${resolvedSourceDir}" not accessible — direct file editing disabled`);
      }
    }

    // ── Pass OpenAI key for image generation ──
    if (resolvedAI.openaiKey) {
      subsystems.openaiKey = resolvedAI.openaiKey;
    }

    // ── Website context (auto-crawl on init) ──
    subsystems.businessContext = businessContext;
    subsystems.siteUrl = siteUrl || process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';
    subsystems.siteContext = null;

    if (subsystems.siteUrl) {
      console.log(`[OpenAce Embed] Crawling site: ${subsystems.siteUrl}`);
      subsystems.siteContext = await fetchPageContext(subsystems.siteUrl);
      if (subsystems.siteContext) {
        console.log(`[OpenAce Embed] Site context loaded: "${subsystems.siteContext.title}" (${subsystems.siteContext.navLinks.length} pages found)`);
      }
    }

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
    subsystems.dataDir = absDataDir;
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

      // Auto-detect siteUrl from request Host header if not configured
      if (!_instance?.subsystems?.siteUrl && req.headers?.host) {
        const proto = req.headers['x-forwarded-proto'] || 'https';
        const detectedUrl = `${proto}://${req.headers.host}`;
        // Store for later use but don't block on crawl
        if (_instance?.subsystems) {
          _instance.subsystems.siteUrl = detectedUrl;
          // Crawl in background (non-blocking)
          fetchPageContext(detectedUrl).then(ctx => {
            if (ctx && _instance?.subsystems) {
              _instance.subsystems.siteContext = ctx;
              console.log(`[OpenAce Embed] Auto-detected site: "${ctx.title}"`);
            }
          });
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
