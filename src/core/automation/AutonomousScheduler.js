/**
 * AutonomousScheduler — Ace's Daily Routine Engine
 * 
 * Runs SOPs on schedule so Ace acts like YOU every day:
 *   - Morning login to LikemindedPro
 *   - Scheduled lead searches
 *   - Automated email campaigns
 *   - Daily reporting
 * 
 * Supports cron-like scheduling and "start of day" routines.
 */

import fs from 'fs/promises';
import path from 'path';
import { eventBus, EVENTS } from '../events/EventBus.js';

export class AutonomousScheduler {
  constructor(options = {}) {
    this.sopExecutor = null;
    this.sopManager = null;
    this.brain = null;        // AceBrain — set via setBrain()
    this.telegramBot = null;  // TelegramBot — set via setTelegramBot()
    this.onProgress = options.onProgress || ((msg) => console.log(`[Scheduler] ${msg}`));

    // Schedule state
    this.timers = new Map();        // Active scheduled timers
    this.routines = [];              // Configured daily routines
    this.executionHistory = [];      // History of scheduled executions
    this.dataDir = options.dataDir || './data/scheduler';
    this.isRunning = false;

    // Daily routine config
    this.morningRoutineTime = options.morningTime || '09:00';  // 9 AM
    this.eveningReportTime = options.eveningTime || '17:00';    // 5 PM
  }

  /** Wire AceBrain for briefing routines */
  setBrain(brain) { this.brain = brain; }

  /** Wire TelegramBot for sending briefings */
  setTelegramBot(bot) { this.telegramBot = bot; }

  /** Wire PipelineManager for context injection */
  setPipelineManager(pm) { this.pipelineManager = pm; }

  /** Wire GoalTracker for mission injection */
  setGoalTracker(gt) { this.goalTracker = gt; }

