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

    // Ensure screenshot directory exists
    const sessionDir = path.join(this.screenshotDir, this.sessionName.replace(/\s+/g, '_'));
    await fs.mkdir(sessionDir, { recursive: true });

    // ── Compile event monitor if needed ──
    await this._ensureEventMonitor();

    // ── Capture starting state: which app is active, what URL is in Chrome ──
    this.startingState = await this._captureStartingState();
    this.onProgress(`📍 Starting state: ${this.startingState.app || 'unknown app'}${this.startingState.url ? ' — ' + this.startingState.url : ''}`);

    // ── Start native event monitor ──
    try {
      await this._startEventMonitor();
    } catch (e) {
      this.onProgress(`⚠️ Native event monitor failed: ${e.message} — falling back to polling`);
      // Fall back to basic polling if event monitor can't start
      this._startPollingFallback(sessionDir);
    }

    // ── Capture screenshots every 3 seconds (for reference/display only) ──
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
   * Fallback: basic polling if native monitor fails.
   */
  _startPollingFallback(sessionDir) {
    this.onProgress('⚠️ Using polling fallback — click positions may be approximate');
    const robot = require('robotjs');
    let lastX = 0, lastY = 0;
    this._pollInterval = setInterval(() => {
      if (!this.isRecording) return;
      const pos = robot.getMousePos();
      // Detect significant mouse movement as a potential click
      const dist = Math.sqrt((pos.x - lastX) ** 2 + (pos.y - lastY) ** 2);
      if (dist > 30) {
        this.events.push({
          type: 'click',
          button: 'left',
          x: pos.x,
          y: pos.y,
          ts: Date.now()
        });
      }
      lastX = pos.x;
      lastY = pos.y;
    }, 200);
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

    // ── Step 1: Deduplicate rapid clicks (double-click within 300ms at same position) ──
    const dedupedEvents = [];
    for (let i = 0; i < this.events.length; i++) {
      const evt = this.events[i];
      const prev = dedupedEvents[dedupedEvents.length - 1];
      if (prev && evt.type === 'click' && prev.type === 'click' &&
          (evt.ts - prev.ts) < 300 &&
          Math.abs(evt.x - prev.x) < 10 && Math.abs(evt.y - prev.y) < 10) {
        continue; // Skip duplicate click
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
    for (const evt of finalEvents) {
      const step = { action: evt.type, timestamp: evt.ts };

      switch (evt.type) {
        case 'click':
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

    this.onProgress(`📊 Built ${steps.length} steps from ${finalEvents.length} events`);

    // ── Optional: AI enrichment for click target labels ──
    await this._enrichClickLabels(steps);

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
      steps,
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
   * Enrich click steps with AI-generated target labels.
   * Uses the nearest screenshot + click position to ask AI "what's at (x,y)?".
   * This is OPTIONAL — the SOP works without labels (coordinates are exact).
   */
  async _enrichClickLabels(steps) {
    if (!this.aiManager) return;

    const clickSteps = steps.filter(s => s.action === 'click' && s.referenceScreenshot);
    if (clickSteps.length === 0) return;

    this.onProgress(`🏷️ Labeling ${clickSteps.length} click targets with AI vision...`);

    for (let i = 0; i < clickSteps.length; i++) {
      const step = clickSteps[i];
      const nearest = this._findNearestScreenshot(step.timestamp);
      if (!nearest) {
        step.target = `click at (${step.x}, ${step.y})`;
        continue;
      }

      try {
        const prompt = `Look at this screenshot (${this.desktop?.screenSize?.width || 1920}x${this.desktop?.screenSize?.height || 1080} pixels).
What UI element is at pixel coordinates (${step.x}, ${step.y})?
Return a SHORT description (2-6 words), e.g.: "Sign In button", "search input field", "Chrome tab bar"
Return ONLY the description text, nothing else.`;

        const result = await this.aiManager.chatWithVision(
          prompt,
          `data:image/png;base64,${nearest.base64}`
        );
        const label = (result.content || result.text || '').trim().replace(/^["']|["']$/g, '');
        step.target = label || `click at (${step.x}, ${step.y})`;
        this.onProgress(`  📌 Step ${i + 1}: "${step.target}" at (${step.x}, ${step.y})`);
      } catch (e) {
        step.target = `click at (${step.x}, ${step.y})`;
      }
    }
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
