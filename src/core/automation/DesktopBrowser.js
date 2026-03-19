/**
 * DesktopBrowser — Control the user's REAL browser like a human
 * 
 * Instead of Puppeteer (which gets detected and blocked), this uses
 * the DesktopAgent to control the actual Chrome/Safari browser via
 * mouse movements, keyboard input, and screen reading.
 * 
 * No automation detection. No CAPTCHAs. No blocking.
 * Just a human using their computer — powered by AI vision.
 * 
 * Flow: Screenshot → AI Vision analyzes screen → Execute action → Repeat
 * 
 * Smart Navigation Engine:
 * - Detects page type (search results, listing page, blocked page)
 * - Tracks visited links to avoid re-clicking
 * - Extracts structured data (addresses, prices, property details)
 * - Navigates back to search results after extracting from each page
 * - Compiles findings from multiple pages into a clean summary
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';

const require = createRequire(import.meta.url);

// ═══════════════════════════════════════════════════════
// PAGE TYPE CONSTANTS
// ═══════════════════════════════════════════════════════
const PAGE_TYPE = {
  SEARCH_RESULTS: 'search_results',
  LISTING_PAGE: 'listing_page',
  CONTENT_PAGE: 'content_page',
  BLOCKED_PAGE: 'blocked_page',
  UNKNOWN: 'unknown'
};

export class DesktopBrowser {
  constructor({ desktopAgent, aiManager, onProgress }) {
    this.desktop = desktopAgent;
    this.aiManager = aiManager;
    this.onProgress = onProgress || ((msg) => console.log(`[DesktopBrowser] ${msg}`));
    this.screenshotDir = path.join(process.cwd(), 'data/automation/screenshots');
    this.isChromeFocused = false;
    this.chromeMaximized = false;   // Track if we've already maximized Chrome
    this._screenBounds = null;      // Cached screen bounds from AppleScript

    // ═══ Navigation State ═══
    this.visitedLinks = [];        // Descriptions of links already clicked
    this.extractedPages = [];      // Data extracted from each visited page
    this.currentPageType = PAGE_TYPE.UNKNOWN;
    this.resultClickIndex = 0;     // Which search result to click next (0-based)
    this.maxResultsToVisit = 4;    // Visit up to 4 result pages
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════

  /**
   * Open Chrome browser (or bring it to front if already open)
   */
  async openChrome() {
    this.onProgress('🌐 Opening Chrome...');
    
    await this._ensureChromeWindow();
    await this._wait(2000);
    
    this.isChromeFocused = true;
    this.onProgress('✅ Chrome is open with a visible window');
  }

  /**
   * Navigate to a URL in a NEW TAB via AppleScript.
   * Does NOT call readScreen() — caller decides when to read.
   */
  async navigateTo(url) {
    this.onProgress(`📍 Navigating to ${url}...`);

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    // ═══ PRE-FLIGHT VALIDATION ═══
    // Soul.json adaptive_execution: validate before navigating, never navigate garbage
    const validation = this._validateUrl(fullUrl);
    if (!validation.valid) {
      this.onProgress(`⚠️ URL rejected: ${validation.reason}`);
      return { success: false, url: fullUrl, error: validation.reason, recovery: validation.recovery };
    }
    if (validation.corrected) {
      this.onProgress(`🔧 URL corrected: ${fullUrl} → ${validation.corrected}`);
      return this.navigateTo(validation.corrected);
    }

    await this._chromeOpenUrl(fullUrl);
    this.isChromeFocused = true;

    this.onProgress('⏳ Waiting for page to load...');
    await this._wait(3000);
    this.onProgress(`✅ Navigated to ${fullUrl}`);

    return { success: true, url: fullUrl };
  }

  /**
   * Pre-flight URL validation — catches garbage URLs before they hit Chrome.
   * Soul.json: "I think before I act" + "Consider second-order effects"
   */
  /**
   * Remove old screenshots, keeping only the most recent 50.
   * Prevents disk fill from automation sessions.
   */
  async _cleanupScreenshots() {
    try {
      const files = await fs.readdir(this.screenshotDir);
      const pngs = files.filter(f => f.endsWith('.png')).sort();
      if (pngs.length > 50) {
        const toDelete = pngs.slice(0, pngs.length - 50);
        for (const file of toDelete) {
          await fs.unlink(path.join(this.screenshotDir, file)).catch(() => {});
        }
      }
    } catch (e) {
      // Silent — cleanup failure shouldn't break automation
    }
  }

  _validateUrl(url) {
    // 1. Check for URL-encoded spaces (%20) — sign of a sentence being used as URL
    if (url.includes('%20') || url.includes('%2C')) {
      // Try to extract just the domain from the garbage URL
      const domainMatch = url.match(/^(https?:\/\/[\w.-]+\.[\w]+)/);
      if (domainMatch) {
        return { valid: false, corrected: domainMatch[1], reason: 'URL contained encoded spaces — extracted domain' };
      }
      return { valid: false, reason: 'URL contains encoded spaces — looks like a sentence was used as a URL, not a real address', recovery: 'Extract just the domain name and try again' };
    }

    // 2. Check for spaces in the raw URL (before encoding)
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes(' ')) {
        return { valid: false, reason: 'Hostname contains spaces — not a valid domain', recovery: 'Check the URL and remove extra words' };
      }
      // 3. Check hostname looks like a real domain (has at least one dot)
      if (!parsed.hostname.includes('.')) {
        return { valid: false, reason: `"${parsed.hostname}" doesn't look like a real domain — missing TLD`, recovery: 'Add .com or the correct extension' };
      }
      // 4. Check for extremely long hostnames (likely a sentence)
      if (parsed.hostname.length > 60) {
        return { valid: false, reason: 'Hostname is suspiciously long — might be a sentence encoded as a URL', recovery: 'Extract just the domain and try again' };
      }
    } catch (e) {
      return { valid: false, reason: `Malformed URL: ${e.message}`, recovery: 'Check the URL format' };
    }

    // 5. Block javascript: and data: URLs
    if (/^(javascript|data|file):/i.test(url)) {
      return { valid: false, reason: 'Blocked URL scheme — only http/https allowed', recovery: 'Use a regular web URL' };
    }

    return { valid: true };
  }

  /**
   * Search Google for a query.
   * Uses AppleScript to open a new tab with the search URL directly.
   */
  async searchGoogle(query) {
    this.onProgress(`🔍 Searching Google for: "${query}"`);

    // Ensure Chrome is open and maximized BEFORE navigating
    if (!this.chromeMaximized) {
      await this._ensureChromeWindow();
    }

    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    this.onProgress(`📍 Opening Google search...`);
    await this._chromeOpenUrl(searchUrl);
    this.isChromeFocused = true;
    
    this.onProgress('⏳ Waiting for search results to load...');
    await this._wait(3000);
    
    this.onProgress('👁️ Reading search results...');
    const screen = await this.readScreen();
    
    return {
      success: true,
      query,
      screenshot: screen.imagePath,
      summary: screen.summary,
      rawAnalysis: screen.rawAnalysis,
      base64: screen.base64
    };
  }

  /**
   * Read the current screen — take screenshot and have AI analyze it
   * This is the "eyes" of the Desktop Agent
   */
  async readScreen() {
    this.onProgress('👁️ Reading screen...');

    try {
      // Always bring Chrome to front BEFORE capturing
      await this._focusChrome();

      let filepath;
      let base64;

      // Try robotjs (DesktopAgent) first, then platform screenshot fallback
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `desktop_${timestamp}.png`;
      filepath = path.join(this.screenshotDir, filename);
      await fs.mkdir(this.screenshotDir, { recursive: true });

      if (this.desktop) {
        try {
          const jimpImage = await this.desktop.seeScreen();
          await jimpImage.write(filepath);
          const buffer = await jimpImage.getBuffer('image/png');
          base64 = buffer.toString('base64');
        } catch (e) {
          this.onProgress(`⚠️ robotjs screenshot failed: ${e.message}, trying platform fallback...`);
        }
      }

      // Fallback: platform-specific screenshot (Windows PowerShell, etc.)
      if (!base64) {
        try {
          const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
          const plat = await loadPlatform();
          await plat.takeScreenshot(filepath);
          const fileBuffer = await fs.readFile(filepath);
          base64 = fileBuffer.toString('base64');
        } catch (e2) {
          this.onProgress(`⚠️ Platform screenshot also failed: ${e2.message}`);
          return {
            imagePath: null,
            summary: `Screen capture failed on this platform. Try using read_webpage instead.`,
            rawAnalysis: '',
            base64: null
          };
        }
      }

      this._cleanupScreenshots().catch(() => {});

      const analysis = await this._analyzeScreenshot(base64);

      return {
        imagePath: filepath,
        summary: analysis.summary || 'Screen captured',
        rawAnalysis: analysis.raw || '',
        base64
      };
    } catch (e) {
      this.onProgress(`⚠️ Screen reading failed: ${e.message}`);
      return {
        imagePath: null,
        summary: `Screen capture failed: ${e.message}`,
        rawAnalysis: '',
        base64: null
      };
    }
  }

  /**
   * Extract structured content from the current browser page.
   * Strategy: DOM text extraction first (accurate), vision fallback (for tricky pages).
   */
  async extractContent(taskDescription, pageType = null) {
    this.onProgress(`📝 Extracting content: ${taskDescription}`);

    // ── Strategy 1: DOM text extraction (fast, accurate, full page) ──
    try {
      const domResult = await this._extractFromDOM(taskDescription, pageType);
      if (domResult?.success && domResult.content && domResult.content.length > 50) {
        this.onProgress(`✅ DOM extraction succeeded (${domResult.content.length} chars)`);
        return domResult;
      }
    } catch (e) {
      this.onProgress(`⚠️ DOM extraction failed: ${e.message} — falling back to vision`);
    }

    // ── Strategy 2: Vision-based extraction (fallback for JS-blocked or image-heavy pages) ──
    const screen = await this.readScreen();
    if (!screen.base64) {
      return { success: false, content: '', error: 'Could not capture screen or read DOM' };
    }

    const prompt = this._buildExtractionPrompt(taskDescription, pageType);

    try {
      const result = await this._directVision(prompt, screen.base64);
      if (!result || result.trim().length < 10) {
        return { success: false, content: '', error: 'Vision returned empty or unusable response' };
      }
      return {
        success: true,
        content: result,
        screenshot: screen.imagePath
      };
    } catch (e) {
      this.onProgress(`⚠️ extractContent failed: ${e.message}`);
      return { success: false, content: '', error: e.message };
    }
  }

  /**
   * Extract content by reading the actual DOM text from Chrome.
   * Much more accurate than vision — gets exact text, prices, addresses.
   * Then sends the raw text to AI for structured parsing.
   */
  async _extractFromDOM(taskDescription, pageType = null) {
    // Get the page text, URL, and title from Chrome
    let pageText, pageUrl, pageTitle;
    try {
      pageUrl = await this._executeJsInChrome('document.location.href') || '';
      pageTitle = await this._executeJsInChrome('document.title') || '';
    } catch (e) {
      pageUrl = '';
      pageTitle = '';
    }

    try {
      // Get visible text content — innerText excludes hidden elements, scripts, styles
      // Truncate to 20K chars to stay within AI token limits
      pageText = await this._executeJsInChrome(
        `(function(){` +
        `var t = document.body.innerText || '';` +
        `return t.substring(0, 20000);` +
        `})()`
      );
    } catch (e) {
      return { success: false, content: '', error: `JS execution failed: ${e.message}` };
    }

    if (!pageText || pageText.trim().length < 20) {
      return { success: false, content: '', error: 'Page text too short or empty' };
    }

    // Send the actual text to AI for structured extraction
    const prompt = this._buildDOMExtractionPrompt(taskDescription, pageType, pageUrl, pageTitle, pageText);

    if (!this.aiManager) {
      // No AI available — return raw text
      return { success: true, content: pageText, url: pageUrl };
    }

    try {
      const result = await this.aiManager.chat([{ role: 'user', content: prompt }]);
      const content = result?.content || result?.text || '';
      if (!content || content.trim().length < 10) {
        // AI failed — return raw text instead of nothing
        return { success: true, content: pageText.substring(0, 5000), url: pageUrl };
      }
      return { success: true, content, url: pageUrl };
    } catch (e) {
      // AI call failed — still return the raw DOM text
      return { success: true, content: pageText.substring(0, 5000), url: pageUrl };
    }
  }

  /**
   * Build a prompt for AI to parse raw DOM text into structured data.
   * Much more effective than vision because the AI gets exact text, not a blurry image.
   */
  _buildDOMExtractionPrompt(taskDescription, pageType, pageUrl, pageTitle, pageText) {
    const lower = taskDescription.toLowerCase();
    const isRealEstate = /property|house|home|duplex|condo|apartment|real estate|listing|for sale|for rent|mixed use|commercial|warehouse|flex|office|retail/.test(lower);

    let instructions;

    if (isRealEstate) {
      instructions = `You are extracting real estate listing data from a webpage.

For EACH property listing in the text below, extract:
- **Address**: Full address
- **Price**: Listed price
- **Beds/Baths**: Number of bedrooms and bathrooms
- **Sq Ft**: Square footage
- **Property Type**: House, duplex, condo, multi-family, commercial, flex, warehouse, etc.
- **Key Features**: Lot size, year built, garage, pool, or other standout features
- **Status**: For sale, pending, sold, for rent, etc.

Format each listing clearly numbered (1, 2, 3...). Include ALL listings you can find in the text.
If a field isn't available, skip it — don't guess.

After listing all properties, add a section:
**MATCHES USER CRITERIA**: List which property numbers best match what the user searched for (based on price range, property type, location, size mentioned in their search). This helps prioritize which listings to click into for full details.`;
    } else {
      instructions = `Extract the specific information requested from this webpage.

Format the data clearly. If there are multiple items, number them.
Include all relevant details visible in the text.`;
    }

    return `${instructions}

**What to extract:** ${taskDescription}
**Page:** ${pageTitle} (${pageUrl})

--- PAGE CONTENT ---
${pageText}
--- END PAGE CONTENT ---

Extract ALL matching items from the text above. Be thorough — include every listing/item visible.`;
  }

  /**
   * Scroll down by viewport heights (~800px each for overlap).
   * Uses Chrome JS execution for precise scrolling.
   * Falls back to Space key if JS execution is disabled.
   */
  async scrollDown(viewports = 1) {
    this.onProgress(`⬇️ Scrolling down ${viewports} viewport(s)...`);
    const pixels = Math.round(viewports * 800);
    try {
      await this._executeJsInChrome(`window.scrollBy({top: ${pixels}, behavior: 'smooth'})`);
    } catch {
      // Fallback: Space key = one viewport scroll in Chrome
      this.onProgress('  ↳ JS scroll unavailable, using Space key');
      const robot = require('robotjs');
      for (let i = 0; i < Math.ceil(viewports); i++) {
        robot.keyTap('space');
        await this._wait(300);
      }
    }
    await this._wait(600 + Math.random() * 400);
  }

  /**
   * Scroll up by viewport heights.
   * Falls back to Shift+Space if JS execution is disabled.
   */
  async scrollUp(viewports = 1) {
    this.onProgress(`⬆️ Scrolling up ${viewports} viewport(s)...`);
    const pixels = Math.round(viewports * 800);
    try {
      await this._executeJsInChrome(`window.scrollBy({top: -${pixels}, behavior: 'smooth'})`);
    } catch {
      this.onProgress('  ↳ JS scroll unavailable, using Shift+Space key');
      const robot = require('robotjs');
      for (let i = 0; i < Math.ceil(viewports); i++) {
        robot.keyTap('space', ['shift']);
        await this._wait(300);
      }
    }
    await this._wait(600 + Math.random() * 400);
  }

  /**
   * Get current scroll position and page dimensions.
   * Returns { y, vh, total } or null if unavailable.
   */
  async getScrollPosition() {
    try {
      const raw = await this._executeJsInChrome(
        `JSON.stringify({y:Math.round(window.scrollY),vh:window.innerHeight,total:document.documentElement.scrollHeight})`
      );
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  /**
   * Check if the page is scrolled to the bottom.
   */
  async isAtBottom() {
    const pos = await this.getScrollPosition();
    if (!pos) return false;
    return (pos.y + pos.vh) >= (pos.total - 50);
  }

  /**
   * Click on something visible on screen by description
   * Uses AI vision to find the element and click it
   */
  async clickOn(description) {
    this.onProgress(`🖱️ Clicking on: "${description}"`);
    return this.desktop.findAndClick(description);
  }

  /**
   * Type text into whatever is currently focused
   */
  async typeText(text) {
    this.onProgress(`⌨️ Typing: "${text}"`);
    await this.desktop.type(text);
  }

  /**
   * Search for something using Chrome's address bar.
   * Opens a new tab, types the query, and presses Enter.
   */
  async searchFor(query) {
    this.onProgress(`🔍 Searching for: "${query}"`);

    await this._ensureChromeWindow();
    await this._wait(500);

    // Cmd+T for new tab, then type query
    const robot = require('robotjs');
    robot.keyTap('t', ['command']);
    await this._wait(800);

    // Use clipboard paste for reliability (avoids typing issues)
    await this._pasteFromClipboard(query);
    await this._wait(300);
    robot.keyTap('enter');
    await this._wait(3000); // Wait for results to load
  }

  /**
   * Go back one page in Chrome (Cmd+[)
   */
  async goBack() {
    this.onProgress('⬅️ Going back...');
    await this._focusChrome();
    await this._wait(300);
    const robot = require('robotjs');
    robot.keyTap('[', ['command']);
    await this._wait(2000);
  }

  /**
   * Paste text atomically via the clipboard (pbcopy + Cmd+V).
   * Use instead of typeText() when focus may still be transitioning —
   * clipboard paste is immune to timing issues that cause double-typing.
   */
  async _pasteFromClipboard(text) {
    const { exec } = require('child_process');
    // Shell-escape single quotes so the text is safe inside $'...' style quoting
    const escaped = text.replace(/'/g, "'\\''");
    await new Promise((resolve) => {
      exec(`printf '%s' '${escaped}' | pbcopy`, () => resolve());
    });
    await this._wait(150);
    const robot = require('robotjs');
    robot.keyTap('v', ['command']);
    await this._wait(300);
  }

  /**
   * Press a key or key combination via robotjs (same permission as typeText — no second dialog).
   * key: robotjs key name e.g. 'return', 'tab', 'escape', or a single letter like 'c'
   * modifiers: array of 'command', 'shift', 'alt'/'option', 'control'
   *
   * Examples:
   *   pressKey('return')              → Enter
   *   pressKey('return', ['command']) → Cmd+Return (send in Gmail)
   *   pressKey('tab')                 → Tab
   */
  async pressKey(key, modifiers = []) {
    const robot = require('robotjs');
    // robotjs key name mapping — robotjs uses 'enter' not 'return', 'alt' not 'option'
    const keyMap = { return: 'enter', option: 'alt' };
    const modMap = { return: 'enter', option: 'alt' };
    const robotKey = keyMap[key] || key;
    const mods = modifiers.map(m => modMap[m] || m);
    if (mods.length > 0) {
      robot.keyTap(robotKey, mods);
    } else {
      robot.keyTap(robotKey);
    }
    await this._wait(150);
  }

  /**
   * Press a special key by macOS key code via robotjs.
   * Common codes: Tab=48, Return=36, Escape=53, Space=49, Backspace=51
   */
  async pressKeyCode(keyCode) {
    const robot = require('robotjs');
    // robotjs uses 'enter' not 'return'
    const keyCodeMap = { 48: 'tab', 36: 'enter', 53: 'escape', 49: 'space', 51: 'backspace' };
    const keyName = keyCodeMap[keyCode];
    if (keyName) {
      robot.keyTap(keyName);
    } else {
      this.onProgress(`⚠️ Unknown key code: ${keyCode} — skipping`);
    }
    await this._wait(150);
  }

  // ═══════════════════════════════════════════════════════
  // MAIN SEARCH TASK ENGINE
  // ═══════════════════════════════════════════════════════

  /**
   * Execute a multi-step search task using the AI Vision Loop.
   * This is the main method for research tasks.
   * 
   * State Machine Flow:
   * 1. Search Google → land on search results
   * 2. Detect page type → pick most relevant non-sponsored result
   * 3. Click result → wait for page load → detect page type
   * 4. Extract structured data from the listing/content page
   * 5. Navigate back to search results
   * 6. Click next result → repeat steps 3-5
   * 7. After visiting maxResultsToVisit pages, compile findings
   */
  async executeSearchTask(query, options = {}) {
    const maxSteps = options.maxSteps || 25;
    this.maxResultsToVisit = options.maxResults || 4;
    const results = [];

    // Reset navigation state
    this.visitedLinks = [];
    this.extractedPages = [];
    this.resultClickIndex = 0;
    this.currentPageType = PAGE_TYPE.UNKNOWN;

    this.onProgress(`🔍 Starting search task: "${query}" (will visit up to ${this.maxResultsToVisit} results)`);

    // ═══ STEP 0: Maximize Chrome to fill the screen ═══
    await this._ensureChromeWindow();

    // ═══ SEARCH: Google via Chrome ═══
    let searchResult;
    try {
      searchResult = await this.searchGoogle(query);
    } catch (googleErr) {
      this.onProgress(`⚠️ Chrome/Google search failed: ${googleErr.message}`);
      return {
        success: false,
        query,
        steps: 0,
        pagesVisited: 0,
        content: `Google search failed: ${googleErr.message}. You might need to open Chrome manually, or try again in a moment.`,
        results: [],
        extractedPages: [],
        source: 'failed',
      };
    }

    // ═══ Google succeeded — continue with visual navigation ═══
    results.push({ step: 'search', ...searchResult });
    
    // Reuse the screenshot data from searchGoogle()
    let screen = {
      imagePath: searchResult.screenshot,
      summary: searchResult.summary || '',
      rawAnalysis: searchResult.rawAnalysis || '',
      base64: searchResult.base64 || null
    };
    
    // Step 2: We just searched Google — we KNOW this is search results.
    // Don't waste an AI call on page type detection here.
    this.currentPageType = PAGE_TYPE.SEARCH_RESULTS;
    this.onProgress(`📋 Page type: ${this.currentPageType} (post-Google search)`);
    
    // Step 3: AI-driven navigation loop
    let consecutiveScrolls = 0;
    const MAX_CONSECUTIVE_SCROLLS = 3;

    for (let step = 0; step < maxSteps; step++) {
      // Check if we've collected enough data
      if (this.extractedPages.length >= this.maxResultsToVisit) {
        this.onProgress(`✅ Visited ${this.extractedPages.length} pages — compiling results`);
        break;
      }

      let nextAction = await this._decideNextAction(query, screen, results, step);

      if (nextAction.done) {
        this.onProgress(`✅ Search complete: ${nextAction.reason}`);
        break;
      }

      // Anti-scroll-loop: if AI keeps saying "scroll" without clicking,
      // force it to try clicking or extract what we can see
      if (nextAction.action === 'scroll') {
        consecutiveScrolls++;
        if (consecutiveScrolls > MAX_CONSECUTIVE_SCROLLS) {
          this.onProgress(`⚠️ Scroll loop detected (${consecutiveScrolls}x) — forcing click or extract`);
          if (this.currentPageType === PAGE_TYPE.SEARCH_RESULTS) {
            // We're on search results but AI won't click — override to click_result
            nextAction = { action: 'click_result', target: 'the first organic search result link', reason: 'forced after scroll loop', done: false };
          } else {
            // On some other page — try extracting what's visible
            nextAction = { action: 'extract', reason: 'forced extraction after scroll loop', done: false };
          }
          consecutiveScrolls = 0;
        }
      } else {
        consecutiveScrolls = 0;
      }

      this.onProgress(`🤖 Step ${step + 1}: ${nextAction.action} — ${nextAction.reason}`);

      switch (nextAction.action) {
        case 'click_result': {
          // Click a search result link
          const clickTarget = nextAction.target;
          this.visitedLinks.push(clickTarget);
          this.resultClickIndex++;
          
          const clickResult = await this.clickOn(clickTarget);
          if (!clickResult.success) {
            this.onProgress(`⚠️ Click failed — trying scroll + retry`);
            await this.scrollDown(1);
            await this._wait(400);
            await this.clickOn(clickTarget);
          }

          await this._wait(3000); // Wait for page load
          screen = await this.readScreen();
          this.currentPageType = await this._detectPageType(screen.base64);
          this.onProgress(`📋 Landed on: ${this.currentPageType}`);
          
          // If we landed on a content/listing page, extract with multi-scroll
          if (this.currentPageType === PAGE_TYPE.LISTING_PAGE ||
              this.currentPageType === PAGE_TYPE.CONTENT_PAGE) {
            const extracted = await this.extractContent(query, this.currentPageType);
            if (extracted.success && extracted.content.length > 50) {
              this.extractedPages.push({
                source: clickTarget,
                pageType: this.currentPageType,
                content: extracted.content,
                screenshot: extracted.screenshot
              });
              results.push({ step: `extract_${step}`, ...extracted });
              this.onProgress(`📊 Extracted data from page ${this.extractedPages.length}/${this.maxResultsToVisit} (viewport 1)`);
            }

            // Multi-scroll: scroll and extract up to 3 more viewports
            // to capture far more listings per page
            const maxScrollExtracts = 3;
            for (let s = 0; s < maxScrollExtracts; s++) {
              await this.scrollDown(1); // 1 viewport = full page scroll
              await this._wait(400);  // scrollDown already waits internally
              const moreContent = await this.extractContent(
                `${query} (continued — capture NEW items not already listed above)`,
                this.currentPageType
              );
              if (moreContent.success && moreContent.content.length > 50 && this.extractedPages.length > 0) {
                this.extractedPages[this.extractedPages.length - 1].content += `\n\n--- SCROLL ${s + 2} ---\n\n` + moreContent.content;
                results.push({ step: `extract_scroll${s + 2}_${step}`, ...moreContent });
                this.onProgress(`📊 Captured viewport ${s + 2} from this page`);
              } else {
                // No new content found — stop scrolling this page
                break;
              }
            }

            // Navigate back to search results
            this.onProgress('⬅️ Going back to search results...');
            await this._keyCombo('command', '[');
            await this._wait(2500);
            screen = await this.readScreen();
            this.currentPageType = PAGE_TYPE.SEARCH_RESULTS;
          } else if (this.currentPageType === PAGE_TYPE.BLOCKED_PAGE) {
            this.onProgress('🚫 Page is blocked — going back');
            await this._keyCombo('command', '[');
            await this._wait(2000);
            screen = await this.readScreen();
            this.currentPageType = PAGE_TYPE.SEARCH_RESULTS;
          }
          break;
        }
          
        case 'scroll': {
          await this.scrollDown(nextAction.amount || 5);
          await this._wait(1000);
          screen = await this.readScreen();
          break;
        }
          
        case 'extract': {
          const content = await this.extractContent(query, this.currentPageType);
          if (content.success && content.content.length > 50) {
            this.extractedPages.push({
              source: 'current_page',
              pageType: this.currentPageType,
              content: content.content,
              screenshot: content.screenshot
            });
            results.push({ step: `extract_${step}`, ...content });
          }
          break;
        }
          
        case 'navigate': {
          await this.navigateTo(nextAction.url);
          screen = await this.readScreen();
          this.currentPageType = await this._detectPageType(screen.base64);
          break;
        }
          
        case 'back': {
          await this._keyCombo('command', '[');
          await this._wait(2000);
          screen = await this.readScreen();
          this.currentPageType = PAGE_TYPE.SEARCH_RESULTS;
          break;
        }
          
        default: {
          // Unknown action — read screen and continue
          screen = await this.readScreen();
        }
      }
    }
    
    // ═══ Compile all extracted content ═══
    const allContent = this._compileFindings(query);

    // ═══ Clean up: close search tab and return to dashboard ═══
    await this._returnToDashboard();

    return {
      success: true,
      query,
      steps: results.length,
      pagesVisited: this.extractedPages.length,
      content: allContent,
      results,
      extractedPages: this.extractedPages,
      source: 'desktop_browser'
    };
  }

  // ═══════════════════════════════════════════════════════
  // GOAL-DRIVEN AGENTIC LOOP
  // ═══════════════════════════════════════════════════════

  /**
   * Execute any browser goal autonomously using a vision-driven loop.
   * Screenshots the screen → asks AI what to do → executes → repeats until done.
   *
   * @param {string} goal - Natural language description of what to accomplish
   * @param {object} options - { maxSteps, corrections }
   * @returns {{ success, summary, steps, goal, error? }}
   */
  async executeGoal(goal, options = {}) {
    const maxSteps = options.maxSteps || 20;
    const onProgress = this.onProgress;
    const history = [];
    const corrections = options.corrections || [];

    onProgress(`🎯 Goal: "${goal}"`);
    await this._ensureChromeWindow();

    // ── Smart shortcut: If goal is "go to X and search for Y", navigate directly ──
    // This saves 3-5 vision loop steps by going straight to the URL + using the search bar.
    const googleSearchMatch = goal.match(/\b(?:go to |open |visit )?google\.com\b.*?(?:search|look|find)\s+(?:for\s+)?['"]?(.+?)['"]?\s*$/i)
      || goal.match(/\bsearch\s+(?:on\s+)?google(?:\.com)?\s+(?:for\s+)?['"]?(.+?)['"]?\s*$/i);
    if (googleSearchMatch) {
      let query = googleSearchMatch[1].replace(/['"]+$/g, '').trim();
      // Strip trailing instruction phrases — these are commands, not search terms
      // "mixed use properties under $450k? Then find me 10 listings and send me the details"
      // → only keep "mixed use properties under $450k"
      query = query
        .replace(/[?.!]\s*(?:then|and then|after that|once done|when done)\b.*/i, '')
        .replace(/\s*(?:\?\s*)?(?:then |and |also |please |)\b(?:find|send|show|get|give|list|tell|email|click|open|visit|browse|navigate)\s+(?:me |us |them |it |the ).*/i, '')
        .replace(/\s*[?.!]\s*$/, '')
        .trim();
      if (query.length > 2) {
        onProgress(`🔍 Smart shortcut: Google search for "${query}"`);
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        try {
          await this._chromeOpenUrl(searchUrl);
          await this._wait(3000);
          const screen = await this.readScreen();

          // CRITICAL: Extract content from the search results page before returning.
          // Do NOT return "Goal Complete" with zero content — that's the #1 user complaint.
          let extractedContent = '';
          if (screen.base64) {
            try {
              const extraction = await this.extractContent(
                `Extract all search result titles, URLs, and snippets visible for: "${query}"`,
                'search_results'
              );
              if (extraction.success && extraction.content && extraction.content.length > 50) {
                extractedContent = extraction.content;
              }
            } catch (extractErr) {
              onProgress(`⚠️ Content extraction failed: ${extractErr.message}`);
            }
          }

          return {
            success: true,
            summary: extractedContent
              ? `Searched Google for: "${query}" and extracted results`
              : `Navigated to Google search for: "${query}" (results visible but extraction failed)`,
            steps: [{ step: 1, action: 'navigate', url: searchUrl, timestamp: Date.now() }],
            goal,
            screen,
            content: extractedContent,
          };
        } catch (e) {
          onProgress(`⚠️ Smart shortcut failed: ${e.message} — falling back to vision loop`);
        }
      }
    }

    // Open a dedicated tab for goal execution so we don't navigate away from the dashboard.
    // The first navigate action will use _chromeSetCurrentTabUrl on this tab.
    try {
      await this._runAppleScript(`
        tell application "Google Chrome"
          tell window 1 to make new tab with properties {URL:"about:blank"}
        end tell
      `);
      await this._wait(500);
    } catch (e) {
      onProgress(`⚠️ Could not open goal tab: ${e.message}`);
    }

    let consecutiveSameAction = 0;
    let lastActionKey = '';
    let result;

    try {
      for (let step = 0; step < maxSteps; step++) {
        // 1. Capture screen (lightweight — no AI analysis, just screenshot + base64)
        //    _decideGoalAction will analyze the screenshot itself, so we skip the
        //    redundant _analyzeScreenshot() call that readScreen() normally does.
        let base64;
        try {
          const jimpImage = await this.desktop.seeScreen();
          const buffer = await jimpImage.getBuffer('image/png');
          base64 = buffer.toString('base64');
        } catch (e) {
          onProgress(`⚠️ Screen capture failed: ${e.message}`);
          result = { success: false, error: 'Screen capture failed', steps: history, goal };
          break;
        }

        if (!base64) {
          result = { success: false, error: 'Screen capture returned empty', steps: history, goal };
          break;
        }

        // 2. AI decides next action (single vision call per step)
        let action;
        try {
          action = await this._decideGoalAction(goal, { base64 }, history, corrections);
        } catch (e) {
          onProgress(`⚠️ Decision error: ${e.message}`);
          result = { success: false, error: `AI decision failed: ${e.message}`, steps: history, goal };
          break;
        }

        if (!action || !action.action) {
          onProgress(`⚠️ AI returned no action — stopping`);
          break;
        }

        // 3. Check completion
        if (action.action === 'done') {
          onProgress(`✅ Goal complete: ${action.summary || 'Done'}`);
          result = { success: true, summary: action.summary || 'Goal completed', steps: history, goal };
          break;
        }
        if (action.action === 'failed') {
          onProgress(`❌ Goal failed: ${action.reason || 'Unknown reason'}`);
          result = { success: false, error: action.reason || 'Goal failed', steps: history, goal };
          break;
        }

        // 4. Loop protection — detect repeated identical actions
        const actionKey = `${action.action}:${action.target || action.text || action.url || ''}`;
        if (actionKey === lastActionKey) {
          consecutiveSameAction++;

          // After 2 identical actions, try smart recovery before giving up
          if (consecutiveSameAction >= 2) {
            onProgress(`⚠️ Repeated "${action.action}" ${consecutiveSameAction + 1}x — attempting recovery...`);

            // Smart recovery: if stuck clicking a button, try clicking an input field + typing instead
            if (action.action === 'click') {
              onProgress('🔄 Recovery: Pressing Tab to focus next element, then will re-evaluate...');
              try {
                const robot = require('robotjs');
                robot.keyTap('tab');
                await this._wait(500);
              } catch (e) { /* ignore */ }
              consecutiveSameAction = 0; // Reset — give the new approach a chance
              lastActionKey = 'recovery:tab';
              history.push({ step: step + 1, action: 'recovery', target: 'Tab key to change focus', timestamp: Date.now() });
              await this._wait(800);
              continue; // Skip executing the repeated click, re-screenshot instead
            }

            // For non-click stuck loops, stop after 3
            if (consecutiveSameAction >= 3) {
              onProgress(`⚠️ Stuck in loop (repeated "${action.action}" 3x) — stopping`);
              result = {
                success: false,
                error: `Got stuck repeating: ${action.action} — ${action.target || action.text || ''}`,
                steps: history,
                goal
              };
              break;
            }
          }
        } else {
          consecutiveSameAction = 0;
        }
        lastActionKey = actionKey;

        const desc = action.target || action.text || action.url || action.query || '';
        onProgress(`🤖 Step ${step + 1}/${maxSteps}: ${action.action}${desc ? ` — ${desc}` : ''}`);

        // 5. Execute the action
        await this._executeGoalAction(action);
        history.push({ step: step + 1, action: action.action, target: action.target, text: action.text, url: action.url, query: action.query, result: action.result, timestamp: Date.now() });

        // Wait longer for navigation/clicks (page loads), shorter for typing/scrolling
        const waitMs = (action.action === 'click' || action.action === 'navigate' || action.action === 'back') ? 2500 : 800;
        await this._wait(waitMs);
      }

      // If we fell through the loop without setting result, we ran out of steps
      if (!result) {
        let finalSummary = `Completed ${history.length} steps but didn't finish the goal.`;
        try {
          const finalScreen = await this.readScreen();
          if (finalScreen?.summary) {
            finalSummary += ` Current screen: ${finalScreen.summary}`;
          }
        } catch (e) { /* ignore */ }
        result = { success: false, error: finalSummary, steps: history, goal };
      }

    } finally {
      // Clean up: close the goal tab and return to dashboard
      try {
        await this._returnToDashboard();
      } catch (e) {
        onProgress(`⚠️ Tab cleanup failed: ${e.message}`);
      }
    }

    return result;
  }

  /**
   * Ask AI what the next action should be for a given goal.
   */
  async _decideGoalAction(goal, screen, history, corrections) {
    const historyText = history.length > 0
      ? `Actions so far:\n${history.map(h => `Step ${h.step}: ${h.action} — ${h.target || h.text || h.url || h.query || ''}`).join('\n')}`
      : 'No actions taken yet — this is the first step.';

    const correctionText = corrections.length > 0
      ? `\n\nUSER CORRECTIONS (follow these):\n${corrections.join('\n')}`
      : '';

    // Build stuck-awareness context so AI doesn't repeat failed actions
    const lastAction = history.length > 0 ? history[history.length - 1] : null;
    let stuckHint = '';
    if (lastAction && history.length >= 2) {
      const prevAction = history[history.length - 2];
      if (lastAction.action === prevAction.action && lastAction.target === prevAction.target) {
        stuckHint = `\n\n⚠️ WARNING: You just did "${lastAction.action} — ${lastAction.target || lastAction.text || ''}" TWICE with no change. That approach is NOT working. Try something DIFFERENT:
- If you clicked a button but nothing happened, try clicking an INPUT FIELD and TYPING instead.
- If a search page is showing, click the SEARCH INPUT BAR (the text field), not the search button.
- If you're stuck, try pressing Tab to focus the next element, or try a different approach entirely.`;
      }
    }

    const prompt = `You are Ace, an AI assistant controlling a real Chrome browser on Mac.
You can see a screenshot of the current browser state.

GOAL: "${goal}"
STEP: ${history.length + 1}
${historyText}${correctionText}${stuckHint}

Look at this screenshot. What is the SINGLE next action to take toward the goal?

Available actions (reply with ONLY one JSON object):

Click on something visible: {"action": "click", "target": "describe what to click"}
Type text (into focused field): {"action": "type", "text": "text to type"}
Press a key: {"action": "key", "key": "return", "modifiers": ["command"]}
Scroll: {"action": "scroll", "direction": "down"}
Navigate to a URL: {"action": "navigate", "url": "https://..."}
Go back: {"action": "back"}
Extract data from page: {"action": "extract", "query": "what data to extract"}
Goal is COMPLETE: {"action": "done", "summary": "what was accomplished"}
Goal CANNOT be done: {"action": "failed", "reason": "why"}

RULES:
- ONE action per step. You'll see the result next step.
- Be precise about click targets — describe position AND appearance.
- To SEARCH on any site: click the SEARCH INPUT FIELD first, then TYPE your query, then press Enter.
- NEVER click a "Search" or "Submit" BUTTON before typing text into the input field.
- If you need to type, click the input field FIRST, then type in the next step.
- When the goal asks for data, use "extract" after navigating to the right page.
- When all parts of the goal are done, use "done" with a summary.
- If the page has a URL bar visible and you need to go to a website, use "navigate" instead of clicking.`;

    const result = await this._directVision(prompt, screen.base64);

    // Parse JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        // JSON parse failed — fall through to text parsing
      }
    }

    // Fallback: interpret text response
    const lower = result.toLowerCase();
    if (lower.includes('done') || lower.includes('complete')) {
      return { action: 'done', summary: result.substring(0, 200) };
    }
    if (lower.includes('cannot') || lower.includes('failed') || lower.includes('unable')) {
      return { action: 'failed', reason: result.substring(0, 200) };
    }

    this.onProgress(`⚠️ Could not parse AI response: "${result.substring(0, 100)}"`);
    return { action: 'failed', reason: 'Could not parse AI response' };
  }

  /**
   * Execute a single action from the goal AI.
   */
  async _executeGoalAction(action) {
    switch (action.action) {
      case 'click':
        if (action.target) await this.clickOn(action.target);
        break;
      case 'type':
        if (action.text) await this.typeText(action.text);
        break;
      case 'key': {
        const robot = require('robotjs');
        const keyMap = { return: 'enter', option: 'alt' };
        const key = keyMap[action.key] || action.key;
        const mods = (action.modifiers || []).map(m => keyMap[m] || m);
        if (mods.length > 0) {
          robot.keyTap(key, mods);
        } else {
          robot.keyTap(key);
        }
        break;
      }
      case 'scroll':
        if (action.direction === 'up') {
          await this.scrollUp(1);
        } else {
          await this.scrollDown(1);
        }
        break;
      case 'navigate':
        if (action.url) {
          // Navigate in the CURRENT tab — don't open a new one.
          // During goal execution we're already in a Chrome tab.
          const navUrl = action.url.startsWith('http') ? action.url : `https://${action.url}`;
          await this._chromeSetCurrentTabUrl(navUrl);
          this.isChromeFocused = true;
          await this._wait(2000);
        }
        break;
      case 'back':
        await this._keyCombo('command', '[');
        break;
      case 'extract': {
        const extraction = await this.extractContent(action.query || '');
        action.result = extraction.content || '';
        break;
      }
      default:
        this.onProgress(`⚠️ Unknown goal action: ${action.action}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // PAGE TYPE DETECTION
  // ═══════════════════════════════════════════════════════

  /**
   * Detect what type of page we're currently on.
   * Uses a focused vision prompt that returns a simple classification.
   */
  async _detectPageType(base64Image) {
    if (!base64Image) return PAGE_TYPE.UNKNOWN;

    const prompt = `Look at this screenshot and classify the page type. Choose EXACTLY ONE:

1. "search_results" — This is a search engine results page (Google, Bing, etc.) with a list of links and snippets
2. "listing_page" — This is a page showing multiple items/listings with details (products, properties, restaurants, businesses, software, etc.)
3. "content_page" — This is a regular website with article content, data tables, reviews, or useful information
4. "blocked_page" — This page shows a CAPTCHA, access denied, unusual traffic warning, or robot check

Reply with ONLY the page type as a single word/phrase from the options above. Nothing else.`;

    try {
      const result = await this._directVision(prompt, base64Image);
      const lower = result.toLowerCase().trim();
      
      if (lower.includes('search_results') || lower.includes('search results')) return PAGE_TYPE.SEARCH_RESULTS;
      if (lower.includes('listing')) return PAGE_TYPE.LISTING_PAGE;
      if (lower.includes('blocked') || lower.includes('captcha')) return PAGE_TYPE.BLOCKED_PAGE;
      if (lower.includes('content')) return PAGE_TYPE.CONTENT_PAGE;
      
      // Fallback heuristics
      if (lower.includes('google') && (lower.includes('result') || lower.includes('search'))) return PAGE_TYPE.SEARCH_RESULTS;
      if (lower.includes('denied') || lower.includes('robot') || lower.includes('verify')) return PAGE_TYPE.BLOCKED_PAGE;
      // Sites known to be listing pages (any domain)
      if (/zillow|redfin|realtor|yelp|g2|capterra|amazon|ebay|etsy|craigslist|loopnet|crexi/.test(lower)) return PAGE_TYPE.LISTING_PAGE;
      
      return PAGE_TYPE.CONTENT_PAGE;
    } catch (e) {
      this.onProgress(`⚠️ Page type detection failed: ${e.message}`);
      return PAGE_TYPE.UNKNOWN;
    }
  }

  // ═══════════════════════════════════════════════════════
  // SMART ACTION DECISION ENGINE
  // ═══════════════════════════════════════════════════════

  /**
   * Ask AI what the next action should be, with page-type-aware prompts.
   * The prompt changes dramatically based on what type of page we're on.
   */
  async _decideNextAction(query, currentScreen, previousResults, stepNum) {
    if (!currentScreen.base64) {
      return { done: true, reason: 'Cannot see screen' };
    }

    // Build context about what we've already done
    const visitedSummary = this.visitedLinks.length > 0 
      ? `Already visited ${this.visitedLinks.length} links: ${this.visitedLinks.join(', ')}`
      : 'Haven\'t clicked any results yet';
    
    const extractedSummary = this.extractedPages.length > 0
      ? `Extracted data from ${this.extractedPages.length} pages so far`
      : 'No data extracted yet';
    
    const nextResultNum = this.resultClickIndex + 1;

    // Choose prompt strategy based on current page type
    let prompt;
    
    switch (this.currentPageType) {
      case PAGE_TYPE.SEARCH_RESULTS:
        prompt = this._buildSearchResultsPrompt(query, visitedSummary, extractedSummary, nextResultNum, stepNum);
        break;
      case PAGE_TYPE.LISTING_PAGE:
        prompt = this._buildListingPagePrompt(query, extractedSummary, stepNum);
        break;
      case PAGE_TYPE.CONTENT_PAGE:
        prompt = this._buildContentPagePrompt(query, extractedSummary, stepNum);
        break;
      case PAGE_TYPE.BLOCKED_PAGE:
        prompt = this._buildBlockedPagePrompt(query, stepNum);
        break;
      default:
        prompt = this._buildDefaultPrompt(query, visitedSummary, extractedSummary, stepNum);
        break;
    }

    try {
      const result = await this._directVision(prompt, currentScreen.base64);
      
      // Parse JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'done',
          target: parsed.target || '',
          url: parsed.url || '',
          reason: parsed.reason || '',
          amount: parsed.amount || 5,
          done: parsed.done === true
        };
      }
      
      // If no valid JSON, try to interpret the text response.
      // Only treat as "done" if the AI EXPLICITLY signals task completion at the start,
      // not if "done" or "complete" appears in a page description.
      const trimmedResult = result.trim();
      if (/^(?:the\s+)?(?:goal|task)\s+(?:is\s+)?(?:done|complete)/i.test(trimmedResult) ||
          /^done\b/i.test(trimmedResult) ||
          /^(?:i'?m|i am)\s+done\b/i.test(trimmedResult)) {
        return { done: true, reason: 'AI indicated task complete' };
      }
      const lower = result.toLowerCase();
      if (lower.includes('scroll')) {
        return { action: 'scroll', reason: 'AI suggested scrolling', done: false };
      }
      if (lower.includes('back')) {
        return { action: 'back', reason: 'AI suggested going back', done: false };
      }
    } catch (e) {
      this.onProgress(`⚠️ Decision failed: ${e.message}`);
    }

    // Fallback logic based on state
    if (this.extractedPages.length >= this.maxResultsToVisit) {
      return { done: true, reason: `Collected data from ${this.extractedPages.length} pages` };
    }
    if (stepNum >= 12) {
      return { done: true, reason: 'Max steps reached' };
    }
    if (this.currentPageType === PAGE_TYPE.SEARCH_RESULTS && this.resultClickIndex < this.maxResultsToVisit) {
      return { action: 'scroll', reason: 'Scrolling to find more results', done: false };
    }
    return { action: 'scroll', target: '', reason: 'Default action — scroll to see more', done: false };
  }

  // ═══════════════════════════════════════════════════════
  // PAGE-TYPE-SPECIFIC PROMPTS
  // ═══════════════════════════════════════════════════════

  /**
   * Prompt for when we're on Google search results.
   * Tells AI to find the next non-sponsored, non-ad organic result.
   */
  _buildSearchResultsPrompt(query, visitedSummary, extractedSummary, nextResultNum, stepNum) {
    // Detect query domain to give smart preferences
    const lower = query.toLowerCase();
    let domainHint = '';
    if (/property|house|home|duplex|triplex|fourplex|condo|apartment|real estate|listing|for sale|for rent|mixed use|gas station|commercial/.test(lower)) {
      domainHint = '3. PREFER links from real estate sites (Zillow, Redfin, Realtor.com, Trulia, LoopNet, Crexi)';
    } else if (/restaurant|food|eat|dining|cuisine/.test(lower)) {
      domainHint = '3. PREFER links from review sites (Yelp, Google Reviews, TripAdvisor, The Infatuation)';
    } else if (/software|app|tool|crm|saas/.test(lower)) {
      domainHint = '3. PREFER links from review/comparison sites (G2, Capterra, TrustRadius, PCMag)';
    } else if (/company|business|competitor|industry/.test(lower)) {
      domainHint = '3. PREFER links from business directories (LinkedIn, Crunchbase, Bloomberg, BBB)';
    } else {
      domainHint = '3. PREFER links that look like they have actual data, listings, or detailed information — not just generic articles';
    }

    return `You are an AI research assistant looking at Google search results on screen.

TASK: Find information about "${query}"
STATUS: ${visitedSummary}. ${extractedSummary}.
LOOKING FOR: Result #${nextResultNum} to click on.

INSTRUCTIONS:
You are looking at Google search results. I need you to find the NEXT organic (non-sponsored, non-ad) search result link to click.

RULES FOR CHOOSING WHICH LINK TO CLICK:
1. SKIP any result that says "Ad" or "Sponsored" next to it
2. SKIP any result I've already visited: ${this.visitedLinks.join(', ') || 'none yet'}
${domainHint}
4. PREFER links with actual data/listings over generic articles
5. Pick the ${nextResultNum === 1 ? 'FIRST' : `next (approximately #${nextResultNum})`} relevant organic result

If you can see a good result to click, respond with:
{"action": "click_result", "target": "DESCRIBE THE LINK TEXT AND POSITION so I can find and click it", "reason": "why this result", "done": false}

If you need to scroll down to see more results:
{"action": "scroll", "reason": "need to see more results", "done": false}

If we already have enough data (${this.extractedPages.length} pages extracted, need ${this.maxResultsToVisit}):
{"action": "done", "reason": "collected enough data", "done": true}

Reply with ONLY the JSON object.`;
  }

  /**
   * Prompt for when we're on a real estate listing page.
   * Tells AI to extract or signal that extraction should happen.
   */
  _buildListingPagePrompt(query, extractedSummary, stepNum) {
    return `You are on a REAL ESTATE LISTING PAGE (like Zillow, Redfin, Realtor.com).

TASK: "${query}"
STATUS: ${extractedSummary}

I can see property listing data on this page. What should I do?

If this page has useful property data (addresses, prices, details) that I haven't extracted yet:
{"action": "extract", "reason": "page has listing data to extract", "done": false}

If I've already extracted from this page and should go back to search results:
{"action": "back", "reason": "already extracted, go back for more results", "done": false}

If we have enough data overall:
{"action": "done", "reason": "sufficient data collected", "done": true}

Reply with ONLY the JSON object.`;
  }

  /**
   * Prompt for a generic content page (article, blog, data page).
   */
  _buildContentPagePrompt(query, extractedSummary, stepNum) {
    return `You are on a CONTENT PAGE (article, website, or data page).

TASK: "${query}"
STATUS: ${extractedSummary}

Look at this page. Does it contain useful information related to the task?

If yes, and I should extract the data:
{"action": "extract", "reason": "page has relevant content", "done": false}

If the page isn't very relevant and I should go back to search results:
{"action": "back", "reason": "page not relevant enough", "done": false}

If I should scroll down to see more content first:
{"action": "scroll", "reason": "need to see more of this page", "done": false}

Reply with ONLY the JSON object.`;
  }

  /**
   * Prompt for blocked/CAPTCHA pages.
   */
  _buildBlockedPagePrompt(query, stepNum) {
    return `The current page appears to be BLOCKED (CAPTCHA, access denied, or robot check).

I should go back and try a different result.
Reply with: {"action": "back", "reason": "page is blocked", "done": false}`;
  }

  /**
   * Default prompt when page type is unknown.
   */
  _buildDefaultPrompt(query, visitedSummary, extractedSummary, stepNum) {
    return `You are an AI research assistant controlling a computer to find information.

TASK: "${query}"
STEP: ${stepNum + 1} of 15
${visitedSummary}. ${extractedSummary}.

Look at this screenshot. What type of page is this, and what should I do next?

Options:
- click_result: Click on a search result link (specify "target" description)
- scroll: Scroll down to see more content
- extract: Extract data from this page
- back: Go back to search results
- done: We have enough data

Reply with ONLY a JSON object:
{"action": "...", "target": "...", "reason": "...", "done": false}`;
  }

  // ═══════════════════════════════════════════════════════
  // STRUCTURED EXTRACTION PROMPTS
  // ═══════════════════════════════════════════════════════

  /**
   * Build an extraction prompt tailored to the page type.
   * Much more specific than the generic "extract everything" approach.
   */
  _buildExtractionPrompt(taskDescription, pageType) {
    const baseInstructions = `You are looking at a screenshot of a web browser. ONLY report what you ACTUALLY SEE on the screen. Do not make anything up.`;

    // Detect the domain of the search to customize extraction
    const lower = taskDescription.toLowerCase();
    const isRealEstate = /property|house|home|duplex|condo|apartment|real estate|listing|for sale|for rent|mixed use|commercial/.test(lower);
    const isRestaurant = /restaurant|food|eat|dining|cuisine|bar|cafe|bistro/.test(lower);
    const isSoftware = /software|app|tool|crm|saas|platform/.test(lower);
    const isBusiness = /company|business|competitor|agency|firm|service/.test(lower);

    switch (pageType) {
      case PAGE_TYPE.LISTING_PAGE:
        if (isRealEstate) {
          return `${baseInstructions}

This appears to be a REAL ESTATE LISTING PAGE. Extract ALL property information visible:

For EACH property/listing you can see, extract:
- **Address**: Full street address, city, state, zip
- **Price**: Listed price (sale or rent)
- **Bedrooms/Bathrooms**: Number of each
- **Square Feet**: Total sq ft if shown
- **Property Type**: House, duplex, condo, multi-family, mixed use, etc.
- **Key Features**: Standout features (pool, garage, lot size, year built)
- **Link/URL**: If visible in address bar or on the page
- **Status**: For sale, pending, sold, for rent

The user's search was: "${taskDescription}"`;
        }
        // Generic listing/data page extraction for any domain
        return `${baseInstructions}

This appears to be a detailed listing or data page. Extract ALL relevant information visible:

For EACH item/listing you can see, extract:
- **Name/Title**: The main identifier
- **Price/Cost**: Any pricing shown
- **Key Details**: The most important attributes, features, or specifications
- **Rating/Reviews**: If shown
- **Contact/Link**: Any contact info or URLs
- **Location**: If applicable

The user was searching for: "${taskDescription}"
Extract everything relevant to their search.`;

      case PAGE_TYPE.SEARCH_RESULTS:
        return `${baseInstructions}

This is a SEARCH RESULTS PAGE. Extract the key information from the visible results:

For each search result visible, extract:
- **Title**: The blue link text
- **URL**: The green URL shown below the title
- **Snippet**: The description text
- **Any special data**: Prices, ratings, dates shown in the snippet

List each result clearly. The user searched for: "${taskDescription}"`;

      case PAGE_TYPE.CONTENT_PAGE:
        return `${baseInstructions}

This is a CONTENT PAGE. Extract all information relevant to: "${taskDescription}"

Include:
- Main headings and key data points
- Any addresses, prices, statistics, or listings visible
- Contact information if shown
- Links to specific listings or resources
- The website URL from the address bar

Format the information clearly with labels.`;

      default:
        return `${baseInstructions}

The user wants to extract: "${taskDescription}"

Look at the screen and extract ALL relevant information you can see:
- Any addresses, prices, listings, or data points visible
- Any links or URLs shown
- Any important text or numbers
- The website name/URL if visible in the address bar

Format the information in a clear, structured way.`;
    }
  }

  // ═══════════════════════════════════════════════════════
  // FINDINGS COMPILER
  // ═══════════════════════════════════════════════════════

  /**
   * Compile all extracted data from visited pages into a clean summary.
   */
  _compileFindings(query) {
    if (this.extractedPages.length === 0) {
      return 'No data was extracted from any pages.';
    }

    const sections = [];
    
    sections.push(`# Research Results: "${query}"`);
    sections.push(`*Visited ${this.extractedPages.length} pages*\n`);

    for (let i = 0; i < this.extractedPages.length; i++) {
      const page = this.extractedPages[i];
      sections.push(`## Page ${i + 1}: ${page.source}`);
      sections.push(`*Page type: ${page.pageType}*\n`);
      sections.push(page.content);
      sections.push(''); // blank line separator
    }

    sections.push(`---`);
    sections.push(`*Total pages visited: ${this.extractedPages.length} | Links clicked: ${this.visitedLinks.length}*`);

    return sections.join('\n\n');
  }

  // ═══════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════

  /**
   * Use AI vision to analyze a screenshot (quick classification)
   */
  async _analyzeScreenshot(base64Image) {
    const prompt = `You are looking at a screenshot of a computer screen.
Briefly describe:
1. What application/website is open?
2. What is the main content visible? (search results, a webpage, a form, etc.)
3. Are there any important items visible (listings, links, data)?

Be concise — 2-3 sentences max.`;

    try {
      const result = await this._directVision(prompt, base64Image);
      return { summary: result, raw: result };
    } catch (e) {
      return { summary: `Vision analysis failed: ${e.message}`, raw: '' };
    }
  }

  /**
   * Vision analysis via aiManager (uses Claude, OpenAI, etc. — whatever is configured).
   * Falls back to direct Ollama call if aiManager is unavailable.
   */
  async _directVision(prompt, base64Image) {
    // Prefer aiManager so Claude vision is used (no local Ollama required)
    if (this.aiManager?.chatWithVision) {
      try {
        const result = await this.aiManager.chatWithVision(
          prompt,
          `data:image/png;base64,${base64Image}`
        );
        return result.content || result.text || '';
      } catch (e) {
        this.onProgress(`⚠️ aiManager vision failed (${e.message}), falling back to Ollama`);
      }
    }

    // Fallback: direct Ollama call (with 30s timeout to prevent hangs)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llava',
          messages: [{
            role: 'user',
            content: prompt,
            images: [base64Image]
          }],
          stream: false
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Ollama vision returned ${response.status}`);
      }

      const data = await response.json();
      return data.message?.content || '';
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Run an AppleScript command. Returns stdout on success.
   */
  async _runAppleScript(script) {
    if (process.platform !== 'darwin') {
      throw new Error('AppleScript not available on this platform');
    }
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout, stderr) => {
        if (err) {
          this.onProgress(`⚠️ AppleScript error: ${err.message}`);
          reject(err);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Execute JavaScript in Chrome's active tab via AppleScript.
   * Uses temp-file approach to avoid quoting nightmares (proven pattern from DesktopTaskRunner).
   * Requires Chrome → View → Developer → Allow JavaScript from Apple Events.
   * Callers should catch errors and fall back to keyboard shortcuts.
   */
  async _executeJsInChrome(jsCode) {
    if (process.platform === 'win32') {
      // Windows: use CDP via PlatformAdapter
      const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
      const plat = await loadPlatform();
      return plat.executeJsInChrome(jsCode);
    }

    // macOS: AppleScript (unchanged)
    const os = require('os');
    const fsMod = require('fs');
    const { execSync } = require('child_process');
    const tmpFile = require('path').join(os.tmpdir(), `ace_js_${Date.now()}.scpt`);
    const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;

    try {
      fsMod.writeFileSync(tmpFile, appleScript);
      const result = execSync(`osascript "${tmpFile}"`, { timeout: 5000 }).toString().trim();
      try { fsMod.unlinkSync(tmpFile); } catch {}
      return result;
    } catch (e) {
      try { fsMod.unlinkSync(tmpFile); } catch {}
      throw e;
    }
  }

  /**
   * Get the actual screen bounds from macOS (same coordinate system as AppleScript).
   * Caches the result so we only query once per session.
   */
  async _getScreenBounds() {
    if (this._screenBounds) return this._screenBounds;

    if (process.platform === 'win32') {
      // Windows: use PowerShell .NET
      try {
        const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
        const plat = await loadPlatform();
        const bounds = await plat.getScreenBounds();
        this._screenBounds = { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height };
      } catch { /* fall through */ }
    } else {
      // macOS: AppleScript
      try {
        const result = await this._runAppleScript('tell application "Finder" to get bounds of window of desktop');
        const parts = result.split(',').map(s => parseInt(s.trim(), 10));
        if (parts.length === 4 && parts[2] > 0) {
          this._screenBounds = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
        }
      } catch { /* fall through */ }
    }

    if (!this._screenBounds) {
      this._screenBounds = { x: 0, y: 0, w: 1920, h: 1080 };
    }
    return this._screenBounds;
  }

  /**
   * Ensure Chrome has a visible window on the current Space,
   * MAXIMIZED to fill the entire screen for best AI vision coverage.
   * Only resizes once per session — subsequent calls just activate.
   */
  async _ensureChromeWindow() {
    if (process.platform === 'win32') {
      // Windows: launch Chrome/Edge with CDP enabled
      try {
        const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
        const plat = await loadPlatform();
        await plat.launchChromeWithCDP();
        await plat.focusChrome();
        this.chromeMaximized = true;
        this.onProgress('🖥️ Chrome/Edge launched with CDP on Windows');
      } catch (e) {
        this.onProgress(`⚠️ Chrome launch failed: ${e.message}`);
      }
      return;
    }

    // macOS: AppleScript (unchanged)
    const { exec } = require('child_process');

    await new Promise((resolve) => {
      exec('open -a "Google Chrome"', () => resolve());
    });
    await this._wait(500);

    const screen = await this._getScreenBounds();

    try {
      await this._runAppleScript(`
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then
    make new window
  end if
  set bounds of front window to {0, 25, ${screen.w}, ${screen.h - 2}}
end tell
      `);
      await this._runAppleScript('tell application "System Events" to set frontmost of process "Google Chrome" to true');
      this.chromeMaximized = true;
      this.onProgress(`🖥️ Chrome maximized to ${screen.w}x${screen.h - 27} (screen: ${screen.w}x${screen.h})`);
    } catch (e) {
      this.onProgress(`⚠️ Chrome maximize failed: ${e.message}`);
    }
  }

  /**
   * Open a URL in Chrome and ensure Chrome stays in front.
   */
  async _chromeOpenUrl(url) {
    if (process.platform === 'win32') {
      // Windows: create new tab via CDP
      try {
        const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
        const plat = await loadPlatform();
        await plat.cdpCreateTab(url);
      } catch (e) {
        this.onProgress(`⚠️ CDP new tab failed: ${e.message}`);
        // Fallback: navigate current tab
        try {
          const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
          const plat = await loadPlatform();
          await plat.cdpNavigate(url);
        } catch { /* last resort handled by caller */ }
      }
      await this._wait(300);
      return;
    }

    // macOS: AppleScript (unchanged)
    const escaped = url.replace(/"/g, '\\"');
    try {
      await this._runAppleScript(`
        tell application "Google Chrome"
          activate
          if (count of windows) > 0 then
            tell window 1 to make new tab with properties {URL:"${escaped}"}
          else
            open location "${escaped}"
          end if
        end tell
      `);
    } catch (e) {
      this.onProgress(`⚠️ AppleScript new tab failed, using fallback: ${e.message}`);
      const { exec } = require('child_process');
      await new Promise((resolve) => {
        exec(`open -a "Google Chrome" "${url}"`, () => resolve());
      });
    }
    await this._wait(300);
  }

  /**
   * Navigate the CURRENT active tab to a new URL (no new tab).
   * Used by executeGoal() to avoid tab sprawl.
   */
  async _chromeSetCurrentTabUrl(url) {
    if (process.platform === 'win32') {
      // Windows: navigate via CDP JS execution
      try {
        const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
        const plat = await loadPlatform();
        await plat.cdpNavigate(url);
      } catch (e) {
        this.onProgress(`⚠️ CDP navigate failed: ${e.message}`);
      }
      return;
    }

    // macOS: AppleScript
    const escaped = url.replace(/"/g, '\\"');
    try {
      await this._runAppleScript(`
        tell application "Google Chrome"
          activate
          if (count of windows) > 0 then
            set URL of active tab of front window to "${escaped}"
          else
            open location "${escaped}"
          end if
        end tell
      `);
    } catch (e) {
      this.onProgress(`⚠️ AppleScript URL set failed, using address bar: ${e.message}`);
      const robot = require('robotjs');
      robot.keyTap('l', 'command');
      await this._wait(300);
      await this._pasteFromClipboard(url);
      await this._wait(200);
      robot.keyTap('enter');
    }
  }

  /**
   * Close the current search tab and switch back to the dashboard (localhost) tab.
   * Called after a search task completes so the user sees their dashboard, not stale search tabs.
   */
  async _returnToDashboard() {
    if (process.platform === 'win32') {
      // Windows: navigate active tab back to dashboard via CDP
      try {
        await this._executeJsInChrome(`window.location.href = 'http://localhost:3333'`);
        this.onProgress('🏠 Returned to dashboard tab');
      } catch {
        this.onProgress('ℹ️ Could not switch back to dashboard');
      }
      return;
    }

    // macOS: AppleScript
    try {
      await this._runAppleScript(`tell application "Google Chrome"
  activate
  -- Close the current search tab (only if there's more than 1 tab)
  if (count of tabs of front window) > 1 then
    close active tab of front window
  end if
  -- Find and switch to the dashboard tab
  repeat with w in windows
    repeat with i from 1 to count of tabs of w
      if URL of (tab i of w) contains "localhost" then
        set active tab index of w to i
        set index of w to 1
        return
      end if
    end repeat
  end repeat
end tell`);
      this.onProgress('🏠 Returned to dashboard tab');
    } catch (e) {
      this.onProgress(`ℹ️ Could not switch back to dashboard: ${e.message}`);
    }
  }

  /**
   * Force Chrome to the foreground on the current Space.
   * Lightweight — just activates, doesn't resize (already maximized by _ensureChromeWindow).
   */
  async _focusChrome() {
    if (process.platform === 'win32') {
      try {
        const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
        const plat = await loadPlatform();
        await plat.focusChrome();
      } catch { /* best-effort */ }
      await this._wait(200);
      return;
    }

    // macOS: AppleScript
    try {
      await this._runAppleScript('tell application "Google Chrome" to activate');
    } catch { /* best-effort */ }
    await this._wait(200);
  }

  /**
   * Find and activate the Chrome tab whose URL contains `urlContains`.
   * Falls back to generic _focusChrome() if no matching tab is found.
   * This is critical when multiple tabs are open — ensures we type into the right one.
   */
  async _focusChromeTab(urlContains) {
    if (process.platform === 'win32') {
      // Windows: just focus Chrome — CDP doesn't support tab switching by URL easily
      await this._focusChrome();
      await this._wait(600);
      return;
    }

    // macOS: AppleScript tab search
    const safeUrl = urlContains.replace(/"/g, '');
    const script = `tell application "Google Chrome"
  activate
  repeat with w in windows
    repeat with i from 1 to count of tabs of w
      if URL of (tab i of w) contains "${safeUrl}" then
        set active tab index of w to i
        set index of w to 1
        return
      end if
    end repeat
  end repeat
end tell`;
    try {
      await this._runAppleScript(script);
    } catch (e) {
      this.onProgress(`⚠️ Tab focus failed (${e.message}), falling back to _focusChrome`);
      await this._focusChrome();
    }
    await this._wait(600);
  }

  /**
   * Press a keyboard key combo (e.g., Cmd+[)
   */
  async _keyCombo(modifier, key) {
    const robot = require('robotjs');
    robot.keyTap(key, modifier);
    await this._wait(200);
  }

  /**
   * Press a single key
   */
  async _pressKey(key) {
    const robot = require('robotjs');
    robot.keyTap(key);
    await this._wait(200);
  }

  /**
   * Type text slowly, character by character, like a human.
   */
  async _typeSlowly(text, delayPerChar = 50) {
    const robot = require('robotjs');
    for (const char of text) {
      robot.typeString(char);
      await this._wait(delayPerChar + Math.random() * 30);
    }
  }

  /**
   * Wait for a specified number of milliseconds
   */
  async _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  // ═══════════════════════════════════════════════════════
  // ADAPTIVE SEARCH — DuckDuckGo HTML fallback (no browser needed)
  // ═══════════════════════════════════════════════════════

  /**
   * Pure HTTP search via DuckDuckGo HTML endpoint.
   * No browser, no Puppeteer, no detection — just fetch + parse.
   * Used as fallback when Google/Chrome fails or is blocked.
   */
  async duckDuckGoSearch(query) {
    this.onProgress(`🦆 Searching DuckDuckGo (fast HTTP): "${query}"`);

    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      body: `q=${encodeURIComponent(query)}`,
    });

    if (!resp.ok) {
      return { success: false, query, results: [], error: `DDG returned ${resp.status}` };
    }

    const html = await resp.text();
    const results = this._parseDDGHtml(html);

    this.onProgress(`🦆 DuckDuckGo returned ${results.length} results`);

    return {
      success: results.length > 0,
      query,
      results,
      resultCount: results.length,
      source: 'duckduckgo_fetch',
    };
  }

  /**
   * Parse DuckDuckGo HTML search results into structured data.
   */
  _parseDDGHtml(html) {
    const results = [];

    // Match result links: <a class="result__a" href="...">title</a>
    const linkPattern = /<a\s+[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    // Match snippets: <a class="result__snippet" ...>text</a>
    const snippetPattern = /<a\s+[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const links = [];
    let match;
    while ((match = linkPattern.exec(html)) !== null) {
      let url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();

      // DDG wraps URLs in a redirect — extract the real URL
      const realUrl = url.match(/uddg=([^&]+)/);
      if (realUrl) url = decodeURIComponent(realUrl[1]);

      if (title && url && !url.includes('duckduckgo.com')) {
        links.push({ title, url });
      }
    }

    const snippets = [];
    while ((match = snippetPattern.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    for (let i = 0; i < links.length && i < 10; i++) {
      results.push({
        position: i + 1,
        title: links[i].title,
        url: links[i].url,
        snippet: snippets[i] || '',
        source: 'duckduckgo',
      });
    }

    return results;
  }
}
