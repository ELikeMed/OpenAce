/**
 * AceBrain — The Unified Intelligence Core
 * 
 * This is Ace's REAL brain. A single thinking engine that powers
 * both the Dashboard and Telegram with identical intelligence.
 * 
 * Architecture:
 *   THINK → PLAN → ACT → LEARN
 * 
 * Features:
 * - Chain-of-thought reasoning before every response
 * - Deep context assembly from ALL system sources
 * - Conversation memory with intelligent summarization
 * - SOP/Skills awareness as actionable instructions
 * - Knowledge base recall with semantic relevance
 * - Self-learning loop after every interaction
 * - Personality that feels human, not robotic
 */

import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eventBus, EVENTS } from '../events/EventBus.js';
import BusinessProfile from '../business/BusinessProfile.js';
import { ResearchMemory } from '../memory/ResearchMemory.js';
import { CorrectionMemory } from '../memory/CorrectionMemory.js';
import { SelfHealer } from '../diagnostics/SelfHealer.js';
import { UnifiedAgent } from './UnifiedAgent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

// Load soul.json once at module level — Ace's personality DNA for the main brain
let _soul = null;
try {
  const soulPath = path.join(PROJECT_ROOT, 'data', 'personas', 'soul.json');
  _soul = JSON.parse(readFileSync(soulPath, 'utf-8'));
  console.log('[AceBrain] Soul.json loaded — personality DNA active');
} catch (e) {
  console.log('[AceBrain] Could not load soul.json — using hardcoded personality');
}

export class AceBrain {
  constructor(options = {}) {
    // Core references (injected on init)
    this.aiManager = null;
    this.actionEngine = null;
    this.knowledgeBase = null;
    this.businessProfile = null;
    this.sopManager = null;
    this.skillsManager = null;
    this.pipelineManager = null;
    this.researchAgent = null;
    this.google = null;
    this.sopExecutor = null;
    this.autonomousScheduler = null;
    this.browserAgent = null;
    this.siteMemory = null;
    this.socialMedia = null;

    // Learning & Memory systems
    this.researchMemory = null;
    this.correctionMemory = null;

    // Agent references (for code actions)
    this.agentOrchestrator = null;
    this.codeAgent = null;

    // Unified Agent — single Gemini-powered intelligence with tool calling
    this.unifiedAgent = null;

    // Desktop runner — for SOP replay (accessed by index.js)
    this._desktopRunner = null;

    // Persona system
    this.personas = {};
    this.activePersona = null;

    // Conversation memory — shared across all interfaces
    this.conversations = new Map(); // channelId -> ConversationState
    this.globalMemory = [];          // Cross-conversation insights
    this.learnings = [];             // What Ace has learned over time

    // Configuration
    this.config = options.config || {};
    this.onProgress = options.onProgress || ((msg) => console.log(`[AceBrain] ${msg}`));
    this.maxHistoryPerChannel = 60;
    this.maxGlobalMemory = 100;

    this.initialized = false;
  }

  /**
   * Initialize with references to all OpenAce subsystems
   */
  async initialize(systems) {
    this.aiManager = systems.aiManager;
    this.actionEngine = systems.actionEngine;
    this.knowledgeBase = systems.knowledgeBase;
    this.businessProfile = systems.businessProfile;
    this.sopManager = systems.sopManager;
    this.skillsManager = systems.skillsManager;
    this.pipelineManager = systems.pipelineManager;
    this.researchAgent = systems.researchAgent;
    this.google = systems.google;
    this.sopExecutor = systems.sopExecutor || null;
    this.autonomousScheduler = systems.autonomousScheduler || null;
    this.browserAgent = systems.browserAgent || null;
    this.siteMemory = systems.siteMemory || null;
    this.socialMedia = systems.socialMedia || null;
    this.integrationManager = systems.integrationManager || null;
    this.twilioService = systems.twilioService || null;
    this.creditManager = systems.creditManager || null;
    this._executeSOP = systems.executeSOP || null;

    if (systems.config) this.config = systems.config;

    // Load persistent learnings
    await this.loadLearnings();

    // Load persisted conversation history (survives restarts)
    await this._loadPersistedConversations();

    // Load executive personas
    await this.loadPersonas();

    // Initialize Learning & Memory systems
    await this.initializeMemorySystems();

    // Initialize Department Router with all subsystems
    await this.initializeDepartments(systems);

    this.initialized = true;
    console.log('🧠 AceBrain initialized — unified intelligence active');
    return this;
  }

