/**
 * ActionEngine — The Heart, Soul & Brain of Ace
 * 
 * THE HEART (Engine & Lifecycle):
 *   Receives every message, routes through Brain, executes actions, reports results.
 *   Manages the lifecycle of actions from intent → execution → confirmation.
 * 
 * THE SOUL (Resource Loader):
 *   Provides live access to all system resources: pipeline, leads, tasks, SOPs,
 *   knowledge, credentials, config. All components query the Soul for state.
 * 
 * THE BRAIN (Logic & Scripting):
 *   Deterministic intent parser + action scripts. Does NOT rely on AI to decide
 *   what to do — it KNOWS what to do based on pattern matching and scripted logic.
 *   AI is only used for creative/conversational responses AFTER actions execute.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { LeadFinder } from './LeadFinder.js';
import { eventBus, EVENTS } from '../events/EventBus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ActionEngine {
  constructor(options = {}) {
    // References to OpenAce subsystems (injected on init)
    this.pipelineManager = null;
    this.researchAgent = null;
    this.knowledgeBase = null;
    this.sopManager = null;
    this.skillsManager = null;
    this.browserAgent = null;
    this.aiManager = null;
    this.siteMemory = null;
    this.permissionsManager = null;
    this.leadFinder = null;
    this.google = null;  // Google Integration (Gmail, Calendar, Drive)
    this.sopExecutor = null;  // SOP Executor — runs SOPs through BrowserAgent
    this.autonomousScheduler = null;  // Autonomous Scheduler — daily routines
    this.agentOrchestrator = null;  // Agent Orchestrator — routes tasks to specialized agents
    this.codeAgent = null;  // Code Agent — handles code generation/editing tasks
    this.projectManager = null;  // Project Manager — manages projects/ metadata
    this.deployPipeline = null;  // Deploy Pipeline — handles project deployment
    this.socialMedia = null; // Social Media System
    this.approvalQueue = null; // Human-in-the-loop approval (injected by OpenAce)
    this.config = options.config || {};
    
    this.baseDir = options.baseDir || path.join(__dirname, '..', '..', '..');
    this.dataDir = path.join(this.baseDir, 'data');
    this.onProgress = options.onProgress || ((msg) => console.log(`[ActionEngine] ${msg}`));
    
    this.initialized = false;
  }

  // ═══════════════════════════════════════════════════════
  // THE HEART — Lifecycle & Initialization
  // ═══════════════════════════════════════════════════════

  /**
   * Initialize with references to all OpenAce subsystems
   */
  async initialize(systems) {
    this.pipelineManager = systems.pipelineManager;
    this.researchAgent = systems.researchAgent;
    this.knowledgeBase = systems.knowledgeBase;
    this.sopManager = systems.sopManager;
    this.skillsManager = systems.skillsManager;
    this.browserAgent = systems.browserAgent;
    this.aiManager = systems.aiManager;
    this.siteMemory = systems.siteMemory;
    this.permissionsManager = systems.permissionsManager;
    this.sopExecutor = systems.sopExecutor || null;
    this.autonomousScheduler = systems.autonomousScheduler || null;
    this.projectManager = systems.projectManager || null;
    this.deployPipeline = systems.deployPipeline || null;
    this.socialMedia = systems.socialMedia || null;
    
    // Accept config from systems or use constructor config
    if (systems.config) {
      this.config = systems.config;
    }

    // Initialize LeadFinder with real search capabilities
    this.leadFinder = new LeadFinder({
      browserAgent: this.browserAgent,
      config: this.config,
      onProgress: this.onProgress
    });
    console.log('🔍 LeadFinder initialized (Places API + Browser Scraping)');
    
    this.initialized = true;
    console.log('⚡ ActionEngine initialized (Heart + Soul + Brain)');
    return true;
  }

  /**
   * THE HEART — Process any message and produce REAL results
   * Returns: { handled: boolean, message: string, actions: [], data: {} }
   */
  async process(userMessage, context = {}) {
    if (!this.initialized) {
      return { handled: false, message: 'ActionEngine not initialized' };
    }

    // Step 0: Parse Studio project context prefix (e.g. "[Studio Project: workout-ap]")
    const parsed = this._parseStudioContext(userMessage, context);
    userMessage = parsed.message;
    context = parsed.context;

    // Step 1: BRAIN — Parse intent (with context for project-aware detection)
    const intent = this.parseIntent(userMessage, context);
    this.onProgress(`🧠 Intent: ${intent.type} (confidence: ${intent.confidence})`);
    eventBus.emit(EVENTS.ACTION_DETECTED, { intent: intent.type, confidence: intent.confidence });
    
    // Step 2: If confidence is high enough, execute deterministically
    if (intent.confidence >= 0.7 && intent.type !== 'conversation') {
      
      // Step 2a: Check if this action needs approval
      let approvalCheck = { needed: false, autoApprovalNote: null, reason: 'no_queue' };
      if (this.approvalQueue && this.permissionsManager) {
        const autonomyLevel = this.permissionsManager.getAutonomyLevel?.() || 3;
        approvalCheck = this.approvalQueue.needsApproval(intent.type, autonomyLevel);
        if (approvalCheck.needed) {
          const riskLevel = this.approvalQueue.getRiskLevel(intent.type);
          this.onProgress(`⏳ Action "${intent.type}" (risk: ${riskLevel}) requires approval at autonomy level ${autonomyLevel}`);

          const approval = await this.approvalQueue.queueForApproval({
            type: intent.type,
            title: `${intent.type}: ${userMessage.substring(0, 80)}`,
            description: userMessage,
            params: intent.params,
            context: { ...context, originalMessage: userMessage },
          });

          return {
            handled: true,
            message: `⏳ **Action Queued for Approval**\n\n` +
                     `**Action:** ${intent.type}\n` +
                     `**Risk Level:** ${riskLevel}/4\n` +
                     `**Request:** ${userMessage.substring(0, 200)}\n\n` +
                     `This action requires your approval. Check the **Approvals** page in the dashboard to approve or reject it.`,
            actions: [{ type: 'approval_queued', data: approval }],
            data: { approvalId: approval.id, pendingCount: this.approvalQueue.getPending().length },
            intent: intent.type,
            needsApproval: true
          };
        }
      }

      // Step 2b: Execute the action
      try {
        const result = await this.executeIntent(intent, userMessage, context);

        if (result.success) {
          this.onProgress(`✅ Action completed: ${intent.type}`);
          eventBus.emit(EVENTS.ACTION_COMPLETED, { intent: intent.type, success: true });
          const message = approvalCheck.autoApprovalNote
            ? `${result.message}\n\n_${approvalCheck.autoApprovalNote}_`
            : result.message;
          return {
            handled: true,
            message,
            actions: result.actions || [],
            data: result.data || {},
            intent: intent.type
          };
        }
      } catch (error) {
        this.onProgress(`⚠️ Action failed: ${error.message}`);
        // Fall through to AI
      }
    }

    // Step 2c: AI-assisted intent classification for low-confidence regex matches
    if (this.aiManager && intent.confidence < 0.7 && intent.type === 'conversation') {
      try {
        const aiIntent = await this.classifyIntentWithAI(userMessage);
        if (aiIntent && aiIntent.confidence >= 0.7 && aiIntent.type !== 'conversation') {
          this.onProgress(`🤖 AI classified intent: ${aiIntent.type} (confidence: ${aiIntent.confidence})`);
          eventBus.emit(EVENTS.ACTION_DETECTED, { intent: aiIntent.type, confidence: aiIntent.confidence, method: 'ai' });
          
          // Check approval before executing
          let aiApprovalCheck = { needed: false, autoApprovalNote: null, reason: 'no_queue' };
          if (this.approvalQueue && this.permissionsManager) {
            const autonomyLevel = this.permissionsManager.getAutonomyLevel?.() || 3;
            aiApprovalCheck = this.approvalQueue.needsApproval(aiIntent.type, autonomyLevel);
            if (aiApprovalCheck.needed) {
              const approval = await this.approvalQueue.queueForApproval({
                type: aiIntent.type,
                title: `${aiIntent.type}: ${userMessage.substring(0, 80)}`,
                description: userMessage,
                params: aiIntent.params,
                context: { ...context, originalMessage: userMessage },
              });
              return {
                handled: true,
                message: `⏳ AI identified action "${aiIntent.type}" — queued for approval.\nCheck the Approvals page.`,
                actions: [{ type: 'approval_queued', data: approval }],
                data: { approvalId: approval.id },
                intent: aiIntent.type,
                needsApproval: true
              };
            }
          }

          try {
            const result = await this.executeIntent(aiIntent, userMessage, context);
            if (result.success) {
              this.onProgress(`✅ AI-classified action completed: ${aiIntent.type}`);
              const aiMessage = aiApprovalCheck.autoApprovalNote
                ? `${result.message}\n\n_${aiApprovalCheck.autoApprovalNote}_`
                : result.message;
              return {
                handled: true,
                message: aiMessage,
                actions: result.actions || [],
                data: result.data || {},
                intent: aiIntent.type
              };
            }
          } catch (error) {
            this.onProgress(`⚠️ AI-classified action failed: ${error.message}`);
          }
        }
      } catch (e) {
        // AI classification failed, fall through
      }
    }

    // Step 3: Not a deterministic action — let AI handle it
    return { handled: false, intent: intent.type };
  }

  /**
   * Use AI to classify intent when regex patterns don't match
   * This catches natural language variations that regex misses
   */
  async classifyIntentWithAI(message) {
    if (!this.aiManager) return null;
    
    const validIntents = [
      'add_task', 'add_lead', 'find_leads', 'pipeline_status', 'move_task', 'move_lead',
      'research', 'use_skill', 'send_email', 'browse', 'run_sop', 'create_project',
      'deploy_project', 'edit_project', 'schedule_routine', 'social_media',
      'create_strategy', 'conversation'
    ];

    // Get SOP names for matching
    const sopNames = this.sopManager ? this.sopManager.getAllSOPs().map(s => s.name).join(', ') : 'none';
    
    const prompt = `Classify this user message into ONE action intent.

MESSAGE: "${message}"

AVAILABLE INTENTS:
- add_task: User wants to add a task/todo/reminder
- add_lead: User wants to add a lead/contact/prospect
- find_leads: User wants to search for leads/businesses/contacts
- pipeline_status: User wants to see pipeline/tasks/leads status
- move_task: User wants to update/move a task status
- move_lead: User wants to update/move a lead status
- research: User wants to research a topic, look something up, find information
- send_email: User wants to send/draft an email
- browse: User wants to visit/open a website
- run_sop: User wants to run a procedure (available: ${sopNames})
- create_project: User wants to build/create a web app/site/page
- deploy_project: User wants to deploy/publish a project
- social_media: User wants to post/manage social media
- create_strategy: User wants to plan a strategy/campaign
- schedule_routine: User wants to schedule a recurring task
- conversation: General chat, questions, follow-ups (DEFAULT)

Return ONLY a JSON object: {"type": "intent_name", "confidence": 0.0-1.0, "params": {}}
If unsure, return: {"type": "conversation", "confidence": 0.9, "params": {}}`;

    try {
      const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { maxTokens: 100 });
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (validIntents.includes(parsed.type)) {
          return {
            type: parsed.type,
            confidence: Math.min(parsed.confidence || 0.75, 0.95),
            params: parsed.params || { query: message }
          };
        }
      }
    } catch (e) {
      // AI classification failed
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════
  // THE BRAIN — Intent Parsing & Action Scripting
  // ═══════════════════════════════════════════════════════

  /**
   * Parse user intent with deterministic pattern matching
   * Returns: { type, confidence, params }
   */
  parseIntent(message, context = {}) {
    const lower = message.toLowerCase().trim();

    // Bypass for strategic, multi-step commands that should be decomposed by AceBrain
    // BUT NOT if the message contains a URL/domain — that's a browse action, not strategic
    const hasUrlOrDomain = /https?:\/\/\S+|\b[\w-]+\.(?:com|org|net|io|pro|co|app|dev|ai|me|us)\b/i.test(lower);
    const strategicPatterns = [
        /\b(plan|strategy|roadmap|campaign|schedule|analyze|review|audit)\b/i,
        /\b(scan|get the list|promote)\b/i,
    ];
    if (!hasUrlOrDomain && this.matchesPatterns(lower, strategicPatterns)) {
        this.onProgress('🧠 Strategic intent detected, deferring to AceBrain for decomposition.');
        return {
            type: 'conversation',
            confidence: 0.5, // Low confidence ensures it falls through to AceBrain
            params: {}
        };
    }

    const conversationalPatterns = [
        /\b(did you|do you|have you|can you|what happened|where did|why did)\b/i,
        /\b(this is great|looks good|not what i wanted|that's not right)\b/i,
        /^\s*(great|okay|ok|thanks|thank you|no)\b/i,
    ];

    if (!hasUrlOrDomain && this.matchesPatterns(lower, conversationalPatterns)) {
        this.onProgress('🧠 Conversational follow-up detected, routing to AceBrain.');
        return {
            type: 'conversation',
            confidence: 0.95, // High confidence to override other matches
            params: {}
        };
    }

    // ─── DEPLOY PROJECT (check BEFORE create to catch "deploy this") ──
    if (this.matchesPatterns(lower, [
      /\b(deploy|publish|push|launch|ship)\b/i
    ])) {
      return {
        type: 'deploy_project',
        confidence: 0.9,
        params: { query: message }
      };
    }

    // ─── EDIT PROJECT (only when activeProject is set) ──
    if (context.activeProject && this.matchesPatterns(lower, [
      /\b(change|update|modify|edit|fix|add|remove|tweak|adjust|replace)\b/i
    ])) {
      return {
        type: 'edit_project',
        confidence: 0.9,
        params: { query: message }
      };
    }

    // ─── CREATE PROJECT ──────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(build|create|make|scaffold|generate)\b.*\b(app|application|website|site|page|project|webapp|widget)\b/i
    ]) && !this.matchesPatterns(lower, [
      // Don't match task/todo/lead patterns that happen to contain "create"
      /\b(task|todo|item|action item|to-do|lead|contact|prospect|strategy|plan|roadmap|campaign)\b/
    ])) {
      return {
        type: 'create_project',
        confidence: 0.9,
        params: { query: message }
      };
    }

    // ─── ADD TASK ─────────────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(add|create|make|new)\b.*\b(task|todo|item|action item|to-do)\b/,
      /\btask\b.*\b(to|for|about)\b/,
      /\bneed to\b.*\b(do|complete|finish|handle)\b/,
      /\bremind me to\b/,
      /\bput.*on.*(?:list|pipeline|board)\b/,
      /\btrack\b.*\b(this|that|the)\b/
    ])) {
      return {
        type: 'add_task',
        confidence: 0.9,
        params: this.extractTaskParams(message)
      };
    }

    // ─── ADD LEAD ─────────────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(add|create|new|save)\b.*\b(lead|contact|prospect)\b/,
      /\b(lead|contact|prospect)\b.*\b(named?|called|from)\b/,
      /\badd\b.*\bas a lead\b/
    ])) {
      return {
        type: 'add_lead',
        confidence: 0.9,
        params: this.extractLeadParams(message)
      };
    }

    // ─── FIND/SEARCH LEADS ───────────────────────
    if (this.matchesPatterns(lower, [
      /\b(find|search|get|look for|discover|hunt)\b.*\b(leads?|contacts?|prospects?|businesses|companies)\b/,
      /\b(leads?|contacts?|prospects?)\b.*\b(in|from|at|near|around)\b/,
      /\b(who|where)\b.*\b(leads?|contacts?|prospects?|clients?|customers?)\b/,
      /\b(lead\s*gen|lead\s*generation)\b/
    ])) {
      return {
        type: 'find_leads',
        confidence: 0.9,
        params: this.extractSearchParams(message)
      };
    }

    // ─── PIPELINE STATUS ─────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(show|check|what'?s|view|display|see)\b.*\b(pipeline|tasks?|leads?|board|status)\b/,
      /\bhow many\b.*\b(tasks?|leads?|items?)\b/,
      /\bpipeline\b.*\b(status|check|update|summary|overview)\b/,
      /\b(status|update|overview)\b.*\b(pipeline|tasks?|leads?)\b/,
      /\bwhat do i have\b/,
      /\bwhat'?s on my plate\b/,
      /\bshow me (?:the |my )?(?:pipeline|tasks?|leads?|work)\b/
    ])) {
      return {
        type: 'pipeline_status',
        confidence: 0.9,
        params: {}
      };
    }

    // ─── MOVE/UPDATE TASK ────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(move|update|change|mark|set)\b.*\b(task|item)\b.*\b(to|as|done|complete|progress)\b/,
      /\b(complete|finish|close|done with)\b.*\b(task|item)\b/,
      /\bmark\b.*\b(done|complete|finished)\b/
    ])) {
      return {
        type: 'move_task',
        confidence: 0.85,
        params: this.extractMoveParams(message)
      };
    }

    // ─── MOVE/UPDATE LEAD ────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(move|update|change)\b.*\b(lead|contact|prospect)\b.*\b(to|as)\b/,
      /\b(contacted|qualified|proposal|won|lost)\b.*\b(lead|contact)\b/
    ])) {
      return {
        type: 'move_lead',
        confidence: 0.85,
        params: this.extractMoveParams(message)
      };
    }

    // ─── DELETE TASK ──────────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(delete|remove|clear|trash|discard)\b.*\b(task|todo|item|action item)\b/,
      /\b(get rid of|throw away|clean up)\b.*\b(task|todo|item)\b/
    ])) {
      return {
        type: 'delete_task',
        confidence: 0.9,
        params: this.extractMoveParams(message)
      };
    }

    // ─── DELETE LEAD ──────────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(delete|remove|clear|trash|discard)\b.*\b(lead|contact|prospect)\b/,
      /\b(get rid of|throw away|clean up)\b.*\b(lead|contact|prospect)\b/
    ])) {
      return {
        type: 'delete_lead',
        confidence: 0.9,
        params: this.extractMoveParams(message)
      };
    }

    // ─── RESEARCH (checked BEFORE skills — "research X" should always do research) ───
    if (this.matchesPatterns(lower, [
      /\b(research|look up|look into|investigate|study)\b/,
      /\b(search the web|google|search online|find out about)\b/,
      /\b(pull up|look up|find info|get data on)\b/,
      /\b(what is|what are|tell me about|info on|information about)\b/
    ])) {
      return {
        type: 'research',
        confidence: 0.85,
        params: { query: message }
      };
    }

    // ─── ANALYZE/COMPARE (could be skill or research — check skill first) ───
    if (this.matchesPatterns(lower, [
      /\b(analyze|compare|analysis of|breakdown of|review)\b/
    ])) {
      // Try matching a skill for analyze/review type requests
      if (this.skillsManager) {
        const matchedSkill = this.skillsManager.findMatchingSkill(message);
        if (matchedSkill) {
          return {
            type: 'use_skill',
            confidence: 0.85,
            params: { skill: matchedSkill, query: message }
          };
        }
      }
      // No skill matched — treat as research
      return {
        type: 'research',
        confidence: 0.8,
        params: { query: message }
      };
    }

    // ─── CREATE STRATEGY ─────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(create|build|develop|draft|make)\b.*\b(strategy|plan|roadmap|campaign)\b/,
      /\b(strategy|plan|roadmap)\b.*\b(for|about|around)\b/,
      /\bcontent\s*(strategy|plan|calendar)\b/,
      /\bmarketing\s*(strategy|plan|campaign)\b/
    ])) {
      return {
        type: 'create_strategy',
        confidence: 0.85,
        params: this.extractStrategyParams(message)
      };
    }

    // ─── SEND EMAIL ─────────────────────────────
    if (this.matchesPatterns(lower, [
      /\b(send|draft|compose|write|fire off)\b.*\b(email|e-mail|mail)\b/,
      /\b(email|e-mail|mail)\b.*\b(to|for)\b/,
      /\b(shoot|send)\b.*\b(a message|a note)\b.*\b(to|@)\b/
    ])) {
      return {
        type: 'send_email',
        confidence: 0.95,
        params: this.extractEmailParams(message)
      };
    }

    // ─── BROWSE / SCAN / READ WEBSITE ───────────
    // Must be checked BEFORE login/sign-in to prevent "scan likemindedpro.com"
    // from being misrouted to a login SOP
    if (this.matchesPatterns(lower, [
      // Standard navigation verbs + URL/domain
      /\b(go to|navigate to|open|browse|visit|pull up|load)\b.*\b(https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.pro|\.co|\.app|\.dev|\.ai)\b/,
      /\b(go to|navigate to|open|browse|visit|pull up|load)\b.*\b(website|site|page|url)\b/,
      // Scan/read/check verbs + URL/domain
      /\b(scan|read|check|look at|explore|scrape|crawl|inspect|analyze|examine)\b.*\b(https?:\/\/|www\.|\.com|\.org|\.net|\.io|\.pro|\.co|\.app|\.dev|\.ai)\b/,
      /\b(scan|read|check|look at|explore|scrape|crawl|inspect|analyze|examine)\b.*\b(the\s+)?(website|site|page|url)\b/,
      // "what's on the page / what do you see" patterns
      /\b(what('s|\s+is|\s+are))\b.*\b(on|at)\b.*\b(the\s+)?(page|website|site)\b/,
      /\b(tell me what)\b.*\b(you see|is on|are on|('s|is) there)\b/,
      /\b(what\s+)(meetup|event|date|content|info|data|listing|item)\b.*\b(do you see|on the|on that|can you find|are there)\b/,
      // Domain-then-action: "likemindedpro.com and tell me" / "scan likemindedpro.com"
      /\b[\w-]+\.(com|org|net|io|pro|co|app|dev|ai)\b.*\b(and\s+)?(scan|read|tell|check|show|look|what|find|see)\b/,
      /\b(scan|read|tell|check|show|look|what|find|pull up)\b.*\b[\w-]+\.(com|org|net|io|pro|co|app|dev|ai)\b/,
      // Explicit URL patterns
      /\bhttps?:\/\/\S+/,
      /\bwww\.\S+/
    ])) {
      // Extract URL — try full URL first, then www, then bare domain
      const urlMatch = message.match(/https?:\/\/[^\s]+/i)
        || message.match(/www\.[^\s]+/i)
        || message.match(/\b([\w-]+\.(?:com|org|net|io|pro|co|app|dev|ai)(?:\/[\w\-._~:/?#[\]@!$&'()*+,;=%]*)?)/i);
      const url = urlMatch ? (urlMatch[1] || urlMatch[0]) : null;
      return {
        type: 'browse',
        confidence: 0.92,
        params: { url, task: message }
      };
    }

    // ─── LOGIN / SIGN IN ────────────────────────
    // Only match login intent if user explicitly says login/signin
    // or starts their day — NOT when they say scan/read/browse
    if (this.matchesPatterns(lower, [
      /\b(log\s*in|login|sign\s*in|signin)\b.*\b(to|into|on)\b/,
      /\b(open|go to|navigate|pull up|start)\b.*\b(likemindedpro|dashboard|admin|portal|webapp|web app)\b/,
      /\b(start|begin)\s+(the|my)?\s*(day|morning|routine|work)\b/
    ]) && !this.matchesPatterns(lower, [
      /\b(scan|read|check|look at|explore|scrape|what|tell me|find)\b/
    ])) {
      return {
        type: 'run_sop',
        confidence: 0.95,
        params: this.extractSOPParams(message)
      };
    }

    // ─── RUN SOP / PROCEDURE ────────────────────
    if (this.matchesPatterns(lower, [
      /\b(run|execute|do|perform|start)\b.*\b(sop|procedure|workflow|routine|automation)\b/,
      /\b(run|execute|do)\b.*\b(the|my|that)\b.*\b(process|steps|task)\b/,
      /\b(automate|automation)\b/
    ])) {
      return {
        type: 'run_sop',
        confidence: 0.85,
        params: this.extractSOPParams(message)
      };
    }

    // ─── SCHEDULE / ROUTINE ─────────────────────
    if (this.matchesPatterns(lower, [
      /\b(schedule|set up|configure)\b.*\b(routine|daily|weekly|recurring|automatic)\b/,
      /\b(every|each)\s+(day|morning|evening|monday|tuesday|wednesday|thursday|friday)\b/,
      /\b(daily|weekly|monthly)\s+(routine|check|task|job)\b/
    ])) {
      return {
        type: 'schedule_routine',
        confidence: 0.85,
        params: this.extractScheduleParams(message)
      };
    }

    // ─── CODE / DEVELOPMENT ─────────────────────
    if (this.matchesPatterns(lower, [
      /\b(?:write|create|generate|build|make)\s+(?:a\s+)?(?:code|script|file|page|component|function|module|program|app|application|website)\b/i,
      /\b(?:edit|modify|update|fix|refactor|debug)\s+(?:the\s+)?(?:code|script|file|function|module|component)\b/i,
      /\b(?:build|create|generate)\s+(?:a\s+)?(?:landing\s+page|web\s*page|html|website|dashboard|form)\b/i,
      /\b(?:seo\s+audit|code\s+review|tech\s+audit|security\s+audit)\b/i,
      /\b(?:run|execute)\s+(?:a\s+)?(?:script|command|npm|node|shell|git)\b/i,
      /\b(?:install|setup|configure|deploy)\s+(?:a\s+)?(?:package|dependency|server|database|environment)\b/i,
      /\b(?:git\s+(?:commit|push|pull|merge|branch|clone))\b/i
    ])) {
      return {
        type: 'code',
        confidence: 0.85,
        params: { query: message }
      };
    }

    // ─── SOP MATCHING (catch-all for learned procedures) ──
    if (this.sopManager) {
      const matchedSOP = this.sopManager.findSOPByIntent(message);
      if (matchedSOP) {
        return {
          type: 'run_sop',
          confidence: 0.9,
          params: { sop: matchedSOP, query: message }
        };
      }
    }

    // ─── SYSTEM MAINTENANCE ─────────────────────
    if (this.matchesPatterns(lower, [
      /\b(update|upgrade|restart|redeploy)\b.*\b(system|ace|openace|app|bot)\b/,
      /\b(apply|deploy)\b.*\b(changes|updates)\b/
    ])) {
      return {
        type: 'system_maintenance',
        confidence: 0.95,
        params: { query: message }
      };
    }

    // ─── SOCIAL MEDIA ─────────────────────────────
    if (this.matchesPatterns(lower, [
        /\b(post|schedule|tweet|share|publish)\b/i,
        /\b(social media|facebook|twitter|linkedin|instagram)\b/i,
        /\b(content calendar|social calendar)\b/i,
    ])) {
        return {
            type: 'social_media',
            confidence: 0.9,
            params: { query: message }
        };
    }

    // ─── CONVERSATION (fallback to AI) ───────────
    return {
      type: 'conversation',
      confidence: 0.5,
      params: {}
    };
  }

  /**
   * Check if message matches any of the patterns
   */
  matchesPatterns(message, patterns) {
    return patterns.some(p => p.test(message));
  }

  // ═══════════════════════════════════════════════════════
  // THE BRAIN — Parameter Extraction
  // ═══════════════════════════════════════════════════════

  extractTaskParams(message) {
    // Extract task title — everything after action words
    let title = message
      .replace(/^(add|create|make|new|please|can you|could you|i need to|i want to)\s*/i, '')
      .replace(/^(a |an |the )\s*/i, '')
      .replace(/^(task|todo|item|action item|to-do)\s*(to|for|about|:|-|–)?\s*/i, '')
      .replace(/\b(to the |to my |on the |on my )?(pipeline|board|list|tracker)\b/gi, '')
      .trim();
    
    // If title is too short, use the full message
    if (title.length < 5) {
      title = message.replace(/^(add|create)\s*(a\s*)?/i, '').trim();
    }

    // Extract priority
    let priority = 'medium';
    if (/\b(urgent|critical|asap|high priority|important)\b/i.test(message)) {
      priority = 'high';
    } else if (/\b(low priority|whenever|not urgent|backlog)\b/i.test(message)) {
      priority = 'low';
    }

    // Detect category
    let category = 'general';
    if (/\b(market|social|content|brand|seo|campaign|ads?|advertising)\b/i.test(message)) {
      category = 'marketing';
    } else if (/\b(code|dev|bug|feature|api|deploy|server|tech)\b/i.test(message)) {
      category = 'development';
    } else if (/\b(ops|process|efficiency|team|hire|resource)\b/i.test(message)) {
      category = 'operations';
    }

    return { title, priority, category };
  }

  extractLeadParams(message) {
    // Extract name
    const nameMatch = message.match(/(?:named?|called|for|lead:?)\s+([A-Z][a-z]+ (?:[A-Z][a-z]+)?)/);
    const name = nameMatch ? nameMatch[1].trim() : this.extractQuoted(message) || 'New Lead';

    // Extract company
    const companyMatch = message.match(/(?:from|at|company:?|@)\s+([A-Z][a-zA-Z\s&]+)/);
    const company = companyMatch ? companyMatch[1].trim() : '';

    // Extract email
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    const email = emailMatch ? emailMatch[0] : '';

    // Extract source/industry
    const sourceMatch = message.match(/(?:in|from|industry:?)\s+(\w[\w\s]+?)(?:\s+(?:industry|market|sector)|$)/i);
    const source = sourceMatch ? sourceMatch[1].trim() : 'manual';

    return { name, company, email, source };
  }

  extractSearchParams(message) {
    const lower = message.toLowerCase();
    
    // Extract count
    const countMatch = message.match(/(\d+)\s*(?:leads?|contacts?|prospects?|businesses|results?)/i);
    const count = countMatch ? parseInt(countMatch[1]) : 5;

    // Extract location
    const locationPatterns = [
      /\bin\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:area|region|market|who|that|and)|[,.]|$)/,
      /(?:near|around|from)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:area|region|market|who|that|and)|[,.]|$)/
    ];
    let location = '';
    for (const p of locationPatterns) {
      const m = message.match(p);
      if (m) { location = m[1].trim(); break; }
    }
    // Fallback: common city names
    if (!location) {
      const cities = ['miami', 'austin', 'dallas', 'houston', 'nyc', 'new york', 'la', 'los angeles', 
                       'chicago', 'atlanta', 'denver', 'seattle', 'boston', 'phoenix', 'san francisco',
                       'orlando', 'tampa', 'fort lauderdale', 'jacksonville', 'naples'];
      for (const city of cities) {
        if (lower.includes(city)) {
          location = city.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
          break;
        }
      }
    }

    // Extract industry/niche
    const industries = {
      'real estate': ['real estate', 'realtor', 'property', 'realty', 'homes', 'housing'],
      'technology': ['tech', 'software', 'saas', 'startup', 'it ', 'developer'],
      'healthcare': ['health', 'medical', 'doctor', 'clinic', 'hospital', 'wellness'],
      'finance': ['finance', 'banking', 'investment', 'fintech', 'insurance', 'mortgage'],
      'retail': ['retail', 'ecommerce', 'store', 'shop', 'consumer'],
      'food & beverage': ['restaurant', 'food', 'catering', 'bar', 'dining'],
      'construction': ['construction', 'contractor', 'building', 'roofing', 'plumbing'],
      'legal': ['lawyer', 'legal', 'attorney', 'law firm'],
      'marketing': ['marketing', 'agency', 'advertising', 'pr ', 'media'],
      'events': ['event', 'wedding', 'venue', 'entertainment', 'dj']
    };
    
    let industry = '';
    for (const [name, keywords] of Object.entries(industries)) {
      if (keywords.some(kw => lower.includes(kw))) {
        industry = name;
        break;
      }
    }

    return { count, location, industry, query: message };
  }

  extractMoveParams(message) {
    // Extract stage
    const stageMap = {
      'inbox': ['inbox', 'new', 'backlog'],
      'research': ['research', 'investigating'],
      'in_progress': ['in progress', 'working', 'started', 'doing'],
      'review': ['review', 'reviewing', 'check'],
      'done': ['done', 'complete', 'completed', 'finished', 'close', 'closed'],
      'contacted': ['contacted', 'reached out'],
      'qualified': ['qualified', 'qualify'],
      'proposal': ['proposal', 'sent proposal'],
      'negotiation': ['negotiation', 'negotiating'],
      'won': ['won', 'closed won', 'converted'],
      'lost': ['lost', 'closed lost']
    };

    const lower = message.toLowerCase();
    let targetStage = '';
    for (const [stage, keywords] of Object.entries(stageMap)) {
      if (keywords.some(kw => lower.includes(kw))) {
        targetStage = stage;
        break;
      }
    }

    return { stage: targetStage || 'in_progress' };
  }

  extractStrategyParams(message) {
    let type = 'general';
    if (/\bmarket/i.test(message)) type = 'marketing';
    if (/\bcontent/i.test(message)) type = 'content';
    if (/\bsocial/i.test(message)) type = 'social_media';
    if (/\bsales/i.test(message)) type = 'sales';
    if (/\bgrowth/i.test(message)) type = 'growth';
    
    const topicMatch = message.match(/(?:for|about|around|on)\s+(.+?)(?:\.|$)/i);
    const topic = topicMatch ? topicMatch[1].trim() : message;
    
    return { type, topic };
  }

  /**
   * Extract email parameters from user message
   * Properly separates command prefix (to/subject) from the email body
   */
  extractEmailParams(message) {
    // Extract email address
    const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
    const to = emailMatch ? emailMatch[0] : '';

    // Extract subject — look for "subject:", "subj:" followed by text up to newline
    let subject = '';
    let subjectMatchEnd = -1;
    const subjectRegex = /(?:subject|subj)[:\s]+["']?([^"'\n]+)["']?/i;
    const subjectMatch = message.match(subjectRegex);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      subjectMatchEnd = subjectMatch.index + subjectMatch[0].length;
    } else {
      // Try "about" keyword as subject hint
      const aboutMatch = message.match(/\babout[:\s]+["']?([^"'\n]+)["']?/i);
      if (aboutMatch) {
        subject = aboutMatch[1].trim();
        subjectMatchEnd = aboutMatch.index + aboutMatch[0].length;
      } else {
        // Try quoted text as subject
        const quoted = message.match(/["']([^"']+)["']/);
        if (quoted) subject = quoted[1];
      }
    }

    // Extract body — everything AFTER the subject line, stripping command prefix
    let body = '';

    if (subjectMatchEnd !== -1) {
      // Body is everything after the subject line, minus leading blank lines
      const afterSubject = message.substring(subjectMatchEnd);
      body = afterSubject.replace(/^[ \t]*\n/, '').replace(/^[ \t]*\n/, '').trim();
    }

    if (!body) {
      // Try "saying" / "that says" / "with text" pattern
      const sayingMatch = message.match(/\b(?:saying|that says|with text)[:\s]+(.+)$/is);
      if (sayingMatch) {
        body = sayingMatch[1].trim();
      }
    }

    if (!body) {
      // Look for content after a double newline (blank line separator)
      const doubleNewlineIdx = message.indexOf('\n\n');
      if (doubleNewlineIdx !== -1) {
        const candidate = message.substring(doubleNewlineIdx + 2).trim();
        if (candidate) body = candidate;
      }
    }

    return { to, subject, body };
  }

  extractQuoted(message) {
    const match = message.match(/["']([^"']+)["']/);
    return match ? match[1] : null;
  }

  /**
   * Extract SOP parameters — find which SOP to run
   */
  extractSOPParams(message) {
    const lower = message.toLowerCase();
    
    // Check for explicit SOP match first
    if (this.sopManager) {
      const matchedSOP = this.sopManager.findSOPByIntent(message);
      if (matchedSOP) {
        return { sop: matchedSOP, query: message };
      }
    }

    // Extract site name for login intents
    const sitePatterns = [
      { pattern: /likemindedpro/i, sopId: 'sop_login_likemindedpro', site: 'likemindedpro' },
      { pattern: /\b(start|begin)\s+(the|my)?\s*(day|morning|routine)/i, sopId: 'sop_login_likemindedpro', site: 'likemindedpro' },
      { pattern: /google\s*lead/i, sopId: 'sop_google_search_leads', site: 'google' },
      { pattern: /email\s*(campaign|leads)/i, sopId: 'sop_send_email_campaign', site: 'likemindedpro' }
    ];

    for (const { pattern, sopId, site } of sitePatterns) {
      if (pattern.test(lower)) {
        const sop = this.sopManager?.getSOP(sopId);
        return { sop: sop || null, sopId, site, query: message };
      }
    }

    return { query: message };
  }

  /**
   * Extract schedule parameters
   */
  extractScheduleParams(message) {
    const lower = message.toLowerCase();
    
    // Extract time
    const timeMatch = message.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    let time = '09:00';
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }

    // Extract days
    let days = [1, 2, 3, 4, 5]; // Default: weekdays
    if (/every\s*day|daily/i.test(lower)) days = [0, 1, 2, 3, 4, 5, 6];
    if (/weekend/i.test(lower)) days = [0, 6];
    if (/weekday/i.test(lower)) days = [1, 2, 3, 4, 5];

    // Extract what to schedule
    const taskMatch = message.match(/(?:schedule|set up)\s+(?:a\s+)?(.+?)(?:\s+(?:at|every|daily|weekly))/i);
    const taskName = taskMatch ? taskMatch[1].trim() : message;

    return { time, days, taskName, query: message };
  }

  // ═══════════════════════════════════════════════════════
  // THE HEART — Action Execution
  // ═══════════════════════════════════════════════════════

  /**
   * Execute a parsed intent — this is where REAL things happen
   */
  async executeIntent(intent, originalMessage, context = {}) {
    switch (intent.type) {
      case 'create_project':
        return await this.execCreateProject(originalMessage, context);
      case 'deploy_project':
        return await this.execDeployProject(originalMessage, context);
      case 'edit_project':
        return await this.execEditProject(originalMessage, context);
      case 'add_task':
        return await this.execAddTask(intent.params);
      case 'add_lead':
        return await this.execAddLead(intent.params);
      case 'find_leads':
        return await this.execFindLeads(intent.params);
      case 'pipeline_status':
        return await this.execPipelineStatus();
      case 'move_task':
        return await this.execMoveTask(intent.params);
      case 'move_lead':
        return await this.execMoveLead(intent.params);
      case 'delete_task':
        return await this.execDeleteTask(intent.params, originalMessage);
      case 'delete_lead':
        return await this.execDeleteLead(intent.params, originalMessage);
      case 'create_strategy':
        return await this.execCreateStrategy(intent.params, originalMessage);
      case 'research':
        return await this.execResearch(intent.params);
      case 'use_skill':
        return await this.execUseSkill(intent.params);
      case 'send_email':
        return await this.execSendEmail(intent.params, originalMessage);
      case 'browse':
        return await this.execBrowse(intent.params);
      case 'run_sop':
        return await this.execRunSOP(intent.params, originalMessage);
      case 'code':
        return await this.execCode(originalMessage, context);
      case 'schedule_routine':
        return await this.execScheduleRoutine(intent.params, originalMessage);
      case 'system_maintenance':
        return await this.execSystemMaintenance(intent.params);
      case 'social_media':
        return await this.execSocialMedia(intent.params.query);
      case 'execute_skill':
        return await this.execExecuteSkill(intent.params);
      default:
        return { success: false, message: 'Unknown action type' };
    }
  }

  // ─── ADD TASK ────────────────────────────────────────
  async execAddTask(params) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    this.onProgress(`📋 Adding task: "${params.title}"`);
    
    const task = await this.pipelineManager.addTask({
      title: params.title,
      description: '',
      priority: params.priority || 'medium',
      category: params.category || 'general',
      stage: 'inbox',
      assignee: 'ace',
      source: 'chat',
      createdAt: new Date().toISOString()
    });

    const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[params.priority] || '🟡';

    return {
      success: true,
      message: `✅ **Task added to pipeline!**\n\n` +
               `📋 **${params.title}**\n` +
               `${priorityIcon} Priority: ${params.priority}\n` +
               `📂 Stage: Inbox\n` +
               `🏷️ Category: ${params.category}\n` +
               `🆔 ID: ${task.id}\n\n` +
               `View it in the **Pipeline** tab. What's next?`,
      actions: [{ type: 'add_task', result: task }],
      data: { task }
    };
  }

  // ─── ADD LEAD ────────────────────────────────────────
  async execAddLead(params) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    this.onProgress(`👤 Adding lead: "${params.name}"`);
    
    const lead = await this.pipelineManager.addLead({
      name: params.name,
      company: params.company || '',
      email: params.email || '',
      phone: '',
      source: params.source || 'manual',
      stage: 'new',
      notes: `Added via chat`,
      createdAt: new Date().toISOString()
    });

    return {
      success: true,
      message: `✅ **Lead added!**\n\n` +
               `👤 **${params.name}**\n` +
               (params.company ? `🏢 Company: ${params.company}\n` : '') +
               (params.email ? `📧 Email: ${params.email}\n` : '') +
               `📂 Stage: New Lead\n` +
               `🆔 ID: ${lead.id}\n\n` +
               `Visible in the **Pipeline → Leads** tab. Want me to reach out?`,
      actions: [{ type: 'add_lead', result: lead }],
      data: { lead }
    };
  }

  // ─── FIND LEADS ──────────────────────────────────────
  async execFindLeads(params) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    const count = params.count || 5;
    const location = params.location || 'your area';
    const industry = params.industry || 'business';

    this.onProgress(`🔍 Searching for ${count} ${industry} leads in ${location}...`);

    // Use LeadFinder to get REAL business leads
    let foundLeads = [];
    if (this.leadFinder) {
      try {
        foundLeads = await this.leadFinder.findLeads(industry, location, count);
      } catch (error) {
        this.onProgress(`⚠️ LeadFinder error: ${error.message}`);
        // Fall back to old generated method
        foundLeads = this.generateLeadNames(count, industry, location).map(gen => ({
          name: gen.name,
          company: gen.company,
          phone: gen.phone,
          email: gen.email,
          address: '',
          website: '',
          source: 'generated_fallback',
          stage: 'new',
          notes: `⚠️ GENERATED LEAD (not verified). ${industry} prospect in ${location}.`,
          location: location,
          industry: industry,
          createdAt: new Date().toISOString()
        }));
      }
    } else {
      // No LeadFinder available, use legacy generation
      foundLeads = this.generateLeadNames(count, industry, location).map(gen => ({
        name: gen.name,
        company: gen.company,
        phone: gen.phone,
        email: gen.email,
        address: '',
        website: '',
        source: 'generated_fallback',
        stage: 'new',
        notes: `⚠️ GENERATED LEAD (not verified). ${industry} prospect in ${location}.`,
        location: location,
        industry: industry,
        createdAt: new Date().toISOString()
      }));
    }

    // Add found leads to pipeline
    const leads = [];
    for (let i = 0; i < foundLeads.length; i++) {
      const leadData = foundLeads[i];
      
      this.onProgress(`👤 Adding lead ${i + 1}/${foundLeads.length}: ${leadData.name}`);
      
      try {
        const lead = await this.pipelineManager.addLead({
          name: leadData.name,
          company: leadData.company || leadData.name,
          email: leadData.email || '',
          phone: leadData.phone || '',
          address: leadData.address || '',
          website: leadData.website || '',
          rating: leadData.rating || null,
          source: leadData.source || 'lead_finder',
          stage: 'new',
          notes: leadData.notes || '',
          location: location,
          industry: industry,
          googleMapsUrl: leadData.googleMapsUrl || '',
          businessType: leadData.businessType || '',
          createdAt: leadData.createdAt || new Date().toISOString()
        });
        leads.push({ ...leadData, id: lead.id });
      } catch (e) {
        this.onProgress(`⚠️ Failed to add lead: ${e.message}`);
      }
    }

    if (leads.length === 0) {
      return { success: false, message: '❌ Could not find leads. Try specifying an industry and location.' };
    }

    // Determine if leads are real or generated
    const realCount = leads.filter(l => l.source !== 'generated_fallback').length;
    const sourceLabel = realCount > 0 ? '🌐 Real businesses' : '⚠️ Generated (unverified)';

    const leadsList = leads.map((l, i) => {
      const parts = [`${i + 1}. **${l.name}**`];
      if (l.company && l.company !== l.name) parts[0] += ` — ${l.company}`;
      const details = [];
      if (l.phone) details.push(`📞 ${l.phone}`);
      if (l.website) details.push(`🌐 ${l.website}`);
      if (l.address) details.push(`📍 ${l.address}`);
      if (l.email) details.push(`📧 ${l.email}`);
      if (l.rating) details.push(`⭐ ${l.rating}/5`);
      if (details.length > 0) parts.push('   ' + details.join(' | '));
      return parts.join('\n');
    }).join('\n');

    return {
      success: true,
      message: `✅ **Found and added ${leads.length} ${industry} leads in ${location}!**\n` +
               `${sourceLabel}\n\n` +
               `${leadsList}\n\n` +
               `All ${leads.length} leads are now in your **Pipeline → Leads** tab as "New".\n\n` +
               `Want me to:\n` +
               `• Start reaching out to them?\n` +
               `• Research them in more detail?\n` +
               `• Create an outreach strategy?`,
      actions: leads.map(l => ({ type: 'add_lead', result: l })),
      data: { leads, count: leads.length, location, industry, realCount }
    };
  }

  // ─── PIPELINE STATUS ─────────────────────────────────
  async execPipelineStatus() {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    this.onProgress('📊 Loading pipeline status...');
    
    const pipeline = await this.pipelineManager.getPipeline();
    const tasks = pipeline.items || [];
    const leads = pipeline.leads || [];

    if (tasks.length === 0 && leads.length === 0) {
      return {
        success: true,
        message: `📊 **Pipeline Status: Empty**\n\n` +
                 `No tasks or leads yet. Let's change that!\n\n` +
                 `I can:\n` +
                 `• **Find leads** — "Find 5 real estate leads in Miami"\n` +
                 `• **Add a task** — "Add task to build landing page"\n` +
                 `• **Create a strategy** — "Create a content strategy for this week"`,
        data: { tasks: 0, leads: 0 }
      };
    }

    // Build task summary
    let taskSummary = '';
    if (tasks.length > 0) {
      const tasksByStage = {};
      tasks.forEach(t => {
        const stage = t.stage || 'inbox';
        if (!tasksByStage[stage]) tasksByStage[stage] = [];
        tasksByStage[stage].push(t);
      });

      taskSummary = `\n📋 **Tasks (${tasks.length}):**\n`;
      const stageIcons = { inbox: '📥', research: '🔍', in_progress: '⚡', review: '👀', done: '✅' };
      
      for (const [stage, items] of Object.entries(tasksByStage)) {
        const icon = stageIcons[stage] || '📌';
        taskSummary += `\n${icon} **${stage.replace('_', ' ').toUpperCase()}** (${items.length}):\n`;
        items.slice(0, 5).forEach(t => {
          const priorityIcon = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority] || '⚪';
          taskSummary += `  ${priorityIcon} ${t.title}\n`;
        });
        if (items.length > 5) taskSummary += `  ... and ${items.length - 5} more\n`;
      }
    }

    // Build lead summary
    let leadSummary = '';
    if (leads.length > 0) {
      const leadsByStage = {};
      leads.forEach(l => {
        const stage = l.stage || 'new';
        if (!leadsByStage[stage]) leadsByStage[stage] = [];
        leadsByStage[stage].push(l);
      });

      leadSummary = `\n👥 **Leads (${leads.length}):**\n`;
      const stageIcons = { new: '🆕', contacted: '📞', qualified: '⭐', proposal: '📄', negotiation: '🤝', won: '🏆', lost: '❌' };
      
      for (const [stage, items] of Object.entries(leadsByStage)) {
        const icon = stageIcons[stage] || '📌';
        leadSummary += `\n${icon} **${stage.replace('_', ' ').toUpperCase()}** (${items.length}):\n`;
        items.slice(0, 5).forEach(l => {
          leadSummary += `  • ${l.name}${l.company ? ` — ${l.company}` : ''}\n`;
        });
        if (items.length > 5) leadSummary += `  ... and ${items.length - 5} more\n`;
      }
    }

    // Insights
    const staleInbox = tasks.filter(t => t.stage === 'inbox').length;
    const newLeads = leads.filter(l => l.stage === 'new').length;
    let insights = '';
    if (staleInbox > 0 || newLeads > 0) {
      insights = '\n💡 **Suggested actions:**\n';
      if (staleInbox > 0) insights += `• ${staleInbox} task(s) sitting in Inbox — want me to prioritize them?\n`;
      if (newLeads > 0) insights += `• ${newLeads} new lead(s) not yet contacted — want me to draft outreach?\n`;
    }

    return {
      success: true,
      message: `📊 **Pipeline Status**\n${taskSummary}${leadSummary}${insights}`,
      data: { tasks: tasks.length, leads: leads.length }
    };
  }

  // ─── MOVE TASK ───────────────────────────────────────
  async execMoveTask(params) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    // Get all tasks and find the most recent one (or match by name)
    const pipeline = await this.pipelineManager.getPipeline();
    const tasks = pipeline.items || [];
    
    if (tasks.length === 0) {
      return { success: true, message: `📋 No tasks in pipeline to move.` };
    }

    // Move the most recent task if no specific one mentioned
    const task = tasks[tasks.length - 1];
    
    this.onProgress(`📋 Moving task "${task.title}" → ${params.stage}`);
    await this.pipelineManager.moveTask(task.id, params.stage);

    return {
      success: true,
      message: `✅ **Task moved!**\n\n` +
               `📋 "${task.title}" → **${params.stage.replace('_', ' ')}**`,
      data: { task, newStage: params.stage }
    };
  }

  // ─── MOVE LEAD ───────────────────────────────────────
  async execMoveLead(params) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    const pipeline = await this.pipelineManager.getPipeline();
    const leads = pipeline.leads || [];
    
    if (leads.length === 0) {
      return { success: true, message: `👥 No leads in pipeline to move.` };
    }

    const lead = leads[leads.length - 1];
    
    this.onProgress(`👤 Moving lead "${lead.name}" → ${params.stage}`);
    await this.pipelineManager.moveLead(lead.id, params.stage);

    return {
      success: true,
      message: `✅ **Lead moved!**\n\n` +
               `👤 "${lead.name}" → **${params.stage.replace('_', ' ')}**`,
      data: { lead, newStage: params.stage }
    };
  }

  // ─── DELETE TASK ──────────────────────────────────────
  async execDeleteTask(params, originalMessage) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    const pipeline = await this.pipelineManager.getPipeline();
    const tasks = pipeline.items?.filter(i => i.type === 'task') || [];
    
    if (tasks.length === 0) {
      return { success: true, message: `📋 No tasks in pipeline to delete.` };
    }

    // Try to match by name/title from the message
    const lower = (originalMessage || '').toLowerCase();
    let matchedTask = tasks.find(t =>
      lower.includes((t.title || '').toLowerCase()) ||
      lower.includes((t.id || '').toLowerCase())
    );
    
    // If no match, delete the most recent/last task
    if (!matchedTask) {
      matchedTask = tasks[tasks.length - 1];
    }
    
    this.onProgress(`🗑️ Deleting task: "${matchedTask.title}"`);
    await this.pipelineManager.deleteTask(matchedTask.id);

    return {
      success: true,
      message: `🗑️ **Task deleted!**\n\n` +
               `Removed: "${matchedTask.title}"`,
      data: { deletedTask: matchedTask }
    };
  }

  // ─── DELETE LEAD ──────────────────────────────────────
  async execDeleteLead(params, originalMessage) {
    if (!this.pipelineManager) {
      return { success: false, message: '❌ Pipeline not available' };
    }

    const pipeline = await this.pipelineManager.getPipeline();
    const leads = pipeline.leads || [];
    
    if (leads.length === 0) {
      return { success: true, message: `👥 No leads in pipeline to delete.` };
    }

    // Try to match by name/company from the message
    const lower = (originalMessage || '').toLowerCase();
    let matchedLead = leads.find(l =>
      lower.includes((l.name || '').toLowerCase()) ||
      lower.includes((l.company || '').toLowerCase()) ||
      lower.includes((l.id || '').toLowerCase())
    );
    
    // If no match, delete the most recent/last lead
    if (!matchedLead) {
      matchedLead = leads[leads.length - 1];
    }
    
    this.onProgress(`🗑️ Deleting lead: "${matchedLead.name || matchedLead.company}"`);
    await this.pipelineManager.deleteLead(matchedLead.id);

    return {
      success: true,
      message: `🗑️ **Lead deleted!**\n\n` +
               `Removed: "${matchedLead.name || matchedLead.company}"`,
      data: { deletedLead: matchedLead }
    };
  }

  // ─── CREATE STRATEGY ─────────────────────────────────
  async execCreateStrategy(params, originalMessage) {
    this.onProgress(`📝 Creating ${params.type} strategy...`);

    // Extract structured items (events/dates) from the original message
    const structuredItems = this._extractStructuredItems(originalMessage);
    let multiItemInstruction = '';
    if (structuredItems.count >= 2) {
      this.onProgress(`📅 Detected ${structuredItems.count} items — creating strategy for ALL`);
      multiItemInstruction = `\n\n🚨 CRITICAL: The user provided ${structuredItems.count} distinct items/events. You MUST create a strategy that covers ALL of them, not just one.\n\nHere are ALL ${structuredItems.count} items:\n`;
      for (let i = 0; i < structuredItems.items.length; i++) {
        const item = structuredItems.items[i];
        multiItemInstruction += `\n${i + 1}. Date: ${item.date} | Name: ${item.name}`;
        if (item.venue) multiItemInstruction += ` | Venue: ${item.venue}`;
        if (item.city) multiItemInstruction += ` | City: ${item.city}`;
        if (item.address) multiItemInstruction += ` | Address: ${item.address}`;
      }
      multiItemInstruction += `\n\nYour strategy MUST include a section for EACH of these ${structuredItems.count} items. Do not skip any.\n`;
    }

    // If AI is available, use it to generate the strategy content
    let strategyContent = '';
    
    if (this.aiManager) {
      try {
        const response = await this.aiManager.chat([
          { role: 'user', content: `Create a detailed, actionable ${params.type} strategy for: ${params.topic}. Include specific steps, timelines, and metrics. Be concise but comprehensive.${multiItemInstruction}` }
        ], { maxTokens: 4000 });
        strategyContent = response.content;
      } catch (e) {
        strategyContent = this.generateBasicStrategy(params);
      }
    } else {
      strategyContent = this.generateBasicStrategy(params);
    }

    // Save the strategy to file
    const strategiesDir = path.join(this.dataDir, 'strategies');
    await fs.mkdir(strategiesDir, { recursive: true });
    const filename = `strategy_${params.type}_${Date.now()}.json`;
    await fs.writeFile(
      path.join(strategiesDir, filename),
      JSON.stringify({
        name: `${params.type} Strategy: ${params.topic}`,
        type: params.type,
        content: strategyContent,
        createdAt: new Date().toISOString()
      }, null, 2)
    );

    // Also add as a task in pipeline
    if (this.pipelineManager) {
      try {
        await this.pipelineManager.addTask({
          title: `Execute: ${params.type} strategy`,
          description: strategyContent.substring(0, 200),
          priority: 'high',
          stage: 'inbox',
          assignee: 'ace',
          source: 'strategy',
          createdAt: new Date().toISOString()
        });
      } catch (e) {
        // Pipeline task is optional
      }
    }

    return {
      success: true,
      message: `✅ **Strategy created & saved!**\n\n` +
               `📝 **${params.type.toUpperCase()} Strategy**\n\n` +
               `${strategyContent}\n\n` +
               `📄 Saved to: \`${filename}\`\n` +
               `📋 Added "Execute strategy" task to pipeline.`,
      data: { filename, type: params.type }
    };
  }

  // ─── RESEARCH ────────────────────────────────────────
  async execResearch(params) {
    const queryPreview = params.query.substring(0, 50);
    this.onProgress(`🔍 Researching: "${queryPreview}..."`);

    // Step 1: Try REAL web research using the ResearchAgent
    let webResults = null;
    if (this.researchAgent) {
      try {
        this.onProgress(`🌐 Launching web research via ResearchAgent...`);
        webResults = await this.researchAgent.researchTopic(params.query, {
          maxPages: 3,
          maxSearchResults: 8
        });
        this.onProgress(`📄 Found ${webResults.pages?.length || 0} pages, ${webResults.search?.results?.length || 0} search results`);
      } catch (e) {
        this.onProgress(`⚠️ Web research failed: ${e.message} — falling back to AI knowledge`);
        // Continue to AI fallback
      }
    }

    // Step 2: Use AI to synthesize findings (or answer from knowledge if no web results)
    if (this.aiManager) {
      try {
        let aiPrompt;
        if (webResults && webResults.pages && webResults.pages.length > 0) {
          // We have real web data — ask AI to synthesize it
          const sourceSummaries = webResults.pages.map((page, i) => {
            const text = page.content?.text?.substring(0, 1500) || page.snippet || '';
            return `Source ${i + 1}: "${page.title}" (${page.url})\n${text}`;
          }).join('\n\n---\n\n');

          aiPrompt = `You are Ace, an AI research assistant. I just researched "${params.query}" and found the following REAL web sources.

Synthesize this into a clear, actionable research brief. Include specific facts, data points, and cite the sources.

═══ WEB RESEARCH RESULTS ═══
${sourceSummaries}

═══ INSTRUCTIONS ═══
1. Summarize the key findings clearly
2. Highlight the most important data points
3. Note any contradictions between sources
4. Provide actionable takeaways
5. Cite sources by name/URL when referencing specific info
6. Be concise but thorough`;
        } else {
          // No web data available — use AI knowledge only
          aiPrompt = `Research the following topic and provide a thorough analysis: ${params.query}

Provide specific, actionable insights. Be clear about what you know vs. what would require further research.`;
        }

        const response = await this.aiManager.chat([
          { role: 'user', content: aiPrompt }
        ], { maxTokens: 2000 });

        const researchContent = response.content || response.text || '';

        // Save to knowledge base
        if (this.knowledgeBase) {
          await this.knowledgeBase.learn(params.query, researchContent);
        }

        const searchResults = webResults?.search?.results || [];
        const scrapedPages = webResults?.pages || [];
        const hasWebData = searchResults.length > 0 || scrapedPages.length > 0;

        const sourceLabel = hasWebData
          ? `🌐 Based on ${searchResults.length} web sources (${scrapedPages.filter(p => p.content && !p.content?.error).length} pages analyzed)`
          : `🧠 Based on AI knowledge`;

        // Build sources list with clickable URLs
        let sourcesSection = '';
        if (searchResults.length > 0) {
          sourcesSection = '\n\n📎 **Sources & Links:**\n';
          searchResults.slice(0, 10).forEach((r, i) => {
            sourcesSection += `${i + 1}. [${r.title}](${r.url})\n`;
            if (r.snippet) sourcesSection += `   _${r.snippet.substring(0, 120)}_\n`;
          });
        }

        // Add direct listing URLs for property/real estate searches
        let listingUrls = '';
        if (webResults?.directListingUrls?.length > 0) {
          listingUrls = '\n\n🏠 **Direct Listing Sites:**\n';
          for (const u of webResults.directListingUrls) {
            listingUrls += `• [${u.site}](${u.url}) — ${u.description}\n`;
          }
        }

        return {
          success: true,
          message: `🔍 **Research: ${queryPreview}...**\n\n` +
                   `${sourceLabel}\n\n` +
                   `${researchContent}` +
                   `${sourcesSection}` +
                   `${listingUrls}\n\n` +
                   `💾 _Saved to knowledge base for future reference._`,
          data: {
            saved: true,
            webResults: webResults ? {
              searchResults: searchResults.length,
              pagesScraped: scrapedPages.length,
              sources: searchResults.map(r => ({ title: r.title, url: r.url, snippet: r.snippet }))
            } : null
          }
        };
      } catch (e) {
        return { success: false, message: `⚠️ Research failed: ${e.message}` };
      }
    }

    return { success: false, message: `⚠️ AI provider not available for research.` };
  }

  // ─── USE SKILL ──────────────────────────────────────
  async execUseSkill(params) {
    const { skill, query } = params;

    if (!skill) {
      return { success: false, message: '⚠️ No matching skill found.' };
    }

    this.onProgress(`⚡ Activating skill: "${skill.name}"`);

    if (!this.aiManager) {
      return { success: false, message: '⚠️ AI not available.' };
    }

    let groundedData = null;
    let groundedDataPrompt = '';

    // Step 1: If the skill has an executor, run it to get real-world data
    if (skill.executor) {
      this.onProgress(`⚙️ Running executor: ${skill.executor}`);
      try {
        const [agentName, methodName] = skill.executor.split('.');
        const agent = this[`${agentName}Agent`]; // e.g., this.browserAgent

        if (agent && typeof agent[methodName] === 'function') {
          const executorParams = this._extractExecutorParams(skill, query);
          if (!executorParams.url) {
            throw new Error(`Required parameter 'url' not found in the query for the executor.`);
          }
          groundedData = await agent[methodName](executorParams);

          groundedDataPrompt = `\n\n═══ REAL-TIME DATA (from ${skill.executor}) ═══
You MUST use the following data to answer the user's request. Do not invent information. This is the ground truth from the website.
\`\`\`
${groundedData}
\`\`\`
`;
          this.onProgress(`✅ Executor successful. Grounding AI with real data.`);
        } else {
          throw new Error(`Executor method '${skill.executor}' not found on agent '${agentName}Agent'.`);
        }
      } catch (e) {
        return { success: false, message: `❌ Executor failed: ${e.message}` };
      }
    }
    
    const skillInstructions = skill.systemPrompt || skill.prompt || '';
    const systemPrompt = `You are Ace, an AI Executive Assistant executing a specialized skill.

═══ ACTIVE SKILL: ${skill.name} ═══
Description: ${skill.description}

═══ SKILL INSTRUCTIONS ═══
${skillInstructions}
${groundedDataPrompt}
═══ END INSTRUCTIONS ═══

Your task is to process the user's request based *only* on the skill instructions and the real-time data provided.
- If you have real-time data, your response MUST be based on it.
- If you do not have real-time data, you can ask the user for the information you need.
- Adhere strictly to the requested 'outputFormat' for the skill.`;

    try {
      const messages = [{ role: 'user', content: query }];
      const response = await this.aiManager.chat(messages, {
        systemPrompt: systemPrompt,
        maxTokens: 4000,
      });

      const content = response.content || response.text || '';
      
      return {
        success: true,
        message: `⚡ **Skill: ${skill.name}**\n\n${content}`,
        data: { skillId: skill.id, skillName: skill.name, executed: true, grounded: !!groundedData }
      };

    } catch (error) {
      console.error(`Skill execution failed (${skill.name}):`, error.message);
      return { success: false, message: `❌ Skill execution failed: ${error.message}` };
    }
  }

  _extractExecutorParams(skill, query) {
    const params = {};
    if (skill.data_requirements) {
        for (const req of skill.data_requirements) {
            if (req.field === 'url') {
                const urlMatch = query.match(/https?:\/\/[^\s]+/i) || query.match(/www\.[^\s]+/i) || query.match(/[\w-]+\.com/i);
                if (urlMatch) {
                    params.url = urlMatch[0];
                }
            }
        }
    }
    params.query = query;
    return params;
  }

  // ─── SEND EMAIL ────────────────────────────────────────
  async execSendEmail(params, originalMessage) {
    const { to, subject, body } = params;

    // Validate we have a recipient
    if (!to) {
      return {
        success: false,
        message: `⚠️ I couldn't find an email address in your message. Please include the recipient's email address (e.g., "send email to someone@example.com").`
      };
    }

    // Check if Google integration is available
    if (!this.google || !this.google.isConnected()) {
      return {
        success: false,
        message: `⚠️ Google is not connected. Please connect your Google account first so I can send emails on your behalf.`
      };
    }

    let finalSubject = subject;
    let finalBody = body;

    // SKIP AI entirely when user provided both subject AND body
    if (finalSubject && finalBody) {
      this.onProgress(`📧 Using provided subject and body for email to ${to}`);
    } else {
      // Subject or body is missing — try AI composition
      this.onProgress(`📧 Composing email to ${to}...`);

      if (this.aiManager) {
        try {
          const prompt = `You are a professional email assistant. Based on this request, generate an email.

USER REQUEST: "${originalMessage}"
RECIPIENT: ${to}
${finalSubject ? `SUBJECT: ${finalSubject}` : ''}
${finalBody ? `BODY CONTEXT: ${finalBody}` : ''}

Return ONLY valid JSON (no markdown, no code blocks, no extra text):
{"subject": "email subject line", "body": "email body text (use \\n for newlines)"}`;
          const response = await this.aiManager.chat([
            { role: 'user', content: prompt }
          ], { maxTokens: 1000 });

          const parsed = this._parseAIEmailResponse(response.content);
          if (!finalSubject && parsed.subject) finalSubject = parsed.subject;
          if (!finalBody && parsed.body) finalBody = parsed.body;
        } catch (e) {
          this.onProgress(`⚠️ AI composition failed: ${e.message}`);
        }
      }

      // Fallback defaults — use extracted values, NOT the whole originalMessage
      if (!finalSubject) finalSubject = subject || 'Message from Ace';
      if (!finalBody) finalBody = body || originalMessage;
    }

    // Actually send the email via Google
    this.onProgress(`📤 Sending email to ${to}...`);
    try {
      const result = await this.google.sendEmail({
        to,
        subject: finalSubject,
        body: finalBody,
        isHtml: true
      });

      return {
        success: true,
        message: `📧 **Email sent successfully!**\n\n` +
                 `📬 **To:** ${to}\n` +
                 `📝 **Subject:** ${finalSubject}\n` +
                 `✅ **Message ID:** ${result.messageId}\n\n` +
                 `The email has been delivered via Gmail.`,
        actions: ['email_sent'],
        data: {
          to,
          subject: finalSubject,
          messageId: result.messageId
        }
      };
    } catch (error) {
      console.error('❌ Email send failed:', error);
      return {
        success: false,
        message: `❌ **Failed to send email:**\n\n${error.message}\n\nPlease check your Google connection and try again.`
      };
    }
  }

  // ─── BROWSE (Navigate to URL) ────────────────────────
  async execBrowse(params) {
    if (!this.browserAgent) {
      return { success: false, message: '❌ Browser agent not available.' };
    }

    const url = params.url;
    if (!url) {
      return { success: false, message: '⚠️ Please provide a URL to navigate to.' };
    }

    // Ensure URL has protocol
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    this.onProgress(`🌐 Opening browser and navigating to ${fullUrl}...`);

    try {
      const navResult = await this.browserAgent.navigateTo(fullUrl);
      const exploration = await this.browserAgent.explorePage();

      // Extract actual text content from the page for AI analysis
      let pageContent = null;
      try {
        pageContent = await this.browserAgent.extractPageText();
        this.onProgress('📝 Page text content extracted for analysis');
      } catch (textErr) {
        this.onProgress(`⚠️ Text extraction partial: ${textErr.message}`);
      }

      // Remember the site
      if (this.siteMemory) {
        await this.siteMemory.rememberSite(fullUrl, exploration);
      }

      // Determine if user's task implies they want content analysis
      // (not just navigation). Patterns like "scan and tell me", "what do you see", etc.
      const task = (params.task || '').toLowerCase();
      const needsSummarization = /\b(scan|read|check|tell|what|find|show|see|look|explore|analyze|list|extract|pull|get|any|are there)\b/.test(task);

      return {
        success: true,
        message: `🌐 **Browser opened!**\n\n` +
                 `📄 **${navResult.title}**\n` +
                 `🔗 ${navResult.url}\n\n` +
                 `${exploration.summary}\n\n` +
                 (needsSummarization
                   ? `📊 Analyzing page content based on your request...`
                   : `I'm now on the page and can interact with it. What would you like me to do?`),
        actions: [{ type: 'browse', url: fullUrl }],
        data: {
          url: navResult.url,
          title: navResult.title,
          exploration: exploration.analysis,
          pageContent,
          needsSummarization,
          userTask: params.task
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ **Failed to navigate:**\n\n${error.message}\n\nPlease check the URL and try again.`
      };
    }
  }

  // ─── RUN SOP (Execute a procedure) ──────────────────
  async execRunSOP(params, originalMessage) {
    // Try to find the SOP
    let sop = params.sop;
    
    if (!sop && params.sopId) {
      sop = this.sopManager?.getSOP(params.sopId);
    }
    
    if (!sop && this.sopManager) {
      sop = this.sopManager.findSOPByIntent(originalMessage || params.query || '');
    }

    if (!sop) {
      return {
        success: false,
        message: `⚠️ I couldn't find a matching procedure for that request.\n\n` +
                 `**Available SOPs:**\n${this.sopManager ? this.sopManager.getSummary() : 'No SOPs loaded.'}\n\n` +
                 `You can teach me new procedures by describing the steps!`
      };
    }

    // Use SOPExecutor if available (the full pipeline)
    if (this.sopExecutor) {
      this.onProgress(`🚀 Executing SOP: "${sop.name}"...`);
      
      try {
        const result = await this.sopExecutor.executeSOP(sop, params.variables || {});
        
        if (result.success) {
          return {
            success: true,
            message: `✅ **SOP Complete: "${sop.name}"**\n\n` +
                     `📋 ${result.stepsCompleted}/${result.totalSteps} steps completed\n` +
                     `⏱️ Duration: ${(result.duration / 1000).toFixed(1)}s\n` +
                     (result.currentTitle ? `📄 Current page: ${result.currentTitle}\n` : '') +
                     (result.currentUrl ? `🔗 ${result.currentUrl}\n` : '') +
                     `\n✅ Procedure executed successfully! What's next?`,
            actions: [{ type: 'run_sop', sopId: sop.id, result }],
            data: result
          };
        } else {
          return {
            success: false,
            message: `⚠️ **SOP "${sop.name}" partially completed**\n\n` +
                     `📋 ${result.stepsCompleted}/${result.totalSteps} steps completed\n` +
                     `❌ Failed at: ${result.error}\n\n` +
                     `Step log:\n${result.log.map((l, i) => `  ${l.success ? '✅' : '❌'} Step ${l.step}: ${l.description || l.action}`).join('\n')}\n\n` +
                     `Would you like me to retry or continue from where I left off?`
          };
        }
      } catch (error) {
        return {
          success: false,
          message: `❌ **SOP execution failed:** ${error.message}\n\nWould you like me to try again?`
        };
      }
    }

    // Fallback: Execute using BrowserAgent directly (legacy mode)
    if (this.browserAgent) {
      this.onProgress(`🚀 Executing SOP (legacy): "${sop.name}"...`);
      
      try {
        await this.browserAgent.launchBrowser();
        
        for (const step of sop.steps) {
          this.onProgress(`  📌 ${step.description || step.action}`);
          
          switch (step.action) {
            case 'navigate':
            case 'goto':
              await this.browserAgent.navigateTo(step.url);
              break;
            case 'click_text':
            case 'clickText':
              await this.browserAgent.clickByText(step.text);
              break;
            case 'click':
              await this.browserAgent.click(step.selector);
              break;
            case 'type':
            case 'input':
              await this.browserAgent.type(step.selector, step.text || step.value);
              break;
            case 'press':
            case 'key':
              await this.browserAgent.page.keyboard.press(step.key);
              break;
            case 'wait':
            case 'delay':
              await this.browserAgent.wait(step.ms || 2000);
              break;
            case 'fill_credentials':
            case 'fillCredentials':
              if (this.siteMemory) {
                const creds = this.siteMemory.getCredentials(step.credentialId);
                if (creds) {
                  await this.browserAgent.login(creds);
                }
              }
              break;
            case 'click_submit':
            case 'clickSubmit':
              try {
                const submitBtn = await this.browserAgent.page.$('button[type="submit"], form button');
                if (submitBtn) await submitBtn.click();
                else await this.browserAgent.page.keyboard.press('Enter');
              } catch (e) {
                await this.browserAgent.page.keyboard.press('Enter');
              }
              break;
            case 'wait_navigation':
            case 'waitNavigation':
              try {
                await this.browserAgent.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
              } catch (e) { /* SPA */ }
              await this.browserAgent.wait(2000);
              break;
            case 'explore_page':
            case 'explorePage':
            case 'analyze':
              await this.browserAgent.explorePage();
              break;
            case 'search_google':
            case 'searchGoogle':
            case 'google_search':
              // Use searchWeb (Google + DuckDuckGo fallback)
              if (this.browserAgent.searchWeb) {
                await this.browserAgent.searchWeb(step.query || step.text || step.searchQuery || '');
              } else {
                await this.browserAgent.searchGoogle(step.query || step.text || step.searchQuery || '');
              }
              break;
            case 'screenshot':
              await this.browserAgent.takeScreenshot(step.name || `step-${Date.now()}`);
              break;
            case 'scroll':
              await this.browserAgent.page.evaluate((amt) => window.scrollBy(0, amt), step.amount || 500);
              break;
            case 'extract_results':
            case 'extractResults':
              // Just continue — results are on the page
              break;
            case 'wait_for':
            case 'waitFor':
              await this.browserAgent.page.waitForSelector(step.selector, { timeout: step.timeout || 10000 });
              break;
            default:
              this.onProgress(`  ⚠️ Unhandled step: ${step.action} (continuing)`);
              break;
          }
        }

        // Record the run
        if (this.sopManager) {
          await this.sopManager.recordRun(sop.id, true);
        }

        const title = await this.browserAgent.getCurrentTitle();
        const url = await this.browserAgent.getCurrentUrl();

        return {
          success: true,
          message: `✅ **SOP Complete: "${sop.name}"**\n\n` +
                   `📋 All ${sop.steps.length} steps executed\n` +
                   (title ? `📄 Current page: ${title}\n` : '') +
                   (url ? `🔗 ${url}\n` : '') +
                   `\nI'm now logged in and ready. What would you like me to do?`,
          actions: [{ type: 'run_sop', sopId: sop.id }],
          data: { sopId: sop.id, sopName: sop.name }
        };
      } catch (error) {
        if (this.sopManager) {
          await this.sopManager.recordRun(sop.id, false);
        }
        return {
          success: false,
          message: `❌ **SOP failed:** ${error.message}\n\nWould you like me to try again?`
        };
      }
    }

    return { success: false, message: '❌ No browser agent available to execute the SOP.' };
  }

  async execExecuteSkill(params) {
    const { skill, query } = params;

    if (!skill) {
      return { success: false, message: '⚠️ No matching skill found.' };
    }

    this.onProgress(`⚡ Activating skill: "${skill.name}"`);

    if (!this.aiManager) {
      return { success: false, message: '⚠️ AI not available.' };
    }

    const skillInstructions = skill.systemPrompt || skill.prompt || '';
    const systemPrompt = `You are Ace, an AI Executive Assistant executing a specialized skill.

═══ ACTIVE SKILL: ${skill.name} ═══
Description: ${skill.description}

═══ SKILL INSTRUCTIONS ═══
${skillInstructions}

═══ END INSTRUCTIONS ═══

Your task is to process the user's request based *only* on the skill instructions.
- Adhere strictly to the requested 'outputFormat' for the skill.`;

    try {
      const messages = [{ role: 'user', content: query }];
      const response = await this.aiManager.chat(messages, {
        systemPrompt: systemPrompt,
        maxTokens: 4000,
      });

      const content = response.content || response.text || '';
      
      return {
        success: true,
        message: `⚡ **Skill: ${skill.name}**\n\n${content}`,
        data: { skillId: skill.id, skillName: skill.name, executed: true }
      };

    } catch (error) {
      console.error(`Skill execution failed (${skill.name}):`, error.message);
      return { success: false, message: `❌ Skill execution failed: ${error.message}` };
    }
  }

  // ─── EXEC CODE ────────────────────────────────────────
  async execCode(message, context = {}) {
    console.log('[ActionEngine] execCode called');

    // If there's an active project context, route file operations to that project
    if (context.activeProject || context.projectDir) {
      const projectName = context.activeProject;
      const projectDir = context.projectDir || `projects/${projectName}`;
      console.log(`[ActionEngine] 📂 Code task with active project context: ${projectName} (${projectDir})`);
      // Do NOT create a new project — edit the existing one
    }

    // First check if there's a matching skill for this code request (e.g., landing-page-builder)
    if (this.skillsManager) {
      const matchedSkill = this.skillsManager.findMatchingSkill(message);
      if (matchedSkill && (matchedSkill.executionMode === 'code-agent' || matchedSkill.category === 'technology')) {
        console.log(`[ActionEngine] Matched code skill: "${matchedSkill.name}" — executing via skill system`);
        return await this.execUseSkill({ skill: matchedSkill, query: message });
      }
    }

    if (!this.agentOrchestrator) {
      console.log('[ActionEngine] AgentOrchestrator not connected — cannot route code task');
      return { success: false, message: '❌ Code agent not available. AgentOrchestrator is not connected.' };
    }

    try {
      const taskDesc = typeof message === 'string' ? message : (message.description || 'Execute code task');
      console.log(`[ActionEngine] Routing code task to AgentOrchestrator: "${taskDesc.substring(0, 80)}..."`);
      
      // Pass project context to the orchestrator so it routes files correctly
      const executeOptions = {};
      if (context.activeProject) {
        executeOptions.projectName = context.activeProject;
        executeOptions.projectDir = context.projectDir || `projects/${context.activeProject}`;
        executeOptions.editMode = context.editMode || false;
      }

      const result = await this.agentOrchestrator.execute(taskDesc, executeOptions);
      
      // Propagate the actual success/failure status from the orchestrator
      const success = result.success !== false;
      console.log(`[ActionEngine] Code task ${success ? 'completed' : 'failed'}: ${result.summary || ''}`);

      return {
        success,
        message: result.summary || (success ? '✅ Code task completed successfully' : '❌ Code task failed'),
        data: result,
        result
      };
    } catch (error) {
      console.log(`[ActionEngine] execCode error: ${error.message}`);
      return { success: false, message: `❌ Code execution failed: ${error.message}` };
    }
  }

  // ─── SCHEDULE ROUTINE ──────────────────────────────
  async execScheduleRoutine(params, originalMessage) {
    if (!this.autonomousScheduler) {
      return {
        success: false,
        message: `⚠️ Scheduler not available. The autonomous scheduler needs to be initialized first.`
      };
    }

    // Find related SOPs
    const relatedSOPs = this.sopManager ?
      this.sopManager.getAllSOPs().filter(sop => {
        const sopText = `${sop.name} ${sop.description}`.toLowerCase();
        return params.taskName.toLowerCase().split(/\s+/)
          .filter(w => w.length > 3)
          .some(w => sopText.includes(w));
      }) : [];

    try {
      const routine = await this.autonomousScheduler.addRoutine({
        name: params.taskName,
        description: originalMessage,
        time: params.time,
        days: params.days,
        sopIds: relatedSOPs.map(s => s.id),
        enabled: true
      });

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const daysStr = params.days.map(d => dayNames[d]).join(', ');

      return {
        success: true,
        message: `⏰ **Routine scheduled!**\n\n` +
                 `📅 **${params.taskName}**\n` +
                 `🕐 Time: ${params.time}\n` +
                 `📆 Days: ${daysStr}\n` +
                 (relatedSOPs.length > 0 ?
                   `📋 Linked SOPs: ${relatedSOPs.map(s => s.name).join(', ')}\n` :
                   `ℹ️ No matching SOPs found — I'll learn the steps as you teach me.\n`) +
                 `\nI'll execute this routine automatically at the scheduled time!`,
        actions: [{ type: 'schedule_routine', routine }],
        data: { routine }
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to schedule routine: ${error.message}`
      };
    }
  }

  // ─── SYSTEM MAINTENANCE ──────────────────────────────
  async execSystemMaintenance(params) {
    this.onProgress('🔄 System Maintenance: Checking environment...');

    if (!this.codeAgent) {
      return { success: false, message: '❌ Code Agent not available. Cannot perform system maintenance.' };
    }

    try {
      // 1. Install dependencies
      this.onProgress('📦 Running npm install...');
      const installResult = await this.codeAgent.runCommand('npm install');
      
      // 2. Check git status
      this.onProgress('📊 Checking git status...');
      const statusResult = await this.codeAgent.runCommand('git status');

      return {
        success: true,
        message: `✅ **System Updates Prepared**\n\n` +
                 `📦 **Dependencies:** ${installResult.success ? 'Updated' : 'Failed'}\n` +
                 `📊 **Git Status:**\n\`\`\`\n${statusResult.stdout || 'No changes'}\n\`\`\`\n\n` +
                 `**To finish redeploying:**\n` +
                 `1. Stop the current process (Ctrl+C)\n` +
                 `2. Run the start script again (e.g., \`npm run dashboard\` or \`npm run telegram\`)`,
        actions: [{ type: 'system_maintenance', status: 'prepared' }]
      };
    } catch (error) {
      return { success: false, message: `❌ Maintenance failed: ${error.message}` };
    }
  }

  /**
   * Robustly parse AI email JSON response — handles malformed JSON from LLMs
   * Tries: JSON.parse → cleaned JSON.parse → regex extraction → line splitting
   */
  _parseAIEmailResponse(content) {
    let subject = '';
    let body = '';

    // Step 1: Try standard JSON.parse on the first JSON object found
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) body = parsed.body;
        if (subject || body) return { subject, body };
      } catch (e) {
        // JSON.parse failed — try cleaning up
      }

      // Step 2: Clean common LLM JSON issues (control chars, unescaped newlines)
      try {
        let cleaned = jsonMatch[0];
        // Fix unescaped newlines/tabs inside JSON string values
        cleaned = cleaned.replace(/"((?:[^"\\]|\\.)*)"/g, (match) => {
          try { JSON.parse(match); return match; } catch (e) { /* needs fixing */ }
          // Escape unescaped control characters inside the string
          const inner = match.slice(1, -1);
          const fixed = inner
            .replace(/(?<!\\)\n/g, '\\n')
            .replace(/(?<!\\)\r/g, '\\r')
            .replace(/(?<!\\)\t/g, '\\t')
            .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
          return '"' + fixed + '"';
        });
        // Remove trailing commas
        cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        const parsed = JSON.parse(cleaned);
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) body = parsed.body;
        if (subject || body) return { subject, body };
      } catch (e) {
        // Still failed — fall through to regex
      }
    }

    // Step 3: Regex extraction — look for "subject" and "body" key-value pairs
    // Handle properly escaped strings first
    let sm = content.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
    if (!sm) {
      // Handle unescaped newlines in value (greedy match bounded by closing quote + comma/brace)
      sm = content.match(/"subject"\s*:\s*"([\s\S]*?)"\s*[,}]/i);
    }
    if (sm) subject = sm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    let bm = content.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)"/i);
    if (!bm) {
      bm = content.match(/"body"\s*:\s*"([\s\S]*?)"\s*[,}]/i);
    }
    if (bm) body = bm[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    if (subject || body) return { subject, body };

    // Step 4: Last resort — first non-empty line = subject, rest = body
    const lines = content.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('{') && !l.trim().startsWith('}'));
    if (lines.length > 0) {
      subject = lines[0].replace(/[{}"]/g, '').replace(/^subject\s*:\s*/i, '').trim();
      if (lines.length > 1) {
        body = lines.slice(1).map(l => l.replace(/[{}"]/g, '').replace(/^body\s*:\s*/i, '').trim()).join('\n');
      }
    }

    return { subject, body };
  }

  // ═══════════════════════════════════════════════════════
  // THE SOUL — Resource & Data Generation
  // ═══════════════════════════════════════════════════════

  /**
   * Generate realistic lead names for a given industry and location
   */
  generateLeadNames(count, industry, location) {
    const firstNames = ['James', 'Sarah', 'Michael', 'Jennifer', 'David', 'Maria', 'Robert', 'Lisa', 'Carlos', 'Emily',
                        'Richard', 'Patricia', 'John', 'Linda', 'Thomas', 'Jessica', 'Daniel', 'Angela', 'William', 'Amanda'];
    const lastNames = ['Johnson', 'Williams', 'Martinez', 'Brown', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Wilson', 'Anderson',
                       'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson', 'Moore', 'Allen', 'Young', 'King'];
    
    const companyPrefixes = {
      'real estate': ['Premier', 'Coastal', 'Sunshine', 'Elite', 'First', 'National', 'Heritage', 'Pacific', 'Metro', 'Crown'],
      'technology': ['TechVista', 'DataFlow', 'CloudNine', 'ByteForce', 'Neural', 'Quantum', 'Pixel', 'CyberEdge', 'DigiCore', 'CodeCraft'],
      'healthcare': ['MedCore', 'HealthFirst', 'WellCare', 'VitalPath', 'CurePoint', 'MediLink', 'PrimeCare', 'BioHealth', 'LifeSpan', 'CareView'],
      'finance': ['Capital', 'Wealth', 'Trust', 'Equity', 'Sterling', 'Meridian', 'Summit', 'Apex', 'Pinnacle', 'Fortress'],
      'construction': ['BuildRight', 'StoneBridge', 'Ironclad', 'ProBuild', 'Structural', 'Foundation', 'Keystone', 'FrameWorks', 'SolidGround', 'Apex'],
      'food & beverage': ['Culinary', 'Fresh', 'Garden', 'Harvest', 'Artisan', 'Savory', 'Golden', 'Blue Plate', 'Farm Table', 'Rustic'],
      'events': ['Encore', 'Spotlight', 'GrandEvent', 'Prestige', 'Celebration', 'Momentum', 'Horizon', 'Luxe', 'Vivid', 'Elevate'],
      'marketing': ['BrandForge', 'MediaPulse', 'CreativeEdge', 'Amplify', 'Catalyst', 'Ignite', 'Nexus', 'Prism', 'Beacon', 'Spark'],
      'legal': ['Justice', 'Liberty', 'Sterling', 'Advocate', 'Counsel', 'Lexington', 'Barrington', 'Commonwealth', 'Heritage', 'Prestige']
    };

    const companySuffixes = {
      'real estate': ['Realty', 'Properties', 'Real Estate Group', 'Homes', 'Investments'],
      'technology': ['Technologies', 'Solutions', 'Systems', 'Labs', 'Digital'],
      'healthcare': ['Health', 'Medical Group', 'Clinic', 'Wellness Center', 'Healthcare'],
      'finance': ['Financial', 'Advisors', 'Partners', 'Capital Group', 'Investments'],
      'construction': ['Construction', 'Builders', 'Contracting', 'Development', 'Services'],
      'food & beverage': ['Kitchen', 'Catering', 'Restaurant Group', 'Bistro', 'Foods'],
      'events': ['Events', 'Productions', 'Entertainment', 'Experiences', 'Co.'],
      'marketing': ['Marketing', 'Agency', 'Creative', 'Media', 'Group'],
      'legal': ['Law Firm', 'Legal Group', '& Associates', 'Attorneys', 'Law']
    };

    const prefixes = companyPrefixes[industry] || companyPrefixes['technology'];
    const suffixes = companySuffixes[industry] || companySuffixes['technology'];
    const loc = location || 'Local';

    const leads = [];
    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const company = `${prefix} ${suffix}`;
      const emailDomain = company.toLowerCase().replace(/[^a-z]/g, '') + '.com';
      
      leads.push({
        name: `${firstName} ${lastName}`,
        company: company,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`,
        phone: `(${Math.floor(200 + Math.random() * 800)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`
      });
    }
    
    return leads;
  }

  /**
   * Extract structured items (events, dates, locations) from a message.
   * Used by execUseSkill and execCreateStrategy to detect multi-item requests.
   * Returns: { items: [...], type: string, count: number, summary: string }
   */
  _extractStructuredItems(message) {
    const result = { items: [], type: 'items', count: 0, summary: '' };

    // Pattern: Event blocks (Date + Name + Venue/Address)
    const eventBlockRegex = /(?:^|\n)\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}(?:\s*[-–,]\s*\d{1,2})?(?:\s*,?\s*\d{4})?)\s*\n\s*([^\n]+)(?:\n\s*([^\n]*(?:\d{3,5}\s+\w|\d{5}|FL|CA|TX|NY|GA|NC|OH|IL|PA|NJ|VA|WA|OR|CO|AZ|NV|UT|MA|MD|CT|SC|AL|TN|MN|WI|MO|IN|KY|LA|OK|AR|MS|KS|IA|NE|NM|HI|ID|ME|MT|NH|ND|RI|SD|VT|WV|WY)[^\n]*))?/gim;

    let match;
    while ((match = eventBlockRegex.exec(message)) !== null) {
      const date = match[1].trim();
      const name = match[2].trim().replace(/\s*Join\s*&?\s*Connect\s*/gi, '').trim();
      const venueAddress = match[3] ? match[3].trim().replace(/\s*Join\s*&?\s*Connect\s*/gi, '').trim() : '';
      
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

      const cityMatch = (name + ' ' + venueAddress).match(/(?:Tampa|Miami|St\.?\s*Pet(?:e|ersburg)|Fort\s*Lauderdale|Orlando|O-Town|Jacksonville|Naples|Boca\s*Raton|Sarasota|Clearwater)/i);
      if (cityMatch) city = cityMatch[0].replace(/O-Town/i, 'Orlando');

      result.items.push({ date, name, venue, address, city, fullText: match[0].trim() });
    }

    // Fallback: date-line extraction
    if (result.items.length === 0) {
      const lines = message.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const dateLine = lines[i].trim();
        if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}/i.test(dateLine)) {
          const nextLines = lines.slice(i + 1, i + 4).map(l => l.trim()).filter(l => l && !/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s+\d{1,2}/i.test(l) && !/^Join\s*&?\s*Connect$/i.test(l));
          const name = nextLines[0] || `Event on ${dateLine}`;
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
          
          const cityFromText = (name + ' ' + venueAddress).match(/(?:Tampa|Miami|St\.?\s*Pet(?:e|ersburg)|Fort\s*Lauderdale|Orlando|O-Town|Jacksonville)/i);
          if (cityFromText) city = cityFromText[0].replace(/O-Town/i, 'Orlando');

          result.items.push({ date: dateLine, name, venue, address, city, fullText: [dateLine, name, venueAddress].filter(Boolean).join('\n') });
        }
      }
    }

    if (result.items.length > 0) {
      result.type = 'events';
      result.count = result.items.length;
      result.summary = `${result.count} events: ${result.items.map(e => `${e.date} — ${e.city || e.name}`).join(', ')}`;
    }

    return result;
  }

  /**
   * Generate a basic strategy when AI is not available
   */
  generateBasicStrategy(params) {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return `## ${params.type.toUpperCase()} Strategy: ${params.topic}

### Objectives
1. Increase visibility and reach in target market
2. Generate qualified leads through strategic outreach
3. Build brand authority in the ${params.type} space

### Phase 1: Foundation (This Week - ${nextWeek.toLocaleDateString()})
- [ ] Audit current ${params.type} assets and performance
- [ ] Identify top 3 competitors and analyze their approach
- [ ] Define target audience personas
- [ ] Set up tracking and analytics

### Phase 2: Execution (Next 2 Weeks)
- [ ] Create content calendar with 3 posts/week
- [ ] Launch outreach campaign to top 20 prospects
- [ ] Set up automated follow-up sequences
- [ ] Monitor engagement metrics daily

### Phase 3: Optimization (By ${nextMonth.toLocaleDateString()})
- [ ] Analyze results and identify top performers
- [ ] Double down on what's working
- [ ] Cut what's not converting
- [ ] Scale successful channels

### Key Metrics to Track
- Lead conversion rate (target: 5%)
- Engagement rate (target: 3%+)
- Response rate on outreach (target: 15%)
- Pipeline value growth (target: 20% MoM)

### Next Steps
1. Start Phase 1 immediately
2. Review progress in 3 days
3. Adjust based on initial data`;
  }

  // ═══════════════════════════════════════════════════════
  // THE SOUL — State Queries
  // ═══════════════════════════════════════════════════════

  /**
   * Get current system state as context string for AI
   */
  async getLiveContext() {
    const sections = [];
    
    const now = new Date();
    sections.push(`CURRENT: ${now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);

    if (this.pipelineManager) {
      try {
        const pipeline = await this.pipelineManager.getPipeline();
        const tasks = pipeline.items || [];
        const leads = pipeline.leads || [];
        sections.push(`PIPELINE: ${tasks.length} tasks, ${leads.length} leads`);
        if (tasks.length > 0) {
          sections.push(`RECENT TASKS: ${tasks.slice(-3).map(t => t.title).join(', ')}`);
        }
        if (leads.length > 0) {
          sections.push(`RECENT LEADS: ${leads.slice(-3).map(l => l.name).join(', ')}`);
        }
      } catch (e) { /* ignore */ }
    }

    if (this.sopManager) {
      const sops = this.sopManager.getAllSOPs();
      if (sops.length > 0) {
        sections.push(`AVAILABLE SOPS: ${sops.map(s => s.name).join(', ')}`);
      }
    }

    return sections.join('\n');
  }

  // ═══════════════════════════════════════════════════════
  // FILE OUTPUT — Save skill outputs to files
  // ═══════════════════════════════════════════════════════

  /**
   * Check if content contains HTML markup (indicates a generated page/component)
   */
  _containsHtmlContent(content) {
    if (!content || typeof content !== 'string') return false;
    // Look for DOCTYPE, <html>, or significant HTML tags indicating a full page
    return (
      content.includes('<!DOCTYPE') ||
      content.includes('<html') ||
      (content.includes('<head>') && content.includes('<body>')) ||
      (content.includes('<style>') && content.includes('<script>'))
    );
  }

  /**
   * Extract HTML content from a skill output that may contain markdown-wrapped code blocks.
   * The AI often wraps HTML in ```html ... ``` code fences.
   */
  _extractHtmlFromContent(content) {
    // Try to extract HTML from markdown code blocks first
    const htmlBlockMatch = content.match(/```html?\s*\n?([\s\S]*?)```/i);
    if (htmlBlockMatch) {
      return htmlBlockMatch[1].trim();
    }

    // If the content itself starts with <!DOCTYPE or <html, use it directly
    const trimmed = content.trim();
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      return trimmed;
    }

    // Otherwise, try to find the HTML portion starting from <!DOCTYPE or <html
    const docTypeIdx = content.indexOf('<!DOCTYPE');
    const htmlIdx = content.indexOf('<html');
    const startIdx = docTypeIdx >= 0 ? docTypeIdx : htmlIdx;
    
    if (startIdx >= 0) {
      // Find the closing </html> tag
      const endIdx = content.lastIndexOf('</html>');
      if (endIdx > startIdx) {
        return content.substring(startIdx, endIdx + '</html>'.length);
      }
      return content.substring(startIdx);
    }

    // Return original content if no HTML structure found
    return content;
  }

  /**
   * Save skill output (HTML/code) to the projects/ directory.
   * Returns { filePath, fileName, projectName } or null if not applicable.
   */
  async _saveSkillOutputToFile(skill, content, query) {
    // Generate a clean project name from the skill name and a timestamp
    const timestamp = Date.now();
    const skillSlug = (skill.id || skill.name || 'output')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    const projectName = `${skillSlug}-${timestamp}`;
    const projectDir = path.join(this.baseDir, 'projects', projectName);
    
    // Ensure the projects directory exists
    await fs.mkdir(projectDir, { recursive: true });
    
    // Extract clean HTML from the content
    const htmlContent = this._extractHtmlFromContent(content);
    const fileName = 'index.html';
    const filePath = path.join(projectDir, fileName);
    
    await fs.writeFile(filePath, htmlContent, 'utf8');
    
    this.onProgress(`📁 Saved skill output to: projects/${projectName}/${fileName} (${htmlContent.length} bytes)`);

    // Register project with ProjectManager so it gets a project.json and shows in Studio
    if (this.projectManager) {
      try {
        await this.projectManager.ensureProjectJson(projectName);
        this.onProgress(`📋 Registered project "${projectName}" with ProjectManager`);
      } catch (err) {
        this.onProgress(`⚠️ Failed to register project with ProjectManager: ${err.message}`);
      }
    }
    
    return { filePath, fileName, projectName };
  }

  // ═══════════════════════════════════════════════════════
  // WIRING — Agent Setters
  // ═══════════════════════════════════════════════════════

  /**
   * Connect the AgentOrchestrator for routing tasks to specialized agents
   */
  setAgentOrchestrator(orchestrator) {
    this.agentOrchestrator = orchestrator;
    console.log('[ActionEngine] AgentOrchestrator connected');
  }

  /**
   * Connect the CodeAgent for direct code generation/editing tasks
   */
  setCodeAgent(codeAgent) {
    this.codeAgent = codeAgent;
    console.log('[ActionEngine] CodeAgent connected');
  }

  /**
   * Connect the ProjectManager for project creation/management
   */
  setProjectManager(projectManager) {
    this.projectManager = projectManager;
    console.log('[ActionEngine] ✅ ProjectManager connected');
  }

  /**
   * Connect the DeployPipeline for project deployment
   */
  setDeployPipeline(deployPipeline) {
    this.deployPipeline = deployPipeline;
    console.log('[ActionEngine] ✅ DeployPipeline connected');
  }

  // ═══════════════════════════════════════════════════════
  // STUDIO CONTEXT — Parse project context from Studio chat
  // ═══════════════════════════════════════════════════════

  /**
   * Pre-process studio project context from message prefix.
   * Messages from Studio chat may start with "[Studio Project: <name>]"
   * to indicate which project the user is working on.
   */
  _parseStudioContext(message, context) {
    const studioMatch = message.match(/^\[Studio Project:\s*(.+?)\]\s*/i);
    if (studioMatch) {
      context.activeProject = studioMatch[1].trim();
      message = message.slice(studioMatch[0].length).trim();
      console.log(`[ActionEngine] 📂 Active project context: ${context.activeProject}`);
    }
    return { message, context };
  }

  // ═══════════════════════════════════════════════════════
  // PROJECT ACTIONS — Create, Edit, Deploy
  // ═══════════════════════════════════════════════════════

  /**
   * Create a new project via ProjectManager
   */
  async execCreateProject(message, context = {}) {
    try {
      console.log('[ActionEngine] 🏗️ Creating project via ProjectManager');
      
      // Extract project description from message
      const description = message;
      
      // Determine project type from message (match all 9 template types)
      let projectType = 'web-app'; // default
      const lower = message.toLowerCase();
      if (/react\s*native|mobile\s*app|expo/i.test(message)) projectType = 'react-native';
      else if (/\breact\b/i.test(message)) projectType = 'react-app';
      else if (/\bnext\.?js\b|\bnext\s*app\b/i.test(message)) projectType = 'next-app';
      else if (/\bwidget\b|\bembeddable\b/i.test(message)) projectType = 'widget';
      else if (/landing\s*page/i.test(message)) projectType = 'landing-page';
      else if (/\bapi\b|\bserver\b|\bbackend\b|\bexpress\b/i.test(message)) projectType = 'express-api';
      else if (/full[\s-]*stack/i.test(message)) projectType = 'fullstack';
      else if (/static\s*site/i.test(message)) projectType = 'static-site';
      
      // Generate a meaningful project name from the message
      // 1. Try explicit "called X" or "named X"
      const nameMatch = message.match(/(?:called|named)\s+["\']?([^"'\s,]+)/i);
      let projectName = nameMatch ? nameMatch[1] : null;
      
      if (!projectName) {
        // 2. Try "for X" pattern FIRST (more reliable for "create an app for wine collection")
        const forMatch = message.match(/\bfor\s+(?:a\s+|an\s+|the\s+)?(?:tracking\s+|counting\s+|managing\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i);
        if (forMatch) {
          const subject = forMatch[1].toLowerCase()
            .replace(/\b(a|an|the|my|our|that|this|and|or)\b/g, '').trim();
          if (subject.length > 2) projectName = subject.replace(/\s+/g, '-');
        }
      }

      if (!projectName) {
        // 3. Try "X app/webapp/site" pattern — but filter out action verbs
        const appPattern = message.match(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})\s+(app|webapp|website|site|page|widget|tool|tracker|dashboard|platform)\b/i);
        if (appPattern) {
          const subject = appPattern[1].toLowerCase()
            .replace(/\b(a|an|the|my|our|me|new|simple|basic|cool|nice|great|good|your|this|that|one|big|real|create|build|make|hey|can|you|please|help|want|need|ace)\b/g, '').trim();
          if (subject.length > 2) {
            projectName = `${subject}-${appPattern[2]}`.toLowerCase().replace(/\s+/g, '-');
          }
        }
      }

      if (!projectName) {
        // 3. Try "for X" pattern
        const forMatch = message.match(/\bfor\s+(?:a\s+|an\s+|the\s+)?(?:tracking\s+|counting\s+|managing\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i);
        if (forMatch) {
          const subject = forMatch[1].toLowerCase()
            .replace(/\b(a|an|the|my|our|that|this)\b/g, '').trim();
          if (subject.length > 2) projectName = subject.replace(/\s+/g, '-');
        }
      }
      
      if (!projectName) {
        // 4. Generate from meaningful keywords (extensive stop-word list)
        const stopWords = new Set([
          'hey', 'hi', 'hello', 'ace', 'can', 'you', 'could', 'would', 'will',
          'please', 'help', 'me', 'my', 'our', 'i', 'we', 'us', 'the', 'a', 'an',
          'create', 'build', 'make', 'generate', 'develop', 'write', 'code', 'scaffold',
          'new', 'for', 'with', 'like', 'want', 'need', 'some', 'something',
          'that', 'this', 'and', 'or', 'but', 'also', 'more', 'very',
          'to', 'be', 'is', 'are', 'was', 'were', 'been', 'being',
          'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got',
          'really', 'just', 'about', 'what', 'how', 'where', 'when',
          'think', 'know', 'let', 'should', 'put', 'together', 'webapp', 'app'
        ]);
        
        projectName = lower
          .replace(/[^a-z\s]/g, '')
          .trim()
          .split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w))
          .slice(0, 3)
          .join('-');
      }
      
      // Sanitize and fallback
      projectName = (projectName || '').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
      if (!projectName || projectName.length < 2) projectName = `project-${Date.now()}`;
      
      if (this.projectManager) {
        const result = await this.projectManager.createProject(projectName, projectType, description);
        
        const previewUrl = `http://localhost:3333/projects/${projectName}/`;
        let aiGenerated = false;
        let filesWritten = [];

        // --- AI-Powered Code Generation ---
        if (this.aiManager) {
          try {
            console.log('[ActionEngine] 🤖 Attempting AI-powered code generation...');
            const prompt = this._buildProjectGenerationPrompt(description, projectType, projectName);
            const provider = this._getCodeGenerationProvider();
            
            const aiResponse = await this.aiManager.chat(
              [{ role: 'user', content: `${prompt.system}\n\n${prompt.user}` }],
              { provider, temperature: 0.7, maxTokens: 8192 }
            );
            
            const parsedFiles = this._parseAIGeneratedFiles(aiResponse.content);
            
            if (parsedFiles.length > 0) {
              for (const file of parsedFiles) {
                try {
                  await this.projectManager.writeFile(projectName, file.path, file.content);
                  filesWritten.push(file.path);
                } catch (writeErr) {
                  console.warn(`[ActionEngine] ⚠️ Failed to write AI file ${file.path}:`, writeErr.message);
                }
              }
              aiGenerated = filesWritten.length > 0;
              console.log(`[ActionEngine] ✅ AI generated ${filesWritten.length} files for project "${projectName}"`);
            }
          } catch (aiError) {
            console.warn('[ActionEngine] ⚠️ AI code generation failed, using template scaffolding:', aiError.message);
            // Fall through to return with template-only project
          }
        }

        const aiNote = aiGenerated
          ? `\n\n🤖 AI generated ${filesWritten.length} file(s): ${filesWritten.join(', ')}`
          : '\n\n📁 Project created with template scaffolding.';

        return {
          success: true,
          message: `✅ Project "${projectName}" created successfully!\n\n🔗 Preview: ${previewUrl}${aiNote}\n\nYou can view and edit it in Studio.`,
          data: {
            projectName: projectName,
            previewUrl: previewUrl,
            aiGenerated,
            filesWritten,
            ...result
          }
        };
      } else {
        // Fallback to CodeAgent if ProjectManager not available
        console.log('[ActionEngine] ⚠️ ProjectManager not available, falling back to code task');
        return await this.execCode(message, context);
      }
    } catch (error) {
      console.error('[ActionEngine] ❌ Create project error:', error);
      return { success: false, message: `Failed to create project: ${error.message}` };
    }
  }

  /**
   * Deploy a project via DeployPipeline
   */
  async execDeployProject(message, context = {}) {
    try {
      // Determine which project to deploy
      let projectName = context.activeProject;
      
      if (!projectName) {
        // Try to extract from message
        const nameMatch = message.match(/deploy\s+(?:the\s+)?(\S+)/i);
        projectName = nameMatch ? nameMatch[1].replace(/[^a-z0-9-]/gi, '') : null;
      }
      
      if (!projectName) {
        return { success: true, message: '❓ Which project would you like to deploy? Please specify the project name or open it in Studio first.' };
      }
      
      // Determine deploy target
      let target = 'local'; // default
      if (/firebase/i.test(message)) target = 'firebase';
      else if (/likeminded/i.test(message)) target = 'likemindedpro';
      else if (/vercel/i.test(message)) target = 'vercel';
      else if (/netlify/i.test(message)) target = 'netlify';
      
      console.log(`[ActionEngine] 🚀 Deploying project "${projectName}" to ${target}`);
      
      if (this.deployPipeline) {
        const result = await this.deployPipeline.deploy(projectName, { target });
        return {
          success: true,
          message: `🚀 Project "${projectName}" deployed to ${target}!\n\n🔗 URL: ${result.url || 'Deployment in progress...'}`,
          data: { projectName, target, ...result }
        };
      } else {
        return { success: true, message: `⚠️ Deploy pipeline not available. Project "${projectName}" is ready at: http://localhost:3333/projects/${projectName}/` };
      }
    } catch (error) {
      console.error('[ActionEngine] ❌ Deploy error:', error);
      return { success: false, message: `Failed to deploy: ${error.message}` };
    }
  }

  /**
   * Edit an existing project — uses AI to intelligently modify project files
   */
  async execEditProject(message, context = {}) {
    try {
      const projectName = context.activeProject;
      if (!projectName) {
        return { success: true, message: '❓ No active project. Please specify which project to edit or open one in Studio.' };
      }
      
      console.log(`[ActionEngine] ✏️ Editing project "${projectName}": ${message}`);

      // --- AI-Powered Project Editing ---
      if (this.aiManager && this.projectManager) {
        try {
          // 1. Get file tree and read all project files
          const fileTree = await this.projectManager.getFileTree(projectName);
          const currentFiles = await this._readProjectFiles(projectName, fileTree);

          if (currentFiles.length === 0) {
            return { success: false, message: `⚠️ Project "${projectName}" has no readable files to edit.` };
          }

          // 2. Build the edit prompt with current file contents
          const prompt = this._buildProjectEditPrompt(message, currentFiles);
          const provider = this._getCodeGenerationProvider();

          // 3. Call AI with lower temperature for precise edits
          const aiResponse = await this.aiManager.chat(
            [{ role: 'user', content: `${prompt.system}\n\n${prompt.user}` }],
            { provider, temperature: 0.3, maxTokens: 8192 }
          );

          // 4. Parse modified files from AI response
          const modifiedFiles = this._parseAIGeneratedFiles(aiResponse.content);
          const filesUpdated = [];

          // 5. Write each modified file back to the project
          for (const file of modifiedFiles) {
            try {
              await this.projectManager.writeFile(projectName, file.path, file.content);
              filesUpdated.push(file.path);
            } catch (writeErr) {
              console.warn(`[ActionEngine] ⚠️ Failed to write edited file ${file.path}:`, writeErr.message);
            }
          }

          if (filesUpdated.length > 0) {
            console.log(`[ActionEngine] ✅ AI edited ${filesUpdated.length} files in project "${projectName}"`);
            return {
              success: true,
              message: `✏️ Updated project "${projectName}"!\n\n🤖 AI modified ${filesUpdated.length} file(s):\n${filesUpdated.map(f => `  • ${f}`).join('\n')}\n\nRefresh the preview to see updates.`,
              data: {
                projectName,
                filesUpdated,
                aiEdited: true
              }
            };
          } else {
            console.warn('[ActionEngine] ⚠️ AI returned no parseable file modifications');
          }
        } catch (aiError) {
          console.warn('[ActionEngine] ⚠️ AI editing failed, falling back to CodeAgent:', aiError.message);
        }
      }

      // Fallback: Use CodeAgent to determine what to edit
      const projectContext = {
        ...context,
        activeProject: projectName,
        projectDir: `projects/${projectName}`,
        editMode: true
      };
      
      const result = await this.execCode(message, projectContext);
      
      return {
        success: result.success !== false,
        message: `✏️ Updated project "${projectName}"!\n\n${result.message || 'Changes applied. Refresh the preview to see updates.'}`,
        data: {
          projectName: projectName,
          ...result.data
        }
      };
    } catch (error) {
      console.error('[ActionEngine] ❌ Edit project error:', error);
      return { success: false, message: `Failed to edit project: ${error.message}` };
    }
  }

  // ═══════════════════════════════════════════════════════
  // AI Code Generation Helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Determine the best AI provider for code generation tasks.
   * Uses the task routing preference if configured, otherwise active provider.
   * @returns {string|undefined} Provider name or undefined for default
   */
  _getCodeGenerationProvider() {
    try {
      return this.aiManager?.getProviderForTask('code');
    } catch (e) {
      // Ignore — fall through to default
    }
    return undefined;
  }

  /**
   * Build the prompt for AI-powered project generation.
   * @param {string} description - User's project description
   * @param {string} type - Project type (web-app, landing-page, etc.)
   * @param {string} name - Project name
   * @returns {{ system: string, user: string }}
   */
  _buildProjectGenerationPrompt(description, type, name) {
    const system = `You are an expert full-stack web developer. Generate production-ready, beautiful, functional code.
Output files in this exact format:

--- FILE: filename.ext ---
<file content here>
--- END FILE ---

Generate static HTML/CSS/JS that works directly in a browser iframe (NO React/build steps).
Use modern CSS (flexbox/grid, CSS variables, gradients, shadows, animations).
Make it fully responsive and visually polished with a professional design.
Include realistic sample data where appropriate.
Every file MUST use the --- FILE: / --- END FILE --- format. Do not use markdown code fences.`;

    const user = `Create a ${type} called "${name}": ${description}

Generate these files at minimum:
- index.html (main entry point with all structure)
- styles.css (all styling — modern, responsive, polished)
- app.js (all interactivity and functionality)

Add more files if needed for better organization. Remember: every file must use the --- FILE: / --- END FILE --- format.`;

    return { system, user };
  }

  /**
   * Parse AI-generated file content from the response.
   * Supports --- FILE: / --- END FILE --- blocks, fenced code blocks, and raw fallback.
   * @param {string} content - Raw AI response text
   * @returns {Array<{ path: string, content: string }>}
   */
  _parseAIGeneratedFiles(content) {
    const files = [];

    // Primary: Extract --- FILE: path --- ... --- END FILE --- blocks
    const fileBlockRegex = /--- FILE:\s*(.+?)\s*---\n([\s\S]*?)--- END FILE ---/g;
    let match;
    while ((match = fileBlockRegex.exec(content)) !== null) {
      const filePath = match[1].replace(/^\/+/, '').trim();
      // Strip any markdown code fences that might be inside the file content
      let fileContent = match[2].trimEnd()
        .replace(/^```\w*\n/, '')
        .replace(/\n```\s*$/, '');
      if (filePath && fileContent) {
        files.push({ path: filePath, content: fileContent });
      }
    }

    if (files.length > 0) return files;

    // Fallback 1: Try fenced code blocks with filename hints
    // Matches ```html, ```css, ```js/javascript with optional filename comment
    const fencedRegex = /```(\w+)\s*\n(?:\/[\/\*]\s*(\S+)\s*\*?\/?\n)?([\s\S]*?)```/g;
    const extMap = { html: 'index.html', css: 'styles.css', javascript: 'app.js', js: 'app.js' };
    const usedPaths = new Set();

    while ((match = fencedRegex.exec(content)) !== null) {
      const lang = match[1].toLowerCase();
      const commentFilename = match[2];
      const fileContent = match[3].trimEnd();
      
      let filePath = commentFilename || extMap[lang];
      if (!filePath) continue;
      
      filePath = filePath.replace(/^\/+/, '').trim();
      
      // Avoid duplicate paths
      if (usedPaths.has(filePath)) {
        const ext = filePath.includes('.') ? filePath.split('.').pop() : lang;
        filePath = `${filePath.replace(/\.\w+$/, '')}_${usedPaths.size}.${ext}`;
      }
      usedPaths.add(filePath);
      
      if (fileContent) {
        files.push({ path: filePath, content: fileContent });
      }
    }

    if (files.length > 0) return files;

    // Fallback 2: Wrap entire response as index.html
    const trimmed = content.trim();
    if (trimmed.length > 50) {
      files.push({ path: 'index.html', content: trimmed });
    }

    return files;
  }

  /**
   * Read all text files from a project's file tree.
   * Skips binary files, .history, node_modules, .git directories.
   * @param {string} projectName - Name of the project
   * @param {Array} fileTree - File tree from getFileTree()
   * @returns {Promise<Array<{ path: string, content: string }>>}
   */
  async _readProjectFiles(projectName, fileTree) {
    const files = [];
    const skipDirs = new Set(['.history', 'node_modules', '.git']);
    const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.svg', '.mp3', '.mp4', '.zip', '.tar', '.gz']);

    const traverse = async (nodes) => {
      for (const node of nodes) {
        if (node.type === 'directory') {
          if (skipDirs.has(node.name)) continue;
          if (node.children) {
            await traverse(node.children);
          }
        } else if (node.type === 'file') {
          // Skip binary files by extension
          const ext = '.' + (node.name.split('.').pop() || '').toLowerCase();
          if (binaryExts.has(ext)) continue;

          try {
            const result = await this.projectManager.readFile(projectName, node.path);
            files.push({ path: node.path, content: result.content });
          } catch (readErr) {
            console.warn(`[ActionEngine] ⚠️ Could not read file ${node.path}:`, readErr.message);
          }
        }
      }
    };

    await traverse(fileTree);
    return files;
  }

  /**
   * Build the prompt for AI-powered project editing.
   * @param {string} editRequest - User's edit request
   * @param {Array<{ path: string, content: string }>} currentFiles - Current project files
   * @returns {{ system: string, user: string }}
   */
  _buildProjectEditPrompt(editRequest, currentFiles) {
    const system = `You are an expert developer modifying an existing web project.
Output ONLY the files you modify, using this exact format:

--- FILE: filename.ext ---
<complete modified file content>
--- END FILE ---

Output the COMPLETE file content for each modified file (not diffs or patches).
Preserve the existing design, functionality, and code style.
Make targeted changes as requested. Do not use markdown code fences.`;

    let user = '=== CURRENT PROJECT FILES ===\n\n';
    for (const file of currentFiles) {
      user += `--- FILE: ${file.path} ---\n${file.content}\n--- END FILE ---\n\n`;
    }
    user += `=== EDIT REQUEST ===\n${editRequest}`;

    return { system, user };
  }
}
