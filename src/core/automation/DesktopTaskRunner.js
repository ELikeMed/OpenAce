/**
 * DesktopTaskRunner — General-purpose Mac desktop control via AI vision.
 *
 * Combines DesktopController (app management) + DesktopAgent (AI vision + mouse/keyboard)
 * into a task runner that can control ANY app on the Mac, not just Chrome.
 *
 * Flow: Parse intent → Open app → Vision loop (screenshot → Gemini → action → repeat)
 *
 * Examples:
 *   "open Contacts and find Eric"
 *   "open Notes and create a new note about tomorrow's meeting"
 *   "switch to Finder and go to Downloads"
 *   "open Calculator"
 */

import { createRequire } from 'module';
import fs from 'fs/promises';
import path from 'path';
import { eventBus, EVENTS } from '../events/EventBus.js';

const require = createRequire(import.meta.url);

// ═══════════════════════════════════════════════════════
// APP CONTEXT MAP — resolves common words to macOS apps
// ═══════════════════════════════════════════════════════
const APP_CONTEXT_MAP = {
  contacts:    { app: 'Contacts',        clarify: 'macOS Contacts app' },
  email:       { app: 'Mail',            clarify: 'macOS Mail app' },
  mail:        { app: 'Mail',            clarify: 'macOS Mail app' },
  calendar:    { app: 'Calendar',        clarify: 'macOS Calendar' },
  notes:       { app: 'Notes',           clarify: 'macOS Notes app' },
  messages:    { app: 'Messages',        clarify: 'iMessage / SMS' },
  music:       { app: 'Music',           clarify: 'Apple Music' },
  photos:      { app: 'Photos',          clarify: 'Apple Photos' },
  settings:    { app: 'System Settings', clarify: 'macOS System Settings' },
  calculator:  { app: 'Calculator',      clarify: 'Calculator app' },
  finder:      { app: 'Finder',          clarify: 'File manager' },
  safari:      { app: 'Safari',          clarify: 'Safari browser' },
  chrome:      { app: 'Google Chrome',   clarify: 'Google Chrome browser' },
  slack:       { app: 'Slack',           clarify: 'Slack messaging' },
  discord:     { app: 'Discord',         clarify: 'Discord' },
  terminal:    { app: 'Terminal',        clarify: 'Terminal' },
  reminders:   { app: 'Reminders',       clarify: 'Apple Reminders' },
  launchpad:   { app: 'Launchpad',       clarify: 'macOS Launchpad' },
  'app store': { app: 'App Store',       clarify: 'Mac App Store' },
};

export class DesktopTaskRunner {
  constructor({ desktopAgent, desktopController, aiManager, onProgress }) {
    this.desktop = desktopAgent;           // Low-level: mouse, keyboard, screen capture, findAndClick
    this.controller = desktopController;   // High-level: openApp, switchToApp, spotlight, etc.
    this.aiManager = aiManager;            // AI vision (routes to Gemini)
    this.onProgress = onProgress || ((msg) => console.log(`[DesktopTaskRunner] ${msg}`));
    this.screenshotDir = path.join(process.cwd(), 'data/automation/screenshots');
    this._screenBounds = null;
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════

  /**
   * Execute a desktop task described in natural language.
   * Parses the intent, opens the right app, and uses AI vision to complete the task.
   *
   * @param {string} taskDescription — e.g. "open Contacts and find Eric"
   * @returns {{ success, summary, app, steps, error }}
   */
  async executeTask(taskDescription, preResolved = null) {
    this.onProgress(`🖥️ Desktop task: "${taskDescription}"`);

    // Step 1: Use pre-resolved result if available, otherwise resolve now
    const resolution = preResolved || await this.resolveTask(taskDescription);
    const { appName, task, sop } = resolution;

    if (!appName) {
      return {
        success: false,
        error: `I couldn't figure out which app to open from: "${taskDescription}"`,
        summary: 'Could not determine target app',
        app: null,
        steps: 0,
      };
    }

    // ═══ TRAINED SOP REPLAY ═══
    // If a trained desktop SOP matched, replay its recorded steps directly
    if (appName === '__trained_sop__' && sop) {
      this.onProgress(`🎓 Replaying trained procedure: "${sop.name}" (${(sop.steps || []).length} steps)`);
      return await this._replayTrainedSOP(sop);
    }

    this.onProgress(`🎯 App: ${appName} | Task: ${task || '(just open)'}`);

    // Step 2: Open and maximize the app
    try {
      await this._openAndFocusApp(appName);
    } catch (e) {
      return {
        success: false,
        error: `Failed to open ${appName}: ${e.message}`,
        summary: `Could not open ${appName}`,
        app: appName,
        steps: 0,
      };
    }

    // Step 3: If there's a task beyond just opening, run the vision loop
    if (task) {
      const result = await this._visionLoop(task, appName);
      return {
        success: result.success,
        summary: result.summary,
        app: appName,
        steps: result.steps,
        error: result.error || null,
      };
    }

    // No task — just opened the app
    return {
      success: true,
      summary: `Opened ${appName}`,
      app: appName,
      steps: 0,
    };
  }

  /**
   * Replay a trained Desktop SOP step by step.
   * Each step has { action, target, x, y, text, key, modifiers }.
   * For click steps with coordinates, click directly.
   * For click steps with only a target description, use AI vision to find it.
   */
  async _replayTrainedSOP(sop) {
    const steps = sop.steps || [];
    if (steps.length === 0) {
      return { success: false, error: 'Trained procedure has no steps', summary: '', app: sop.name, steps: 0 };
    }

    // ── PRE-FLIGHT: Verify robotjs can actually control the mouse ──
    try {
      const robot = require('robotjs');
      const before = robot.getMousePos();
      const testX = before.x > 100 ? before.x - 50 : before.x + 50;
      const testY = before.y;
      robot.moveMouse(testX, testY);
      await this._wait(50);
      const after = robot.getMousePos();
      robot.moveMouse(before.x, before.y);
      const moved = Math.abs(after.x - testX) < 10;
      if (!moved) {
        console.error('[SOP Replay] CRITICAL: robotjs.moveMouse() did NOT move the mouse.');
        this.onProgress('❌ Mouse control not working.');
        this.onProgress('   Fix: Open System Settings → Privacy & Security → Accessibility');
        this.onProgress('   Add Terminal (or VS Code) to the allowed list, then restart OpenAce.');
        return {
          success: false,
          error: 'Cannot control mouse. Grant Accessibility permission to Terminal/VS Code in System Settings → Privacy & Security → Accessibility.',
          summary: 'Mouse control pre-flight check failed',
          app: sop.name,
          steps: 0
        };
      }
      this.onProgress(`✅ Mouse control verified — starting ${steps.length}-step replay of "${sop.name}"`);
    } catch (e) {
      console.error('[SOP Replay] robotjs pre-flight failed:', e.message);
      return {
        success: false,
        error: `robotjs not available: ${e.message}`,
        summary: 'robotjs pre-flight check failed',
        app: sop.name,
        steps: 0
      };
    }

    // ── SET UP STARTING STATE ──
    if (sop.startingState) {
      await this._setupStartingState(sop.startingState);
    }

    // ── PRE-FLIGHT: Test Chrome JavaScript access ──
    this._chromeJsDisabled = false;
    try {
      const { execSync } = require('child_process');
      execSync(`osascript -e 'tell application "Google Chrome" to execute front window'"'"'s active tab javascript "1+1"'`, { timeout: 3000 });
      this.onProgress('✅ Chrome DOM access enabled — smart element finding active');
    } catch (e) {
      this._chromeJsDisabled = true;
      this.onProgress('⚠️ Chrome DOM access disabled — using AI vision + coordinates instead');
      this.onProgress('   To enable: Chrome → View → Developer → Allow JavaScript from Apple Events');
    }

    // ── COORDINATE SCALING: Adjust for different screen resolutions ──
    let scaleX = 1, scaleY = 1;
    if (sop.recordingResolution) {
      try {
        const robot = require('robotjs');
        const currentRes = robot.getScreenSize();
        if (currentRes.width !== sop.recordingResolution.width || currentRes.height !== sop.recordingResolution.height) {
          scaleX = currentRes.width / sop.recordingResolution.width;
          scaleY = currentRes.height / sop.recordingResolution.height;
          this.onProgress(`📐 Resolution changed: ${sop.recordingResolution.width}x${sop.recordingResolution.height} → ${currentRes.width}x${currentRes.height} — scaling coordinates`);
        }
      } catch (e) { /* Keep scale 1:1 */ }
    }

    let completedSteps = 0;
    const retriedSteps = [];

    const MAX_RETRIES = 2; // 3 total attempts per step (initial + 2 retries)
    const executionLog = [];

    // ── SSE: Notify chat UI that SOP execution has started ──
    eventBus.emit(EVENTS.SOP_STARTED, {
      sopId: sop.id, sopName: sop.name, stepCount: steps.length,
    });

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepDesc = step.description || step.target || step.text || step.key || '';
      this.onProgress(`🎓 Step ${i + 1}/${steps.length}: ${step.action} — ${stepDesc}`);

      // ── Apply learning from past runs (extra wait for unreliable steps) ──
      await this._applyLearning(step, i + 1, sop.id);

      const isClickAction = ['click', 'doubleClick', 'click_text', 'click_submit', 'smart_click', 'right_click', 'select_option'].includes(step.action);
      let succeeded = false;
      let lastError = null;
      const stepStart = Date.now();

      // ── RETRY LOOP: up to MAX_RETRIES additional attempts ──
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        // ── SSE: Step started (only on first attempt) ──
        if (attempt === 0) {
          eventBus.emit(EVENTS.SOP_STEP_STARTED, {
            sopId: sop.id, sopName: sop.name, stepNum: i + 1,
            totalSteps: steps.length, action: step.action, description: stepDesc,
          });
        }

        try {
          await this._executeStep(step, steps, i, scaleX, scaleY);

          // ── STEP VERIFICATION: Check if the click actually worked ──
          if (isClickAction && step.url) {
            const verified = await this._verifyStep(step, steps, i);
            if (!verified && attempt < MAX_RETRIES) {
              throw new Error('Step verification failed — page did not change as expected');
            }
          }

          succeeded = true;
          completedSteps++;

          // ── Record what method worked ──
          const method = (step.x != null && step.y != null) ? 'coordinates' : (this._chromeJsDisabled ? 'ai_vision' : 'dom_search');
          await this._recordSkill(step, { method });
          executionLog.push({ step: i + 1, action: step.action, success: true, method, duration: Date.now() - stepStart });

          // ── SSE: Step completed ──
          eventBus.emit(EVENTS.SOP_STEP_COMPLETED, {
            sopId: sop.id, sopName: sop.name, stepNum: i + 1,
            totalSteps: steps.length, action: step.action,
          });

          break; // Success — move to next step

        } catch (e) {
          lastError = e;

          if (attempt < MAX_RETRIES) {
            const backoff = 1000 * Math.pow(2, attempt); // 1s, 2s
            this.onProgress(`  ⚠️ Step ${i + 1} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${e.message}`);

            // ── AI RECOVERY: try to fix the situation before retrying ──
            const recovered = await this._attemptRecovery(step, e, i + 1);
            if (recovered) {
              this.onProgress(`  🔧 Recovery action taken, retrying step...`);
            }

            await this._wait(backoff);
          }
        }
      }

      // ── Step exhausted all retries — record failure ──
      if (!succeeded) {
        this.onProgress(`❌ Step ${i + 1} failed after ${MAX_RETRIES + 1} attempts: ${lastError?.message}`);
        if (isClickAction) {
          this.onProgress(`   Strategies tried: DOM text → AI vision → coordinates.`);
        }
        executionLog.push({ step: i + 1, action: step.action, success: false, error: lastError?.message, duration: Date.now() - stepStart });

        // ── Capture failure screenshot ──
        let failScreenshot = null;
        try {
          failScreenshot = await this._captureFailureScreenshot();
        } catch (screenshotErr) { /* proceed without screenshot */ }

        // ── SSE: Step failed ──
        eventBus.emit(EVENTS.SOP_STEP_FAILED, {
          sopId: sop.id, sopName: sop.name, stepNum: i + 1,
          totalSteps: steps.length, action: step.action, description: stepDesc,
          error: lastError?.message,
          screenshot: failScreenshot,
        });

        // Continue — the next step might still work
      }

      // ── USE RECORDED DELAY (or sensible default) ──
      const nextStep = steps[i + 1];
      if (nextStep) {
        const delay = Math.max(500, nextStep.delay || 1500);
        if (delay > 2000) {
          this.onProgress(`⏳ Waiting ${(delay / 1000).toFixed(1)}s (matching your recorded timing)...`);
        }
        await this._wait(delay);
      }
    }

