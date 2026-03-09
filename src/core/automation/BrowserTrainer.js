/**
 * BrowserTrainer — "Train By Example" Mode
 *
 * No Puppeteer — uses AppleScript to control the user's real Chrome browser.
 *
 * Opens Chrome where the user performs actions while Ace watches.
 * Every click, keystroke, navigation, and form fill is recorded as an SOP step.
 * Uses AppleScript `execute javascript` to inject event tracking into the page.
 *
 * Flow:
 *   1. User clicks "Train By Example" in dashboard
 *   2. Ace opens Chrome with event tracking injected via AppleScript
 *   3. User navigates, clicks, types — doing their normal workflow
 *   4. User clicks "Stop Training" when done
 *   5. Ace converts recorded events into a clean SOP
 *   6. SOP is saved and ready for autonomous execution
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';

export class BrowserTrainer {
  constructor(options = {}) {
    this.isRecording = false;
    this.recordedSteps = [];
    this.currentUrl = '';
    this.sessionName = '';
    this.startTime = null;

    this.screenshotDir = options.screenshotDir || './data/training/screenshots';
    this.sopManager = null;
    this.siteMemory = null;
    this.onProgress = options.onProgress || ((msg) => console.log(`[Trainer] ${msg}`));
    this.onStepRecorded = options.onStepRecorded || (() => {});

    // Deduplication
    this.lastAction = null;
    this.lastActionTime = 0;
    this.minActionInterval = 300;

    // Polling
    this._pollInterval = null;
    this._screenshotInterval = null;
    this._lastPageUrl = '';
  }

  async initialize(systems = {}) {
    this.sopManager = systems.sopManager || null;
    this.siteMemory = systems.siteMemory || null;

    await fs.mkdir(this.screenshotDir, { recursive: true });
    await fs.mkdir('./data/training', { recursive: true });

    console.log('🎓 BrowserTrainer initialized — ready for "Train By Example" (AppleScript-based)');
    return this;
  }

  // ═══════════════════════════════════════════════════════
  // APPLESCRIPT HELPERS
  // ═══════════════════════════════════════════════════════

  async _runAppleScript(script) {
    return new Promise((resolve, reject) => {
      const escaped = script.replace(/'/g, "'\\''");
      exec(`osascript -ss -e '${escaped}'`, { timeout: 15000 }, (err, stdout) => {
        if (err) reject(err);
        else {
          let result = stdout.trim();
          if (result.startsWith('"') && result.endsWith('"')) result = result.slice(1, -1);
          resolve(result);
        }
      });
    });
  }

  async _executeJsInChrome(jsCode) {
    try {
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

      if (result === 'true') return true;
      if (result === 'false') return false;
      if (result === 'null' || result === 'undefined' || result === '') return null;
      try { return JSON.parse(result); } catch (e) { return result; }
    } catch (e) {
      return null;
    }
  }

  async _captureScreenshot(filepath) {
    return new Promise((resolve, reject) => {
      exec(`screencapture -x "${filepath}"`, { timeout: 5000 }, (err) => {
        if (err) reject(err);
        else resolve(filepath);
      });
    });
  }

  async _getChromeUrl() {
    try {
      return await this._runAppleScript(`
        tell application "Google Chrome"
          return URL of active tab of front window
        end tell
      `);
    } catch (e) {
      return '';
    }
  }

  async _getChromeTitle() {
    try {
      return await this._runAppleScript(`
        tell application "Google Chrome"
          return title of active tab of front window
        end tell
      `);
    } catch (e) {
      return '';
    }
  }

  // ═══════════════════════════════════════════════════════
  // START / STOP TRAINING
  // ═══════════════════════════════════════════════════════

  async startTraining(sessionName, startUrl = '') {
    if (this.isRecording) {
      return { success: false, error: 'A training session is already in progress' };
    }

    this.sessionName = sessionName || `training_${Date.now()}`;
    this.recordedSteps = [];
    this.startTime = Date.now();
    this.currentUrl = startUrl || '';

    this.onProgress(`🎓 Starting training session: "${this.sessionName}"`);
    this.onProgress('👀 Ace is watching — perform your actions in Chrome...');

    try {
      // Ensure Chrome is open
      await this._runAppleScript(`
        tell application "Google Chrome"
          activate
          if (count of windows) = 0 then make new window
        end tell
      `);
      await this._wait(1000);

      // Navigate to start URL if provided
      if (startUrl && startUrl.startsWith('http')) {
        try {
          await this._runAppleScript(`
            tell application "Google Chrome"
              set URL of active tab of front window to "${startUrl.replace(/"/g, '\\"')}"
            end tell
          `);
          await this._wait(3000);
          this.currentUrl = startUrl;

          const title = await this._getChromeTitle();
          await this.addStep({
            action: 'navigate',
            url: startUrl,
            description: `Start at: ${title || startUrl}`,
            timestamp: Date.now()
          });
        } catch (navError) {
          this.onProgress(`⚠️ Could not navigate to start URL: ${navError.message}`);
        }
      }

      // Inject the event tracker into Chrome
      await this._injectTracker();

      this.isRecording = true;

      // Start polling for events and URL changes
      this._startPolling();

      // Start periodic screenshots
      this._screenshotInterval = setInterval(async () => {
        if (this.isRecording) {
          try { await this.takeTrainingScreenshot(`frame_${Date.now()}`); } catch (e) {}
        }
      }, 5000);

      return {
        success: true,
        sessionName: this.sessionName,
        message: 'Training started! Perform your actions in Chrome. Ace is recording every step.',
        stepsRecorded: 0
      };
    } catch (error) {
      this.onProgress(`❌ Failed to start training: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inject event tracking JavaScript into Chrome's active tab via AppleScript.
   * Events are stored in window.__aceTrainEvents and polled periodically.
   */
  async _injectTracker() {
    const trackerCode = `
      (function() {
        if (window.__aceTrainerInjected) return 'already_injected';
        window.__aceTrainerInjected = true;
        window.__aceTrainEvents = [];

        function genSelector(el) {
          if (!el || !el.tagName) return null;
          if (el.id) return '#' + el.id;
          if (el.name) return el.tagName.toLowerCase() + '[name="' + el.name + '"]';
          if (el.type && el.placeholder) return 'input[type="' + el.type + '"][placeholder="' + el.placeholder + '"]';
          if (el.getAttribute('aria-label')) return '[aria-label="' + el.getAttribute('aria-label') + '"]';
          if (el.getAttribute('data-testid')) return '[data-testid="' + el.getAttribute('data-testid') + '"]';
          return el.tagName.toLowerCase();
        }

        document.addEventListener('click', function(e) {
          var el = e.target;
          if (el.id === '__ace_training_banner') return;
          window.__aceTrainEvents.push({
            type: 'click', tag: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().substring(0, 100),
            id: el.id || null, href: el.href || null,
            selector: genSelector(el), timestamp: Date.now()
          });
        }, true);

        document.addEventListener('change', function(e) {
          var el = e.target;
          if (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(el.tagName) >= 0) {
            var isPassword = el.type === 'password';
            window.__aceTrainEvents.push({
              type: 'input', tag: el.tagName.toLowerCase(),
              inputType: el.type || 'text',
              name: el.name || el.id || null,
              placeholder: el.placeholder || null,
              value: isPassword ? '{{password}}' : el.value.substring(0, 200),
              isPassword: isPassword,
              selector: genSelector(el), timestamp: Date.now()
            });
          }
        }, true);

        document.addEventListener('submit', function(e) {
          window.__aceTrainEvents.push({
            type: 'form_submit', action: e.target.action, method: e.target.method,
            selector: genSelector(e.target), timestamp: Date.now()
          });
        }, true);

        document.addEventListener('keydown', function(e) {
          if (['Enter', 'Tab', 'Escape'].indexOf(e.key) >= 0) {
            window.__aceTrainEvents.push({
              type: 'keypress', key: e.key,
              target: e.target.tagName.toLowerCase(),
              timestamp: Date.now()
            });
          }
        }, true);

        var banner = document.createElement('div');
        banner.id = '__ace_training_banner';
        banner.innerHTML = '🎓 <strong>Ace is watching</strong> — Recording your actions...';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:linear-gradient(90deg,#ff6b35,#f7c948);color:#1a1a2e;font-family:-apple-system,sans-serif;padding:8px 20px;text-align:center;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
        document.body.appendChild(banner);

        return 'injected';
      })()
    `;

    const result = await this._executeJsInChrome(trackerCode);
    if (result === 'injected') {
      this.onProgress('🎯 Event tracker injected into Chrome');
    } else if (result === 'already_injected') {
      this.onProgress('🎯 Event tracker already active');
    }
  }

  /**
   * Poll Chrome for recorded events and URL changes
   */
  _startPolling() {
    this._pollInterval = setInterval(async () => {
      if (!this.isRecording) return;

      // Check for URL changes (navigation)
      const currentUrl = await this._getChromeUrl();
      if (currentUrl && currentUrl !== this._lastPageUrl && currentUrl !== 'about:blank') {
        this._lastPageUrl = currentUrl;

        if (currentUrl !== this.currentUrl) {
          this.currentUrl = currentUrl;
          const title = await this._getChromeTitle();

          await this.addStep({
            action: 'navigate',
            url: currentUrl,
            description: `Navigate to: ${title || currentUrl}`,
            timestamp: Date.now()
          });

          // Re-inject tracker after navigation
          await this._injectTracker();
        }
      }

      // Poll for recorded events
      try {
        const eventsJson = await this._executeJsInChrome(`
          (function() {
            var events = window.__aceTrainEvents || [];
            window.__aceTrainEvents = [];
            return JSON.stringify(events);
          })()
        `);

        if (eventsJson) {
          let events;
          try {
            events = typeof eventsJson === 'string' ? JSON.parse(eventsJson) : eventsJson;
          } catch (e) { events = []; }

          for (const event of events) {
            await this._recordEvent(event);
          }
        }
      } catch (e) {
        // Page might not have tracker (e.g., after navigation)
      }
    }, 1000);
  }

  async _recordEvent(eventData) {
    if (!this.isRecording) return;

    // Deduplication
    const actionKey = `${eventData.type}:${eventData.selector || eventData.key || ''}`;
    const now = Date.now();
    if (actionKey === this.lastAction && (now - this.lastActionTime) < this.minActionInterval) return;
    this.lastAction = actionKey;
    this.lastActionTime = now;

    let step = null;

    switch (eventData.type) {
      case 'click': {
        if (eventData.text && eventData.text.length > 0 && eventData.text.length < 50) {
          step = {
            action: 'click_text', text: eventData.text, selector: eventData.selector,
            description: `Click "${eventData.text}"`,
            element: { tag: eventData.tag, id: eventData.id, href: eventData.href }
          };
        } else if (eventData.selector) {
          step = {
            action: 'click', selector: eventData.selector,
            description: `Click ${eventData.tag}${eventData.id ? '#' + eventData.id : ''}`,
            element: { tag: eventData.tag, id: eventData.id }
          };
        }
        break;
      }
      case 'input': {
        const fieldName = eventData.name || eventData.placeholder || 'field';
        step = {
          action: eventData.isPassword ? 'fill_credentials' : 'type',
          selector: eventData.selector,
          text: eventData.isPassword ? undefined : eventData.value,
          credentialField: eventData.isPassword ? 'password' : undefined,
          description: eventData.isPassword ?
            `Enter password in "${fieldName}"` :
            `Type "${eventData.value?.substring(0, 30)}..." into "${fieldName}"`,
          fieldInfo: { name: eventData.name, type: eventData.inputType, placeholder: eventData.placeholder }
        };
        break;
      }
      case 'form_submit': {
        step = { action: 'click_submit', description: 'Submit form' };
        break;
      }
      case 'keypress': {
        if (eventData.key === 'Enter' && eventData.target !== 'textarea') {
          step = { action: 'press', key: 'Enter', description: 'Press Enter' };
        }
        break;
      }
    }

    if (step) await this.addStep(step);
  }

  async addStep(step) {
    step.stepNumber = this.recordedSteps.length + 1;
    step.timestamp = step.timestamp || Date.now();
    step.url = this.currentUrl;

    this.recordedSteps.push(step);

    this.onProgress(`  📝 Step ${step.stepNumber}: ${step.description}`);
    this.onStepRecorded(step);

    try {
      const screenshotPath = await this.takeTrainingScreenshot(`step_${step.stepNumber}`);
      step.screenshot = screenshotPath;
    } catch (e) {}
  }

  async takeTrainingScreenshot(name) {
    const sessionDir = path.join(this.screenshotDir, this.sessionName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    await fs.mkdir(sessionDir, { recursive: true });

    const filename = `${name}_${Date.now()}.png`;
    const filepath = path.join(sessionDir, filename);

    await this._captureScreenshot(filepath);
    return filepath;
  }

  async stopTraining(metadata = {}) {
    if (!this.isRecording && this.recordedSteps.length === 0) {
      return { success: false, error: 'No training session in progress' };
    }

    this.isRecording = false;
    const duration = Date.now() - (this.startTime || Date.now());

    // Stop polling and screenshots
    if (this._pollInterval) { clearInterval(this._pollInterval); this._pollInterval = null; }
    if (this._screenshotInterval) { clearInterval(this._screenshotInterval); this._screenshotInterval = null; }

    this.onProgress(`\n🎓 Training complete! Recorded ${this.recordedSteps.length} steps in ${(duration / 1000).toFixed(1)}s`);

    // Remove the training banner from Chrome
    await this._executeJsInChrome(`
      var banner = document.getElementById('__ace_training_banner');
      if (banner) banner.remove();
      window.__aceTrainerInjected = false;
    `);

    // Optimize steps
    const optimizedSteps = this.optimizeSteps(this.recordedSteps);

    // Generate the SOP
    const sop = {
      id: `sop_${this.sessionName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      name: metadata.name || this.sessionName,
      description: metadata.description || `Learned procedure: ${this.sessionName}`,
      category: metadata.category || 'custom',
      triggers: metadata.triggers || [this.sessionName.toLowerCase()],
      keywords: this.extractKeywords(this.sessionName),
      steps: optimizedSteps.map((step, i) => ({
        action: step.action,
        ...(step.url && step.action === 'navigate' ? { url: step.url } : {}),
        ...(step.text ? { text: step.text } : {}),
        ...(step.selector ? { selector: step.selector } : {}),
        ...(step.key ? { key: step.key } : {}),
        ...(step.credentialField ? { credentialId: metadata.credentialId || 'default' } : {}),
        ...(step.ms ? { ms: step.ms } : {}),
        description: step.description || `Step ${i + 1}`,
        critical: step.action !== 'wait'
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      runCount: 0,
      schedule: null,
      enabled: true,
      trainedFrom: 'browser_recording',
      trainingDuration: duration,
      originalStepCount: this.recordedSteps.length
    };

    if (this.sopManager) {
      await this.sopManager.createSOP(sop);
      this.onProgress(`📋 SOP saved: "${sop.name}" (${sop.steps.length} steps)`);
    }

    // Save raw recording
    try {
      const rawPath = path.join('./data/training', `${sop.id}_raw.json`);
      await fs.writeFile(rawPath, JSON.stringify({
        sessionName: this.sessionName,
        recordedAt: new Date().toISOString(),
        duration,
        rawSteps: this.recordedSteps,
        optimizedSteps,
        generatedSOP: sop
      }, null, 2));
      this.onProgress(`💾 Raw recording saved: ${rawPath}`);
    } catch (e) {}

    return {
      success: true,
      sop,
      stats: {
        rawSteps: this.recordedSteps.length,
        optimizedSteps: optimizedSteps.length,
        duration,
        sessionName: this.sessionName
      }
    };
  }

  // ═══════════════════════════════════════════════════════
  // STEP OPTIMIZATION
  // ═══════════════════════════════════════════════════════

  optimizeSteps(rawSteps) {
    const optimized = [];

    for (let i = 0; i < rawSteps.length; i++) {
      const step = rawSteps[i];
      const prevStep = optimized[optimized.length - 1];

      if (step.action === 'navigate' && prevStep?.action === 'navigate' && step.url === prevStep.url) continue;
      if (step.action === 'click' && rawSteps[i + 1]?.action === 'type' && step.selector === rawSteps[i + 1].selector) continue;
      if (step.action === 'press' && step.key === 'Enter' && prevStep?.action === 'click_submit') continue;

      if (step.action === 'fill_credentials' || step.credentialField === 'password') {
        if (prevStep?.action === 'type' && (prevStep?.fieldInfo?.type === 'email' || prevStep?.fieldInfo?.name?.match(/email|username|user/i))) {
          prevStep.action = 'fill_credentials';
          prevStep.credentialId = step.credentialId || 'default';
          prevStep.description = 'Fill login credentials';
          continue;
        }
      }

      if (step.action !== 'navigate' && step.action !== 'wait' && prevStep?.action === 'navigate') {
        optimized.push({ action: 'wait', ms: 2000, description: 'Wait for page to load' });
      }

      if (prevStep?.action === 'click_submit') {
        optimized.push({ action: 'wait_navigation', description: 'Wait for page to load after submit' });
      }

      optimized.push(step);
    }

    const lastStep = optimized[optimized.length - 1];
    if (lastStep && lastStep.action !== 'explore_page') {
      optimized.push({ action: 'explore_page', description: 'Analyze the final page state' });
    }

    return optimized;
  }

  extractKeywords(name) {
    const stopWords = ['the', 'to', 'in', 'on', 'at', 'for', 'and', 'or', 'a', 'an', 'is', 'my', 'how'];
    return name.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.includes(w))
      .slice(0, 5);
  }

  getStatus() {
    return {
      isRecording: this.isRecording,
      sessionName: this.sessionName,
      stepsRecorded: this.recordedSteps.length,
      duration: this.startTime ? Date.now() - this.startTime : 0,
      currentUrl: this.currentUrl,
      recentSteps: this.recordedSteps.slice(-5).map(s => ({
        step: s.stepNumber, action: s.action, description: s.description
      }))
    };
  }

  async getSavedSessions() {
    try {
      const files = await fs.readdir('./data/training');
      const sessions = [];
      for (const file of files) {
        if (file.endsWith('_raw.json')) {
          const data = await fs.readFile(path.join('./data/training', file), 'utf8');
          const session = JSON.parse(data);
          sessions.push({
            id: file.replace('_raw.json', ''),
            name: session.sessionName,
            recordedAt: session.recordedAt,
            duration: session.duration,
            stepCount: session.rawSteps?.length || 0,
            sopGenerated: !!session.generatedSOP
          });
        }
      }
      return sessions;
    } catch (e) {
      return [];
    }
  }

  async _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BrowserTrainer;
