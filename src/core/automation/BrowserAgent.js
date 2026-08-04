/**
 * OpenAce Browser Agent
 * Controls the user's REAL Chrome browser via AppleScript — no Puppeteer.
 *
 * Uses AppleScript for navigation, JavaScript execution, and screenshots.
 * Provides a `page`-like compatibility layer so existing SOP executors
 * and other code can transition smoothly.
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class BrowserAgent {
  constructor(options = {}) {
    this.browser = null; // Compatibility — always truthy after launch
    this.page = null;    // Page compatibility shim (set in launchBrowser)
    this.dataDir = options.dataDir || './data/automation';
    this.screenshotDir = path.join(this.dataDir, 'screenshots');
    this.sessionDir = path.join(this.dataDir, 'sessions');
    this.onProgress = options.onProgress || ((msg) => console.log(`[Ace] ${msg}`));
    this._launched = false;
  }

  async initialize() {
    await fs.mkdir(this.screenshotDir, { recursive: true });
    await fs.mkdir(this.sessionDir, { recursive: true });
    console.log('🤖 Browser Agent initialized (AppleScript-based, no Puppeteer)');
    return this;
  }

  // ═══════════════════════════════════════════════════════
  // BROWSER LIFECYCLE
  // ═══════════════════════════════════════════════════════

  async launchBrowser() {
    if (this._launched && this.page) return this.browser;

    this.onProgress('🌐 Opening Chrome...');

    // Ensure Chrome is running
    await this._exec('open -a "Google Chrome"');
    await this._wait(1500);

    // Ensure at least one window exists
    try {
      await this._runAppleScript(`
        tell application "Google Chrome"
          if (count of windows) = 0 then
            make new window
          end if
          activate
        end tell
      `);
    } catch (e) { /* Chrome may already have windows */ }

    // Create page compatibility shim
    this.page = this._createPageShim();
    this.browser = { connected: true }; // Truthy marker
    this._launched = true;

    this.onProgress('✓ Chrome ready');
    eventBus.emit(EVENTS.BROWSER_LAUNCHED, { headless: false });
    return this.browser;
  }

  /**
   * Creates a compatibility shim that mimics the Puppeteer page API.
   * Methods delegate to AppleScript for real browser control.
   */
  _createPageShim() {
    const agent = this;

    return {
      // Run JavaScript in Chrome's active tab
      async evaluate(fn, ...args) {
        const fnStr = typeof fn === 'function' ? `(${fn.toString()})(${args.map(a => JSON.stringify(a)).join(',')})` : fn;
        return agent._executeJsInChrome(fnStr);
      },

      // Get the current URL
      url() {
        // Synchronous compatibility — returns last known URL
        return agent._lastUrl || 'about:blank';
      },

      // Get the page title
      async title() {
        try {
          return await agent._runAppleScript(`
            tell application "Google Chrome"
              return title of active tab of front window
            end tell
          `);
        } catch (e) {
          return '';
        }
      },

      // Navigate to a URL
      async goto(url, options = {}) {
        return agent.navigateTo(url);
      },

      // Wait for a selector to appear
      async waitForSelector(selector, options = {}) {
        const timeout = options.timeout || 10000;
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const found = await agent._executeJsInChrome(
            `!!document.querySelector(${JSON.stringify(selector)})`
          );
          if (found) return true;
          await agent._wait(500);
        }
        throw new Error(`Timeout waiting for selector: ${selector}`);
      },

      // Wait for navigation
      async waitForNavigation(options = {}) {
        await agent._wait(options.timeout ? Math.min(options.timeout, 5000) : 3000);
      },

      // Click a selector
      async click(selector) {
        await agent._executeJsInChrome(
          `document.querySelector(${JSON.stringify(selector)})?.click()`
        );
      },

      // Type text into a selector
      async type(selector, text, options = {}) {
        await agent._executeJsInChrome(`
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el) { el.focus(); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input', {bubbles: true})); }
        `);
      },

      // Query selector
      async $(selector) {
        const exists = await agent._executeJsInChrome(
          `!!document.querySelector(${JSON.stringify(selector)})`
        );
        if (!exists) return null;
        return {
          async click() {
            await agent._executeJsInChrome(
              `document.querySelector(${JSON.stringify(selector)})?.click()`
            );
          },
          async uploadFile(filePath) {
            agent.onProgress(`⚠️ File upload not supported via AppleScript — use manual upload for: ${filePath}`);
          }
        };
      },

      // Screenshot
      async screenshot(options = {}) {
        if (options.path) {
          await agent._captureScreenshot(options.path);
        }
      },

      // Keyboard namespace
      keyboard: {
        async press(key) {
          await agent._pressKey(key);
        },
        async type(char, options = {}) {
          await agent._typeSlowly(char, options.delay || 30);
        },
        async down(key) {
          // Modifier keys — track state but don't press yet
          agent._heldModifier = key;
        },
        async up(key) {
          agent._heldModifier = null;
        }
      },

      // Bring to front
      async bringToFront() {
        await agent._exec('open -a "Google Chrome"');
      },

      // Set user agent (no-op for real browser)
      async setUserAgent() {},
      async setViewport() {},

      // Evaluate on new document (no-op — real browser doesn't need stealth)
      async evaluateOnNewDocument() {},
    };
  }

  // ═══════════════════════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════════════════════

  async navigateTo(url) {
    await this.launchBrowser();
    this.onProgress(`📍 Navigating to ${url}...`);

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    // ═══ PRE-FLIGHT: Catch garbage URLs before they hit Chrome ═══
    if (fullUrl.includes('%20') || fullUrl.includes('%2C')) {
      const domainOnly = fullUrl.match(/^(https?:\/\/[\w.-]+\.[\w]+)/);
      if (domainOnly) {
        this.onProgress(`🔧 URL had extra text — correcting to ${domainOnly[1]}`);
        return this.navigateTo(domainOnly[1]);
      }
      return { success: false, url: fullUrl, title: '', error: 'URL contains encoded spaces — sentence used as URL' };
    }
    try {
      const parsed = new URL(fullUrl);
      if (!parsed.hostname.includes('.') || parsed.hostname.length > 60) {
        return { success: false, url: fullUrl, title: '', error: 'Hostname invalid — does not look like a real domain' };
      }
    } catch (e) {
      return { success: false, url: fullUrl, title: '', error: `Malformed URL: ${e.message}` };
    }

    eventBus.emit(EVENTS.BROWSER_NAVIGATED, { url: fullUrl });
    this._lastUrl = fullUrl;

    try {
      await this._runAppleScript(`
        tell application "Google Chrome"
          tell front window
            make new tab with properties {URL:"${fullUrl.replace(/"/g, '\\"')}"}
          end tell
          activate
        end tell
      `);

      // Wait for page to start loading, then poll until URL changes from blank/previous
      await this._wait(2000);

      // Poll for URL to change (up to 8 seconds total)
      let actualUrl = '';
      for (let i = 0; i < 6; i++) {
        try {
          actualUrl = await this._runAppleScript(`
            tell application "Google Chrome"
              return URL of active tab of front window
            end tell
          `);
          // Check if the active tab URL looks like it navigated to our target
          if (actualUrl && actualUrl !== 'about:blank' && actualUrl !== 'chrome://newtab/') {
            break;
          }
        } catch (e) { /* keep polling */ }
        await this._wait(1000);
      }

      this._lastUrl = actualUrl || fullUrl;
      const title = await this.page.title();

      this.onProgress(`✓ Arrived at: ${title || this._lastUrl}`);
      await this.takeScreenshot('navigation');

      return { success: true, url: this._lastUrl, title };
    } catch (error) {
      this.onProgress(`✗ Navigation failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  // INTERACTION
  // ═══════════════════════════════════════════════════════

  async login(credentials, selectors = {}) {
    this.onProgress('🔐 Attempting to log in...');

    const emailSelector = selectors.email ||
      'input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]';
    const passwordSelector = selectors.password ||
      'input[type="password"], input[name="password"], input[id*="password"]';

    try {
      this.onProgress('  → Finding email field...');
      await this.page.waitForSelector(emailSelector, { timeout: 10000 });
      await this._executeJsInChrome(`
        const el = document.querySelector(${JSON.stringify(emailSelector)});
        if (el) { el.focus(); el.value = ${JSON.stringify(credentials.email)}; el.dispatchEvent(new Event('input', {bubbles: true})); }
      `);
      this.onProgress('  ✓ Email entered');

      this.onProgress('  → Finding password field...');
      await this.page.waitForSelector(passwordSelector, { timeout: 5000 });
      await this._executeJsInChrome(`
        const el = document.querySelector(${JSON.stringify(passwordSelector)});
        if (el) { el.focus(); el.value = ${JSON.stringify(credentials.password)}; el.dispatchEvent(new Event('input', {bubbles: true})); }
      `);
      this.onProgress('  ✓ Password entered');

      await this.takeScreenshot('before-login');

      // Try clicking submit button
      this.onProgress('  → Clicking login button...');
      const submitSelectors = [
        'button[type="submit"]', 'input[type="submit"]', 'form button'
      ];
      let clicked = false;
      for (const sel of submitSelectors) {
        const result = await this._executeJsInChrome(`
          const btn = document.querySelector(${JSON.stringify(sel)});
          if (btn) { btn.click(); true; } else { false; }
        `);
        if (result) { clicked = true; break; }
      }

      if (!clicked) {
        await this._pressKey('Return');
      }

      this.onProgress('  → Waiting for login to complete...');
      await this._wait(4000);
      await this.takeScreenshot('after-login');

      const title = await this.page.title();
      this._lastUrl = await this._runAppleScript(`
        tell application "Google Chrome"
          return URL of active tab of front window
        end tell
      `);

      this.onProgress(`✓ Login complete! Now at: ${title}`);
      return { success: true, url: this._lastUrl, title };
    } catch (error) {
      await this.takeScreenshot('login-error');
      this.onProgress(`✗ Login failed: ${error.message}`);
      throw error;
    }
  }

  async explorePage() {
    this.onProgress('🔍 Analyzing page structure...');

    const analysis = await this._executeJsInChrome(`
      (function() {
        const info = {
          title: document.title,
          url: window.location.href,
          description: document.querySelector('meta[name="description"]')?.content || ''
        };

        const nav = [];
        document.querySelectorAll('nav a, header a, .nav a, .menu a').forEach(link => {
          if (link.textContent.trim()) nav.push({ text: link.textContent.trim().substring(0, 50), href: link.href });
        });
        info.navigation = [...new Map(nav.map(n => [n.text, n])).values()].slice(0, 15);

        const buttons = [];
        document.querySelectorAll('button, .btn, [role="button"]').forEach(btn => {
          if (btn.textContent.trim() && !btn.disabled) buttons.push({ text: btn.textContent.trim().substring(0, 50) });
        });
        info.buttons = [...new Map(buttons.map(b => [b.text, b])).values()].slice(0, 15);

        const forms = [];
        document.querySelectorAll('form').forEach(form => {
          const inputs = [];
          form.querySelectorAll('input, select, textarea').forEach(input => {
            if (input.type !== 'hidden') inputs.push({ type: input.type || 'text', name: input.name || input.placeholder || 'unnamed' });
          });
          if (inputs.length > 0) forms.push({ inputs });
        });
        info.forms = forms.slice(0, 5);

        info.sections = [];
        info.tables = [];
        info.cards = [];

        return JSON.stringify(info);
      })()
    `);

    let parsed;
    try {
      parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
    } catch (e) {
      parsed = { title: '', url: '', description: '', navigation: [], buttons: [], forms: [], sections: [], tables: [], cards: [] };
    }

    const summary = this.generatePageSummary(parsed);
    this.onProgress('✓ Page analysis complete');
    await this.takeScreenshot('exploration');

    return { analysis: parsed, summary };
  }

  async extractPageText() {
    this.onProgress('📝 Extracting page text content...');

    const result = await this._executeJsInChrome(`
      (function() {
        const result = { headings: [], paragraphs: [], listItems: [], eventCards: [], dates: [], links: [], rawText: '' };

        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
          if (h.textContent.trim()) result.headings.push({ level: parseInt(h.tagName[1]), text: h.textContent.trim().substring(0, 200) });
        });

        document.querySelectorAll('p').forEach(p => {
          if (p.textContent.trim().length > 10) result.paragraphs.push(p.textContent.trim().substring(0, 500));
        });

        document.querySelectorAll('a').forEach(link => {
          if (link.textContent.trim().length > 3 && link.href) result.links.push({ text: link.textContent.trim().substring(0, 100), href: link.href });
        });

        result.rawText = (document.body.innerText || '').substring(0, 8000);
        return JSON.stringify(result);
      })()
    `);

    try {
      return typeof result === 'string' ? JSON.parse(result) : result;
    } catch (e) {
      return { headings: [], paragraphs: [], listItems: [], eventCards: [], dates: [], links: [], rawText: '' };
    }
  }

  generatePageSummary(analysis) {
    let summary = `\n📄 **${analysis.title}**\n`;
    summary += `🔗 ${analysis.url}\n\n`;

    if (analysis.navigation?.length > 0) {
      summary += `📍 **Navigation Menu:**\n`;
      analysis.navigation.forEach(nav => { summary += `  • ${nav.text}\n`; });
      summary += '\n';
    }

    if (analysis.buttons?.length > 0) {
      summary += `🔘 **Available Actions:**\n`;
      analysis.buttons.forEach(btn => { summary += `  • [${btn.text}]\n`; });
      summary += '\n';
    }

    if (analysis.forms?.length > 0) {
      summary += `📝 **Forms Found:**\n`;
      analysis.forms.forEach(form => {
        summary += `  • Form with fields: ${form.inputs.map(i => i.name).join(', ')}\n`;
      });
      summary += '\n';
    }

    return summary;
  }

  async click(selector, options = {}) {
    this.onProgress(`👆 Clicking: ${selector}`);
    try {
      await this.page.waitForSelector(selector, { timeout: options.timeout || 5000 });
      await this.page.click(selector);
      await this._wait(1000);
      this.onProgress('✓ Clicked successfully');
      return { success: true };
    } catch (error) {
      this.onProgress(`✗ Click failed: ${error.message}`);
      throw error;
    }
  }

  async clickByText(text) {
    this.onProgress(`👆 Looking for button/link with text: "${text}"`);

    const clicked = await this._executeJsInChrome(`
      (function() {
        var search = ${JSON.stringify(text.toLowerCase())};
        var elements = document.querySelectorAll('a, button, [role="button"], [role="tab"], [role="menuitem"], input[type="submit"]');

        function isVis(el) {
          try { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }
          catch(e) { return false; }
        }

        // Phase 1: EXACT text match (highest priority — "Post" only matches "Post", not "Create Post")
        for (var i = 0; i < elements.length; i++) {
          var el = elements[i];
          if (!isVis(el)) continue;
          var txt = (el.textContent || '').trim().toLowerCase();
          var aria = (el.getAttribute('aria-label') || '').toLowerCase();
          if (txt === search || aria === search) {
            el.click();
            return 'exact:' + txt.substring(0, 60);
          }
        }

        // Phase 2: For single-word short terms (like "Post"), ONLY exact match — skip includes
        // This prevents "Post" from matching "Create Post", "Post to Timeline", etc.
        if (search.split(' ').length <= 1 && search.length <= 12) {
          return null;
        }

        // Phase 3: Includes match, but prefer shortest text (most specific element)
        var candidates = [];
        for (var j = 0; j < elements.length; j++) {
          var elj = elements[j];
          if (!isVis(elj)) continue;
          var txtj = (elj.textContent || '').trim().toLowerCase();
          if (txtj.includes(search) && txtj.length < search.length * 5) {
            candidates.push({ el: elj, txt: txtj, len: txtj.length });
          }
        }
        if (candidates.length > 0) {
          candidates.sort(function(a, b) { return a.len - b.len; });
          candidates[0].el.click();
          return 'includes:' + candidates[0].txt.substring(0, 60);
        }
        return null;
      })()
    `);

    if (clicked) {
      await this._wait(1000);
      this.onProgress(`✓ Clicked: ${clicked}`);
      return { success: true, method: clicked };
    } else {
      throw new Error(`Could not find element with text: ${text}`);
    }
  }

  async type(selector, text, options = {}) {
    this.onProgress(`⌨️ Typing into: ${selector}`);
    try {
      await this.page.waitForSelector(selector, { timeout: options.timeout || 5000 });
      await this.page.type(selector, text, options);
      this.onProgress('✓ Typed successfully');
      return { success: true };
    } catch (error) {
      this.onProgress(`✗ Type failed: ${error.message}`);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  // SEARCH
  // ═══════════════════════════════════════════════════════

  async searchGoogle(query) {
    await this.launchBrowser();
    this.onProgress(`🔍 Searching Google: "${query.substring(0, 60)}..."`);

    await this.navigateTo('https://www.google.com');
    await this._wait(1500);

    // Type search query
    await this._executeJsInChrome(`
      const input = document.querySelector('textarea[name="q"]') || document.querySelector('input[name="q"]');
      if (input) { input.focus(); input.value = ${JSON.stringify(query)}; }
    `);
    await this._pressKey('Return');
    await this._wait(3000);

    // Extract results
    const resultsJson = await this._executeJsInChrome(`
      (function() {
        const items = [];
        document.querySelectorAll('#search .g, #rso .g').forEach((el, i) => {
          if (i >= 10) return;
          const titleEl = el.querySelector('h3');
          const linkEl = el.querySelector('a[href]');
          const snippetEl = el.querySelector('.VwiC3b, [data-sncf]');
          if (titleEl && linkEl) items.push({ title: titleEl.textContent, url: linkEl.href, snippet: snippetEl?.textContent || '', position: i + 1 });
        });
        return JSON.stringify({ url: location.href, title: document.title, results: items });
      })()
    `);

    let data;
    try {
      data = typeof resultsJson === 'string' ? JSON.parse(resultsJson) : resultsJson;
    } catch (e) {
      data = { url: '', title: '', results: [] };
    }

    await this.takeScreenshot('google-search-results');
    this.onProgress(`✓ Google search complete: ${data.results?.length || 0} results found`);

    return {
      success: true,
      url: data.url,
      title: data.title,
      query,
      results: data.results || [],
      resultCount: data.results?.length || 0,
    };
  }

  async searchDuckDuckGo(query) {
    await this.launchBrowser();
    this.onProgress(`🦆 Searching DuckDuckGo: "${query.substring(0, 60)}..."`);

    await this.navigateTo(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
    await this._wait(2000);

    const resultsJson = await this._executeJsInChrome(`
      (function() {
        const items = [];
        document.querySelectorAll('[data-testid="result"], .result, article[data-nrn="result"]').forEach((el, i) => {
          if (i >= 10) return;
          const titleEl = el.querySelector('h2 a, a[data-testid="result-title-a"], .result__a');
          const snippetEl = el.querySelector('[data-result="snippet"], .result__snippet');
          if (titleEl) items.push({ title: titleEl.textContent?.trim(), url: titleEl.href, snippet: snippetEl?.textContent?.trim() || '', position: i + 1 });
        });
        return JSON.stringify({ url: location.href, title: document.title, results: items });
      })()
    `);

    let data;
    try {
      data = typeof resultsJson === 'string' ? JSON.parse(resultsJson) : resultsJson;
    } catch (e) {
      data = { url: '', title: '', results: [] };
    }

    await this.takeScreenshot('ddg-search-results');
    this.onProgress(`✓ DuckDuckGo search complete: ${data.results?.length || 0} results found`);

    return {
      success: true,
      url: data.url,
      title: data.title,
      query,
      results: data.results || [],
      resultCount: data.results?.length || 0,
      engine: 'duckduckgo',
    };
  }

  async searchWeb(query) {
    try {
      const result = await this.searchGoogle(query);
      if (result.success && result.resultCount > 0) return { ...result, engine: 'google' };
      this.onProgress('⚠️ Google returned no results, trying DuckDuckGo...');
      return await this.searchDuckDuckGo(query);
    } catch (error) {
      this.onProgress(`⚠️ Google failed (${error.message}), trying DuckDuckGo...`);
      try {
        return await this.searchDuckDuckGo(query);
      } catch (ddgError) {
        this.onProgress('❌ Both search engines failed');
        return { success: false, error: `Google: ${error.message}, DuckDuckGo: ${ddgError.message}`, results: [], resultCount: 0 };
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // SOCIAL MEDIA POSTING
  // ═══════════════════════════════════════════════════════

  async postToSocialMedia(platform, content, options = {}) {
    this.onProgress(`📱 Starting smart ${platform} post...`);

    const platformConfigs = {
      linkedin: { url: 'https://www.linkedin.com/feed/', startPostTexts: ['Start a post'], postButtonTexts: ['Post', 'Share'] },
      facebook: { url: 'https://www.facebook.com/', startPostTexts: ["What's on your mind", 'Create post'], postButtonTexts: ['Post', 'Share'] },
      twitter: { url: 'https://twitter.com/compose/tweet', startPostTexts: ["What's happening"], postButtonTexts: ['Post', 'Tweet'] },
    };

    const config = platformConfigs[platform.toLowerCase()];
    if (!config) throw new Error(`Unknown platform: ${platform}`);

    try {
      await this.navigateTo(config.url);
      await this._wait(3000);

      // Try to click start post button
      for (const text of config.startPostTexts) {
        try { await this.clickByText(text); break; } catch (e) { continue; }
      }
      await this._wait(2000);

      // Focus contenteditable and type
      await this._executeJsInChrome(`
        const editable = document.querySelector('[contenteditable="true"]') || document.querySelector('[role="textbox"]');
        if (editable) { editable.click(); editable.focus(); }
      `);
      await this._wait(500);

      // Type content via keyboard
      await this._typeSlowly(content.text, 20);
      await this._wait(1500);
      await this.takeScreenshot(`${platform}_before_post`);

      // Click post button
      let posted = false;
      for (const text of config.postButtonTexts) {
        try { await this.clickByText(text); posted = true; break; } catch (e) { continue; }
      }

      await this._wait(3000);
      const screenshotPath = await this.takeScreenshot(`${platform}_post_complete`);

      this.onProgress(`✅ ${platform} post ${posted ? 'submitted' : 'may need manual submit'}!`);
      return { success: posted, platform, timestamp: new Date().toISOString(), screenshot: screenshotPath };
    } catch (error) {
      this.onProgress(`❌ ${platform} post failed: ${error.message}`);
      await this.takeScreenshot(`${platform}_error`);
      return { success: false, platform, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // SCAN & EXTRACT
  // ═══════════════════════════════════════════════════════

  async scanAndExtract(params) {
    if (!params || !params.url) throw new Error('URL is a required parameter for scanAndExtract.');
    this.onProgress(`🔎 Scanning URL: ${params.url}`);
    await this.navigateTo(params.url);
    const pageText = await this.extractPageText();
    this.onProgress('✅ Scan complete, returning page content for AI analysis.');
    return JSON.stringify(pageText, null, 2);
  }

  // ═══════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════

  async takeScreenshot(name = 'screenshot') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    await this._captureScreenshot(filepath);
    this.onProgress(`📸 Screenshot saved: ${filename}`);
    return filepath;
  }

  async getCurrentUrl() {
    try {
      const url = await this._runAppleScript(`
        tell application "Google Chrome"
          return URL of active tab of front window
        end tell
      `);
      if (url) this._lastUrl = url;
      return url || this._lastUrl || null;
    } catch (e) {
      // Log the issue so callers know the URL might be stale
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('not running') || msg.includes('no front window') || msg.includes('timed out')) {
        throw new Error(`Chrome is not responding: ${e.message}`);
      }
      // For transient AppleScript errors, return cached URL with a warning
      return this._lastUrl || null;
    }
  }

  async getCurrentTitle() {
    return this.page ? await this.page.title() : null;
  }

  async wait(ms) {
    return this._wait(ms);
  }

  async close() {
    this.onProgress('🔚 Browser session ended (Chrome stays open)');
    this._launched = false;
    this.browser = null;
    this.page = null;
  }

  async findAndClick(textPatterns, elementTypes = 'button, a, [role="button"]') {
    for (const pattern of textPatterns) {
      const clicked = await this._executeJsInChrome(`
        (function() {
          const elements = [...document.querySelectorAll(${JSON.stringify(elementTypes)})];
          const element = elements.find(el =>
            el.textContent.toLowerCase().includes(${JSON.stringify(pattern.toLowerCase())}) ||
            el.getAttribute('aria-label')?.toLowerCase().includes(${JSON.stringify(pattern.toLowerCase())})
          );
          if (element) { element.click(); return element.textContent || element.getAttribute('aria-label'); }
          return null;
        })()
      `);
      if (clicked) {
        this.onProgress(`✓ Clicked element containing: "${pattern}"`);
        return { success: true, clicked };
      }
    }
    throw new Error(`Could not find element matching: ${textPatterns.join(', ')}`);
  }

  async typeIntoFocused(text, options = {}) {
    this.onProgress('⌨️ Typing into focused element...');
    await this._typeSlowly(text, options.delay || 20);
    this.onProgress('✓ Typed successfully');
    return { success: true };
  }

  async dismissGoogleConsent() {
    try {
      await this._wait(1500);
      await this._executeJsInChrome(`
        (function() {
          const btns = [...document.querySelectorAll('button, [role="button"]')];
          const patterns = ['accept all', 'i agree', 'reject all', 'agree', 'got it', 'accept'];
          for (const btn of btns) {
            const text = (btn.textContent || '').toLowerCase().trim();
            for (const pattern of patterns) {
              if (text.includes(pattern)) { btn.click(); return; }
            }
          }
        })()
      `);
    } catch (e) { /* no consent dialog */ }
  }

  // ═══════════════════════════════════════════════════════
  // INTERNAL: AppleScript + JavaScript execution
  // ═══════════════════════════════════════════════════════

  async _executeJsInChrome(jsCode) {
    try {
      // Escape the JS for AppleScript string embedding
      const escaped = jsCode
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');

      const result = await this._runAppleScript(`
        tell application "Google Chrome"
          execute front window's active tab javascript "${escaped}"
        end tell
      `);

      // Try to parse JSON results
      if (result === 'true') return true;
      if (result === 'false') return false;
      if (result === 'null' || result === 'undefined' || result === '' || result === 'missing value') return null;
      try { return JSON.parse(result); } catch (e) { return result; }
    } catch (error) {
      // Distinguish Chrome-level errors (app not running, no window) from JS execution errors
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('not running') || msg.includes('no front window') ||
          msg.includes('not allowed') || msg.includes('not permitted') ||
          msg.includes('connection is invalid') || msg.includes('timed out') ||
          msg.includes('application isn')) {
        // Chrome is unresponsive or unavailable — this is a real error callers should know about
        throw new Error(`Chrome is not responding: ${error.message}`);
      }
      // JS execution errors are common (e.g., element not found), don't spam logs
      return null;
    }
  }

  async _runAppleScript(script) {
    return new Promise((resolve, reject) => {
      // Use -ss flag for proper string output
      const escaped = script.replace(/'/g, "'\\''");
      exec(`osascript -ss -e '${escaped}'`, { timeout: 15000 }, (err, stdout, stderr) => {
        if (err) {
          reject(err);
        } else {
          // Remove surrounding quotes from AppleScript string output
          let result = stdout.trim();
          if (result.startsWith('"') && result.endsWith('"')) {
            result = result.slice(1, -1);
          }
          resolve(result);
        }
      });
    });
  }

  async _captureScreenshot(filepath) {
    return new Promise((resolve, reject) => {
      exec(`screencapture -x "${filepath}"`, { timeout: 5000 }, (err) => {
        if (err) reject(err);
        else resolve(filepath);
      });
    });
  }

  async _pressKey(key) {
    // Map common key names to AppleScript key codes
    const keyMap = {
      'Return': 'return', 'Enter': 'return',
      'Tab': 'tab', 'Escape': 'escape',
      'Backspace': 'delete', 'Delete': 'delete',
      'ArrowUp': 'up arrow', 'ArrowDown': 'down arrow',
      'ArrowLeft': 'left arrow', 'ArrowRight': 'right arrow',
    };
    const asKey = keyMap[key] || key.toLowerCase();
    try {
      await this._runAppleScript(`
        tell application "System Events"
          key code ${asKey === 'return' ? 36 : asKey === 'tab' ? 48 : asKey === 'escape' ? 53 : asKey === 'delete' ? 51 : 36}
        end tell
      `);
    } catch (e) { /* ignore key press errors */ }
  }

  async _typeSlowly(text, delayPerChar = 30) {
    // Use clipboard paste for reliability
    const escaped = text.replace(/'/g, "'\\''");
    await this._exec(`printf '%s' '${escaped}' | pbcopy`);
    await this._wait(100);
    await this._runAppleScript(`
      tell application "System Events"
        keystroke "v" using command down
      end tell
    `);
    await this._wait(200);
  }

  async _exec(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, { timeout: 10000 }, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout?.trim());
      });
    });
  }

  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Deep page exploration with modern selectors that work on React/SPA sites.
   * Returns rich structure data for SiteMemory — unlike explorePage() which
   * returns empty arrays on modern sites.
   */
  async _deepExplorePage() {
    try {
      const analysis = await this._executeJsInChrome(`
        (function() {
          var info = { title: document.title, url: window.location.href };

          // Clickable elements — broad selectors for modern sites
          var clickable = [];
          var clickSelectors = 'a, button, [role="button"], [onclick], [data-testid], [tabindex="0"], summary, [role="tab"], [role="menuitem"], [role="link"]';
          document.querySelectorAll(clickSelectors).forEach(function(el) {
            var text = (el.textContent || '').trim().substring(0, 60);
            var rect = el.getBoundingClientRect();
            if (text && rect.width > 0 && rect.height > 0) {
              clickable.push({
                text: text,
                tag: el.tagName.toLowerCase(),
                role: el.getAttribute('role') || '',
                href: el.href || '',
                region: rect.top < 80 ? 'header' : rect.top > window.innerHeight - 80 ? 'footer' : 'main'
              });
            }
          });
          // Deduplicate by text
          var seen = {};
          info.buttons = clickable.filter(function(c) {
            if (seen[c.text]) return false;
            seen[c.text] = true;
            return true;
          }).slice(0, 30);

          // Navigation — links in header/nav regions
          info.navigation = info.buttons.filter(function(b) {
            return b.region === 'header' && b.href;
          }).slice(0, 15);

          // Forms and inputs — broad selectors
          var formInputs = [];
          var inputSelectors = 'input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"]';
          document.querySelectorAll(inputSelectors).forEach(function(el) {
            if (el.type === 'hidden') return;
            var rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            var label = '';
            if (el.id) {
              var labelEl = document.querySelector('label[for="' + el.id + '"]');
              if (labelEl) label = labelEl.textContent.trim();
            }
            formInputs.push({
              type: el.type || el.tagName.toLowerCase(),
              name: el.name || el.placeholder || label || el.getAttribute('aria-label') || 'unnamed',
              label: label,
              value: (el.value || '').substring(0, 30)
            });
          });
          info.forms = formInputs.length > 0 ? [{ inputs: formInputs.slice(0, 20) }] : [];

          // Headings for page structure
          var sections = [];
          document.querySelectorAll('h1, h2, h3, [role="heading"]').forEach(function(el) {
            var text = (el.textContent || '').trim().substring(0, 80);
            if (text) sections.push({ heading: text, level: parseInt(el.tagName.replace('H','')) || 2 });
          });
          info.sections = sections.slice(0, 10);

          // Tables
          var tables = [];
          document.querySelectorAll('table, [role="table"], [role="grid"]').forEach(function(t) {
            var headers = [];
            t.querySelectorAll('th, [role="columnheader"]').forEach(function(th) {
              headers.push((th.textContent || '').trim().substring(0, 30));
            });
            var rowCount = t.querySelectorAll('tr, [role="row"]').length;
            if (headers.length > 0 || rowCount > 0) tables.push({ headers: headers, rowCount: rowCount });
          });
          info.tables = tables.slice(0, 5);

          // Cards / list items (common in modern dashboards)
          var cards = [];
          document.querySelectorAll('[class*="card"], [class*="Card"], article, [role="listitem"], [class*="item"], [class*="Item"]').forEach(function(el) {
            var text = (el.textContent || '').trim().substring(0, 100);
            if (text && text.length > 5) cards.push({ text: text });
          });
          info.cards = cards.slice(0, 10);

          info.description = (document.querySelector('meta[name="description"]') || {}).content || '';
          return JSON.stringify(info);
        })()
      `);

      let parsed;
      try {
        parsed = typeof analysis === 'string' ? JSON.parse(analysis) : analysis;
      } catch {
        parsed = { title: '', url: '', navigation: [], buttons: [], forms: [], sections: [], tables: [], cards: [] };
      }

      return { analysis: parsed };
    } catch (e) {
      return { analysis: { title: '', url: '', navigation: [], buttons: [], forms: [], sections: [], tables: [], cards: [] } };
    }
  }
}

export default BrowserAgent;