    // Record the run
    if (this.sopManager && sop.id) {
      try { await this.sopManager.recordRun(sop.id, completedSteps === steps.length); } catch (e) { /* ignore */ }
    }

    // ── Persist learning data from this run ──
    if (sop.id) {
      await this._updateLearning(sop.id, executionLog, completedSteps === steps.length);
    }

    // ── SUMMARY ──
    const allDone = completedSteps === steps.length;
    const retryNote = retriedSteps.length > 0 ? ` (steps ${retriedSteps.join(', ')} needed retry)` : '';
    if (allDone) {
      this.onProgress(`✅ Replay complete: ${completedSteps}/${steps.length} steps succeeded${retryNote}`);
      eventBus.emit(EVENTS.SOP_COMPLETED, {
        sopId: sop.id, sopName: sop.name,
        stepsCompleted: completedSteps, totalSteps: steps.length,
      });
    } else {
      const failed = steps.length - completedSteps;
      this.onProgress(`⚠️ Replay partial: ${completedSteps}/${steps.length} steps succeeded, ${failed} failed${retryNote}`);
      eventBus.emit(EVENTS.SOP_FAILED, {
        sopId: sop.id, sopName: sop.name,
        stepsCompleted: completedSteps, totalSteps: steps.length,
        error: `${failed} steps failed`,
      });
    }