  /**
   * Initialize ResearchMemory and CorrectionMemory
   */
  async initializeMemorySystems() {
    try {
      this.researchMemory = new ResearchMemory({
        dataDir: path.join(PROJECT_ROOT, 'data', 'memory', 'research'),
      });
      await this.researchMemory.initialize();
    } catch (e) {
      console.log(`⚠️ ResearchMemory failed to initialize: ${e.message}`);
      this.researchMemory = null;
    }

    try {
      this.correctionMemory = new CorrectionMemory({
        dataDir: path.join(PROJECT_ROOT, 'data', 'memory', 'corrections'),
      });
      await this.correctionMemory.initialize();
    } catch (e) {
      console.log(`⚠️ CorrectionMemory failed to initialize: ${e.message}`);
      this.correctionMemory = null;
    }

    // Initialize SelfHealer — Ace's self-diagnostic & recovery system
    try {
      this.selfHealer = new SelfHealer({ baseDir: PROJECT_ROOT, aiManager: this.aiManager });
      console.log('🔧 SelfHealer initialized (with AI brain)');
    } catch (e) {
      console.log(`⚠️ SelfHealer failed to initialize: ${e.message}`);
      this.selfHealer = null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // UNIFIED AGENT INITIALIZATION
  // ═══════════════════════════════════════════════════════

  /**
   * Initialize the UnifiedAgent with all subsystems.
   * Replaces the old department router + IntentRouter with a single
   * Gemini-powered agent that uses function calling (tools).
   */
  async initializeDepartments(systems) {
    try {
      // Build business context from BusinessProfile
      let businessContext = 'No business profile configured yet.';
      if (this.businessProfile) {
        const summary = this.businessProfile.getContextSummary?.();
        if (summary && summary !== 'No business profile set.') {
          businessContext = summary;
        }
      }

      // ── Desktop Autonomy Consent Check ──
      const autonomyConfigPath = path.join(PROJECT_ROOT, 'data', 'permissions', 'desktop-autonomy.json');
      let desktopConsentGiven = false;
      let autonomyConfig = {};
      try {
        if (existsSync(autonomyConfigPath)) {
          const raw = await fs.readFile(autonomyConfigPath, 'utf-8');
          autonomyConfig = JSON.parse(raw);
          desktopConsentGiven = autonomyConfig.consentGiven === true && autonomyConfig.desktopControlEnabled === true;
        }
      } catch (e) {
        console.log(`⚠️ Could not read desktop autonomy config: ${e.message}`);
      }

      // Initialize DesktopAgent (controls real mouse/keyboard)
      let desktopAgent = null;
      let desktopController = null;

      if (process.platform !== 'darwin' && process.platform !== 'win32') {
        console.log('🖥️ Desktop automation requires macOS or Windows. Chat, AI, pipeline, email, and web features work on all platforms.');
      } else if (!desktopConsentGiven) {
        console.log('🔒 Desktop control disabled. Enable it in Settings → Organization → Desktop Control');
      } else {
        try {
          const { default: DesktopAgent } = await import('../automation/DesktopAgent.js');
          desktopAgent = new DesktopAgent({
            aiManager: systems.aiManager,
            onProgress: this.onProgress
          });
          console.log('🖥️ DesktopAgent initialized — can control real Chrome browser');
        } catch (e) {
          console.log(`⚠️ DesktopAgent not available: ${e.message}. Will use fetch-based research.`);
        }

        try {
          const { DesktopController } = await import('../automation/DesktopController.js');
          desktopController = new DesktopController({
            onProgress: this.onProgress,
            blockedApps: autonomyConfig.blockedApps || ['System Preferences', 'Disk Utility', 'Terminal'],
            requireConfirmation: autonomyConfig.requireConfirmation ?? true
          });
          await desktopController.initialize();
          console.log('🖥️ DesktopController initialized — full Mac control enabled');
        } catch (e) {
          console.log(`⚠️ DesktopController not available: ${e.message}`);
        }
      }

      // Initialize DesktopTrainer (learn from user demonstrations)
      let desktopTrainer = null;
      if (desktopAgent) {
        try {
          const { DesktopTrainer } = await import('../automation/DesktopTrainer.js');
          desktopTrainer = new DesktopTrainer({
            desktopAgent,
            aiManager: systems.aiManager,
            sopManager: systems.sopManager || this.sopManager,
            onProgress: this.onProgress
          });
          this.desktopTrainer = desktopTrainer;
          console.log('🎓 DesktopTrainer initialized — Ace can learn from your demonstrations');
        } catch (e) {
          console.log(`⚠️ DesktopTrainer not available: ${e.message}`);
        }
      }

      // Initialize DesktopTaskRunner (needed for desktop SOP replay — accessed by index.js)
      this._desktopRunner = null;
      if (desktopAgent) {
        try {
          const { DesktopTaskRunner } = await import('../automation/DesktopTaskRunner.js');
          this._desktopRunner = new DesktopTaskRunner({
            desktopAgent,
            desktopController,
            aiManager: systems.aiManager,
            onProgress: this.onProgress
          });
          this._desktopRunner.sopManager = systems.sopManager || this.sopManager;
          console.log('🖥️ DesktopTaskRunner ready — desktop SOP replay available');
        } catch (e) {
          console.log(`⚠️ DesktopTaskRunner not available: ${e.message}`);
        }
      }

      // Collect all subsystems
      const allSubsystems = {
        pipelineManager: systems.pipelineManager || this.pipelineManager,
        knowledgeBase: systems.knowledgeBase || this.knowledgeBase,
        workloadStore: systems.workloadStore,
        businessProfile: systems.businessProfile || this.businessProfile,
        skillsManager: systems.skillsManager || this.skillsManager,
        codeAgent: this.codeAgent || systems.codeAgent,
        projectManager: systems.projectManager,
        deployPipeline: systems.deployPipeline,
        agentOrchestrator: this.agentOrchestrator || systems.agentOrchestrator,
        socialMedia: systems.socialMedia || this.socialMedia,
        google: systems.google || this.google,
        contentLibrary: systems.contentLibrary,
        researchAgent: systems.researchAgent || this.researchAgent,
        leadFinder: systems.leadFinder,
        browserAgent: systems.browserAgent || this.browserAgent,
        desktopAgent,
        desktopController,
        desktopTrainer,
        taskQueue: systems.taskQueue,
        autonomousScheduler: systems.autonomousScheduler || this.autonomousScheduler,
        sopExecutor: systems.sopExecutor || this.sopExecutor,
        siteMemory: systems.siteMemory || this.siteMemory,
        sopManager: systems.sopManager || this.sopManager,
        actionEngine: systems.actionEngine || this.actionEngine,
        contactManager: systems.contactManager,
        formManager: systems.formManager,
        deployPipeline: systems.deployPipeline,
        goalTracker: systems.goalTracker,
        integrationManager: systems.integrationManager || this.integrationManager,
        twilioService: systems.twilioService || this.twilioService,
        creditManager: systems.creditManager || this.creditManager,
      };

      // ═══ UNIFIED AGENT — Single Gemini-powered intelligence ═══
      this.unifiedAgent = new UnifiedAgent({
        aiManager: systems.aiManager,
        subsystems: allSubsystems,
        businessContext,
        onProgress: this.onProgress,
        researchMemory: this.researchMemory,
        sopManager: systems.sopManager || this.sopManager,
        correctionMemory: this.correctionMemory,
        executeSOP: this._executeSOP,
      });

      console.log('🧠 UnifiedAgent initialized — single Gemini-powered intelligence active');

      // Wire desktopAgent into SOPExecutor for smart_click/smart_fill SOP steps
      const sopExec = systems.sopExecutor || this.sopExecutor;
      if (sopExec && desktopAgent && !sopExec.desktopAgent) {
        sopExec.desktopAgent = desktopAgent;
        console.log('🖱️ DesktopAgent wired into SOPExecutor — smart click/fill enabled');
      }
    } catch (err) {
      console.error(`⚠️ UnifiedAgent failed to initialize: ${err.message}`);
      console.error(err.stack);
      this.unifiedAgent = null;
    }
  }

  /**
   * Get department statuses for the UI.
   * With UnifiedAgent, there are no separate departments — return a single agent status.
   */
  getDepartments() {
    if (!this.unifiedAgent) return [];
    return [{
      id: 'unified',
      name: 'Ace (Unified Agent)',
      description: 'Single Gemini-powered intelligence with tool access',
      enabled: true,
      status: 'active',
    }];
  }

  /**
   * Update business context
   */
  updateBusinessContext(context) {
    if (this.unifiedAgent) {
      this.unifiedAgent.businessContext = context;
    }
  }

  /**
   * Hot-swap business-scoped subsystems (called by index.js switchBusiness)
   */
  updateBusinessSubsystems({ pipelineManager, contactManager }) {
    if (this.unifiedAgent?.subsystems) {
      if (pipelineManager) this.unifiedAgent.subsystems.pipelineManager = pipelineManager;
      if (contactManager) this.unifiedAgent.subsystems.contactManager = contactManager;
    }
    if (pipelineManager) this.pipelineManager = pipelineManager;
  }

  /** Stop the current processing loop (user clicked Stop). */
  stopProcessing() {
    if (this.unifiedAgent) {
      this.unifiedAgent.abort();
    }
  }

  // ═══════════════════════════════════════════════════════
  // PERSONA LOADING & DETECTION
  // ═══════════════════════════════════════════════════════

  /**
   * Load all persona JSON files from data/personas/ directory
   */
  async loadPersonas() {
    try {
      const personasDir = path.join(PROJECT_ROOT, 'data', 'personas');
      const files = await fs.readdir(personasDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(personasDir, file);
          const data = await fs.readFile(filePath, 'utf8');
          const persona = JSON.parse(data);
          if (persona.id) {
            this.personas[persona.id] = persona;
          }
        } catch (err) {
          console.log(`[AceBrain] Failed to load persona file ${file}: ${err.message}`);
        }
      }

      console.log(`[AceBrain] Loaded ${Object.keys(this.personas).length} personas: ${Object.keys(this.personas).join(', ')}`);
    } catch (err) {
      console.log(`[AceBrain] Could not load personas directory: ${err.message}`);
      this.personas = {};
    }
  }

  /**
   * Detect the best-matching persona based on topic keywords in the message.
   * Returns the persona with the highest keyword match count.
   * Defaults to CEO persona if no keywords match.
   */
  detectPersona(message) {
    const lower = message.toLowerCase();
    let bestPersona = null;
    let bestCount = 0;

    for (const [id, persona] of Object.entries(this.personas)) {
      if (!persona.topicKeywords || !Array.isArray(persona.topicKeywords)) continue;

      const count = persona.topicKeywords.reduce((sum, keyword) => {
        return sum + (lower.includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);

      if (count > bestCount) {
        bestCount = count;
        bestPersona = persona;
      }
    }

    // Default to CEO if no keywords matched
    if (bestCount === 0 && this.personas['ceo']) {
      bestPersona = this.personas['ceo'];
    }

    this.activePersona = bestPersona;
    if (bestPersona) {
      console.log(`[AceBrain] Detected persona: ${bestPersona.name} (matched ${bestCount} keywords)`);
    }
    return bestPersona;
  }

  // ═══════════════════════════════════════════════════════
  // THE MAIN THINKING LOOP: THINK → PLAN → ACT → LEARN
  // ═══════════════════════════════════════════════════════

  /**
   * Process any message from any channel (dashboard, telegram, API).
   * This is the SINGLE entry point for all intelligence.
   * 
   * @param {string} channelId - Unique channel identifier (e.g., 'dashboard', 'telegram_12345')
   * @param {string} message - The user's message
   * @param {object} context - Additional context (userName, source, mode, etc.)
   * @returns {object} { text, actions, data, thinking, metadata }
   */
  async think(channelId, message, context = {}) {
    if (!this.initialized) {
      return { text: '⚠️ Brain not initialized yet. Please wait...', actions: [] };
    }

    const userName = context.userName || 'Boss';
    const source = context.source || 'unknown';
    const startTime = Date.now();

    // ═══ NO API KEY CHECK — Guide user through setup ═══
    if (this.aiManager) {
      const available = Object.keys(this.aiManager.providers || {});
      if (available.length === 0) {
        this.addToConversation(channelId, 'user', message, { userName, source });
        const setupGuide = `Hey ${userName}! I'm Ace, your AI executive assistant. I need an AI connection to get started — it's free and takes about 60 seconds.

**Step 1 — Get your free API key:**

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Sign in with your Google account
3. Click **"Create API key"**
4. Copy the key

**Step 2 — Connect it to me:**

5. Click the **⚙️ Settings** tab (bottom left of the sidebar)
6. Scroll down to **AI Providers** — you'll see Gemini, OpenAI, Claude, and Ollama
7. Click **"Set Up"** on the **Gemini** card
8. Paste your API key → click **Test Connection** → click **Save & Enable**

**Step 3 — Set up Task Routing:**

9. Still in Settings, scroll down to **Task Routing**
10. You'll see dropdowns for General, Code, Vision, and Research — set each one to **Gemini**

That's it! Once connected, I can help you with research, email, social media, websites, scheduling, and a whole lot more.

**Pro tip:** You can also add OpenAI or Claude API keys later as backup providers, and use Task Routing to assign different AIs to different tasks.`;
        return {
          text: setupGuide,
          actions: [],
          data: {},
          thinking: ['No AI provider configured — showing setup guide'],
          metadata: { source: 'setup_guide', duration: Date.now() - startTime }
        };
      }
    }

    // Step 0: Record the incoming message
    this.addToConversation(channelId, 'user', message, { userName, source });

    // ═══ SOP PRE-FLIGHT — Deterministic check BEFORE Gemini ═══
    // Layer 1 (exact trigger, confidence 0.95): Auto-execute for everyone (user + scheduler)
    // Layer 2 (word overlap, confidence 0.7-0.94): Ask user first. Skip for scheduler (no one to ask).
    // Chip click ([RUN SOP] prefix): Auto-execute at confidence ≥ 0.5
    if (this.sopManager && this._executeSOP) {
      let sopMessage = message;
      let isSopChip = false;

      // Handle [RUN SOP] prefix from action chip — strip it and match the query
      const runSopMatch = message.match(/^\[RUN SOP\]\s*(.*)/i);
      if (runSopMatch) {
        sopMessage = runSopMatch[1].trim();
        isSopChip = true;
      }

      const sopMatch = this._matchTrainedSOP(sopMessage);
      if (sopMatch) {
        // Layer 1: Exact trigger match (0.95) or chip click → auto-execute
        if (sopMatch.confidence >= 0.95 || (isSopChip && sopMatch.confidence >= 0.5)) {
          this.onProgress(`Running matched procedure: ${sopMatch.reasoning}`);
          try {
            const sopId = sopMatch.handler.replace('sop:', '');
            const sop = this.sopManager.getSOP(sopId);
            if (sop) {
              const result = await this._executeSOP(sop, sopMessage);
              this.addToConversation(channelId, 'assistant', result.message || '', { type: 'sop_execution' });
              return {
                text: result.message,
                actions: [], data: result.data || {},
                thinking: [`Matched procedure: "${sop.name}" (${(sopMatch.confidence * 100).toFixed(0)}% confidence)`, 'Executing directly'],
                toolsUsed: [{ name: 'run_sop', displayName: 'Run SOP' }],
                metadata: { source: 'sop_preflight', sopId: sop.id, duration: Date.now() - startTime }
              };
            }
          } catch (err) {
            this.onProgress(`Procedure failed, routing to Ace: ${err.message}`);
            // Fall through to UnifiedAgent
          }
        }
        // Layer 2: Word overlap match (0.7+) — ask user first (interactive sessions only)
        else if (sopMatch.confidence >= 0.7 && source !== 'scheduler') {
          const sopId = sopMatch.handler.replace('sop:', '');
          const sop = this.sopManager.getSOP(sopId);
          if (sop) {
            const sopName = sop.name || sopId;
            this.addToConversation(channelId, 'assistant', `I found a matching process: **${sopName}**`, { type: 'sop_suggestion' });
            return {
              text: `I found a matching process: **${sopName}** (${sop.steps?.length || 0} steps). Want me to run it?`,
              actions: [], data: {},
              thinking: [`Fuzzy SOP match: "${sopName}" (${(sopMatch.confidence * 100).toFixed(0)}% confidence)`, 'Asking user to confirm'],
              question: {
                options: [
                  { id: 1, label: 'Yes, run it', description: `Execute "${sopName}"` },
                  { id: 2, label: 'No, just answer my question', description: 'Skip the process' },
                ],
                allowCustom: true,
              },
              metadata: { source: 'sop_preflight_ask', sopId: sop.id, duration: Date.now() - startTime }
            };
          }
        }
        // Scheduler + fuzzy match → skip SOP, let AI handle it
      }
    }

    // ═══ UNIFIED AGENT — Everything else goes through Gemini ═══
    // Gemini sees the full conversation, has SOP tools (list/run/update/create),
    // and decides what to do. SOPs are listed in the system prompt.
    if (this.unifiedAgent) {
      try {
        const conv = this.conversations.get(channelId);
        const history = (Array.isArray(conv) ? conv : []).slice(-25);

        // Detect training intent — signals UnifiedAgent to follow interview protocol
        const trainingMode = /\b(teach|train|learn)\b/i.test(message) ||
            /\bremember\s+(this|that|how|to|when|the)\b/i.test(message) ||
            /\bcreate\s+(a\s+)?(procedure|playbook|workflow|sop)\b/i.test(message) ||
            /\bshow\s+you\s+(how|my)\b/i.test(message);

        const result = await this.unifiedAgent.process(message, history, {
          channelId, userName, source, trainingMode
        });

        if (result) {
          this.addToConversation(channelId, 'assistant', result.text || '', {
            type: 'unified_response'
          });
          await this.learnFromInteraction(channelId, message, result.text || '', 'unified');

          return {
            text: result.text,
            actions: result.actions || [],
            data: result.data || {},
            thinking: result.thinking || ['🧠 UnifiedAgent'],
            toolsUsed: result.toolsUsed || [],
            question: result.question || null,
            pendingActions: result.pendingActions || null,
            metadata: { source: 'unified', duration: Date.now() - startTime }
          };
        }
      } catch (unifiedErr) {
        const errMsg = (unifiedErr.message || '').toLowerCase();
        // Detect quota/rate limit errors and give the user a helpful response
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate') ||
            errMsg.includes('resource_exhausted') || errMsg.includes('too many requests') ||
            errMsg.includes('exceeded') || errMsg.includes('limit')) {
          const quotaMsg = `I've hit the API rate limit. This usually means the free tier quota has been reached for now.

**Here's how to fix it:**

1. Click the **⚙️ Settings** tab (bottom left of the sidebar)
2. Scroll down to **AI Providers** — you'll see Gemini, OpenAI, Claude, and Ollama
3. Make sure **Gemini** shows a green **"Active"** badge. If not, click **"Set Up"** to add your key, or click the Gemini card to make it active.
4. Then scroll down to **Task Routing** — this is where you pick which AI handles each type of task (General, Code, Vision, Research)
5. In each dropdown, make sure **Gemini** is selected

**If it keeps happening:**

- **Wait a few minutes** — Free tier limits reset quickly
- **Upgrade to Tier 1** — Go to [Google AI Studio](https://aistudio.google.com) → click your profile → Billing. Adding a credit card unlocks much higher limits.
- **Add a backup provider** — In Settings → AI Providers, click "Set Up" on OpenAI or Claude to add a second API key. Then in Task Routing, you can assign different providers to different tasks.

I'll be ready to help as soon as the limit resets!`;
          this.addToConversation(channelId, 'assistant', quotaMsg, { type: 'quota_error' });
          return {
            text: quotaMsg,
            actions: [],
            data: {},
            thinking: ['API quota/rate limit reached — showing upgrade guide'],
            metadata: { source: 'quota_error', duration: Date.now() - startTime }
          };
        }
        this.onProgress(`⚠️ UnifiedAgent error: ${unifiedErr.message}`);
      }
    }

    // ═══ FALLBACK: Simple AI conversation (no tools) ═══
    // Only reached if UnifiedAgent is not initialized (e.g., Gemini not configured)
    this.onProgress('🧠 Thinking...');
    const thoughtProcess = await this.assembleThought(channelId, message, context);
    const { systemPrompt, messages } = this.buildPrompt(channelId, message, thoughtProcess, context);

    let aiResponse;
    try {
      aiResponse = await this.callAI(systemPrompt, messages, context);
    } catch (err) {
      this.onProgress(`⚠️ AI error: ${err.message}`);
      aiResponse = this.generateFallbackResponse(message, thoughtProcess, userName);
    }

    const processed = this.postProcess(aiResponse, thoughtProcess);
    this.addToConversation(channelId, 'assistant', processed.text, {
      type: 'ai_response', provider: aiResponse?.provider
    });
    await this.learnFromInteraction(channelId, message, processed.text, 'conversation');

    return {
      text: processed.text,
      actions: processed.actions,
      data: processed.data,
      thinking: thoughtProcess.thinkingSteps,
      metadata: {
        source: 'ai',
        provider: aiResponse?.provider,
        model: aiResponse?.model,
        duration: Date.now() - startTime,
        contextTokens: thoughtProcess.contextSize
      }
    };
  }

  // ═══════════════════════════════════════════════════════
  // SOP MATCHING — Deterministic pre-flight check
  // ═══════════════════════════════════════════════════════

  /**
   * Match a message against trained SOPs using word overlap.
   * Moved from IntentRouter — this is the ONLY pre-AI check.
   */
  _matchTrainedSOP(message) {
    if (!this.sopManager) return null;

    const allSOPs = typeof this.sopManager.getAllSOPs === 'function'
      ? this.sopManager.getAllSOPs() : [];
    if (allSOPs.length === 0) return null;

    const lower = message.toLowerCase();
    const STOP_WORDS = new Set([
      'the','a','an','and','or','to','in','on','at','for','of','with','my','is',
      'it','how','can','you','look','up','search','find','get','go','do','use',
      'please','help','me','this','that','into','as','be','our','just','also',
      'run','open','start','launch','execute','trigger','ace','hey','could','would'
    ]);
    const cleanLower = lower.replace(/[?.!,;:'"()\[\]{}]/g, '');
    const msgWords = cleanLower.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    if (msgWords.length === 0) return null;

    let bestMatch = null;
    let bestRatio = 0;

    for (const sop of allSOPs) {
      if (sop.enabled === false) continue;

      // Layer 1: Explicit trigger phrases (exact substring match)
      if (sop.triggers?.length > 0) {
        for (const trigger of sop.triggers) {
          if (trigger.length >= 4 && lower.includes(trigger.toLowerCase())) {
            return {
              handler: `sop:${sop.id}`,
              confidence: 0.95,
              reasoning: `Trigger match: "${trigger}" → SOP "${sop.name}"`
            };
          }
        }
      }

      // Layer 2: Word overlap on SOP name + keywords
      const sopClean = sop.name.toLowerCase().replace(/[?.!,;:'"()\[\]{}]/g, '');
      const nameWords = sopClean.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
      const kwWords = (sop.keywords || []).map(k => k.toLowerCase()).filter(w => w.length > 2 && !STOP_WORDS.has(w));
      const sopWords = [...nameWords];
      for (const kw of kwWords) {
        if (!sopWords.includes(kw)) sopWords.push(kw);
      }
      if (sopWords.length === 0) continue;

      const overlap = sopWords.filter(sw =>
        msgWords.some(mw => this._stemMatch(sw, mw))
      ).length;
      const ratio = overlap / sopWords.length;

      if (ratio >= 0.5 && overlap >= 3 && ratio > bestRatio) {
        bestRatio = ratio;
        bestMatch = {
          handler: `sop:${sop.id}`,
          confidence: Math.min(0.7 + ratio * 0.25, 0.95),
          reasoning: `Name/keyword match: ${overlap}/${sopWords.length} words (${(ratio*100).toFixed(0)}%) → SOP "${sop.name}"`
        };
      }
    }

    return bestMatch;
  }

  /**
   * Stem/prefix matching — returns true if two words share the same root.
   */
  _stemMatch(a, b) {
    if (a === b) return true;
    // Don't stem-match across dots (e.g., "facebook.com" should NOT match "faces")
    if (a.includes('.') || b.includes('.')) {
      return a.startsWith(b) || b.startsWith(a);
    }
    const minLen = Math.min(a.length, b.length);
    if (minLen >= 5 && (a.startsWith(b) || b.startsWith(a))) return true;
    let shared = 0;
    for (let i = 0; i < minLen; i++) {
      if (a[i] === b[i]) shared++;
      else break;
    }
    if (shared >= 5 && shared >= minLen * 0.75) return true;
    return false;
  }

  // ═══════════════════════════════════════════════════════
  // STEP 1: THINK — Context Assembly & Reasoning
  // ═══════════════════════════════════════════════════════

  /**
   * Assemble all relevant context for reasoning about a message.
   * This is where the "intelligence" lives — gathering everything
   * the AI needs to give a brilliant response.
   */
  async assembleThought(channelId, message, context) {
    const thought = {
      thinkingSteps: [],
      contextSections: [],
      relevantSkills: [],
      relevantSOPs: [],
      relevantKnowledge: [],
      pipelineState: null,
      conversationSummary: null,
      userPatterns: null,
      suggestedApproach: null,
      structuredItems: null,
      previousStructuredItems: null,
      persona: null,
      entities: null,
      contextSize: 0
    };

    const lower = message.toLowerCase();

    // 0a. Detect active persona based on message content
    const detectedPersona = this.detectPersona(message);
    if (detectedPersona) {
      thought.persona = detectedPersona;
      thought.thinkingSteps.push(`🎭 Active persona: ${detectedPersona.name}`);
    }
    
    // 0c. Add Business Profile context
    if (this.businessProfile) {
        const businessContext = this.businessProfile.getContextSummary();
        if (businessContext && !businessContext.includes('No business profile set')) {
            thought.thinkingSteps.push('📈 Adding business profile context');
            thought.businessContext = businessContext;
        }
    }

    // 0b. Extract entities from the message
    const entities = this.extractEntities(message);
    const entityCount = Object.values(entities).reduce((sum, arr) => sum + arr.length, 0);
    if (entityCount > 0) {
      thought.entities = entities;
      thought.thinkingSteps.push(`🔍 Extracted ${entityCount} entities from message`);
    }

    // 1. Analyze conversation history for this channel
    const history = this.getConversation(channelId);
    if (history.length > 0) {
      const recentTopics = history
        .filter(m => m.role === 'user')
        .slice(-5)
        .map(m => m.content.substring(0, 100));
      
      thought.conversationSummary = {
        messageCount: history.length,
        recentTopics,
        isOngoing: history.length > 2
      };
      thought.thinkingSteps.push(`📜 Conversation context: ${history.length} messages, ongoing discussion`);
    }

    // 2. Search knowledge base for relevant memories
    if (this.knowledgeBase) {
      try {
        const knowledge = await this.knowledgeBase.search(message, 5);
        if (knowledge.length > 0) {
          thought.relevantKnowledge = knowledge;
          thought.thinkingSteps.push(`💡 Found ${knowledge.length} relevant memories in knowledge base`);
        }
      } catch (e) { /* knowledge not available */ }
    }

    // 3. Check for matching SOPs (learned procedures)
    if (this.sopManager) {
      const allSOPs = this.sopManager.getAllSOPs();
      // Find SOPs that might be relevant (not just exact matches)
      const relevantSOPs = allSOPs.filter(sop => {
        const sopLower = `${sop.name} ${sop.description} ${(sop.triggers || []).join(' ')} ${(sop.keywords || []).join(' ')}`.toLowerCase();
        const words = lower.split(/\s+/).filter(w => w.length > 3);
        return words.some(w => sopLower.includes(w));
      });
      
      if (relevantSOPs.length > 0) {
        thought.relevantSOPs = relevantSOPs;
        thought.thinkingSteps.push(`📋 ${relevantSOPs.length} relevant SOPs: ${relevantSOPs.map(s => s.name).join(', ')}`);
      }
    }

    // 4. Check for matching skills (use smart matching)
    if (this.skillsManager) {
      const matchedSkill = this.skillsManager.findMatchingSkill(message);
      if (matchedSkill) {
        thought.matchedSkill = matchedSkill;
        thought.thinkingSteps.push(`⚡ Best matching skill: "${matchedSkill.name}" — will use for enhanced response`);
      }
      
      // Also do the broader relevance check for context
      const allSkills = this.skillsManager.getAllSkills();
      const relevantSkills = allSkills.filter(skill => {
        const skillLower = `${skill.name} ${skill.description} ${(skill.examples || []).join(' ')}`.toLowerCase();
        const words = lower.split(/\s+/).filter(w => w.length > 3);
        return words.some(w => skillLower.includes(w));
      });
      
      if (relevantSkills.length > 0) {
        thought.relevantSkills = relevantSkills;
        thought.thinkingSteps.push(`⚡ ${relevantSkills.length} relevant skills available: ${relevantSkills.map(s => s.name).join(', ')}`);
      }
    }

    // 4b. Check if ResearchAgent is available for web research
    if (this.researchAgent) {
      thought.researchAvailable = true;
      if (/\b(research|look up|look into|investigate|search|find out|pull up|google)\b/i.test(message)) {
        thought.thinkingSteps.push('🌐 ResearchAgent available — can do REAL web research if needed');
      }
    }

    // 5. Get pipeline state if relevant
    if (this.pipelineManager) {
      try {
        const pipeline = await this.pipelineManager.getPipeline();
        const tasks = pipeline.items || [];
        const leads = pipeline.leads || [];
        
        thought.pipelineState = {
          taskCount: tasks.length,
          leadCount: leads.length,
          tasksByStage: this.groupBy(tasks, 'stage'),
          leadsByStage: this.groupBy(leads, 'stage'),
          recentTasks: tasks.slice(-3),
          recentLeads: leads.slice(-3)
        };
        
        if (tasks.length > 0 || leads.length > 0) {
          thought.thinkingSteps.push(`📊 Pipeline: ${tasks.length} tasks, ${leads.length} leads`);
        }
      } catch (e) { /* pipeline not available */ }
    }

    // 6. Check Google integration status
    if (this.google?.isConnected()) {
      thought.thinkingSteps.push('📧 Google connected (Gmail, Calendar available)');
    }

    // 7. Analyze user's intent and suggest approach
    thought.suggestedApproach = this.analyzeApproach(message, thought);
    thought.thinkingSteps.push(`🎯 Approach: ${thought.suggestedApproach}`);

    // 8. Check learnings for relevant patterns
    const relevantLearnings = this.learnings.filter(l => {
      const lLower = `${l.topic} ${l.insight}`.toLowerCase();
      return lower.split(/\s+/).filter(w => w.length > 3).some(w => lLower.includes(w));
    }).slice(0, 3);
    
    if (relevantLearnings.length > 0) {
      thought.thinkingSteps.push(`🧠 ${relevantLearnings.length} past learnings are relevant`);
    }

    // 9. CRITICAL: Extract structured items (events, dates, etc.) from the message
    const structuredItems = this.extractStructuredItems(message);
    if (structuredItems.count >= 2) {
      thought.structuredItems = structuredItems;
      thought.thinkingSteps.push(`📅 MULTI-ITEM DETECTED: ${structuredItems.summary}`);
      thought.thinkingSteps.push(`⚠️ IMPORTANT: User provided ${structuredItems.count} items — MUST address ALL of them, not just one`);
    }

    // 10. Check for follow-up references to previous structured items
    const isFollowUp = /\b(other|rest|remaining|what about|same\s+(?:for|with|thing)|all\s+(?:of\s+)?(?:the|them|those)|each\s+(?:of\s+)?(?:the|them|those))\b/i.test(message);
    if (isFollowUp && !thought.structuredItems) {
      const previousItems = this.findPreviousStructuredItems(channelId);
      if (previousItems && previousItems.count >= 2) {
        thought.previousStructuredItems = previousItems;
        thought.thinkingSteps.push(`🔄 FOLLOW-UP detected — user is referring to ${previousItems.count} items from earlier: ${previousItems.summary}`);
        thought.thinkingSteps.push(`⚠️ MUST apply the same treatment to ALL ${previousItems.count} items`);
      }
    }

    // Calculate approximate context size
    thought.contextSize = JSON.stringify(thought).length;

    return thought;
  }

  /**
   * Analyze the best approach for responding to a message
   */
  analyzeApproach(message, thought) {
    const lower = message.toLowerCase();

    // Quick action patterns
    if (/\b(log\s*in|login|sign\s*in)\b.*\b(to|into)\b/i.test(message) || /\blikemindedpro\b/i.test(message)) {
      return 'Browser automation — login via SOP execution, navigate site, interact with dashboard';
    }
    if (/\b(start|begin)\s+(the|my)?\s*(day|morning|routine|work)\b/i.test(message)) {
      return 'Daily routine — execute morning startup SOPs (login, check dashboard, prepare for the day)';
    }
    if (/\b(go to|navigate|open|browse|visit|pull up)\b.*\b(site|website|page|url|\.com|\.org|\.net|\.io|\.pro|\.co|\.app|\.dev|\.ai)\b/i.test(message) || /https?:\/\//i.test(message)) {
      return 'Browser action — navigate to URL, explore page, interact as needed';
    }
    if (/\b(run|execute|do|perform)\b.*\b(sop|procedure|workflow|routine|automation)\b/i.test(message)) {
      return 'SOP execution — run a stored procedure through the browser';
    }
    if (/\b(add|create|make|new)\b.*\b(task|lead|contact)\b/i.test(message)) {
      return 'Direct action — add to pipeline immediately';
    }
    if (/\b(find|search|get)\b.*\b(leads?|contacts?|businesses)\b/i.test(message)) {
      return 'Lead generation — search and add to pipeline';
    }
    if (/\b(send|draft|compose|write)\b.*\b(email|mail)\b/i.test(message)) {
      return 'Email action — compose and send';
    }
    if (/\b(strategy|plan|roadmap|campaign)\b/i.test(message)) {
      // Check if it's a multi-item strategy request
      if (thought.structuredItems?.count >= 2) {
        return `Strategic thinking — create detailed plan for ALL ${thought.structuredItems.count} items/events. MUST cover every single one.`;
      }
      return 'Strategic thinking — create detailed plan with actionable steps';
    }
    if (/\b(show|status|check|what|how many)\b.*\b(pipeline|tasks?|leads?)\b/i.test(message)) {
      return 'Status report — pull live data and present clearly';
    }
    if (/\b(research|look into|investigate|analyze)\b/i.test(message)) {
      return 'Research mode — gather data, analyze, and present findings';
    }
    if (/\b(teach|train|learn|sop)\b/i.test(message) ||
        /\bremember\s+(this|that|how|to|when|the)\b/i.test(message)) {
      return 'Learning mode — absorb new procedure or information';
    }
    if (/\b(schedule|meeting|calendar|book)\b/i.test(message)) {
      return 'Calendar action — schedule or check availability';
    }

    // Check for multi-item requests that might not match other patterns
    if (thought.structuredItems?.count >= 2) {
      return `Multi-item request — ${thought.structuredItems.count} items detected. MUST address ALL of them with equal detail.`;
    }

    // Check if it's a follow-up referencing previous structured items
    if (thought.previousStructuredItems?.count >= 2) {
      return `Follow-up on ${thought.previousStructuredItems.count} previous items — apply same treatment to ALL of them.`;
    }

    // Check if it's a follow-up to an ongoing conversation
    if (thought.conversationSummary?.isOngoing) {
      return 'Continue conversation — build on previous context';
    }

    return 'Conversational — understand intent, provide value, suggest actions';
  }

  // ═══════════════════════════════════════════════════════
  // STEP 3: PLAN — Prompt Construction
  // ═══════════════════════════════════════════════════════

  /**
   * Build the complete prompt with chain-of-thought reasoning
   * embedded into the system prompt. This is what makes Ace SMART.
   */
  buildPrompt(channelId, message, thought, context) {
    const userName = context.userName || 'Boss';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // ─── SYSTEM PROMPT: The DNA of Ace's Intelligence (from soul.json) ───
    let systemPrompt;

    if (_soul) {
      const si = _soul.core_identity;
      const ct = _soul.critical_thinking;
      const comm = _soul.communication_rules;
      const err = _soul.error_philosophy;
      const personality = _soul.personality;
      const adaptive = _soul.adaptive_execution;
      const growth = _soul.growth_mindset;
      const healing = _soul.self_healing;

      systemPrompt = `You are Ace — ${userName}'s autonomous AI Executive Assistant.

═══ WHO YOU ARE ═══
${si.who_i_am}
${si.relationship_to_user}
${si.emotional_baseline}

═══ HOW YOU THINK ═══
${ct.approach}
Principles:
${ct.principles.map(p => `- ${p}`).join('\n')}

When uncertain:
${ct.when_uncertain.map(u => `- ${u}`).join('\n')}

═══ HOW YOU COMMUNICATE ═══
${comm.format.map(f => `- ${f}`).join('\n')}
${comm.always_do.map(d => `- ${d}`).join('\n')}

Never say: ${comm.never_say.map(s => `"${s}"`).join(', ')}

Voice example (problem-solving): "${personality.voice.problem_solving_mode}"

═══ ERROR HANDLING ═══
- ${err.rule_1}
- ${err.rule_2}
- ${err.rule_3}
- ${err.rule_4}
- ${err.rule_5}

═══ ADAPTIVE EXECUTION ═══
${adaptive.philosophy}
${adaptive.general_fallback_rules.map(r => `- ${r}`).join('\n')}

Browser strategy: ${adaptive.browser_strategy.architecture}
Priority: ${adaptive.browser_strategy.priority_order.join(' → ')}

═══ SELF-HEALING ═══
${healing.philosophy}

═══ GROWTH MINDSET ═══
- ${growth.proactivity}
- ${growth.ownership}
- ${growth.self_improvement}`;
    } else {
      // Fallback if soul.json failed to load
      systemPrompt = `You are Ace — ${userName}'s autonomous AI Executive Assistant.
You are NOT a chatbot. You are a brilliant, proactive executive who THINKS deeply and ACTS decisively.
When ${userName} tells you something, you UNDERSTAND the deeper intent and ACT — not just respond.
You speak like a trusted human colleague, not a robot. You're direct but warm.
You NEVER say "I'm just an AI" or "I can't do that" — you find a way or ask ONE specific question.`;
    }

    systemPrompt += `\n

═══ YOUR CAPABILITIES ═══
You can ACTUALLY do these things (not just talk about them):
• Pipeline: Add tasks/leads, move stages, track progress, show status
• Lead Generation: Find real businesses, add to pipeline, draft outreach
• Email: Compose and send via Gmail (when connected)
• Calendar: Schedule meetings (when connected)
• Research: Deep-dive into topics, markets, competitors
• Strategy: Create detailed, actionable plans with timelines
• SOPs: Execute learned procedures step-by-step through the browser automatically
• Knowledge: Remember anything, recall past conversations
• Browser Automation: Open a REAL browser, navigate to ANY website, log in with stored credentials, click buttons, fill forms, read pages — you do this YOURSELF like a human at a computer
• Daily Routines: Start the day by logging into sites, checking dashboards, following morning SOPs
• Autonomous Action: When asked to "log into LikemindedPro" or "start the day", you IMMEDIATELY open a browser and execute the SOP — no questions, no delays

═══ CURRENT CONTEXT ═══
Date: ${dateStr} ${timeStr}`;

// ─── INJECT BUSINESS CONTEXT ───
if (thought.businessContext) {
    systemPrompt += `\n\n${thought.businessContext}`;
}

    // ─── INJECT PERSONA CONTEXT ───
    if (this.activePersona) {
      const persona = this.activePersona;
      systemPrompt += `\n\n## Active Executive Persona: ${persona.name}`;
      systemPrompt += `\nIdentity: ${persona.identity}`;
      systemPrompt += `\nExpertise: ${persona.expertise.join(', ')}`;
      systemPrompt += `\nKey Metrics: ${persona.metrics.join(', ')}`;
      systemPrompt += `\nCommunication Style: ${persona.communicationStyle.tone} - ${persona.communicationStyle.emphasis}`;
      systemPrompt += `\nDecision Framework: ${persona.decisionFramework.join('; ')}`;
      systemPrompt += `\nRespond in character as this executive role.\n`;
    }

    // ─── INJECT EXTRACTED ENTITIES CONTEXT ───
    if (thought.entities) {
      const ent = thought.entities;
      const sections = [];
      if (ent.people.length) sections.push(`People mentioned: ${ent.people.join(', ')}`);
      if (ent.companies.length) sections.push(`Companies: ${ent.companies.join(', ')}`);
      if (ent.money.length) sections.push(`Financial figures: ${ent.money.join(', ')}`);
      if (ent.deadlines.length) sections.push(`Deadlines: ${ent.deadlines.join(', ')}`);
      if (ent.urls.length) sections.push(`URLs: ${ent.urls.join(', ')}`);
      if (ent.technologies.length) sections.push(`Technologies: ${ent.technologies.join(', ')}`);
      if (ent.actionItems.length) sections.push(`Action items detected: ${ent.actionItems.join('; ')}`);
      if (sections.length > 0) {
        systemPrompt += `\n\n## Extracted Context\n${sections.join('\n')}`;
      }
    }

    // ─── INJECT LIVE CONTEXT ───

    // Pipeline state
    if (thought.pipelineState) {
      const ps = thought.pipelineState;
      let pipelineCtx = `\n\n📊 PIPELINE STATE: ${ps.taskCount} tasks, ${ps.leadCount} leads`;
      
      if (ps.taskCount > 0) {
        pipelineCtx += '\nTasks:';
        for (const [stage, items] of Object.entries(ps.tasksByStage)) {
          pipelineCtx += `\n  ${stage}: ${items.length} — ${items.slice(0, 3).map(t => t.title || t.name).join(', ')}${items.length > 3 ? '...' : ''}`;
        }
      }
      if (ps.leadCount > 0) {
        pipelineCtx += '\nLeads:';
        for (const [stage, items] of Object.entries(ps.leadsByStage)) {
          pipelineCtx += `\n  ${stage}: ${items.length} — ${items.slice(0, 3).map(l => l.name || l.company).join(', ')}${items.length > 3 ? '...' : ''}`;
        }
      }
      systemPrompt += pipelineCtx;
    }

    // Relevant SOPs — give Ace full awareness
    if (thought.relevantSOPs.length > 0) {
      systemPrompt += '\n\n📋 RELEVANT PROCEDURES (SOPs you know):';
      for (const sop of thought.relevantSOPs.slice(0, 3)) {
        systemPrompt += `\n• "${sop.name}": ${sop.description || 'No description'}`;
        if (sop.steps?.length > 0) {
          systemPrompt += ` (${sop.steps.length} steps — you can execute this)`;
        }
      }
    }

    // Active matched skill — tell AI to use this skill's instructions
    if (thought.matchedSkill) {
      const sk = thought.matchedSkill;
      systemPrompt += `\n\n⚡ ACTIVE SKILL MATCH: "${sk.name}"`;
      systemPrompt += `\nYou have a specialized skill that is DIRECTLY relevant to this request.`;
      systemPrompt += `\nDescription: ${sk.description}`;
      if (sk.prompt) {
        systemPrompt += `\nSkill Instructions:\n${sk.prompt}`;
      }
      systemPrompt += `\n\n🎯 USE THIS SKILL: Follow the skill instructions above to generate your response. This will produce a much better, more structured answer.`;
    }

    // Other relevant skills — give Ace awareness of available capabilities
    if (thought.relevantSkills.length > 0) {
      systemPrompt += '\n\n⚡ AVAILABLE SKILLS:';
      for (const skill of thought.relevantSkills.slice(0, 3)) {
        systemPrompt += `\n• ${skill.name}: ${skill.description}`;
        if (skill.examples?.length > 0) {
          systemPrompt += ` (triggers: ${skill.examples.slice(0, 2).join(', ')})`;
        }
      }
    }

    // Research Agent availability
    if (thought.researchAvailable) {
      systemPrompt += '\n\n🌐 RESEARCH CAPABILITY: You have a ResearchAgent that can perform LIVE web searches and scrape real pages. When the user asks you to research something, the ActionEngine will automatically use it. You can confidently say "I\'ll research that" knowing real web data will be gathered.';
    }

    // Knowledge — past learnings that are relevant
    if (thought.relevantKnowledge.length > 0) {
      systemPrompt += '\n\n💡 RELEVANT MEMORIES (things you remember):';
      for (const k of thought.relevantKnowledge.slice(0, 3)) {
        systemPrompt += `\n• ${k.content.substring(0, 200)}`;
      }
    }

    // Recent learnings
    const relevantLearnings = this.learnings.filter(l => {
      const lLower = `${l.topic} ${l.insight}`.toLowerCase();
      const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return words.some(w => lLower.includes(w));
    }).slice(0, 3);
    
    if (relevantLearnings.length > 0) {
      systemPrompt += '\n\n🧠 THINGS YOU\'VE LEARNED:';
      for (const l of relevantLearnings) {
        systemPrompt += `\n• ${l.topic}: ${l.insight}`;
      }
    }

    // Google status
    if (this.google?.isConnected()) {
      systemPrompt += '\n\n📧 Google is CONNECTED — you can send emails and schedule meetings.';
    }

    // Conversation summary
    if (thought.conversationSummary?.isOngoing) {
      systemPrompt += `\n\n📜 CONVERSATION: This is an ongoing conversation (${thought.conversationSummary.messageCount} messages). Recent topics: ${thought.conversationSummary.recentTopics.join(' | ')}`;
    }

    // ─── STRUCTURED ITEMS — Multi-Event/Multi-Item Context ───
    const activeItems = thought.structuredItems || thought.previousStructuredItems;
    if (activeItems && activeItems.count >= 2) {
      const isFromPrevious = !thought.structuredItems && thought.previousStructuredItems;
      systemPrompt += `\n\n🚨 CRITICAL — MULTI-ITEM REQUEST (${activeItems.count} ${activeItems.type.toUpperCase()}):`;
      if (isFromPrevious) {
        systemPrompt += `\nThe user is following up on ${activeItems.count} items from earlier in this conversation.`;
        systemPrompt += `\nYou MUST apply the same plan/strategy/response to ALL of them — not just one.`;
      } else {
        systemPrompt += `\nThe user provided ${activeItems.count} distinct items. You MUST create a complete response for EACH ONE.`;
        systemPrompt += `\nDo NOT focus on just one item. Do NOT pick a favorite. Cover ALL ${activeItems.count}.`;
      }
      systemPrompt += `\n\nHere are ALL ${activeItems.count} items:`;
      for (let i = 0; i < activeItems.items.length; i++) {
        const item = activeItems.items[i];
        systemPrompt += `\n\n--- Item ${i + 1} of ${activeItems.count} ---`;
        systemPrompt += `\nDate: ${item.date}`;
        systemPrompt += `\nName: ${item.name}`;
        if (item.venue) systemPrompt += `\nVenue: ${item.venue}`;
        if (item.address) systemPrompt += `\nAddress: ${item.address}`;
        if (item.city) systemPrompt += `\nCity: ${item.city}`;
      }
      systemPrompt += `\n\n⚠️ Your response MUST include a section for EACH of the ${activeItems.count} items above. If the user asked for a plan/campaign/strategy, create one for EVERY item, not just the first one.`;
    }

    // Suggested approach
    systemPrompt += `\n\n🎯 APPROACH FOR THIS MESSAGE: ${thought.suggestedApproach}`;

    // Scheduler context
    if (this.autonomousScheduler) {
      const schedulerSummary = this.autonomousScheduler.getSummary();
      if (schedulerSummary) {
        systemPrompt += `\n\n⏰ SCHEDULED ROUTINES:\n${schedulerSummary}`;
      }
    }

    // Browser/SOP context
    if (this.siteMemory) {
      const siteSummary = this.siteMemory.getSummary();
      if (siteSummary && !siteSummary.includes("don't know any")) {
        systemPrompt += `\n\n🌐 SITE KNOWLEDGE:\n${siteSummary}`;
      }
    }

    // ─── ACTION TAGS ───
    systemPrompt += `

═══ ACTION TAGS ═══
When you want to execute an action, include these tags in your response:
- [ACTION:add_task:{"title":"Task name","priority":"high"}]
- [ACTION:add_lead:{"name":"Name","company":"Co","source":"research"}]
- [ACTION:move_task:{"taskId":"id","stage":"in_progress"}]
- [ACTION:save_knowledge:{"topic":"topic","content":"what to remember"}]
- [ACTION:research:{"query":"search terms"}]
- [ACTION:browse:{"url":"https://...","task":"what to do"}]
- [ACTION:run_sop:{"sopId":"sop_login_likemindedpro","task":"log in and start the day"}]

You can include multiple ACTION tags. The system ACTUALLY executes them through a real browser and shows results.

═══ CRITICAL RULES ═══
1. ALWAYS bias toward ACTION over discussion
2. If you CAN do it, DO it — don't ask permission or give options
3. Reference past conversations and knowledge naturally
4. After completing something, suggest the logical NEXT step
5. Be warm and human, not corporate or robotic
6. If you need info, ask ONE specific question, then act
7. Think like a CEO's chief of staff — handle things so ${userName} doesn't have to
8. NEVER suggest external paid services, subscriptions, or third-party tools. You ARE the tool. Use YOUR built-in capabilities: ResearchAgent for web searches, BrowserAgent for browsing, Google Places API for leads, Pipeline for tracking. If you need data, GO GET IT yourself using your research and browser tools.
9. When providing research results, ALWAYS include real clickable URLs and links. Never give generic site names without actual links.
10. You can open a browser and literally Google things, scrape real estate sites, and pull real data. Use that power — don't tell the user to go do it themselves.
11. When asked to "log in" to a site, "start the day", or "open" a webapp — you IMMEDIATELY execute the matching SOP through the browser. No hesitation, no asking for permission. Just DO it.
12. You have stored credentials for known sites. Use them automatically when logging in.`;

    // ─── BUILD MESSAGES ───
    const history = this.getConversation(channelId);
    const recentHistory = history.slice(-12); // More context than before

    const messages = recentHistory.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

    // Ensure the latest message is included
    if (messages.length === 0 || messages[messages.length - 1].content !== message) {
      messages.push({ role: 'user', content: message });
    }

    return { systemPrompt, messages };
  }

  // ═══════════════════════════════════════════════════════
  // STEP 4: ACT — Call AI Provider
  // ═══════════════════════════════════════════════════════

  /**
   * Call the AI provider with the assembled prompt
   */
  async callAI(systemPrompt, messages, context) {
    if (!this.aiManager) {
      throw new Error('AI provider not available');
    }

    // Scale max_tokens when multi-item context is present
    const isMultiItem = systemPrompt.includes('MULTI-ITEM REQUEST');
    const maxTokens = isMultiItem ? 6000 : 2000;

    const provider = this.aiManager.activeProvider;

    try {
      // Route through AIProviderManager — handles all providers uniformly
      const response = await this.aiManager.chat(messages, {
        systemPrompt,
        maxTokens,
      });
      return {
        text: response.content || response.text || '',
        provider: response.provider || provider,
        model: response.model
      };
    } catch (err) {
      console.error(`AI call failed (${provider}):`, err.message);
      throw err;
    }
  }

  async callOllama(systemPrompt, messages, maxTokens = 2000) {
    const config = this.aiManager.config?.ai_providers?.providers?.ollama;
    const baseUrl = config?.base_url || 'http://localhost:11434/v1';
    const model = config?.model || 'llama3.2';

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: allMessages,
        temperature: 0.7,
        max_tokens: maxTokens
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return {
      text: data.choices[0]?.message?.content || '',
      provider: 'ollama',
      model
    };
  }

  async callOpenAI(systemPrompt, messages, maxTokens = 2000) {
    const OpenAI = (await import('openai')).default;
    const config = this.aiManager.config?.ai_providers?.providers?.openai;
    const openai = new OpenAI({ apiKey: config?.api_key });

    const completion = await openai.chat.completions.create({
      model: config?.model || 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: maxTokens
    });

    return {
      text: completion.choices[0]?.message?.content || '',
      provider: 'openai',
      model: config?.model || 'gpt-4o'
    };
  }

  async callClaude(systemPrompt, messages, maxTokens = 2000) {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const config = this.aiManager.config?.ai_providers?.providers?.claude;
    const anthropic = new Anthropic({ apiKey: config?.api_key });

    const response = await anthropic.messages.create({
      model: config?.model || 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages
    });

    return {
      text: response.content[0]?.text || '',
      provider: 'claude',
      model: config?.model
    };
  }

  async callGemini(systemPrompt, messages) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const config = this.aiManager.config?.ai_providers?.providers?.gemini;
    const genAI = new GoogleGenerativeAI(config?.api_key);

    const model = genAI.getGenerativeModel({
      model: config?.model || 'gemini-pro',
      systemInstruction: systemPrompt,
      // No generationConfig limits — Ace uses full Gemini defaults
    });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }))
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;

    return {
      text: response.text(),
      provider: 'gemini',
      model: config?.model
    };
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5: POST-PROCESS — Clean up and extract actions
  // ═══════════════════════════════════════════════════════

  /**
   * Post-process the AI response — extract actions, clean formatting
   */
  postProcess(aiResponse, thought) {
    let text = aiResponse?.text || '';
    const actions = [];
    const data = {};

    // Extract ACTION tags
    const actionRegex = /\[ACTION:(\w+):(\{[^}]+\})\]/g;
    let match;
    while ((match = actionRegex.exec(text)) !== null) {
      try {
        actions.push({
          type: match[1],
          data: JSON.parse(match[2]),
          raw: match[0]
        });
      } catch (e) {
        // Malformed action tag, skip
      }
    }

    // Remove action tags from display text
    text = text.replace(actionRegex, '').trim();

    // Clean up any weird AI artifacts
    text = text.replace(/```json[\s\S]*?```/g, ''); // Remove JSON blocks that leaked
    text = text.replace(/\n{3,}/g, '\n\n'); // Max double newlines

    return { text, actions, data };
  }

  // ═══════════════════════════════════════════════════════
  // STEP 5c: EXECUTE ACTION TAGS from AI response
  // ═══════════════════════════════════════════════════════

  /**
   * Summarize real page content from a browse action using AI.
   * This prevents hallucination by grounding the AI response in ACTUAL page data.
   *
   * @param {object} browseData - Data from execBrowse() including pageContent
   * @param {string} userMessage - The user's original message/question
   * @param {string} userName - The user's name
   * @returns {string} AI-generated summary based on real page content
   */
  async summarizeBrowseContent(browseData, userMessage, userName) {
    const pageContent = browseData.pageContent;
    if (!pageContent) {
      return 'I navigated to the page but could not extract text content for analysis.';
    }

    // Build a structured representation of the page content for the AI
    let pageContext = '';
    
    if (pageContent.headings && pageContent.headings.length > 0) {
      pageContext += '## Page Headings:\n';
      pageContent.headings.forEach(h => {
        pageContext += `${'#'.repeat(h.level)} ${h.text}\n`;
      });
      pageContext += '\n';
    }

    if (pageContent.eventCards && pageContent.eventCards.length > 0) {
      pageContext += '## Events/Cards Found:\n';
      pageContent.eventCards.forEach((card, i) => {
        pageContext += `--- Event ${i + 1} ---\n`;
        if (card.title) pageContext += `Title: ${card.title}\n`;
        if (card.date) pageContext += `Date: ${card.date}\n`;
        if (card.description) pageContext += `Description: ${card.description}\n`;
        if (card.location) pageContext += `Location: ${card.location}\n`;
        if (card.fullText) pageContext += `Full Text: ${card.fullText}\n`;
        pageContext += '\n';
      });
    }

    if (pageContent.dates && pageContent.dates.length > 0) {
      pageContext += '## Dates Found on Page:\n';
      pageContent.dates.forEach(d => {
        pageContext += `• ${d}\n`;
      });
      pageContext += '\n';
    }

    if (pageContent.listItems && pageContent.listItems.length > 0) {
      pageContext += '## List Items:\n';
      pageContent.listItems.slice(0, 30).forEach(item => {
        pageContext += `• ${item}\n`;
      });
      pageContext += '\n';
    }

    if (pageContent.paragraphs && pageContent.paragraphs.length > 0) {
      pageContext += '## Page Text Content:\n';
      pageContent.paragraphs.slice(0, 20).forEach(p => {
        pageContext += `${p}\n\n`;
      });
    }

    // Include raw text as fallback context (truncated)
    if (pageContent.rawText) {
      pageContext += '\n## Raw Page Text (for reference):\n';
      pageContext += pageContent.rawText.substring(0, 4000) + '\n';
    }

    const systemPrompt = `You are Ace, an AI assistant. You just navigated to a web page and extracted its content.
Your job is to analyze the REAL page content below and answer the user's question ACCURATELY.

CRITICAL RULES:
- ONLY report information that is ACTUALLY present in the page content below
- Do NOT make up, guess, or hallucinate any information
- If you cannot find what the user is asking about, say so honestly
- Format your response clearly with dates, titles, and details from the REAL data
- If the page content seems sparse or missing the requested info, mention that the page may require scrolling, login, or JavaScript rendering

═══ REAL PAGE CONTENT FROM ${browseData.url} ═══
Page Title: ${browseData.title || 'Unknown'}

${pageContext}
═══ END OF PAGE CONTENT ═══`;

    const messages = [
      { role: 'user', content: userMessage }
    ];

    try {
      const aiResult = await this.callAI(systemPrompt, messages, {});
      return aiResult?.text || 'I was unable to analyze the page content.';
    } catch (err) {
      this.onProgress(`⚠️ AI summarization error: ${err.message}`);
      // Fallback: return a basic summary from the raw data
      let fallback = 'Here is what I found on the page:\n\n';
      if (pageContent.headings?.length > 0) {
        fallback += '**Headings:** ' + pageContent.headings.map(h => h.text).join(', ') + '\n\n';
      }
      if (pageContent.dates?.length > 0) {
        fallback += '**Dates found:** ' + pageContent.dates.join(', ') + '\n\n';
      }
      if (pageContent.eventCards?.length > 0) {
        fallback += '**Events:**\n';
        pageContent.eventCards.forEach(card => {
          fallback += `• ${card.title || 'Untitled'} ${card.date ? '— ' + card.date : ''}\n`;
        });
      }
      return fallback;
    }
  }

  /**
   * Execute ACTION tags extracted from AI response.
   * This is what makes the AI's suggestions ACTUALLY happen.
   *
   * Supports: browse, run_sop, add_task, add_lead, save_knowledge, research
   */
  async executeActionTags(actions) {
    const results = [];

    for (const action of actions) {
      try {
        let result = null;
        let success = false;
        let summary = '';

        switch (action.type) {
          case 'browse': {
            if (!this.browserAgent) break;
            const url = action.data.url;
            if (url) {
              this.onProgress(`🌐 Opening: ${url}`);
              const navResult = await this.browserAgent.navigateTo(url);
              const exploration = await this.browserAgent.explorePage();
              if (this.siteMemory) {
                await this.siteMemory.rememberSite(url, exploration);
              }
              result = navResult;
              success = true;
              summary = `Navigated to ${navResult.title || url}`;
            }
            break;
          }

          case 'run_sop': {
            if (!this.sopExecutor || !this.sopManager) break;
            const sopId = action.data.sopId || action.data.id;
            const sop = sopId ? this.sopManager.getSOP(sopId) :
                        this.sopManager.findSOPByIntent(action.data.task || action.data.name || '');
            if (sop) {
              this.onProgress(`🚀 Executing SOP: ${sop.name}`);
              result = await this.sopExecutor.executeSOP(sop, action.data.variables || {});
              success = result.success;
              summary = `${sop.name}: ${result.stepsCompleted}/${result.totalSteps} steps`;
            }
            break;
          }

          case 'add_task': {
            if (!this.actionEngine) break;
            result = await this.actionEngine.execAddTask(action.data);
            success = result.success;
            summary = `Added task: "${action.data.title}"`;
            break;
          }

          case 'add_lead': {
            if (!this.actionEngine) break;
            result = await this.actionEngine.execAddLead(action.data);
            success = result.success;
            summary = `Added lead: "${action.data.name}"`;
            break;
          }

          case 'save_knowledge': {
            if (!this.knowledgeBase) break;
            await this.knowledgeBase.learn(action.data.topic, action.data.content);
            success = true;
            summary = `Saved: "${action.data.topic}"`;
            break;
          }

          case 'research': {
            if (!this.actionEngine) break;
            result = await this.actionEngine.execResearch({ query: action.data.query });
            success = result.success;
            summary = `Researched: "${action.data.query?.substring(0, 40)}..."`;
            break;
          }

          case 'move_task': {
            if (!this.actionEngine) break;
            result = await this.actionEngine.execMoveTask(action.data);
            success = result.success;
            summary = `Moved task to ${action.data.stage}`;
            break;
          }

          case 'code': {
            try {
              const parsedData = action.data;
              if (this.agentOrchestrator) {
                this.onProgress(`🔧 Routing code action to AgentOrchestrator...`);
                result = await this.agentOrchestrator.routeTask({ type: 'code', ...parsedData });
                success = true;
                summary = `Code action executed: ${parsedData.task || parsedData.description || 'code task'}`;
              } else {
                success = false;
                summary = 'Code agent not available. Please ensure AgentOrchestrator is initialized.';
                this.onProgress(`[AceBrain] ${summary}`);
              }
            } catch (codeErr) {
              success = false;
              summary = `Code action failed: ${codeErr.message}`;
              this.onProgress(`[AceBrain] ❌ Code action error: ${codeErr.message}`);
            }
            break;
          }

          default:
            this.onProgress(`  ⚠️ Unknown action type: ${action.type}`);
        }

        results.push({
          type: action.type,
          success,
          summary,
          result
        });
      } catch (error) {
        this.onProgress(`  ❌ Action ${action.type} failed: ${error.message}`);
        results.push({
          type: action.type,
          success: false,
          summary: `Failed: ${error.message}`,
          result: null
        });
      }
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════
  // STEP 6: LEARN — Extract insights after every interaction
  // ═══════════════════════════════════════════════════════

  /**
   * Learn from every interaction — build Ace's institutional memory
   */
  async learnFromInteraction(channelId, userMessage, aceResponse, interactionType, actionData = null) {
    // Quick extraction of learnable content
    const lower = userMessage.toLowerCase();
    
    // Learn user preferences and patterns
    if (lower.includes('i prefer') || lower.includes('i like') || lower.includes('always') || lower.includes('remember that')) {
      const learning = {
        type: 'preference',
        topic: 'user_preference',
        insight: userMessage.substring(0, 200),
        source: channelId,
        learnedAt: new Date().toISOString()
      };
      this.learnings.push(learning);
      await this.saveLearnings();
      
      // Also save to knowledge base
      if (this.knowledgeBase) {
        await this.knowledgeBase.learn(`User preference: ${userMessage.substring(0, 100)}`, aceResponse.substring(0, 200));
      }
    }

    // Detect and save corrections via CorrectionMemory
    if (this.correctionMemory && CorrectionMemory.isCorrection(userMessage)) {
      try {
        await this.correctionMemory.saveCorrection(aceResponse, userMessage, {
          topic: '',
          department: interactionType,
          channelId,
        });
        console.log(`📝 [AceBrain] Correction detected and saved from channel ${channelId}`);
      } catch (e) {
        console.log(`[AceBrain] Failed to save correction: ${e.message}`);
      }
    }

    if (interactionType === 'desktop_action' && actionData) {
      const newSOP = {
        id: `sop_${Date.now()}`,
        name: `Desktop Action: ${userMessage}`,
        description: `An automatically learned SOP for the task: "${userMessage}"`,
        category: 'custom',
        triggers: [userMessage],
        keywords: userMessage.toLowerCase().split(' '),
        steps: [actionData],
        enabled: true,
      };
      await this.sopManager.createSOP(newSOP);
    }

    // Learn from teaching interactions
    if (interactionType === 'conversation' && this.knowledgeBase) {
      // Periodically save conversation knowledge (every 5th message)
      const history = this.getConversation(channelId);
      if (history.length % 5 === 0) {
        await this.knowledgeBase.learn(
          userMessage.substring(0, 200),
          aceResponse.substring(0, 300)
        );
      }
    }
  }

  /**
   * Load persistent learnings from disk
   */
  async loadLearnings() {
    try {
      const learningsPath = path.join(PROJECT_ROOT, 'data', 'knowledge', 'learnings.json');
      const data = await fs.readFile(learningsPath, 'utf8');
      this.learnings = JSON.parse(data);
      console.log(`🧠 Loaded ${this.learnings.length} past learnings`);
    } catch (e) {
      this.learnings = [];
    }
  }

  /**
   * Save learnings to disk
   */
  async saveLearnings() {
    try {
      const learningsPath = path.join(PROJECT_ROOT, 'data', 'knowledge', 'learnings.json');
      await fs.mkdir(path.dirname(learningsPath), { recursive: true });
      await fs.writeFile(learningsPath, JSON.stringify(this.learnings.slice(-this.maxGlobalMemory), null, 2));
    } catch (e) {
      console.error('Failed to save learnings:', e.message);
    }
  }

  // ═══════════════════════════════════════════════════════
  // CONVERSATION MEMORY MANAGEMENT
  // ═══════════════════════════════════════════════════════

  /**
   * Add a message to a channel's conversation history
   */
  addToConversation(channelId, role, content, metadata = {}) {
    if (!this.conversations.has(channelId)) {
      this.conversations.set(channelId, []);
    }

    const history = this.conversations.get(channelId);
    history.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    });

    // Trim to max history, but summarize first if needed
    if (history.length > this.maxHistoryPerChannel) {
      // Keep the summary + recent messages
      const oldMessages = history.splice(0, 10);
      const summary = this.summarizeMessages(oldMessages);
      history.unshift({
        role: 'system',
        content: `[Previous conversation summary: ${summary}]`,
        timestamp: new Date().toISOString(),
        metadata: { type: 'summary' }
      });
    }

    // Persist to disk (debounced)
    this._schedulePersist();
  }

  /**
   * Debounced conversation persistence — saves to disk every 2 seconds max
   */
  _schedulePersist() {
    if (this._persistTimer) return;
    this._persistTimer = setTimeout(async () => {
      this._persistTimer = null;
      await this._persistConversations();
    }, 2000);
  }

  async _persistConversations() {
    try {
      const serializable = {};
      for (const [channelId, history] of this.conversations.entries()) {
        // Only persist last 30 messages per channel to keep file manageable
        serializable[channelId] = history.slice(-30);
      }
      const filePath = path.join(process.cwd(), 'data', 'memory', 'conversations.json');
      await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
    } catch (e) {
      console.error('[AceBrain] Persist conversations failed:', e.message);
    }
  }

  async _loadPersistedConversations() {
    try {
      const filePath = path.join(process.cwd(), 'data', 'memory', 'conversations.json');
      const data = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(data);
      for (const [channelId, history] of Object.entries(parsed)) {
        this.conversations.set(channelId, history);
      }
      console.log(`[AceBrain] Loaded ${Object.keys(parsed).length} persisted conversations`);
    } catch {
      // No conversations file yet — first run
    }
  }

  /**
   * Get conversation history for a channel
   */
  getConversation(channelId) {
    return this.conversations.get(channelId) || [];
  }

  /**
   * Summarize a set of messages into a brief context string
   */
  summarizeMessages(messages) {
    const userMessages = messages.filter(m => m.role === 'user').map(m => m.content.substring(0, 80));
    const topics = userMessages.join(' | ');
    
    const actions = messages
      .filter(m => m.metadata?.type === 'action_engine')
      .map(m => m.metadata?.intent)
      .filter(Boolean);
    
    let summary = `Topics discussed: ${topics}`;
    if (actions.length > 0) {
      summary += `. Actions taken: ${actions.join(', ')}`;
    }
    
    return summary.substring(0, 500);
  }

  /**
   * Clear conversation for a channel
   */
  clearConversation(channelId) {
    this.conversations.delete(channelId);
  }

  // ═══════════════════════════════════════════════════════
  // FALLBACK RESPONSE GENERATION
  // ═══════════════════════════════════════════════════════

  /**
   * Generate a smart fallback response when AI is unavailable
   */
  generateFallbackResponse(message, thought, userName) {
    const lower = message.toLowerCase();

    // Use thought process to give relevant responses
    if (thought.suggestedApproach?.includes('action')) {
      return {
        text: `⚡ Got it, ${userName}. I'm processing your request now.\n\n` +
              `Working on: "${message.substring(0, 80)}"\n\n` +
              `I'll execute this and report back.`,
        provider: 'fallback'
      };
    }

    if (thought.suggestedApproach?.includes('Status')) {
      const ps = thought.pipelineState;
      if (ps) {
        return {
          text: `📊 **Pipeline Status**\n\n` +
                `📋 Tasks: ${ps.taskCount}\n` +
                `👥 Leads: ${ps.leadCount}\n\n` +
                `Want me to show details on any stage?`,
          provider: 'fallback'
        };
      }
    }

    if (thought.suggestedApproach?.includes('Strategic')) {
      return {
        text: `📋 Let me think about this strategically.\n\n` +
              `I'm building a plan for: "${message.substring(0, 100)}"\n\n` +
              `Give me a moment to research and outline the approach.`,
        provider: 'fallback'
      };
    }

    // Generic intelligent fallback
    return {
      text: `👋 Hey ${userName}, I hear you.\n\n` +
            `"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"\n\n` +
            `I'm processing this now. What's the priority here?`,
      provider: 'fallback'
    };
  }

  // ═══════════════════════════════════════════════════════
  // STRUCTURED ITEM EXTRACTION — Multi-Event/Multi-Item Intelligence
  // ═══════════════════════════════════════════════════════

  /**
   * Extract structured items (events, dates, locations, tasks) from a message.
   * This is CRITICAL for multi-item requests like "create a plan for all 5 meetups."
   *
   * Returns: { items: [...], type: 'events'|'tasks'|'items', count: N, summary: string }
   */
  extractStructuredItems(message) {
    const result = { items: [], type: 'items', count: 0, summary: '' };

    // ─── PATTERN: Event blocks (Date + Name + Venue/Address) ───
    // Matches patterns like:
    //   Feb 19
    //   LikeMinded - Tampa Real Estate Investor Meetup
    //   Lower Deck - 601 S Harbour Island Blvd ...
    const eventBlockRegex = /(?:^|\n)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}(?:\s*[-–,]\s*\d{1,2})?(?:\s*,?\s*\d{4})?)\s*\n\s*([^\n]+)(?:\n\s*([^\n]*(?:\d{3,5}\s+\w|\d{5}|FL|CA|TX|NY|GA|NC|OH|IL|PA|NJ|VA|WA|OR|CO|AZ|NV|UT|MA|MD|CT|SC|AL|TN|MN|WI|MO|IN|KY|LA|OK|AR|MS|KS|IA|NE|NM|HI|ID|ME|MT|NH|ND|RI|SD|VT|WV|WY)[^\n]*))?/gim;

    let match;
    while ((match = eventBlockRegex.exec(message)) !== null) {
      const date = match[1].trim();
      const name = match[2].trim().replace(/\s*Join\s*&?\s*Connect\s*/gi, '').trim();
      const venueAddress = match[3] ? match[3].trim().replace(/\s*Join\s*&?\s*Connect\s*/gi, '').trim() : '';
      
      // Parse venue and address
      let venue = '';
      let address = '';
      if (venueAddress) {
        const dashSplit = venueAddress.split(/\s*[-–]\s*/);
        if (dashSplit.length >= 2) {
          venue = dashSplit[0].trim();
          address = dashSplit.slice(1).join(' - ').trim();
        } else {
          venue = venueAddress;
        }
      }

      // Extract city from name or address
      let city = '';
      const cityFromName = name.match(/(?:Tampa|Miami|St\.?\s*Pet(?:e|ersburg)|Fort\s*Lauderdale|Orlando|O-Town|Jacksonville|Naples|Boca\s*Raton|West\s*Palm|Sarasota|Gainesville|Tallahassee|Daytona|Clearwater|Coral\s*Gables|Doral|Hialeah|Pompano|Hollywood|Delray|Boynton)/i);
      if (cityFromName) {
        city = cityFromName[0].replace(/O-Town/i, 'Orlando');
      } else {
        const cityFromAddr = address.match(/(?:Tampa|Miami|St\.?\s*Petersburg|Fort\s*Lauderdale|Orlando|Jacksonville)/i);
        if (cityFromAddr) city = cityFromAddr[0];
      }

      result.items.push({
        date,
        name,
        venue,
        address,
        city,
        fullText: match[0].trim()
      });
    }

    // ─── FALLBACK: Date-based extraction if event blocks didn't match ───
    if (result.items.length === 0) {
      const dateLineRegex = /(?:^|\n)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}(?:\s*,?\s*\d{4})?)\s*$/gim;
      const dateMatches = [...message.matchAll(dateLineRegex)];
      
