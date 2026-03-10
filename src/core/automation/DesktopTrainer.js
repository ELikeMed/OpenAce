/**
 * DesktopTrainer — Learn from user demonstrations on the ENTIRE desktop.
 *
 * Uses a native macOS event monitor (scripts/event-monitor) to capture
 * REAL click positions, keystrokes, and scroll events — not polled guesses.
 *
 * Flow:
 *   1. User clicks Train button → startRecording(sessionName)
 *   2. Native event monitor captures every click/key/scroll with exact coordinates
 *   3. Screenshots captured periodically for reference (display only, not for coords)
 *   4. User clicks Stop → stopRecording()
 *   5. Steps built directly from real events — no AI guessing for coordinates
 *   6. AI optionally enriches step labels (what was clicked)
 *   7. Saves as Desktop SOP → replays with exact coordinates
 */

import { createRequire } from 'module';
import { spawn, execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { eventBus } from '../events/EventBus.js';

const require = createRequire(import.meta.url);

// Path to the compiled native event monitor
const EVENT_MONITOR_PATH = path.join(process.cwd(), 'scripts', 'event-monitor');
const EVENT_MONITOR_SRC = path.join(process.cwd(), 'scripts', 'event-monitor.swift');

// Valid element types and contexts for structured AI vision response
const VALID_ELEMENT_TYPES = new Set([
  'button', 'input', 'link', 'select', 'tab', 'checkbox', 'radio',
  'text', 'image', 'icon', 'menu_item', 'nav', 'other'
]);
const VALID_CONTEXTS = new Set([
  'form', 'navbar', 'modal', 'sidebar', 'toolbar', 'header',
  'footer', 'dropdown_menu', 'page_body', 'dialog', 'tab_bar', 'other'
]);

export class DesktopTrainer {
  constructor({ desktopAgent, aiManager, sopManager, onProgress }) {
    this.desktop = desktopAgent;
    this.aiManager = aiManager;
    this.sopManager = sopManager;
    this.onProgress = onProgress || ((msg) => console.log(`[DesktopTrainer] ${msg}`));
    this.isRecording = false;
    this.events = [];            // Real events from native monitor: { type, x, y, key, ts, ... }
    this.screenshots = [];       // Periodic screenshots for reference: { timestamp, base64 }
    this.captureInterval = null;
    this.monitorProcess = null;  // Native event monitor child process
    this.sessionName = '';
    this.startingState = null;   // { app, url } captured when recording starts
    this.recordingResolution = null; // { width, height } captured when recording starts
    this.urlSnapshots = [];      // Periodic URL captures: { timestamp, url }
    this.screenshotDir = path.join(process.cwd(), 'data/training/screenshots');
  }

  /**
   * Start recording a desktop demonstration.
   * Spawns native event monitor for real click/key capture.
   */
  async startRecording(sessionName) {
    if (this.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    this.sessionName = sessionName || `session_${Date.now()}`;
    this.events = [];
    this.screenshots = [];
    this.urlSnapshots = [];

    // Ensure screenshot directory exists
    const sessionDir = path.join(this.screenshotDir, this.sessionName.replace(/\s+/g, '_'));
    await fs.mkdir(sessionDir, { recursive: true });

    // ── Capture screen resolution for coordinate scaling during replay ──
    try {
      const robot = require('robotjs');
      this.recordingResolution = robot.getScreenSize();
      this.onProgress(`📐 Screen resolution: ${this.recordingResolution.width}x${this.recordingResolution.height}`);
    } catch (e) {
      this.recordingResolution = { width: 1920, height: 1080 }; // Reasonable default
    }

    // ── Compile event monitor if needed ──
    await this._ensureEventMonitor();

    // ── Capture starting state: which app is active, what URL is in Chrome ──
    this.startingState = await this._captureStartingState();
    this.onProgress(`📍 Starting state: ${this.startingState.app || 'unknown app'}${this.startingState.url ? ' — ' + this.startingState.url : ''}`);

    // ── Start native event monitor — FAIL FAST if Accessibility is missing ──
    try {
      await this._startEventMonitor();
    } catch (e) {
      const isAccessibility = e.message && (e.message.includes('Accessibility') || e.message.includes('event tap') || e.message.includes('permission'));
      if (isAccessibility) {
        this.onProgress('❌ Cannot record — Accessibility permission required');
        return {
          success: false,
          error: 'Grant Accessibility permission to Terminal (or VS Code) in System Settings → Privacy & Security → Accessibility, then try again. Without this, Ace cannot see your clicks.'
        };
      }
      // Non-permission errors (e.g. compilation failed)
      this.onProgress(`❌ Event monitor failed: ${e.message}`);
      return {
        success: false,
        error: `Event monitor failed to start: ${e.message}. Try restarting OpenAce.`
      };
    }

    // ── Capture screenshots + Chrome URL every 3 seconds ──
    this.isRecording = true;
    this.captureInterval = setInterval(async () => {
      if (!this.isRecording) return;
      try {
        const jimpImage = await this.desktop.seeScreen();
        const buffer = await jimpImage.getBuffer('image/png');
        const base64 = buffer.toString('base64');
        const timestamp = Date.now();

        this.screenshots.push({ timestamp, base64 });

        // Save to disk for reference
        const filename = `frame_${timestamp}.png`;
        await jimpImage.write(path.join(sessionDir, filename));

        // Capture Chrome URL for per-step URL tracking
        try {
          const url = execSync(
            `osascript -e 'tell application "Google Chrome" to get URL of active tab of front window'`,
            { timeout: 2000 }
          ).toString().trim();
          if (url && url.startsWith('http')) {
            this.urlSnapshots.push({ timestamp, url });
          }
        } catch (e) { /* Chrome not active or no window — skip */ }

        eventBus.emit('desktop:train:frame', { frameCount: this.screenshots.length, eventCount: this.events.length });
      } catch (e) {
        // Skip frame on error
      }
    }, 3000);

    this.onProgress(`🎓 Recording started: "${this.sessionName}" — do your thing, I'm watching every click!`);
    eventBus.emit('desktop:train:started', { name: this.sessionName, timestamp: Date.now() });

    return { success: true, name: this.sessionName };
  }

  /**
   * Stop recording and build the SOP from captured events.
   */
  async stopRecording() {
    if (!this.isRecording) {
      return { success: false, error: 'Not recording' };
    }

    this.isRecording = false;

    // Stop screenshot capture
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }

    // Stop native event monitor
    this._stopEventMonitor();

    const eventCount = this.events.length;
    const screenshotCount = this.screenshots.length;
    this.onProgress(`🎓 Recording stopped. Captured ${eventCount} real events + ${screenshotCount} screenshots. Building SOP...`);
    eventBus.emit('desktop:train:analyzing', { eventCount, screenshotCount });

    if (eventCount === 0) {
      return { success: false, error: 'No events captured. Did you click/type anything during recording?' };
    }

    // Build SOP directly from real events
    const sop = await this._buildSOPFromEvents();

    eventBus.emit('desktop:train:complete', {
      sopId: sop.id,
      name: sop.name,
      steps: sop.steps.length,
      summary: `Learned ${sop.steps.length} steps from ${eventCount} real events`
    });

    return { success: true, sop };
  }

  /**
   * Get current recording status.
   */
  getStatus() {
    return {
      recording: this.isRecording,
      sessionName: this.sessionName,
      events: this.events.length,
      screenshots: this.screenshots.length,
      monitorActive: this.monitorProcess !== null && !this.monitorProcess.killed
    };
  }

  // ═══════════════════════════════════════════════════════
  // NATIVE EVENT MONITOR
  // ═══════════════════════════════════════════════════════

  /**
   * Compile the Swift event monitor if it doesn't exist.
   */
  async _ensureEventMonitor() {
    try {
      await fs.access(EVENT_MONITOR_PATH);
      return; // Already compiled
    } catch {
      // Need to compile
      this.onProgress('🔧 Compiling native event monitor (first time only)...');
      try {
        execSync(`swiftc "${EVENT_MONITOR_SRC}" -o "${EVENT_MONITOR_PATH}"`, { timeout: 30000 });
        this.onProgress('✅ Event monitor compiled');
      } catch (e) {
        throw new Error(`Failed to compile event monitor: ${e.message}`);
      }
    }
  }

  /**
   * Start the native event monitor as a child process.
   * Reads JSON lines from stdout for each click/key/scroll event.
   */
  _startEventMonitor() {
    return new Promise((resolve, reject) => {
      this.monitorProcess = spawn(EVENT_MONITOR_PATH, [], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let buffer = '';
      let started = false;

      // Read JSON lines from stdout
      this.monitorProcess.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            // Filter out clicks on the dashboard itself (the Train/Stop button area)
            // Don't record the "Stop" button click at the end
            if (this.isRecording) {
              this.events.push(event);
              this.onProgress(`📌 ${event.type}: ${event.type === 'click' ? `(${event.x}, ${event.y})` : event.key || event.direction || ''}`);
            }
          } catch (e) {
            // Skip malformed lines
          }
        }
      });

      // Read stderr for "READY" signal
      this.monitorProcess.stderr.on('data', (data) => {
        const msg = data.toString();
        if (msg.includes('EVENT_MONITOR_READY') && !started) {
          started = true;
          this.onProgress('🎯 Native event monitor active — capturing real clicks');
          resolve();
        }
        if (msg.includes('ERROR')) {
          if (!started) reject(new Error(msg.trim()));
        }
      });

      this.monitorProcess.on('error', (err) => {
        if (!started) reject(err);
      });

      this.monitorProcess.on('exit', (code) => {
        this.monitorProcess = null;
        if (!started) reject(new Error(`Event monitor exited with code ${code}`));
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!started) reject(new Error('Event monitor did not start within 5 seconds'));
      }, 5000);
    });
  }

  /**
   * Stop the native event monitor.
   */
  _stopEventMonitor() {
    if (this.monitorProcess && !this.monitorProcess.killed) {
      this.monitorProcess.kill('SIGTERM');
      this.monitorProcess = null;
    }
  }

  /**
   * Find the URL snapshot closest in time to a given event timestamp.
   */
  _findNearestUrl(ts) {
    if (this.urlSnapshots.length === 0) return null;
    let best = this.urlSnapshots[0];
    let bestDist = Math.abs(ts - best.timestamp);
    for (const snap of this.urlSnapshots) {
      const dist = Math.abs(ts - snap.timestamp);
      if (dist < bestDist) {
        bestDist = dist;
        best = snap;
      }
    }
    return bestDist < 5000 ? best.url : null; // Only if within 5 seconds
  }

  // ═══════════════════════════════════════════════════════
  // STARTING STATE — What app/URL is active when recording begins
  // ═══════════════════════════════════════════════════════

  /**
   * Capture the current app and URL (if Chrome) when recording starts.
   * This is stored in the SOP so replay can set up the same starting point.
   */
  async _captureStartingState() {
    const state = { app: null, url: null };
    try {
      // Get the frontmost app
      const appScript = 'tell application "System Events" to get name of first application process whose frontmost is true';
      state.app = execSync(`osascript -e '${appScript}'`, { timeout: 3000 }).toString().trim();

      // If Chrome is active, get the current URL
      if (state.app === 'Google Chrome') {
        const urlScript = 'tell application "Google Chrome" to get URL of active tab of front window';
        state.url = execSync(`osascript -e '${urlScript}'`, { timeout: 3000 }).toString().trim();
      }
    } catch (e) {
      // Not critical — just helpful metadata
    }
    return state;
  }

  // ═══════════════════════════════════════════════════════
  // BUILD SOP — Convert real events into SOP steps
  // ═══════════════════════════════════════════════════════

  /**
   * Build a Desktop SOP from captured real events.
   * No AI guessing for coordinates — events have exact positions.
   * AI is used ONLY to label what was clicked (optional enrichment).
   */
  async _buildSOPFromEvents() {
    const sessionDir = path.join(this.screenshotDir, this.sessionName.replace(/\s+/g, '_'));

    // ── Step 1: Handle rapid clicks — dedup accidentals (<100ms), detect double-clicks (100-400ms) ──
    const dedupedEvents = [];
    for (let i = 0; i < this.events.length; i++) {
      const evt = this.events[i];
      const prev = dedupedEvents[dedupedEvents.length - 1];
      if (prev && evt.type === 'click' && prev.type === 'click' &&
          Math.abs(evt.x - prev.x) < 10 && Math.abs(evt.y - prev.y) < 10) {
        const gap = evt.ts - prev.ts;
        if (gap < 100) {
          continue; // Accidental trackpad duplicate — skip
        }
        if (gap < 400) {
          // Intentional double-click — mark the previous event
          prev.type = 'doubleClick';
          continue; // Consume the second click
        }
      }
      dedupedEvents.push(evt);
    }

    // ── Step 2: Collapse scroll events ──
    // A single trackpad scroll generates 30+ events in <1 second. Collapse them.
    const scrollCollapsed = [];
    for (const evt of dedupedEvents) {
      const prev = scrollCollapsed[scrollCollapsed.length - 1];
      if (evt.type === 'scroll' && prev && prev.type === 'scroll' &&
          prev.direction === evt.direction &&
          (evt.ts - prev.ts) < 800 &&
          Math.abs(evt.x - prev.x) < 100 && Math.abs(evt.y - prev.y) < 150) {
        prev._scrollCount = (prev._scrollCount || 1) + 1;
        prev.ts = evt.ts; // Update to latest timestamp
        continue; // Collapse into previous scroll
      }
      scrollCollapsed.push({ ...evt });
    }

    // ── Step 3: Merge keystrokes into "type" actions, but keep special keys separate ──
    const SPECIAL_KEYS = new Set([
      'return', 'tab', 'escape', 'delete', 'space',
      'up', 'down', 'left', 'right'
    ]);
    const mergedEvents = [];
    let keyBuffer = [];
    let keyBufferStart = 0;

    const flushKeyBuffer = () => {
      if (keyBuffer.length === 0) return;
      const text = keyBuffer.map(k => k.key).join('');
      if (text.trim()) {
        mergedEvents.push({ type: 'type', text, ts: keyBufferStart });
      }
      keyBuffer = [];
    };

    for (const evt of scrollCollapsed) {
      if (evt.type === 'key') {
        const isSpecial = SPECIAL_KEYS.has(evt.key) || (evt.modifiers && evt.modifiers.length > 0);
        if (isSpecial) {
          // Flush any pending typed characters first
          flushKeyBuffer();
          // Special keys (return, delete, cmd+c, etc.) are always separate steps
          mergedEvents.push({
            type: 'key',
            key: evt.key,
            modifiers: evt.modifiers || [],
            ts: evt.ts
          });
        } else {
          // Regular character — buffer it for merging into a "type" action
          if (keyBuffer.length === 0) keyBufferStart = evt.ts;
          keyBuffer.push(evt);
        }
      } else {
        flushKeyBuffer();
        mergedEvents.push(evt);
      }
    }
    flushKeyBuffer();

    // ── Step 4: Collapse consecutive delete/backspace keys ──
    // 3+ consecutive deletes → single "clear field" (Cmd+A + Delete)
    const finalEvents = [];
    for (let j = 0; j < mergedEvents.length; j++) {
      const evt = mergedEvents[j];
      if (evt.type === 'key' && evt.key === 'delete') {
        let count = 1;
        while (j + 1 < mergedEvents.length && mergedEvents[j + 1].type === 'key' && mergedEvents[j + 1].key === 'delete') {
          count++;
          j++;
        }
        if (count >= 3) {
          // Replace with Cmd+A + Delete
          finalEvents.push({ type: 'key', key: 'a', modifiers: ['command'], ts: evt.ts });
          finalEvents.push({ type: 'key', key: 'delete', modifiers: [], ts: evt.ts });
        } else {
          // Keep individual deletes
          for (let k = 0; k < count; k++) finalEvents.push({ type: 'key', key: 'delete', modifiers: [], ts: evt.ts });
        }
      } else {
        finalEvents.push(evt);
      }
    }

    this.onProgress(`📊 Raw: ${this.events.length} events → Deduped: ${dedupedEvents.length} → Scroll collapsed: ${scrollCollapsed.length} → Merged: ${mergedEvents.length} → Final: ${finalEvents.length}`);

    // ── Build SOP steps from processed events ──
    const steps = [];
    let prevTimestamp = null;
    for (const evt of finalEvents) {
      const step = { action: evt.type, timestamp: evt.ts };

      // ── Record delay from previous step (how long user waited) ──
      if (prevTimestamp !== null) {
        const rawDelay = evt.ts - prevTimestamp;
        // Cap: min 200ms, max 10000ms (ignore pauses > 10s — user was thinking)
        step.delay = Math.max(200, Math.min(10000, rawDelay));
      } else {
        step.delay = 0; // First step has no delay
      }
      prevTimestamp = evt.ts;

      switch (evt.type) {
        case 'click':
        case 'doubleClick':
          step.x = evt.x;
          step.y = evt.y;
          step.target = ''; // Will be enriched by AI below
          break;
        case 'type':
          step.text = evt.text;
          break;
        case 'key':
          step.key = evt.key;
          step.modifiers = evt.modifiers || [];
          break;
        case 'scroll':
          step.direction = evt.direction;
          step.x = evt.x;
          step.y = evt.y;
          break;
      }

      // ── Attach Chrome URL for this step (for replay verification) ──
      const nearestUrl = this._findNearestUrl(evt.ts);
      if (nearestUrl) {
        step.url = nearestUrl;
      }

      // Find nearest screenshot for this event (for reference)
      const nearest = this._findNearestScreenshot(evt.ts);
      if (nearest) {
        const filename = `step_${steps.length + 1}_${evt.ts}.png`;
        try {
          await fs.writeFile(path.join(sessionDir, filename), Buffer.from(nearest.base64, 'base64'));
          step.referenceScreenshot = filename;
        } catch (e) { /* skip */ }
      }

      steps.push(step);
    }

    this.onProgress(`📊 Built ${steps.length} steps from ${finalEvents.length} events (with timing + URLs)`);

    // ── Optional: AI enrichment for click target labels ──
    await this._enrichClickLabels(steps);

    // ── Classify raw events into semantic action types ──
    // Upgrades click→click_text/click_submit, merges click+type→edit_field, etc.
    const classifiedSteps = this._classifySteps(steps);
    this.onProgress(`📊 Classified: ${steps.length} raw steps → ${classifiedSteps.length} semantic steps`);

    // ── Auto-generate triggers and keywords ──
    const TRIGGER_STOP = new Set(['how','to','the','a','an','and','or','for','in','on','as','our','my','any']);
    const nameWords = this.sessionName.toLowerCase().split(/\s+/)
      .filter(w => w.length > 2 && !TRIGGER_STOP.has(w) && !w.startsWith('http'));
    const triggers = [this.sessionName.toLowerCase()];
    if (nameWords.length >= 3) {
      triggers.push(nameWords.slice(0, 3).join(' '));
    }

    // ── Build and save SOP ──
    const sop = {
      id: `desktop_sop_${Date.now()}`,
      name: this.sessionName,
      type: 'desktop',
      triggers,
      keywords: nameWords,
      startingState: this.startingState,
      recordingResolution: this.recordingResolution,
      steps: classifiedSteps,
      totalEvents: this.events.length,
      totalScreenshots: this.screenshots.length,
      createdAt: new Date().toISOString(),
      enabled: true
    };

    // Save to SOPManager or directly to file
    if (this.sopManager) {
      try {
        if (this.sopManager.createSOP) {
          await this.sopManager.createSOP(sop);
        } else if (this.sopManager.saveSOP) {
          await this.sopManager.saveSOP(sop);
        }
      } catch (e) {
        this.onProgress(`⚠️ SOP save failed: ${e.message}`);
        const sopPath = path.join(process.cwd(), 'data/sops/custom', `${sop.id}.json`);
        await fs.mkdir(path.dirname(sopPath), { recursive: true });
        await fs.writeFile(sopPath, JSON.stringify(sop, null, 2));
      }
    } else {
      const sopPath = path.join(process.cwd(), 'data/sops/custom', `${sop.id}.json`);
      await fs.mkdir(path.dirname(sopPath), { recursive: true });
      await fs.writeFile(sopPath, JSON.stringify(sop, null, 2));
    }

    this.onProgress(`🎓 Learned! Saved "${this.sessionName}" with ${steps.length} steps (real event capture). I can replay this anytime.`);
    return sop;
  }

  /**
   * Find the screenshot closest in time to a given event timestamp.
   */
  _findNearestScreenshot(ts) {
    if (this.screenshots.length === 0) return null;
    let best = this.screenshots[0];
    let bestDist = Math.abs(ts - best.timestamp);
    for (const ss of this.screenshots) {
      const dist = Math.abs(ts - ss.timestamp);
      if (dist < bestDist) {
        bestDist = dist;
        best = ss;
      }
    }
    return bestDist < 5000 ? best : null; // Only if within 5 seconds
  }

  /**
   * Validate a string value against a set of allowed values, returning fallback if invalid.
   */
  _validateEnumField(value, validSet, fallback) {
    return validSet.has(value) ? value : fallback;
  }

  /**
   * Enrich click steps with AI-generated structured target info.
   * Groups clicks by nearest screenshot for batched API calls.
   * Returns { type, text, context, interactive } per click for deterministic classification.
   */
  async _enrichClickLabels(steps) {
    if (!this.aiManager) return;

    const clickSteps = steps.filter(s => (s.action === 'click' || s.action === 'doubleClick') && s.referenceScreenshot);
    if (clickSteps.length === 0) return;

    this.onProgress(`🏷️ Labeling ${clickSteps.length} click targets with AI vision...`);

    // Group clicks by their nearest screenshot (clicks within ~3s share one)
    const groups = new Map();
    for (let i = 0; i < clickSteps.length; i++) {
      const step = clickSteps[i];
      const nearest = this._findNearestScreenshot(step.timestamp);
      if (!nearest) {
        step.target = `click at (${step.x}, ${step.y})`;
        continue;
      }
      const key = nearest.timestamp;
      if (!groups.has(key)) {
        groups.set(key, { screenshot: nearest, clicks: [] });
      }
      groups.get(key).clicks.push({ step, index: i });
    }

    const screenWidth = this.desktop?.screenSize?.width || 1920;
    const screenHeight = this.desktop?.screenSize?.height || 1080;

    // One AI call per screenshot group (8 clicks across 3 screenshots = 3 calls)
    for (const [, group] of groups) {
      const { screenshot, clicks } = group;

      const pointsList = clicks.map((c, idx) =>
        `  ${idx + 1}. (${c.step.x}, ${c.step.y})${c.step.url ? ` — page: ${c.step.url}` : ''}`
      ).join('\n');

      const prompt = `You are analyzing a UI screenshot (${screenWidth}x${screenHeight} pixels).
Identify the UI element at EACH of these ${clicks.length} pixel coordinate(s):
${pointsList}

For EACH point, return a JSON object. Return a JSON array with exactly ${clicks.length} object(s), in order:
[{"type": "button|input|link|select|tab|checkbox|radio|text|image|icon|menu_item|nav|other", "text": "visible label", "context": "form|navbar|modal|sidebar|toolbar|header|footer|dropdown_menu|page_body|dialog|tab_bar|other", "interactive": true}]

Rules:
- "type" must be one of the listed values exactly
- "text" is the visible text ON the element (what it says), 2-6 words max
- "context" is the surrounding container: form, navbar, modal, dropdown_menu, tab_bar, etc.
- "interactive" is true if the element does something when clicked (buttons, links, inputs, selects)
- If the click is on plain text or whitespace, use type "text" and interactive false
- Return ONLY the JSON array, no markdown, no explanation`;

      try {
        const result = await this.aiManager.chatWithVision(
          prompt,
          `data:image/png;base64,${screenshot.base64}`
        );
        const raw = (result.content || result.text || '').trim();
        const jsonMatch = raw.match(/\[[\s\S]*\]/);

        if (jsonMatch) {
          const infos = JSON.parse(jsonMatch[0]);
          for (let j = 0; j < clicks.length; j++) {
            const { step, index } = clicks[j];
            const info = infos[j];
            if (info && typeof info === 'object') {
              step.targetInfo = {
                type: this._validateEnumField(info.type, VALID_ELEMENT_TYPES, 'other'),
                text: String(info.text || '').substring(0, 60),
                context: this._validateEnumField(info.context, VALID_CONTEXTS, 'other'),
                interactive: info.interactive !== false
              };
              step.target = step.targetInfo.text || `element at (${step.x}, ${step.y})`;
            } else {
              step.target = `click at (${step.x}, ${step.y})`;
            }
            this.onProgress(`  📌 Step ${index + 1}: "${step.target}" [${step.targetInfo?.type || '?'}] at (${step.x}, ${step.y})`);
          }
        } else {
          // Couldn't parse JSON array — try fallback to old-style free text for single click
          if (clicks.length === 1) {
            const label = raw.replace(/^["']|["']$/g, '').replace(/```[\s\S]*```/g, '').trim();
            clicks[0].step.target = label || `click at (${clicks[0].step.x}, ${clicks[0].step.y})`;
          } else {
            for (const { step } of clicks) {
              step.target = `click at (${step.x}, ${step.y})`;
            }
          }
        }
      } catch (e) {
        for (const { step } of clicks) {
          step.target = `click at (${step.x}, ${step.y})`;
        }
      }
    }

    // Retry failed labels with cropped screenshots for better accuracy
    const failedSteps = clickSteps.filter(s => (s.target || '').startsWith('click at'));
    if (failedSteps.length > 0 && failedSteps.length <= 5) {
      this.onProgress(`🔄 Retrying ${failedSteps.length} failed label(s) with cropped view...`);
      for (const step of failedSteps) {
        await this._retryFailedLabel(step);
      }
    }
  }

  /**
   * Retry labeling a single click step using a cropped screenshot for better accuracy.
   */
  async _retryFailedLabel(step) {
    const nearest = this._findNearestScreenshot(step.timestamp);
    if (!nearest) return;

    try {
      const cropped = await this._cropAroundClick(nearest.base64, step.x, step.y, 200);
      if (!cropped) return;

      const prompt = `This is a ${cropped.cropW}x${cropped.cropH} cropped region from a screenshot.
The user clicked at pixel (${cropped.localX}, ${cropped.localY}) within this crop.
${step.url ? `Page URL: ${step.url}` : ''}

What UI element is at that position? Return JSON:
{"type": "button|input|link|select|tab|checkbox|radio|text|image|icon|menu_item|nav|other", "text": "visible label", "context": "form|navbar|modal|sidebar|toolbar|header|footer|dropdown_menu|page_body|dialog|tab_bar|other", "interactive": true}

Return ONLY the JSON, no markdown.`;

      const result = await this.aiManager.chatWithVision(
        prompt,
        `data:image/png;base64,${cropped.base64}`
      );
      const raw = (result.content || result.text || '').trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const info = JSON.parse(jsonMatch[0]);
        step.targetInfo = {
          type: this._validateEnumField(info.type, VALID_ELEMENT_TYPES, 'other'),
          text: String(info.text || '').substring(0, 60),
          context: this._validateEnumField(info.context, VALID_CONTEXTS, 'other'),
          interactive: info.interactive !== false
        };
        step.target = step.targetInfo.text || `element at (${step.x}, ${step.y})`;
        this.onProgress(`  🔄 Retry success: "${step.target}" [${step.targetInfo.type}]`);
      }
    } catch (e) {
      // Leave the fallback label
    }
  }

  /**
   * Crop a region around click coordinates from a screenshot.
   * Returns { base64, localX, localY, cropW, cropH } or null on failure.
   */
  async _cropAroundClick(screenshotBase64, clickX, clickY, padding = 200) {
    try {
      const { Jimp } = await import('jimp');
      const buffer = Buffer.from(screenshotBase64, 'base64');
      const image = await Jimp.read(buffer);

      const imgW = image.width;
      const imgH = image.height;

      const cropX = Math.max(0, clickX - padding);
      const cropY = Math.max(0, clickY - padding);
      const cropW = Math.min(padding * 2, imgW - cropX);
      const cropH = Math.min(padding * 2, imgH - cropY);

      const localX = clickX - cropX;
      const localY = clickY - cropY;

      const cropped = image.crop({ x: cropX, y: cropY, w: cropW, h: cropH });
      const croppedBuffer = await cropped.getBuffer('image/png');

      return {
        base64: croppedBuffer.toString('base64'),
        localX,
        localY,
        cropW,
        cropH
      };
    } catch (e) {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STEP CLASSIFICATION — Upgrade raw events to semantic action types
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Classify raw event steps into semantic action types.
   * Uses targetInfo.type (structured AI data) for direct mapping when available,
   * with regex fallback for backward compatibility with old SOPs.
   * No AI calls — purely deterministic pattern matching.
   */
  _classifySteps(steps) {
    const classified = [];
    let i = 0;
    const SUBMIT_WORDS = /submit|sign.?in|sign.?up|log.?in|login|send|save|confirm|continue|next|register|create.?account|apply|post|publish|sign.?out|log.?out/i;

    while (i < steps.length) {
      const step = steps[i];
      const next = steps[i + 1];
      const nextNext = steps[i + 2];
      const label = (step.target || '').toLowerCase();
      const info = step.targetInfo || null;
      const elType = info?.type || null;
      const elContext = info?.context || null;
      const elText = (info?.text || '').toLowerCase();

      // ── Pattern: address bar click + type URL + return → navigate ──
      const isAddressBar = (elContext === 'toolbar' && elType === 'input') ||
                           /address.?bar|url.?bar|location.?bar|chrome.?address/i.test(label);
      if ((step.action === 'click' || step.action === 'doubleClick') &&
          isAddressBar &&
          next?.action === 'type' &&
          nextNext?.action === 'key' && nextNext.key === 'return') {
        classified.push({
          action: 'navigate', url: next.text,
          description: `Navigate to ${next.text}`,
          delay: step.delay, timestamp: step.timestamp
        });
        classified.push({
          action: 'wait', ms: 3000,
          description: 'Wait for page to load', delay: 0
        });
        i += 3;
        continue;
      }

      // ── Pattern: click on input/field + type → edit_field ──
      const isInputElement = elType === 'input' ||
                             /input|field|search|text.?box|email|password|username|form|textarea/i.test(label);
      if ((step.action === 'click' || step.action === 'doubleClick') &&
          isInputElement &&
          next?.action === 'type') {
        classified.push({
          action: 'edit_field', target: step.target, text: next.text,
          x: step.x, y: step.y, url: step.url, delay: step.delay,
          description: `Type "${(next.text || '').substring(0, 40)}" in ${step.target}`,
          timestamp: step.timestamp, targetInfo: step.targetInfo
        });
        i += 2;
        continue;
      }

      // ── Right-click → right_click ──
      if (step.action === 'click' && step.button === 'right') {
        classified.push({
          ...step, action: 'right_click',
          target: step.target || `element at (${step.x}, ${step.y})`,
          description: `Right-click ${step.target || `at (${step.x}, ${step.y})`}`
        });
        i++;
        continue;
      }

      // ── Click on dropdown/select + click on option → select_option ──
      const isSelectElement = elType === 'select' || elType === 'menu_item' ||
                              /dropdown|select|menu|combobox|picker|choose|option/i.test(label);
      if ((step.action === 'click' || step.action === 'doubleClick') &&
          isSelectElement &&
          next && (next.action === 'click' || next.action === 'doubleClick')) {
        classified.push({
          action: 'select_option',
          target: step.target,
          text: next.target || '',
          x: step.x, y: step.y, url: step.url, delay: step.delay,
          description: `Select "${next.target || 'option'}" from ${step.target}`,
          timestamp: step.timestamp, targetInfo: step.targetInfo
        });
        i += 2;
        continue;
      }

      // ── Click on tab → switch_tab (type-based) ──
      if ((step.action === 'click' || step.action === 'doubleClick') &&
          (elType === 'tab' || elContext === 'tab_bar')) {
        classified.push({
          ...step, action: 'switch_tab', text: step.target,
          description: `Switch to tab "${step.target}"`,
          targetInfo: step.targetInfo
        });
        i++;
        continue;
      }

      // ── Click on checkbox/radio → click_text (toggle) ──
      if ((step.action === 'click' || step.action === 'doubleClick') &&
          (elType === 'checkbox' || elType === 'radio')) {
        classified.push({
          ...step, action: 'click_text', text: step.target,
          description: `Toggle ${step.target}`,
          targetInfo: step.targetInfo
        });
        i++;
        continue;
      }

      // ── Click steps: classify by type + text ──
      if (step.action === 'click' || step.action === 'doubleClick') {
        const isSubmit = SUBMIT_WORDS.test(elText) || SUBMIT_WORDS.test(label);
        const isTypedElement = elType === 'button' || elType === 'link' || elType === 'nav';

        if (isTypedElement && isSubmit) {
          classified.push({
            ...step, action: 'click_submit', text: step.target,
            description: `Click ${step.target}`, targetInfo: step.targetInfo
          });
          classified.push({ action: 'wait', ms: 2000, description: 'Wait after submit', delay: 0 });
        } else if (isTypedElement) {
          classified.push({
            ...step, action: 'click_text', text: step.target,
            description: `Click ${step.target}`, targetInfo: step.targetInfo
          });
        } else if (isSubmit) {
          // Regex-only submit match (no targetInfo or unknown type)
          classified.push({
            ...step, action: 'click_submit', text: step.target,
            description: `Click ${step.target}`, targetInfo: step.targetInfo
          });
          classified.push({ action: 'wait', ms: 2000, description: 'Wait after submit', delay: 0 });
        } else if (label && !label.startsWith('click at') && info?.interactive !== false) {
          // Has a label and is interactive (or no targetInfo)
          classified.push({
            ...step, action: 'click_text', text: step.target,
            description: `Click ${step.target}`, targetInfo: step.targetInfo
          });
        } else {
          // No useful label or not interactive — use AI vision during replay
          classified.push({
            ...step, action: 'smart_click',
            target: step.target || `element at (${step.x}, ${step.y})`,
            description: step.target || `Click at (${step.x}, ${step.y})`,
            targetInfo: step.targetInfo
          });
        }
        i++;
        continue;
      }

      // ── Key steps: detect special patterns before generic press ──
      if (step.action === 'key') {
        const mods = step.modifiers || [];
        const hasCmd = mods.includes('command');

        // Cmd+[ → go_back (browser back)
        if (hasCmd && step.key === '[') {
          classified.push({
            ...step, action: 'go_back',
            description: 'Navigate back'
          });
          i++;
          continue;
        }

        // Cmd+C → copy_text
        if (hasCmd && step.key === 'c' && !mods.includes('shift')) {
          classified.push({
            ...step, action: 'copy_text',
            description: 'Copy selected text'
          });
          i++;
          continue;
        }

        // Cmd+1-9 or Cmd+Shift+] or Cmd+Shift+[ → switch_tab
        if (hasCmd && (/^[1-9]$/.test(step.key) ||
            (mods.includes('shift') && (step.key === ']' || step.key === '[')))) {
          const tabDesc = /^[1-9]$/.test(step.key)
            ? `Switch to tab ${step.key}`
            : step.key === ']' ? 'Switch to next tab' : 'Switch to previous tab';
          classified.push({
            ...step, action: 'switch_tab', tab: step.key,
            description: tabDesc
          });
          i++;
          continue;
        }

        // Generic key → press
        classified.push({
          ...step, action: 'press',
          description: `Press ${mods.length ? mods.join('+') + '+' : ''}${step.key}`
        });
        i++;
        continue;
      }

      // ── Type, scroll, doubleClick, and everything else — keep as-is ──
      if (!step.description) {
        if (step.action === 'type') step.description = `Type "${(step.text || '').substring(0, 40)}"`;
        else if (step.action === 'scroll') step.description = `Scroll ${step.direction || 'down'}`;
        else step.description = step.action;
      }
      classified.push(step);
      i++;
    }

    return classified;
  }

  // ═══════════════════════════════════════════════════════════════════
  // PER-STEP RECORDING — "Show Me How" for individual SOP steps
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Start recording a single SOP step demonstration.
   * User performs the step while we capture events + screenshots.
   */
  async startStepRecording(sopId, stepNumber) {
    if (this.isRecording) {
      return { success: false, error: 'Already recording' };
    }

    this.sessionName = `step_guide_${sopId}_step${stepNumber}`;
    this.events = [];
    this.screenshots = [];
    this._stepRecordingMeta = { sopId, stepNumber };

    const guideDir = path.join(process.cwd(), 'data/sops', sopId, 'guides');
    await fs.mkdir(guideDir, { recursive: true });

    await this._ensureEventMonitor();
    this.startingState = await this._captureStartingState();

    try {
      await this._startEventMonitor();
    } catch (e) {
      this.onProgress(`⚠️ Event monitor failed: ${e.message}`);
    }

    // Capture screenshots every 2 seconds (tighter interval for step precision)
    this.isRecording = true;
    this.captureInterval = setInterval(async () => {
      if (!this.isRecording) return;
      try {
        const jimpImage = await this.desktop.seeScreen();
        const buffer = await jimpImage.getBuffer('image/png');
        const base64 = buffer.toString('base64');
        const timestamp = Date.now();
        this.screenshots.push({ timestamp, base64 });

        const filename = `step${stepNumber}_frame_${timestamp}.png`;
        await jimpImage.write(path.join(guideDir, filename));
      } catch (e) { /* skip */ }
    }, 2000);

    this.onProgress(`🎥 Recording step ${stepNumber} — show me how to do it!`);
    return { success: true, sopId, stepNumber };
  }

  /**
   * Stop step recording, process events, and save as a visual guide.
   * Returns the guide data to attach to the SOP step.
   */
  async stopStepRecording() {
    if (!this.isRecording || !this._stepRecordingMeta) {
      return { success: false, error: 'Not recording a step' };
    }

    this.isRecording = false;
    if (this.captureInterval) {
      clearInterval(this.captureInterval);
      this.captureInterval = null;
    }
    this._stopEventMonitor();

    const { sopId, stepNumber } = this._stepRecordingMeta;
    const eventCount = this.events.length;
    const screenshotCount = this.screenshots.length;

    this.onProgress(`🎥 Step ${stepNumber} recording done: ${eventCount} events, ${screenshotCount} screenshots`);

    if (eventCount === 0 && screenshotCount === 0) {
      this._stepRecordingMeta = null;
      return { success: false, error: 'No events captured' };
    }

    // Build visual guide from recorded events
    const guide = {
      sopId,
      stepNumber,
      recordedAt: new Date().toISOString(),
      startingState: this.startingState,
      actions: this.events.map(e => ({
        type: e.type,
        x: e.x,
        y: e.y,
        key: e.key || null,
        text: e.text || null,
        timestamp: e.ts
      })),
      screenshotCount,
      screenshotTimestamps: this.screenshots.map(s => s.timestamp)
    };

    // Save the guide
    const guideDir = path.join(process.cwd(), 'data/sops', sopId, 'guides');
    await fs.writeFile(
      path.join(guideDir, `step_${stepNumber}.json`),
      JSON.stringify(guide, null, 2)
    );

    // Save first and last screenshots as reference
    if (this.screenshots.length > 0) {
      const firstShot = this.screenshots[0];
      const lastShot = this.screenshots[this.screenshots.length - 1];
      await fs.writeFile(
        path.join(guideDir, `step_${stepNumber}_before.png`),
        Buffer.from(firstShot.base64, 'base64')
      );
      await fs.writeFile(
        path.join(guideDir, `step_${stepNumber}_after.png`),
        Buffer.from(lastShot.base64, 'base64')
      );
    }

    this._stepRecordingMeta = null;
    this.onProgress(`✅ Visual guide saved for step ${stepNumber}`);
    return { success: true, guide };
  }
}

export default DesktopTrainer;