    return {
      success: allDone,
      summary: allDone
        ? `Replayed "${sop.name}" — ${completedSteps} steps completed${retryNote}`
        : `Partially replayed "${sop.name}" — ${completedSteps}/${steps.length} steps${retryNote}`,
      app: sop.name,
      steps: completedSteps,
      error: allDone ? null : `${steps.length - completedSteps} steps failed`,
    };
  }

  /**
   * Execute a single SOP step. Extracted to allow retry on verification failure.
   */
  async _executeStep(step, steps, i, scaleX = 1, scaleY = 1) {
    switch (step.action) {
      case 'click':
      case 'doubleClick': {
        let clicked = false;
        const targetLower = (step.target || '').toLowerCase();
        const isDouble = step.action === 'doubleClick';

        // ── SMART CHROME UI: keyboard shortcuts ──
        if (/\b(tab bar|new tab)\b/i.test(targetLower)) {
          const robot = require('robotjs');
          robot.keyTap('t', ['command']);
          this.onProgress('⌨️ Cmd+T (new tab)');
          clicked = true;
          await this._wait(500);
        } else if (/\b(address bar|url bar|url input|chrome address|location bar)\b/i.test(targetLower)) {
          const robot = require('robotjs');
          robot.keyTap('l', ['command']);
          this.onProgress('⌨️ Cmd+L (focus address bar)');
          clicked = true;
          await this._wait(500);
        }

        // ── Strategy 0: CSS selector (from DOM metadata during recording) ──
        if (!clicked && step.selector) {
          clicked = await this._clickBySelector(step.selector, isDouble);
          if (clicked) {
            this.onProgress(`🎯 Clicked via CSS selector: "${step.selector}"${isDouble ? ' (double-click)' : ''}`);
          }
        }

        // ── Strategy 1: DOM text search ──
        if (!clicked && step.target) {
          clicked = await this._clickWebElement(step.target, isDouble);
          if (clicked) {
            this.onProgress(`🌐 Clicked via DOM text search: "${step.target}"${isDouble ? ' (double-click)' : ''}`);
          }
        }

        // ── Strategy 2: AI vision ──
        if (!clicked && step.target && this.desktop) {
          try {
            this.onProgress(`🔍 Trying AI vision for "${step.target}"...`);
            const result = await this.desktop.findAndClick(step.target);
            if (result?.success === true) {
              clicked = true;
              if (isDouble) {
                // AI vision did single click; add a second click for double
                const robot = require('robotjs');
                await this._wait(50);
                robot.mouseClick();
              }
              this.onProgress(`🎯 Clicked via AI vision: "${step.target}" at (${result.x}, ${result.y})`);
            }
          } catch (visionErr) {
            this.onProgress(`⚠️ AI vision error: ${visionErr.message}`);
          }
        }

        // ── Strategy 3: Scaled recorded coordinates (last resort) ──
        if (!clicked && step.x != null && step.y != null) {
          const robot = require('robotjs');
          const clickX = Math.round(step.x * scaleX);
          const clickY = Math.round(step.y * scaleY);
          const scaled = scaleX !== 1 || scaleY !== 1;
          this.onProgress(`📌 Coordinates: (${clickX}, ${clickY})${scaled ? ' (scaled from recording)' : ''}`);
          robot.moveMouse(clickX, clickY);
          await this._wait(100);
          if (isDouble) {
            robot.mouseClick('left', true); // double-click
          } else {
            robot.mouseClick();
          }
          clicked = true;
        }

        if (!clicked) {
          throw new Error(`Could not click: "${step.target}" — all strategies failed`);
        }
        break;
      }

      case 'navigate': {
        const url = step.target || step.url || step.value;
        if (url) {
          this.onProgress(`🌐 Navigating to: ${url}`);
          try {
            const { execSync } = require('child_process');
            // Use set URL for direct navigation (more reliable than open location)
            const safeUrl = url.replace(/"/g, '\\"');
            const script = `tell application "Google Chrome"
              activate
              if (count of windows) = 0 then make new window
              set URL of active tab of front window to "${safeUrl}"
            end tell`;
            execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 });
            await this._wait(3000);
            this.onProgress(`✅ Opened: ${url}`);
          } catch (navErr) {
            this.onProgress(`⚠️ Navigate failed, trying open command...`);
            const { execSync } = require('child_process');
            execSync(`open -a "Google Chrome" "${url}"`, { timeout: 5000 });
            await this._wait(3000);
          }
        }
        break;
      }

      // ── SEMANTIC CLICK ACTIONS (from classified Desktop SOPs + Playbooks) ──

      case 'click_text': {
        // Click an element by its visible text content
        const text = step.text || step.target || '';
        let clicked = false;

        // Strategy 0: CSS selector (from recording DOM metadata)
        if (!clicked && step.selector) {
          clicked = await this._clickBySelector(step.selector);
          if (clicked) this.onProgress(`🎯 Clicked via CSS selector: "${step.selector}"`);
        }

        // Strategy 1: DOM text search
        if (!clicked && text) {
          clicked = await this._clickWebElement(text);
          if (clicked) this.onProgress(`🌐 Clicked via DOM text: "${text}"`);
        }

        // Strategy 2: AI vision
        if (!clicked && text && this.desktop) {
          try {
            const result = await this.desktop.findAndClick(text);
            clicked = result?.success === true;
            if (clicked) this.onProgress(`🎯 Clicked via AI vision: "${text}"`);
          } catch (e) { /* fall through */ }
        }

        // Strategy 3: Coordinates fallback
        if (!clicked && step.x != null && step.y != null) {
          const robot = require('robotjs');
          const clickX = Math.round(step.x * scaleX);
          const clickY = Math.round(step.y * scaleY);
          this.onProgress(`📌 Coordinates fallback: (${clickX}, ${clickY})`);
          robot.moveMouse(clickX, clickY);
          await this._wait(100);
          robot.mouseClick();
          clicked = true;
        }

        if (!clicked) throw new Error(`Could not find "${text}" — all strategies failed`);
        break;
      }

      case 'click_submit': {
        // Click a submit/sign-in/save button
        let clicked = false;

        // Strategy 0: CSS selector (from recording DOM metadata)
        if (!clicked && step.selector) {
          clicked = await this._clickBySelector(step.selector);
          if (clicked) this.onProgress(`🎯 Submitted via CSS selector: "${step.selector}"`);
        }

        // Strategy 1: DOM search for submit-type buttons
        if (!this._chromeJsDisabled) {
          try {
            const { execSync } = require('child_process');
            const fsSyncMod = require('fs');
            const os = require('os');
            const jsCode = `(function() {
              var sels = ['button[type="submit"]', 'input[type="submit"]', 'button.submit',
                'button.btn-primary', 'button.login-btn', 'form button:last-of-type',
                '[type="submit"]', 'button.btn-submit'];
              for (var s = 0; s < sels.length; s++) {
                var btns = document.querySelectorAll(sels[s]);
                for (var b = 0; b < btns.length; b++) {
                  var btn = btns[b];
                  if (btn.offsetParent || btn.tagName === 'BODY') {
                    btn.scrollIntoView({block: 'center'});
                    btn.click();
                    return 'clicked:' + (btn.textContent || '').trim().substring(0, 80);
                  }
                }
              }
              return 'not_found';
            })()`;
            const tmpFile = path.join(os.tmpdir(), `ace_submit_${Date.now()}.scpt`);
            const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;
            fsSyncMod.writeFileSync(tmpFile, appleScript);
            const result = execSync(`osascript "${tmpFile}"`, { timeout: 8000 }).toString().trim();
            try { fsSyncMod.unlinkSync(tmpFile); } catch (e) { /* cleanup */ }
            if (result.startsWith('clicked:')) {
              this.onProgress(`🌐 Clicked submit button: "${result.substring(8)}"`);
              clicked = true;
            }
          } catch (e) { /* fall through */ }
        }

        // Strategy 2: DOM text search by label
        if (!clicked && (step.text || step.target)) {
          clicked = await this._clickWebElement(step.text || step.target);
          if (clicked) this.onProgress(`🌐 Clicked via text: "${step.text || step.target}"`);
        }

        // Strategy 3: Coordinates fallback
        if (!clicked && step.x != null && step.y != null) {
          const robot = require('robotjs');
          const clickX = Math.round(step.x * scaleX);
          const clickY = Math.round(step.y * scaleY);
          this.onProgress(`📌 Submit coordinates fallback: (${clickX}, ${clickY})`);
          robot.moveMouse(clickX, clickY);
          await this._wait(100);
          robot.mouseClick();
          clicked = true;
        }

        // Strategy 4: Press Enter as last resort
        if (!clicked) {
          const robot = require('robotjs');
          robot.keyTap('enter');
          this.onProgress('⌨️ Pressed Enter (submit fallback)');
        }
        break;
      }

      case 'edit_field': {
        // Click a field, then type text into it
        const target = step.target || '';
        const text = step.text || step.value || '';
        let fieldClicked = false;

        // Try DOM text search for the field
        if (target) {
          fieldClicked = await this._clickWebElement(target);
          if (fieldClicked) this.onProgress(`🖱️ Clicked field: "${target}"`);
        }

        // Fallback to coordinates
        if (!fieldClicked && step.x != null && step.y != null) {
          const robot = require('robotjs');
          const clickX = Math.round(step.x * scaleX);
          const clickY = Math.round(step.y * scaleY);
          robot.moveMouse(clickX, clickY);
          await this._wait(100);
          robot.mouseClick();
          fieldClicked = true;
          this.onProgress(`📌 Clicked field at (${clickX}, ${clickY})`);
        }

        if (fieldClicked && text) {
          await this._wait(300);
          // Select all existing text first, then paste new text
          const robot = require('robotjs');
          robot.keyTap('a', ['command']); // Select all
          await this._wait(100);
          await this._pasteText(text);
          this.onProgress(`📝 Typed: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`);
        }
        break;
      }

      case 'smart_click': {
        // No text label — use AI vision to find the target, coordinates as fallback
        let clicked = false;
        const target = step.target || '';

        if (target && this.desktop) {
          try {
            const result = await this.desktop.findAndClick(target);
            clicked = result?.success === true;
            if (clicked) this.onProgress(`🎯 AI vision found: "${target}" at (${result.x}, ${result.y})`);
          } catch (e) {
            this.onProgress(`⚠️ AI vision error: ${e.message}`);
          }
        }

        if (!clicked && step.x != null && step.y != null) {
          const robot = require('robotjs');
          const clickX = Math.round(step.x * scaleX);
          const clickY = Math.round(step.y * scaleY);
          this.onProgress(`📌 Coordinates: (${clickX}, ${clickY})`);
          robot.moveMouse(clickX, clickY);
          await this._wait(100);
          robot.mouseClick();
          clicked = true;
        }

        if (!clicked) throw new Error(`Could not click: "${target}" — all strategies failed`);
        break;
      }

      case 'press': {
        // Press a keyboard key (semantic alias for 'key')
        const robot = require('robotjs');
        const keyMap = { return: 'enter', option: 'alt', enter: 'enter' };
        const key = keyMap[step.key] || step.key;
        const mods = (step.modifiers || []).map(m => keyMap[m] || m);
        if (mods.length > 0) {
          robot.keyTap(key, mods);
        } else {
          robot.keyTap(key);
        }
        this.onProgress(`⌨️ Pressed ${mods.length ? mods.join('+') + '+' : ''}${key}`);
        await this._wait(300);
        break;
      }

      case 'wait_navigation': {
        // Wait for page navigation to complete
        this.onProgress('⏳ Waiting for page to load...');
        await this._wait(step.ms || 3000);
        break;
      }

      case 'type': {
        const textToType = step.text || step.value;
        if (textToType) {
          if (step.target && !step.x) {
            const clickedField = await this._clickWebElement(step.target);
            if (clickedField) {
              this.onProgress(`🖱️ Clicked field: "${step.target}"`);
              await this._wait(300);
            }
          }
          await this._pasteText(textToType);
        }
        await this._wait(300);
        break;
      }

      case 'key': {
        const robot = require('robotjs');
        const keyMap = { return: 'enter', option: 'alt' };
        const key = keyMap[step.key] || step.key;
        const mods = (step.modifiers || []).map(m => keyMap[m] || m);
        if (mods.length > 0) {
          robot.keyTap(key, mods);
        } else {
          robot.keyTap(key);
        }

        // After Return: if previous step typed a URL, wait for page load
        if (step.key === 'return') {
          const prevStep = i > 0 ? steps[i - 1] : null;
          const typedUrl = prevStep && prevStep.action === 'type' &&
            /\.(com|org|net|io|co|dev|ai|app|pro|gov|edu|me)\b/i.test(prevStep.text || '');
          if (typedUrl) {
            const loadDelay = Math.max(4000, step.delay || 4000);
            this.onProgress(`⏳ Waiting ${(loadDelay / 1000).toFixed(1)}s for page to load...`);
            await this._wait(loadDelay);
          } else {
            await this._wait(step.delay || 500);
          }
        } else {
          await this._wait(300);
        }
        break;
      }

      case 'scroll': {
        const robot = require('robotjs');
        const multiplier = step._scrollMultiplier || 1;
        const amount = (step.direction === 'up' ? 5 : -5) * multiplier;
        robot.scrollMouse(0, amount);
        if (multiplier > 1) {
          this.onProgress(`🔄 Scrolled ${step.direction} (${multiplier}x combined)`);
        }
        await this._wait(500);
        break;
      }

      case 'right_click': {
        // Right-click on an element (for context menus)
        let clicked = false;
        const target = step.target || step.text || '';

        // Strategy 1: DOM text search → move mouse to element, then right-click
        if (target && !this._chromeJsDisabled) {
          try {
            const { execSync } = require('child_process');
            const fsSyncMod = require('fs');
            const os = require('os');
            const searchText = this._extractSearchText(target);
            if (searchText) {
              const jsCode = `(function() {
                var target = ${JSON.stringify(searchText.toLowerCase())};
                var all = document.querySelectorAll('a, button, span, div, td, li, p, img, [role]');
                for (var i = 0; i < all.length; i++) {
                  var el = all[i];
                  var text = (el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
                  if (text.includes(target) && el.offsetParent) {
                    el.scrollIntoView({block: 'center'});
                    var r = el.getBoundingClientRect();
                    return 'found:' + Math.round(r.left + r.width/2) + ',' + Math.round(r.top + r.height/2);
                  }
                }
                return 'not_found';
              })()`;
              const tmpFile = path.join(os.tmpdir(), `ace_rclick_${Date.now()}.scpt`);
              const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;
              fsSyncMod.writeFileSync(tmpFile, appleScript);
              const result = execSync(`osascript "${tmpFile}"`, { timeout: 8000 }).toString().trim();
              try { fsSyncMod.unlinkSync(tmpFile); } catch (e) { /* cleanup */ }
              if (result.startsWith('found:')) {
                const [fx, fy] = result.substring(6).split(',').map(Number);
                const robot = require('robotjs');
                robot.moveMouse(fx, fy);
                await this._wait(100);
                robot.mouseClick('right');
                clicked = true;
                this.onProgress(`🖱️ Right-clicked via DOM: "${target}" at (${fx}, ${fy})`);
              }
            }
          } catch (e) { /* fall through */ }
        }

        // Strategy 2: AI vision
        if (!clicked && target && this.desktop) {
          try {
            const result = await this.desktop.findAndClick(target);
            if (result?.success) {
              const robot = require('robotjs');
              robot.mouseClick('right');
              clicked = true;
              this.onProgress(`🎯 Right-clicked via AI vision: "${target}"`);
            }
          } catch (e) { /* fall through */ }
        }

        // Strategy 3: Coordinates fallback
        if (!clicked && step.x != null && step.y != null) {
          const robot = require('robotjs');
          const clickX = Math.round(step.x * scaleX);
          const clickY = Math.round(step.y * scaleY);
          robot.moveMouse(clickX, clickY);
          await this._wait(100);
          robot.mouseClick('right');
          clicked = true;
          this.onProgress(`📌 Right-clicked at (${clickX}, ${clickY})`);
        }

        if (!clicked) throw new Error(`Could not right-click: "${target}" — all strategies failed`);
        break;
      }

      case 'select_option': {
        // Click a dropdown/select, then click an option within it
        const target = step.target || '';
        const optionText = step.text || step.value || '';
        let opened = false;

        // Step A: Click the dropdown to open it
        if (target) {
          opened = await this._clickWebElement(target);
          if (opened) this.onProgress(`🖱️ Opened dropdown: "${target}"`);
        }
        if (!opened && step.x != null && step.y != null) {
          const robot = require('robotjs');
          robot.moveMouse(Math.round(step.x * scaleX), Math.round(step.y * scaleY));
          await this._wait(100);
          robot.mouseClick();
          opened = true;
          this.onProgress(`📌 Clicked dropdown at (${step.x}, ${step.y})`);
        }

        // Step B: Wait for dropdown to appear, then click the option
        if (opened && optionText) {
          await this._wait(500);
          const optionClicked = await this._clickWebElement(optionText);
          if (optionClicked) {
            this.onProgress(`✅ Selected option: "${optionText}"`);
          } else {
            this.onProgress(`⚠️ Could not find option: "${optionText}"`);
          }
        }
        break;
      }

      case 'hover': {
        // Move mouse over an element without clicking (for hover menus/tooltips)
        let hovered = false;
        const target = step.target || step.text || '';

        // Strategy 1: DOM search → get coordinates → move mouse
        if (target && !this._chromeJsDisabled) {
          try {
            const { execSync } = require('child_process');
            const fsSyncMod = require('fs');
            const os = require('os');
            const searchText = this._extractSearchText(target);
            if (searchText) {
              const jsCode = `(function() {
                var target = ${JSON.stringify(searchText.toLowerCase())};
                var all = document.querySelectorAll('a, button, span, div, td, li, p, img, [role], nav *');
                for (var i = 0; i < all.length; i++) {
                  var el = all[i];
                  var text = (el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
                  if (text.includes(target) && el.offsetParent) {
                    el.scrollIntoView({block: 'center'});
                    el.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                    el.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                    var r = el.getBoundingClientRect();
                    return 'found:' + Math.round(r.left + r.width/2) + ',' + Math.round(r.top + r.height/2);
                  }
                }
                return 'not_found';
              })()`;
              const tmpFile = path.join(os.tmpdir(), `ace_hover_${Date.now()}.scpt`);
              const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;
              fsSyncMod.writeFileSync(tmpFile, appleScript);
              const result = execSync(`osascript "${tmpFile}"`, { timeout: 8000 }).toString().trim();
              try { fsSyncMod.unlinkSync(tmpFile); } catch (e) { /* cleanup */ }
              if (result.startsWith('found:')) {
                const [fx, fy] = result.substring(6).split(',').map(Number);
                const robot = require('robotjs');
                robot.moveMouse(fx, fy);
                hovered = true;
                this.onProgress(`🖱️ Hovering over: "${target}" at (${fx}, ${fy})`);
              }
            }
          } catch (e) { /* fall through */ }
        }

        // Strategy 2: Coordinates fallback
        if (!hovered && step.x != null && step.y != null) {
          const robot = require('robotjs');
          robot.moveMouse(Math.round(step.x * scaleX), Math.round(step.y * scaleY));
          hovered = true;
          this.onProgress(`📌 Hovering at (${step.x}, ${step.y})`);
        }

        await this._wait(800); // Give time for hover effect to appear
        break;
      }

      case 'switch_tab': {
        // Switch to a different Chrome tab
        const robot = require('robotjs');
        const target = (step.target || step.text || '').toLowerCase();

        if (/\d+/.test(target)) {
          // Switch to tab by number (Cmd+1 through Cmd+9)
          const tabNum = parseInt(target.match(/\d+/)[0]);
          if (tabNum >= 1 && tabNum <= 9) {
            robot.keyTap(String(tabNum), ['command']);
            this.onProgress(`⌨️ Switched to tab ${tabNum}`);
          }
        } else if (/next|right|forward/i.test(target)) {
          robot.keyTap(']', ['command', 'shift']);
          this.onProgress('⌨️ Switched to next tab');
        } else if (/prev|previous|left|back/i.test(target)) {
          robot.keyTap('[', ['command', 'shift']);
          this.onProgress('⌨️ Switched to previous tab');
        } else {
          // Default: next tab
          robot.keyTap(']', ['command', 'shift']);
          this.onProgress('⌨️ Switched to next tab');
        }
        await this._wait(500);
        break;
      }

      case 'go_back':
      case 'goBack': {
        const robot = require('robotjs');
        robot.keyTap('[', ['command']);
        await this._wait(2000);
        this.onProgress('⬅️ Navigated back to previous page');
        break;
      }

      case 'copy_text': {
        // Copy text from the page — either selected text or text of a specific element
        const target = step.target || step.text || '';

        if (target && !this._chromeJsDisabled) {
          // Try to select the element's text first, then copy
          try {
            const { execSync } = require('child_process');
            const fsSyncMod = require('fs');
            const os = require('os');
            const searchText = this._extractSearchText(target);
            if (searchText) {
              const jsCode = `(function() {
                var target = ${JSON.stringify(searchText.toLowerCase())};
                var terms = target.split(/\\s+/).filter(function(w) { return w.length > 1; });

                function textMatch(text) {
                  var lower = text.toLowerCase().trim();
                  if (lower.includes(target)) return 3;
                  var hits = 0;
                  for (var i = 0; i < terms.length; i++) {
                    if (lower.includes(terms[i])) hits++;
                  }
                  return (terms.length > 0 && hits >= Math.ceil(terms.length * 0.6)) ? 2 : 0;
                }

                // Strategy 1: Find the best matching content element (prefer smaller/more specific)
                var best = null, bestScore = 0, bestLen = Infinity;
                var candidates = document.querySelectorAll('p, pre, code, blockquote, article, [class*="message"], [class*="answer"], [class*="response"], [class*="content"], [class*="text"], td, li, div');
                for (var i = 0; i < candidates.length; i++) {
                  var el = candidates[i];
                  var text = el.textContent.trim();
                  if (text.length < 5 || !el.offsetParent) continue;
                  var score = textMatch(text);
                  // Prefer higher score; on tie, prefer smaller elements (more specific match)
                  if (score > bestScore || (score === bestScore && score > 0 && text.length < bestLen)) {
                    best = el; bestScore = score; bestLen = text.length;
                  }
                }

                // Strategy 2: If no match by text, try aria-label and title attrs
                if (!best) {
                  var all = document.querySelectorAll('*');
                  for (var i = 0; i < all.length; i++) {
                    var el = all[i];
                    var ariaLabel = el.getAttribute('aria-label') || '';
                    var title = el.getAttribute('title') || '';
                    var score = Math.max(textMatch(ariaLabel), textMatch(title));
                    if (score > bestScore && el.offsetParent) { best = el; bestScore = score; }
                  }
                }

                if (best) {
                  var range = document.createRange();
                  range.selectNodeContents(best);
                  var sel = window.getSelection();
                  sel.removeAllRanges();
                  sel.addRange(range);
                  return 'selected:' + best.textContent.trim().substring(0, 200);
                }
                return 'not_found';
              })()`;
              const tmpFile = path.join(os.tmpdir(), `ace_copy_${Date.now()}.scpt`);
              const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;
              fsSyncMod.writeFileSync(tmpFile, appleScript);
              const result = execSync(`osascript "${tmpFile}"`, { timeout: 8000 }).toString().trim();
              try { fsSyncMod.unlinkSync(tmpFile); } catch (e) { /* cleanup */ }
              if (result.startsWith('selected:')) {
                this.onProgress(`📋 Selected text: "${result.substring(9, 60)}..."`);
              }
            }
          } catch (e) { /* fall through */ }
        }

        // Copy whatever is selected
        const robot = require('robotjs');
        robot.keyTap('c', ['command']);
        await this._wait(300);
        this.onProgress(`📋 Copied to clipboard`);
        break;
      }

      case 'wait': {
        await this._wait(step.ms || 1000);
        break;
      }

      default:
        this.onProgress(`⚠️ Unknown step action: ${step.action}`);
    }
  }

  /**
   * Verify a click step actually worked by checking Chrome's URL.
   * Returns true if verified (or if verification is not possible).
   */
  async _verifyStep(step, steps, i) {
    // Only verify if we have URL data and the URL should have changed
    if (!step.url) return true; // No URL recorded — can't verify, assume OK

    // Check if next step expects a different URL (meaning navigation should have occurred)
    const nextStep = steps[i + 1];
    if (!nextStep || !nextStep.url || nextStep.url === step.url) {
      return true; // Same URL expected — no navigation to verify
    }

    // Wait for potential navigation
    await this._wait(1000);

    // Check current Chrome URL
    try {
      const { execSync } = require('child_process');
      const currentUrl = execSync(
        `osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'`,
        { timeout: 3000 }
      ).toString().trim();

      // URL changed — the click likely worked
      if (currentUrl !== step.url) {
        return true;
      }

      // URL didn't change but should have — click may have missed
      return false;
    } catch (e) {
      return true; // Can't check — assume OK
    }
  }

  // ═══════════════════════════════════════════════════════
  // TASK RESOLUTION — should desktop handle this?
  // ═══════════════════════════════════════════════════════

  /**
   * Determine if this message is a desktop task and which app to use.
   * Priority order:
   *   1. Trained Desktop SOPs — user showed Ace how to do this before
   *   2. Pattern matching — user explicitly said "open [app]"
   *   3. AI fallback — ask AI if a desktop app is needed (no hardcoded rules)
   * Returns { appName, task, sop? } or { appName: null } if not a desktop task.
   */
  async resolveTask(message) {
    const lower = message.toLowerCase();
    // Strip punctuation for word matching (so "admin?" matches "admin")
    const cleanLower = lower.replace(/[?.!,;:'"()\[\]{}]/g, '');

    // ── FAST EXIT: Conversational messages are NOT desktop tasks ──
    if (/^(what|who|why|when|where|how much|how many|can you tell|explain|describe)\b/i.test(message.trim())) {
      return { appName: null, task: null };
    }

    // ── FAST EXIT: Short generic phrases (interactive card responses) ──
    // "Log in manually", "Share credentials", "Skip login" etc. are NOT tasks
    const wordCount = message.trim().split(/\s+/).length;
    if (wordCount <= 4 && !/\b(?:open|launch|start|run)\b/i.test(message)) {
      // Short message without an action verb → probably a button click, not a real task
      const hasAppKeyword = Object.keys(APP_CONTEXT_MAP).some(k => cleanLower.includes(k));
      if (!hasAppKeyword) {
        return { appName: null, task: null };
      }
    }

    // ═══ 1. TRAINED SOPs — ALWAYS check first, even if message has a URL ═══
    // User trained Ace to do this → replay it, period.
    if (this.sopManager) {
      try {
        const allSOPs = this.sopManager.getAllSOPs ? this.sopManager.getAllSOPs() : [];
        const desktopSOPs = allSOPs.filter(s => s.type === 'desktop' && s.enabled !== false);
        const STOP_WORDS = new Set(['the','a','an','and','or','to','in','on','at','for','of','with','my','is','it','how','can','you','look','up','search','find','get','go','do','use','please','help','me','this','that','into','as','be','been','just','also']);

        for (const sop of desktopSOPs) {
          // Strip punctuation from SOP name too
          const sopClean = sop.name.toLowerCase().replace(/[?.!,;:'"()\[\]{}]/g, '');
          const sopWords = sopClean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
          const msgWords = cleanLower.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
          const overlap = sopWords.filter(w => msgWords.includes(w)).length;
          const ratio = sopWords.length > 0 ? overlap / sopWords.length : 0;

          // Need at least 50% of SOP's meaningful words to match, minimum 2
          if (ratio >= 0.5 && overlap >= 2) {
            this.onProgress(`🎓 Found trained procedure: "${sop.name}" (${overlap}/${sopWords.length} keywords, ${(ratio * 100).toFixed(0)}% match)`);
            // For trained SOPs, we replay the recorded steps — no app name needed
            return { appName: '__trained_sop__', task: message, sop };
          }
        }
      } catch (e) {
        this.onProgress(`⚠️ SOP check failed: ${e.message}`);
      }
    }

    // ── FAST EXIT: Web/URL tasks (only AFTER checking trained SOPs) ──
    // If the message mentions a website/URL but no trained SOP matched → let BrowserDepartment handle it
    if (/https?:\/\/|\.com\b|\.org\b|\.net\b|\.io\b|\.ai\b|\.dev\b|\.co\b|\.app\b/i.test(message)) {
      this.onProgress(`🌐 URL/domain detected, no trained SOP — letting browser handle it`);
      return { appName: null, task: null };
    }

    // 2. Fast path: user explicitly named an app ("open calendar", "launch finder")
    const patternResult = this._resolveApp(message);
    if (patternResult.appName) {
      return patternResult;
    }

    // 3. AI path: ask the AI which app to use (no hardcoded rules)
    if (this.aiManager) {
      return await this._aiResolveApp(message);
    }

    return { appName: null, task: null };
  }

  // ═══════════════════════════════════════════════════════
  // AI VISION LOOP — the core of desktop control
  // ═══════════════════════════════════════════════════════

  /**
   * Vision loop: screenshot → AI decides next action → execute → repeat.
   * Works on any app — not Chrome-specific.
   */
  async _visionLoop(task, appName, maxSteps = 12) {
    const history = [];
    let lastSummary = '';

    for (let step = 0; step < maxSteps; step++) {
      // Capture what's on screen
      const screenshot = await this._captureScreen();
      if (!screenshot) {
        return { success: false, error: 'Screen capture failed', steps: step, summary: '' };
      }

      // Ask AI what to do next
      const action = await this._decideNextAction(task, appName, screenshot, step, history);

      if (!action) {
        this.onProgress(`⚠️ Step ${step + 1}: AI returned no action — stopping`);
        break;
      }

      this.onProgress(`🤖 Step ${step + 1}: ${action.action} — ${action.target || action.text || action.summary || action.reason || ''}`);

      // Check for completion
      if (action.action === 'done') {
        lastSummary = action.summary || 'Task completed';
        this.onProgress(`✅ Task done: ${lastSummary}`);
        return { success: true, summary: lastSummary, steps: step + 1 };
      }

      if (action.action === 'failed') {
        this.onProgress(`❌ Task failed: ${action.reason}`);
        return { success: false, error: action.reason, steps: step + 1, summary: `Failed: ${action.reason}` };
      }

      // Execute the action
      await this._executeAction(action);
      history.push(`Step ${step + 1}: ${action.action} — ${action.target || action.text || ''}`);

      // Brief wait for the app to respond
      await this._wait(800);
    }

    // Ran out of steps
    return {
      success: true,
      summary: lastSummary || `Completed ${history.length} actions in ${appName}`,
      steps: history.length,
    };
  }

  /**
   * Ask Gemini what to do next, given the current screenshot and task context.
   */
  async _decideNextAction(task, appName, base64Screenshot, stepNum, history) {
    const historyText = history.length > 0
      ? `Previous actions:\n${history.join('\n')}`
      : 'No actions taken yet — this is the first step.';

    const prompt = `You are an AI assistant controlling a Mac computer to complete a task.
You can see a screenshot of the screen below.

APP: ${appName}
TASK: "${task}"
STEP: ${stepNum + 1} of 12
${historyText}

Look at this screenshot of ${appName}. What is the SINGLE next action to take toward completing the task?

Available actions (reply with ONLY one JSON object):

To click on something visible on screen:
{"action": "click", "target": "describe exactly what to click — e.g. 'the Search field at top right', 'the contact named Eric Garcia'"}

To type text (into whatever field is currently focused):
{"action": "type", "text": "the text to type"}

To press a key or keyboard shortcut:
{"action": "key", "key": "return", "modifiers": ["command"]}
Common keys: return, tab, escape, space, delete, up, down, left, right
Common modifiers: command, shift, alt, control

To scroll the window:
{"action": "scroll", "direction": "down"}

When the task is COMPLETE:
{"action": "done", "summary": "describe what was accomplished"}

If the task CANNOT be done (wrong app, missing data, etc.):
{"action": "failed", "reason": "explain why"}

IMPORTANT:
- Return ONLY the JSON object, nothing else
- Take ONE action at a time — you'll see the result in the next step
- Be precise about click targets — describe position AND appearance
- If you need to search, click the search field FIRST, then type in the next step`;

    try {
      const response = await this.aiManager.chatWithVision(
        prompt,
        `data:image/png;base64,${base64Screenshot}`
      );
      const content = response.content || response.text || '';

      // Extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // Fallback: interpret text response
      const lower = content.toLowerCase();
      if (lower.includes('done') || lower.includes('complete')) {
        return { action: 'done', summary: content.substring(0, 200) };
      }
      if (lower.includes('cannot') || lower.includes('failed') || lower.includes('unable')) {
        return { action: 'failed', reason: content.substring(0, 200) };
      }

      this.onProgress(`⚠️ Could not parse AI response: "${content.substring(0, 150)}"`);
      return null;
    } catch (e) {
      this.onProgress(`⚠️ Vision call failed: ${e.message}`);
      return null;
    }
  }

  /**
   * Execute a single action from the AI.
   */
  async _executeAction(action) {
    switch (action.action) {
      case 'click':
        if (action.target) {
          await this.desktop.findAndClick(action.target);
          await this._wait(500);
        }
        break;

      case 'type':
        if (action.text) {
          // Use clipboard paste for reliability (avoids typing issues with special chars)
          await this._pasteText(action.text);
        }
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
        await this._wait(300);
        break;
      }

      case 'scroll': {
        const robot = require('robotjs');
        const amount = action.direction === 'up' ? 5 : -5;
        robot.scrollMouse(0, amount);
        await this._wait(500);
        break;
      }

      default:
        this.onProgress(`⚠️ Unknown action: ${action.action}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  // APP RESOLUTION — figure out which app from natural language
  // ═══════════════════════════════════════════════════════

  /**
   * Parse a task description to determine which app to open and what to do in it.
   * "open Contacts and find Eric" → { appName: 'Contacts', task: 'find Eric' }
   * "launch Calculator" → { appName: 'Calculator', task: null }
   * "switch to Finder" → { appName: 'Finder', task: null }
   */
  _resolveApp(taskDescription) {
    const msg = taskDescription.trim();

    // Pattern: "open/launch/start/use/switch to [app] and [task]"
    const withTaskMatch = msg.match(
      /\b(?:open|launch|start|run|use|switch to|go to|activate|focus)\s+(.+?)\s+(?:and|then|to)\s+(.+)/i
    );
    if (withTaskMatch) {
      const appName = this._normalizeApp(withTaskMatch[1].trim());
      const task = withTaskMatch[2].trim();
      if (appName) return { appName, task };
    }

    // Pattern: "open/launch/start/use/switch to [app]"
    const simpleMatch = msg.match(
      /\b(?:open|launch|start|run|use|switch to|go to|activate|focus)\s+(.+)/i
    );
    if (simpleMatch) {
      const raw = simpleMatch[1].trim();
      // Strip trailing punctuation/instructions
      const cleaned = raw.replace(/\s*(?:please|for me|right now|asap)[\s.]*/gi, '').trim();
      const appName = this._normalizeApp(cleaned);
      if (appName) return { appName, task: null };
    }

    // Fallback: check if the entire message is just an app name
    const directApp = this._normalizeApp(msg);
    if (directApp) return { appName: directApp, task: null };

    return { appName: null, task: null };
  }

  /**
   * Normalize an app name string to the actual macOS app name.
   * Checks APP_CONTEXT_MAP first, then DesktopController aliases.
   */
  _normalizeApp(input) {
    if (!input) return null;
    const lower = input.toLowerCase().trim();

    // Check our context map — exact match first
    if (APP_CONTEXT_MAP[lower]) {
      return APP_CONTEXT_MAP[lower].app;
    }

    // Check if any context map key appears WITHIN the input
    // e.g. "the calendar on my desktop" → finds "calendar" → "Calendar"
    for (const [key, value] of Object.entries(APP_CONTEXT_MAP)) {
      if (lower.includes(key)) {
        return value.app;
      }
    }

    // Check DesktopController's alias map (if available)
    if (this.controller?._normalizeAppName) {
      const normalized = this.controller._normalizeAppName(lower);
      if (normalized !== lower) return normalized; // it was recognized
    }

    // If it starts with a capital letter, assume it's an app name as-is
    if (/^[A-Z]/.test(input)) return input;

    // Don't blindly capitalize random phrases as app names
    // Only return if the input looks like a single app name (1-3 words, no filler)
    const words = input.split(/\s+/);
    if (words.length <= 3 && !/\b(my|the|on|in|at|to|for|from|with)\b/i.test(input)) {
      return input.charAt(0).toUpperCase() + input.slice(1);
    }

    // Too many words or contains filler — not an app name
    return null;
  }

  /**
   * Ask the AI which macOS app to open for a given task.
   * Returns { appName, task } or { appName: null } if no app needed.
   */
  async _aiResolveApp(message) {
    const prompt = `The user said: "${message}"

Does this require opening a macOS desktop application to complete?

Return ONLY a JSON object:
- If a desktop app is needed: {"app": "AppName", "task": "what to do in the app"}
- If not a desktop task: {"app": null}

If unsure, return {"app": null} — it's better to skip than guess wrong.`;

    try {
      const response = await this.aiManager.chat([{ role: 'user', content: prompt }]);
      const content = response.content || response.text || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.app && this._isValidAppName(parsed.app)) {
          this.onProgress(`🤖 AI resolved app: ${parsed.app}`);
          return { appName: parsed.app, task: parsed.task || message };
        }
      }
    } catch (e) {
      this.onProgress(`⚠️ AI app resolution failed: ${e.message}`);
    }

    return { appName: null, task: null };
  }

  /**
   * Validate that a string looks like a real app name, not garbage from the AI.
   * Real app names: "Calendar", "Google Chrome", "Voice Memos"
   * NOT app names: full sentences, URLs, questions
   */
  _isValidAppName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name.length > 40) return false;                    // App names are short
    if (/[?!]/.test(name)) return false;                    // No question/exclamation marks
    if (/https?:\/\/|\.com|\.org|\.net/.test(name)) return false;  // No URLs
    if (name.split(/\s+/).length > 5) return false;        // Max ~5 words
    return true;
  }

  // ═══════════════════════════════════════════════════════
  // APP MANAGEMENT — open, maximize, focus
  // ═══════════════════════════════════════════════════════

  /**
   * Open an app and maximize its window to fill the screen.
   */
  async _openAndFocusApp(appName) {
    this.onProgress(`🚀 Opening ${appName}...`);

    // Use DesktopController if available (handles blocked apps, aliases)
    if (this.controller) {
      const result = await this.controller.openApp(appName);
      if (!result.success) {
        throw new Error(result.error || `Could not open ${appName}`);
      }
    } else {
      // Fallback: direct shell command
      const { exec } = require('child_process');
      await new Promise((resolve) => {
        exec(`open -a "${appName}"`, (err) => {
          if (err) this.onProgress(`⚠️ open command failed: ${err.message}`);
          resolve();
        });
      });
    }

    await this._wait(1000);

    // Maximize the app window to fill the screen
    const screen = await this._getScreenBounds();
    try {
      await this._runAppleScript(`
tell application "${appName}"
  activate
  if (count of windows) > 0 then
    set bounds of front window to {0, 25, ${screen.w}, ${screen.h - 2}}
  end if
end tell
      `);
      // Ensure it's truly in front
      await this._runAppleScript(`tell application "System Events" to set frontmost of process "${appName}" to true`);
    } catch (e) {
      // Some apps don't support bounds (Launchpad, etc.) — that's fine
      this.onProgress(`ℹ️ Could not maximize ${appName} window (may not support it)`);
    }

    this.onProgress(`✅ ${appName} is open and focused`);
  }

  // ═══════════════════════════════════════════════════════
  // LEARNING SYSTEM — Ported from SOPExecutor
  // ═══════════════════════════════════════════════════════

  /**
   * Apply learning from past runs before executing a step.
   * Adds extra wait time for steps with low reliability.
   */
  async _applyLearning(step, stepNum, sopId) {
    if (!sopId) return;
    try {
      const learningPath = path.join(process.cwd(), 'data/sops', sopId, 'learning.json');
      const raw = await fs.readFile(learningPath, 'utf-8');
      const learning = JSON.parse(raw);

      const insight = learning.stepInsights?.[String(stepNum)];
      if (!insight || insight.runs < 2) return;

      if (insight.reliability < 0.5) {
        this.onProgress(`  ⚠️ Step ${stepNum} has ${Math.round(insight.reliability * 100)}% reliability — being extra careful`);
        await this._wait(2000);
      } else if (insight.reliability < 0.75) {
        this.onProgress(`  📊 Step ${stepNum} reliability: ${Math.round(insight.reliability * 100)}%`);
        await this._wait(1000);
      }

      if (insight.needsVisualGuide) {
        this.onProgress(`  🎥 Step ${stepNum} may need visual guide — consider recording this step`);
      }
    } catch {
      // No learning data yet — first run, that's fine
    }
  }

  /**
   * Record which execution method worked for a step on this domain.
   * Builds cross-site skill memory in data/memory/skills.json.
   */
  async _recordSkill(step, stepResult) {
    try {
      const skillActions = ['edit_field', 'type', 'click_text', 'smart_click', 'click_submit'];
      if (!skillActions.includes(step.action) || !stepResult?.method) return;

      // Get current Chrome URL for domain tracking
      let domain = 'unknown';
      try {
        const { execSync } = require('child_process');
        const url = execSync(
          `osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'`,
          { timeout: 3000 }
        ).toString().trim();
        if (url) domain = new URL(url).hostname;
      } catch { /* can't get URL — use unknown */ }

      const skillsPath = path.join(process.cwd(), 'data/memory/skills.json');
      let skills = {};
      try {
        skills = JSON.parse(await fs.readFile(skillsPath, 'utf-8'));
      } catch { /* no skills file yet */ }

      const category = step.action;
      if (!skills[category]) skills[category] = {};
      if (!skills[category][stepResult.method]) {
        skills[category][stepResult.method] = { sites: [], successCount: 0 };
      }

      const entry = skills[category][stepResult.method];
      entry.successCount++;
      if (!entry.sites.includes(domain)) entry.sites.push(domain);
      entry.lastUsed = new Date().toISOString();

      await fs.mkdir(path.join(process.cwd(), 'data/memory'), { recursive: true });
      await fs.writeFile(skillsPath, JSON.stringify(skills, null, 2));
    } catch {
      // Never let skill recording break execution
    }
  }

  /**
   * Persist per-step execution insights after a full SOP run.
   * Writes to data/sops/{sopId}/learning.json.
   */
  async _updateLearning(sopId, log, overallSuccess) {
    try {
      const sopDir = path.join(process.cwd(), 'data/sops', sopId);
      const learningPath = path.join(sopDir, 'learning.json');
      await fs.mkdir(sopDir, { recursive: true });

      let learning;
      try {
        learning = JSON.parse(await fs.readFile(learningPath, 'utf-8'));
      } catch {
        learning = { sopId, totalRuns: 0, successCount: 0, stepInsights: {} };
      }

      learning.totalRuns++;
      if (overallSuccess) learning.successCount++;
      learning.successRate = learning.totalRuns > 0
        ? Math.round((learning.successCount / learning.totalRuns) * 100) / 100
        : 0;

      for (const entry of log) {
        const key = String(entry.step);
        if (!learning.stepInsights[key]) {
          learning.stepInsights[key] = {
            action: entry.action,
            successCount: 0, failureCount: 0,
            commonErrors: [], methods: {},
            avgDuration: 0, totalDuration: 0, runs: 0,
          };
        }

        const insight = learning.stepInsights[key];
        insight.runs++;

        if (entry.success) {
          insight.successCount++;
          const method = entry.method || 'default';
          insight.methods[method] = (insight.methods[method] || 0) + 1;
          insight.bestMethod = Object.entries(insight.methods)
            .sort((a, b) => b[1] - a[1])[0]?.[0] || 'default';
        } else {
          insight.failureCount++;
          if (entry.error && !insight.commonErrors.includes(entry.error)) {
            insight.commonErrors.push(entry.error);
            if (insight.commonErrors.length > 5) insight.commonErrors.shift();
          }
        }

        if (entry.duration) {
          insight.totalDuration += entry.duration;
          insight.avgDuration = Math.round(insight.totalDuration / insight.runs);
        }

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
   * AI-powered recovery when a step fails.
   * Takes a screenshot, asks Gemini what to do, executes a single recovery action.
   */
  async _attemptRecovery(step, error, stepNum) {
    if (!this.aiManager) return false;

    try {
      const screenshot = await this._captureScreen();
      if (!screenshot) return false;

      const prompt = `A browser automation step failed. Help me recover.

Failed step: ${JSON.stringify({ action: step.action, target: step.target, text: step.text, description: step.description })}
Error: ${error.message}

Look at the screenshot. What single recovery action should I take before retrying the step?
Return ONLY a JSON object: {"action": "click|scroll|wait|press", "target": "description of what to click", "key": "enter"}
Use "click" if an element needs clicking, "scroll" if the target might be off-screen, "wait" if the page is loading, "press" if a key needs pressing.`;

      const response = await this.aiManager.chat(
        [{ role: 'user', content: [
          { type: 'text', text: prompt },
          { type: 'image', data: screenshot, mimeType: 'image/png' },
        ]}],
        { temperature: 0.2, maxTokens: 200 }
      );

      const content = typeof response === 'string' ? response : response?.content || response?.text || '';
      const jsonMatch = content.match(/\{[\s\S]*?\}/);

      if (jsonMatch) {
        const recovery = JSON.parse(jsonMatch[0]);
        this.onProgress(`  🔧 Recovery: ${recovery.action} → "${recovery.target || recovery.key || ''}"`);

        const robot = require('robotjs');
        switch (recovery.action) {
          case 'click':
            if (recovery.target && this.desktop) {
              await this.desktop.findAndClick(recovery.target);
              return true;
            }
            break;
          case 'scroll':
            robot.scrollMouse(0, -5);
            await this._wait(500);
            return true;
          case 'wait':
            await this._wait(3000);
            return true;
          case 'press':
            robot.keyTap(recovery.key || 'escape');
            await this._wait(300);
            return true;
        }
      }
    } catch {
      // Recovery itself failed — that's OK, the retry loop continues
    }

    return false;
  }

  // ═══════════════════════════════════════════════════════
  // SCREEN CAPTURE
  // ═══════════════════════════════════════════════════════

  /**
   * Take a screenshot and return as base64 string.
   */
  async _captureScreen() {
    try {
      const jimpImage = await this.desktop.seeScreen();

      // Save screenshot for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `desktop_task_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      await fs.mkdir(this.screenshotDir, { recursive: true });
      await jimpImage.write(filepath);

      // Convert to base64
      const buffer = await jimpImage.getBuffer('image/png');
      return buffer.toString('base64');
    } catch (e) {
      this.onProgress(`⚠️ Screen capture failed: ${e.message}`);
      return null;
    }
  }

  /**
   * Capture a resized screenshot for SSE failure events.
   * Full-res saved to disk for debugging; smaller JPEG sent to chat UI.
   */
  async _captureFailureScreenshot() {
    try {
      const jimpImage = await this.desktop.seeScreen();

      // Save full-res to disk for debugging
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `sop_failure_${timestamp}.png`;
      const filepath = path.join(this.screenshotDir, filename);
      await fs.mkdir(this.screenshotDir, { recursive: true });
      await jimpImage.write(filepath);

      // Resize for SSE — max 800px wide for smaller payload
      const resized = jimpImage.clone();
      if (resized.getWidth() > 800) {
        resized.resize({ w: 800 });
      }
      const buffer = await resized.getBuffer('image/png');
      return buffer.toString('base64');
    } catch (e) {
      this.onProgress(`⚠️ Failure screenshot capture failed: ${e.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // STEP OPTIMIZER — Make recorded SOPs smarter before replay
  // ═══════════════════════════════════════════════════════

  /**
   * Pre-process SOP steps to fix common recording noise:
   * 1. URL navigation (type + deletes + autocomplete + return) → single navigate step
   * 2. Consecutive deletes → Cmd+A + Delete (select all + clear)
   * 3. Consecutive scrolls → single larger scroll
   * 4. Skip clicks that return to the dashboard at the end of recording
   */
  _optimizeForReplay(steps, sop = {}) {
    const optimized = [];
    let i = 0;

    while (i < steps.length) {
      const step = steps[i];
      const targetLower = (step.target || '').toLowerCase();

      // ── Pattern 1: URL Navigation ──
      // click(tab bar) → type(url-ish) → [deletes/arrows/more typing] → return
      // Replace entire sequence with a "navigate" meta-step
      if (step.action === 'click' && /\b(tab bar|address bar|url|chrome)\b/i.test(targetLower)) {
        const navResult = this._extractNavSequence(steps, i, sop);
        if (navResult) {
          optimized.push({
            action: 'navigate',
            url: navResult.url,
            _original: `Steps ${i + 1}-${navResult.endIndex + 1}`,
          });
          i = navResult.endIndex + 1;
          continue;
        }
      }

      // ── Pattern 2: Consecutive deletes → Select All + Delete ──
      // 3+ delete keys in a row → Cmd+A + Delete (clears any field)
      if (step.action === 'key' && step.key === 'delete') {
        let deleteCount = 0;
        let j = i;
        while (j < steps.length && steps[j].action === 'key' && steps[j].key === 'delete') {
          deleteCount++;
          j++;
        }
        if (deleteCount >= 3) {
          // Replace N deletes with select-all + delete
          optimized.push({ action: 'key', key: 'a', modifiers: ['command'], _hint: 'select all' });
          optimized.push({ action: 'key', key: 'delete', modifiers: [], _hint: `replaces ${deleteCount} deletes` });
          i = j;
          continue;
        }
      }

      // ── Pattern 3: Consecutive scrolls → single scroll ──
      if (step.action === 'scroll') {
        let scrollCount = 1;
        let j = i + 1;
        while (j < steps.length && steps[j].action === 'scroll' && steps[j].direction === step.direction) {
          scrollCount++;
          j++;
        }
        optimized.push({
          ...step,
          _scrollMultiplier: scrollCount,
        });
        i = j;
        continue;
      }

      // ── Pattern 4: Skip end-of-recording clicks back to dashboard ──
      if (step.action === 'click' && /\b(openace|dashboard|likemindedpro|dock)\b/i.test(targetLower)) {
        // User was switching back to the dashboard to stop recording — skip
        i++;
        continue;
      }

      // Pass through unchanged
      optimized.push(step);
      i++;
    }

    return optimized;
  }

  /**
   * Extract a URL navigation sequence starting at index i.
   * Looks for: click(address bar) → type(text) → [corrections/autocomplete] → return
   * Uses SOP keywords to determine the correct URL when the user used autocomplete.
   * Returns: { url, endIndex } or null
   */
  _extractNavSequence(steps, startIndex, sop = {}) {
    let i = startIndex + 1; // Skip the initial click
    let rawTyped = '';       // Everything typed (before deletions)
    let correctedText = '';  // After simulating deletes
    let usedAutocomplete = false;
    let foundReturn = false;

    // Scan forward looking for the pattern
    while (i < steps.length) {
      const s = steps[i];

      if (s.action === 'type') {
        rawTyped += s.text || '';
        correctedText += s.text || '';
      } else if (s.action === 'key') {
        if (s.key === 'return') {
          foundReturn = true;
          break;
        } else if (s.key === 'delete') {
          if (correctedText.length > 0) correctedText = correctedText.slice(0, -1);
        } else if (s.key === 'down' || s.key === 'up') {
          usedAutocomplete = true;
        } else {
          break; // Not a nav sequence
        }
      } else {
        break;
      }
      i++;
    }

    if (!foundReturn || rawTyped.length < 3) return null;

    // ── Determine the URL ──
    let url = null;

    // Strategy 1: If user typed a full URL/domain (with TLD), use it directly
    const fullDomain = correctedText.match(/([\w-]+\.(com|org|net|io|co|dev|ai|app|pro|gov|edu|me)\b[\w/.-]*)/i);
    if (fullDomain) {
      url = fullDomain[1];
    }

    // Strategy 2: If autocomplete was used, infer URL from SOP keywords
    // The keywords contain the actual service name (e.g., "eventbrite")
    if (!url && usedAutocomplete) {
      const keywords = [...(sop.keywords || []), ...(sop.name || '').toLowerCase().split(/\s+/)];
      const KNOWN_DOMAINS = {
        eventbrite: 'eventbrite.com', google: 'google.com', gmail: 'gmail.com',
        facebook: 'facebook.com', instagram: 'instagram.com', twitter: 'twitter.com',
        linkedin: 'linkedin.com', github: 'github.com', youtube: 'youtube.com',
        reddit: 'reddit.com', amazon: 'amazon.com', ebay: 'ebay.com',
        zillow: 'zillow.com', airbnb: 'airbnb.com', stripe: 'stripe.com',
        slack: 'slack.com', notion: 'notion.so', trello: 'trello.com',
        meetup: 'meetup.com', zoom: 'zoom.us', vercel: 'vercel.com',
        netlify: 'netlify.com', heroku: 'heroku.com', shopify: 'shopify.com',
      };

      for (const kw of keywords) {
        const domain = KNOWN_DOMAINS[kw.toLowerCase()];
        if (domain) {
          url = domain;
          break;
        }
      }

      // Fuzzy fallback: check if any keyword is similar to the raw typed text
      if (!url) {
        for (const kw of keywords) {
          if (kw.length >= 4 && rawTyped.toLowerCase().includes(kw.substring(0, 4))) {
            // The typed text contains the start of this keyword — likely the target domain
            url = kw.toLowerCase() + '.com';
            break;
          }
        }
      }
    }

    // Strategy 3: Just use whatever was typed (corrected)
    if (!url) {
      url = correctedText.trim();
    }

    // Clean up and add protocol
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://www.' + url;
    }
    if (!/\.(com|org|net|io|co|dev|ai|app|pro|gov|edu|me|us|so)\b/i.test(url)) {
      url += '.com';
    }

    return { url, endIndex: i };
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  async _pasteText(text) {
    const { exec } = require('child_process');
    const escaped = text.replace(/'/g, "'\\''");
    await new Promise((resolve) => {
      exec(`printf '%s' '${escaped}' | pbcopy`, () => resolve());
    });
    await this._wait(150);
    const robot = require('robotjs');
    robot.keyTap('v', ['command']);
    await this._wait(300);
  }

  async _getScreenBounds() {
    if (this._screenBounds) return this._screenBounds;
    try {
      const result = await this._runAppleScript('tell application "Finder" to get bounds of window of desktop');
      const parts = result.split(',').map(s => parseInt(s.trim(), 10));
      if (parts.length === 4 && parts[2] > 0) {
        this._screenBounds = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
      }
    } catch (e) { /* fall through */ }
    if (!this._screenBounds) {
      this._screenBounds = { x: 0, y: 0, w: 1920, h: 1080 };
    }
    return this._screenBounds;
  }

  async _runAppleScript(script) {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err, stdout) => {
        if (err) reject(err);
        else resolve(stdout.trim());
      });
    });
  }

  /**
   * Click a web element in Chrome by searching the DOM for its text content.
   * Uses AppleScript → Chrome JavaScript execution to find and click elements.
   * This works even when page layout changes — no coordinate dependency.
   *
   * @param {string} target - The element description from the SOP, e.g. "Create Event button"
   * @param {boolean} isDouble - If true, dispatch a dblclick event instead of click
   * @returns {boolean} true if element was found and clicked
   */
  async _clickBySelector(selector, isDouble = false) {
    if (this._chromeJsDisabled || !selector) return false;

    const { execSync } = require('child_process');
    const fsSyncMod = require('fs');
    const os = require('os');

    try {
      const jsCode = `(function() {
        var el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return 'NOT_FOUND';
        var rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return 'NOT_FOUND';
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        var evts = ['mousedown', 'mouseup', 'click'];
        for (var i = 0; i < evts.length; i++) {
          el.dispatchEvent(new MouseEvent(evts[i], { bubbles: true, cancelable: true, view: window }));
        }
        ${isDouble ? `el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));` : ''}
        return 'CLICKED';
      })()`;

      if (process.platform === 'win32') {
        const { loadPlatform } = await import('./platforms/PlatformAdapter.js');
        const plat = await loadPlatform();
        const result = await plat.executeJsInChrome(jsCode);
        return result === 'CLICKED';
      }

      // macOS: AppleScript temp file approach
      const tmpFile = require('path').join(os.tmpdir(), `ace_sel_${Date.now()}.scpt`);
      const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;
      fsSyncMod.writeFileSync(tmpFile, appleScript);
      const result = execSync(`osascript "${tmpFile}"`, { timeout: 5000 }).toString().trim();
      try { fsSyncMod.unlinkSync(tmpFile); } catch {}
      return result === 'CLICKED';
    } catch (e) {
      return false;
    }
  }

  /**
   * Click a web element by visible text content using JavaScript in Chrome.
   * @returns {boolean} true if element was found and clicked
   */
  async _clickWebElement(target, isDouble = false) {
    // Skip if we already know Chrome JS execution is disabled
    if (this._chromeJsDisabled) return false;

    const { execSync } = require('child_process');
    const fsSyncMod = require('fs');
    const os = require('os');

    // Extract meaningful search text from the target label
    const searchText = this._extractSearchText(target);
    if (!searchText || searchText.length < 2) return false;

    // Build JavaScript that searches Chrome's DOM for the element
    // Phase 0: Form fields (label→input, placeholder, aria-label, adjacent inputs)
    // Phase 1: Clickable elements (buttons, links, roles)
    // Phase 2: Generic text elements (span, div, etc.)
    const jsCode = `(function() {
      var target = ${JSON.stringify(searchText.toLowerCase())};
      var terms = target.split(/\\s+/).filter(function(w) { return w.length > 1; });

      function textMatch(text) {
        var lower = text.toLowerCase().trim();
        if (lower === target) return 4;
        if (lower.includes(target)) return 3;
        var hits = 0;
        for (var i = 0; i < terms.length; i++) {
          if (lower.includes(terms[i])) hits++;
        }
        return (terms.length > 0 && hits >= Math.ceil(terms.length * 0.6)) ? 2 : 0;
      }

      function isVisible(el) {
        var style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML' && style.position !== 'fixed' && style.position !== 'sticky') return false;
        var r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
      }

      function clickEl(el, label) {
        el.scrollIntoView({block: 'center', behavior: 'instant'});
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.getAttribute('contenteditable')) {
          el.focus();
        }
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width/2, cy = r.top + r.height/2;
        // Fire mousedown/mouseup first (React apps need these), then normal click
        var evtOpts = {bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy};
        el.dispatchEvent(new MouseEvent('mousedown', evtOpts));
        el.dispatchEvent(new MouseEvent('mouseup', evtOpts));
        ${isDouble
          ? `el.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, cancelable: true}));`
          : `el.click();`}
        return 'clicked:' + Math.round(cx) + ',' + Math.round(cy) + ':' + (label || '').substring(0, 80);
      }

      // ── Phase 0: Form field search (highest priority) ──
      // Check labels → find associated input
      var labels = document.querySelectorAll('label');
      for (var i = 0; i < labels.length; i++) {
        var lbl = labels[i];
        var lblText = lbl.textContent.trim();
        if (textMatch(lblText) < 2) continue;
        // Method 1: label[for] → input[id]
        var forId = lbl.getAttribute('for');
        if (forId) {
          var inp = document.getElementById(forId);
          if (inp && isVisible(inp)) return clickEl(inp, lblText);
        }
        // Method 2: label wraps the input
        var wrapped = lbl.querySelector('input, textarea, select, [contenteditable="true"]');
        if (wrapped && isVisible(wrapped)) return clickEl(wrapped, lblText);
        // Method 3: input is next sibling
        var sib = lbl.nextElementSibling;
        if (sib && /^(INPUT|TEXTAREA|SELECT)$/.test(sib.tagName) && isVisible(sib)) return clickEl(sib, lblText);
        // Method 4: input nearby in same container
        var par = lbl.parentElement;
        if (par) {
          var nearby = par.querySelector('input, textarea, select, [contenteditable="true"]');
          if (nearby && isVisible(nearby)) return clickEl(nearby, lblText);
        }
      }

      // Check inputs directly by placeholder, aria-label, title, name, id
      var inputs = document.querySelectorAll('input, textarea, select, [contenteditable="true"]');
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i];
        if (!isVisible(el)) continue;
        var attrs = [
          el.getAttribute('placeholder') || '',
          el.getAttribute('aria-label') || '',
          el.getAttribute('title') || '',
          (el.getAttribute('name') || '').replace(/[-_]/g, ' '),
          (el.getAttribute('id') || '').replace(/[-_]/g, ' ')
        ];
        for (var a = 0; a < attrs.length; a++) {
          if (attrs[a] && textMatch(attrs[a]) >= 2) return clickEl(el, attrs[a]);
        }
      }

      // ── Phase 1: Clickable elements (buttons, links, roles, icons) ──
      var best = null, bestScore = 0;
      var clickables = document.querySelectorAll('a, button, [role="button"], [role="menuitem"], [role="option"], [role="tab"], [role="link"], input[type="submit"], input[type="button"], [onclick], [data-action], summary');
      for (var i = 0; i < clickables.length; i++) {
        var el = clickables[i];
        var text = (el.textContent || el.value || '').trim();
        var ariaLabel = el.getAttribute('aria-label') || '';
        var title = el.getAttribute('title') || '';
        var testStr = text.length < 300 ? text : '';
        // Check text content, aria-label, and title
        var score = Math.max(textMatch(testStr), textMatch(ariaLabel), textMatch(title));
        if (score > bestScore && isVisible(el)) { best = el; bestScore = score; }
      }

      // ── Phase 2: Generic text elements ──
      if (!best) {
        var all = document.querySelectorAll('span, div, td, th, li, p, label, h1, h2, h3, h4, h5, h6, [class*="btn"], [class*="button"], [class*="action"], [class*="menu-item"]');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          if (el.children.length > 8) continue;
          var text = el.textContent.trim();
          if (text.length > 300 || text.length < 1) continue;
          var ariaLabel = el.getAttribute('aria-label') || '';
          var title = el.getAttribute('title') || '';
          var score = Math.max(textMatch(text), textMatch(ariaLabel), textMatch(title));
          if (score > bestScore && isVisible(el)) { best = el; bestScore = score; }
        }
      }

      if (best) return clickEl(best, (best.textContent || '').trim());
      return 'not_found';
    })()`;

    // Write AppleScript to temp file to avoid quoting nightmares
    const tmpFile = path.join(os.tmpdir(), `ace_click_${Date.now()}.scpt`);
    const appleScript = `tell application "Google Chrome" to execute front window's active tab javascript ${JSON.stringify(jsCode)}`;

    try {
      fsSyncMod.writeFileSync(tmpFile, appleScript);
      const result = execSync(`osascript "${tmpFile}"`, { timeout: 8000 }).toString().trim();
      try { fsSyncMod.unlinkSync(tmpFile); } catch (e) { /* cleanup */ }

      if (result.startsWith('clicked:')) {
        const parts = result.substring(8);
        const desc = parts.split(':').slice(1).join(':') || target;
        return true;
      }
      return false;
    } catch (e) {
      try { fsSyncMod.unlinkSync(tmpFile); } catch (e2) { /* cleanup */ }
      // Detect "Allow JavaScript from Apple Events" not enabled
      if (e.message && e.message.includes('Executing JavaScript through AppleScript is turned off')) {
        this._chromeJsDisabled = true;
        this.onProgress('⚠️ Chrome JS disabled — enable: View → Developer → Allow JavaScript from Apple Events');
        this.onProgress('   Falling back to AI vision + coordinates for all clicks');
      } else {
      }
      return false;
    }
  }

  /**
   * Extract meaningful search text from a target label.
   * "Create Event button" → "create event"
   * "Upcoming events dropdown" → "upcoming events"
   * "Three dots (event options)" → "event options"
   * "Chrome tab bar" → "" (returns empty — not a web element)
   */
  _extractSearchText(target) {
    if (!target) return '';

    // Skip Chrome UI elements — those should use coordinates, not DOM search
    const chromeUI = /\b(chrome tab|address bar|url bar|url input|tab bar|browser toolbar|chrome toolbar|chrome address)\b/i;
    if (chromeUI.test(target)) return '';

    // Skip generic coordinate-only targets
    if (/^click at \(\d+,\s*\d+\)$/i.test(target)) return '';

    let text = target
      // Remove generic UI descriptors
      .replace(/\b(button|link|dropdown|menu item|option|icon|input|field|area|bar|tab|checkbox|radio|toggle|three dots|context menu|hamburger|kebab|popup|dialog|modal)\b/gi, '')
      // Remove parenthetical descriptions
      .replace(/\([^)]*\)/g, '')
      // Remove colon-prefixed descriptors like "Context menu:"
      .replace(/^[^:]+:\s*/g, '')
      // Clean up
      .replace(/[/:]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // If nothing meaningful left, return empty
    if (text.length < 2) return '';

    return text;
  }

  /**
   * Set up the starting state before replaying an SOP.
   * Opens the right app and navigates to the right URL.
   */
  async _setupStartingState(state) {
    const { execSync } = require('child_process');

    // Bring the right app to front
    if (state.app) {
      this.onProgress(`🖥️ Setting up: bringing ${state.app} to front...`);
      try {
        execSync(`osascript -e 'tell application "${state.app}" to activate'`, { timeout: 5000 });
        await this._wait(1000);
      } catch (e) {
        this.onProgress(`⚠️ Could not activate ${state.app}: ${e.message}`);
      }
    }

    // If Chrome + URL, navigate to the starting URL (skip localhost — the SOP steps handle navigation)
    const isLocalhost = state.url && (state.url.includes('localhost') || state.url.includes('127.0.0.1'));
    if (state.url && !isLocalhost && (state.app === 'Google Chrome' || !state.app)) {
      this.onProgress(`🌐 Navigating Chrome to: ${state.url}`);
      try {
        const script = `tell application "Google Chrome"
          activate
          if (count of windows) = 0 then make new window
          set URL of active tab of front window to "${state.url}"
        end tell`;
        execSync(`osascript -e '${script}'`, { timeout: 5000 });
        // Wait for page to load
        this.onProgress('⏳ Waiting for page to load...');
        await this._wait(3000);
      } catch (e) {
        this.onProgress(`⚠️ Could not navigate Chrome: ${e.message}`);
      }
    }
  }

  async _wait(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
}

export default DesktopTaskRunner;