      if (dateMatches.length > 1) {
        // Multiple dates found — try to extract surrounding context for each
        const lines = message.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const dateLine = lines[i].trim();
          if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}/i.test(dateLine)) {
            const nextLines = lines.slice(i + 1, i + 4).map(l => l.trim()).filter(l => l && !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}/i.test(l));
            const name = nextLines[0] || '';
            const venueAddress = nextLines[1] || '';
            
            let venue = '', address = '', city = '';
            if (venueAddress) {
              const dashSplit = venueAddress.split(/\s*[-–]\s*/);
              if (dashSplit.length >= 2) {
                venue = dashSplit[0].trim();
                address = dashSplit.slice(1).join(' - ').trim();
              } else {
                venue = venueAddress;
              }
            }
            
            const cityMatch = (name + ' ' + venueAddress).match(/(?:Tampa|Miami|St\.?\s*Pet(?:e|ersburg)|Fort\s*Lauderdale|Orlando|O-Town|Jacksonville)/i);
            if (cityMatch) city = cityMatch[0].replace(/O-Town/i, 'Orlando');

            result.items.push({
              date: dateLine,
              name: name.replace(/^Join\s*&\s*Connect\s*/i, '').trim() || `Event on ${dateLine}`,
              venue,
              address,
              city,
              fullText: [dateLine, name, venueAddress].filter(Boolean).join('\n')
            });
          }
        }
      }
    }

    // Determine type and count
    if (result.items.length > 0) {
      result.type = 'events';
      result.count = result.items.length;
      result.summary = `${result.count} events found: ${result.items.map(e => `${e.date} — ${e.city || e.name}`).join(', ')}`;
    }

    return result;
  }

  /**
   * Search conversation history for structured items from previous messages.
   * Used for follow-up context ("what about the other 4?")
   */
  findPreviousStructuredItems(channelId) {
    const history = this.getConversation(channelId);
    // Search backwards through user messages for structured items
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg.role === 'user') {
        const extracted = this.extractStructuredItems(msg.content);
        if (extracted.count >= 2) {
          return extracted;
        }
      }
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════

  /**
   * Group an array by a key
   */
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const group = item[key] || 'unknown';
      if (!acc[group]) acc[group] = [];
      acc[group].push(item);
      return acc;
    }, {});
  }

  /**
   * Get brain status for health checks
   */
  getStatus() {
    return {
      initialized: this.initialized,
      conversationCount: this.conversations.size,
      totalMessages: Array.from(this.conversations.values()).reduce((sum, c) => sum + c.length, 0),
      learningsCount: this.learnings.length,
      aiProvider: this.aiManager?.activeProvider || 'none'
    };
  }

  // ═══════════════════════════════════════════════════════
  // ENTITY EXTRACTION
  // ═══════════════════════════════════════════════════════

  /**
   * Extract entities (people, companies, money, deadlines, URLs, technologies, action items)
   * from a user message using regex patterns.
   *
   * @param {string} message - The user message to extract entities from
   * @returns {object} An object with arrays for each entity type
   */
  extractEntities(message) {
    const entities = {
      people: [],
      companies: [],
      money: [],
      deadlines: [],
      urls: [],
      technologies: [],
      actionItems: []
    };

    try {
      // People names — capitalized word pairs like "John Smith"
      const peopleMatches = message.match(/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g) || [];
      // Filter out common non-name patterns (month+day, common phrases)
      const nonNamePatterns = /^(New York|San Francisco|Los Angeles|Las Vegas|San Diego|Fort Lauderdale|West Palm|Boca Raton|Coral Gables|Next Week|Last Week|Good Morning|Happy Birthday|Thank You|No Problem|Of Course|In Progress|Per Cent|Real Estate)$/i;
      entities.people = [...new Set(peopleMatches.filter(p => !nonNamePatterns.test(p)))];

      // Company names — patterns like "X Corp", "X Inc", etc.
      const companyMatches = message.match(/\b[A-Z][a-zA-Z]*\s(?:Corp|Inc|LLC|Ltd|Company|Co|Group|Technologies|Tech|Solutions)\b/g) || [];
      entities.companies = [...new Set(companyMatches)];

      // Money amounts — $X, $X.XX, $XK, $XM, $XB
      const moneyMatches = message.match(/\$[\d,]+(?:\.\d{2})?(?:\s?[KkMmBb](?:illion)?)?/g) || [];
      entities.money = [...new Set(moneyMatches)];

      // Deadlines/dates — "by Friday", "due March 15", "before 12/31", etc.
      const deadlineMatches = message.match(/\b(?:by|before|until|due|deadline)\s+(?:[A-Z][a-z]+day|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|[A-Z][a-z]+\s+\d{1,2}(?:,?\s+\d{4})?|next\s+\w+|end\s+of\s+\w+)/gi) || [];
      const dateMatches = message.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi) || [];
      entities.deadlines = [...new Set([...deadlineMatches, ...dateMatches])];

      // URLs — http/https and domain patterns
      const urlMatches = message.match(/https?:\/\/[^\s]+/g) || [];
      const domainMatches = message.match(/\b[\w-]+\.(?:com|org|net|io|co|dev|app|ai|pro|me|us|biz|info)\b/g) || [];
      entities.urls = [...new Set([...urlMatches, ...domainMatches])];

      // Technologies — case-insensitive keyword matching
      const techKeywords = [
        'React', 'Node', 'Python', 'JavaScript', 'TypeScript', 'AWS', 'Docker',
        'Kubernetes', 'MongoDB', 'PostgreSQL', 'Redis', 'GraphQL', 'REST', 'API',
        'CSS', 'HTML', 'Vue', 'Angular', 'Next.js', 'Express', 'Django', 'Flask',
        'Git', 'CI/CD', 'Terraform', 'Vercel', 'Netlify', 'Firebase', 'Supabase',
        'Stripe', 'OAuth', 'JWT', 'WebSocket', 'Tailwind', 'Bootstrap'
      ];
      const lowerMsg = message.toLowerCase();
      entities.technologies = techKeywords.filter(tech => lowerMsg.includes(tech.toLowerCase()));

      // Action items — phrases starting with action verbs
      const actionMatches = message.match(/\b(?:need to|must|should|will|going to|have to|plan to|want to|please)\s+[^.!?\n]+/gi) || [];
      entities.actionItems = [...new Set(actionMatches.map(a => a.trim()))];
    } catch (err) {
      console.log(`[AceBrain] Entity extraction error: ${err.message}`);
    }

    return entities;
  }

  // ═══════════════════════════════════════════════════════
  // AGENT SETTERS
  // ═══════════════════════════════════════════════════════

  /**
   * Set the AgentOrchestrator reference for code action routing
   * @param {object} orchestrator - The AgentOrchestrator instance
   */
  setAgentOrchestrator(orchestrator) {
    this.agentOrchestrator = orchestrator;
    console.log('[AceBrain] AgentOrchestrator connected');
  }

  /**
   * Set the CodeAgent reference
   * @param {object} codeAgent - The CodeAgent instance
   */
  setCodeAgent(codeAgent) {
    this.codeAgent = codeAgent;
    // Update UnifiedAgent's subsystems if available
    if (this.unifiedAgent?.subsystems) {
      this.unifiedAgent.subsystems.codeAgent = codeAgent;
    }
    console.log('[AceBrain] CodeAgent connected');
  }

  /**
   * Generates a new skill by calling the CodeAgent.
   * @param {object} task - The sub-task description from TaskDecomposer.
   * @returns {string|null} The path to the new skill file, or null on failure.
   */
  async _generateNewSkill(task) {
    this.onProgress(`🤖 Calling CodeAgent to generate new skill for: "${task.description}"`);
    if (!this.codeAgent) {
      this.onProgress('⚠️ CodeAgent is not available. Cannot generate new skill.');
      return null;
    }

    const systemPrompt = `You are a 'Skill Generation Bot' for the OpenAce system. Your sole purpose is to create new skill JSON files. A user will provide a task description, and you must convert it into a valid OpenAce skill JSON object.

The JSON object MUST have the following structure:
{
  "id": "a-unique-slug-for-the-skill",
  "name": "Human-Readable Skill Name",
  "description": "A detailed description of what this skill does.",
  "category": "One of: 'marketing', 'operations', 'technical', 'business-strategy', 'general'",
  "role": "The executive persona most likely to use this skill. One of: 'CMO', 'COO', 'CTO', 'CEO'",
  "triggers": ["list", "of", "phrases", "that a user might say to activate this skill"],
  "data_requirements": [
    {
      "field": "input_field_name",
      "description": "Description of what this input field is for.",
      "required": true
    }
  ],
  "systemPrompt": "VERY detailed instructions for the AI on how to execute this skill. This is the most important part. It should be a complete prompt for another AI.",
  "outputFormat": "A description of what the final output of the skill should look like."
}

**CRITICAL RULES:**
1.  You MUST respond with ONLY the raw JSON content. No markdown, no explanations, no "Here is the JSON...".
2.  The \`id\` must be a kebab-case-slug.
3.  The \`systemPrompt\` should be comprehensive enough for another AI to perform the task without any other context.

---
**EXAMPLE**

**User Task:** "A skill to analyze a competitor's website for their marketing strategy."

**Your JSON Response:**
{
  "id": "competitor-marketing-analysis",
  "name": "Competitor Marketing Analysis",
  "description": "Analyzes a competitor's website to identify their marketing strategy, including target audience, key value propositions, and calls-to-action.",
  "category": "business-strategy",
  "role": "CMO",
  "triggers": ["analyze competitor", "competitor website analysis", "what is their marketing strategy"],
  "data_requirements": [
    {
      "field": "competitor_url",
      "description": "The full URL of the competitor's website.",
      "required": true
    }
  ],
  "systemPrompt": "You are a master marketing strategist. You will be given the URL of a competitor's website. Your task is to perform a thorough analysis of their marketing strategy based SOLELY on their website content. Navigate the site, analyze the homepage, about page, and product/service pages. Identify the following: 1. **Target Audience:** Who are they speaking to? (e.g., developers, small businesses, enterprise). 2. **Value Proposition:** What is their core promise? What pain point do they solve? 3. **Calls-to-Action (CTAs):** What are the primary actions they want users to take? (e.g., 'Request a Demo', 'Sign Up Free'). 4. **Tone of Voice:** Is it formal, casual, technical, playful? Present your findings in a structured report.",
  "outputFormat": "A markdown report with sections for 'Target Audience', 'Value Proposition', 'Primary CTAs', and 'Tone of Voice'."
}
---

Now, generate a skill for the following user task.`;

    try {
      // Assuming codeAgent has a method like `generateSkillFile` that takes a prompt.
      const response = await this.codeAgent.generateSkillFile(task.description, systemPrompt);
      
      let skillJson;
      try {
        // The agent should return raw JSON, but let's be safe
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON object found in the CodeAgent response.');
        }
        skillJson = JSON.parse(jsonMatch[0]);
      } catch (e) {
        this.onProgress(`⚠️ Failed to parse JSON from CodeAgent response: ${e.message}`);
        return null;
      }

      if (!skillJson.id || !skillJson.name || !skillJson.systemPrompt) {
          this.onProgress('⚠️ Generated skill JSON is missing required fields (id, name, systemPrompt).');
          return null;
      }

      const slug = skillJson.id.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filePath = path.join(PROJECT_ROOT, 'data', 'skills', `${slug}.json`);
      
      await fs.writeFile(filePath, JSON.stringify(skillJson, null, 2));
      
      return filePath;

    } catch (error) {
      this.onProgress(`❌ Error during skill generation: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate a browser automation SOP from natural language description.
   * "Teach by chat" — user describes steps, Ace creates a replayable SOP.
   *
   * @param {string} description - Natural language description of the workflow
   * @param {string} name - Optional SOP name
   * @returns {object|null} The created SOP or null on failure
   */
  async generateSOPFromChat(description, name = '') {
    if (!this.aiManager) {
      this.onProgress('⚠️ AI not available for SOP generation');
      return null;
    }

    this.onProgress(`🤖 Generating SOP from description: "${description.substring(0, 60)}..."`);

    const existingSOPs = this.sopManager ? this.sopManager.getAllSOPs().map(s => ({
      name: s.name, steps: (s.steps || []).slice(0, 3).map(st => st.action)
    })) : [];

    const prompt = `You are an SOP (Standard Operating Procedure) generator for browser automation.
Convert this natural language description into a structured SOP with browser automation steps.

DESCRIPTION: "${description}"

AVAILABLE STEP ACTIONS (16 types — use ONLY these):
- navigate: { action: "navigate", url: "https://...", description: "Go to ..." }
- click_text: { action: "click_text", text: "Button Text", description: "Click ..." }
- click_submit: { action: "click_submit", description: "Submit the form" }
- smart_click: { action: "smart_click", target: "describe what to click", description: "Click ..." }
- right_click: { action: "right_click", target: "element", description: "Right-click ..." }
- select_option: { action: "select_option", target: "dropdown name", text: "option to pick", description: "Select ..." }
- hover: { action: "hover", target: "menu item", description: "Hover over ..." }
- edit_field: { action: "edit_field", target: "field name", text: "value", description: "Type ... in ..." }
- type: { action: "type", text: "value", description: "Type ..." }
- press: { action: "press", key: "enter", description: "Press Enter" }
- scroll: { action: "scroll", direction: "down", description: "Scroll down" }
- switch_tab: { action: "switch_tab", target: "next", description: "Switch tab" }
- go_back: { action: "go_back", description: "Go back" }
- copy_text: { action: "copy_text", target: "email address", description: "Copy ..." }
- wait: { action: "wait", ms: 2000, description: "Wait for page" }
- wait_navigation: { action: "wait_navigation", description: "Wait for page to load" }

RULES:
- After every "navigate", add a "wait_navigation" step
- "Fill in X with Y" → edit_field (NOT type)
- "Log in" → edit_field for username + edit_field for password + click_submit
- After "type" used for search → add press "enter" + wait

EXISTING SOPS FOR REFERENCE:
${JSON.stringify(existingSOPs.slice(0, 5))}

Return ONLY a JSON object:
{
  "name": "SOP Name",
  "description": "What this SOP does",
  "category": "general|lead_generation|email|social",
  "triggerPatterns": ["keyword1", "keyword2"],
  "steps": [
    { "action": "navigate", "url": "...", "description": "..." },
    ...
  ]
}`;

    try {
      const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { provider: this.aiManager.getProviderForTask('research'), maxTokens: 1500 });
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        this.onProgress('⚠️ AI did not return valid JSON for SOP');
        return null;
      }

      const sopData = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!sopData.steps || !Array.isArray(sopData.steps) || sopData.steps.length === 0) {
        this.onProgress('⚠️ Generated SOP has no steps');
        return null;
      }

      // Normalize any legacy action types AI might still produce
      const ACTION_ALIASES = {
        navigate_to: 'click_text', click: 'click_text', smart_fill: 'edit_field',
        fill_form: 'edit_field', fill_credentials: 'edit_field', copy: 'copy_text',
        search_google: 'navigate', wait_for: 'wait', goBack: 'go_back', goto: 'navigate',
        key: 'press', extract: 'copy_text', extract_results: 'copy_text',
        screenshot: null, explore_page: null, decide: null, set_date: null,
      };
      sopData.steps = sopData.steps
        .map(step => {
          if (!step || !step.action) return null;
          const alias = ACTION_ALIASES[step.action];
          if (alias === null) return null;  // Dead action — remove
          if (alias === undefined) return step;  // Already unified
          const normalized = { ...step, action: alias };
          // Adapt fields for specific mappings
          if (step.action === 'navigate_to') normalized.text = step.section || step.target || '';
          if (step.action === 'click') normalized.text = step.text || step.selector || '';
          if (step.action === 'smart_fill') { normalized.target = step.context || ''; normalized.text = step.value || ''; }
          if (step.action === 'fill_credentials') { normalized.target = 'login credentials'; normalized.text = '{{credentials}}'; }
          if (step.action === 'search_google') normalized.url = `https://www.google.com/search?q=${encodeURIComponent(step.query || '')}`;
          if (step.action === 'wait_for') normalized.ms = step.ms || 3000;
          return normalized;
        })
        .filter(Boolean);

      // Set name
      sopData.name = name || sopData.name || `Generated: ${description.substring(0, 40)}`;
      
      // Sanitize category — no pipes, slashes, or special chars
      if (sopData.category) {
        sopData.category = sopData.category.replace(/[|\/\\:*?"<>]/g, '_').split('_')[0].toLowerCase().trim() || 'general';
      } else {
        sopData.category = 'general';
      }
      
      // Map triggerPatterns → triggers + keywords (SOPManager uses these, not triggerPatterns)
      const patterns = sopData.triggerPatterns || [];
      if (!sopData.triggers || sopData.triggers.length === 0) {
        sopData.triggers = patterns.length > 0 ? patterns : [];
        // Also add the full SOP name as a trigger
        if (sopData.name) sopData.triggers.push(sopData.name.toLowerCase());
      }
      if (!sopData.keywords || sopData.keywords.length === 0) {
        // Extract individual words from patterns + name + description
        const allText = [...patterns, sopData.name || '', description].join(' ');
        sopData.keywords = allText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      }

      // Validate category against SOPManager's known categories
      const VALID_CATEGORIES = ['lead_generation', 'email', 'meetups', 'general', 'custom'];
      if (!VALID_CATEGORIES.includes(sopData.category)) {
        sopData.category = 'general';
      }

      // Add metadata
      sopData.generated = true;
      sopData.generatedAt = new Date().toISOString();
      sopData.generatedFrom = description;

      // Save through SOPManager
      if (this.sopManager) {
        const savedSOP = await this.sopManager.createSOP(sopData);
        this.onProgress(`✅ Generated SOP: "${savedSOP.name}" with ${savedSOP.steps.length} steps`);
        return savedSOP;
      }

      return sopData;
    } catch (error) {
      this.onProgress(`❌ SOP generation failed: ${error.message}`);
      return null;
    }
  }
}

export default AceBrain;