  /**
   * Initialize with system references
   */
  async initialize(systems) {
    this.sopExecutor = systems.sopExecutor;
    this.sopManager = systems.sopManager;
    
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'results'), { recursive: true });
    await this.loadRoutines();

    // Auto-create pipeline grooming routine if none exists
    if (!this.routines.some(r => r.type === 'pipeline_check')) {
      await this.addRoutine({
        name: 'Pipeline Grooming',
        description: 'Check pipeline for leads needing action — research, outreach, follow-up',
        time: '10:30',
        days: [1, 2, 3, 4, 5],
        type: 'pipeline_check',
        sendToTelegram: true,
        enabled: true
      });
    }

    console.log(`⏰ AutonomousScheduler initialized with ${this.routines.length} routines`);
    return this;
  }

  /**
   * Start the scheduler — begins running all configured routines
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Schedule all configured routines
    for (const routine of this.routines) {
      if (routine.enabled) {
        this.scheduleRoutine(routine);
      }
    }

    // Also schedule any SOPs that have schedules
    if (this.sopManager) {
      const scheduledSOPs = this.sopManager.getAllSOPs().filter(sop => sop.schedule && sop.enabled);
      for (const sop of scheduledSOPs) {
        this.scheduleSOP(sop);
      }
    }

    // Check every minute for due routines
    this.checkInterval = setInterval(() => this.checkDueRoutines(), 60000);
    
    this.onProgress('⏰ Scheduler started — monitoring for due routines');
    eventBus.emit(EVENTS.SCHEDULER_STARTED, { routineCount: this.routines.length });
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.isRunning = false;
    
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer.timeout);
      clearInterval(timer.interval);
    }
    this.timers.clear();
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    this.onProgress('⏰ Scheduler stopped');
  }

  /**
   * Add a daily routine
   */
  async addRoutine(routineConfig) {
    const routine = {
      id: routineConfig.id || `routine_${Date.now()}`,
      name: routineConfig.name,
      description: routineConfig.description || '',
      time: routineConfig.time || '09:00',            // HH:MM format
      days: routineConfig.days || [1,2,3,4,5],        // 0=Sun, 1=Mon, ... 6=Sat
      type: routineConfig.type || 'sop',              // 'sop' | 'briefing' | 'pipeline_check'
      sopIds: routineConfig.sopIds || [],              // SOPs to execute (type: 'sop')
      prompt: routineConfig.prompt || '',              // Brain prompt (type: 'briefing')
      sendToTelegram: routineConfig.sendToTelegram !== false, // Send briefing to Telegram
      delivery: routineConfig.delivery || (routineConfig.sendToTelegram === false ? 'dashboard' : 'both'), // 'dashboard' | 'telegram' | 'both'
      actions: routineConfig.actions || [],            // Direct actions
      enabled: routineConfig.enabled !== false,
      createdAt: new Date().toISOString(),
      lastRun: null,
      runCount: 0
    };

    this.routines.push(routine);
    await this.saveRoutines();

    if (this.isRunning && routine.enabled) {
      this.scheduleRoutine(routine);
    }

    this.onProgress(`📅 Added routine: "${routine.name}" at ${routine.time}`);
    return routine;
  }

  /**
   * Update an existing routine's properties and reschedule if needed.
   */
  async updateRoutine(routineId, updates) {
    const routine = this.routines.find(r => r.id === routineId);
    if (!routine) return null;

    const needsReschedule = updates.time !== undefined || updates.days !== undefined || updates.enabled !== undefined;

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id' && key !== 'createdAt') {
        routine[key] = value;
      }
    }

    await this.saveRoutines();

    // Reschedule if time/days/enabled changed
    if (needsReschedule && this.isRunning) {
      const existing = this.timers.get(routineId);
      if (existing?.timeout) clearTimeout(existing.timeout);
      this.timers.delete(routineId);

      if (routine.enabled) {
        this.scheduleRoutine(routine);
      }
    }

    this.onProgress(`📅 Updated routine: "${routine.name}" → ${routine.time} on days [${routine.days}]`);
    return routine;
  }

  /**
   * Execute the morning startup routine
   * This is what makes Ace "start the day" autonomously
   */
  async executeMorningRoutine() {
    this.onProgress('🌅 Starting morning routine...');
    
    const results = [];
    
    // Find all morning SOPs
    const morningSOPs = this.sopManager ? 
      this.sopManager.getAllSOPs().filter(sop => 
        sop.enabled && (
          sop.triggers?.some(t => t.includes('morning') || t.includes('startup') || t.includes('start day')) ||
          sop.keywords?.includes('morning') ||
          sop.category === 'general'
        )
      ) : [];

    // Execute login SOPs first (e.g., log into LikemindedPro)
    const loginSOPs = morningSOPs.filter(sop => 
      sop.name.toLowerCase().includes('login') || sop.name.toLowerCase().includes('log in')
    );
    
    for (const sop of loginSOPs) {
      this.onProgress(`🔐 Morning login: ${sop.name}`);
      try {
        const result = await this._executeSOP(sop);
        results.push({ sopId: sop.id, sopName: sop.name, ...result });
      } catch (e) {
        results.push({ sopId: sop.id, sopName: sop.name, success: false, error: e.message });
      }
    }

    // Then execute other morning routines
    const otherSOPs = morningSOPs.filter(sop => !loginSOPs.includes(sop));
    for (const sop of otherSOPs) {
      this.onProgress(`📋 Morning task: ${sop.name}`);
      try {
        const result = await this._executeSOP(sop);
        results.push({ sopId: sop.id, sopName: sop.name, ...result });
      } catch (e) {
        results.push({ sopId: sop.id, sopName: sop.name, success: false, error: e.message });
      }
    }

    // Log the morning routine completion
    this.executionHistory.push({
      type: 'morning_routine',
      timestamp: new Date().toISOString(),
      results,
      success: results.every(r => r.success)
    });

    const successCount = results.filter(r => r.success).length;
    this.onProgress(`🌅 Morning routine complete: ${successCount}/${results.length} tasks succeeded`);
    
    return results;
  }

  /**
   * Execute a specific routine by ID
   */
  async executeRoutine(routineId) {
    const routine = this.routines.find(r => r.id === routineId);
    if (!routine) {
      return { success: false, error: `Routine not found: ${routineId}` };
    }

    this.onProgress(`⏰ Executing routine: "${routine.name}"`);
    const results = [];

    // Pipeline check routines: scan pipeline for leads needing action
    if (routine.type === 'pipeline_check') {
      try {
        await this.checkPipelineActions(routine);
        results.push({ type: 'pipeline_check', success: true });
      } catch (e) {
        results.push({ type: 'pipeline_check', success: false, error: e.message });
        this.onProgress(`❌ Pipeline check failed: ${e.message}`);
      }
    }
    // Briefing routines: call AceBrain with full context injection
    else if (routine.type === 'briefing') {
      try {
        if (!this.brain) throw new Error('AceBrain not connected to scheduler');

        // Build enhanced prompt with execution history, pipeline state, and goals
        const enhancedPrompt = await this._buildEnhancedPrompt(routine);

        const result = await this.brain.think(`scheduler_${routine.id}`, enhancedPrompt, {
          source: 'scheduler',
          userName: 'Scheduler',
          routineId: routine.id,
          routineName: routine.name,
        });
        const text = result?.text || 'No briefing generated.';

        // Persist execution result for future context
        await this._saveExecutionResult(routine.id, {
          summary: text.substring(0, 500),
          fullOutput: text.substring(0, 2000),
          success: true
        });

        // Deliver results based on per-routine preference
        const delivery = this._getDeliveryPreference(routine);

        if (delivery !== 'dashboard' && this.telegramBot?.isRunning) {
          await this.telegramBot.notify(`📅 *${routine.name}*\n\n${text}`, 'normal');
          this.onProgress(`📱 Briefing sent to Telegram: "${routine.name}"`);
        }

        if (delivery !== 'telegram') {
          eventBus.emit(EVENTS.ROUTINE_COMPLETED, {
            routineId: routine.id,
            routineName: routine.name,
            result: text.slice(0, 2000),
            timestamp: new Date().toISOString()
          });
        }

        results.push({ type: 'briefing', success: true, output: text.slice(0, 300) });
      } catch (e) {
        // Save failure too so we learn from it
        await this._saveExecutionResult(routine.id, {
          summary: `FAILED: ${e.message}`,
          success: false,
          error: e.message
        });
        results.push({ type: 'briefing', success: false, error: e.message });
        this.onProgress(`❌ Briefing failed for "${routine.name}": ${e.message}`);
      }
    } else {
      // Execute SOPs in order — routes desktop SOPs to DesktopTaskRunner automatically
      for (const sopId of (routine.sopIds || [])) {
        try {
          const result = await this._executeSOP(sopId);
          results.push({ sopId, ...result });
        } catch (e) {
          results.push({ sopId, success: false, error: e.message });
        }
      }
    }

    // Update routine metadata
    routine.lastRun = new Date().toISOString();
    routine.runCount = (routine.runCount || 0) + 1;
    await this.saveRoutines();

    return {
      success: results.every(r => r.success),
      routine: routine.name,
      results
    };
  }

  /**
   * Schedule a routine based on its time config
   */
  scheduleRoutine(routine) {
    const [hours, minutes] = routine.time.split(':').map(Number);
    
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date();
      next.setHours(hours, minutes, 0, 0);
      
      // If the time already passed today, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      // Check if the day is in the routine's days array
      while (!routine.days.includes(next.getDay())) {
        next.setDate(next.getDate() + 1);
      }
      
      const delay = next.getTime() - now.getTime();
      
      const timeout = setTimeout(async () => {
        this.onProgress(`⏰ Routine triggered: "${routine.name}"`);
        await this.executeRoutine(routine.id);
        
        // Schedule next occurrence
        if (this.isRunning) {
          scheduleNext();
        }
      }, delay);
      
      this.timers.set(routine.id, { timeout, nextRun: next.toISOString() });
      this.onProgress(`📅 "${routine.name}" scheduled for ${next.toLocaleString()}`);
    };
    
    scheduleNext();
  }

  /**
   * Schedule a SOP that has its own schedule config
   */
  scheduleSOP(sop) {
    // Simple scheduling — SOP.schedule could be a time string or interval
    if (typeof sop.schedule === 'string' && sop.schedule.includes(':')) {
      // Time-based schedule (HH:MM)
      this.scheduleRoutine({
        id: `sop_schedule_${sop.id}`,
        name: `Auto: ${sop.name}`,
        time: sop.schedule,
        days: [1, 2, 3, 4, 5], // Weekdays
        sopIds: [sop.id],
        enabled: true
      });
    }
  }

  /**
   * Check for routines that are due (called every minute)
   */
  checkDueRoutines() {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const currentDay = now.getDay();

    for (const routine of this.routines) {
      if (!routine.enabled) continue;
      if (!routine.days.includes(currentDay)) continue;
      if (routine.time !== currentTime) continue;
      
      // Check if already ran today
      if (routine.lastRun) {
        const lastRunDate = new Date(routine.lastRun).toDateString();
        if (lastRunDate === now.toDateString()) continue; // Already ran today
      }

      // Execute!
      this.executeRoutine(routine.id).catch(e => {
        this.onProgress(`⚠️ Routine failed: ${routine.name}: ${e.message}`);
      });
    }
  }

  /**
   * Smart SOP execution — routes desktop SOPs to DesktopTaskRunner,
   * text-based SOPs to SOPExecutor. Works for ANY trained SOP.
   * The scheduler uses this instead of calling sopExecutor directly
   * so scheduled desktop SOPs (coordinate-based) actually control the screen.
   */
  async _executeSOP(sopOrId) {
    // Resolve to SOP object
    let sop = sopOrId;
    if (typeof sopOrId === 'string') {
      sop = this.sopManager?.getSOP(sopOrId);
      if (!sop) return { success: false, error: `SOP not found: ${sopOrId}` };
    }

    // Detect desktop SOPs (have x/y coordinates from DesktopTrainer)
    const isDesktopSOP = sop.steps?.some(s =>
      s.x != null || s.y != null || (s.action === 'click' && s.target && !s.selector));

    if (isDesktopSOP) {
      // Route to DesktopTaskRunner which uses robotjs coordinates
      const runner = this.brain?._desktopRunner;
      if (runner) {
        this.onProgress(`🎓 Scheduled desktop SOP: Using DesktopTaskRunner for "${sop.name}" (${sop.steps.length} steps)`);
        const result = await runner._replayTrainedSOP(sop);
        if (this.sopManager) {
          try { await this.sopManager.recordRun(sop.id, result.success); } catch (e) { /* ignore */ }
        }
        return result;
      }
      this.onProgress(`⚠️ Desktop SOP "${sop.name}" but DesktopTaskRunner not available — falling back to SOPExecutor`);
    }

    // Text-based SOPs go through SOPExecutor (CSS selectors, navigate, fill_form, etc.)
    return await this.sopExecutor.executeSOP(sop);
  }

  /**
   * Resolve delivery preference for a routine. Backward compatible with sendToTelegram boolean.
   * @returns {'both' | 'dashboard' | 'telegram'}
   */
  _getDeliveryPreference(routine) {
    if (routine.delivery) return routine.delivery;
    if (routine.sendToTelegram === false) return 'dashboard';
    return 'both';
  }

  // ═══════════════════════════════════════════════════════
  // EXECUTION MEMORY — Previous results persist to disk
  // ═══════════════════════════════════════════════════════

  /**
   * Save execution result to disk for future context injection
   */
  async _saveExecutionResult(routineId, resultData) {
    const resultsDir = path.join(this.dataDir, 'results');
    await fs.mkdir(resultsDir, { recursive: true });
    const filePath = path.join(resultsDir, `${routineId}.json`);

    let history = [];
    try { history = JSON.parse(await fs.readFile(filePath, 'utf8')); } catch {}

    history.push({
      timestamp: new Date().toISOString(),
      ...resultData
    });

    // Keep last 10 runs
    if (history.length > 10) history = history.slice(-10);
    await fs.writeFile(filePath, JSON.stringify(history, null, 2));
  }

  /**
   * Load execution history from disk
   */
  async _loadExecutionHistory(routineId, limit = 3) {
    try {
      const filePath = path.join(this.dataDir, 'results', `${routineId}.json`);
      const history = JSON.parse(await fs.readFile(filePath, 'utf8'));
      return history.slice(-limit);
    } catch { return []; }
  }

  /**
   * Build enhanced prompt with execution history, pipeline state, and goals
   */
  async _buildEnhancedPrompt(routine) {
    const basePrompt = routine.prompt || 'Give me a brief status update on the pipeline and tasks.';
    const parts = [];

    // Detect if this is a lead-gen/research routine and wrap with execution instructions
    const isLeadGen = /lead|find|search|research|companies|prospect/i.test(basePrompt);

    if (isLeadGen) {
      parts.push('YOU ARE EXECUTING AN AUTONOMOUS LEAD GENERATION ROUTINE. This is a scheduled task — there is no user to chat with. You must TAKE ACTION, not just describe what you would do.\n');
      parts.push('TASK: ' + basePrompt);
      parts.push('\nEXECUTION PLAN — Follow these steps IN ORDER:');
      parts.push('1. Use open_browser to go to Google: open_browser url="https://www.google.com/search?q=YOUR+SEARCH+TERMS" — build the full search URL directly.');
      parts.push('2. Use read_screen to see the Google results. Identify company names, websites, and links.');
      parts.push('3. Use browser_click to click into promising results. Use read_screen and extract_page_data to pull company details (name, email, phone, website).');
      parts.push('4. Use go_back to return to Google results, then click the next result. Repeat for 5-10 results.');
      parts.push('5. Try 2-3 different Google searches to cover different angles (e.g. different cities, different keywords).');
      parts.push('6. For EACH company found, save it with save_leads including: company name, contact_name, email, phone, website, and a note about why they are a good lead.');
      parts.push('7. After saving leads, update goal progress with manage_goals if there is an active mission.');
      parts.push('8. Aim for at least 5-10 NEW leads per run.');
      parts.push('\nCRITICAL RULES:');
      parts.push('- USE THE BROWSER. Use open_browser, read_screen, browser_click, extract_page_data, go_back. This is your desktop — you control Chrome.');
      parts.push('- If web_search returns no results or fails, ALWAYS fall back to open_browser with Google. The browser NEVER fails.');
      parts.push('- You MUST call save_leads with actual data. Do NOT just say "I found leads" without saving them.');
      parts.push('- Do NOT fabricate company names, emails, or phone numbers. Only save what you actually see on screen.');
      parts.push('- Skip companies already in the pipeline (listed below).');
      parts.push('- If a search returns thin results, try different search terms. Do not give up.');
    } else {
      parts.push(basePrompt);
    }

    // Inject previous execution results
    const previousRuns = await this._loadExecutionHistory(routine.id, 3);
    if (previousRuns.length > 0) {
      parts.push('\n--- PREVIOUS RUN RESULTS (avoid duplicate work) ---');
      for (const run of previousRuns) {
        const status = run.success ? '✅' : '❌';
        parts.push(`[${run.timestamp}] ${status} ${run.summary || 'No summary'}`);
      }
    }

    // Inject current pipeline state
    const pipelineSnapshot = this._getPipelineSnapshot();
    if (pipelineSnapshot) {
      parts.push('\n--- CURRENT PIPELINE ---');
      parts.push(pipelineSnapshot);
      parts.push('Do NOT save leads already in the pipeline. Focus on NEW leads only.');
    }

    // Inject active goals/missions
    const goalsSummary = this.goalTracker?.getGoalsSummary?.() || '';
    if (goalsSummary) {
      parts.push('\n--- ACTIVE MISSIONS ---');
      parts.push(goalsSummary);
    }

    parts.push('\nAfter completing work, summarize what you found and what actions you took. Be specific about company names, contact details, and counts.');

    return parts.join('\n');
  }

  /**
   * Get compact pipeline snapshot for prompt injection
   */
  _getPipelineSnapshot() {
    const pm = this.pipelineManager;
    if (!pm?.pipeline) return null;
    const leads = pm.pipeline.leads || [];
    if (leads.length === 0) return 'Pipeline is empty — no leads yet.';

    const byStage = {};
    for (const lead of leads) {
      const stage = lead.stage || 'new';
      byStage[stage] = byStage[stage] || [];
      byStage[stage].push(`${lead.company}${lead.email ? ' (' + lead.email + ')' : ''}`);
    }

    let snapshot = `Total leads: ${leads.length}\n`;
    for (const [stage, companies] of Object.entries(byStage)) {
      snapshot += `  ${stage}: ${companies.join(', ')}\n`;
    }
    return snapshot;
  }

  /**
   * Check pipeline for leads needing action and trigger AI to handle them
   */
  async checkPipelineActions(routine = null) {
    const pm = this.pipelineManager;
    if (!pm || !this.brain) return;

    const actionable = typeof pm.getActionableLeads === 'function'
      ? pm.getActionableLeads()
      : [];

    if (actionable.length === 0) {
      this.onProgress('📋 Pipeline check: All leads are up to date');
      return;
    }

    // Build targeted prompt for top 5 actionable leads
    const topActions = actionable.slice(0, 5);
    let prompt = 'PIPELINE GROOMING — These leads need your attention:\n\n';
    for (const item of topActions) {
      prompt += `- **${item.lead.company}** (stage: ${item.lead.stage}): ${item.reason}\n`;
      if (item.lead.website) prompt += `  Website: ${item.lead.website}\n`;
      if (item.lead.email) prompt += `  Email: ${item.lead.email}\n`;
    }

    prompt += '\nFor each lead:\n';
    prompt += '1. If they need contact info, open their website with open_browser, use read_screen and extract_page_data to find email/phone/contact info. If no website, use open_browser to Google their company name and find contact details.\n';
    prompt += '2. If they need outreach, draft a personalized email and save it with save_note (do NOT send yet — wait for approval).\n';
    prompt += '3. After researching or drafting, update the lead stage and add notes about what you found.\n';
    prompt += '4. Summarize everything you did so the user knows what to review.\n';
    prompt += '\nUSE THE BROWSER for all research — open_browser, read_screen, browser_click, extract_page_data. You control Chrome on the desktop.\n';

    const goalsSummary = this.goalTracker?.getGoalsSummary?.() || '';
    if (goalsSummary) {
      prompt += '\n--- ACTIVE MISSIONS ---\n' + goalsSummary;
    }

    const result = await this.brain.think('scheduler_pipeline', prompt, {
      source: 'scheduler',
      userName: 'Scheduler',
    });

    const text = result?.text || 'Pipeline check completed.';

    // Deliver based on routine preference (default: both)
    const delivery = routine ? this._getDeliveryPreference(routine) : 'both';

    if (delivery !== 'dashboard' && this.telegramBot?.isRunning) {
      await this.telegramBot.notify(`📋 *Pipeline Grooming*\n\n${text}`, 'normal');
    }

    if (delivery !== 'telegram') {
      eventBus.emit(EVENTS.PIPELINE_ACTION, {
        type: 'grooming',
        routineName: routine?.name || 'Pipeline Grooming',
        summary: text.slice(0, 2000),
        actionableCount: actionable.length,
        timestamp: new Date().toISOString()
      });
    }

    this.onProgress(`📋 Pipeline check: ${actionable.length} leads needed attention`);
  }

  /**
   * Load routines from disk
   */
  async loadRoutines() {
    try {
      const data = await fs.readFile(path.join(this.dataDir, 'routines.json'), 'utf8');
      this.routines = JSON.parse(data);
    } catch (e) {
      // Create default routines
      this.routines = [
        {
          id: 'morning_startup',
          name: 'Morning Startup',
          description: 'Log into LikemindedPro and check dashboard',
          time: '09:00',
          days: [1, 2, 3, 4, 5],
          sopIds: ['sop_login_likemindedpro'],
          actions: [],
          enabled: true,
          createdAt: new Date().toISOString(),
          lastRun: null,
          runCount: 0
        }
      ];
      await this.saveRoutines();
    }
  }

  /**
   * Save routines to disk
   */
  async saveRoutines() {
    await fs.writeFile(
      path.join(this.dataDir, 'routines.json'),
      JSON.stringify(this.routines, null, 2)
    );
  }

  /**
   * Get all routines
   */
  getRoutines() {
    return this.routines;
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      routineCount: this.routines.length,
      enabledRoutines: this.routines.filter(r => r.enabled).length,
      nextRuns: Array.from(this.timers.entries()).map(([id, t]) => ({ id, nextRun: t.nextRun })),
      recentHistory: this.executionHistory.slice(-5)
    };
  }

  /**
   * Get summary for AI context
   */
  getSummary() {
    if (this.routines.length === 0) return 'No scheduled routines configured.';
    
    let summary = 'Scheduled routines:\n';
    for (const r of this.routines) {
      const status = r.enabled ? '✅' : '⏸️';
      summary += `${status} "${r.name}" at ${r.time} (${r.days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(',')})\n`;
      if (r.lastRun) {
        summary += `   Last run: ${new Date(r.lastRun).toLocaleString()}\n`;
      }
    }
    return summary;
  }
}

export default AutonomousScheduler;
