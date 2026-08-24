/**
 * OpenAce - Core Engine
 * Your AI Executive Assistant with a soul
 *
 * Now with BRAIN:
 * - SiteMemory: Remembers website structures
 * - SOPManager: Stores learned procedures
 * - BrowserAgent: Automates browser actions
 */

import { AIProviderManager } from './ai-providers/AIProviderManager.js';
import { eventBus, EVENTS } from './events/EventBus.js';
import { TaskQueue } from './queue/TaskQueue.js';
import { StateManager } from './state/StateManager.js';
import { Logger, configureLogging, flushLogs } from './logging/Logger.js';
import { SkillsManager, DEFAULT_SKILLS } from './skills/SkillsManager.js';
import { KnowledgeBase } from './knowledge/KnowledgeBase.js';
import { WorkloadStore } from './knowledge/WorkloadStore.js';
import { HeartbeatMonitor } from './HeartbeatMonitor.js';
import { PermissionsManager } from './permissions/PermissionsManager.js';
import { ResearchAgent } from './agents/ResearchAgent.js';
import { PipelineManager } from './pipeline/PipelineManager.js';
import FormManager from './forms/FormManager.js';
import { SiteMemory } from './memory/SiteMemory.js';
import { SOPManager } from './memory/SOPManager.js';
import { BrowserAgent } from './automation/BrowserAgent.js';
import { SOPExecutor } from './automation/SOPExecutor.js';
import { AutonomousScheduler } from './automation/AutonomousScheduler.js';
import { GoalTracker } from './goals/GoalTracker.js';
import { BrowserTrainer } from './automation/BrowserTrainer.js';
import { AgentOrchestrator } from './agents/AgentOrchestrator.js';
import { CodeAgent } from './agents/CodeAgent.js';
import { ActionEngine } from './engine/ActionEngine.js';
import { GoogleIntegration } from './integrations/GoogleIntegration.js';
import { AceBrain } from './brain/AceBrain.js';
import { SkillChainer } from './brain/SkillChainer.js';
import { TaskDecomposer } from './brain/TaskDecomposer.js';
import { ProactiveMonitor } from './brain/ProactiveMonitor.js';
import ProjectManager from './projects/ProjectManager.js';
import DeployPipeline from './projects/DeployPipeline.js';
import LocalAdapter from './projects/adapters/LocalAdapter.js';
import FirebaseAdapter from './projects/adapters/FirebaseAdapter.js';
import SFTPAdapter from './projects/adapters/SFTPAdapter.js';
import NetlifyAdapter from './projects/adapters/NetlifyAdapter.js';
import { createSocialMediaSystem } from './social/index.js';
import IntegrationManager from './integrations/IntegrationManager.js';
import { TwilioService } from './integrations/TwilioService.js';
import CreditManager from './billing/CreditManager.js';
import FinanceManager from './finance/FinanceManager.js';
import { StripeService } from './billing/StripeService.js';
import { ApprovalQueue } from './approvals/ApprovalQueue.js';
import { ContactManager } from './contacts/ContactManager.js';
import { UpdateManager } from './system/UpdateManager.js';
import { FeedbackManager } from './system/FeedbackManager.js';
import { CrashReporter } from './system/CrashReporter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import BusinessProfile from './business/BusinessProfile.js';
import { TelegramBot } from './communication/TelegramBot.js';
import { AceMessageProcessor } from './communication/AceMessageProcessor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class OpenAce {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.join(__dirname, '../..');
    this.configPath = path.join(this.baseDir, 'config/openace.config.json');
    this.dataDir = path.join(this.baseDir, 'data');
    
    this.aiManager = null;
    this.skillsManager = null;
    this.knowledgeBase = null;
    this.workloadStore = null;
    this.permissionsManager = null;
    this.researchAgent = null;
    this.pipelineManager = null;
    this.heartbeat = null;
    this.config = null;
    this.businessProfile = null;
    
    // Ace's Brain - Memory Systems
    this.siteMemory = null;
    this.sopManager = null;
    this.browserAgent = null;
    
    // Agent Orchestrator - Delegates work to specialized agents
    this.orchestrator = null;
    this.codeAgent = null;
    
    // Project Manager — manages projects/ directory and metadata
    this.projectManager = null;
    
    // Deploy Pipeline — deploy projects to various targets
    this.deployPipeline = null;
    
    // Event Bus — The Nervous System (shared singleton)
    this.eventBus = eventBus;
    
    // Action Engine — The Heart, Soul & Brain
    this.actionEngine = null;
    
    // SOP Executor — Runs procedures through BrowserAgent
    this.sopExecutor = null;
    
    // Autonomous Scheduler — Daily routines
    this.autonomousScheduler = null;
    
    // BrowserTrainer — "Train By Example" recording
    this.browserTrainer = null;
    
    // AceBrain — Unified Intelligence Core (powers Dashboard + Telegram)
    this.brain = null;

    // Telegram Bot — remote access via Telegram
    this.telegramBot = null;

    // Google Integration (Gmail, Calendar, Drive)
    this.google = null;

    // Twilio SMS + Voice
    this.twilioService = null;

    // Social Media System
    this.socialMedia = null;
    
    // Phase 3: Persistent infrastructure
    this.taskQueue = null;          // Persistent task queue with retry
    this.stateManager = null;       // Unified state persistence
    this.log = new Logger('OpenAce'); // Structured logging
    
    // Phase 4: SuperBrain upgrades
    this.skillChainer = null;       // Skill dependency graph & chaining
    this.taskDecomposer = null;     // Complex task decomposition
    this.proactiveMonitor = null;   // Autonomous insight generation
    this.approvalQueue = null;      // Human-in-the-loop approval system
    
    this.conversationHistory = [];
    this.actionQueue = [];
    this.initialized = false;
    
    // Configure structured logging
    configureLogging({
      level: options.logLevel || 'INFO',
      enableFile: options.enableFileLogging ?? true,
      logDir: path.join(this.baseDir, 'logs')
    });
    
    // Progress callback for UI updates
    this.onProgress = options.onProgress || ((msg) => console.log(`[Ace] ${msg}`));
  }

  /**
   * Initialize OpenAce
   */
  async initialize() {
    this.log.info('Initializing OpenAce...');

    try {
      // ═══ First-run bootstrap: ensure data dirs and config exist ═══
      await this._ensureDataDirs();
      await this._ensureConfig();

      // Load configuration
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);

      // Initialize Business Profile (multi-business support)
      this.log.info('Loading business profiles...');
      this.businessProfile = new BusinessProfile(path.join(this.dataDir, 'business'));
      await this.businessProfile.load();

      // ═══ Phase 3: Initialize persistent infrastructure first ═══
      
      // State Manager — unified state persistence (conversations, settings)
      this.log.info('Loading state manager...');
      this.stateManager = new StateManager({
        dataDir: path.join(this.dataDir, 'state')
      });
      await this.stateManager.initialize();

      // Task Queue — persistent task queue with retry logic
      this.log.info('Loading task queue...');
      this.taskQueue = new TaskQueue({
        dataDir: path.join(this.dataDir, 'queue')
      });
      await this.taskQueue.initialize();

      // ═══ Core component initialization with error boundaries ═══

      // Initialize AI Provider
      this.log.info('Connecting AI brain...');
      this.aiManager = new AIProviderManager(this.configPath);
      await this.aiManager.initialize();
      this.aiManager.eventBus = eventBus; // Wire usage warnings to SSE

      // Initialize Skills Manager
      console.log('⚡ Loading skills...');
      this.skillsManager = new SkillsManager(path.join(this.dataDir, 'skills'));
      await this.skillsManager.initialize();
      
      // Add default skills if none exist
      if (this.skillsManager.getAllSkills().length === 0) {
        console.log('📦 Installing default skills...');
        for (const skill of DEFAULT_SKILLS) {
          await this.skillsManager.addSkill(skill);
        }
      }

      // Initialize Knowledge Base
      console.log('📚 Loading knowledge base...');
      this.knowledgeBase = new KnowledgeBase(path.join(this.dataDir, 'knowledge'));
      await this.knowledgeBase.initialize();

      // Initialize Workload Store
      console.log('📦 Loading workload store...');
      this.workloadStore = new WorkloadStore(path.join(this.dataDir, 'workload'));
      await this.workloadStore.initialize();

      // Initialize Permissions Manager
      console.log('🔐 Loading permissions...');
      this.permissionsManager = new PermissionsManager(
        path.join(this.dataDir, 'permissions/permissions.json')
      );
      await this.permissionsManager.initialize();

      // Initialize Research Agent
      console.log('🔍 Loading research agent...');
      this.researchAgent = new ResearchAgent({
        permissionsManager: this.permissionsManager,
        dataDir: path.join(this.dataDir, 'research'),
        maxConcurrentTabs: this.permissionsManager.getPermissions()?.web_access?.max_concurrent_tabs || 3
      });
      await this.researchAgent.initialize();

      // Initialize Pipeline Manager
      console.log('📊 Loading pipeline...');
      this.pipelineManager = new PipelineManager({
        pipelinePath: path.join(this.dataDir, 'pipeline/pipeline.json'),
        permissionsManager: this.permissionsManager
      });
      await this.pipelineManager.initialize();

      // Initialize Goal Tracker — persistent missions for autonomous work
      console.log('🎯 Loading goals...');
      this.goalTracker = new GoalTracker({
        goalsPath: path.join(this.dataDir, 'goals/goals.json')
      });
      await this.goalTracker.initialize();

      // Initialize Billing / Credit Manager
      console.log('💳 Loading billing...');
      this.creditManager = new CreditManager({
        dataDir: path.join(this.dataDir, 'billing')
      });
      await this.creditManager.initialize();

      this.stripeService = new StripeService();
      const stripeReady = await this.stripeService.initialize();
      if (stripeReady) {
        console.log('✅ Stripe connected — billing ready');
      } else {
        console.log('⚠️ Stripe not configured yet — set up in Settings → Billing');
      }

      // Initialize Update Manager
      console.log('🔄 Loading update system...');
      this.updateManager = new UpdateManager({ baseDir: this.baseDir });
      await this.updateManager.initialize();

      // Initialize Finance Manager (Books / Tax Prep)
      console.log('📒 Loading finance manager...');
      this.financeManager = new FinanceManager({
        dataPath: path.join(this.dataDir, 'finance/books.json'),
        uploadsDir: path.join(this.dataDir, 'finance/uploads'),
        aiManager: this.aiManager,
      });
      await this.financeManager.initialize();

      // Initialize Form Manager
      console.log('📝 Loading forms...');
      this.formManager = new FormManager({
        formsPath: path.join(this.dataDir, 'forms/forms.json'),
        submissionsDir: path.join(this.dataDir, 'forms/submissions'),
        pipelineManager: this.pipelineManager
      });
      await this.formManager.initialize();

      // Initialize Integration Manager (tech stack awareness)
      console.log('🔌 Loading integrations...');
      this.integrationManager = new IntegrationManager({
        dataDir: path.join(this.baseDir, 'data/config'),
        sopManager: this.sopManager,
      });
      await this.integrationManager.initialize();

      // Initialize Twilio Service (SMS + Voice)
      console.log('📱 Loading Twilio service...');
      try {
        this.twilioService = new TwilioService();
        const twilioReady = await this.twilioService.initialize();
        if (twilioReady) {
          console.log('✅ Twilio connected — SMS and voice ready');
        } else {
          console.log('⚠️ Twilio not configured yet — set up in Settings → Integrations');
        }
      } catch (error) {
        console.log('⚠️ Twilio not available:', error.message);
      }

      // Initialize Site Memory (Ace's Brain)
      console.log('🧠 Loading site memory...');
      this.siteMemory = new SiteMemory({
        dataDir: path.join(this.dataDir, 'memory')
      });
      await this.siteMemory.initialize();

      // Initialize SOP Manager (Learned Procedures)
      console.log('📋 Loading SOPs...');
      this.sopManager = new SOPManager({
        dataDir: path.join(this.dataDir, 'sops')
      });
      await this.sopManager.initialize();
      
      // SOPs are now user-created only — no auto-generated defaults

      // Initialize Browser Agent (for automation)
      console.log('🤖 Loading browser agent...');
      this.browserAgent = new BrowserAgent({
        dataDir: path.join(this.dataDir, 'automation'),
        headless: false,  // Visible by default so user can watch
        onProgress: this.onProgress
      });
      await this.browserAgent.initialize();


      // Initialize SOP Executor — runs SOPs through BrowserAgent
      console.log('⚡ Loading SOP executor...');
      this.sopExecutor = new SOPExecutor({
        onProgress: this.onProgress,
        screenshotDir: path.join(this.dataDir, 'automation/screenshots')
      });
      await this.sopExecutor.initialize({
        browserAgent: this.browserAgent,
        siteMemory: this.siteMemory,
        sopManager: this.sopManager,
        aiManager: this.aiManager
      });

      // Initialize Autonomous Scheduler — daily routines
      console.log('⏰ Loading autonomous scheduler...');
      this.autonomousScheduler = new AutonomousScheduler({
        dataDir: path.join(this.dataDir, 'scheduler'),
        onProgress: this.onProgress
      });
      await this.autonomousScheduler.initialize({
        sopExecutor: this.sopExecutor,
        sopManager: this.sopManager
      });

      // Initialize BrowserTrainer — "Train By Example" recording
      console.log('🎓 Loading browser trainer...');
      this.browserTrainer = new BrowserTrainer({
        screenshotDir: path.join(this.dataDir, 'training/screenshots'),
        onProgress: this.onProgress
      });
      await this.browserTrainer.initialize({
        sopManager: this.sopManager,
        siteMemory: this.siteMemory
      });

      // Initialize Agent Orchestrator (for delegation)
      console.log('🎯 Loading agent orchestrator...');
      this.orchestrator = new AgentOrchestrator({
        aiManager: this.aiManager,
        permissionsManager: this.permissionsManager,
        pipelineManager: this.pipelineManager,
        baseDir: this.baseDir,
        onProgress: this.onProgress
      });
      await this.orchestrator.initialize({
        browser: this.browserAgent,
        research: this.researchAgent,
        pipeline: this.pipelineManager,
      });
      
      // Quick access to code agent
      this.codeAgent = this.orchestrator.agents.code;

      // Initialize Project Manager — manages projects/ directory
      console.log('📂 Loading project manager...');
      this.projectManager = new ProjectManager(path.join(this.baseDir, 'projects'));

      // Wire projectManager into CodeAgent (created earlier by AgentOrchestrator)
      if (this.codeAgent) {
        this.codeAgent.projectManager = this.projectManager;
        // Also wire CodeAgent into ProjectManager for rich template scaffolding
        this.projectManager.codeAgent = this.codeAgent;
      }

      // Initialize Deploy Pipeline — deploy projects to various targets
      console.log('🚀 Loading deploy pipeline...');
      const deployConfig = this.config.deploy || {};
      this.deployPipeline = new DeployPipeline({
        projectManager: this.projectManager,
        baseDir: this.baseDir,
        projectsDir: this.projectsDir || path.join(this.baseDir, 'projects')
      });

      // Register adapters
      this.deployPipeline.registerAdapter('local', new LocalAdapter({
        port: this.config.port || 3333
      }));
      this.deployPipeline.registerAdapter('firebase', new FirebaseAdapter({
        defaultProjectId: deployConfig.firebase?.defaultProjectId || null
      }));
      this.deployPipeline.registerAdapter('sftp', new SFTPAdapter(deployConfig.sftp || {}));
      this.deployPipeline.registerAdapter('netlify', new NetlifyAdapter(deployConfig.netlify || {}));

      // Initialize Contact Manager — lightweight address book
      console.log('📇 Loading contact manager...');
      this.contactManager = new ContactManager({
        filePath: path.join(this.baseDir, 'data/memory/contacts.json')
      });
      await this.contactManager.initialize();

      // Initialize Action Engine — The Heart, Soul & Brain
      console.log('⚡ Loading action engine...');
      this.actionEngine = new ActionEngine({
        baseDir: this.baseDir,
        config: this.config,
        onProgress: this.onProgress
      });
      await this.actionEngine.initialize({
        pipelineManager: this.pipelineManager,
        researchAgent: this.researchAgent,
        knowledgeBase: this.knowledgeBase,
        sopManager: this.sopManager,
        skillsManager: this.skillsManager,
        browserAgent: this.browserAgent,
        aiManager: this.aiManager,
        siteMemory: this.siteMemory,
        permissionsManager: this.permissionsManager,
        sopExecutor: this.sopExecutor,
        autonomousScheduler: this.autonomousScheduler,
        projectManager: this.projectManager,
        deployPipeline: this.deployPipeline,
        config: this.config
      });

      // Wire AgentOrchestrator and CodeAgent into ActionEngine
      try {
        this.actionEngine.setAgentOrchestrator(this.orchestrator);
        this.actionEngine.setCodeAgent(this.codeAgent);
      } catch (err) {
        console.warn('[OpenAce] Failed to wire agents to ActionEngine:', err.message);
      }

      // Initialize Google Integration (Gmail, Calendar, Drive)
      console.log('📧 Loading Google integration...');
      try {
        this.google = new GoogleIntegration();
        const googleStatus = await this.google.initialize();
        if (googleStatus.status === 'connected') {
          console.log(`✅ Google connected: ${googleStatus.email}`);
        } else {
          console.log(`⚠️ Google not connected: ${googleStatus.message || googleStatus.status}`);
        }
      } catch (error) {
        console.log('⚠️ Google integration not available:', error.message);
      }

      // Wire Google integration into ActionEngine so it can send emails
      if (this.google && this.actionEngine) {
        this.actionEngine.google = this.google;
        console.log('📧 Google integration wired into ActionEngine');
      }

      // Initialize AceBrain — Unified Intelligence Core
      console.log('🧠 Initializing AceBrain (unified intelligence)...');
      this.brain = new AceBrain({
        config: this.config,
        onProgress: this.onProgress
      });
      await this.brain.initialize({
        aiManager: this.aiManager,
        actionEngine: this.actionEngine,
        knowledgeBase: this.knowledgeBase,
        workloadStore: this.workloadStore,
        businessProfile: this.businessProfile,
        sopManager: this.sopManager,
        skillsManager: this.skillsManager,
        pipelineManager: this.pipelineManager,
        researchAgent: this.researchAgent,
        google: this.google,
        sopExecutor: this.sopExecutor,
        autonomousScheduler: this.autonomousScheduler,
        browserAgent: this.browserAgent,
        siteMemory: this.siteMemory,
        codeAgent: this.codeAgent,
        projectManager: this.projectManager,
        contactManager: this.contactManager,
        formManager: this.formManager,
        deployPipeline: this.deployPipeline,
        goalTracker: this.goalTracker,
        integrationManager: this.integrationManager,
        twilioService: this.twilioService,
        creditManager: this.creditManager,
        updateManager: this.updateManager,
        feedbackManager: this.feedbackManager,
        config: this.config,
        executeSOP: (sop, msg) => this.executeSOP(sop, msg),
      });
      console.log('🧠 AceBrain online — powering Dashboard + Telegram');

      // Wire desktop trainer from brain to OpenAce for chat-based "Show Me" recording
      if (this.brain.desktopTrainer) {
        this.desktopTrainer = this.brain.desktopTrainer;
        console.log('🎓 Desktop Trainer wired — "Show Me" recording available in chat');
      }

      // Switch to active business (scopes pipeline + contacts to business-specific paths)
      if (this.businessProfile.activeId) {
        try {
          await this.switchBusiness(this.businessProfile.activeId);
          console.log(`📊 Active business: ${this.businessProfile.getActive()?.name || this.businessProfile.activeId}`);
        } catch (err) {
          console.warn('[OpenAce] Failed to switch to active business:', err.message);
        }
      }

      // Initialize Social Media System
      console.log('📱 Loading social media system...');
      try {
        this.socialMedia = await createSocialMediaSystem({
          aiProvider: this.aiManager,
          googleIntegration: this.google,
          // telegramBot: this.telegramBot, // Assuming telegram bot is available on OpenAce instance
          dataDir: this.dataDir,
        });
        if (this.brain) {
            this.brain.socialMedia = this.socialMedia;
            // Propagate to UnifiedAgent's subsystems so tools work
            if (this.brain.unifiedAgent?.subsystems) {
              this.brain.unifiedAgent.subsystems.socialMedia = this.socialMedia;
              this.brain.unifiedAgent.refreshTools();
            }
        }
        if (this.actionEngine) {
            this.actionEngine.socialMedia = this.socialMedia;
        }
        console.log('✅ Social Media System loaded and wired into Brain and ActionEngine');
      } catch (error) {
        console.log('⚠️ Social Media System not available:', error.message);
      }

      // Wire AgentOrchestrator and CodeAgent into AceBrain
      try {
        this.brain.setAgentOrchestrator(this.orchestrator);
        this.brain.setCodeAgent(this.codeAgent);
      } catch (err) {
        console.warn('[OpenAce] Failed to wire agents to AceBrain:', err.message);
      }

      console.log('[OpenAce] CodeAgent and AgentOrchestrator wired to Brain and ActionEngine');

      // Wire AceBrain into the scheduler for briefing routines
      if (this.brain) this.autonomousScheduler.setBrain(this.brain);
      if (this.pipelineManager) this.autonomousScheduler.setPipelineManager(this.pipelineManager);
      if (this.goalTracker) this.autonomousScheduler.setGoalTracker(this.goalTracker);

      // Autonomous scheduler disabled — routines should only run when explicitly triggered
      // this.autonomousScheduler.start();
      // this.log.info('Autonomous scheduler started');
// Start the persistent task queue processing loop
this.taskQueue.startProcessing(3000, this.executeTask.bind(this)); // Check every 3 seconds
this.log.info('Task queue processing started');

// ═══ Phase 4: SuperBrain upgrades ═══
      // Skill Chainer — dependency graph & automatic skill triggering
      this.log.info('Loading skill chainer...');
      this.skillChainer = new SkillChainer({
        skillsManager: this.skillsManager,
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });

      // Task Decomposer — break complex requests into sub-tasks
      this.log.info('Loading task decomposer...');
      this.taskDecomposer = new TaskDecomposer({
        aiManager: this.aiManager,
        onProgress: this.onProgress
      });

      // Proactive Monitor — autonomous insight generation
      this.log.info('Loading proactive monitor...');
      this.proactiveMonitor = new ProactiveMonitor({
        pipelineManager: this.pipelineManager,
        taskQueue: this.taskQueue,
        knowledgeBase: this.knowledgeBase,
        autonomousScheduler: this.autonomousScheduler,
        stateManager: this.stateManager,
        onProgress: this.onProgress
      });
      this.proactiveMonitor.start(300000); // Check every 5 minutes
      this.log.info('ProactiveMonitor started (5-min interval)');

      // ApprovalQueue — Human-in-the-loop action approval
      this.approvalQueue = new ApprovalQueue({
        dataDir: path.join(this.dataDir, 'approvals'),
        onProgress: this.onProgress
      });
      await this.approvalQueue.initialize();
      this.log.info('ApprovalQueue initialized');

      // Wire ApprovalQueue into ActionEngine
      if (this.actionEngine) {
        this.actionEngine.approvalQueue = this.approvalQueue;
        this.log.info('ApprovalQueue wired into ActionEngine');
      }

      // Wire SuperBrain into AceBrain
      if (this.brain) {
        this.brain.skillChainer = this.skillChainer;
        this.brain.taskDecomposer = this.taskDecomposer;
        this.brain.proactiveMonitor = this.proactiveMonitor;
        this.brain.approvalQueue = this.approvalQueue;
        this.log.info('SuperBrain upgrades wired into AceBrain');
      }

      // Start SelfHealer periodic health monitoring
      if (this.brain?.selfHealer) {
        const monitorSubsystems = {};
        if (this.aiManager) monitorSubsystems.aiManager = this.aiManager;
        if (this.pipelineManager) monitorSubsystems.pipelineManager = this.pipelineManager;
        if (this.actionEngine) monitorSubsystems.actionEngine = this.actionEngine;
        if (this.autonomousScheduler) monitorSubsystems.scheduler = this.autonomousScheduler;
        this.brain.selfHealer.startMonitoring(monitorSubsystems, 300000);
        this.log.info('SelfHealer health monitoring started (5-min interval)');
      }

      // Capture uncaught errors and route through SelfHealer
      process.on('uncaughtException', async (error) => {
        console.error('[OpenAce] Uncaught exception:', error.message);
        if (this.brain?.selfHealer) {
          try {
            await this.brain.selfHealer.diagnose(error, {
              component: 'process',
              department: 'system',
              action: 'uncaught_exception',
            });
          } catch (e) {
            console.error('[OpenAce] SelfHealer failed on uncaught exception:', e.message);
          }
        }
      });

      process.on('unhandledRejection', async (reason) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        console.error('[OpenAce] Unhandled rejection:', error.message);
        if (this.brain?.selfHealer) {
          try {
            await this.brain.selfHealer.diagnose(error, {
              component: 'process',
              department: 'system',
              action: 'unhandled_rejection',
            });
          } catch (e) {
            console.error('[OpenAce] SelfHealer failed on unhandled rejection:', e.message);
          }
        }
      });

      // Store LikemindedPro credentials if not already stored
      if (!this.siteMemory.getCredentials('likemindedpro')) {
        await this.siteMemory.storeCredentials('likemindedpro', {
          email: 'likemindedpro@gmail.com',
          password: 'Egrowth4days$'
        });
      }

      // Initialize Telegram Bot (if configured)
      if (this.config.telegram?.enabled && this.config.telegram?.bot_token) {
        console.log('📱 Starting Telegram bot...');
        try {
          this.telegramBot = new TelegramBot({
            token: this.config.telegram.bot_token,
            botUsername: this.config.telegram.bot_username || 'OpenAceBot',
            authorizedUsers: this.config.telegram.authorized_users || [],
            enabled: true
          });

          // Wire up the AceMessageProcessor with AceBrain
          const messageProcessor = new AceMessageProcessor(this.config);
          await messageProcessor.initialize();
          messageProcessor.setBrain(this.brain);

          // Connect message handler
          this.telegramBot.setMessageHandler(async (chatId, text, msg) => {
            const userName = msg.from.first_name || 'Boss';
            const response = await messageProcessor.processMessage(chatId, text, {
              userName,
              userId: msg.from.id,
              username: msg.from.username,
              chatType: msg.chat.type
            });
            return { text: response.text, options: { parse_mode: 'Markdown' } };
          });

          // Wire pipeline commands
          const pm = this.pipelineManager;

          this.telegramBot.registerCommand('pipeline', async () => {
            try {
              const data = pm.getPipeline ? pm.getPipeline() : { tasks: [], leads: [] };
              const tasks = data.tasks || data.items || [];
              const leads = data.leads || [];
              const pendingTasks = tasks.filter(t => t.stage !== 'done' && t.stage !== 'completed');
              return {
                text: `📊 *Pipeline Overview*\n\n` +
                      `*Tasks:* ${pendingTasks.length} pending (${tasks.length} total)\n` +
                      `*Leads:* ${leads.length}\n\n` +
                      `Use /tasks to see pending tasks.`,
                options: { parse_mode: 'Markdown' }
              };
            } catch (err) {
              return { text: `📊 Pipeline is initializing. Try again in a moment.` };
            }
          });

          this.telegramBot.registerCommand('tasks', async () => {
            try {
              const data = pm.getPipeline ? pm.getPipeline() : { tasks: [] };
              const tasks = (data.tasks || data.items || []).filter(t => t.stage !== 'done' && t.stage !== 'completed');
              if (tasks.length === 0) {
                return { text: `📋 *Tasks*\n\nNo pending tasks right now!`, options: { parse_mode: 'Markdown' } };
              }
              const lines = tasks.slice(0, 10).map((t, i) =>
                `${i + 1}. *${t.title}* — ${t.priority || 'medium'} priority`
              );
              return {
                text: `📋 *Pending Tasks* (${tasks.length})\n\n${lines.join('\n')}${tasks.length > 10 ? `\n\n_...and ${tasks.length - 10} more_` : ''}`,
                options: { parse_mode: 'Markdown' }
              };
            } catch (err) {
              return { text: `📋 Could not load tasks: ${err.message}` };
            }
          });

          this.telegramBot.registerCommand('addlead', async (_chatId, args, msg) => {
            if (args.length === 0) {
              return { text: '👥 Usage: /addlead [Name - Company]\n\nExample: /addlead John Smith - ABC Realty', options: { parse_mode: 'Markdown' } };
            }
            const leadText = args.join(' ');
            const dashIdx = leadText.indexOf(' - ');
            const company = dashIdx > -1 ? leadText.slice(dashIdx + 3).trim() : '';
            const contactName = dashIdx > -1 ? leadText.slice(0, dashIdx).trim() : leadText.trim();
            try {
              const lead = await pm.addLead({
                company: company || contactName,
                contact_name: contactName,
                source: 'telegram',
                created_by: msg.from.username || msg.from.first_name,
                notes: `Added via Telegram by ${msg.from.first_name}`
              });
              return {
                text: `✅ *Lead Added!*\n\n• Name: ${lead.contact_name || lead.company}\n• Company: ${lead.company}\n• Source: Telegram\n• ID: ${lead.id}`,
                options: { parse_mode: 'Markdown' }
              };
            } catch (err) {
              return { text: `❌ Couldn't add lead: ${err.message}` };
            }
          });

          const initialized = await this.telegramBot.initialize();
          if (initialized) {
            console.log('✅ Telegram bot active — notifications enabled');
            // Make it accessible to gateway for notifications
            if (this.actionEngine) this.actionEngine.telegramBot = this.telegramBot;
            // Wire into scheduler so briefing routines can send to Telegram
            if (this.autonomousScheduler) this.autonomousScheduler.setTelegramBot(this.telegramBot);
          } else {
            this.telegramBot = null;
          }
        } catch (err) {
          console.warn('⚠️ Telegram bot failed to start:', err.message);
          this.telegramBot = null;
        }
      } else if (this.config.telegram?.enabled) {
        console.log('⚠️ Telegram enabled but no bot_token configured — skipping');
      }

      // Initialize Heartbeat Monitor
      if (this.config.heartbeat.enabled) {
        console.log('💓 Starting heartbeat monitor...');
        this.heartbeat = new HeartbeatMonitor(this);
        if (this.socialMedia && this.socialMedia.scheduler) {
            this.heartbeat.setSocialMediaScheduler(this.socialMedia.scheduler);
        }
        await this.heartbeat.start();
      }

      // Initialize Feedback Manager + Crash Reporter (after Telegram so they can forward)
      console.log('📣 Loading feedback & crash reporting...');
      this.feedbackManager = new FeedbackManager({ dataDir: path.join(this.dataDir, 'feedback') });
      await this.feedbackManager.initialize(this.telegramBot);
      this.crashReporter = new CrashReporter({ dataDir: path.join(this.dataDir, 'diagnostics', 'crashes'), baseDir: this.baseDir });
      await this.crashReporter.initialize(this.telegramBot);

      this.initialized = true;
      console.log('\n✅ OpenAce is ready!\n');
      
      // Emit system initialized event
      this.eventBus.emit(EVENTS.SYSTEM_INITIALIZED, {
        provider: this.aiManager?.activeProvider,
        components: {
          brain: !!this.brain?.initialized,
          actionEngine: !!this.actionEngine?.initialized,
          browserAgent: !!this.browserAgent,
          scheduler: !!this.autonomousScheduler?.isRunning,
          google: !!this.google?.isConnected?.()
        },
        timestamp: new Date().toISOString()
      });
      
      this.printWelcome();

      return this;
    } catch (error) {
      console.error('❌ Failed to initialize OpenAce:', error.message);
      throw error;
    }
  }

  async executeTask(task) {
    this.log.info(`Executing task from queue: ${task.type} - ${task.id}`);
    try {
        switch (task.type) {
            case 'execute_sop':
                if (this.sopExecutor && task.payload.sopId) {
                    const sop = this.sopManager.getSOP(task.payload.sopId);
                    if (sop) {
                        await this.sopExecutor.executeSOP(sop, task.payload.variables || {});
                    }
                }
                break;
            case 'send_email':
                if (this.google && this.google.isConnected()) {
                    await this.google.sendEmail(task.payload.to, task.payload.subject, task.payload.body);
                }
                break;
            case 'proactive_analysis':
                // This would trigger a specific analysis routine
                break;
            default:
                this.log.warn(`Unknown task type: ${task.type}`);
        }
    } catch (error) {
        this.log.error(`Failed to execute task ${task.id}: ${error.message}`);
        throw error; // Re-throw to allow for retry logic in TaskQueue
    }
  }

  /**
   * Chat with OpenAce
   * Now checks for SOPs first before calling AI!
   * And LEARNS new SOPs automatically when you teach Ace something new!
   */
  async chat(userMessage, options = {}) {
    if (!this.initialized) {
      throw new Error('OpenAce is not initialized. Call initialize() first.');
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    });

    try {
      // ========================================
      // PRIORITY 0: IMAGE MESSAGES — Analyze with vision
      // If the user also sent text instructions, inject the vision
      // description as context and continue through normal routing
      // so AceBrain/BrowserDepartment can act on it.
      // ========================================
      const images = options.images || [];
      if (images.length > 0) {
        const visionPrompt = userMessage
          ? `The user sent ${images.length} image(s) with this message: "${userMessage}"\n\nDescribe what you see in the image concisely.`
          : `The user sent ${images.length} image(s) without text. Describe what you see.`;

        const visionResult = await this.aiManager.chatWithVision(visionPrompt, images[0]);
        const visionDescription = visionResult.content || visionResult.text || '';

        // Image-only (no text instruction) — just return the vision analysis
        if (!userMessage || !userMessage.trim()) {
          const responseText = visionDescription || 'I can see the image but had trouble analyzing it.';
          this.conversationHistory.push({
            role: 'assistant',
            content: responseText,
            timestamp: new Date().toISOString()
          });
          return {
            message: responseText,
            response: responseText,
            source: 'vision',
          };
        }

        // Image + text instruction — inject vision context and continue through normal routing
        // This lets AceBrain/BrowserDepartment/ActionEngine handle the actual task
        userMessage = `[Image context: ${visionDescription}]\n\nUser's instruction: ${userMessage}`;
      }

      // ========================================
      // NOTE: ActionEngine is intentionally NOT called here.
      // AceBrain.think() calls ActionEngine as its FIRST step internally.
      // Running it here too caused double-execution of actions like
      // adding tasks twice or running SOPs twice. — Fixed 2026-02-14
      // ========================================

      // Emit chat event
      this.eventBus.emit(EVENTS.CHAT_MESSAGE_RECEIVED, {
        message: userMessage, source: 'dashboard', timestamp: new Date().toISOString()
      });

      // ========================================
      // PRIORITY: "SHOW ME HOW" — Recording requests (step-level or full)
      // ========================================
      const stepRecordMatch = userMessage.match(/(?:show\s+(?:you\s+)?how|record\s+step|demonstrate\s+step|let\s+me\s+show\s+step)\s*(?:#?\s*)?(\d+)/i);
      const generalShowMatch = /(?:show\s+you|let\s+me\s+show|screen\s*record|want\s+(?:me\s+)?to\s+show|i'?ll\s+show|can\s+i\s+show|do\s+you\s+want\s+me\s+to\s+show|want\s+to\s+record|start\s+recording)/i.test(userMessage)
        && !/show\s+(?:me|us)\b/i.test(userMessage); // "show me" = asking Ace, not offering to show
      const stopRecordMatch = /(?:done\s*(?:recording)?|stop\s+recording|finished\s*(?:recording)?|i'?m\s+done|that'?s\s+it|all\s+done)/i.test(userMessage);

      if (stepRecordMatch) {
        const stepNum = parseInt(stepRecordMatch[1]);
        const result = await this.recordStepGuide(stepNum, userMessage);
        return result;
      }

      if (generalShowMatch && !this._activeStepRecording) {
        const result = await this.startShowMe(userMessage);
        return result;
      }

      if (stopRecordMatch && this._activeStepRecording) {
        const result = await this.finishStepGuide();
        return result;
      }

      // ========================================
      // ACEBRAIN — Unified Intelligence with AI-Driven Routing
      // ========================================
      // AceBrain's IntentRouter classifies every message with a single AI call.
      // No more regex layers — the AI reads all handler descriptions and picks the right one.
      // Markers returned by AceBrain tell us to handle teach/work/SOP here (they live in OpenAce).
      if (this.brain) {
        this.onProgress('🧠 AceBrain thinking...');
        
        const channelId = options.conversationId || 'dashboard';
        const brainResult = await this.brain.think(channelId, userMessage, {
          userName: 'Boss',
          source: 'dashboard',
          mode: options.mode,
          // Whose data may this turn touch? Set by the API layer from the
          // authenticated request. Tools scope their reads/writes to it.
          ownerId: options.ownerId || null
        });

        // ── Handle markers from IntentRouter ──
        // Some handlers return markers because the actual execution lives here in OpenAce.

        // WORK marker — execute code generation task
        if (brainResult.data?._workMarker && this.orchestrator) {
          this.onProgress('🔨 Work task detected - executing...');
          try {
            const workResult = await this.work(userMessage);
            const responseMessage = workResult.success
              ? `✅ **Task completed!**\n\n${workResult.message || workResult.data?.summary || 'Done!'}`
              : `⚠️ **Task had issues:**\n\n${workResult.message || 'Check the results'}`;

            this.conversationHistory.push({
              role: 'assistant', content: responseMessage, timestamp: new Date().toISOString(),
              metadata: { type: 'work_task', success: workResult.success }
            });
            return { message: responseMessage, action: 'work_completed', data: workResult.data,
              metadata: { type: 'work_task', success: workResult.success, timestamp: new Date().toISOString() } };
          } catch (workError) {
            this.onProgress(`⚠️ Work execution failed: ${workError.message}`);
            // Fall through to return brainResult
          }
        }

        // ── Normal response processing ──
        // Parse and execute any ACTION tags from the brain response
        // Skip for department responses — departments strip their own actions
        let finalMessage = brainResult.text;
        let results = [];

        if (brainResult.metadata?.source !== 'department') {
          const parsed = await this.parseAndExecuteActions(brainResult.text);
          finalMessage = parsed.cleanText;
          results = parsed.results;
        }

        // Add to legacy conversation history for backward compatibility
        this.conversationHistory.push({
          role: 'assistant',
          content: finalMessage,
          timestamp: new Date().toISOString(),
          metadata: {
            type: 'ace_brain',
            provider: brainResult.metadata?.provider,
            thinking: brainResult.thinking,
            actionsExecuted: results.length
          }
        });

        if (brainResult.question) {
        }
        if (brainResult.pendingActions) {
        }
        return {
          message: finalMessage,
          action: results.length > 0 ? 'actions_executed' : (brainResult.actions?.length > 0 ? 'brain_actions' : undefined),
          data: results.length > 0 ? { actions: results } : brainResult.data,
          thinking: brainResult.thinking,
          toolsUsed: brainResult.toolsUsed || [],
          pendingActions: brainResult.pendingActions || null,
          question: brainResult.question || null,
          metadata: {
            type: 'ace_brain',
            provider: brainResult.metadata?.provider,
            model: brainResult.metadata?.model,
            duration: brainResult.metadata?.duration,
            actionsExecuted: results.length,
            timestamp: new Date().toISOString()
          }
        };
      }

      // ========================================
      // FALLBACK: Legacy AI CHAT (if brain not available)
      // ========================================
      this.onProgress('🧠 Building context & thinking...');
      
      const liveContext = await this.buildLiveContext(userMessage);
      const recentHistory = this.conversationHistory.slice(-10);
      const messages = recentHistory.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await this.aiManager.chat(messages, {
        ...options,
        liveContext
      });

      this.onProgress('⚡ Processing response...');
      const { cleanText: legacyClean, actions: legacyActions, results: legacyResults } = await this.parseAndExecuteActions(response.content);
      const finalMessage = legacyClean;

      this.conversationHistory.push({
        role: 'assistant',
        content: finalMessage,
        timestamp: new Date().toISOString(),
        metadata: {
          provider: response.provider,
          model: response.model,
          usage: response.usage,
          actionsExecuted: legacyResults.length,
          actionsSucceeded: legacyResults.filter(r => r.success).length
        }
      });

      await this.knowledgeBase.learn(userMessage, finalMessage);

      return {
        message: finalMessage,
        action: legacyResults.length > 0 ? 'actions_executed' : undefined,
        data: legacyResults.length > 0 ? { actions: legacyResults } : undefined,
        metadata: {
          provider: response.provider,
          model: response.model,
          usage: response.usage,
          actionsExecuted: legacyResults.length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Error in chat:', error.message);
      throw error;
    }
  }

  /**
   * Build rich live context for the AI system prompt
   * This gives Ace awareness of current state so it can be proactive
   */
  async buildLiveContext(userMessage) {
    const sections = [];
    
    // Current date/time
    const now = new Date();
    sections.push(`CURRENT DATE/TIME: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`);

    // Pipeline state
    try {
      if (this.pipelineManager) {
        const pipeline = await this.pipelineManager.getPipeline();
        const tasks = pipeline.items || [];
        const leads = pipeline.leads || [];
        
        if (tasks.length > 0 || leads.length > 0) {
          let pipelineContext = 'CURRENT PIPELINE STATE:';
          
          if (tasks.length > 0) {
            const tasksByStage = {};
            tasks.forEach(t => {
              const stage = t.stage || 'inbox';
              if (!tasksByStage[stage]) tasksByStage[stage] = [];
              tasksByStage[stage].push(t);
            });
            pipelineContext += `\n  Tasks (${tasks.length} total):`;
            Object.entries(tasksByStage).forEach(([stage, items]) => {
              pipelineContext += `\n    ${stage}: ${items.length} - ${items.slice(0, 3).map(t => t.title || t.name).join(', ')}${items.length > 3 ? '...' : ''}`;
            });
          }
          
          if (leads.length > 0) {
            const leadsByStage = {};
            leads.forEach(l => {
              const stage = l.stage || 'new';
              if (!leadsByStage[stage]) leadsByStage[stage] = [];
              leadsByStage[stage].push(l);
            });
            pipelineContext += `\n  Leads (${leads.length} total):`;
            Object.entries(leadsByStage).forEach(([stage, items]) => {
              pipelineContext += `\n    ${stage}: ${items.length} - ${items.slice(0, 3).map(l => l.name || l.company).join(', ')}${items.length > 3 ? '...' : ''}`;
            });
          }
          
          sections.push(pipelineContext);
        } else {
          sections.push('CURRENT PIPELINE STATE: Empty — no tasks or leads yet. Suggest adding some!');
        }
      }
    } catch (e) {
      // Pipeline not available
    }

    // Available SOPs
    try {
      if (this.sopManager) {
        const sops = this.sopManager.getAllSOPs();
        if (sops.length > 0) {
          sections.push(`AVAILABLE SOPS (learned procedures you can execute):\n${sops.map(s => `  - "${s.name}": ${s.description || 'No description'} [triggers: ${(s.triggers || []).join(', ')}]`).join('\n')}`);
        }
      }
    } catch (e) {
      // SOPs not available
    }

    // Relevant skills
    const category = this.detectCategory(userMessage);
    if (category) {
      const skillsContext = this.skillsManager.getSkillsContext(category);
      if (skillsContext) {
        sections.push(`RELEVANT SKILLS FOR THIS REQUEST:\n${skillsContext}`);
      }
    }

    // Relevant knowledge
    try {
      const knowledge = await this.knowledgeBase.search(userMessage, 3);
      if (knowledge.length > 0) {
        sections.push(`RELEVANT KNOWLEDGE:\n${knowledge.map(k => `  - ${k.content}`).join('\n')}`);
      }
    } catch (e) {
      // Knowledge not available
    }

    // Recent conversation summary (what we've been working on)
    if (this.conversationHistory.length > 0) {
      const recentTopics = this.conversationHistory
        .slice(-6)
        .filter(m => m.role === 'user')
        .map(m => m.content.substring(0, 80));
      if (recentTopics.length > 0) {
        sections.push(`RECENT CONVERSATION TOPICS:\n${recentTopics.map(t => `  - "${t}"`).join('\n')}`);
      }
    }

    return sections.join('\n\n');
  }

  /**
   * Build context for the current request (legacy - now wraps buildLiveContext)
   */
  async buildContext(userMessage) {
    return await this.buildLiveContext(userMessage);
  }

  /**
   * Parse ACTION tags from AI response and execute them
   * Returns the cleaned response text and action results
   */
  async parseAndExecuteActions(responseText) {
    const actionRegex = /\[ACTION:(\w+):(\{[^}]+\})\]/g;
    const actions = [];
    let match;
    
    while ((match = actionRegex.exec(responseText)) !== null) {
      try {
        const actionType = match[1];
        const actionData = JSON.parse(match[2]);
        actions.push({ type: actionType, data: actionData, raw: match[0] });
      } catch (e) {
        console.error('Failed to parse action tag:', match[0], e.message);
      }
    }

    if (actions.length === 0) {
      return { cleanText: responseText, actions: [], results: [] };
    }

    // Execute actions
    const results = [];
    for (const action of actions) {
      this.onProgress(`⚡ Executing: ${action.type}...`);
      try {
        const result = await this.executeAIAction(action);
        results.push({ ...action, success: true, result });
        this.onProgress(`✅ ${action.type} completed`);
      } catch (error) {
        results.push({ ...action, success: false, error: error.message });
        this.onProgress(`⚠️ ${action.type} failed: ${error.message}`);
      }
    }

    // Clean action tags from the display text and append results
    let cleanText = responseText;
    for (const action of actions) {
      cleanText = cleanText.replace(action.raw, '');
    }
    cleanText = cleanText.trim();

    // Append action results summary
    if (results.length > 0) {
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      cleanText += `\n\n---\n📋 **Actions Executed:** ${results.length}`;
      for (const r of results) {
        if (r.success) {
          cleanText += `\n✅ ${r.type}: ${r.result?.summary || 'Done'}`;
        } else {
          cleanText += `\n⚠️ ${r.type}: ${r.error}`;
        }
      }
    }

    return { cleanText, actions, results };
  }

  /**
   * Execute a single action parsed from AI response
   */
  async executeAIAction(action) {
    switch (action.type) {
      case 'add_task': {
        if (!this.pipelineManager) throw new Error('Pipeline not available');
        const task = await this.pipelineManager.addTask({
          title: action.data.title,
          description: action.data.description || '',
          priority: action.data.priority || 'medium',
          stage: action.data.stage || 'inbox',
          assignee: action.data.assignee || 'ace',
          source: 'ai_action'
        });
        return { summary: `Added task: "${action.data.title}"`, task };
      }

      case 'add_lead': {
        if (!this.pipelineManager) throw new Error('Pipeline not available');
        const lead = await this.pipelineManager.addLead({
          name: action.data.name,
          company: action.data.company || '',
          email: action.data.email || '',
          phone: action.data.phone || '',
          source: action.data.source || 'ai_action',
          stage: action.data.stage || 'new',
          notes: action.data.notes || ''
        });
        return { summary: `Added lead: "${action.data.name}"`, lead };
      }

      case 'move_task': {
        if (!this.pipelineManager) throw new Error('Pipeline not available');
        await this.pipelineManager.moveTask(action.data.taskId, action.data.stage);
        return { summary: `Moved task to ${action.data.stage}` };
      }

      case 'move_lead': {
        if (!this.pipelineManager) throw new Error('Pipeline not available');
        await this.pipelineManager.moveLead(action.data.leadId, action.data.stage);
        return { summary: `Moved lead to ${action.data.stage}` };
      }

      case 'research': {
        if (!this.researchAgent) throw new Error('Research agent not available');
        const results = await this.researchAgent.search(action.data.query, {
          type: action.data.type || 'web',
          maxResults: action.data.maxResults || 5
        });
        return { summary: `Research: Found ${results?.length || 0} results for "${action.data.query}"`, results };
      }

      case 'save_knowledge': {
        if (!this.knowledgeBase) throw new Error('Knowledge base not available');
        await this.knowledgeBase.learn(action.data.topic, action.data.content);
        return { summary: `Saved knowledge: "${action.data.topic}"` };
      }

      case 'create_strategy': {
        const strategiesDir = path.join(this.dataDir, 'strategies');
        await fs.mkdir(strategiesDir, { recursive: true });
        const filename = `strategy_${action.data.type || 'general'}_${Date.now()}.json`;
        await fs.writeFile(
          path.join(strategiesDir, filename),
          JSON.stringify({
            name: action.data.name,
            type: action.data.type,
            content: action.data.content,
            createdAt: new Date().toISOString()
          }, null, 2)
        );
        return { summary: `Strategy saved: "${action.data.name}"` };
      }

      case 'browse': {
        if (!this.browserAgent) throw new Error('Browser agent not available');
        await this.browserAgent.navigateTo(action.data.url);
        return { summary: `Browsed to: ${action.data.url}` };
      }

      default:
        return { summary: `Unknown action: ${action.type}` };
    }
  }

  /**
   * Detect which category (CMO/CTO/COO) the message relates to
   */
  detectCategory(message) {
    const lower = message.toLowerCase();
    
    const cmoKeywords = ['marketing', 'campaign', 'social', 'content', 'brand', 'lead', 'analytics', 'seo'];
    const ctoKeywords = ['code', 'tech', 'architecture', 'performance', 'security', 'deploy', 'bug', 'feature'];
    const cooKeywords = ['operations', 'process', 'efficiency', 'resource', 'metrics', 'team', 'workflow'];

    if (cmoKeywords.some(kw => lower.includes(kw))) return 'cmo';
    if (ctoKeywords.some(kw => lower.includes(kw))) return 'cto';
    if (cooKeywords.some(kw => lower.includes(kw))) return 'coo';

    return null;
  }

  /**
   * Execute a Standard Operating Procedure
   * Delegates to SOPExecutor (full pipeline) when available,
   * falls back to legacy step-by-step execution otherwise.
   */
  async executeSOP(sop, userMessage) {
    this.onProgress(`Executing: ${sop.name}`);

    // Extract variables from the user's message for {{variable}} interpolation
    const variables = this._extractSOPVariables(userMessage, sop);

    // Interpolate variables into step fields before execution
    const interpolatedSOP = this._interpolateSOPVariables(sop, variables);

    // ══════════════════════════════════════════════════════════════
    // PRIMARY PATH: DesktopTaskRunner (all SOPs)
    // Has retry loop, AI recovery, learning system, SSE events.
    // ══════════════════════════════════════════════════════════════
    if (this.brain?._desktopRunner) {
      const runner = this.brain._desktopRunner;
      this.onProgress(`Running "${sop.name}" via DesktopTaskRunner (${interpolatedSOP.steps.length} steps)`);
      try {
        const result = await runner._replayTrainedSOP(interpolatedSOP);

        if (this.sopManager) {
          await this.sopManager.recordRun(sop.id, result.success);
        }

        if (result.success) {
          return {
            success: true,
            message: `**Procedure Complete: "${sop.name}"**\n\n` +
                     `${result.steps}/${interpolatedSOP.steps.length} steps replayed\n` +
                     `${result.summary}`,
            action: sop.id,
            data: result
          };
        } else {
          return {
            success: false,
            message: `Procedure "${sop.name}" partially completed: ${result.steps}/${interpolatedSOP.steps.length} steps\n${result.error || ''}`,
            action: sop.id,
            data: result
          };
        }
      } catch (err) {
        this.onProgress(`DesktopTaskRunner error: ${err.message}, falling back to SOPExecutor`);
        // Fall through to SOPExecutor as deprecated fallback
      }
    }

    // ══════════════════════════════════════════════════════════════
    // DEPRECATED FALLBACK: SOPExecutor (legacy CSS selector SOPs)
    // Only reached if DesktopTaskRunner is unavailable or crashes.
    // ══════════════════════════════════════════════════════════════
    if (this.sopExecutor) {
      this.onProgress(`Fallback: SOPExecutor for "${sop.name}" (${sop.steps.length} steps)`);
      try {
        const result = await this.sopExecutor.executeSOP(interpolatedSOP, variables);

        if (result.success) {
          this.onProgress(`Completed: ${sop.name}`);
          return {
            success: true,
            message: `**SOP Complete: "${sop.name}"**\n\n` +
                     `${result.stepsCompleted}/${result.totalSteps} steps completed\n` +
                     `Duration: ${(result.duration / 1000).toFixed(1)}s\n` +
                     (result.currentTitle ? `Page: ${result.currentTitle}\n` : '') +
                     (result.currentUrl ? `${result.currentUrl}\n` : ''),
            action: sop.id,
            data: result
          };
        } else {
          return {
            success: false,
            message: `SOP "${sop.name}" failed at step ${result.stepsCompleted + 1}: ${result.error}`,
            action: sop.id,
            error: result.error,
            data: result
          };
        }
      } catch (error) {
        this.onProgress(`SOPExecutor error: ${error.message}, falling back to legacy execution`);
        // Fall through to legacy path
      }
    }

    // LEGACY PATH: Direct step-by-step execution (last resort)
    this.onProgress(`Legacy execution for "${sop.name}" (${interpolatedSOP.steps.length} steps)`);
    const results = [];
    let currentStep = 0;

    try {
      for (const step of interpolatedSOP.steps) {
        currentStep++;
        this.onProgress(`Step ${currentStep}/${interpolatedSOP.steps.length}: ${step.action}`);

        const stepResult = await this.executeSOPStep(step, userMessage);
        results.push(stepResult);

        if (!stepResult.success && step.required !== false) {
          throw new Error(`Step ${currentStep} failed: ${stepResult.error}`);
        }
      }

      // Record successful run
      await this.sopManager.recordRun(sop.id, true);

      this.onProgress(`Completed: ${sop.name}`);

      return {
        success: true,
        message: this.generateSOPCompletionMessage(sop, results),
        action: sop.id,
        data: results
      };

    } catch (error) {
      // Record failed run
      await this.sopManager.recordRun(sop.id, false);

      this.onProgress(`Failed at step ${currentStep}: ${error.message}`);

      return {
        success: false,
        message: `Failed to execute ${sop.name}: ${error.message}`,
        action: sop.id,
        error: error.message
      };
    }
  }

  /**
   * Interpolate {{variable}} placeholders in SOP step fields.
   * Returns a deep copy of the SOP with variables replaced.
   */
  _interpolateSOPVariables(sop, variables) {
    if (!variables || Object.keys(variables).length === 0) return sop;

    const interpolate = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        return variables[key] !== undefined ? variables[key] : match;
      });
    };

    const interpolatedSteps = (sop.steps || []).map(step => {
      const newStep = { ...step };
      if (newStep.target) newStep.target = interpolate(newStep.target);
      if (newStep.text) newStep.text = interpolate(newStep.text);
      if (newStep.url) newStep.url = interpolate(newStep.url);
      if (newStep.value) newStep.value = interpolate(newStep.value);
      if (newStep.description) newStep.description = interpolate(newStep.description);
      return newStep;
    });

    return { ...sop, steps: interpolatedSteps };
  }

  /**
   * Extract variables from the user's message for SOP interpolation.
   * Parses city names, dates, and other context from natural language.
   * These become available as {{city}}, {{date}}, {{query}} etc. in SOP steps.
   */
  _extractSOPVariables(userMessage, sop) {
    const msg = (userMessage || '').toLowerCase();
    const vars = {
      query: userMessage || '',
      prompt_query: userMessage || '',
      prompt: userMessage || '',
      search: userMessage || '',
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString()
    };

    // Extract city — multiple patterns for flexibility
    const cityPatterns = [
      // "the <City> meetup" / "the <City> event" — most common pattern
      // Capital letter required for city start; stop words case-insensitive
      /\bthe\s+([A-Z][a-zA-Z\s]+?)\s+(?:[Mm]eetup|[Ee]vent|[Mm]eeting|[Gg]athering|[Ss]ession)\b/,
      // "for <City>" or "in <City>" — followed by stop words or end
      /\b(?:for|in)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:on|at|by|[Mm]eetup|[Ee]vent|repost|next|for)|[.,!?]|$)/,
      // "<City> Meetup" without "the" — multi-word proper nouns before meetup/event
      /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)+)\s+(?:[Mm]eetup|[Ee]vent|[Mm]eeting)\b/,
    ];
    for (const pattern of cityPatterns) {
      const cityMatch = (userMessage || '').match(pattern);
      if (cityMatch) {
        vars.city = cityMatch[1].trim();
        this.onProgress(`📍 Extracted city: "${vars.city}"`);
        break;
      }
    }

    // Extract date — look for "on <date>", "for <date>", specific date patterns
    const datePatterns = [
      /\b(?:on|for)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/,           // on 3/19, for 3/19/26
      /\b(?:on|for)\s+((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:(?:st|nd|rd|th))?(?:\s*,?\s*\d{4})?)/i, // on March 15
      /\b(next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i, // next Thursday
      /\b(tomorrow|today)\b/i,
      // Bare dates without "on"/"for" prefix:
      /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,                              // 3/26/2026, 03/26/26
      /\b((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:(?:st|nd|rd|th))?(?:\s*,?\s*\d{4})?)\b/i, // March 26th 2026, March 26
    ];
    for (const pattern of datePatterns) {
      const match = (userMessage || '').match(pattern);
      if (match) {
        vars.schedule_date = match[1].trim();
        this.onProgress(`📅 Extracted date: "${vars.schedule_date}"`);
        break;
      }
    }

    // ═══ Extract content — dynamic text the user wants injected into the SOP ═══
    // Handles patterns like:
    //   "Go to facebook and post: Check out this link https://example.com"
    //   "Go to facebook and post this: Hello world"
    //   "Post on facebook: My new article about AI"
    // The content is everything AFTER the SOP trigger/name or after a colon separator.
    const originalMsg = userMessage || '';

    // Strategy 1: Colon separator — "trigger phrase: content here"
    const colonIdx = originalMsg.indexOf(':');
    if (colonIdx > 10 && colonIdx < originalMsg.length - 1) {
      // Colon must be past the first 10 chars (not in "https://") and not at the end
      const beforeColon = originalMsg.substring(0, colonIdx).toLowerCase();
      const afterColon = originalMsg.substring(colonIdx + 1).trim();
      // Make sure this isn't a URL colon (http:// or https://)
      if (afterColon.length > 0 && !beforeColon.endsWith('http') && !beforeColon.endsWith('https')) {
        vars.content = afterColon;
        this.onProgress(`📝 Extracted content (colon): "${vars.content.substring(0, 80)}${vars.content.length > 80 ? '...' : ''}"`);
      }
    }

    // Strategy 2: Extract after trigger phrase — "go to facebook and post [CONTENT]"
    if (!vars.content) {
      const triggers = sop.triggers || [];
      for (const trigger of triggers) {
        const triggerLower = trigger.toLowerCase().trim();
        if (triggerLower.length < 4) continue;
        const idx = msg.indexOf(triggerLower);
        if (idx > -1) {
          const afterTrigger = originalMsg.substring(idx + trigger.length).trim();
          // Strip leading "this", "this:", "that" etc.
          const cleaned = afterTrigger.replace(/^(?:this|that)\s*:?\s*/i, '').trim();
          if (cleaned.length > 0) {
            vars.content = cleaned;
            this.onProgress(`📝 Extracted content (after trigger): "${vars.content.substring(0, 80)}${vars.content.length > 80 ? '...' : ''}"`);
            break;
          }
        }
      }
    }

    // Strategy 3: Extract after SOP name — "Go to facebook.com and post [CONTENT]"
    if (!vars.content && sop.name) {
      const sopNameLower = sop.name.toLowerCase().trim();
      const idx = msg.indexOf(sopNameLower);
      if (idx > -1) {
        const afterName = originalMsg.substring(idx + sop.name.length).trim();
        const cleaned = afterName.replace(/^(?:this|that)\s*:?\s*/i, '').trim();
        if (cleaned.length > 0) {
          vars.content = cleaned;
          this.onProgress(`📝 Extracted content (after name): "${vars.content.substring(0, 80)}${vars.content.length > 80 ? '...' : ''}"`);
        }
      }
    }

    return vars;
  }

  /**
   * Execute a single SOP step
   */
  async executeSOPStep(step, userMessage) {
    const action = step.action;
    
    switch (action) {
      case 'navigate':
        return await this.browserAgent.navigateTo(step.url);
        
      case 'click_text':
        return await this.browserAgent.clickByText(step.text);
        
      case 'click':
        return await this.browserAgent.click(step.selector);
        
      case 'type':
        const text = this.interpolateTemplate(step.text, userMessage);
        return await this.browserAgent.type(step.selector, text);
        
      case 'press':
        await this.browserAgent.page.keyboard.press(step.key);
        return { success: true };
        
      case 'wait':
        await this.browserAgent.wait(step.ms || 2000);
        return { success: true };
        
      case 'wait_navigation':
        try {
          await this.browserAgent.page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 15000
          });
        } catch (e) {
          // Some sites don't navigate
          await this.browserAgent.wait(2000);
        }
        return { success: true };
        
      case 'fill_credentials':
        const creds = this.siteMemory.getCredentials(step.credentialId);
        if (!creds) {
          throw new Error(`Credentials not found: ${step.credentialId}`);
        }
        return await this.browserAgent.login(creds);
        
      case 'click_submit':
        // Try to find and click submit button
        const submitClicked = await this.browserAgent.page.evaluate(() => {
          const patterns = ['Sign in', 'Sign In', 'Login', 'Log in', 'Submit', 'Continue'];
          const buttons = [...document.querySelectorAll('button, input[type="submit"]')];
          
          for (const btn of buttons) {
            const text = btn.textContent || btn.value || '';
            for (const pattern of patterns) {
              if (text.toLowerCase().includes(pattern.toLowerCase())) {
                btn.click();
                return true;
              }
            }
          }
          return false;
        });
        
        if (!submitClicked) {
          await this.browserAgent.page.keyboard.press('Enter');
        }
        return { success: true };
        
      case 'explore_page':
        const exploration = await this.browserAgent.explorePage();
        // Remember what we learned
        await this.siteMemory.rememberSite(
          await this.browserAgent.getCurrentUrl(),
          exploration
        );
        return { success: true, data: exploration };
        
      case 'extract_results':
        // Extract search results from page
        const results = await this.browserAgent.page.evaluate(() => {
          const items = [];
          document.querySelectorAll('.g, .result, [data-result]').forEach(el => {
            const title = el.querySelector('h3, .title')?.textContent;
            const link = el.querySelector('a')?.href;
            if (title && link) {
              items.push({ title, link });
            }
          });
          return items;
        });
        return { success: true, data: results };
        
      case 'save_to_pipeline':
        // Save extracted data to pipeline
        // Implementation depends on data type
        return { success: true };
      
      // ─── GOOGLE SEARCH ────────────────────────────
      case 'search_google':
      case 'searchGoogle':
      case 'google_search':
        const searchQuery = this.interpolateTemplate(
          step.query || step.text || step.searchQuery || '', userMessage
        );
        if (!searchQuery) {
          return { success: false, error: 'No search query provided' };
        }
        try {
          const searchResult = await this.browserAgent.searchGoogle(searchQuery);
          return { success: true, data: searchResult };
        } catch (searchErr) {
          // Fallback: try DuckDuckGo
          this.onProgress(`⚠️ Google search failed, trying DuckDuckGo...`);
          try {
            const ddgResult = await this.browserAgent.navigateTo(
              `https://duckduckgo.com/?q=${encodeURIComponent(searchQuery)}`
            );
            await this.browserAgent.wait(2000);
            return { success: true, data: ddgResult, method: 'duckduckgo_fallback' };
          } catch (ddgErr) {
            return { success: false, error: `Search failed: ${searchErr.message}` };
          }
        }
      
      // ─── SCROLL ────────────────────────────────────
      case 'scroll':
        const scrollAmount = step.amount || step.pixels || 500;
        const scrollDir = step.direction || 'down';
        await this.browserAgent.page.evaluate((amount, dir) => {
          window.scrollBy(0, dir === 'up' ? -amount : amount);
        }, scrollAmount, scrollDir);
        await this.browserAgent.wait(500);
        return { success: true };
      
      // ─── SCREENSHOT ────────────────────────────────
      case 'screenshot':
        await this.browserAgent.takeScreenshot(step.name || `step-${Date.now()}`);
        return { success: true };
      
      // ─── WAIT FOR SELECTOR ─────────────────────────
      case 'wait_for':
      case 'waitFor':
        try {
          await this.browserAgent.page.waitForSelector(
            step.selector, { timeout: step.timeout || 10000 }
          );
          return { success: true };
        } catch (e) {
          return { success: false, error: `Timeout waiting for: ${step.selector}` };
        }
      
      // ─── FILL FORM (multiple fields) ───────────────
      case 'fill_form':
      case 'fillForm':
        if (step.fields && typeof step.fields === 'object') {
          for (const [selector, value] of Object.entries(step.fields)) {
            const formVal = this.interpolateTemplate(value, userMessage);
            await this.browserAgent.type(selector, formVal);
          }
        }
        return { success: true };
      
      // ─── SMART CLICK (AI-assisted) ─────────────────
      case 'smart_click':
      case 'smartClick':
        const smartTarget = step.description || step.text || '';
        try {
          const clickResult = await this.browserAgent.clickByText(smartTarget);
          return { success: true, ...clickResult };
        } catch (e) {
          return { success: false, error: `Smart click failed: ${e.message}` };
        }
        
      default:
        this.onProgress(`⚠ Unknown action: ${action}`);
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  /**
   * Interpolate variables in template strings
   * e.g., "{{industry}} leads" with userMessage "find tech leads" -> "tech leads"
   */
  interpolateTemplate(template, userMessage) {
    if (!template.includes('{{')) return template;
    
    // Extract variables from user message
    const lower = userMessage.toLowerCase();
    
    // Common extractions
    const variables = {
      industry: this.extractVariable(lower, ['tech', 'real estate', 'healthcare', 'finance', 'retail']),
      location: this.extractVariable(lower, ['nyc', 'miami', 'dallas', 'austin', 'la', 'chicago', 'houston']),
      query: userMessage
    };
    
    // Replace {{var}} with extracted values
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Extract a variable value from text
   */
  extractVariable(text, options) {
    for (const option of options) {
      if (text.includes(option.toLowerCase())) {
        return option;
      }
    }
    return '';
  }

  /**
   * Generate completion message for SOP
   */
  generateSOPCompletionMessage(sop, results) {
    let message = `✅ **${sop.name}** completed successfully!\n\n`;
    
    // Add relevant results info
    const exploration = results.find(r => r.data?.analysis);
    if (exploration) {
      message += `I'm now on the page and can see:\n`;
      if (exploration.data.analysis?.navigation?.length > 0) {
        message += `\n**Navigation:**\n`;
        exploration.data.analysis.navigation.slice(0, 5).forEach(nav => {
          message += `• ${nav.text}\n`;
        });
      }
      if (exploration.data.analysis?.buttons?.length > 0) {
        message += `\n**Available Actions:**\n`;
        exploration.data.analysis.buttons.slice(0, 5).forEach(btn => {
          message += `• [${btn.text}]\n`;
        });
      }
    }
    
    message += `\nWhat would you like me to do next?`;
    
    return message;
  }

  // ==========================================
  // AGENT ORCHESTRATION - Making Ace DO work!
  // ==========================================

  /**
   * Execute a work task through the Agent Orchestrator
   * This is how Ace becomes PRODUCTIVE - not just chatty!
   *
   * Usage:
   *   ace.work("Add a new API endpoint for user settings")
   *   ace.work("Find tech leads in Austin and add to pipeline")
   *   ace.work("Send email campaign to hot leads")
   */
  async work(task, options = {}) {
    if (!this.initialized) {
      throw new Error('OpenAce is not initialized. Call initialize() first.');
    }

    this.onProgress(`\n🔨 WORK MODE: "${task.substring(0, 60)}..."\n`);

    try {
      // Route the task through the orchestrator
      const result = await this.orchestrator.execute(task, options);
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'user',
        content: `[WORK TASK] ${task}`,
        timestamp: new Date().toISOString()
      });
      
      this.conversationHistory.push({
        role: 'assistant',
        content: result.summary || 'Task completed',
        timestamp: new Date().toISOString(),
        metadata: {
          type: 'work_task',
          success: result.success,
          stepsCompleted: result.stepsCompleted
        }
      });

      return {
        success: result.success,
        message: result.summary,
        data: result,
        metadata: {
          type: 'work_task',
          task,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.onProgress(`❌ Work failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Quick code task - convenience wrapper
   *
   * Usage:
   *   ace.code("Add authentication to the user API")
   *   ace.code("Fix the bug in login.js")
   *   ace.code("Create a new component for the dashboard")
   */
  async code(task, context = {}) {
    if (!this.initialized) {
      throw new Error('OpenAce is not initialized. Call initialize() first.');
    }

    this.onProgress(`\n💻 CODE MODE: "${task.substring(0, 60)}..."\n`);

    try {
      const result = await this.orchestrator.code(task, context);
      
      return {
        success: result.success,
        message: result.summary || 'Coding task completed',
        data: result,
        metadata: {
          type: 'code_task',
          task,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.onProgress(`❌ Coding failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Quick file operations
   */
  async readFile(filepath) {
    return this.orchestrator.readFile(filepath);
  }

  async writeFile(filepath, content) {
    return this.orchestrator.writeFile(filepath, content);
  }

  async editFile(filepath, edits) {
    return this.orchestrator.editFile(filepath, edits);
  }

  async searchCode(pattern, directory = '.') {
    return this.orchestrator.searchCode(pattern, directory);
  }

  async runCommand(command) {
    return this.orchestrator.runCommand(command);
  }

  /**
   * Git operations
   */
  async gitStatus() {
    return this.codeAgent?.git('status');
  }

  async gitCommit(message) {
    return this.codeAgent?.git('commit', [message]);
  }

  async gitPush() {
    return this.codeAgent?.git('push');
  }

  /**
   * NPM operations
   */
  async npmInstall(packages = '') {
    return this.codeAgent?.npm('install', packages ? packages.split(' ') : []);
  }

  async npmRun(script) {
    return this.codeAgent?.npm('run', [script]);
  }

  async npmTest() {
    return this.codeAgent?.npm('test');
  }

  /**
   * Handle general "let me show you" / "want to screen record" requests.
   * Starts a full DesktopTrainer recording session. When the user says "done",
   * it saves as a visual guide for the most relevant SOP or creates a new one.
   */
  async startShowMe(userMessage) {
    try {
      if (!this.desktopTrainer) {
        const msg = '⚠️ Desktop Trainer is not available. Cannot start screen recording.';
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      // Find the SOP context — what are we recording for?
      const recentSOPs = this.sopManager ? this.sopManager.getAllSOPs() : [];
      let targetSOP = null;

      // Check if user mentioned a specific SOP
      for (const sop of recentSOPs) {
        if (userMessage.toLowerCase().includes(sop.name.toLowerCase())) {
          targetSOP = sop;
          break;
        }
      }

      // Fall back to most recently run SOP
      if (!targetSOP) {
        targetSOP = recentSOPs
          .filter(s => s.lastRun)
          .sort((a, b) => new Date(b.lastRun) - new Date(a.lastRun))[0];
      }

      // Start the recording
      const sessionName = targetSOP
        ? `show_me_${targetSOP.id}`
        : `show_me_${Date.now()}`;

      const result = await this.desktopTrainer.startRecording(sessionName);
      if (!result.success) {
        const msg = `⚠️ Could not start recording: ${result.error}`;
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      // Track the recording — finishStepGuide() will pick this up
      this._activeStepRecording = {
        sopId: targetSOP?.id || null,
        sopName: targetSOP?.name || 'New Procedure',
        stepNumber: null, // null = full recording, not a specific step
        isFullRecording: true
      };

      const sopContext = targetSOP
        ? `\n\nI'll attach this to **"${targetSOP.name}"** so I can learn from your demonstration.`
        : '\n\nI\'ll save this as a new procedure I can learn from.';

      const msg = `🎥 **Recording started!** I'm watching your screen now.\n\nGo ahead and perform the task — I'm capturing your clicks, typing, and screenshots every few seconds.${sopContext}\n\nWhen you're done, just say **"done"** or **"finished"** and I'll process what I learned.`;
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg, action: 'show_me_started', data: this._activeStepRecording };
    } catch (error) {
      const msg = `❌ Failed to start recording: ${error.message}`;
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg };
    }
  }

  /**
   * Start recording a visual guide for a specific SOP step.
   * Called from chat: recordStepGuide(stepNumber, userMessage)
   * Called from API:  recordStepGuide(stepNumber, userMessage, sopId)
   */
  async recordStepGuide(stepNumber, userMessage, sopId) {
    try {
      const recentSOPs = this.sopManager ? this.sopManager.getAllSOPs() : [];
      let targetSOP = null;

      // If sopId provided directly (from API/editor), use it
      if (sopId) {
        targetSOP = recentSOPs.find(s => s.id === sopId) || null;
      }

      // Otherwise search by message or recent run (from chat)
      if (!targetSOP && userMessage) {
        for (const sop of recentSOPs) {
          const sopNameLower = sop.name.toLowerCase();
          if (userMessage.toLowerCase().includes(sopNameLower) ||
              (sop.lastRun && !targetSOP)) {
            targetSOP = sop;
            if (userMessage.toLowerCase().includes(sopNameLower)) break;
          }
        }
      }

      // Fall back to most recently run SOP
      if (!targetSOP) {
        targetSOP = recentSOPs
          .filter(s => s.lastRun)
          .sort((a, b) => new Date(b.lastRun) - new Date(a.lastRun))[0];
      }

      if (!targetSOP) {
        const msg = '⚠️ I couldn\'t find which SOP you want to record a step for. Please run the SOP first, then say "show you how to do step X".';
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      if (stepNumber > targetSOP.steps.length || stepNumber < 1) {
        const msg = `⚠️ Step ${stepNumber} doesn't exist in "${targetSOP.name}" (${targetSOP.steps.length} steps total).`;
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      // Start recording via DesktopTrainer
      if (!this.desktopTrainer) {
        const msg = '⚠️ Desktop Trainer is not available. Cannot record visual guides.';
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      const result = await this.desktopTrainer.startStepRecording(targetSOP.id, stepNumber);
      if (!result.success) {
        const msg = `⚠️ Could not start recording: ${result.error}`;
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      // Track the active recording
      this._activeStepRecording = { sopId: targetSOP.id, sopName: targetSOP.name, stepNumber };

      const stepDesc = targetSOP.steps[stepNumber - 1]?.description || targetSOP.steps[stepNumber - 1]?.action;
      const msg = `🎥 **Recording step ${stepNumber}** of "${targetSOP.name}"\n\n**Step:** ${stepDesc}\n\nGo ahead and perform this step on your screen. When you're done, say **"done recording"** and I'll save it as a visual guide.`;
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg, action: 'step_recording_started', data: this._activeStepRecording };
    } catch (error) {
      const msg = `❌ Failed to start step recording: ${error.message}`;
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg };
    }
  }

  /**
   * Stop recording and save the visual guide.
   * Handles both per-step recording (stopStepRecording) and full recording (stopRecording).
   */
  async finishStepGuide() {
    if (!this._activeStepRecording || !this.desktopTrainer) {
      const msg = '⚠️ No recording in progress.';
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg };
    }

    try {
      const { sopId, sopName, stepNumber, isFullRecording } = this._activeStepRecording;

      // Stop the appropriate recording type
      let result;
      if (isFullRecording) {
        result = await this.desktopTrainer.stopRecording();
      } else {
        result = await this.desktopTrainer.stopStepRecording();
      }

      if (!result.success) {
        this._activeStepRecording = null;
        const msg = `⚠️ Recording issue: ${result.error}`;
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg };
      }

      // Full recording → creates/updates a desktop SOP via DesktopTrainer._buildSOPFromEvents()
      if (isFullRecording) {
        this._activeStepRecording = null;
        const sop = result.sop;
        const eventCount = this.desktopTrainer.events?.length || 0;
        const screenshotCount = this.desktopTrainer.screenshots?.length || 0;

        // If we had an SOP context, link the recording to it as a visual guide
        if (sopId) {
          const existingSOP = this.sopManager.getSOP(sopId);
          if (existingSOP) {
            existingSOP.visualGuide = {
              recordedAt: new Date().toISOString(),
              trainedSopId: sop?.id || null,
              eventCount,
              screenshotCount
            };
            await this.sopManager.saveSOP(existingSOP);
          }
        }

        const msg = `✅ **Recording saved!** I captured ${eventCount} actions and ${screenshotCount} screenshots.\n\n` +
          (sop ? `📋 Created procedure: **"${sop.name}"** with ${sop.steps?.length || 0} steps.\n\n` : '') +
          (sopId ? `🔗 Linked to "${sopName}" — I'll use this recording as reference next time.\n\n` : '') +
          `I'll get better at this every time I practice. You can also say **"record step 5"** to show me specific steps that need help.`;
        this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
        return { message: msg, action: 'show_me_saved', data: { sop, eventCount, screenshotCount } };
      }

      // Per-step recording → attach visual guide to the specific step
      const sop = this.sopManager.getSOP(sopId);
      if (sop && sop.steps[stepNumber - 1]) {
        sop.steps[stepNumber - 1].visualGuide = {
          recordedAt: new Date().toISOString(),
          guidePath: `data/sops/${sopId}/guides/step_${stepNumber}.json`,
          actionCount: result.guide.actions.length,
          screenshotCount: result.guide.screenshotCount
        };
        await this.sopManager.saveSOP(sop);
      }

      this._activeStepRecording = null;
      const msg = `✅ **Visual guide saved for step ${stepNumber}** of "${sopName}"!\n\n📸 Captured ${result.guide.screenshotCount} screenshots and ${result.guide.actions.length} actions.\n\nNext time this step fails, I'll use your demonstration as a reference to get it right.`;
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg, action: 'step_guide_saved', data: result.guide };
    } catch (error) {
      this._activeStepRecording = null;
      const msg = `❌ Failed to save recording: ${error.message}`;
      this.conversationHistory.push({ role: 'assistant', content: msg, timestamp: new Date().toISOString() });
      return { message: msg };
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history
   */
  getHistory() {
    return this.conversationHistory;
  }

  /** Stop the current AI processing loop (user clicked Stop in the UI). */
  stopProcessing() {
    if (this.brain) {
      this.brain.stopProcessing();
    }
  }

  // ═══════════════════════════════════════════════════════════
  // MULTI-BUSINESS SUPPORT
  // ═══════════════════════════════════════════════════════════

  /**
   * Switch the active business context.
   * Hot-swaps PipelineManager and ContactManager for the new business,
   * then updates AceBrain so Gemini immediately knows which business it's working for.
   */
  async switchBusiness(id) {
    const bm = this.businessProfile;

    const target = bm.getById(id);
    if (!target) throw new Error(`Business "${id}" not found`);

    // Persist active pointer
    await bm.setActive(id);

    // Ensure per-business data directory exists and seed default files
    await bm.ensureBusinessDirs(id);
    await this._seedBusinessData(id);

    // Hot-swap PipelineManager to business-scoped path
    this.pipelineManager = new PipelineManager({
      pipelinePath: bm.getPipelinePath(id),
      permissionsManager: this.permissionsManager,
    });
    await this.pipelineManager.initialize();

    // Hot-swap ContactManager to business-scoped path
    this.contactManager = new ContactManager({
      filePath: bm.getContactsPath(id),
    });
    await this.contactManager.initialize();

    // Push new subsystem references into AceBrain + UnifiedAgent
    if (this.brain) {
      this.brain.updateBusinessSubsystems({
        pipelineManager: this.pipelineManager,
        contactManager: this.contactManager,
      });
      this.brain.updateBusinessContext(bm.getContextSummary());
    }

    // Update scheduler references
    if (this.autonomousScheduler) {
      this.autonomousScheduler.setPipelineManager(this.pipelineManager);
    }

    return target;
  }

  /**
   * Seed a new business's data directory with pipeline + contacts.
   * For the migrated first business: copies existing data.
   * For new businesses: creates empty defaults.
   */
  async _seedBusinessData(slug) {
    const bm = this.businessProfile;
    const pipelinePath = bm.getPipelinePath(slug);
    const contactsPath = bm.getContactsPath(slug);

    const { existsSync } = await import('fs');
    const oldPipeline = path.join(this.dataDir, 'pipeline/pipeline.json');
    const oldContacts = path.join(this.dataDir, 'memory/contacts.json');

    // Check if this is the original migrated first business
    const isFirstBusiness = bm.profiles[0]?.id === slug;

    // Seed pipeline
    if (!existsSync(pipelinePath)) {
      if (isFirstBusiness && existsSync(oldPipeline)) {
        await fs.copyFile(oldPipeline, pipelinePath);
      } else {
        const defaultPipeline = {
          stages: [
            { id: 'inbox', name: 'Inbox', color: '#6c757d', order: 1, auto_assign: 'ace' },
            { id: 'research', name: 'Research', color: '#007bff', order: 2, auto_assign: 'ace' },
            { id: 'in_progress', name: 'In Progress', color: '#ffc107', order: 3, auto_assign: null },
            { id: 'review', name: 'Review', color: '#17a2b8', order: 4, auto_assign: null },
            { id: 'done', name: 'Done', color: '#28a745', order: 5, auto_assign: null },
          ],
          items: [],
          lead_stages: [
            { id: 'new', name: 'New Lead', color: '#6c757d', order: 1 },
            { id: 'contacted', name: 'Contacted', color: '#007bff', order: 2 },
            { id: 'qualified', name: 'Qualified', color: '#17a2b8', order: 3 },
            { id: 'proposal', name: 'Proposal Sent', color: '#ffc107', order: 4 },
            { id: 'won', name: 'Won', color: '#28a745', order: 5 },
            { id: 'lost', name: 'Lost', color: '#dc3545', order: 6 },
          ],
          leads: [],
        };
        await fs.writeFile(pipelinePath, JSON.stringify(defaultPipeline, null, 2));
      }
    }

    // Seed contacts
    if (!existsSync(contactsPath)) {
      if (isFirstBusiness && existsSync(oldContacts)) {
        await fs.copyFile(oldContacts, contactsPath);
      } else {
        await fs.writeFile(contactsPath, JSON.stringify({ contacts: [] }, null, 2));
      }
    }
  }

  /**
   * Switch AI provider
   */
  async switchProvider(providerName) {
    return await this.aiManager.switchProvider(providerName);
  }

  /**
   * Get current status
   */
  getStatus() {
    const permissions = this.permissionsManager ? this.permissionsManager.getPermissions() : null;
    
    return {
      initialized: this.initialized,
      provider: this.aiManager.getProviderInfo(),
      skills: {
        total: this.skillsManager.getAllSkills().length,
        cmo: this.skillsManager.getSkillsByCategory('cmo').length,
        cto: this.skillsManager.getSkillsByCategory('cto').length,
        coo: this.skillsManager.getSkillsByCategory('coo').length,
      },
      knowledge: {
        entries: this.knowledgeBase.getStats().total
      },
      personality: this.config.personality,
      permissions: permissions ? {
        autonomy_level: permissions.global.autonomy_level,
        web_access: permissions.web_access.enabled,
        pipeline: permissions.pipeline.enabled,
        email: permissions.communication.email.enabled,
        research: permissions.research.enabled
      } : null,
      heartbeat: this.heartbeat ? this.heartbeat.getStatus() : null
    };
  }

  // ==========================================
  // PERMISSIONS METHODS
  // ==========================================

  /**
   * Check if an action is allowed
   */
  checkPermission(action, context = {}) {
    if (!this.permissionsManager) {
      return { allowed: false, reason: 'Permissions not initialized' };
    }
    return this.permissionsManager.checkPermission(action, context);
  }

  /**
   * Get all permissions
   */
  getPermissions() {
    if (!this.permissionsManager) return null;
    return this.permissionsManager.getPermissions();
  }

  /**
   * Update a permission setting
   */
  async updatePermission(path, value) {
    if (!this.permissionsManager) {
      throw new Error('Permissions not initialized');
    }
    return await this.permissionsManager.updatePermission(path, value);
  }

  /**
   * Set autonomy level
   */
  async setAutonomyLevel(level) {
    if (!this.permissionsManager) {
      throw new Error('Permissions not initialized');
    }
    return await this.permissionsManager.setAutonomyLevel(level);
  }

  /**
   * Add allowed domain for web access
   */
  async addAllowedDomain(domain) {
    if (!this.permissionsManager) {
      throw new Error('Permissions not initialized');
    }
    return await this.permissionsManager.addAllowedDomain(domain);
  }

  /**
   * Remove allowed domain
   */
  async removeAllowedDomain(domain) {
    if (!this.permissionsManager) {
      throw new Error('Permissions not initialized');
    }
    return await this.permissionsManager.removeAllowedDomain(domain);
  }

  /**
   * Log an action
   */
  logAction(action, context, result) {
    if (!this.permissionsManager) return null;
    return this.permissionsManager.logAction(action, context, result);
  }

  /**
   * Get recent actions
   */
  getRecentActions(limit = 50) {
    if (!this.permissionsManager) return [];
    return this.permissionsManager.getRecentActions(limit);
  }

  /**
   * Execute an action with permission check
   */
  async executeWithPermission(action, context, executor) {
    const permission = this.checkPermission(action, context);
    
    if (!permission.allowed && !permission.requiresApproval) {
      this.logAction(action, context, { success: false, reason: permission.reason });
      throw new Error(`Action not allowed: ${permission.reason}`);
    }
    
    if (permission.requiresApproval) {
      // Queue for approval
      const queueItem = {
        id: Date.now().toString(),
        action,
        context,
        permission,
        status: 'pending_approval',
        created_at: new Date().toISOString()
      };
      this.actionQueue.push(queueItem);
      return { queued: true, id: queueItem.id, reason: 'Requires approval' };
    }
    
    // Execute the action
    try {
      const result = await executor();
      this.logAction(action, context, { success: true, result });
      return { success: true, result };
    } catch (error) {
      this.logAction(action, context, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Approve a queued action
   */
  async approveAction(actionId) {
    const index = this.actionQueue.findIndex(a => a.id === actionId);
    if (index === -1) {
      throw new Error('Action not found in queue');
    }
    
    const item = this.actionQueue[index];
    item.status = 'approved';
    item.approved_at = new Date().toISOString();
    
    return item;
  }

  /**
   * Reject a queued action
   */
  async rejectAction(actionId, reason) {
    const index = this.actionQueue.findIndex(a => a.id === actionId);
    if (index === -1) {
      throw new Error('Action not found in queue');
    }
    
    const item = this.actionQueue.splice(index, 1)[0];
    item.status = 'rejected';
    item.rejected_at = new Date().toISOString();
    item.reject_reason = reason;
    
    this.logAction(item.action, item.context, { success: false, reason: 'Rejected by user' });
    
    return item;
  }

  /**
   * Get pending actions
   */
  getPendingActions() {
    return this.actionQueue.filter(a => a.status === 'pending_approval');
  }

  // ==========================================
  // RESEARCH METHODS
  // ==========================================

  /**
   * Search the web for a topic
   */
  async searchWeb(query, options = {}) {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.searchGoogle(query, options);
  }

  /**
   * Scrape a webpage
   */
  async scrapePage(url) {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.scrapePage(url);
  }

  /**
   * Research a topic (search + scrape top results)
   */
  async researchTopic(topic, options = {}) {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.researchTopic(topic, options);
  }

  /**
   * Search for real estate deals
   */
  async searchRealEstate(location, options = {}) {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.searchRealEstateDeals(location, options);
  }

  /**
   * Search for leads/prospects
   */
  async searchLeads(industry, location, options = {}) {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.searchLeads(industry, location, options);
  }

  /**
   * Get saved research
   */
  async getSavedResearch() {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.listResearch();
  }

  /**
   * Load specific research by filename
   */
  async loadResearch(filename) {
    if (!this.researchAgent) {
      throw new Error('Research agent not initialized');
    }
    return await this.researchAgent.loadResearch(filename);
  }

  // ==========================================
  // PIPELINE METHODS
  // ==========================================

  /**
   * Get all pipeline data (tasks, leads, stages)
   */
  async getPipeline() {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getPipeline();
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStats() {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getStats();
  }

  /**
   * Get all tasks
   */
  async getTasks() {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getTasks();
  }

  /**
   * Get tasks by stage
   */
  async getTasksByStage(stageId) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getTasksByStage(stageId);
  }

  /**
   * Add a new task
   */
  async addTask(taskData) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.addTask(taskData);
  }

  /**
   * Update a task
   */
  async updateTask(taskId, updates) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.updateTask(taskId, updates);
  }

  /**
   * Move task to different stage
   */
  async moveTask(taskId, newStage) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.moveTask(taskId, newStage);
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.deleteTask(taskId);
  }

  /**
   * Get all leads
   */
  async getLeads() {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getLeads();
  }

  /**
   * Get leads by stage
   */
  async getLeadsByStage(stageId) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getLeadsByStage(stageId);
  }

  /**
   * Add a new lead
   */
  async addLead(leadData) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.addLead(leadData);
  }

  /**
   * Update a lead
   */
  async updateLead(leadId, updates) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.updateLead(leadId, updates);
  }

  /**
   * Move lead to different stage
   */
  async moveLead(leadId, newStage) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.moveLead(leadId, newStage);
  }

  /**
   * Delete a lead
   */
  async deleteLead(leadId) {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return await this.pipelineManager.deleteLead(leadId);
  }

  /**
   * Get task stages configuration
   */
  getTaskStages() {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getTaskStages();
  }

  /**
   * Get lead stages configuration
   */
  getLeadStages() {
    if (!this.pipelineManager) {
      throw new Error('Pipeline manager not initialized');
    }
    return this.pipelineManager.getLeadStages();
  }

  // ==========================================
  // BROWSER AUTOMATION METHODS
  // ==========================================

  /**
   * Get all SOPs
   */
  getSOPs() {
    return this.sopManager?.getAllSOPs() || [];
  }

  /**
   * Get specific SOP
   */
  getSOP(id) {
    return this.sopManager?.getSOP(id);
  }

  /**
   * Create new SOP
   */
  async createSOP(sopData) {
    return await this.sopManager?.createSOP(sopData);
  }

  /**
   * Delete SOP
   */
  async deleteSOP(id) {
    return await this.sopManager?.deleteSOP(id);
  }

  /**
   * Get site memory summary
   */
  getSiteMemory() {
    return this.siteMemory?.getAllSites() || [];
  }

  /**
   * Store credentials
   */
  async storeCredentials(id, credentials) {
    return await this.siteMemory?.storeCredentials(id, credentials);
  }

  /**
   * Run a specific SOP by ID
   * Delegates to SOPExecutor when available for full action support.
   */
  async runSOP(sopId) {
    const sop = this.sopManager.getSOP(sopId);
    if (!sop) {
      throw new Error(`SOP not found: ${sopId}`);
    }
    return await this.executeSOP(sop, '');
  }

  /**
   * Close browser agent
   */
  async closeBrowser() {
    if (this.browserAgent) {
      await this.browserAgent.close();
    }
  }

  /**
   * Print welcome message
   */
  printWelcome() {
    const p = this.config.personality;
    console.log(`╔════════════════════════════════════════════════════════════╗`);
    console.log(`║                                                            ║`);
    console.log(`║              👋 Hello! I'm ${p.name}                        ║`);
    console.log(`║          Your ${p.role}              ║`);
    console.log(`║                                                            ║`);
    console.log(`║  I'm here to help you with:                                ║`);
    console.log(`║  📊 CMO - Marketing strategy & analytics                   ║`);
    console.log(`║  💻 CTO - Tech stack & code review                         ║`);
    console.log(`║  ⚙️  COO - Operations & efficiency                         ║`);
    console.log(`║                                                            ║`);
    console.log(`║  🤖 Browser Automation - I can navigate websites!          ║`);
    console.log(`║  📋 SOPs - I remember learned procedures!                  ║`);
    console.log(`║                                                            ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝`);
    console.log();
  }

  /**
   * First-run bootstrap: create all required data directories
   */
  async _ensureDataDirs() {
    const dirs = [
      'business', 'state', 'queue', 'skills', 'knowledge', 'cache',
      'memory', 'memory/credentials', 'memory/sites', 'memory/corrections',
      'memory/research', 'memory/notes',
      'pipeline', 'permissions', 'sops', 'sops/general',
      'automation', 'automation/screenshots',
      'scheduler', 'scheduler/results',
      'research', 'social', 'social/sessions',
      'training', 'training/screenshots',
      'personas', 'activity', 'config',
      'forms', 'forms/submissions',
      'goals', 'workload', 'workload/files',
      'content', 'content/media', 'content/media/images',
      'strategies', 'approvals', 'diagnostics',
      'businesses', 'feedback'
    ];
    for (const dir of dirs) {
      await fs.mkdir(path.join(this.dataDir, dir), { recursive: true });
    }
  }

  /**
   * First-run bootstrap: create config from template if missing
   */
  async _ensureConfig() {
    try {
      await fs.access(this.configPath);
    } catch {
      const examplePath = path.join(this.baseDir, 'config/openace.config.example.json');
      try {
        await fs.copyFile(examplePath, this.configPath);
        this.log.info('First run detected — created config from template. Run the onboarding wizard at http://localhost:3333 to set up your AI provider.');
      } catch {
        this.log.warn('No config file or template found. The onboarding wizard will guide you through setup.');
      }
    }
  }

  /**
   * Shutdown OpenAce gracefully
   */
  async shutdown() {
    this.log.info('Shutting down OpenAce...');
    
    // Stop task queue processing
    if (this.taskQueue) {
      this.taskQueue.stopProcessing();
      await this.taskQueue.persist();
      this.log.info('Task queue flushed');
    }
    
    // Flush state to disk
    if (this.stateManager) {
      await this.stateManager.flush();
      this.log.info('State flushed to disk');
    }
    
    // Stop scheduler
    if (this.autonomousScheduler) {
      this.autonomousScheduler.stop();
    }
    
    // Stop heartbeat
    if (this.heartbeat) {
      await this.heartbeat.stop();
    }
    
    // Close browser if open
    if (this.browserAgent) {
      await this.browserAgent.close();
    }
    
    // Stop update checker
    if (this.updateManager) {
      this.updateManager.shutdown();
    }

    // Flush logs
    await flushLogs();

    console.log('✅ Goodbye!');
  }
}

// Export for use in other modules
export default OpenAce;
