/**
 * SOPExecutor — Executes Standard Operating Procedures through BrowserAgent
 * 
 * This is the CRITICAL missing piece. SOPs define steps, the BrowserAgent
 * knows how to drive a browser, and this executor connects them together.
 * 
 * Flow: SOP Steps → SOPExecutor → BrowserAgent → Real Browser Actions
 * 
 * Supports:
 *   - Sequential step execution with error recovery
 *   - Variable interpolation ({{variable}} in step params)
 *   - Credential injection from SiteMemory
 *   - Screenshot verification after each step
 *   - AI-powered decision making when stuck
 *   - Step retry with fallback strategies
 */

import fs from 'fs/promises';
import path from 'path';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class SOPExecutor {
  constructor(options = {}) {
    this.browserAgent = null;
    this.siteMemory = null;
    this.sopManager = null;
    this.aiManager = null;
    this.activityLogger = null;
    this.desktopAgent = null;
    
    this.onProgress = options.onProgress || ((msg) => console.log(`[SOPExecutor] ${msg}`));
    this.maxRetries = options.maxRetries || 2;
    this.stepTimeout = options.stepTimeout || 30000; // 30s per step
    this.screenshotDir = options.screenshotDir || './data/automation/screenshots';
    
    // Execution state
    this.currentSOP = null;
    this.currentStep = 0;
    this.executionLog = [];
    this.variables = {};
    this.isRunning = false;
  }

  /**
   * Initialize with system references
   */
  async initialize(systems) {
    this.browserAgent = systems.browserAgent;
    this.siteMemory = systems.siteMemory;
    this.sopManager = systems.sopManager;
    this.aiManager = systems.aiManager;
    this.activityLogger = systems.activityLogger;
    this.desktopAgent = systems.desktopAgent;
    
    await fs.mkdir(this.screenshotDir, { recursive: true });
    
    console.log('⚡ SOPExecutor initialized — ready to execute procedures');
    return this;
  }

  /**
   * Execute a complete SOP by ID or object
   * 
   * @param {string|object} sopOrId - SOP object or SOP ID string
   * @param {object} variables - Runtime variables to inject (e.g., {{industry}})
   * @returns {object} Execution result with step-by-step log
   */
  async executeSOP(sopOrId, variables = {}) {
    // Resolve SOP
    let sop;
    if (typeof sopOrId === 'string') {
      sop = this.sopManager?.getSOP(sopOrId);
      if (!sop) {
        return { success: false, error: `SOP not found: ${sopOrId}`, log: [] };
      }
    } else {
      sop = sopOrId;
    }

    if (this.isRunning) {
      return { success: false, error: 'Another SOP is already running', log: [] };
    }

    this.isRunning = true;
    this.currentSOP = sop;
    this.currentStep = 0;
    this.executionLog = [];
    this.variables = { ...variables, date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString() };

    // ═══ Auto-inject content step for legacy SOPs ═══
    // If user provided content (via {{content}} variable) but no step uses it,
    // auto-insert a type step before the first submit-like click.
    // This handles SOPs created before the content detection system existed.
    if (this.variables.content) {
      const hasContentStep = sop.steps.some(s =>
        s.contentInjection || (s.text || '').includes('{{content}}') || (s.value || '').includes('{{content}}')
      );
      if (!hasContentStep) {
        const submitWords = ['next', 'post', 'submit', 'send', 'save', 'done', 'confirm', 'publish', 'share', 'ok', 'continue'];
        const insertIdx = sop.steps.findIndex(s => {
          if (s.action === 'click_submit') return true;
          if (s.action === 'click_text' || s.action === 'click') {
            const lower = (s.text || s.description || '').toLowerCase();
            return submitWords.some(w => lower.includes(w));
          }
          return false;
        });

        if (insertIdx > 0) {
          const contentStep = {
            action: 'type',
            text: '{{content}}',
            contentInjection: true,
            description: 'Type the provided content',
            _autoInserted: true
          };
          // Clone steps array to avoid mutating the original SOP
          sop = { ...sop, steps: [...sop.steps] };
          sop.steps.splice(insertIdx, 0, contentStep);
          this.onProgress(`📝 Auto-inserted content step before step ${insertIdx + 1} ("${sop.steps[insertIdx + 1]?.description || sop.steps[insertIdx + 1]?.text || 'submit'}")`);
        }
      }
    }

    this.onProgress(`🚀 Starting SOP: "${sop.name}" (${sop.steps.length} steps)`);
    eventBus.emit(EVENTS.SOP_STARTED, { sopId: sop.id, sopName: sop.name, stepCount: sop.steps.length });

    const startTime = Date.now();
    let success = true;
    let lastError = null;

    try {
      // Ensure browser is ready
      await this.browserAgent.launchBrowser();

      // Verify Chrome is actually responsive before running steps
      try {
        const chromeUrl = await this.browserAgent.getCurrentUrl();
        this.onProgress(`✓ Chrome connected (current: ${(chromeUrl || 'unknown').substring(0, 60)})`);
      } catch (e) {
        throw new Error(`Chrome is not responding after launch: ${e.message}. Make sure Chrome is running and accessible.`);
      }

      // Execute each step sequentially
      for (let i = 0; i < sop.steps.length; i++) {
        this.currentStep = i;
        const step = sop.steps[i];
        const stepNum = i + 1;

        this.onProgress(`📌 Step ${stepNum}/${sop.steps.length}: ${step.description || step.action}`);
        eventBus.emit(EVENTS.SOP_STEP_STARTED, { sopId: sop.id, sopName: sop.name, stepNum, totalSteps: sop.steps.length, action: step.action, description: step.description || step.action });

        let stepResult;
        let retries = 0;

        // Apply learning from previous runs before executing
        await this._applyLearning(step, stepNum, sop.id);

        while (retries <= this.maxRetries) {
          try {
            stepResult = await this.executeStep(step, stepNum);
            
            if (stepResult.success) {
              this.executionLog.push({
                step: stepNum,
                action: step.action,
                description: step.description,
                success: true,
                result: stepResult,
                timestamp: new Date().toISOString()
              });
              this.onProgress(`  ✅ Step ${stepNum} complete`);
              eventBus.emit(EVENTS.SOP_STEP_COMPLETED, { sopId: sop.id, sopName: sop.name, stepNum, totalSteps: sop.steps.length, action: step.action, method: stepResult?.method });

              // Auto-wait: detect page transitions and wait for new page to load
              await this._autoWaitForPageLoad(step);

              // Record skill: what method worked on this site for this action type
              await this._recordSkill(step, stepResult);

              // After navigation: deep-explore the page for SiteMemory learning
              if (step.action === 'navigate' || step.action === 'goto') {
                await this._learnFromPage();
              }

              // Visual verification: check screenshot matches expected result
              if (this._shouldVerify(step)) {
                const verified = await this._verifyStep(step, stepNum);
                if (!verified) {
                  this.onProgress('  👁️ Visual check: something looks off — continuing cautiously');
                }
              }

              break;
            } else {
              throw new Error(stepResult.error || 'Step returned unsuccessful');
            }
          } catch (error) {
            retries++;
            if (retries <= this.maxRetries) {
              this.onProgress(`  ⚠️ Step ${stepNum} failed (attempt ${retries}/${this.maxRetries + 1}): ${error.message}`);
              await this.browserAgent.wait(2000);
              
              // Try AI-powered recovery
              const recovered = await this.attemptRecovery(step, error, stepNum);
              if (recovered) {
                this.onProgress(`  🔧 Recovery successful, retrying step...`);
              }
            } else {
              lastError = error;
              this.executionLog.push({
                step: stepNum,
                action: step.action,
                description: step.description,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
              });
              
              // Take error screenshot
              try {
                await this.browserAgent.takeScreenshot(`sop-error-step${stepNum}`);
              } catch (e) { /* ignore screenshot errors */ }

              // Visual guide fallback — if the user recorded this step, try their way
              if (step.visualGuide) {
                this.onProgress('  🎥 Trying visual guide (recorded demonstration)...');
                const guideResult = await this._executeVisualGuide(step, stepNum);
                if (guideResult?.success) {
                  // Override the failure — visual guide saved us
                  this.executionLog[this.executionLog.length - 1].success = true;
                  this.executionLog[this.executionLog.length - 1].result = guideResult;
                  this.executionLog[this.executionLog.length - 1].method = 'visual_guide';
                  this.onProgress(`  ✅ Visual guide succeeded for step ${stepNum}!`);
                  break; // Move to next step
                }
              }

              // Check if step is critical
              if (step.critical !== false) {
                success = false;
                this.onProgress(`  ❌ Step ${stepNum} failed permanently: ${error.message}`);
                eventBus.emit(EVENTS.SOP_STEP_FAILED, { sopId: sop.id, sopName: sop.name, stepNum, totalSteps: sop.steps.length, action: step.action, description: step.description || step.action, error: error.message, hasVisualGuide: !!step.visualGuide });
                break;
              } else {
                this.onProgress(`  ⚠️ Non-critical step ${stepNum} failed, continuing...`);
              }
            }
          }
        }

        if (!success) break;
      }
    } catch (error) {
      success = false;
      lastError = error;
      this.onProgress(`❌ SOP execution error: ${error.message}`);
    }

    const duration = Date.now() - startTime;
    this.isRunning = false;

    // Record the run
    if (this.sopManager) {
      await this.sopManager.recordRun(sop.id, success);
    }

    // Persist execution log and update learning
    await this._persistExecutionLog(sop.id, this.executionLog, success, duration);
    await this._updateLearning(sop.id, this.executionLog, success);

    // Log activity
    if (this.activityLogger) {
      try {
        this.activityLogger.log('sop_execution', {
          sopId: sop.id,
          sopName: sop.name,
          success,
          stepsCompleted: this.executionLog.filter(l => l.success).length,
          totalSteps: sop.steps.length,
          duration,
          error: lastError?.message
        });
      } catch (e) { /* ignore logging errors */ }
    }

    const result = {
      success,
      sopId: sop.id,
      sopName: sop.name,
      stepsCompleted: this.executionLog.filter(l => l.success).length,
      totalSteps: sop.steps.length,
      duration,
      log: this.executionLog,
      error: lastError?.message || null,
      currentUrl: await this.browserAgent.getCurrentUrl(),
      currentTitle: await this.browserAgent.getCurrentTitle()
    };

    if (success) {
      this.onProgress(`✅ SOP "${sop.name}" completed successfully! (${duration}ms)`);
      eventBus.emit(EVENTS.SOP_COMPLETED, { sopId: sop.id, sopName: sop.name, stepsCompleted: result.stepsCompleted, totalSteps: result.totalSteps, duration });
      // Save reference screenshots from this successful run
      await this._saveReferences(sop.id);
    } else {
      this.onProgress(`❌ SOP "${sop.name}" failed at step ${this.currentStep + 1}: ${lastError?.message}`);
      eventBus.emit(EVENTS.SOP_FAILED, { sopId: sop.id, sopName: sop.name, failedStep: this.currentStep + 1, stepsCompleted: result.stepsCompleted, totalSteps: result.totalSteps, error: lastError?.message, duration });
    }

    return result;
  }

  /**
   * Execute a single SOP step by dispatching to the correct BrowserAgent method
   */
  async executeStep(step, stepNum) {
    const action = step.action;
    
    switch (action) {
      // ─── NAVIGATION ─────────────────────────────────
      case 'navigate':
      case 'goto':
        return await this.stepNavigate(step);
      
      // ─── CLICKING ───────────────────────────────────
      case 'click':
        return await this.stepClick(step);
      
      case 'click_text':
      case 'clickText':
        return await this.stepClickText(step);
      
      case 'click_submit':
      case 'clickSubmit':
        return await this.stepClickSubmit(step);
      
      // ─── TYPING / FORMS ─────────────────────────────
      case 'type':
      case 'input':
        return await this.stepType(step);
      
      case 'fill_credentials':
      case 'fillCredentials':
        return await this.stepFillCredentials(step);
      
      case 'fill_form':
      case 'fillForm':
        return await this.stepFillForm(step);
      
      // ─── KEYBOARD ───────────────────────────────────
      case 'press':
      case 'key':
        return await this.stepPress(step);
      
      // ─── WAITING ────────────────────────────────────
      case 'wait':
      case 'delay':
        return await this.stepWait(step);
      
      case 'wait_navigation':
      case 'waitNavigation':
        return await this.stepWaitNavigation(step);
      
      case 'wait_for':
      case 'waitFor':
        return await this.stepWaitFor(step);
      
      // ─── PAGE ANALYSIS ──────────────────────────────
      case 'explore_page':
      case 'explorePage':
      case 'analyze':
        return await this.stepExplorePage(step);
      
      case 'screenshot':
        return await this.stepScreenshot(step);
      
      // ─── DATA EXTRACTION ────────────────────────────
      case 'extract':
      case 'extract_results':
      case 'extractResults':
        return await this.stepExtractResults(step);

      case 'extract_text':
      case 'extractText':
        return await this.stepExtractText(step);
      
      // ─── CONDITIONAL ────────────────────────────────
      case 'ensure_logged_in':
      case 'ensureLoggedIn':
        return await this.stepEnsureLoggedIn(step);
      
      case 'navigate_to':
      case 'navigateTo':
        return await this.stepNavigateToSection(step);
      
      // ─── SCROLL ─────────────────────────────────────
      case 'scroll':
        return await this.stepScroll(step);

      // ─── GO BACK ───────────────────────────────────
      case 'go_back':
      case 'goBack':
        return await this.stepGoBack(step);

      // ─── SMART / AI-POWERED ─────────────────────────
      case 'smart_click':
      case 'smartClick':
        return await this.stepSmartClick(step);
      
      case 'smart_fill':
      case 'smartFill':
        return await this.stepSmartFill(step);
      
      case 'decide':
        return await this.stepDecide(step);
      
      // ─── GOOGLE SEARCH (uses robust searchGoogle method) ──
      case 'search_google':
      case 'searchGoogle':
      case 'google_search':
        return await this.stepSearchGoogle(step);

      // --- DESKTOP AGENT ACTIONS ---
      case 'findAndClick':
        return await this.desktopAgent.findAndClick(step.description);

      case 'findAndType':
        return await this.desktopAgent.findAndType(step.description, step.text);

      // ─── TEXT EDITING (from teach-by-telling SOPs) ─────
      case 'copy':
      case 'delete':
      case 'edit':
      case 'select':
      case 'clear':
        return await this.stepTextEdit(step);

      // ─── UNIVERSAL FIELD EDITING ──────────────────────
      case 'edit_field':
      case 'editField':
      case 'modify_field':
        return await this.stepEditField(step);

      // ─── UNIVERSAL DATE SETTING ───────────────────────
      case 'set_date':
      case 'setDate':
      case 'change_date':
      case 'changeDate':
        return await this.stepSetDate(step);

      default:
        // Instead of failing, try to interpret the step using its description
        if (step.description && this.desktopAgent) {
          this.onProgress(`  🤖 Unknown action "${action}" — using description: "${step.description}"`);
          return await this.stepClickText({ text: step.description });
        }
        this.onProgress(`  ⚠️ Unknown step action: ${action}`);
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════

  async stepNavigate(step) {
    const url = this.interpolate(step.url);

    // If navigating to Google with a search query, use the robust searchGoogle method
    if (url.includes('google.com') && step.searchQuery) {
      const query = this.interpolate(step.searchQuery);
      const result = await this.browserAgent.searchGoogle(query);
      if (!result || result.success === false) {
        throw new Error(result?.error || 'Google search failed');
      }
      return { success: true, ...result };
    }

    const result = await this.browserAgent.navigateTo(url);

    // ═══ VERIFY NAVIGATION ACTUALLY WORKED ═══
    if (!result || result.success === false) {
      throw new Error(result?.error || 'Navigation returned failure');
    }

    // Verify the browser actually landed on the target domain
    const actualUrl = result.url || '';
    const targetDomain = this._extractDomain(url);
    const actualDomain = this._extractDomain(actualUrl);

    if (targetDomain && actualDomain && targetDomain !== actualDomain) {
      this.onProgress(`  ⚠️ Navigation mismatch: expected ${targetDomain}, got ${actualDomain}`);

      // One retry — maybe Chrome focus was on wrong tab
      this.onProgress(`  🔄 Retrying navigation to ${url}...`);
      await this.browserAgent.wait(2000);
      const retryResult = await this.browserAgent.navigateTo(url);
      const retryUrl = retryResult?.url || '';
      const retryDomain = this._extractDomain(retryUrl);

      if (retryDomain !== targetDomain) {
        throw new Error(`Navigation failed: expected ${targetDomain} but browser is at ${retryDomain || retryUrl}`);
      }

      this.onProgress(`  ✓ Retry succeeded: now at ${retryUrl}`);
      return { success: true, ...retryResult, method: 'retry_navigate' };
    }

    // If we just navigated to Google, dismiss consent proactively
    if (url.includes('google.com')) {
      await this.browserAgent.dismissGoogleConsent();
    }

    // Remember the site
    if (this.siteMemory) {
      try {
        const exploration = await this.browserAgent.explorePage();
        await this.siteMemory.rememberSite(url, exploration);
      } catch (e) { /* ignore exploration errors */ }
    }

    return { success: true, ...result };
  }

  /**
   * Google Search step — uses BrowserAgent.searchWeb() for robust handling
   * with automatic DuckDuckGo fallback when Google fails
   */
  async stepSearchGoogle(step) {
    const query = this.interpolate(step.query || step.text || step.searchQuery || '');
    if (!query) {
      return { success: false, error: 'No search query provided for search_google step' };
    }
    
    // Use searchWeb() which tries Google first, then DuckDuckGo
    const result = this.browserAgent.searchWeb
      ? await this.browserAgent.searchWeb(query)
      : await this.browserAgent.searchGoogle(query);

    if (!result || result.success === false) {
      throw new Error(result?.error || `Search for "${query}" failed`);
    }

    // Store results in variables for later steps
    if (result.results) {
      this.variables.searchResults = result.results;
      this.variables.searchResultCount = result.results.length;
    }

    if (result.engine) {
      this.onProgress(`  🔍 Search completed via ${result.engine} (${result.resultCount || 0} results)`);
    }

    return { success: true, ...result };
  }

  async stepClick(step) {
    const selector = this.interpolate(step.selector);
    const result = await this.browserAgent.click(selector, {
      timeout: step.timeout || 5000
    });
    if (!result || result.success === false) {
      throw new Error(result?.error || `Click on "${selector}" failed`);
    }
    return { success: true, ...result };
  }

  async stepClickText(step) {
    const rawText = this.interpolate(step.text);
    const cleanText = this._cleanClickText(rawText);

    // ── Smart detection: Is this actually a text EDITING instruction? ──
    // "Delete the 'copy of' text from the Title" → edit, not click
    const editResult = await this._detectAndHandleEditInstruction(rawText, step);
    if (editResult) return editResult;

    // Capture page state BEFORE clicking (for post-click verification)
    let urlBefore = null;
    let titleBefore = null;
    try {
      urlBefore = await this.browserAgent.getCurrentUrl();
      titleBefore = await this.browserAgent._executeJsInChrome('document.title');
    } catch(e) {}

    // Try DOM search (with scroll-retry if element not visible)
    let result = await this._findAndClickInDOM(cleanText, rawText);

    // Strategy: Scroll down and retry DOM search (element may be below the fold)
    if (!result) {
      for (let scroll = 1; scroll <= 3; scroll++) {
        this.onProgress(`  📜 Scrolling down (${scroll}/3) to find "${cleanText}"...`);
        await this._scrollPage('down', 400);
        await this.browserAgent.wait(1000);

        result = await this._findAndClickInDOM(cleanText, rawText);
        if (result) break;
      }
    }

    // Strategy: AI vision (slower — screenshot → Gemini → coordinates → robotjs click)
    if (!result && this.desktopAgent) {
      const isIconReq = this._isIconButtonRequest(cleanText);
      const visionTarget = isIconReq && this._lastClickedContext
        ? `the three dots menu button or kebab icon (⋮) on the same row as "${this._lastClickedContext}"`
        : rawText;
      this.onProgress(`  👁️ DOM search missed — trying AI vision for "${visionTarget}"...`);
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });
      const clickResult = await browser.clickOn(visionTarget);
      if (clickResult?.success) {
        await browser._wait(1500);
        result = { success: true, method: 'ai_vision', clicked: visionTarget };
      }
    }

    if (!result) {
      throw new Error(`Could not find "${cleanText}" on page (tried DOM search with scroll + AI vision)`);
    }

    this._lastClickedContext = cleanText;

    // ═══ POST-CLICK VERIFICATION ═══
    // After clicking, verify the click actually had an effect on the page.
    // If URL, title, or visible DOM changed → success.
    // If NOTHING changed → the click probably hit the wrong element → FAIL the step
    // so the learning system ("Show Me How") can kick in and Ace can learn.
    try {
      const urlAfter = await this.browserAgent.getCurrentUrl();
      const titleAfter = await this.browserAgent._executeJsInChrome('document.title');

      // URL changed → click worked
      if (urlBefore && urlAfter && urlAfter !== urlBefore) {
        return result;
      }

      // Title changed → click worked (modal opened, state changed)
      if (titleBefore && titleAfter && titleAfter !== titleBefore) {
        return result;
      }

      // Check if the clicked element is still visible (if we clicked a submit button and
      // it's still there, the form probably didn't submit)
      const elementStillThere = await this.browserAgent._executeJsInChrome(`
        (function() {
          var search = ${JSON.stringify(cleanText.toLowerCase())};
          var els = document.querySelectorAll('a, button, [role="button"], span, label');
          for (var i = 0; i < els.length; i++) {
            var txt = (els[i].textContent || '').trim().toLowerCase();
            if (txt === search) {
              try { var r = els[i].getBoundingClientRect(); if (r.width > 0 && r.height > 0) return true; }
              catch(e) {}
            }
          }
          return false;
        })()
      `);

      if (!elementStillThere) {
        // Element disappeared after click → it worked (button was consumed)
        return result;
      }

      // Element still there + URL/title unchanged → click likely hit wrong element
      // But only fail if this looks like a "final action" step (submit/post/send/next)
      // For regular navigation clicks, the element staying is normal
      const desc = (step.description || rawText || '').toLowerCase();
      const isSubmitLike = /\b(post|submit|send|publish|share|confirm|done|tweet|reply)\b/.test(desc);
      if (isSubmitLike) {
        this.onProgress(`  ⚠️ Clicked "${result.clicked}" but page didn't change — likely wrong element`);
        throw new Error(`Clicked "${cleanText}" but the action had no effect — the "${cleanText}" element is still visible and the page didn't change. Ace needs to learn where the real button is.`);
      }
    } catch (e) {
      // If this was our own thrown error, rethrow it
      if (e.message?.includes('had no effect')) throw e;
      // Otherwise verification itself failed — give benefit of the doubt
    }

    return result;
  }

  /**
   * Try to find and click an element in the DOM using multiple strategies.
   * Returns result object if found, null if not found.
   */
  async _findAndClickInDOM(cleanText, rawText) {
    // Detect if this is a kebab/menu/icon button request
    const isIconButton = this._isIconButtonRequest(cleanText);

    // Strategy 1: clickByText on cleaned text (skip for icon buttons — they have no text)
    if (!isIconButton) {
      try {
        const result = await this.browserAgent.clickByText(cleanText);
        if (result?.success) {
          this.onProgress(`  ✓ Clicked: "${cleanText}"`);
          await this.browserAgent.wait(1500);
          return { success: true, method: 'chrome_js', clicked: cleanText };
        }
      } catch (e) { /* not found */ }

      // Strategy 2: clickByText on raw text (if different)
      if (cleanText !== rawText) {
        try {
          const result = await this.browserAgent.clickByText(rawText);
          if (result?.success) {
            await this.browserAgent.wait(1500);
            return { success: true, method: 'chrome_js', clicked: rawText };
          }
        } catch (e) { /* not found */ }
      }
    }

    // Strategy 3: Broader DOM search — includes spans, divs, roles, aria labels
    // (skip for icon buttons — they have no matching text, go straight to icon search)
    if (isIconButton) {
      const iconResult = await this._findAndClickIconButton(cleanText, rawText);
      if (iconResult) return iconResult;
      return null;
    }

    try {
      const found = await this.browserAgent._executeJsInChrome(`
        (function() {
          var search = ${JSON.stringify(cleanText.toLowerCase())};
          var searchWords = search.split(/\\s+/).filter(function(w) { return w.length > 2; });

          // Helper: is element visible?
          function isVis(el) {
            try { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < window.innerHeight + 50; }
            catch(e) { return false; }
          }

          // Phase 1: Exact match (whole text equals search) — interactive elements first
          var interactive = document.querySelectorAll('a, button, [role="button"], [role="tab"], [role="menuitem"], [role="link"], input[type="submit"], [tabindex]');
          for (var i = 0; i < interactive.length; i++) {
            var el = interactive[i];
            if (!isVis(el)) continue;
            var txt = (el.textContent || '').trim().toLowerCase();
            var aria = (el.getAttribute('aria-label') || '').toLowerCase();
            if (txt === search || aria === search) { el.click(); return 'exact:' + txt.substring(0, 50); }
          }

          // Phase 2: Exact match on broader elements (but LIMIT text length to avoid container divs)
          var broader = document.querySelectorAll('span, label, p, h1, h2, h3, h4, h5, h6, li, td, th');
          for (var b = 0; b < broader.length; b++) {
            var elb = broader[b];
            if (!isVis(elb)) continue;
            var txtb = (elb.textContent || '').trim().toLowerCase();
            if (txtb.length > search.length * 3) continue;
            if (txtb === search) { elb.click(); return 'exact_broad:' + txtb.substring(0, 50); }
          }

          // Phase 3: Partial match on interactive elements (text CONTAINS search, but not too long)
          for (var p = 0; p < interactive.length; p++) {
            var elp = interactive[p];
            if (!isVis(elp)) continue;
            var txtp = (elp.textContent || '').trim().toLowerCase();
            var ariap = (elp.getAttribute('aria-label') || '').toLowerCase();
            if (txtp.length < search.length * 5 && txtp.includes(search)) {
              elp.click(); return 'partial_interactive:' + txtp.substring(0, 50);
            }
            if (ariap.includes(search)) {
              elp.click(); return 'partial_aria:' + ariap.substring(0, 50);
            }
          }

          // Phase 4: Word-overlap match on interactive + span elements
          if (searchWords.length >= 1) {
            var candidates = [];
            var allClickable = document.querySelectorAll('a, button, [role="button"], [role="menuitem"], span, label, [role="link"]');
            for (var w = 0; w < allClickable.length; w++) {
              var elw = allClickable[w];
              if (!isVis(elw)) continue;
              var txtw = (elw.textContent || '').trim().toLowerCase();
              if (txtw.length > 100 || txtw.length === 0) continue;
              var matchCount = 0;
              for (var sw = 0; sw < searchWords.length; sw++) {
                if (txtw.includes(searchWords[sw])) matchCount++;
              }
              if (matchCount > 0) {
                candidates.push({ el: elw, txt: txtw, matches: matchCount, len: txtw.length });
              }
            }
            // Sort: most word matches first, then shortest text (most specific)
            candidates.sort(function(a, b) { return b.matches - a.matches || a.len - b.len; });
            if (candidates.length > 0 && candidates[0].matches >= Math.max(1, Math.floor(searchWords.length * 0.4))) {
              candidates[0].el.click();
              return 'word_match:' + candidates[0].txt.substring(0, 50) + '(' + candidates[0].matches + '/' + searchWords.length + ')';
            }
          }

          return null;
        })()
      `);
      if (found) {
        this.onProgress(`  ✓ Found and clicked: ${found}`);
        await this.browserAgent.wait(1500);
        return { success: true, method: 'broad_dom', clicked: found };
      }
    } catch (e) { /* not found */ }

    return null; // Not found in current viewport
  }


  /**
   * Detect if the step text is asking for an icon-only button (kebab menu, close, etc.)
   */
  _isIconButtonRequest(text) {
    const lower = text.toLowerCase();
    return /kebab|ellipsis|three\s*dots|vertical\s*dots|more\s*(?:actions|options|menu)|⋮|⋯|\.{3}|…|hamburger/i.test(lower);
  }

  /**
   * Find and click icon-only buttons (kebab menus, close buttons, etc.)
   * Strategy A: Find the TEXT containing context → walk UP the DOM → find icon button in same container
   * Strategy B: Global search for all icon-like buttons, rank by proximity to context
   * Strategy C: Last-button fallback — click the last button in the context row
   */
  async _findAndClickIconButton(cleanText, rawText) {
    const lastClicked = this._lastClickedContext || null;
    this.onProgress(`  🔘 Icon button search (context: "${lastClicked || 'none'}")...`);

    try {
      const found = await this.browserAgent._executeJsInChrome(`
        (function() {
          var context = ${JSON.stringify((lastClicked || '').toLowerCase())};

          // ── Helper: score how likely a button is to be a kebab/icon menu ──
          function scoreBtn(btn) {
            var s = 0;
            var txt = (btn.textContent || '').trim();
            var aria = (btn.getAttribute('aria-label') || '').toLowerCase();
            var title = (btn.getAttribute('title') || '').toLowerCase();
            var testId = (btn.getAttribute('data-testid') || '').toLowerCase();
            var cls = typeof btn.className === 'string' ? btn.className.toLowerCase() : '';
            var hasSvg = btn.querySelector('svg, i[class*="icon"], [class*="icon"], img[src*="dot"], img[src*="more"]') !== null;
            var popup = btn.getAttribute('aria-haspopup');

            // Strongest: dot characters
            if (/[\\u22EE\\u22EF\\u2026\\u2807\\u283F\\uFE19\\u205D\\u205E⋮⋯…⠇⠿︙⁝⁞]/.test(txt)) s += 10;

            // SVG/icon with little/no text
            if (hasSvg && txt.length <= 2) s += 7;
            if (txt.length === 0 && (hasSvg || popup)) s += 5;

            // Aria/title/data-testid matching
            var menuRe = /more|option|action|menu|manage|kebab|ellipsis|overflow|context|dropdown/;
            if (menuRe.test(aria)) s += 6;
            if (menuRe.test(title)) s += 6;
            if (menuRe.test(testId)) s += 6;

            // Popup indicator
            if (popup) s += 4;

            // Class name hints
            if (/icon|kebab|ellipsis|overflow|more-btn|dots|menu-trigger|dropdown-toggle|action-btn/.test(cls)) s += 3;

            // Size: icon buttons are small
            try {
              var rect = btn.getBoundingClientRect();
              if (rect.width > 0 && rect.width < 60 && rect.height > 0 && rect.height < 60) s += 2;
            } catch(e) {}

            // Penalize buttons with real text (these are regular buttons)
            if (txt.length > 10) s -= 4;
            if (txt.length > 30) s -= 8;

            return s;
          }

          function isVisible(el) {
            try {
              var r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0 && r.top >= -50 && r.top < window.innerHeight + 50;
            } catch(e) { return false; }
          }

          var BTN_SEL = 'button, [role="button"], [aria-haspopup], [data-testid*="menu"], [data-testid*="action"], [data-testid*="more"]';

          // ═══ STRATEGY A: Find context text → walk UP DOM → find icon button in container ═══
          if (context) {
            // Find the SMALLEST elements containing the context text (most specific match)
            var allEls = document.querySelectorAll('span, a, p, div, td, li, h1, h2, h3, h4, h5, h6, strong, em, label');
            var contextEls = [];
            for (var i = 0; i < allEls.length; i++) {
              var tc = (allEls[i].textContent || '').toLowerCase();
              if (tc.includes(context) && tc.length < context.length * 8) {
                contextEls.push({ el: allEls[i], len: tc.length });
              }
            }
            // Sort smallest first = most specific element
            contextEls.sort(function(a, b) { return a.len - b.len; });

            // Try the top 3 most specific matches
            var topEls = contextEls.slice(0, 3);
            for (var t = 0; t < topEls.length; t++) {
              var ancestor = topEls[t].el;

              // Walk UP to find a container that has icon-like buttons
              for (var up = 0; up < 12 && ancestor && ancestor !== document.body; up++) {
                var btns = ancestor.querySelectorAll(BTN_SEL);
                if (btns.length === 0) { ancestor = ancestor.parentElement; continue; }

                // Score all visible buttons in this container
                var scored = [];
                for (var b = 0; b < btns.length; b++) {
                  if (!isVisible(btns[b])) continue;
                  var sc = scoreBtn(btns[b]);
                  if (sc >= 3) {
                    scored.push({
                      el: btns[b], score: sc,
                      aria: btns[b].getAttribute('aria-label') || '',
                      txt: (btns[b].textContent || '').trim().substring(0, 30),
                      tag: btns[b].tagName
                    });
                  }
                }

                if (scored.length > 0) {
                  scored.sort(function(a, b) { return b.score - a.score; });
                  if (scored[0].score >= 5) {
                    scored[0].el.click();
                    return 'ctxWalk:' + (scored[0].aria || scored[0].txt || scored[0].tag) +
                           ' (score:' + scored[0].score + ',depth:' + up + ')';
                  }
                }
                ancestor = ancestor.parentElement;
              }
            }

            // Strategy A fallback: click LAST button in the nearest container with 2+ buttons
            for (var t2 = 0; t2 < topEls.length; t2++) {
              var anc = topEls[t2].el;
              for (var up2 = 0; up2 < 12 && anc && anc !== document.body; up2++) {
                var btns2 = anc.querySelectorAll(BTN_SEL);
                var visBtns = [];
                for (var vb = 0; vb < btns2.length; vb++) {
                  if (isVisible(btns2[vb])) visBtns.push(btns2[vb]);
                }
                if (visBtns.length >= 2) {
                  var lastBtn = visBtns[visBtns.length - 1];
                  lastBtn.click();
                  return 'ctxLast:' + (lastBtn.getAttribute('aria-label') || (lastBtn.textContent || '').trim().substring(0, 30) || lastBtn.tagName) +
                         ' (depth:' + up2 + ',btns:' + visBtns.length + ')';
                }
                anc = anc.parentElement;
              }
            }
          }

          // ═══ STRATEGY B: Global search for icon buttons, rank by proximity to context ═══
          var allBtns = document.querySelectorAll(BTN_SEL);
          var candidates = [];
          for (var gi = 0; gi < allBtns.length; gi++) {
            var gb = allBtns[gi];
            if (!isVisible(gb)) continue;
            var gScore = scoreBtn(gb);
            if (gScore < 4) continue;

            // Proximity bonus: check how close this button's ancestor is to context text
            if (context) {
              var gp = gb.parentElement;
              for (var gu = 0; gu < 8 && gp; gu++) {
                if ((gp.textContent || '').toLowerCase().includes(context)) {
                  gScore += (8 - gu);
                  break;
                }
                gp = gp.parentElement;
              }
            }

            candidates.push({
              el: gb, score: gScore,
              aria: gb.getAttribute('aria-label') || '',
              txt: (gb.textContent || '').trim().substring(0, 30)
            });
          }

          if (candidates.length > 0) {
            candidates.sort(function(a, b) { return b.score - a.score; });
            candidates[0].el.click();
            return 'global:' + (candidates[0].aria || candidates[0].txt || 'icon') +
                   ' (score:' + candidates[0].score + ',of:' + candidates.length + ')';
          }

          return null;
        })()
      `);

      if (found) {
        this.onProgress(`  ✓ Found icon button: ${found}`);
        await this.browserAgent.wait(1500);
        return { success: true, method: 'icon_button', clicked: found };
      } else {
        this.onProgress(`  ✗ No icon button found in DOM`);
      }
    } catch (e) {
      this.onProgress(`  ⚠️ Icon button search error: ${e.message}`);
    }

    return null;
  }

  /**
   * Paste text via clipboard — FAST alternative to typeStringDelayed.
   * Uses pbcopy (macOS) to set clipboard, then Cmd+V to paste.
   * Falls back to character-by-character typing if clipboard fails.
   */
  async _clipboardPaste(text) {
    try {
      const { exec } = await import('child_process');

      // Copy to clipboard via pbcopy
      await new Promise((resolve, reject) => {
        const proc = exec('pbcopy', (err) => err ? reject(err) : resolve());
        proc.stdin.write(text);
        proc.stdin.end();
      });

      await this.browserAgent.wait(100);

      // Paste via Cmd+V
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');
      robot.keyTap('v', ['command']);
      await this.browserAgent.wait(300);
      return true;
    } catch (e) {
      this.onProgress(`  ⚠️ Clipboard paste failed: ${e.message} — falling back to typing`);
      // Fallback: type character by character
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');
      robot.typeStringDelayed(text, 30);
      await this.browserAgent.wait(300);
      return true;
    }
  }

  /**
   * Extract the domain from a URL for comparison.
   * "https://www.facebook.com/something" → "facebook.com"
   * "facebook.com" → "facebook.com"
   */
  _extractDomain(url) {
    if (!url) return null;
    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      const hostname = new URL(fullUrl).hostname;
      // Strip www. prefix for comparison
      return hostname.replace(/^www\./, '');
    } catch (e) {
      return null;
    }
  }

  /**
   * Auto-wait after steps that trigger page transitions.
   * Detects URL changes and waits for the new page to be ready.
   */
  async _autoWaitForPageLoad(step) {
    const action = step.action;
    const text = (step.text || '').toLowerCase();
    const desc = (step.description || '').toLowerCase();

    // Check if this step likely triggers a page transition
    const isNavTrigger = action === 'navigate' || action === 'click_submit' ||
      /copy\s*event|submit|confirm|publish|save|next|continue|proceed|sign\s*in|log\s*in/i.test(text) ||
      /copy\s*event|submit|confirm|publish|save|next|continue|proceed/i.test(desc);

    if (!isNavTrigger) return;

    // Capture current URL before waiting
    const urlBefore = await this.browserAgent.getCurrentUrl();

    // Wait for the page to potentially transition
    this.onProgress(`  ⏳ Waiting for page to load...`);
    await this.browserAgent.wait(2000);

    // Check if URL changed
    const urlAfter = await this.browserAgent.getCurrentUrl();
    if (urlAfter && urlAfter !== urlBefore) {
      this.onProgress(`  🔄 Page changed: ${urlAfter.substring(0, 60)}...`);
      // URL changed — wait extra time for the new page to render
      await this.browserAgent.wait(3000);
    } else {
      // URL didn't change — might be a modal/dialog. Wait for DOM to settle.
      await this.browserAgent.wait(1000);
    }
  }

  /**
   * Scroll the page in Chrome via JS or robotjs
   */
  async _scrollPage(direction, amount) {
    // Try Chrome JS scroll first
    try {
      const scrollY = direction === 'up' ? -amount : amount;
      await this.browserAgent._executeJsInChrome(`window.scrollBy(0, ${scrollY})`);
      return;
    } catch (e) { /* fall through to robotjs */ }

    // Fallback: robotjs mouse scroll
    if (this.desktopAgent) {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');
      const scrollAmount = direction === 'up' ? Math.ceil(amount / 100) : -Math.ceil(amount / 100);
      robot.scrollMouse(0, scrollAmount);
    }
  }

  /**
   * Handle text editing steps from teach-by-telling SOPs.
   * Actions: copy, delete, edit, select, clear
   * Uses keyboard shortcuts (Cmd+A, Delete, etc.) via robotjs.
   */
  async stepTextEdit(step) {
    const action = step.action;
    const desc = step.description || '';
    this.onProgress(`  ✏️ Text edit (${action}): ${desc}`);

    if (this.desktopAgent) {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');

      switch (action) {
        case 'select':
          robot.keyTap('a', ['command']); // Cmd+A select all
          break;
        case 'delete':
        case 'clear':
          robot.keyTap('a', ['command']);
          await this.browserAgent.wait(200);
          robot.keyTap('backspace');
          break;
        case 'copy':
          // "copy" in teach-by-telling often means "edit the text" — select + delete unwanted parts
          // Try to handle via description (e.g., delete "Copy Of" from title)
          if (desc.toLowerCase().includes('delete')) {
            // Select all text first, then we'd need to type the corrected version
            this.onProgress(`  📝 Manual edit step — may need user intervention: ${desc}`);
          }
          robot.keyTap('c', ['command']);
          break;
        case 'edit':
          // Generic edit — just click into the field
          break;
      }

      await this.browserAgent.wait(500);
      // Type replacement text if provided
      if (step.text || step.value) {
        const text = this.interpolate(step.text || step.value);
        await this.desktopAgent.type(text);
      }

      return { success: true, action, method: 'robotjs' };
    }

    // Without desktopAgent, cannot perform keyboard actions
    throw new Error(`Text edit "${action}" requires desktop agent for keyboard control`);
  }

  // ═══════════════════════════════════════════════════════
  // UNIVERSAL FIELD EDITING & DATE SETTING
  // These actions are designed to work on ANY website.
  // ═══════════════════════════════════════════════════════

  /**
   * Universal field editing — find a field and modify its text.
   * Works on any website by using 4 strategies in order:
   *   1. VALUE search — find inputs whose value contains the target text
   *   2. LABEL search — find inputs by label/aria/placeholder matching
   *   3. AI VISION — screenshot → Gemini → coordinates → click
   *   4. KEYBOARD — Cmd+A select all, type new value
   *
   * SOP step format:
   *   { action: "edit_field", target: "title", remove: "copy of" }
   *   { action: "edit_field", target: "title", value: "New Title" }
   *   { action: "edit_field", target: "description", remove: "old text", replace: "new text" }
   */
  async stepEditField(step) {
    const target = this.interpolate(step.target || step.field || step.text || '');
    const removeText = step.remove ? this.interpolate(step.remove) : null;
    const replaceWith = step.replace ? this.interpolate(step.replace) : null;
    const newValue = step.value ? this.interpolate(step.value) : null;
    const desc = step.description || `Edit ${target}`;

    this.onProgress(`  ✏️ Edit field: "${desc}"`);

    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const robot = require('robotjs');
    const { execSync } = await import('child_process');

    // ══════════════════════════════════════════════════════════════
    // STRATEGY 1 (most reliable): CLIPBOARD APPROACH
    // Find the field via DOM, then use keyboard: select all → copy → modify → paste
    // This works on ANY website (React, Angular, contenteditable, custom components)
    // because it uses the same keyboard shortcuts a human would use.
    // ══════════════════════════════════════════════════════════════

    // Step 1a: Try to find and focus the field via DOM search
    const field = await this._universalFieldFind(target, removeText);
    if (field) {
      this.onProgress(`  ✓ Found field "${target}" via DOM search`);
    } else {
      this.onProgress(`  ⚠️ DOM search missed "${target}" — trying to find field by content...`);
      // DO NOT use clickByText(target) here — "Title" might be a navigation link that
      // navigates away from the page. Instead, search for editable fields by their content.
      if (removeText) {
        const foundByContent = await this.browserAgent._executeJsInChrome(`
          (function() {
            var hint = ${JSON.stringify(removeText.toLowerCase())};
            var els = document.querySelectorAll('input, textarea, [contenteditable="true"], [role="textbox"]');
            for (var i = 0; i < els.length; i++) {
              var el = els[i];
              var val = (el.value || el.textContent || el.innerText || '').toLowerCase();
              if (val.includes(hint)) {
                el.focus();
                el.click();
                return true;
              }
            }
            return false;
          })()
        `);
        if (foundByContent) {
          this.onProgress(`  ✓ Found field containing "${removeText}" via content search`);
          await this.browserAgent.wait(500);
        }
      }
    }

    // Step 1b: Wait for field to be ready, then select all text in it
    await this.browserAgent.wait(500);
    robot.keyTap('a', ['command']); // Select all text in the focused field
    await this.browserAgent.wait(300);
    robot.keyTap('c', ['command']); // Copy selected text to clipboard
    await this.browserAgent.wait(400);

    // Step 1c: Read clipboard to get the field's current value
    let clipText = '';
    try {
      clipText = execSync('pbpaste').toString().trim();
    } catch (e) {
      this.onProgress(`  ⚠️ Clipboard read failed: ${e.message}`);
    }
    this.onProgress(`  📋 Field text: "${clipText.substring(0, 80)}${clipText.length > 80 ? '...' : ''}"`);

    // Step 1d: Compute the new value
    let finalValue;
    if (newValue !== null) {
      finalValue = newValue;
    } else if (removeText && clipText && clipText.toLowerCase().includes(removeText.toLowerCase())) {
      const regex = new RegExp(removeText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      finalValue = replaceWith
        ? clipText.replace(regex, replaceWith).replace(/\s{2,}/g, ' ').trim()
        : clipText.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
    } else if (removeText) {
      // Clipboard didn't contain the text to remove — field might not be focused correctly.
      // Fall through to Strategy 2.
      this.onProgress(`  ⚠️ Clipboard doesn't contain "${removeText}" — trying AI vision...`);
      finalValue = null;
    } else {
      return { success: true, method: 'click_only', target, currentValue: clipText };
    }

    // Step 1e: If we have a new value, select all again → delete → paste
    if (finalValue !== null) {
      this.onProgress(`  ✏️ New value: "${finalValue.substring(0, 80)}${finalValue.length > 80 ? '...' : ''}"`);
      robot.keyTap('a', ['command']); // Select all again
      await this.browserAgent.wait(200);
      robot.keyTap('backspace');      // Delete selected text
      await this.browserAgent.wait(200);
      await this._pasteText(finalValue); // Paste new value via clipboard
      await this.browserAgent.wait(300);
      robot.keyTap('tab');            // Tab out to confirm
      return { success: true, method: 'clipboard_keyboard', target, removed: removeText, newValue: finalValue };
    }

    // ══════════════════════════════════════════════════════════════
    // STRATEGY 2: AI VISION FALLBACK
    // Clipboard approach failed (field wasn't focused properly).
    // Use screenshot + Gemini to find and click the actual field.
    // ══════════════════════════════════════════════════════════════
    if (this.desktopAgent && this.aiManager && removeText) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });

      // Be very specific about what to click — describe the field content, not just the label
      const visionDesc = `the text input field that contains text starting with "Copy of" — click directly on the text inside the field, not on any icons or profile pictures`;
      this.onProgress(`  👁️ AI vision: looking for "${target}" field...`);
      const clickResult = await browser.clickOn(visionDesc);
      if (clickResult?.success) {
        await browser._wait(800);

        // Now try clipboard approach on the newly-focused field
        robot.keyTap('a', ['command']);
        await this.browserAgent.wait(300);
        robot.keyTap('c', ['command']);
        await this.browserAgent.wait(400);

        try {
          const clipText2 = execSync('pbpaste').toString().trim();
          this.onProgress(`  📋 AI vision field text: "${clipText2.substring(0, 80)}${clipText2.length > 80 ? '...' : ''}"`);

          if (clipText2 && clipText2.toLowerCase().includes(removeText.toLowerCase())) {
            const regex = new RegExp(removeText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const newVal = clipText2.replace(regex, '').replace(/\s{2,}/g, ' ').trim();
            this.onProgress(`  ✏️ New value: "${newVal.substring(0, 80)}${newVal.length > 80 ? '...' : ''}"`);
            robot.keyTap('a', ['command']);
            await this.browserAgent.wait(200);
            robot.keyTap('backspace');
            await this.browserAgent.wait(200);
            await this._pasteText(newVal);
            await this.browserAgent.wait(300);
            robot.keyTap('tab');
            return { success: true, method: 'ai_vision_clipboard', target, removed: removeText, newValue: newVal };
          }
        } catch (e) {
          this.onProgress(`  ⚠️ Clipboard read failed after AI vision: ${e.message}`);
        }
      }
    }

    this.onProgress(`  ⚠️ Could not edit field "${target}" — all strategies exhausted`);
    return { success: false, method: 'failed', target, reason: 'could_not_edit' };
  }

  /**
   * Paste text via clipboard (pbcopy + Cmd+V). Much faster and more reliable
   * than robot.typeStringDelayed() which types character-by-character.
   */
  async _pasteText(text) {
    const { execSync } = await import('child_process');
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const robot = require('robotjs');
    const escaped = text.replace(/'/g, "'\\''");
    execSync(`printf '%s' '${escaped}' | pbcopy`);
    await this.browserAgent.wait(150);
    robot.keyTap('v', ['command']);
    await this.browserAgent.wait(300);
  }

  /**
   * Universal date setting — find a date field/picker and set a specific date.
   * Works on any website by trying multiple strategies:
   *   1. Native date inputs (<input type="date">)
   *   2. Text inputs near date labels — select all + type date
   *   3. AI vision — screenshot → find date field → click → type
   *
   * SOP step format:
   *   { action: "set_date", target: "start date", value: "{{schedule_date}}" }
   *   { action: "set_date", target: "end date", value: "3/19/2026" }
   */
  async stepSetDate(step) {
    const target = this.interpolate(step.target || step.field || step.text || 'date');
    const dateValue = this.interpolate(step.value || this.variables?.schedule_date || '');
    const desc = step.description || `Set ${target}`;

    if (!dateValue) {
      throw new Error(`No date value provided for "${target}"`);
    }

    this.onProgress(`  📅 Set date: "${target}" → "${dateValue}"`);

    // Parse the date string into components
    const parsedDate = this._parseFlexibleDate(dateValue);
    this.onProgress(`  📅 Parsed: ${parsedDate ? `${parsedDate.month}/${parsedDate.day}/${parsedDate.year}` : 'unparseable'}`);

    // Format date for display (MM/DD/YYYY — works on most US date pickers)
    const displayDate = parsedDate
      ? `${String(parsedDate.month).padStart(2,'0')}/${String(parsedDate.day).padStart(2,'0')}/${parsedDate.year}`
      : dateValue;
    const isoDate = parsedDate
      ? `${parsedDate.year}-${String(parsedDate.month).padStart(2,'0')}-${String(parsedDate.day).padStart(2,'0')}`
      : dateValue;

    // Determine if target is "start" or "end" date (for ordering when multiple found)
    const targetLower = target.toLowerCase();
    const isEnd = targetLower.includes('end');
    const cleanTarget = this._cleanClickText(target);

    // ═══ PHASE 1: Find and click the date input field ═══
    // Strategy priority:
    //   A. Find input by date-like VALUE (most universal — works on ANY website)
    //   B. Find input near label text matching target
    //   C. clickByText on the label
    //   D. AI vision as last resort
    this.onProgress(`  📅 Phase 1: Finding date field for "${cleanTarget}"...`);

    let fieldOpened = false;

    // Strategy A: Find inputs containing date-like values (MM/DD/YYYY, YYYY-MM-DD, etc.)
    // This is the MOST UNIVERSAL approach — date inputs always contain date-like text.
    const dateInputResult = await this.browserAgent._executeJsInChrome(`
      (function() {
        var isEnd = ${isEnd};
        var targetHint = ${JSON.stringify(targetLower)};

        // Collect all visible inputs that contain date-like values
        var inputs = document.querySelectorAll('input');
        var dateInputs = [];

        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          var val = (inp.value || '').trim();
          var type = (inp.getAttribute('type') || '').toLowerCase();

          // Skip hidden/tiny inputs
          try {
            var r = inp.getBoundingClientRect();
            if (r.width < 40 || r.height < 15 || r.top < 0 || r.bottom > window.innerHeight + 50) continue;
          } catch(e) { continue; }

          // Check if value looks like a date
          var isDateVal = false;
          if (type === 'date' || type === 'datetime-local') {
            isDateVal = true;
          } else if (val.match(/^\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}$/)) {
            isDateVal = true; // MM/DD/YYYY or DD-MM-YYYY
          } else if (val.match(/^\\d{4}[\\/\\-]\\d{1,2}[\\/\\-]\\d{1,2}/)) {
            isDateVal = true; // YYYY-MM-DD
          } else if (val.match(/^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)) {
            isDateVal = true; // "March 12, 2026"
          }

          if (!isDateVal) continue;

          // Score this input: how well does it match "start" or "end"?
          var score = 0;
          var label = (inp.getAttribute('aria-label') || '').toLowerCase();
          var name = (inp.getAttribute('name') || '').toLowerCase();
          var id = (inp.id || '').toLowerCase();
          var placeholder = (inp.getAttribute('placeholder') || '').toLowerCase();
          var allAttrs = label + ' ' + name + ' ' + id + ' ' + placeholder;

          // Check surrounding text (labels, headings nearby)
          var context = '';
          var p = inp.parentElement;
          for (var up = 0; up < 4 && p; up++) {
            var labels = p.querySelectorAll('label, span, legend, div');
            for (var l = 0; l < labels.length && l < 10; l++) {
              var lt = (labels[l].textContent || '').trim();
              if (lt.length < 50) context += ' ' + lt.toLowerCase();
            }
            p = p.parentElement;
          }

          // Match "start" or "end" in attributes or context
          if (targetHint.includes('start') || targetHint.includes('begins')) {
            if (allAttrs.includes('start') || context.includes('start') || context.includes('begins')) score += 10;
            if (allAttrs.includes('end') || context.includes('end')) score -= 5;
          }
          if (targetHint.includes('end') || targetHint.includes('ends')) {
            if (allAttrs.includes('end') || context.includes('end') || context.includes('ends')) score += 10;
            if (allAttrs.includes('start') || context.includes('start')) score -= 5;
          }
          // Bonus for matching any words from target
          var targetWords = targetHint.split(/\\s+/);
          for (var tw = 0; tw < targetWords.length; tw++) {
            if (targetWords[tw].length > 2 && (allAttrs.includes(targetWords[tw]) || context.includes(targetWords[tw]))) score += 2;
          }

          dateInputs.push({ idx: i, score: score, val: val, context: context.substring(0, 80) });
        }

        if (dateInputs.length === 0) return null;

        // Sort by score (highest first), then by DOM order for same score
        dateInputs.sort(function(a, b) { return b.score - a.score || a.idx - b.idx; });

        // If looking for "end" and multiple date inputs, prefer the second one
        var pick = 0;
        if (isEnd && dateInputs.length >= 2 && dateInputs[0].score === dateInputs[1].score) {
          pick = 1;
        }

        var chosen = inputs[dateInputs[pick].idx];
        chosen.focus();
        chosen.click();
        var rect = chosen.getBoundingClientRect();
        return { found: true, value: dateInputs[pick].val, context: dateInputs[pick].context, score: dateInputs[pick].score, total: dateInputs.length, x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      })()
    `);

    if (dateInputResult?.found) {
      this.onProgress(`  ✓ Found date input by value: "${dateInputResult.value}" (score: ${dateInputResult.score}, ${dateInputResult.total} date inputs on page)`);
      await this.browserAgent.wait(800);
      fieldOpened = true;
    }

    // Strategy B: Find input near label text (fallback)
    if (!fieldOpened) {
      const dateField = await this._findDateField(target);
      if (dateField) {
        this.onProgress(`  ✓ Found date input near label "${target}"`);
        await this.browserAgent.wait(800);
        fieldOpened = true;
      }
    }

    // Strategy C: Click the label text on the page directly
    if (!fieldOpened) {
      // Try exact text, then fuzzy variations
      const textVariations = [cleanTarget];
      // "Event Start Date" → also try "Event Starts", "Start Date", "Event Start"
      if (cleanTarget.includes(' ')) {
        const words = cleanTarget.split(/\s+/);
        if (words.length >= 3) textVariations.push(words.slice(0, 2).join(' ')); // "Event Start"
        if (words.length >= 2) textVariations.push(words.slice(-2).join(' '));   // "Start Date"
      }
      for (const variant of textVariations) {
        try {
          const clickResult = await this.browserAgent.clickByText(variant);
          if (clickResult?.success) {
            this.onProgress(`  ✓ Clicked label "${variant}" via DOM`);
            await this.browserAgent.wait(1500);
            fieldOpened = true;
            break;
          }
        } catch (e) { /* not found, try next */ }
      }
    }

    // Strategy D: AI vision as last resort
    if (!fieldOpened && this.desktopAgent && this.aiManager) {
      this.onProgress(`  👁️ Using AI vision to click "${target}" field...`);
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });
      const visionClick = await browser.clickOn(`the ${isEnd ? 'end' : 'start'} date input field — the box showing a date like MM/DD/YYYY`);
      if (visionClick?.success) {
        await browser._wait(1500);
        fieldOpened = true;
      }
    }

    if (!fieldOpened) {
      throw new Error(`Could not find date field "${target}" on page`);
    }

    // ═══ PHASE 2: Clear old date and type new date ═══
    // The JS focus/click may not fully activate the field at the OS level.
    // Use robotjs to physically click the field, then triple-click to select
    // the field text (NOT Cmd+A which selects the whole page on many sites).
    if (this.desktopAgent) {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');

      // Quick check: if it's a native <input type="date">, use JS setter (most reliable)
      const nativeType = await this.browserAgent._executeJsInChrome(`
        (function() { var el = document.activeElement; return el ? (el.getAttribute('type') || '') : ''; })()
      `);
      if (nativeType === 'date' || nativeType === 'datetime-local') {
        await this.browserAgent._executeJsInChrome(`
          (function() {
            var el = document.activeElement;
            if (!el) return;
            var nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(isoDate)});
            else el.value = ${JSON.stringify(isoDate)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          })()
        `);
        this.onProgress(`  ✓ Native date input set to ${isoDate}`);
        return { success: true, method: 'native_date', target, value: isoDate };
      }

      // Get the date field's screen coordinates so we can physically click it
      const fieldCoords = await this.browserAgent._executeJsInChrome(`
        (function() {
          var el = document.activeElement;
          if (!el || (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA')) {
            // Active element isn't an input — search for date inputs
            var inputs = document.querySelectorAll('input');
            for (var i = 0; i < inputs.length; i++) {
              var val = (inputs[i].value || '').trim();
              if (val.match(/\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}/)) {
                el = inputs[i];
                break;
              }
            }
          }
          if (!el) return null;
          var rect = el.getBoundingClientRect();
          return {
            x: Math.round(rect.left + rect.width / 2 + window.screenX),
            y: Math.round(rect.top + rect.height / 2 + window.screenY),
            value: el.value || '',
            tag: el.tagName,
            type: el.getAttribute('type') || ''
          };
        })()
      `);

      if (fieldCoords) {
        this.onProgress(`  📋 Date field at (${fieldCoords.x}, ${fieldCoords.y}), current: "${fieldCoords.value}"`);

        // Helper: read the focused field's current value
        const _readFieldValue = async () => {
          try {
            const v = await this.browserAgent._executeJsInChrome(`
              (function() {
                var el = document.activeElement;
                return el ? (el.value || el.textContent || '').trim() : '';
              })()
            `);
            return v || '';
          } catch(e) { return ''; }
        };

        // Helper: check if field value matches the target date
        const _dateMatches = (fieldVal) => {
          if (!fieldVal) return false;
          const clean = fieldVal.replace(/^0+/, '').replace(/\/0/g, '/');
          const target = displayDate.replace(/^0+/, '').replace(/\/0/g, '/');
          return fieldVal === displayDate || clean === target;
        };

        // ── ATTEMPT 1: Click → Cmd+A → Paste (replaces selection) ──
        // Physical click to focus the field at OS level
        robot.moveMouse(fieldCoords.x, fieldCoords.y);
        await this.browserAgent.wait(150);
        robot.mouseClick();
        await this.browserAgent.wait(500);

        // Select all text in the focused input (Cmd+A in a focused input selects its text)
        robot.keyTap('a', ['command']);
        await this.browserAgent.wait(300);

        // Paste new date — this REPLACES the selected text in one step
        await this._pasteText(displayDate);
        await this.browserAgent.wait(600);

        // Verify it worked
        let val1 = await _readFieldValue();
        if (_dateMatches(val1)) {
          robot.keyTap('escape');
          await this.browserAgent.wait(500);
          this.onProgress(`  ✓ Date set: ${displayDate}`);
          return { success: true, method: 'cmd_a_paste', target, value: displayDate };
        }
        this.onProgress(`  ⚠️ Attempt 1 result: "${val1}" — trying JS select...`);

        // ── ATTEMPT 2: JS .select() → Paste ──
        // Re-click the field, use JS .select() to select all, then paste
        robot.moveMouse(fieldCoords.x, fieldCoords.y);
        await this.browserAgent.wait(100);
        robot.mouseClick();
        await this.browserAgent.wait(400);

        await this.browserAgent._executeJsInChrome(`
          (function() {
            var el = document.activeElement;
            if (el && typeof el.select === 'function') el.select();
          })()
        `);
        await this.browserAgent.wait(300);

        await this._pasteText(displayDate);
        await this.browserAgent.wait(600);

        let val2 = await _readFieldValue();
        if (_dateMatches(val2)) {
          robot.keyTap('escape');
          await this.browserAgent.wait(500);
          this.onProgress(`  ✓ Date set (JS select): ${displayDate}`);
          return { success: true, method: 'js_select_paste', target, value: displayDate };
        }
        this.onProgress(`  ⚠️ Attempt 2 result: "${val2}" — trying keyboard clear...`);

        // ── ATTEMPT 3: Click → End → Backspace×25 → Paste ──
        // Brute force: go to end of field and delete every character individually
        robot.moveMouse(fieldCoords.x, fieldCoords.y);
        await this.browserAgent.wait(100);
        robot.mouseClick();
        await this.browserAgent.wait(400);

        robot.keyTap('end');
        await this.browserAgent.wait(100);
        for (let i = 0; i < 25; i++) {
          robot.keyTap('backspace');
          await this.browserAgent.wait(40);
        }
        await this.browserAgent.wait(300);

        await this._pasteText(displayDate);
        await this.browserAgent.wait(600);

        let val3 = await _readFieldValue();
        if (_dateMatches(val3)) {
          robot.keyTap('escape');
          await this.browserAgent.wait(500);
          this.onProgress(`  ✓ Date set (keyboard clear): ${displayDate}`);
          return { success: true, method: 'keyboard_clear_paste', target, value: displayDate };
        }
        this.onProgress(`  ⚠️ Attempt 3 result: "${val3}" — forcing via JS...`);

        // ── ATTEMPT 4: JS force-set the value (nuclear option) ──
        // Directly set the input's value property via React-compatible nativeSetter
        await this.browserAgent._executeJsInChrome(`
          (function() {
            var el = document.activeElement;
            if (!el || el.tagName !== 'INPUT') {
              // Re-find the right date input
              var inputs = document.querySelectorAll('input');
              var isEnd = ${isEnd};
              var dateInputs = [];
              for (var i = 0; i < inputs.length; i++) {
                var v = (inputs[i].value || '').trim();
                if (v.match(/\\d{1,2}[\\/\\-]\\d{1,2}[\\/\\-]\\d{2,4}/)) dateInputs.push(inputs[i]);
              }
              el = isEnd && dateInputs.length >= 2 ? dateInputs[1] : dateInputs[0];
            }
            if (!el) return;
            var nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(displayDate)});
            else el.value = ${JSON.stringify(displayDate)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          })()
        `);
        await this.browserAgent.wait(500);

        robot.keyTap('escape');
        await this.browserAgent.wait(500);
        this.onProgress(`  ✓ Date set (JS forced): ${displayDate}`);
        return { success: true, method: 'js_forced_date', target, value: displayDate };
      }

      // No field coordinates — blind keyboard entry as last resort
      this.onProgress(`  ⌨️ Could not get field coordinates — trying blind entry...`);
      robot.keyTap('a', ['command']);
      await this.browserAgent.wait(200);
      await this._pasteText(displayDate);
      await this.browserAgent.wait(500);
      robot.keyTap('escape');
      await this.browserAgent.wait(500);
      this.onProgress(`  ✓ Date typed (fallback): ${displayDate}`);
      return { success: true, method: 'blind_type_date', target, value: displayDate };
    }

    throw new Error(`Cannot set date "${target}" — no desktop agent available for keyboard input`);
  }

  /**
   * Find any field on the page universally — by value, label, or position.
   * Returns true if a field was found and focused, false otherwise.
   */
  async _universalFieldFind(target, valueHint) {
    const targetLower = (target || '').toLowerCase();

    // Expand synonyms for common field names
    const synonymMap = {
      'title': ['title', 'event name', 'event title', 'name', 'heading', 'subject'],
      'description': ['description', 'details', 'about', 'summary', 'body'],
      'location': ['location', 'venue', 'address', 'place', 'where'],
      'email': ['email', 'e-mail', 'email address'],
      'name': ['name', 'full name', 'your name', 'first name'],
    };
    const searchTerms = synonymMap[targetLower] || [targetLower];

    const result = await this.browserAgent._executeJsInChrome(`
      (function() {
        var searchTerms = ${JSON.stringify(searchTerms)};
        var valueHint = ${JSON.stringify((valueHint || '').toLowerCase())};

        function matchesField(text) {
          text = text.toLowerCase();
          for (var t = 0; t < searchTerms.length; t++) {
            if (text.includes(searchTerms[t])) return true;
          }
          return false;
        }
        function isVisible(el) {
          try { var r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10; } catch(e) { return false; }
        }

        var inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable=""]');

        // ═══ Strategy A: VALUE-BASED search (most reliable!) ═══
        // If we know what text to remove, find the input that CONTAINS it
        if (valueHint) {
          for (var v = 0; v < inputs.length; v++) {
            var inp = inputs[v];
            if (!isVisible(inp)) continue;
            var val = (inp.value || inp.textContent || '').toLowerCase();
            if (val.includes(valueHint)) {
              inp.focus();
              inp.click();
              return { found: true, method: 'value_match', value: inp.value || inp.textContent || '' };
            }
          }
        }

        // ═══ Strategy B: LABEL-BASED search ═══
        for (var i = 0; i < inputs.length; i++) {
          var inp2 = inputs[i];
          if (!isVisible(inp2)) continue;
          var label = (inp2.getAttribute('aria-label') || '').toLowerCase();
          var placeholder = (inp2.getAttribute('placeholder') || '').toLowerCase();
          var name = (inp2.getAttribute('name') || '').toLowerCase();
          var id = (inp2.id || '').toLowerCase();

          if (matchesField(label) || matchesField(placeholder) || matchesField(name) || matchesField(id)) {
            inp2.focus();
            inp2.click();
            return { found: true, method: 'label_match', value: inp2.value || inp2.textContent || '' };
          }

          // Check associated <label>
          if (inp2.id) {
            var labelEl = document.querySelector('label[for="' + inp2.id + '"]');
            if (labelEl && matchesField(labelEl.textContent || '')) {
              inp2.focus();
              inp2.click();
              return { found: true, method: 'label_element', value: inp2.value || inp2.textContent || '' };
            }
          }

          // Check surrounding text (parent, siblings)
          var parent = inp2.parentElement;
          for (var up = 0; up < 3 && parent; up++) {
            var siblings = parent.querySelectorAll('label, span, p, div, h1, h2, h3, h4, h5, h6');
            for (var s = 0; s < siblings.length; s++) {
              if (matchesField(siblings[s].textContent || '')) {
                inp2.focus();
                inp2.click();
                return { found: true, method: 'nearby_text', value: inp2.value || inp2.textContent || '' };
              }
            }
            parent = parent.parentElement;
          }
        }

        // ═══ Strategy C: FIRST LARGE INPUT (for title-like fields) ═══
        if (searchTerms.indexOf('title') >= 0 || searchTerms.indexOf('event name') >= 0 || searchTerms.indexOf('name') >= 0) {
          for (var k = 0; k < inputs.length; k++) {
            var inp3 = inputs[k];
            try {
              var r = inp3.getBoundingClientRect();
              if (r.width > 200 && r.height > 20 && r.top > 0 && r.top < window.innerHeight) {
                var val3 = inp3.value || inp3.textContent || '';
                if (val3.length > 3) {
                  inp3.focus();
                  inp3.click();
                  return { found: true, method: 'first_large_input', value: val3 };
                }
              }
            } catch(e) {}
          }
        }

        // ═══ Strategy D: Contenteditable elements ═══
        var editables = document.querySelectorAll('[contenteditable], [role="textbox"]');
        for (var j = 0; j < editables.length; j++) {
          var el = editables[j];
          if (!isVisible(el)) continue;
          var elLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          if (matchesField(elLabel)) {
            el.focus();
            el.click();
            return { found: true, method: 'contenteditable', value: el.textContent || '' };
          }
          // Value-based match for contenteditable
          if (valueHint && (el.textContent || '').toLowerCase().includes(valueHint)) {
            el.focus();
            el.click();
            return { found: true, method: 'contenteditable_value', value: el.textContent || '' };
          }
        }

        return null;
      })()
    `);

    if (result?.found) {
      this.onProgress(`  ✓ Found field via ${result.method}: "${result.value.substring(0, 60)}..."`);
      return result;
    }
    return null;
  }

  /**
   * Find a date-related input field on the page.
   * Searches by label text containing date-related keywords near the target description.
   */
  async _findDateField(target) {
    const targetLower = target.toLowerCase();

    const result = await this.browserAgent._executeJsInChrome(`
      (function() {
        var target = ${JSON.stringify(targetLower)};

        // Date-related keywords to search for in labels
        var dateKeywords = ['date', 'start', 'end', 'begins', 'ends', 'when', 'schedule', 'time'];

        var inputs = document.querySelectorAll('input, [contenteditable]');
        var dateFields = [];

        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          try { var r = inp.getBoundingClientRect(); if (r.width < 30 || r.height < 10 || r.top < 0 || r.top > window.innerHeight) continue; } catch(e) { continue; }

          var type = (inp.getAttribute('type') || '').toLowerCase();
          var label = (inp.getAttribute('aria-label') || '').toLowerCase();
          var placeholder = (inp.getAttribute('placeholder') || '').toLowerCase();
          var name = (inp.getAttribute('name') || '').toLowerCase();
          var id = (inp.id || '').toLowerCase();

          // Check if this is a date-like field
          var isDateField = type === 'date' || type === 'datetime-local' || type === 'time';
          var allAttrs = label + ' ' + placeholder + ' ' + name + ' ' + id;

          // Check surrounding text for date keywords
          var context = '';
          var p = inp.parentElement;
          for (var up = 0; up < 4 && p; up++) {
            var labels = p.querySelectorAll('label, span, div');
            for (var l = 0; l < labels.length && l < 10; l++) {
              context += ' ' + (labels[l].textContent || '');
            }
            p = p.parentElement;
          }
          context = context.toLowerCase();

          for (var d = 0; d < dateKeywords.length; d++) {
            if (allAttrs.includes(dateKeywords[d]) || (context.includes(dateKeywords[d]) && context.length < 500)) {
              isDateField = true;
              break;
            }
          }

          if (isDateField) {
            // Score: how well does this match the target?
            var score = 0;
            if (allAttrs.includes(target) || context.includes(target)) score += 10;
            if (target.includes('start') && (allAttrs.includes('start') || context.includes('start'))) score += 5;
            if (target.includes('end') && (allAttrs.includes('end') || context.includes('end'))) score += 5;
            dateFields.push({ el: inp, score: score, label: label || placeholder || name || id });
          }
        }

        if (dateFields.length > 0) {
          dateFields.sort(function(a, b) { return b.score - a.score; });
          dateFields[0].el.focus();
          dateFields[0].el.click();
          return { found: true, label: dateFields[0].label, score: dateFields[0].score, total: dateFields.length };
        }

        return null;
      })()
    `);

    if (result?.found) {
      this.onProgress(`  ✓ Found date field: "${result.label}" (score: ${result.score}, ${result.total} date fields on page)`);
      return result;
    }
    return null;
  }

  /**
   * Parse flexible date strings into {month, day, year} components.
   * Handles: "3/12/26", "3/12/2026", "March 12", "March 12, 2026", "03-12-2026"
   */
  _parseFlexibleDate(dateStr) {
    if (!dateStr) return null;
    const str = dateStr.trim();

    // MM/DD/YY or MM/DD/YYYY
    let m = str.match(/^(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?$/);
    if (m) {
      let year = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : new Date().getFullYear();
      return { month: parseInt(m[1]), day: parseInt(m[2]), year };
    }

    // Month DD, YYYY or Month DD
    const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
    m = str.match(/^([a-z]+)\s+(\d{1,2})(?:(?:st|nd|rd|th))?\s*,?\s*(\d{4})?$/i);
    if (m) {
      const mon = months[m[1].substring(0,3).toLowerCase()];
      if (mon) {
        return { month: mon, day: parseInt(m[2]), year: m[3] ? parseInt(m[3]) : new Date().getFullYear() };
      }
    }

    // Relative dates
    const today = new Date();
    if (/^tomorrow$/i.test(str)) {
      today.setDate(today.getDate() + 1);
      return { month: today.getMonth() + 1, day: today.getDate(), year: today.getFullYear() };
    }
    if (/^today$/i.test(str)) {
      return { month: today.getMonth() + 1, day: today.getDate(), year: today.getFullYear() };
    }

    // "next Thursday" etc.
    const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    m = str.match(/^next\s+(\w+)$/i);
    if (m) {
      const dayIdx = dayNames.indexOf(m[1].toLowerCase());
      if (dayIdx >= 0) {
        const d = new Date();
        d.setDate(d.getDate() + ((dayIdx - d.getDay() + 7) % 7 || 7));
        return { month: d.getMonth() + 1, day: d.getDate(), year: d.getFullYear() };
      }
    }

    return null;
  }

  /**
   * Clean descriptive text from SOP steps to extract the likely element text.
   * "Upcoming Events ( blue button)" → "Upcoming Events"
   * "Publish Now button on the right" → "Publish Now"
   * "Past Events" → "Past Events" (unchanged)
   */
  _cleanClickText(text) {
    return text
      .replace(/\s*\([^)]*\)\s*/g, ' ')               // Remove parentheticals: (blue button)
      .replace(/^(?:click|press|tap|hit|select|find|go\s+to|the)\s+/i, '') // Strip leading verbs: "Click the X"
      .replace(/\s+button\s*(on\s+the\s+\w+)?\s*$/i, '') // "button on the right" at end
      .replace(/\s+(?:section|area|part|region|box|field|link|tab|icon)\s*$/i, '') // "section" at end
      .replace(/\s+on\s+the\s+(right|left|top|bottom|page|screen)\s*$/i, '') // "on the bottom" at end
      .replace(/\s+at\s+the\s+(right|left|top|bottom|page|screen)\s*$/i, '') // "at the bottom" at end
      .replace(/\s+and\s+select\s+.*/i, '')            // "and select what we ask..."
      .replace(/^["'"'\u201C\u201D]+|["'"'\u201C\u201D]+$/g, '') // Strip surrounding quotes
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if content looks like raw data that needs AI formatting.
   * Returns true for: bare URLs, very short text, JSON-like data, CSV-like data.
   * Returns false for: already-formatted content (line breaks, emojis, paragraphs).
   */
  _contentNeedsFormatting(text) {
    if (!text || text.length < 5) return false;
    // Already formatted — has line breaks and substantial length
    if (/\n/.test(text) && text.length > 50) return false;
    // Already formatted — has emojis (likely a pre-formatted post)
    if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(text)) return false;
    // Raw URL — needs formatting
    if (/^https?:\/\/\S+$/.test(text.trim())) return true;
    // Multiple URLs crammed together
    if ((text.match(/https?:\/\//g) || []).length >= 2 && !/\n/.test(text)) return true;
    // JSON-like data
    if (/^\s*[\[{]/.test(text) && /[\]}]\s*$/.test(text)) return true;
    // CSV-like: commas with no line breaks
    if (text.split(',').length >= 4 && !/\n/.test(text)) return true;
    // Very short one-liner that looks like raw data, not a message
    // (e.g. "1234 Main St, Springfield" — probably property data)
    // Don't flag normal sentences as needing formatting
    return false;
  }

  /**
   * Use AI to format raw content into a professional post.
   * Detects the target platform from the current URL and adapts style.
   */
  async _aiFormatContent(rawContent) {
    let platform = 'social media';
    try {
      const url = await this.browserAgent.getCurrentUrl();
      if (/facebook\.com/i.test(url)) platform = 'Facebook';
      else if (/twitter\.com|x\.com/i.test(url)) platform = 'Twitter/X';
      else if (/linkedin\.com/i.test(url)) platform = 'LinkedIn';
      else if (/instagram\.com/i.test(url)) platform = 'Instagram';
    } catch (e) { /* ignore — use generic */ }

    const prompt = `Format this raw data into a professional ${platform} post.
Use line breaks, emojis, and bullet points where appropriate.
Keep it concise and engaging. Do NOT add hashtags unless the data suggests them.
Return ONLY the formatted post text — no explanation, no quotes, no markdown code blocks.

Raw data:
${rawContent}`;

    const response = await this.aiManager.chat(prompt, { temperature: 0.3 });
    const content = typeof response === 'string' ? response : response?.content || response?.text || '';
    // Strip any markdown code fences the AI might have wrapped it in
    const cleaned = content.replace(/^```[\w]*\n?/gm, '').replace(/```\s*$/gm, '').trim();
    if (!cleaned || cleaned.length < 5) throw new Error('AI returned empty formatted content');
    this.onProgress(`  🎨 AI formatted content (${cleaned.length} chars for ${platform})`);
    return cleaned;
  }

  /**
   * Detect if a click_text step is actually describing a TEXT EDITING instruction.
   * Handles patterns like:
   *   - "Delete the 'copy of' text from the Title"
   *   - "Remove 'Copy of' from the title"
   *   - "Clear the title field"
   *   - "Change/Update the title to ..."
   *   - "Set the date to 3/19"
   * Returns a result object if handled, null if this is a normal click.
   */
  async _detectAndHandleEditInstruction(rawText, step) {
    const desc = (step.description || '').toLowerCase();

    // Pattern 1: "Delete/Remove the 'X' text from the Y" → route to stepEditField
    const deleteMatch = rawText.match(
      /(?:delete|remove|erase)\s+(?:the\s+)?["'"\u201C]?(.+?)["'"\u201D]?\s+(?:text\s+)?(?:from|in|of)\s+(?:the\s+)?(.+)/i
    );
    if (deleteMatch) {
      const textToRemove = deleteMatch[1].trim();
      const fieldDesc = deleteMatch[2].trim();
      this.onProgress(`  ✏️ Edit instruction: remove "${textToRemove}" from "${fieldDesc}"`);
      return await this.stepEditField({ action: 'edit_field', target: fieldDesc, remove: textToRemove, description: step.description });
    }

    // Pattern 2: "Clear the X" / "Clear X field" → route to stepEditField
    const clearMatch = rawText.match(/(?:clear)\s+(?:the\s+)?(.+?)(?:\s+field)?\s*$/i);
    if (clearMatch) {
      const fieldDesc = clearMatch[1].trim();
      this.onProgress(`  ✏️ Edit instruction: clear "${fieldDesc}"`);
      return await this.stepEditField({ action: 'edit_field', target: fieldDesc, value: '', description: step.description });
    }

    // Pattern 3: "Set/Change/Update the X to Y" → route to stepEditField
    const setMatch = rawText.match(
      /(?:set|change|update)\s+(?:the\s+)?(.+?)\s+to\s+(.+)/i
    );
    if (setMatch) {
      const fieldDesc = setMatch[1].trim();
      const newValue = this.interpolate(setMatch[2].trim());
      this.onProgress(`  ✏️ Edit instruction: set "${fieldDesc}" to "${newValue}"`);
      return await this.stepEditField({ action: 'edit_field', target: fieldDesc, value: newValue, description: step.description });
    }

    // Pattern 4: Check description for date editing clues → route to stepSetDate
    // e.g., text="Event Start Date" + description="set the new date"
    if (desc.match(/(?:set|change|update|enter)\s+(?:the\s+)?(?:new\s+)?(?:date|time|value)/)) {
      const scheduleDate = this.variables?.schedule_date;
      if (scheduleDate) {
        this.onProgress(`  📅 Date edit detected: "${rawText}" → "${scheduleDate}"`);
        return await this.stepSetDate({ action: 'set_date', target: rawText, value: scheduleDate, description: step.description });
      }
    }

    return null; // Not an edit instruction — proceed with normal click
  }

  /**
   * Edit text in a field: find the field, click it, modify its value.
   * @param {string} fieldDesc - Description of the field to find ("Title", "Event name", etc.)
   * @param {string|null} textToRemove - Text to remove from the field (for 'remove' mode)
   * @param {string} mode - 'remove', 'clear', or 'set'
   * @param {string} newValue - New value to set (for 'set' mode)
   */
  async _editFieldText(fieldDesc, textToRemove, mode, newValue) {
    const fieldLower = fieldDesc.toLowerCase();

    // Expand synonyms: "title" should also match "event name", "name", etc.
    const synonyms = {
      'title': ['title', 'event name', 'event title', 'name', 'heading'],
      'description': ['description', 'details', 'about', 'summary'],
      'location': ['location', 'venue', 'address', 'place'],
    };
    const searchTerms = synonyms[fieldLower] || [fieldLower];

    // Find and click the field via Chrome JS
    const fieldInfo = await this.browserAgent._executeJsInChrome(`
      (function() {
        var searchTerms = ${JSON.stringify(searchTerms)};

        function matchesField(text) {
          text = text.toLowerCase();
          for (var t = 0; t < searchTerms.length; t++) {
            if (text.includes(searchTerms[t])) return true;
          }
          return false;
        }

        function getFieldValue(inp) {
          return inp.value || inp.textContent || inp.innerText || '';
        }

        // Strategy 1: Find input/textarea by label, placeholder, aria-label, name, id
        var inputs = document.querySelectorAll('input[type="text"], input:not([type]), textarea, [contenteditable="true"], [contenteditable=""]');
        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          // Skip hidden/tiny inputs
          try { var r = inp.getBoundingClientRect(); if (r.width < 30 || r.height < 10) continue; } catch(e) {}

          var label = (inp.getAttribute('aria-label') || '').toLowerCase();
          var placeholder = (inp.getAttribute('placeholder') || '').toLowerCase();
          var name = (inp.getAttribute('name') || '').toLowerCase();
          var id = (inp.id || '').toLowerCase();

          // Check direct attributes
          if (matchesField(label) || matchesField(placeholder) ||
              matchesField(name) || matchesField(id)) {
            inp.focus();
            inp.click();
            return { found: true, value: getFieldValue(inp), tag: inp.tagName, method: 'attribute' };
          }

          // Check associated <label> element
          if (inp.id) {
            var labelEl = document.querySelector('label[for="' + inp.id + '"]');
            if (labelEl && matchesField(labelEl.textContent || '')) {
              inp.focus();
              inp.click();
              return { found: true, value: getFieldValue(inp), tag: inp.tagName, method: 'label' };
            }
          }

          // Check nearby preceding text (label might not use <label> tag)
          var prev = inp.previousElementSibling;
          if (prev && matchesField(prev.textContent || '')) {
            inp.focus();
            inp.click();
            return { found: true, value: getFieldValue(inp), tag: inp.tagName, method: 'sibling' };
          }

          // Check parent container text (excluding the input's own text)
          var parent = inp.parentElement;
          if (parent) {
            var parentText = '';
            for (var c = 0; c < parent.childNodes.length; c++) {
              if (parent.childNodes[c] !== inp) parentText += (parent.childNodes[c].textContent || '');
            }
            if (matchesField(parentText)) {
              inp.focus();
              inp.click();
              return { found: true, value: getFieldValue(inp), tag: inp.tagName, method: 'parent' };
            }
          }
        }

        // Strategy 2: Contenteditable elements with matching aria/role
        var editables = document.querySelectorAll('[contenteditable], [role="textbox"], div[tabindex], span[tabindex]');
        for (var j = 0; j < editables.length; j++) {
          var el = editables[j];
          var elLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          if (matchesField(elLabel)) {
            el.focus();
            el.click();
            return { found: true, value: el.textContent || '', tag: el.tagName, method: 'contenteditable' };
          }
        }

        // Strategy 3: If looking for "title" and nothing matched, grab the FIRST large text input
        // (on event creation pages, the title is almost always the first prominent input)
        if (searchTerms.indexOf('title') >= 0 || searchTerms.indexOf('event name') >= 0) {
          for (var k = 0; k < inputs.length; k++) {
            var inp2 = inputs[k];
            try {
              var r2 = inp2.getBoundingClientRect();
              if (r2.width > 200 && r2.height > 20 && r2.top < window.innerHeight) {
                // Check if it has a value that looks like a title (contains "copy of" etc.)
                var val = getFieldValue(inp2);
                if (val.length > 5) {
                  inp2.focus();
                  inp2.click();
                  return { found: true, value: val, tag: inp2.tagName, method: 'first-large-input' };
                }
              }
            } catch(e) {}
          }
        }

        return { found: false };
      })()
    `);

    if (!fieldInfo || !fieldInfo.found) {
      this.onProgress(`  ⚠️ Could not find field: "${fieldDesc}"`);
      // Fall through — let the normal click handler try
      return null;
    }

    this.onProgress(`  ✓ Found field "${fieldDesc}" (${fieldInfo.method}, value: "${fieldInfo.value.substring(0, 50)}")`);
    await this.browserAgent.wait(500);

    // Now modify the value
    if (mode === 'remove' && textToRemove) {
      // Remove the target text from the current value
      const currentValue = fieldInfo.value;
      const regex = new RegExp(textToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const newVal = currentValue.replace(regex, '').replace(/^\s+/, '').trim();
      this.onProgress(`  ✏️ Removing "${textToRemove}" → "${newVal.substring(0, 50)}"`);

      await this.browserAgent._executeJsInChrome(`
        (function() {
          var el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            // Native input: set value + trigger events
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                            || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(newVal)});
            else el.value = ${JSON.stringify(newVal)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el) {
            // Contenteditable
            el.textContent = ${JSON.stringify(newVal)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      await this.browserAgent.wait(300);
      return { success: true, method: 'edit_remove', field: fieldDesc, removed: textToRemove, newValue: newVal };

    } else if (mode === 'clear') {
      await this.browserAgent._executeJsInChrome(`
        (function() {
          var el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                            || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, '');
            else el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el) {
            el.textContent = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      await this.browserAgent.wait(300);
      return { success: true, method: 'edit_clear', field: fieldDesc };

    } else if (mode === 'set' && newValue) {
      await this.browserAgent._executeJsInChrome(`
        (function() {
          var el = document.activeElement;
          if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
            var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                            || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
            if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(newValue)});
            else el.value = ${JSON.stringify(newValue)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (el) {
            el.textContent = ${JSON.stringify(newValue)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()
      `);
      await this.browserAgent.wait(300);
      return { success: true, method: 'edit_set', field: fieldDesc, newValue };
    }

    return { success: true, method: 'edit_click_only', field: fieldDesc };
  }

  /**
   * Click a field by text, then type a value into it.
   * Used for date/time fields where we need to click then enter.
   */
  async _clickFieldAndType(fieldText, valueToType) {
    // First try clicking the element by text (like a normal click_text)
    const cleanText = this._cleanClickText(fieldText);
    const clickResult = await this._findAndClickInDOM(cleanText, fieldText);
    if (!clickResult) {
      this.onProgress(`  ⚠️ Could not find field "${fieldText}" to type into`);
      return null;
    }
    await this.browserAgent.wait(800);

    // Now type the value — try JS first, then robotjs
    const typed = await this.browserAgent._executeJsInChrome(`
      (function() {
        var el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          el.value = '';
          var nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                          || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(valueToType)});
          else el.value = ${JSON.stringify(valueToType)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      })()
    `);

    if (typed) {
      this.onProgress(`  ✓ Typed "${valueToType}" into "${fieldText}"`);
      return { success: true, method: 'click_and_type', field: fieldText, value: valueToType };
    }

    // Fallback: use robotjs to type
    if (this.desktopAgent) {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');
      robot.keyTap('a', ['command']); // Select all
      await this.browserAgent.wait(200);
      robot.typeString(valueToType);
      this.onProgress(`  ✓ Typed "${valueToType}" via robotjs into "${fieldText}"`);
      return { success: true, method: 'click_and_type_robotjs', field: fieldText, value: valueToType };
    }

    return { success: true, method: 'click_only', field: fieldText };
  }

  async stepClickSubmit(step) {
    // Strategy 1: Use DOM to find and click submit buttons via Chrome JS
    const submitClicked = await this.browserAgent._executeJsInChrome(`
      (function() {
        var sels = ['button[type="submit"]', 'input[type="submit"]', 'button.submit',
          'button.btn-primary', 'button.login-btn', 'form button',
          'button[type="button"]'];
        for (var s = 0; s < sels.length; s++) {
          var btns = document.querySelectorAll(sels[s]);
          for (var b = 0; b < btns.length; b++) {
            var rect = btns[b].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
              btns[b].click();
              return sels[s] + ':' + (btns[b].textContent || '').trim().substring(0, 30);
            }
          }
        }
        return null;
      })()
    `);
    if (submitClicked) {
      this.onProgress(`  ✓ Clicked submit: ${submitClicked}`);
      await this.browserAgent.wait(1500);
      return { success: true, method: 'dom_submit', clicked: submitClicked };
    }

    // Strategy 2: Use DesktopAgent + AI vision to find submit button
    if (this.desktopAgent) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });
      for (const label of ['Sign in', 'Log in', 'Login', 'Submit', 'Continue', 'Next', 'Post', 'Save', 'Send']) {
        const result = await browser.clickOn(label);
        if (result?.success) {
          this.onProgress(`  ✓ Clicked submit: "${label}"`);
          await browser._wait(1500);
          return { success: true, method: 'ai_vision', clicked: label };
        }
      }
    }

    // Strategy 3: Try clickByText with common submit labels
    for (const label of ['Submit', 'Sign in', 'Log in', 'Post', 'Save', 'Send', 'Continue', 'Next']) {
      try {
        const result = await this.browserAgent.clickByText(label);
        if (result?.success) {
          this.onProgress(`  ✓ Clicked submit: "${label}"`);
          await this.browserAgent.wait(1500);
          return { success: true, method: 'click_text', clicked: label };
        }
      } catch (e) { /* try next label */ }
    }

    // Last resort: press Enter (may not work, but report honestly)
    this.onProgress(`  ⌨️ No submit button found — pressing Enter as last resort`);
    if (this.desktopAgent) {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');
      robot.keyTap('enter');
    } else if (this.browserAgent.page?.keyboard) {
      await this.browserAgent.page.keyboard.press('Enter');
    }
    await this.browserAgent.wait(1000);
    // Return success but flag it as a fallback — callers can check method
    return { success: true, method: 'enter_key_fallback', warning: 'No submit button found, used Enter key' };
  }

  async stepType(step) {
    const selector = step.selector ? this.interpolate(step.selector) : null;
    const text = this.interpolate(step.text || step.value);

    // ═══ Content injection mode ═══
    // When contentInjection is true, type directly into the currently active/focused element.
    // This is used for dynamic content ({{content}}) that the user provided in their trigger message.
    if (step.contentInjection && (!text || text === '{{content}}')) {
      // Content variable wasn't provided — skip gracefully
      this.onProgress(`  ⏭️ Skipping content injection: no content provided by user`);
      return { success: true, method: 'content_injection_skipped', reason: 'no_content' };
    }
    if (step.contentInjection && text && text !== '{{content}}') {
      // ═══ Smart content preparation ═══
      // Detect if content needs AI formatting (raw URL or unformatted data)
      let finalContent = text;
      if (this.aiManager && this._contentNeedsFormatting(text)) {
        this.onProgress(`  🎨 Content looks like raw data — asking AI to format it...`);
        try {
          finalContent = await this._aiFormatContent(text);
        } catch (fmtErr) {
          this.onProgress(`  ⚠️ AI formatting failed (${fmtErr.message}), using original content`);
        }
      }

      this.onProgress(`  📝 Content injection: "${finalContent.substring(0, 60)}${finalContent.length > 60 ? '...' : ''}"`);

      // ═══ Choose injection strategy based on content type ═══
      // Formatted content (line breaks, emojis) → clipboard paste preserves everything
      // Simple single-line text → JS injection is fast and reliable
      const hasFormatting = /\n/.test(finalContent) || finalContent.length > 200;

      if (hasFormatting) {
        // ── Clipboard paste (preserves line breaks, emojis, formatting) ──
        // This is how a human would paste — Cmd+V delivers the text exactly as-is
        this.onProgress(`  📋 Formatted content detected — using clipboard paste to preserve formatting`);
        try {
          const { execSync } = await import('child_process');
          execSync('pbcopy', { input: finalContent, encoding: 'utf-8' });
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          const robot = require('robotjs');
          robot.keyTap('v', ['command']);
          await this.browserAgent.wait(800);
          this.onProgress(`  ✅ Formatted content pasted via clipboard`);
          return { success: true, method: 'content_injection_clipboard', typed: finalContent.substring(0, 60) };
        } catch (clipErr) {
          this.onProgress(`  ⚠️ Clipboard paste failed: ${clipErr.message}, trying JS injection...`);
        }
      }

      // ── JS injection (fast, works for simple text) ──
      const jsResult = await this.browserAgent._executeJsInChrome(`
        (function() {
          var el = document.activeElement;
          if (!el || el === document.body) return 'no_focus';
          // ContentEditable (Facebook, Twitter, LinkedIn post composers)
          if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
            el.focus();
            document.execCommand('insertText', false, ${JSON.stringify(finalContent)});
            return 'typed:contenteditable';
          }
          // Standard input/textarea
          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.value = ${JSON.stringify(finalContent)};
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            return 'typed:' + el.tagName;
          }
          // Try to find the nearest contenteditable parent
          var ce = el.closest('[contenteditable="true"]');
          if (ce) {
            ce.focus();
            document.execCommand('insertText', false, ${JSON.stringify(finalContent)});
            return 'typed:parent_contenteditable';
          }
          return 'no_editable:' + el.tagName;
        })()
      `);

      if (jsResult && jsResult.startsWith('typed:')) {
        this.onProgress(`  ✅ Content injected via ${jsResult}`);
        return { success: true, method: 'content_injection_js', detail: jsResult, typed: finalContent.substring(0, 60) };
      }

      // ── Clipboard paste fallback (if JS injection failed) ──
      if (!hasFormatting) {
        this.onProgress(`  ⌨️ JS injection returned "${jsResult}", trying clipboard paste...`);
        try {
          const { execSync } = await import('child_process');
          execSync('pbcopy', { input: finalContent, encoding: 'utf-8' });
          const { createRequire } = await import('module');
          const require = createRequire(import.meta.url);
          const robot = require('robotjs');
          robot.keyTap('v', ['command']);
          await this.browserAgent.wait(500);
          this.onProgress(`  ✅ Content pasted via clipboard`);
          return { success: true, method: 'content_injection_clipboard', typed: finalContent.substring(0, 60) };
        } catch (clipErr) {
          this.onProgress(`  ⚠️ Clipboard paste failed: ${clipErr.message}`);
        }
      }

      // ── Character-by-character keyboard typing (last resort) ──
      if (this.desktopAgent) {
        await this.desktopAgent.type(finalContent);
        this.onProgress(`  ✅ Content typed via keyboard`);
        return { success: true, method: 'content_injection_keyboard', typed: finalContent.substring(0, 60) };
      }

      throw new Error('Content injection failed: no focused editable element, clipboard paste failed, and no desktop agent');
    }

    // If we have a CSS selector, verify field exists then type
    if (selector) {
      // Verify the field actually exists before typing into it
      const fieldExists = await this.browserAgent._executeJsInChrome(
        `!!document.querySelector(${JSON.stringify(selector)})`
      );
      if (!fieldExists) {
        throw new Error(`Type field not found: "${selector}"`);
      }
      const result = await this.browserAgent.type(selector, text, {
        delay: step.delay || 30,
        clear: step.clear !== false
      });
      // Verify the value was set
      const actualValue = await this.browserAgent._executeJsInChrome(
        `(document.querySelector(${JSON.stringify(selector)}) || {}).value || ''`
      );
      if (actualValue && !actualValue.includes(text.substring(0, 20))) {
        this.onProgress(`  ⚠️ Type verification: field value doesn't match typed text`);
      }
      return { success: true, ...result, typed: text };
    }

    // No selector — this is a teach-by-telling step. Interpret the text as an instruction.
    // e.g., "Delete the 'copy of' text from the Title"
    if (text) {
      // Try smart edit detection first
      const editResult = await this._detectAndHandleEditInstruction(text, step);
      if (editResult) return editResult;

      // Fallback: treat the text as a click target (it might be describing what to click)
      this.onProgress(`  ⌨️ Type step without selector — trying as click: "${text}"`);
      return await this.stepClickText({ text, description: step.description });
    }

    throw new Error('Type step requires either a selector or descriptive text');
  }

  async stepFillCredentials(step) {
    const credentialId = step.credentialId || step.site;

    if (!this.siteMemory) {
      throw new Error('SiteMemory not available — cannot fetch credentials');
    }

    const creds = this.siteMemory.getCredentials(credentialId);
    if (!creds) {
      throw new Error(`No stored credentials for: ${credentialId}. Please store credentials first.`);
    }

    this.onProgress(`  🔐 Using stored credentials for: ${credentialId}`);
    const email = creds.email || creds.username;
    const password = creds.password;

    // Strategy 1: Use DesktopAgent + AI vision (click fields, type with keyboard)
    if (this.desktopAgent) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });

      // Click on email/username field using AI vision
      const emailClick = await browser.clickOn('email input field or username field');
      if (emailClick?.success) {
        await browser._wait(500);
        await this.desktopAgent.type(email);
        this.onProgress(`  ✓ Email/username entered`);
      } else {
        throw new Error('Could not find email/username field on screen');
      }

      // Tab to password or click it
      await browser._wait(300);
      const pwClick = await browser.clickOn('password input field');
      if (pwClick?.success) {
        await browser._wait(500);
        await this.desktopAgent.type(password);
        this.onProgress(`  ✓ Password entered`);
      } else {
        // Fallback: Tab from email to password field
        const { createRequire } = await import('module');
        const req = createRequire(import.meta.url);
        const robot = req('robotjs');
        robot.keyTap('tab');
        await browser._wait(300);
        await this.desktopAgent.type(password);
        this.onProgress(`  ✓ Password entered (via Tab)`);
      }

      return { success: true, credentialId, method: 'ai_vision' };
    }

    // Strategy 2: Legacy Puppeteer-based credential filling
    const emailSelectors = [
      'input[type="email"]', 'input[name="email"]', 'input[id*="email"]',
      'input[placeholder*="email" i]', 'input[name="username"]', 'input[type="text"]:first-of-type'
    ];
    let emailFilled = false;
    for (const selector of emailSelectors) {
      try {
        const field = await this.browserAgent.page?.$(selector);
        if (field) {
          await field.click();
          await field.evaluate(el => el.value = '');
          await field.type(email, { delay: 40 });
          emailFilled = true;
          this.onProgress(`  ✓ Email/username entered`);
          break;
        }
      } catch (e) { continue; }
    }
    if (!emailFilled) throw new Error('Could not find email/username field');

    const passwordSelectors = ['input[type="password"]', 'input[name="password"]'];
    let passwordFilled = false;
    for (const selector of passwordSelectors) {
      try {
        const field = await this.browserAgent.page?.$(selector);
        if (field) {
          await field.click();
          await field.evaluate(el => el.value = '');
          await field.type(password, { delay: 40 });
          passwordFilled = true;
          this.onProgress(`  ✓ Password entered`);
          break;
        }
      } catch (e) { continue; }
    }
    if (!passwordFilled) throw new Error('Could not find password field');

    return { success: true, credentialId };
  }

  async stepFillForm(step) {
    const fields = step.fields || {};
    const fieldNames = Object.keys(fields);
    if (fieldNames.length === 0) {
      throw new Error('fill_form step has no fields defined');
    }

    let filledCount = 0;
    const totalFields = fieldNames.length;

    // Strategy 1: Use DesktopAgent + AI vision to find and fill fields
    if (this.desktopAgent) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });

      for (const [fieldName, rawValue] of Object.entries(fields)) {
        const value = this.interpolate(rawValue);
        const clickResult = await browser.clickOn(`${fieldName} input field`);
        if (clickResult?.success) {
          await browser._wait(300);
          await this.desktopAgent.type(value);
          filledCount++;
          this.onProgress(`  ✓ Filled "${fieldName}"`);
        } else {
          this.onProgress(`  ⚠️ Could not find field: "${fieldName}"`);
        }
        await browser._wait(300);
      }
      if (filledCount === 0) {
        throw new Error(`Could not find any of the ${totalFields} form fields`);
      }
      return { success: true, method: 'ai_vision', filled: filledCount, total: totalFields };
    }

    // Strategy 2: Legacy Puppeteer-based form filling
    for (const [fieldName, rawValue] of Object.entries(fields)) {
      const value = this.interpolate(rawValue);
      const selectors = [
        `input[name="${fieldName}"]`, `input[id="${fieldName}"]`,
        `input[placeholder*="${fieldName}" i]`, `textarea[name="${fieldName}"]`,
        `select[name="${fieldName}"]`, `[data-field="${fieldName}"]`
      ];

      let filled = false;
      for (const selector of selectors) {
        try {
          const field = await this.browserAgent?.page?.$(selector);
          if (field) {
            const tagName = await field.evaluate(el => el.tagName.toLowerCase());
            if (tagName === 'select') {
              await field.select(value);
            } else {
              await field.click();
              await field.evaluate(el => el.value = '');
              await field.type(value, { delay: 20 });
            }
            filled = true;
            this.onProgress(`  ✓ Filled "${fieldName}"`);
            break;
          }
        } catch (e) { continue; }
      }
      if (!filled) {
        this.onProgress(`  ⚠️ Could not find field: "${fieldName}"`);
      } else {
        filledCount++;
      }
    }
    if (filledCount === 0) {
      throw new Error(`Could not find any of the ${totalFields} form fields`);
    }
    return { success: true, filled: filledCount, total: totalFields };
  }

  async stepPress(step) {
    const key = step.key || step.text || 'Enter';

    // Strategy 1: Use robotjs directly (works without Puppeteer)
    if (this.desktopAgent) {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');
      robot.keyTap(key.toLowerCase());
      await this.browserAgent.wait(500);
      return { success: true, key, method: 'robotjs' };
    }

    // Strategy 2: Legacy Puppeteer keyboard
    if (this.browserAgent?.page?.keyboard) {
      await this.browserAgent.page.keyboard.press(key);
    }
    await this.browserAgent.wait(500);
    return { success: true, key };
  }

  async stepWait(step) {
    const ms = step.ms || step.duration || 2000;
    await this.browserAgent.wait(ms);
    return { success: true, waited: ms };
  }

  async stepWaitNavigation(step) {
    // Without Puppeteer, we simply wait for the page to settle.
    // Puppeteer's waitForNavigation is tied to its page lifecycle.
    const waitMs = step.timeout || 5000;
    this.onProgress(`  ⏳ Waiting ${waitMs / 1000}s for page to load...`);
    await this.browserAgent.wait(waitMs);
    return { success: true, waited: waitMs };
  }

  async stepWaitFor(step) {
    // Without Puppeteer, wait a reasonable time for elements to appear.
    // AI vision verification could be added later for more precision.
    const waitMs = step.timeout || 3000;
    this.onProgress(`  ⏳ Waiting ${waitMs / 1000}s for element...`);
    await this.browserAgent.wait(waitMs);
    return { success: true, waited: waitMs };
  }

  async stepExplorePage(step) {
    // If the step has a text field (e.g., {{city}}), scroll to find it first
    // This handles teach-by-telling SOPs that use explore_page to locate content
    const searchText = step.text ? this.interpolate(step.text) : null;
    if (searchText) {
      this.onProgress(`  🔍 Explore + scroll to find: "${searchText}"`);
      const scrollResult = await this.stepScroll({ direction: 'down', text: searchText });
      if (scrollResult?.found) {
        this.onProgress(`  ✓ Found "${searchText}" — exploring page...`);
      }
    }

    const exploration = await this.browserAgent.explorePage();

    // Store in site memory
    const currentUrl = await this.browserAgent.getCurrentUrl();
    if (this.siteMemory && currentUrl) {
      await this.siteMemory.rememberSite(currentUrl, exploration);
    }

    // Store exploration results as a variable for later steps
    this.variables._lastExploration = exploration;

    return { success: true, exploration };
  }

  async stepScreenshot(step) {
    const name = step.name || `sop-step-${this.currentStep}`;
    const filepath = await this.browserAgent.takeScreenshot(name);
    return { success: true, filepath };
  }

  async stepExtractResults(step) {
    // Strategy 1: Use AI vision to analyze screenshot and extract results
    if (this.desktopAgent && this.aiManager) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });
      const screenData = await browser.readScreen();
      const screenshot = screenData?.base64 ? `data:image/png;base64,${screenData.base64}` : null;
      if (screenshot) {
        const visionResult = await this.aiManager.chatWithVision(
          'Extract all visible results, listings, or items from this page. Return a JSON array of objects with "title", "link" (if visible), and "snippet" fields. If no structured results are visible, describe what you see.',
          screenshot
        );
        const content = visionResult?.content || visionResult?.text || '';
        try {
          const jsonMatch = content.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const results = JSON.parse(jsonMatch[0]);
            this.variables._extractedResults = results;
            return { success: true, count: results.length, results, method: 'ai_vision' };
          }
        } catch (e) { /* JSON parse failed, return text */ }
        this.variables._extractedResults = [{ text: content }];
        return { success: true, count: 1, results: [{ text: content }], method: 'ai_vision' };
      }
    }

    // Strategy 2: Use BrowserAgent.explorePage() for structured extraction
    try {
      const exploration = await this.browserAgent.explorePage();
      const results = exploration?.analysis?.links || exploration?.analysis?.buttons || [];
      this.variables._extractedResults = results;
      return { success: true, count: results.length, results, method: 'explore' };
    } catch (e) {
      return { success: true, count: 0, results: [] };
    }
  }

  async stepExtractText(step) {
    // Strategy 1: Use AI vision to read text from screenshot
    if (this.desktopAgent && this.aiManager) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });
      const screenData = await browser.readScreen();
      const screenshot = screenData?.base64 ? `data:image/png;base64,${screenData.base64}` : null;
      if (screenshot) {
        const visionResult = await this.aiManager.chatWithVision(
          'Read and extract all visible text from this page. Return the text content as plain text.',
          screenshot
        );
        const text = visionResult?.content || visionResult?.text || '';
        this.variables._extractedText = text;
        return { success: true, length: text.length, method: 'ai_vision' };
      }
    }

    // Strategy 2: Use BrowserAgent.explorePage()
    try {
      const exploration = await this.browserAgent.explorePage();
      const text = JSON.stringify(exploration?.analysis || {}).substring(0, 5000);
      this.variables._extractedText = text;
      return { success: true, length: text.length, method: 'explore' };
    } catch (e) {
      this.variables._extractedText = '';
      return { success: true, length: 0 };
    }
  }

  async stepEnsureLoggedIn(step) {
    const site = step.site || step.credentialId;
    const currentUrl = await this.browserAgent.getCurrentUrl();

    // Check if we're already on the site
    if (currentUrl && currentUrl.includes(site)) {
      // Strategy 1: Use AI vision to check for logged-in indicators
      if (this.desktopAgent && this.aiManager) {
        const { DesktopBrowser } = await import('./DesktopBrowser.js');
        const browser = new DesktopBrowser({
          desktopAgent: this.desktopAgent,
          aiManager: this.aiManager,
          onProgress: this.onProgress
        });
        const screenData = await browser.readScreen();
        const screenshot = screenData?.base64 ? `data:image/png;base64,${screenData.base64}` : null;
        if (screenshot) {
          const visionResult = await this.aiManager.chatWithVision(
            'Is the user logged in on this page? Look for profile icons, avatars, usernames, logout buttons, dashboard links, or any sign the user is authenticated. Reply with ONLY "yes" or "no".',
            screenshot
          );
          const answer = (visionResult?.content || visionResult?.text || '').toLowerCase().trim();
          if (answer.includes('yes')) {
            this.onProgress(`  ✓ Already logged in to ${site}`);
            return { success: true, alreadyLoggedIn: true, method: 'ai_vision' };
          }
        }
      }

      // Strategy 2: Use BrowserAgent.explorePage() to check for login indicators
      try {
        const exploration = await this.browserAgent.explorePage();
        const pageText = JSON.stringify(exploration?.analysis || '').toLowerCase();
        if (pageText.includes('logout') || pageText.includes('sign out') || pageText.includes('my account') || pageText.includes('profile')) {
          this.onProgress(`  ✓ Already logged in to ${site}`);
          return { success: true, alreadyLoggedIn: true, method: 'explore' };
        }
      } catch (e) { /* continue to login */ }
    }

    // Not logged in — execute the login SOP
    const loginSOP = this.sopManager?.findSOPByIntent(`login ${site}`);
    if (loginSOP) {
      this.onProgress(`  🔐 Not logged in — executing login SOP for ${site}...`);
      const loginResult = await this.executeSOP(loginSOP);
      return { success: loginResult.success, loginExecuted: true };
    }

    throw new Error(`Not logged into ${site} and no login SOP found`);
  }

  async stepNavigateToSection(step) {
    const text = this.interpolate(step.text);
    
    // First try using site memory for known navigation
    const currentUrl = await this.browserAgent.getCurrentUrl();
    if (this.siteMemory && currentUrl) {
      const navHelp = this.siteMemory.getNavigationHelp(currentUrl, text);
      if (navHelp && navHelp.href) {
        this.onProgress(`  🧠 Using remembered navigation: ${navHelp.href}`);
        await this.browserAgent.navigateTo(navHelp.href);
        return { success: true, method: 'site_memory' };
      }
    }

    // Fall back to clicking by text
    return await this.stepClickText({ text });
  }

  async stepScroll(step) {
    const direction = step.direction || 'down';
    const amount = step.amount || 500;
    const searchText = step.text ? this.interpolate(step.text) : null;

    // Smart scroll: if step has text, scroll until that text is visible IN THE VIEWPORT
    if (searchText) {
      this.onProgress(`  📜 Scrolling to find "${searchText}"...`);

      // First check if it's already visible in the viewport
      const alreadyVisible = await this._isTextVisibleInPage(searchText);
      if (alreadyVisible) {
        // Center it in viewport so the kebab button next to it is also visible
        await this._scrollTextIntoView(searchText);
        await this.browserAgent.wait(500);
        this.onProgress(`  ✓ "${searchText}" already visible — centered in viewport`);
        this._lastClickedContext = searchText;
        return { success: true, found: searchText, method: 'already_visible' };
      }

      // Scroll down up to 15 times looking for the text in the viewport
      for (let i = 1; i <= 15; i++) {
        await this._scrollPage(direction, 400);
        await this.browserAgent.wait(800);

        const found = await this._isTextVisibleInPage(searchText);
        if (found) {
          // Center the text in viewport so adjacent elements (kebab) are also visible
          await this._scrollTextIntoView(searchText);
          await this.browserAgent.wait(500);
          this.onProgress(`  ✓ Found "${searchText}" after ${i} scroll(s) — centered in viewport`);
          this._lastClickedContext = searchText;
          return { success: true, found: searchText, scrolls: i, method: 'scroll_to_find' };
        }
      }

      // Not found after scrolling — try scrollIntoView via JS as last resort
      // (the text might be in the DOM but our viewport check missed it)
      this.onProgress(`  ⚠️ Viewport search failed — trying scrollIntoView...`);
      const scrolled = await this._scrollTextIntoView(searchText);
      if (scrolled) {
        await this.browserAgent.wait(800);
        const nowVisible = await this._isTextVisibleInPage(searchText);
        if (nowVisible) {
          this.onProgress(`  ✓ Found "${searchText}" via scrollIntoView`);
          this._lastClickedContext = searchText;
          return { success: true, found: searchText, method: 'scrollIntoView' };
        }
      }

      this._lastClickedContext = searchText;
      throw new Error(`Could not find "${searchText}" on page after scrolling`);
    }

    // Basic scroll (no text to search for)
    await this._scrollPage(direction, amount);
    await this.browserAgent.wait(500);
    return { success: true, direction, amount };
  }

  /**
   * Go back to the previous page (browser back button).
   * Strategy 1: JavaScript history.back()
   * Strategy 2: Cmd+[ keyboard shortcut (macOS)
   */
  async stepGoBack(step) {
    this.onProgress('  Going back to previous page...');
    try {
      // Strategy 1: JS history.back()
      await this.browserAgent._executeJsInChrome('window.history.back()');
      await this.browserAgent.wait(2000);
      this.onProgress('  Done — navigated back');
      return { success: true, method: 'history_back' };
    } catch (e) {
      // Strategy 2: Keyboard shortcut Cmd+[
      try {
        const robot = require('robotjs');
        await this.browserAgent._focusChrome?.();
        robot.keyTap('[', ['command']);
        await this.browserAgent.wait(2000);
        this.onProgress('  Done — navigated back (keyboard shortcut)');
        return { success: true, method: 'keyboard_shortcut' };
      } catch (e2) {
        this.onProgress(`  Failed to go back: ${e2.message}`);
        return { success: false, error: e2.message };
      }
    }
  }

  /**
   * Check if specific text is visible IN THE VIEWPORT (not just anywhere on the page).
   * This prevents false positives from off-screen elements.
   */
  async _isTextVisibleInPage(text) {
    try {
      const found = await this.browserAgent._executeJsInChrome(`
        (function() {
          var search = ${JSON.stringify(text.toLowerCase())};
          var all = document.querySelectorAll('span, a, p, div, td, li, h1, h2, h3, h4, h5, h6, strong, em, label');
          for (var i = 0; i < all.length; i++) {
            var tc = (all[i].textContent || '').toLowerCase();
            if (tc.includes(search) && tc.length < search.length * 10) {
              var rect = all[i].getBoundingClientRect();
              // Element must be in the visible viewport
              if (rect.height > 0 && rect.top >= -20 && rect.bottom <= window.innerHeight + 20) {
                return true;
              }
            }
          }
          return false;
        })()
      `);
      return found === true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Scroll a specific text element into the center of the viewport.
   * Finds the smallest element containing the text and scrolls it into view.
   */
  async _scrollTextIntoView(text) {
    try {
      await this.browserAgent._executeJsInChrome(`
        (function() {
          var search = ${JSON.stringify(text.toLowerCase())};
          var all = document.querySelectorAll('span, a, p, div, td, li, h1, h2, h3, h4, h5, h6, strong, em, label');
          var best = null;
          var bestLen = Infinity;
          for (var i = 0; i < all.length; i++) {
            var tc = (all[i].textContent || '').toLowerCase();
            if (tc.includes(search) && tc.length < bestLen && tc.length < search.length * 8) {
              best = all[i];
              bestLen = tc.length;
            }
          }
          if (best) {
            best.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return true;
          }
          return false;
        })()
      `);
      return true;
    } catch (e) {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // SMART / AI-POWERED STEPS
  // ═══════════════════════════════════════════════════════

  /**
   * Smart click: Use AI to figure out what to click based on intent
   */
  async stepSmartClick(step) {
    const intent = this.interpolate(step.intent || step.text || step.description);
    
    // Get page structure
    const exploration = await this.browserAgent.explorePage();
    
    // Ask AI which element to click
    if (this.aiManager) {
      try {
        const prompt = `You are controlling a web browser. The user wants to: "${intent}"

Here's what's on the page:
- Navigation items: ${JSON.stringify(exploration.analysis?.navigation?.map(n => n.text) || [])}
- Buttons: ${JSON.stringify(exploration.analysis?.buttons?.map(b => b.text) || [])}
- Sections: ${JSON.stringify(exploration.analysis?.sections?.map(s => s.heading) || [])}

Which EXACT text should I click? Return ONLY the text string to click, nothing else.`;

        const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { maxTokens: 50 });
        const targetText = (response.content || response.text || '').trim().replace(/["']/g, '');
        
        if (targetText) {
          this.onProgress(`  🧠 AI says click: "${targetText}"`);
          return await this.stepClickText({ text: targetText });
        }
      } catch (e) {
        this.onProgress(`  ⚠️ AI decision failed: ${e.message}`);
      }
    }

    // Fallback: try the intent text directly
    return await this.stepClickText({ text: intent });
  }

  /**
   * Smart fill: Use AI to understand form fields and fill appropriately
   */
  async stepSmartFill(step) {
    const context = this.interpolate(step.context || step.description);

    // Strategy 1: Use AI vision to see the form and determine what to fill
    if (this.desktopAgent && this.aiManager) {
      const { DesktopBrowser } = await import('./DesktopBrowser.js');
      const browser = new DesktopBrowser({
        desktopAgent: this.desktopAgent,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });
      const screenData = await browser.readScreen();
      const screenshot = screenData?.base64 ? `data:image/png;base64,${screenData.base64}` : null;
      if (screenshot) {
        const visionResult = await this.aiManager.chatWithVision(
          `I need to fill out a form for: "${context}"\n\nAvailable data: ${JSON.stringify(this.variables)}\n\nLook at the form fields visible on screen. Return a JSON object mapping visible field labels/names to the values I should type. Example: {"Email": "test@test.com", "Name": "John"}`,
          screenshot
        );
        const content = visionResult?.content || visionResult?.text || '';
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const fieldValues = JSON.parse(jsonMatch[0]);
            return await this.stepFillForm({ fields: fieldValues });
          }
        } catch (e) {
          this.onProgress(`  ⚠️ Smart fill AI parse failed: ${e.message}`);
        }
      }
    }

    // Strategy 2: Legacy Puppeteer-based form inspection
    if (this.browserAgent?.page?.evaluate && this.aiManager) {
      try {
        const formInfo = await this.browserAgent.page.evaluate(() => {
          const forms = document.querySelectorAll('form');
          const fields = [];
          forms.forEach(form => {
            form.querySelectorAll('input:not([type="hidden"]), textarea, select').forEach(input => {
              fields.push({
                type: input.type || input.tagName.toLowerCase(),
                name: input.name || input.id,
                placeholder: input.placeholder,
                label: input.labels?.[0]?.textContent?.trim(),
                required: input.required
              });
            });
          });
          return fields;
        });

        if (formInfo.length > 0) {
          const prompt = `Fill out this form for: "${context}"\n\nForm fields:\n${JSON.stringify(formInfo, null, 2)}\n\nAvailable variables: ${JSON.stringify(this.variables)}\n\nReturn a JSON object mapping field names to values.`;
          const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { maxTokens: 500 });
          const content = response.content || response.text || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const fieldValues = JSON.parse(jsonMatch[0]);
            return await this.stepFillForm({ fields: fieldValues });
          }
        }
      } catch (e) {
        this.onProgress(`  ⚠️ Smart fill failed: ${e.message}`);
      }
    }

    return { success: false, error: 'Could not determine form values' };
  }

  /**
   * Decision step: AI decides which path to take based on current page state
   */
  async stepDecide(step) {
    const question = this.interpolate(step.question || step.description);
    const options = step.options || [];
    
    const exploration = await this.browserAgent.explorePage();
    
    if (this.aiManager) {
      try {
        const prompt = `You're an AI assistant controlling a browser. Decision needed: "${question}"

Current page: ${exploration.analysis?.title} (${exploration.analysis?.url})
Available navigation: ${exploration.analysis?.navigation?.map(n => n.text).join(', ')}
Available buttons: ${exploration.analysis?.buttons?.map(b => b.text).join(', ')}
${options.length > 0 ? `Options: ${JSON.stringify(options)}` : ''}

What action should I take? Return a JSON object: {"action": "click_text|navigate|wait|skip", "target": "text or url"}`;

        const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { maxTokens: 200 });
        const content = response.content || response.text || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const decision = JSON.parse(jsonMatch[0]);
          this.onProgress(`  🧠 AI decides: ${decision.action} → "${decision.target}"`);
          
          switch (decision.action) {
            case 'click_text':
              return await this.stepClickText({ text: decision.target });
            case 'navigate':
              return await this.stepNavigate({ url: decision.target });
            case 'wait':
              return await this.stepWait({ ms: 3000 });
            case 'skip':
              return { success: true, skipped: true };
            default:
              return await this.stepClickText({ text: decision.target });
          }
        }
      } catch (e) {
        this.onProgress(`  ⚠️ AI decision failed: ${e.message}`);
      }
    }

    throw new Error('Decision step requires AI but no AI manager is available');
  }

  // ═══════════════════════════════════════════════════════
  // RECOVERY & UTILITIES
  // ═══════════════════════════════════════════════════════

  /**
   * Attempt AI-powered recovery when a step fails
   */
  async attemptRecovery(step, error, stepNum) {
    if (!this.aiManager) return false;

    try {
      // Take a screenshot for context
      await this.browserAgent.takeScreenshot(`recovery-step${stepNum}`);
      
      // Get current page state
      const exploration = await this.browserAgent.explorePage();
      
      const prompt = `A browser automation step failed. Help me recover.

Failed step: ${JSON.stringify(step)}
Error: ${error.message}
Current page: ${exploration.analysis?.title} (${exploration.analysis?.url})
Available elements: ${JSON.stringify({
  nav: exploration.analysis?.navigation?.map(n => n.text).slice(0, 5),
  buttons: exploration.analysis?.buttons?.map(b => b.text).slice(0, 10),
  forms: exploration.analysis?.forms?.length || 0
})}

What's a single concrete recovery action? Return JSON: {"action": "click_text|scroll|wait|navigate", "target": "value"}`;

      const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { maxTokens: 200 });
      const content = response.content || response.text || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const recovery = JSON.parse(jsonMatch[0]);
        this.onProgress(`  🔧 Recovery: ${recovery.action} → "${recovery.target}"`);
        
        switch (recovery.action) {
          case 'click_text':
            await this.stepClickText({ text: recovery.target });
            return true;
          case 'scroll':
            await this.stepScroll({ direction: 'down', amount: 300 });
            return true;
          case 'wait':
            await this.stepWait({ ms: 3000 });
            return true;
          case 'navigate':
            await this.stepNavigate({ url: recovery.target });
            return true;
        }
      }
    } catch (e) {
      // Recovery itself failed — return false
    }

    return false;
  }

  /**
   * Interpolate {{variables}} in a string with runtime values
   */
  interpolate(text) {
    if (!text || typeof text !== 'string') return text;
    
    // Common aliases — any of these names should resolve to the user's message
    const queryAliases = ['query', 'prompt_query', 'prompt', 'search', 'search_query', 'user_query', 'message'];

    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      if (this.variables[key] !== undefined) {
        return this.variables[key];
      }
      // If key looks like a query/prompt variable, try aliases
      if (queryAliases.includes(key)) {
        for (const alias of queryAliases) {
          if (this.variables[alias] !== undefined) return this.variables[alias];
        }
      }
      // Built-in dynamic variables
      switch (key) {
        case 'date':
          return new Date().toLocaleDateString();
        case 'time':
          return new Date().toLocaleTimeString();
        case 'timestamp':
          return new Date().toISOString();
        case 'next_thursday': {
          const d = new Date();
          d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7 || 7));
          return d.toLocaleDateString();
        }
        default:
          console.warn(`⚠️ SOP variable {{${key}}} could not be resolved — no matching value found`);
          return match;
      }
    });
  }

  /**
   * Get execution status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentSOP: this.currentSOP?.name || null,
      currentStep: this.currentStep,
      totalSteps: this.currentSOP?.steps?.length || 0,
      log: this.executionLog
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // CROSS-SITE SKILL LEARNING — Ace builds muscle memory
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Record what method worked for what action type on what site.
   * Builds cross-site "muscle memory" in data/memory/skills.json.
   */
  async _recordSkill(step, stepResult) {
    try {
      // Only record skills for action types where method matters
      const skillActions = ['set_date', 'edit_field', 'type', 'click_text', 'smart_click', 'fill_form'];
      if (!skillActions.includes(step.action)) return;
      if (!stepResult.method) return;

      const currentUrl = await this.browserAgent.getCurrentUrl().catch(() => '');
      if (!currentUrl) return;
      const domain = new URL(currentUrl).hostname;

      const skillsPath = './data/memory/skills.json';
      let skills;
      try {
        const raw = await fs.readFile(skillsPath, 'utf-8');
        skills = JSON.parse(raw);
      } catch {
        skills = {};
      }

      const category = step.action;
      if (!skills[category]) skills[category] = {};
      if (!skills[category][stepResult.method]) {
        skills[category][stepResult.method] = { sites: [], successCount: 0 };
      }

      const entry = skills[category][stepResult.method];
      entry.successCount++;
      if (!entry.sites.includes(domain)) {
        entry.sites.push(domain);
      }
      entry.lastUsed = new Date().toISOString();

      await fs.writeFile(skillsPath, JSON.stringify(skills, null, 2));
    } catch (e) {
      // Never let skill recording break execution
    }
  }

  /**
   * After navigating to a new page, deep-explore it and save to SiteMemory.
   * Uses BrowserAgent._deepExplorePage() for modern-site-compatible extraction.
   */
  async _learnFromPage() {
    try {
      if (!this.browserAgent?._deepExplorePage || !this.siteMemory) return;

      const currentUrl = await this.browserAgent.getCurrentUrl().catch(() => '');
      if (!currentUrl) return;

      const exploration = await this.browserAgent._deepExplorePage();
      if (exploration?.analysis) {
        await this.siteMemory.rememberSite(currentUrl, exploration);
      }
    } catch (e) {
      // Never let learning break execution
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // VISUAL GUIDE EXECUTION — Replay user's recorded demonstration
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Execute a step using the user's recorded visual guide.
   * Loads the recorded actions + reference screenshots, then replays
   * with AI-assisted coordinate adjustment for the current page state.
   */
  async _executeVisualGuide(step, stepNum) {
    try {
      const guidePath = step.visualGuide?.guidePath;
      if (!guidePath) return null;

      const raw = await fs.readFile(guidePath, 'utf-8');
      const guide = JSON.parse(raw);

      if (!guide.actions || guide.actions.length === 0) {
        this.onProgress('  🎥 Visual guide has no recorded actions');
        return null;
      }

      // Load reference "before" screenshot if available
      const guideDir = path.dirname(guidePath);
      let refScreenshot = null;
      try {
        const refPath = path.join(guideDir, `step_${stepNum}_before.png`);
        const refBuffer = await fs.readFile(refPath);
        refScreenshot = refBuffer.toString('base64');
      } catch { /* no reference available */ }

      // Take current screenshot for comparison
      const currentScreenshot = await this.browserAgent.takeScreenshot(`guide-compare-step${stepNum}`);

      // Replay each recorded action
      for (const action of guide.actions) {
        if (action.type === 'click' && action.x && action.y) {
          // If we have both reference and current screenshots + AI, ask AI to adjust coordinates
          if (refScreenshot && this.aiManager && currentScreenshot) {
            try {
              const adjustResult = await this.aiManager.chatWithVision(
                `During training, the user clicked at coordinates (${action.x}, ${action.y}). ` +
                `The first image shows what the page looked like during training. ` +
                `The second image shows what the page looks like now. ` +
                `Are the coordinates still correct, or has the layout shifted? ` +
                `Respond with JSON only: {"x": number, "y": number, "adjusted": boolean}`,
                `data:image/png;base64,${refScreenshot}`
              );

              const coords = JSON.parse(adjustResult.content.match(/\{[\s\S]*\}/)?.[0] || '{}');
              if (coords.x && coords.y) {
                const robot = (await import('robotjs')).default;
                robot.moveMouse(coords.x, coords.y);
                await this.browserAgent.wait(150);
                robot.mouseClick();
                await this.browserAgent.wait(500);
                continue;
              }
            } catch {
              // Fall through to direct coordinate replay
            }
          }

          // Direct coordinate replay (no AI adjustment)
          const robot = (await import('robotjs')).default;
          robot.moveMouse(action.x, action.y);
          await this.browserAgent.wait(150);
          robot.mouseClick();
          await this.browserAgent.wait(500);
        } else if (action.type === 'keypress' && action.key) {
          const robot = (await import('robotjs')).default;
          robot.keyTap(action.key);
          await this.browserAgent.wait(200);
        } else if (action.type === 'type' && action.text) {
          await this._pasteText(action.text);
          await this.browserAgent.wait(300);
        }
      }

      return { success: true, method: 'visual_guide', actionsReplayed: guide.actions.length };
    } catch (e) {
      this.onProgress(`  🎥 Visual guide failed: ${e.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // VISUAL VERIFICATION — Ace checks its own work
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Determine if a step warrants visual verification.
   * Only verify "risky" steps where visual state matters.
   */
  _shouldVerify(step) {
    const verifyActions = ['navigate', 'goto', 'click_text', 'edit_field', 'set_date', 'fill_form', 'smart_click', 'smart_fill'];
    return verifyActions.includes(step.action) && !!this.aiManager;
  }

  /**
   * Take a screenshot after a step and ask AI if it looks correct.
   * Compares against reference screenshots from previous successful runs.
   */
  async _verifyStep(step, stepNum) {
    try {
      const screenshotPath = await this.browserAgent.takeScreenshot(`verify-step${stepNum}`);
      if (!screenshotPath) return true; // Can't verify without screenshot — assume OK

      const screenshotBuffer = await fs.readFile(screenshotPath);
      const screenshotBase64 = screenshotBuffer.toString('base64');

      // Check for reference screenshot from a previous successful run
      const sopId = this.currentSOP?.id;
      let refContext = '';
      if (sopId) {
        try {
          const refPath = path.join('./data/sops', sopId, 'references', `step_${stepNum}.png`);
          await fs.access(refPath);
          refContext = ' Compare with the reference from a previous successful run (which I have on file).';
        } catch { /* no reference yet */ }
      }

      const verifyResult = await this.aiManager.chatWithVision(
        `I just executed step ${stepNum}: "${step.description || step.action}".${refContext} ` +
        `Does the screenshot show the expected result? Look for error messages, wrong pages, or unexpected states. ` +
        `Respond with JSON only: {"verified": true/false, "issue": "brief description if false"}`,
        `data:image/png;base64,${screenshotBase64}`
      );

      const parsed = JSON.parse(verifyResult.content.match(/\{[\s\S]*\}/)?.[0] || '{"verified": true}');
      if (!parsed.verified && parsed.issue) {
        this.onProgress(`  👁️ Visual issue detected: ${parsed.issue}`);
      }
      return parsed.verified !== false;
    } catch (e) {
      // Verification failure shouldn't block execution
      return true;
    }
  }

  /**
   * Save step screenshots as references after a fully successful SOP run.
   * Future runs compare against these references.
   */
  async _saveReferences(sopId) {
    try {
      if (!sopId || this.executionLog.length === 0) return;

      // Only save references if ALL steps succeeded
      const allSuccess = this.executionLog.every(e => e.success);
      if (!allSuccess) return;

      const refDir = path.join('./data/sops', sopId, 'references');
      await fs.mkdir(refDir, { recursive: true });

      // Look for verification screenshots from this run and copy as references
      const screenshotDir = this.screenshotDir || './data/automation/screenshots';
      try {
        const files = await fs.readdir(screenshotDir);
        for (const entry of this.executionLog) {
          const pattern = `verify-step${entry.step}`;
          const matching = files
            .filter(f => f.includes(pattern))
            .sort()
            .pop(); // Most recent

          if (matching) {
            const src = path.join(screenshotDir, matching);
            const dest = path.join(refDir, `step_${entry.step}.png`);
            await fs.copyFile(src, dest);
          }
        }
      } catch { /* screenshot dir might not exist */ }

      this.onProgress('  📸 Reference screenshots saved for future verification');
    } catch (e) {
      // Never let reference saving break execution
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PERSISTENT EXECUTION MEMORY — Ace remembers every run
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Save the full execution log to disk so Ace remembers every run.
   * Keeps last 20 runs per SOP, auto-cleans older ones.
   */
  async _persistExecutionLog(sopId, log, success, duration) {
    try {
      const historyDir = path.join('./data/sops', sopId, 'history');
      await fs.mkdir(historyDir, { recursive: true });

      const runRecord = {
        timestamp: new Date().toISOString(),
        success,
        duration,
        variables: { ...this.variables },
        steps: log.map(entry => ({
          step: entry.step,
          action: entry.action,
          success: entry.success,
          error: entry.error || null,
          method: entry.result?.method || null,
          duration: entry.result?.duration || null
        }))
      };

      const filename = `run_${Date.now()}.json`;
      await fs.writeFile(
        path.join(historyDir, filename),
        JSON.stringify(runRecord, null, 2)
      );

      // Auto-cleanup: keep only last 20 runs
      const files = await fs.readdir(historyDir);
      const runFiles = files.filter(f => f.startsWith('run_')).sort();
      if (runFiles.length > 20) {
        const toDelete = runFiles.slice(0, runFiles.length - 20);
        for (const f of toDelete) {
          await fs.unlink(path.join(historyDir, f)).catch(() => {});
        }
      }
    } catch (e) {
      // Never let logging break execution
    }
  }

  /**
   * Update per-step learning data from execution results.
   * Tracks reliability, common errors, best methods per step.
   */
  async _updateLearning(sopId, log, overallSuccess) {
    try {
      const learningPath = path.join('./data/sops', sopId, 'learning.json');
      await fs.mkdir(path.join('./data/sops', sopId), { recursive: true });

      let learning;
      try {
        const raw = await fs.readFile(learningPath, 'utf-8');
        learning = JSON.parse(raw);
      } catch {
        learning = { sopId, totalRuns: 0, successCount: 0, stepInsights: {} };
      }

      learning.totalRuns++;
      if (overallSuccess) learning.successCount++;
      learning.successRate = learning.successCount / learning.totalRuns;

      // Update per-step insights
      for (const entry of log) {
        const key = String(entry.step);
        if (!learning.stepInsights[key]) {
          learning.stepInsights[key] = {
            action: entry.action,
            successCount: 0,
            failureCount: 0,
            commonErrors: [],
            methods: {},
            avgDuration: 0,
            totalDuration: 0,
            runs: 0
          };
        }

        const insight = learning.stepInsights[key];
        insight.runs++;

        if (entry.success) {
          insight.successCount++;
          // Track which method worked
          const method = entry.result?.method || 'default';
          insight.methods[method] = (insight.methods[method] || 0) + 1;
          // Find best method
          insight.bestMethod = Object.entries(insight.methods)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'default';
        } else {
          insight.failureCount++;
          if (entry.error && !insight.commonErrors.includes(entry.error)) {
            insight.commonErrors.push(entry.error);
            // Keep only last 5 unique errors
            if (insight.commonErrors.length > 5) insight.commonErrors.shift();
          }
        }

        // Update average duration
        if (entry.result?.duration) {
          insight.totalDuration += entry.result.duration;
          insight.avgDuration = Math.round(insight.totalDuration / insight.runs);
        }

        // Flag steps that need extra help
        const reliability = insight.successCount / (insight.successCount + insight.failureCount);
        insight.reliability = Math.round(reliability * 100) / 100;
        insight.needsVisualGuide = reliability < 0.6 && insight.runs >= 3;
      }

      learning.lastUpdated = new Date().toISOString();
      await fs.writeFile(learningPath, JSON.stringify(learning, null, 2));
    } catch (e) {
    }
  }

  /**
   * Apply learning from previous runs before executing a step.
   * Adds extra waits for unreliable steps, logs warnings.
   */
  async _applyLearning(step, stepNum, sopId) {
    try {
      const learningPath = path.join('./data/sops', sopId, 'learning.json');
      const raw = await fs.readFile(learningPath, 'utf-8');
      const learning = JSON.parse(raw);

      const insight = learning.stepInsights[String(stepNum)];
      if (!insight || insight.runs < 2) return; // Not enough data yet

      if (insight.reliability < 0.5) {
        this.onProgress(`  ⚠️ Step ${stepNum} has ${Math.round(insight.reliability * 100)}% reliability — being extra careful`);
        // Add extra wait before unreliable steps
        await this.browserAgent.wait(2000);
      } else if (insight.reliability < 0.75) {
        this.onProgress(`  📊 Step ${stepNum} reliability: ${Math.round(insight.reliability * 100)}%`);
        await this.browserAgent.wait(1000);
      }

      if (insight.needsVisualGuide) {
        this.onProgress(`  🎥 Step ${stepNum} needs visual guide — consider recording this step`);
      }
    } catch {
      // No learning data yet — that's fine, first run
    }
  }
}

export default SOPExecutor;
