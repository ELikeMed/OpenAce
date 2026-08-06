/**
 * ApiGateway — The Unified Entry Point for OpenAce
 * 
 * Extracts all API route definitions from the monolithic start-dashboard.js
 * into an organized, middleware-equipped gateway.
 * 
 * Responsibilities:
 * - Register all API routes on an Express app
 * - Provide middleware: error handling, request validation, CORS
 * - Manage SSE connections for real-time EventBus streaming
 * - Health check endpoint for external monitoring
 * - Uniform error response format
 * 
 * Usage:
 *   import { ApiGateway } from './src/core/gateway/ApiGateway.js';
 *   const gateway = new ApiGateway(app, { ace, activityLogger, baseDir });
 *   await gateway.initialize();
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import { eventBus, EVENTS } from '../events/EventBus.js';
import { logCapture } from '../diagnostics/LogCapture.js';
import { SOPParser } from '../automation/SOPParser.js';
import FormRenderer from '../forms/FormRenderer.js';
import { UsageTracker } from '../cloud/UsageTracker.js';
import { ConversationCapture } from '../cloud/ConversationCapture.js';

export class ApiGateway {
  constructor(app, options = {}) {
    this.app = app;
    this.ace = options.ace || null;        // OpenAce instance
    this.activityLogger = options.activityLogger || null;
    this.baseDir = options.baseDir || process.cwd();
    this.startTime = options.startTime || Date.now();

    // SSE clients for real-time push
    this.sseClients = new Set();

    // Social media system (lazy loaded)
    this.socialMediaSystem = null;

    // Usage tracking for freemium (50 free messages for anonymous users)
    this._usageTracker = new UsageTracker();

    // Capture conversations for LLM training improvement
    this._conversationCapture = new ConversationCapture();
  }

  /**
   * Set the OpenAce instance (can be set after construction once initialized)
   */
  setAce(ace) {
    this.ace = ace;
  }

  /**
   * Set the ActivityLogger
   */
  setActivityLogger(logger) {
    this.activityLogger = logger;
  }

  /**
   * Initialize all routes and middleware
   */
  async initialize() {
    // Global error handler middleware
    this.registerMiddleware();
    
    // Register all route groups
    this.registerHealthRoutes();
    this.registerSystemRoutes();
    this.registerChatRoutes();
    this.registerPipelineRoutes();
    this.registerSOPRoutes();
    this.registerTrainingRoutes();
    this.registerMemoryRoutes();
    this.registerSettingsRoutes();
    this.registerResearchRoutes();
    this.registerEmailRoutes();
    this.registerSocialRoutes();
    this.registerEventBusRoutes();
    this.registerProjectRoutes();
    this.registerDeployRoutes();
    this.registerContactRoutes();
    this.registerApprovalRoutes();
    this.registerSchedulerRoutes();
    this.registerDepartmentRoutes();
    this.registerBusinessProfileRoutes();
    this.registerDesktopAutonomyRoutes();
    this.registerDesktopControlRoutes();
    this.registerDesktopTrainRoutes();
    this.registerOnboardingRoutes();
    this.registerFormRoutes();
    this.registerWorkloadRoutes();
    this.registerIntegrationRoutes();
    this.registerTwilioRoutes();
    this.registerBillingRoutes();
    this.registerUpdateRoutes();
    this.registerFinanceRoutes();

    // Global error handler (must be last)
    this.registerErrorHandler();
    
    console.log('🌐 ApiGateway initialized — all routes registered');
    return this;
  }

  // ═══════════════════════════════════════════════════════
  // MIDDLEWARE
  // ═══════════════════════════════════════════════════════

  registerMiddleware() {
    // Request logging (lightweight)
    this.app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        const start = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - start;
          if (duration > 1000) {
            console.log(`[Gateway] SLOW ${req.method} ${req.path} — ${duration}ms`);
          }
        });
      }
      next();
    });
  }

  // ═══════════════════════════════════════════════════════
  // FORMS / QUIZZES
  // ═══════════════════════════════════════════════════════

  registerFormRoutes() {
    // GET /api/forms — List all forms
    this.app.get('/api/forms', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      const filter = {};
      if (req.query.status) filter.status = req.query.status;
      if (req.query.type) filter.type = req.query.type;
      if (req.query.search) filter.search = req.query.search;
      const forms = this.ace.formManager.getForms(filter);
      // Attach submission counts
      const formsWithCounts = await Promise.all(forms.map(async f => {
        const subs = await this.ace.formManager.loadSubmissions(f.id);
        return { ...f, submission_count: subs.length };
      }));
      res.json({ success: true, data: formsWithCounts });
    }));

    // GET /api/forms/:id — Get single form
    this.app.get('/api/forms/:id', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      const form = this.ace.formManager.getForm(req.params.id);
      if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
      res.json({ success: true, data: form });
    }));

    // POST /api/forms — Create form
    this.app.post('/api/forms', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      const form = await this.ace.formManager.createForm(req.body);
      res.json({ success: true, data: form });
    }));

    // PUT /api/forms/:id — Update form
    this.app.put('/api/forms/:id', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        const form = await this.ace.formManager.updateForm(req.params.id, req.body);
        res.json({ success: true, data: form });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // DELETE /api/forms/:id — Delete form
    this.app.delete('/api/forms/:id', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        await this.ace.formManager.deleteForm(req.params.id);
        res.json({ success: true });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // POST /api/forms/:id/publish
    this.app.post('/api/forms/:id/publish', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        const form = await this.ace.formManager.publishForm(req.params.id);
        res.json({ success: true, data: form });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // POST /api/forms/:id/unpublish
    this.app.post('/api/forms/:id/unpublish', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        const form = await this.ace.formManager.unpublishForm(req.params.id);
        res.json({ success: true, data: form });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // CORS preflight for form submissions from externally deployed forms
    this.app.options('/api/forms/:id/submit', (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.sendStatus(204);
    });

    // POST /api/forms/:id/submit — Public submission endpoint
    this.app.post('/api/forms/:id/submit', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      next();
    }, this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        const submission = await this.ace.formManager.addSubmission(req.params.id, req.body);
        res.json({ success: true, data: submission });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // GET /api/forms/:id/submissions — List submissions
    this.app.get('/api/forms/:id/submissions', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      const { offset, limit } = req.query;
      const result = await this.ace.formManager.getSubmissions(req.params.id, {
        offset: parseInt(offset) || 0,
        limit: parseInt(limit) || 50
      });
      res.json({ success: true, data: result });
    }));

    // GET /api/forms/:id/submissions/stats — Submission statistics
    this.app.get('/api/forms/:id/submissions/stats', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      const stats = await this.ace.formManager.getSubmissionStats(req.params.id);
      if (!stats) return res.status(404).json({ success: false, error: 'Form not found' });
      res.json({ success: true, data: stats });
    }));

    // DELETE /api/forms/:id/submissions/:subId — Delete submission
    this.app.delete('/api/forms/:id/submissions/:subId', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        await this.ace.formManager.deleteSubmission(req.params.id, req.params.subId);
        res.json({ success: true });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // POST /api/forms/:id/sync — Sync submissions from Firestore
    this.app.post('/api/forms/:id/sync', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      try {
        const result = await this.ace.formManager.syncFromFirestore(req.params.id);
        res.json({ success: true, data: result });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // GET /api/forms/:id/preview — Rendered HTML preview
    this.app.get('/api/forms/:id/preview', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      const form = this.ace.formManager.getForm(req.params.id);
      if (!form) return res.status(404).json({ success: false, error: 'Form not found' });
      const html = FormRenderer.render(form);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }));

    // POST /api/forms/:id/deploy — Deploy form to a hosting target
    this.app.post('/api/forms/:id/deploy', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.json({ success: false, error: 'FormManager not initialized' });
      let form = this.ace.formManager.getForm(req.params.id);
      if (!form) return res.status(404).json({ success: false, error: 'Form not found' });

      const { target, options = {} } = req.body || {};

      // Save Firebase config to form settings if provided (persists for future deploys)
      if (target === 'firebase' && options.firebaseConfig) {
        await this.ace.formManager.updateForm(form.id, { settings: { firebase: options.firebaseConfig } });
        form = this.ace.formManager.getForm(req.params.id);
      }

      // Step 1: Determine server URL for form submissions
      const configPath = path.join(this.baseDir, 'config/openace.config.json');
      let serverUrl = '';
      try {
        const cfg = JSON.parse(await fs.readFile(configPath, 'utf-8'));
        serverUrl = cfg.server?.public_url || cfg.server?.url || '';
      } catch (e) { /* use relative URL as fallback */ }

      // Step 2: Write project files locally
      const projectName = form.slug || form.id;
      const files = FormRenderer.renderProjectFiles(form, { serverUrl });
      const projectDir = path.join(this.baseDir, 'projects', projectName);
      await fs.mkdir(projectDir, { recursive: true });
      for (const file of files) {
        const filePath = path.join(projectDir, file.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
      }

      // Step 3: Deploy via DeployPipeline if target specified
      if (target && this.ace.deployPipeline) {
        try {
          const result = await this.ace.deployPipeline.deploy(projectName, target, options);
          return res.json({ success: result.success, data: { ...result, slug: form.slug, projectName } });
        } catch (e) {
          return res.json({ success: false, error: `Deploy to ${target} failed: ${e.message}` });
        }
      }

      // No target — just local project creation
      res.json({ success: true, data: { projectDir, slug: form.slug, studioUrl: `/studio?project=${projectName}` } });
    }));

    // GET /forms/:slug — Public live URL (not under /api/)
    this.app.get('/forms/:slug', this.wrap(async (req, res) => {
      if (!this.ace?.formManager) return res.status(503).send('Forms not available');
      const form = this.ace.formManager.getFormBySlug(req.params.slug);
      if (!form) return res.status(404).send('Form not found');
      const html = FormRenderer.render(form);
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    }));
  }

  registerErrorHandler() {
    this.app.use((err, req, res, next) => {
      console.error(`[Gateway] Error on ${req.method} ${req.path}:`, err.message);
      res.status(500).json({
        success: false,
        error: err.message,
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });
  }

  // Helper: wrap async route handlers to catch errors
  wrap(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  // Helper: check if ace is initialized
  requireAce(res) {
    if (!this.ace) {
      res.json({ success: false, error: 'OpenAce not initialized yet' });
      return false;
    }
    return true;
  }

  // ═══════════════════════════════════════════════════════
  // HEALTH & MONITORING
  // ═══════════════════════════════════════════════════════

  registerHealthRoutes() {
    this.app.get('/api/health', (req, res) => {
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);
      const mem = process.memoryUsage();
      res.json({
        status: this.ace?.initialized ? 'healthy' : 'initializing',
        uptime,
        memory: {
          rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024) + 'MB'
        },
        aceInitialized: !!this.ace?.initialized,
        aiProvider: this.ace?.aiManager?.activeProvider || 'none',
        components: {
          brain: !!this.ace?.brain?.initialized,
          actionEngine: !!this.ace?.actionEngine?.initialized,
          browserAgent: !!this.ace?.browserAgent,
          sopExecutor: !!this.ace?.sopExecutor,
          scheduler: !!this.ace?.autonomousScheduler?.isRunning,
          pipeline: !!this.ace?.pipelineManager,
          google: !!this.ace?.google?.isConnected?.(),
          telegram: !!this.ace?.config?.telegram?.enabled,
          eventBus: eventBus.getStatus()
        },
        sseClients: this.sseClients.size,
        selfHealer: !!this.ace?.brain?.selfHealer,
        timestamp: new Date().toISOString()
      });
    });

    // SelfHealer diagnostics endpoint
    this.app.get('/api/diagnostics', this.wrap(async (req, res) => {
      const healer = this.ace?.brain?.selfHealer;
      if (!healer) {
        return res.json({ success: false, error: 'SelfHealer not available' });
      }
      res.json({
        success: true,
        data: healer.getErrorSummary(),
      });
    }));

    // On-demand health check
    this.app.get('/api/diagnostics/health', this.wrap(async (req, res) => {
      const healer = this.ace?.brain?.selfHealer;
      if (!healer) {
        return res.json({ success: false, error: 'SelfHealer not available' });
      }
      const subsystems = {};
      if (this.ace.aiManager) subsystems.aiManager = this.ace.aiManager;
      if (this.ace.pipelineManager) subsystems.pipelineManager = this.ace.pipelineManager;
      if (this.ace.actionEngine) subsystems.actionEngine = this.ace.actionEngine;
      if (this.ace.autonomousScheduler) subsystems.scheduler = this.ace.autonomousScheduler;
      if (this.ace.contactManager) subsystems.contactManager = this.ace.contactManager;

      const results = await healer.healthCheck(subsystems);
      res.json({ success: true, data: results });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SYSTEM INFO
  // ═══════════════════════════════════════════════════════

  registerSystemRoutes() {
    this.app.get('/api/system-info', (req, res) => {
      const uptime = Date.now() - this.startTime;
      res.json({
        success: true,
        data: {
          status: this.ace ? 'active' : 'initializing',
          uptime: Math.floor(uptime / 1000),
          version: '1.0.0',
          aiProvider: this.ace?.aiManager?.activeProvider || 'ollama'
        }
      });
    });

    this.app.get('/api/activity-stats', (req, res) => {
      if (!this.activityLogger) {
        return res.json({ success: true, data: { messages: 0, actions: 0, files: 0, conversations: 0 } });
      }
      res.json({ success: true, data: this.activityLogger.getStats() });
    });

    this.app.get('/api/recent-activity', (req, res) => {
      const limit = parseInt(req.query.limit) || 50;
      if (!this.activityLogger) {
        return res.json({ success: true, data: [] });
      }
      res.json({ success: true, data: this.activityLogger.getRecentActivities(limit) });
    });

    this.app.get('/api/conversations', (req, res) => {
      if (!this.activityLogger) return res.json({ success: true, data: [] });
      res.json({ success: true, data: this.activityLogger.getAllConversations() });
    });

    this.app.get('/api/conversation/:chatId', (req, res) => {
      if (!this.activityLogger) return res.json({ success: true, data: { messages: [] } });
      res.json({ success: true, data: this.activityLogger.getConversation(req.params.chatId) });
    });

    this.app.get('/api/work-products', (req, res) => {
      if (!this.activityLogger) return res.json({ success: true, data: [] });
      res.json({ success: true, data: this.activityLogger.getWorkProducts() });
    });

    this.app.get('/api/file-content', this.wrap(async (req, res) => {
      const filePath = req.query.path;
      const fullPath = path.join(this.baseDir, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');
      res.json({ success: true, data: content });
    }));

    this.app.get('/api/status', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const status = this.ace.getStatus();
      if (this.ace.brain) status.brain = this.ace.brain.getStatus();
      res.json({ success: true, data: status });
    }));

    this.app.get('/api/brain-status', (req, res) => {
      if (!this.ace?.brain) {
        return res.json({ success: true, data: { initialized: false, message: 'AceBrain not initialized' } });
      }
      res.json({ success: true, data: this.ace.brain.getStatus() });
    });

    this.app.get('/api/skills', (req, res) => {
      if (!this.requireAce(res)) return;
      res.json({ success: true, data: this.ace.skillsManager.getAllSkills() });
    });

    // ── Tool Management API ──

    this.app.get('/api/tools', (req, res) => {
      if (!this.requireAce(res)) return;
      const agent = this.ace.brain?.unifiedAgent;
      if (!agent) return res.json({ success: false, error: 'UnifiedAgent not initialized' });

      const groups = agent.getToolGroups();
      const disabledTools = [...(agent._disabledTools || [])];

      res.json({
        success: true,
        data: {
          groups,
          disabledTools,
          totalTools: Object.values(groups).reduce((sum, g) => sum + g.tools.length, 0),
        }
      });
    });

    this.app.post('/api/tools/preferences', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const agent = this.ace.brain?.unifiedAgent;
      if (!agent) return res.json({ success: false, error: 'UnifiedAgent not initialized' });

      const { disabledTools = [] } = req.body;
      const prefsPath = path.join(process.cwd(), 'data/config/tool-preferences.json');
      const prefsDir = path.dirname(prefsPath);

      await fs.mkdir(prefsDir, { recursive: true });
      await fs.writeFile(prefsPath, JSON.stringify({
        disabledTools,
        updatedAt: new Date().toISOString(),
      }, null, 2));

      await agent.loadToolPreferences();
      res.json({ success: true, disabledCount: disabledTools.length });
    }));

    this.app.get('/api/permissions', (req, res) => {
      if (!this.requireAce(res)) return;
      res.json({ success: true, data: this.ace.getPermissions() });
    });

    this.app.get('/api/modes', (req, res) => {
      res.json({
        success: true,
        data: [
          { id: 'auto', name: 'Auto', icon: '🎯', description: 'Let Ace decide the best approach', color: '#667eea' },
          { id: 'cto', name: 'CTO', icon: '💻', description: 'Technical tasks: code, deploy, architecture', color: '#10b981' },
          { id: 'cmo', name: 'CMO', icon: '📊', description: 'Marketing: leads, campaigns, content', color: '#f59e0b' },
          { id: 'coo', name: 'COO', icon: '⚙️', description: 'Operations: processes, efficiency, planning', color: '#ef4444' }
        ]
      });
    });

    this.app.get('/api/recent-actions', (req, res) => {
      const limit = parseInt(req.query.limit) || 20;
      if (!this.activityLogger) return res.json({ success: true, data: [] });
      const actions = this.activityLogger.getRecentActions?.(limit) || [];
      res.json({ success: true, data: actions });
    });
  }

  // ═══════════════════════════════════════════════════════
  // CHAT
  // ═══════════════════════════════════════════════════════

  registerChatRoutes() {
    // ═══ Conversation management endpoints ═══
    this.app.get('/api/conversations', this.wrap(async (req, res) => {
      if (!this.activityLogger) return res.json({ success: true, data: [] });
      const conversations = this.activityLogger.getAllConversations();
      const enriched = conversations.map(conv => {
        const messages = this.activityLogger.getConversation(conv.chatId);
        const firstUserMsg = messages.find(m => m.role === 'user');
        const title = firstUserMsg
          ? firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
          : 'New conversation';
        return { ...conv, title };
      });
      res.json({ success: true, data: enriched });
    }));

    this.app.get('/api/conversations/:chatId', this.wrap(async (req, res) => {
      if (!this.activityLogger) return res.json({ success: true, data: [] });
      const messages = this.activityLogger.getConversation(req.params.chatId);
      res.json({ success: true, data: messages });
    }));

    this.app.delete('/api/conversations/:chatId', this.wrap(async (req, res) => {
      if (!this.activityLogger) return res.json({ success: false, error: 'No activity logger' });
      this.activityLogger.conversations.delete(req.params.chatId);
      await this.activityLogger.save();
      res.json({ success: true });
    }));

    // ═══ Chat endpoint ═══
    this.app.post('/api/chat', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;

      // If a project name is provided, prepend Studio context prefix so ActionEngine picks it up
      let chatMessage = req.body.message || '';
      const conversationId = req.body.conversationId || 'desktop';
      const images = req.body.images || []; // Array of base64 strings
      if (req.body.project && !chatMessage.startsWith('[Studio Project:')) {
        chatMessage = `[Studio Project: ${req.body.project}] ${chatMessage}`;
      }

      const response = await this.ace.chat(chatMessage, { images, conversationId });

      if (this.activityLogger) {
        const logContent = images.length > 0
          ? `[${images.length} image(s) attached] ${req.body.message || '(image only)'}`
          : req.body.message;
        if (logContent) {
          this.activityLogger.logMessage(conversationId, 'user', logContent);
        }
        const assistantMessage = response?.response || response?.message || response?.data?.message || 'Response received';
        if (assistantMessage) {
          this.activityLogger.logMessage(conversationId, 'assistant', assistantMessage);
        }
      }

      const result = { success: true, data: response };
      if (response?.thinking) result.thinking = response.thinking;
      res.json(result);
    }));

    this.app.post('/api/chat-stream', this.wrap(async (req, res) => {
      if (!this.ace) return res.json({ error: 'OpenAce not initialized' });

      // Usage tracking — enforce free message limit for anonymous users
      if (this._usageTracker) {
        const usage = this._usageTracker.checkAndTrack(req);
        if (!usage.allowed) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.write(`data: ${JSON.stringify({ type: 'message', content: usage.message })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          return res.end();
        }
      }

      const { message: rawMessage, mode, project, conversationId, images: rawImages } = req.body;
      const images = rawImages || [];

      // Free tier: limit tools and iterations for anonymous users
      const isFreeTier = !req.userId || req.userId === 'local' || req.userId === null;
      if (isFreeTier && this.ace?.brain?.unifiedAgent) {
        this.ace.brain.unifiedAgent._freeTierMode = true;
      }

      // Force real search for lead/research requests — don't let the model hallucinate
      const lowerMsg = (rawMessage || '').toLowerCase();
      const wantsLeads = /\b(find|search|get|show|pull|look)\b.*\b(lead|client|customer|prospect|compan)/i.test(rawMessage);
      const wantsResearch = /\b(research|look up|check out|analyze)\b.*\b(competitor|company|website|market)/i.test(rawMessage);

      if (isFreeTier && (wantsLeads || wantsResearch) && this.ace?.brain?.unifiedAgent) {
        const agent = this.ace.brain.unifiedAgent;

        // Extract search terms from the message
        const searchQuery = rawMessage.replace(/^(find|search|get|show|pull|look for|can you find)\s+(me\s+)?/i, '').trim();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        res.write(`data: ${JSON.stringify({ type: 'thinking', content: 'Searching...' })}\n\n`);

        try {
          // Call the REAL search tool directly
          const resultJson = await agent._toolWebSearch({ query: searchQuery });
          const parsed = JSON.parse(resultJson);

          let responseText;
          if (parsed.results && parsed.results.length > 0) {
            const formatted = parsed.results.slice(0, 8).map((r, i) =>
              `**${i + 1}. ${r.title}**\n   ${r.url}${r.snippet ? '\n   ' + r.snippet.substring(0, 150) : ''}`
            ).join('\n\n');

            responseText = wantsLeads
              ? `Found ${parsed.results.length} results. Here are the top leads:\n\n${formatted}\n\nWant me to dig deeper into any of these, or should I draft outreach emails to the best ones?`
              : `Here's what I found:\n\n${formatted}\n\nWant me to dig deeper into any of these?`;
          } else {
            responseText = `I searched but didn't find strong results for "${searchQuery}". Can you be more specific — what industry and what city?`;
          }

          const response = { message: responseText, toolsUsed: [wantsLeads ? 'find_leads' : 'web_search'] };
          res.write(`data: ${JSON.stringify({ type: 'response', content: response, thinking: ['Searching...'] })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

          if (rawMessage && responseText) {
            this._conversationCapture.capture(rawMessage, responseText);
          }
        } catch (err) {
          res.write(`data: ${JSON.stringify({ type: 'response', content: { message: `Search hit an issue: ${err.message}. Try being more specific — what industry and city?` } })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
        }

        return res.end();
      }

      // If a project name is provided, prepend Studio context prefix so ActionEngine picks it up
      let message = rawMessage;
      if (project && !rawMessage.startsWith('[Studio Project:')) {
        message = `[Studio Project: ${project}] ${rawMessage}`;
      }

      // Server-Sent Events
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const progressMessages = [];
      const originalOnProgress = this.ace.onProgress;

      this.ace.onProgress = (msg) => {
        progressMessages.push(msg);
        res.write(`data: ${JSON.stringify({ type: 'thinking', content: msg })}\n\n`);
        originalOnProgress(msg);
      };

      try {
        res.write(`data: ${JSON.stringify({ type: 'thinking', content: '🧠 AceBrain thinking...' })}\n\n`);

        let response;
        switch (mode) {
          case 'cto':
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: '💻 CTO Mode: Focusing on technical execution...' })}\n\n`);
            response = await this.ace.work(message, { mode: 'code' });
            break;
          case 'cmo':
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: '📊 CMO Mode: Focusing on marketing & leads...' })}\n\n`);
            response = await this.ace.work(message, { mode: 'lead' });
            break;
          case 'coo':
            res.write(`data: ${JSON.stringify({ type: 'thinking', content: '⚙️ COO Mode: Focusing on operations & efficiency...' })}\n\n`);
            response = await this.ace.chat(message, { images, conversationId });
            break;
          default:
            response = await this.ace.chat(message, { images, conversationId });
        }
        
        if (this.activityLogger && message) {
          const streamConvId = conversationId || 'desktop';
          this.activityLogger.logMessage(streamConvId, 'user', `[${mode || 'auto'}] ${message}`);
          const assistantMessage = response?.message || response?.data?.summary || 'Response received';
          this.activityLogger.logMessage(streamConvId, 'assistant', assistantMessage);
        }
        
        const thinkingSteps = response?.thinking || progressMessages;
        res.write(`data: ${JSON.stringify({ type: 'response', content: response, thinking: thinkingSteps })}\n\n`);

        // Capture conversation for LLM training improvement
        const responseText = response?.message || response?.data?.summary || '';
        if (rawMessage && responseText) {
          this._conversationCapture.capture(rawMessage, responseText);
        }
        res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);

      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', content: error.message })}\n\n`);
      } finally {
        this.ace.onProgress = originalOnProgress;
        res.end();
      }
    }));

    // Stop Ace's current processing (user clicked Stop button)
    this.app.post('/api/chat/stop', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      this.ace.stopProcessing();
      res.json({ success: true, message: 'Stop signal sent' });
    }));

    // Execute confirmed pipeline actions from the confirmation card
    this.app.post('/api/execute-actions', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const { actions } = req.body;
      if (!Array.isArray(actions) || actions.length === 0) {
        return res.json({ success: false, error: 'No actions provided' });
      }

      const pm = this.ace.pipelineManager;
      if (!pm) {
        return res.json({ success: false, error: 'Pipeline manager not available' });
      }

      const results = [];
      for (const action of actions) {
        try {
          if (action.type === 'add_task') {
            const task = await pm.addTask({
              title: action.title,
              description: action.description || '',
              priority: action.priority || 'medium',
              assigned_to: action.assigned_to || 'ace',
              stage: 'inbox',
              created_by: 'ace',
            });
            results.push({ success: true, type: 'task', id: task.id, title: task.title });
          } else if (action.type === 'add_lead') {
            const lead = await pm.addLead({
              company: action.company || action.title,
              contact_name: action.contact_name || '',
              source: action.source || 'ace',
              created_by: 'ace',
            });
            results.push({ success: true, type: 'lead', id: lead.id, title: lead.company });
          } else {
            results.push({ success: false, type: action.type, error: 'Unsupported action type' });
          }
        } catch (err) {
          results.push({ success: false, type: action.type, error: err.message });
        }
      }

      // Send Telegram notification if bot is available
      const tgBot = this.ace?.telegramBot;
      if (tgBot?.isRunning) {
        const added = results.filter(r => r.success);
        if (added.length > 0) {
          const lines = added.map(r =>
            `• ${r.type === 'task' ? '📋' : '👥'} ${r.title}`
          ).join('\n');
          tgBot.notify(
            `*${added.length} item${added.length !== 1 ? 's' : ''} added to pipeline from dashboard:*\n${lines}`,
            'normal'
          ).catch(() => {}); // fire-and-forget
        }
      }

      res.json({ success: true, results });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // PIPELINE
  // ═══════════════════════════════════════════════════════

  registerPipelineRoutes() {
    this.app.get('/api/pipeline', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const pipeline = await this.ace.getPipeline();
      res.json({ success: true, data: pipeline });
    }));

    this.app.get('/api/pipeline-stats', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const stats = this.ace.getPipelineStats();
      res.json({ success: true, data: stats });
    }));

    const defaultTaskStages = [
      { id: 'inbox', name: 'Inbox', icon: '📥' },
      { id: 'todo', name: 'To Do', icon: '📋' },
      { id: 'in_progress', name: 'In Progress', icon: '⚡' },
      { id: 'review', name: 'Review', icon: '👀' },
      { id: 'done', name: 'Done', icon: '✅' }
    ];

    const defaultLeadStages = [
      { id: 'new', name: 'New', icon: '🆕' },
      { id: 'contacted', name: 'Contacted', icon: '📧' },
      { id: 'qualified', name: 'Qualified', icon: '✓' },
      { id: 'proposal', name: 'Proposal', icon: '📄' },
      { id: 'won', name: 'Won', icon: '🏆' },
      { id: 'lost', name: 'Lost', icon: '❌' }
    ];

    this.app.get('/api/pipeline/task-stages', (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: true, data: defaultTaskStages });
      res.json({ success: true, data: this.ace.pipelineManager.getTaskStages() });
    });

    this.app.get('/api/pipeline/lead-stages', (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: true, data: defaultLeadStages });
      res.json({ success: true, data: this.ace.pipelineManager.getLeadStages() });
    });

    this.app.get('/api/pipeline/tasks', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: true, data: [] });
      res.json({ success: true, data: await this.ace.pipelineManager.getTasks() });
    }));

    this.app.get('/api/pipeline/leads', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: true, data: [] });
      res.json({ success: true, data: await this.ace.pipelineManager.getLeads() });
    }));

    this.app.post('/api/pipeline/tasks', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      const task = await this.ace.pipelineManager.addTask(req.body);
      eventBus.emit(EVENTS.TASK_ADDED, { task });
      res.json({ success: true, data: task });
    }));

    this.app.post('/api/pipeline/leads', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      const lead = await this.ace.pipelineManager.addLead(req.body);
      eventBus.emit(EVENTS.LEAD_ADDED, { lead });
      res.json({ success: true, data: lead });
    }));

    this.app.post('/api/pipeline/tasks/:id/move', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      await this.ace.pipelineManager.moveTask(req.params.id, req.body.stage);
      eventBus.emit(EVENTS.TASK_MOVED, { taskId: req.params.id, stage: req.body.stage });
      res.json({ success: true });
    }));

    this.app.post('/api/pipeline/leads/:id/move', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      await this.ace.pipelineManager.moveLead(req.params.id, req.body.stage);
      eventBus.emit(EVENTS.LEAD_MOVED, { leadId: req.params.id, stage: req.body.stage });
      res.json({ success: true });
    }));

    // Delete task
    this.app.delete('/api/pipeline/tasks/:id', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      try {
        await this.ace.pipelineManager.deleteTask(req.params.id);
        res.json({ success: true });
      } catch (e) {
        // Return success even if not found (idempotent delete)
        res.json({ success: true, note: e.message });
      }
    }));

    // Get single lead with form submission data
    this.app.get('/api/pipeline/leads/:id', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      const lead = this.ace.pipelineManager.getLead(req.params.id);
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });

      let formData = null;
      if (lead.form_id && this.ace.formManager) {
        const form = this.ace.formManager.getForm(lead.form_id);
        if (form) {
          formData = { form_name: form.name, form_type: form.type, steps: form.steps };
          if (lead.submission_id) {
            const subs = await this.ace.formManager.loadSubmissions(lead.form_id);
            const submission = subs.find(s => s.id === lead.submission_id);
            if (submission) formData.submission = submission;
          }
        }
      } else if (lead.source?.startsWith('form:') && lead.email && this.ace.formManager) {
        const formName = lead.source.replace('form:', '');
        const allForms = this.ace.formManager.getForms();
        const matchedForm = allForms.find(f => f.name === formName);
        if (matchedForm) {
          formData = { form_name: matchedForm.name, form_type: matchedForm.type, steps: matchedForm.steps };
          const subs = await this.ace.formManager.loadSubmissions(matchedForm.id);
          const matchedSub = subs.find(s => s.contact?.email === lead.email);
          if (matchedSub) formData.submission = matchedSub;
        }
      }

      res.json({ success: true, data: { ...lead, formData } });
    }));

    // Update lead fields
    this.app.put('/api/pipeline/leads/:id', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      const updated = await this.ace.pipelineManager.updateLead(req.params.id, req.body);
      eventBus.emit(EVENTS.LEAD_UPDATED, { lead: updated });
      res.json({ success: true, data: updated });
    }));

    // Add note to lead
    this.app.post('/api/pipeline/leads/:id/notes', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      const updated = await this.ace.pipelineManager.addNote(req.params.id, req.body.note, req.body.author || 'user');
      eventBus.emit(EVENTS.LEAD_UPDATED, { lead: updated });
      res.json({ success: true, data: updated });
    }));

    // Delete lead
    this.app.delete('/api/pipeline/leads/:id', this.wrap(async (req, res) => {
      if (!this.ace?.pipelineManager) return res.json({ success: false, error: 'Pipeline not initialized' });
      try {
        await this.ace.pipelineManager.deleteLead(req.params.id);
        res.json({ success: true });
      } catch (e) {
        // Return success even if not found (idempotent delete)
        res.json({ success: true, note: e.message });
      }
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SOPs
  // ═══════════════════════════════════════════════════════

  registerSOPRoutes() {
    this.app.get('/api/sops', this.wrap(async (req, res) => {
      if (!this.ace?.sopManager) {
        // Fallback: load directly from files
        try {
          const sopDir = path.join(this.baseDir, 'data/sops');
          const categories = await fs.readdir(sopDir);
          const allSOPs = [];
          for (const category of categories) {
            const categoryPath = path.join(sopDir, category);
            const stat = await fs.stat(categoryPath);
            if (stat.isDirectory()) {
              const files = await fs.readdir(categoryPath);
              for (const file of files) {
                if (file.endsWith('.json')) {
                  const content = await fs.readFile(path.join(categoryPath, file), 'utf-8');
                  allSOPs.push({ ...JSON.parse(content), category });
                }
              }
            }
          }
          return res.json({ success: true, data: allSOPs });
        } catch { return res.json({ success: true, data: [] }); }
      }
      res.json({ success: true, data: await this.ace.sopManager.getAllSOPs() });
    }));

    this.app.post('/api/sops/:id/run', this.wrap(async (req, res) => {
      if (!this.ace) return res.json({ success: false, error: 'OpenAce not initialized' });
      // SOPExecutor.executeSOP() emits SOP_STARTED with full data (sopName, stepCount)
      const result = await this.ace.runSOP(req.params.id);
      res.json({ success: true, data: result });
    }));

    this.app.delete('/api/sops/:id', this.wrap(async (req, res) => {
      if (!this.ace?.sopManager) return res.json({ success: false, error: 'SOP Manager not initialized' });
      await this.ace.sopManager.deleteSOP(req.params.id);
      res.json({ success: true });
    }));

    // Generate SOP from natural language description ("teach by chat")
    this.app.post('/api/sops/generate', this.wrap(async (req, res) => {
      if (!this.ace?.brain) return res.json({ success: false, error: 'AceBrain not initialized' });
      const { description, name } = req.body;
      if (!description) return res.json({ success: false, error: 'Description is required' });
      
      const sop = await this.ace.brain.generateSOPFromChat(description, name);
      if (sop) {
        res.json({ success: true, data: sop });
      } else {
        res.json({ success: false, error: 'Failed to generate SOP from description' });
      }
    }));

    // Update SOP steps (SOP editor)
    this.app.put('/api/sops/:id', this.wrap(async (req, res) => {
      if (!this.ace?.sopManager) return res.json({ success: false, error: 'SOP Manager not initialized' });
      const sop = this.ace.sopManager.getSOP(req.params.id);
      if (!sop) return res.json({ success: false, error: 'SOP not found' });
      
      const updates = req.body;
      if (updates.name) sop.name = updates.name;
      if (updates.description) sop.description = updates.description;
      if (updates.steps) sop.steps = updates.steps;
      if (updates.category) sop.category = updates.category;
      if (updates.triggerPatterns) sop.triggerPatterns = updates.triggerPatterns;
      if (updates.triggers) sop.triggers = updates.triggers;
      if (updates.department) sop.department = updates.department;
      
      sop.updatedAt = new Date().toISOString();
      await this.ace.sopManager.saveSOP(sop);
      res.json({ success: true, data: sop });
    }));

    // Correct a single SOP step (after ShowMe / inline fix)
    this.app.patch('/api/sops/:id/steps/:stepNum', this.wrap(async (req, res) => {
      if (!this.ace?.sopManager) return res.json({ success: false, error: 'SOP Manager not initialized' });
      const sop = this.ace.sopManager.getSOP(req.params.id);
      if (!sop) return res.json({ success: false, error: 'SOP not found' });

      const stepIdx = parseInt(req.params.stepNum) - 1;
      if (stepIdx < 0 || stepIdx >= sop.steps.length) {
        return res.json({ success: false, error: 'Invalid step number' });
      }

      const { target, text, x, y, action, url, key } = req.body;
      const step = sop.steps[stepIdx];
      if (target !== undefined) step.target = target;
      if (text !== undefined) step.text = text;
      if (url !== undefined) step.url = url;
      if (key !== undefined) step.key = key;
      if (x != null) step.x = x;
      if (y != null) step.y = y;
      if (action) step.action = action;
      step._correctedAt = new Date().toISOString();

      sop.updatedAt = new Date().toISOString();
      await this.ace.sopManager.saveSOP(sop);
      res.json({ success: true, data: { sopId: sop.id, stepNum: stepIdx + 1, step } });
    }));

    // Test-run an SOP (execute and return detailed results)
    this.app.post('/api/sops/:id/test-run', this.wrap(async (req, res) => {
      if (!this.ace) return res.json({ success: false, error: 'OpenAce not initialized' });
      // SOPExecutor.executeSOP() emits SOP_STARTED with full data (sopName, stepCount)
      const result = await this.ace.runSOP(req.params.id);
      res.json({ success: true, data: result });
    }));

    // Get learning data for an SOP
    this.app.get('/api/sops/:id/learning', this.wrap(async (req, res) => {
      const learningPath = path.join(this.baseDir, 'data/sops', req.params.id, 'learning.json');
      try {
        const data = JSON.parse(await fs.readFile(learningPath, 'utf-8'));
        res.json({ success: true, data });
      } catch {
        res.json({ success: true, data: null });
      }
    }));

    // Start per-step recording (Show Ace How)
    this.app.post('/api/sops/:id/steps/:stepNum/record', this.wrap(async (req, res) => {
      if (!this.ace) return res.json({ success: false, error: 'OpenAce not initialized' });
      try {
        await this.ace.recordStepGuide(parseInt(req.params.stepNum), '', req.params.id);
        res.json({ success: true });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // Stop per-step recording
    this.app.post('/api/sops/:id/steps/:stepNum/record-stop', this.wrap(async (req, res) => {
      if (!this.ace) return res.json({ success: false, error: 'OpenAce not initialized' });
      try {
        await this.ace.finishStepGuide();
        res.json({ success: true });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));
  }

  // ═══════════════════════════════════════════════════════
  // TRAINING
  // ═══════════════════════════════════════════════════════

  registerTrainingRoutes() {
    this.app.post('/api/training/start', this.wrap(async (req, res) => {
      if (!this.ace?.browserTrainer) return res.json({ success: false, error: 'BrowserTrainer not initialized' });
      const { sessionName, startUrl } = req.body;
      if (!sessionName) return res.json({ success: false, error: 'sessionName is required' });
      const result = await this.ace.browserTrainer.startTraining(sessionName, startUrl || '');
      res.json({ success: result.success, data: result });
    }));

    this.app.post('/api/training/stop', this.wrap(async (req, res) => {
      if (!this.ace?.browserTrainer) return res.json({ success: false, error: 'BrowserTrainer not initialized' });
      const { name, description, category, triggers, credentialId } = req.body;
      const result = await this.ace.browserTrainer.stopTraining({ name, description, category, triggers, credentialId });
      res.json({ success: result.success, data: result });
    }));

    this.app.get('/api/training/status', (req, res) => {
      if (!this.ace?.browserTrainer) return res.json({ success: true, data: { isRecording: false, stepsRecorded: 0 } });
      res.json({ success: true, data: this.ace.browserTrainer.getStatus() });
    });

    this.app.get('/api/training/sessions', this.wrap(async (req, res) => {
      if (!this.ace?.browserTrainer) return res.json({ success: true, data: [] });
      const sessions = await this.ace.browserTrainer.getSavedSessions();
      res.json({ success: true, data: sessions });
    }));

    // Delete a training session
    this.app.delete('/api/training/sessions/:name', this.wrap(async (req, res) => {
      const trainingDir = path.join(this.baseDir, 'data', 'training');
      const sessionName = decodeURIComponent(req.params.name);
      const slug = sessionName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      
      // Delete raw recording file
      try {
        const rawFile = path.join(trainingDir, `sop_${slug}_raw.json`);
        await fs.unlink(rawFile);
      } catch (e) { /* file may not exist */ }
      
      // Delete screenshots directory
      try {
        const screenshotDir = path.join(trainingDir, 'screenshots', sessionName.replace(/\s+/g, '_'));
        await fs.rm(screenshotDir, { recursive: true, force: true });
      } catch (e) { /* dir may not exist */ }
      
      res.json({ success: true });
    }));

    // ── Teach by Telling: parse natural language into SOP ──
    this.app.post('/api/training/teach-by-telling', this.wrap(async (req, res) => {
      const { text, name, category, useAI } = req.body;
      if (!text) return res.json({ success: false, error: 'Text instructions are required' });

      const parser = new SOPParser({ aiManager: this.ace?.aiManager });
      let parsed;
      if (useAI && this.ace?.aiManager) {
        parsed = await parser.parseWithAI(text);
      } else {
        parsed = parser.parseText(text);
      }

      if (!parsed.steps.length) {
        return res.json({ success: false, error: 'Could not parse any steps from the provided text' });
      }

      // Build SOP object
      const sopName = name || parsed.name;
      const sopId = 'sop_' + sopName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const sop = {
        id: sopId,
        name: sopName,
        description: parsed.description,
        category: category || 'general',
        triggers: [sopName.toLowerCase()],
        keywords: sopName.toLowerCase().split(/\s+/),
        steps: parsed.steps,
        source: 'teach_by_telling',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRun: null,
        runCount: 0,
        schedule: null,
        enabled: true,
      };

      // Save the SOP
      if (this.ace?.sopManager) {
        await this.ace.sopManager.saveSOP(sop);
      } else {
        // Fallback: save to file
        const catDir = path.join(this.baseDir, 'data/sops', sop.category);
        await fs.mkdir(catDir, { recursive: true });
        await fs.writeFile(path.join(catDir, `${sop.id}.json`), JSON.stringify(sop, null, 2));
      }

      res.json({ success: true, data: sop });
    }));

    // ── Parse only (preview without saving) ──
    this.app.post('/api/training/parse-steps', this.wrap(async (req, res) => {
      const { text, useAI } = req.body;
      if (!text) return res.json({ success: false, error: 'Text is required' });

      const parser = new SOPParser({ aiManager: this.ace?.aiManager });
      let parsed;
      if (useAI && this.ace?.aiManager) {
        parsed = await parser.parseWithAI(text);
      } else {
        parsed = parser.parseText(text);
      }

      res.json({ success: true, data: parsed });
    }));

    // ── Guided Teaching: preview steps with quality scores ──
    this.app.post('/api/training/guided-preview', this.wrap(async (req, res) => {
      const { steps } = req.body;
      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.json({ success: false, error: 'Steps array is required' });
      }

      const parser = new SOPParser({ aiManager: this.ace?.aiManager });
      // Join steps with newlines so parseText handles them as individual lines
      // parseText also handles post-processing (implicit waits, content injection)
      const parsed = parser.parseText(steps.join('\n'));

      const qualityResult = parser.scoreSOPQuality(parsed.steps);

      res.json({
        success: true,
        data: { parsedSteps: parsed.steps, qualityResult },
      });
    }));

    // ── Guided Teaching: save SOP from step builder ──
    this.app.post('/api/training/guided-save', this.wrap(async (req, res) => {
      const { name, triggers, steps } = req.body;
      if (!name?.trim()) return res.json({ success: false, error: 'Process name is required' });
      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.json({ success: false, error: 'At least one step is required' });
      }

      const parser = new SOPParser({ aiManager: this.ace?.aiManager });
      const parsed = parser.parseText(steps.join('\n'));

      if (!parsed.steps.length) {
        return res.json({ success: false, error: 'Could not parse any steps from the provided text' });
      }

      // Build SOP object
      const sopName = name.trim();
      const sopId = 'sop_' + sopName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') + '_' + Date.now();
      const triggerList = (triggers && triggers.length > 0)
        ? triggers.map(t => t.toLowerCase().trim()).filter(Boolean)
        : [sopName.toLowerCase()];
      const keywords = sopName.toLowerCase().split(/\s+/).filter(w => w.length > 2);

      const sop = {
        id: sopId,
        name: sopName,
        description: parsed.description || `Process: ${sopName}`,
        category: 'custom',
        triggers: triggerList,
        keywords,
        steps: parsed.steps,
        source: 'guided_teaching',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRun: null,
        runCount: 0,
        schedule: null,
        enabled: true,
      };

      if (this.ace?.sopManager) {
        await this.ace.sopManager.saveSOP(sop);
      } else {
        const catDir = path.join(this.baseDir, 'data/sops', sop.category);
        await fs.mkdir(catDir, { recursive: true });
        await fs.writeFile(path.join(catDir, `${sop.id}.json`), JSON.stringify(sop, null, 2));
      }

      res.json({ success: true, data: sop });
    }));

    // ── Upload SOP Document: parse PDF/DOCX/TXT into SOP steps ──
    this.app.post('/api/training/upload-sop-document', this.wrap(async (req, res) => {
      const filename = decodeURIComponent(req.headers['x-filename'] || 'uploaded.txt');
      const ext = path.extname(filename).toLowerCase();

      // Collect raw file bytes
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
      const buffer = Buffer.concat(chunks);

      if (!buffer.length) {
        return res.json({ success: false, error: 'Empty file' });
      }

      // Extract text based on file type
      let extractedText = '';
      try {
        if (ext === '.pdf') {
          const { PDFParse } = await import('pdf-parse');
          const parser = new PDFParse({ data: buffer });
          const result = await parser.getText();
          extractedText = result.text;
        } else if (ext === '.docx' || ext === '.doc') {
          const mammoth = await import('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value;
        } else if (['.txt', '.md', '.text', '.csv'].includes(ext)) {
          extractedText = buffer.toString('utf-8');
        } else {
          // Try as plain text
          extractedText = buffer.toString('utf-8');
        }
      } catch (parseErr) {
        console.error('[Upload SOP] File parsing error:', parseErr.message);
        return res.json({ success: false, error: `Could not read file: ${parseErr.message}` });
      }

      if (!extractedText.trim()) {
        return res.json({ success: false, error: 'No text content found in the document' });
      }

      // Parse into SOP steps using AI-powered document parser
      const parser = new SOPParser({ aiManager: this.ace?.aiManager });
      const parsed = await parser.parseDocument(extractedText, filename);

      if (!parsed.steps.length) {
        return res.json({ success: false, error: 'Could not extract any actionable steps from the document' });
      }

      res.json({
        success: true,
        data: {
          ...parsed,
          extractedText: extractedText.substring(0, 2000), // Preview of raw text
          sourceFile: filename,
        }
      });
    }));

    // ── Desktop Recording: start ──
    this.app.post('/api/training/start-recording', this.wrap(async (req, res) => {
      const { sessionName } = req.body;
      if (!sessionName) return res.json({ success: false, error: 'sessionName is required' });

      const trainer = this.ace?.brain?.desktopTrainer || this.ace?.desktopTrainer;
      if (!trainer) return res.json({ success: false, error: 'DesktopTrainer not available' });

      const result = await trainer.startRecording(sessionName);
      res.json({ success: result.success, data: result });
    }));

    // ── Desktop Recording: stop ──
    this.app.post('/api/training/stop-recording', this.wrap(async (req, res) => {
      const { name, description, category } = req.body;

      const trainer = this.ace?.brain?.desktopTrainer || this.ace?.desktopTrainer;
      if (!trainer) return res.json({ success: false, error: 'DesktopTrainer not available' });

      const result = await trainer.stopRecording();
      // Save the SOP if one was generated
      if (result.success && result.sop && this.ace?.sopManager) {
        result.sop.name = name || result.sop.name;
        result.sop.description = description || result.sop.description;
        result.sop.category = category || 'general';
        await this.ace.sopManager.saveSOP(result.sop);
      }
      res.json({ success: result.success, data: result });
    }));

    // ── Recording: status ──
    this.app.get('/api/training/recording-status', (req, res) => {
      const trainer = this.ace?.brain?.desktopTrainer || this.ace?.desktopTrainer;
      if (trainer?.isRecording) {
        return res.json({ success: true, data: {
          isRecording: true,
          actionsRecorded: trainer.events?.length || 0,
          screenshotsCaptured: trainer.screenshots?.length || 0,
        }});
      }
      res.json({ success: true, data: { isRecording: false, actionsRecorded: 0, screenshotsCaptured: 0 } });
    });

    // ── Quick SOP: create from template ──
    this.app.post('/api/training/quick-sop', this.wrap(async (req, res) => {
      const { template, variables } = req.body;
      if (!template) return res.json({ success: false, error: 'Template name is required' });

      const templates = {
        'login-to-website': {
          name: `Login to ${variables?.url || 'website'}`,
          steps: [
            { action: 'navigate', url: variables?.url || 'https://example.com', description: `Go to ${variables?.url || 'website'}` },
            { action: 'wait', ms: 2000, description: 'Wait for page to load' },
            { action: 'fill_credentials', credentialId: variables?.credentialId || '', description: 'Fill in login credentials' },
            { action: 'click_submit', description: 'Click sign in' },
            { action: 'wait_navigation', description: 'Wait for login to complete' },
            { action: 'screenshot', description: 'Take confirmation screenshot' },
          ]
        },
        'search-and-extract': {
          name: `Search ${variables?.searchEngine || 'Google'} for ${variables?.query || 'data'}`,
          steps: [
            { action: 'navigate', url: variables?.searchUrl || 'https://google.com', description: `Go to ${variables?.searchEngine || 'Google'}` },
            { action: 'wait', ms: 1500, description: 'Wait for page' },
            { action: 'type', text: variables?.query || 'search query', description: `Type search query` },
            { action: 'click_submit', description: 'Submit search' },
            { action: 'wait', ms: 2000, description: 'Wait for results' },
            { action: 'screenshot', description: 'Capture results' },
            { action: 'extract', target: variables?.extractTarget || 'search results', description: 'Extract data' },
          ]
        },
        'post-on-social-media': {
          name: `Post on ${variables?.platform || 'social media'}`,
          steps: [
            { action: 'navigate', url: variables?.url || 'https://linkedin.com', description: `Go to ${variables?.platform || 'social media'}` },
            { action: 'wait', ms: 2000, description: 'Wait for page' },
            { action: 'click_text', text: variables?.postButton || 'Start a post', description: 'Click post button' },
            { action: 'wait', ms: 1000, description: 'Wait for editor' },
            { action: 'type', text: variables?.content || 'Post content here', description: 'Type post content' },
            { action: 'click_text', text: variables?.submitButton || 'Post', description: 'Submit post' },
            { action: 'wait', ms: 2000, description: 'Wait for confirmation' },
            { action: 'screenshot', description: 'Capture confirmation' },
          ]
        },
        'send-email-campaign': {
          name: `Send email via ${variables?.platform || 'email'}`,
          steps: [
            { action: 'navigate', url: variables?.url || 'https://mail.google.com', description: `Open ${variables?.platform || 'email'}` },
            { action: 'wait', ms: 2000, description: 'Wait for inbox' },
            { action: 'click_text', text: 'Compose', description: 'Click compose' },
            { action: 'wait', ms: 1000, description: 'Wait for compose window' },
            { action: 'type', text: variables?.to || 'recipient@example.com', description: 'Enter recipient' },
            { action: 'type', text: variables?.subject || 'Email subject', description: 'Enter subject' },
            { action: 'type', text: variables?.body || 'Email body', description: 'Type email body' },
            { action: 'click_text', text: 'Send', description: 'Send email' },
            { action: 'screenshot', description: 'Capture confirmation' },
          ]
        }
      };

      const tpl = templates[template];
      if (!tpl) return res.json({ success: false, error: `Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}` });

      const sopName = variables?.name || tpl.name;
      const sopId = 'sop_' + sopName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      const sop = {
        id: sopId,
        name: sopName,
        description: `Quick SOP from template: ${template}`,
        category: variables?.category || 'general',
        triggers: [sopName.toLowerCase()],
        keywords: sopName.toLowerCase().split(/\s+/),
        steps: tpl.steps,
        source: 'quick_template',
        templateId: template,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastRun: null,
        runCount: 0,
        schedule: null,
        enabled: true,
      };

      if (this.ace?.sopManager) {
        await this.ace.sopManager.saveSOP(sop);
      } else {
        const catDir = path.join(this.baseDir, 'data/sops', sop.category);
        await fs.mkdir(catDir, { recursive: true });
        await fs.writeFile(path.join(catDir, `${sop.id}.json`), JSON.stringify(sop, null, 2));
      }

      res.json({ success: true, data: sop });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SITE MEMORY & CREDENTIALS
  // ═══════════════════════════════════════════════════════

  registerMemoryRoutes() {
    this.app.get('/api/site-memory', this.wrap(async (req, res) => {
      const sitesDir = path.join(this.baseDir, 'data/memory/sites');
      const files = await fs.readdir(sitesDir).catch(() => []);
      const sites = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(sitesDir, file), 'utf-8');
          sites.push(JSON.parse(content));
        }
      }
      res.json({ success: true, data: sites });
    }));

    this.app.get('/api/credentials', this.wrap(async (req, res) => {
      const credsFile = path.join(this.baseDir, 'data/memory/credentials/credentials.enc');
      const exists = await fs.access(credsFile).then(() => true).catch(() => false);
      res.json({ success: true, data: exists ? [{ id: 'stored', email: '(encrypted)' }] : [] });
    }));

    // ═══ Research Memory Routes ═══

    this.app.get('/api/memory/research', this.wrap(async (req, res) => {
      const researchMemory = this.ace?.brain?.researchMemory;
      if (!researchMemory) {
        return res.json({ success: true, data: { sessions: [], stats: { totalSessions: 0, recent24h: 0, topics: [] } } });
      }
      const limit = parseInt(req.query.limit) || 20;
      const sessions = researchMemory.getRecentResearch(limit);
      const stats = researchMemory.getStats();
      res.json({ success: true, data: { sessions, stats } });
    }));

    this.app.get('/api/memory/research/:id', this.wrap(async (req, res) => {
      const researchMemory = this.ace?.brain?.researchMemory;
      if (!researchMemory) return res.json({ success: false, error: 'ResearchMemory not initialized' });
      const record = await researchMemory.getById(req.params.id);
      if (!record) return res.status(404).json({ success: false, error: 'Research not found' });
      res.json({ success: true, data: record });
    }));

    this.app.delete('/api/memory/research/:id', this.wrap(async (req, res) => {
      const researchMemory = this.ace?.brain?.researchMemory;
      if (!researchMemory) return res.json({ success: false, error: 'ResearchMemory not initialized' });
      const deleted = await researchMemory.deleteResearch(req.params.id);
      res.json({ success: deleted, message: deleted ? 'Deleted' : 'Not found' });
    }));

    // ═══ Correction Memory Routes ═══

    this.app.get('/api/memory/corrections', this.wrap(async (req, res) => {
      const correctionMemory = this.ace?.brain?.correctionMemory;
      if (!correctionMemory) {
        return res.json({ success: true, data: { corrections: [], stats: { totalCorrections: 0, totalApplied: 0, topics: [], recentCorrections: [] } } });
      }
      const limit = parseInt(req.query.limit) || 50;
      const corrections = correctionMemory.getAll(limit);
      const stats = correctionMemory.getStats();
      res.json({ success: true, data: { corrections, stats } });
    }));

    this.app.post('/api/memory/corrections', this.wrap(async (req, res) => {
      const correctionMemory = this.ace?.brain?.correctionMemory;
      if (!correctionMemory) return res.json({ success: false, error: 'CorrectionMemory not initialized' });
      const { wrongInfo, rightInfo, topic } = req.body;
      if (!wrongInfo || !rightInfo) {
        return res.status(400).json({ success: false, error: 'wrongInfo and rightInfo are required' });
      }
      const record = await correctionMemory.addManualCorrection(wrongInfo, rightInfo, topic || '');
      res.json({ success: true, data: record });
    }));

    this.app.delete('/api/memory/corrections/:id', this.wrap(async (req, res) => {
      const correctionMemory = this.ace?.brain?.correctionMemory;
      if (!correctionMemory) return res.json({ success: false, error: 'CorrectionMemory not initialized' });
      const deleted = await correctionMemory.deleteCorrection(req.params.id);
      res.json({ success: deleted, message: deleted ? 'Deleted' : 'Not found' });
    }));

    // ═══ Combined Memory Stats ═══

    this.app.get('/api/memory/stats', this.wrap(async (req, res) => {
      const researchMemory = this.ace?.brain?.researchMemory;
      const correctionMemory = this.ace?.brain?.correctionMemory;
      res.json({
        success: true,
        data: {
          research: researchMemory ? researchMemory.getStats() : { totalSessions: 0, recent24h: 0, topics: [] },
          corrections: correctionMemory ? correctionMemory.getStats() : { totalCorrections: 0, totalApplied: 0, topics: [], recentCorrections: [] },
        }
      });
    }));

    // ═══ Clear All Memory ═══

    this.app.delete('/api/memory/clear', this.wrap(async (req, res) => {
      const researchMemory = this.ace?.brain?.researchMemory;
      const correctionMemory = this.ace?.brain?.correctionMemory;
      let cleared = { research: 0, corrections: 0 };

      if (researchMemory) {
        const purged = await researchMemory.purgeOld(0); // purge everything
        cleared.research = purged;
      }
      if (correctionMemory) {
        const all = correctionMemory.getAll(1000);
        for (const c of all) {
          await correctionMemory.deleteCorrection(c.id);
        }
        cleared.corrections = all.length;
      }

      res.json({ success: true, data: cleared, message: `Cleared ${cleared.research} research sessions and ${cleared.corrections} corrections` });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════

  registerSettingsRoutes() {
    this.app.get('/api/task-routing', this.wrap(async (req, res) => {
      if (!this.ace?.aiManager) return res.json({ success: false, error: 'Not initialized' });
      res.json({ success: true, data: this.ace.aiManager.getTaskRouting() });
    }));

    this.app.post('/api/task-routing', this.wrap(async (req, res) => {
      if (!this.ace?.aiManager) return res.json({ success: false, error: 'Not initialized' });
      await this.ace.aiManager.setTaskRouting(req.body);
      res.json({ success: true });
    }));

    this.app.get('/api/providers', this.wrap(async (req, res) => {
      if (!this.ace?.aiManager) return res.json({ success: false, error: 'AI Provider Manager not initialized' });
      res.json({ success: true, data: this.ace.aiManager.getProvidersStatus() });
    }));

    this.app.post('/api/providers/config', this.wrap(async (req, res) => {
      if (!this.ace?.aiManager) return res.json({ success: false, error: 'AI Provider Manager not initialized' });
      const { provider, ...updates } = req.body;
      if (!provider) return res.json({ success: false, error: 'Provider name required' });
      await this.ace.aiManager.updateProviderConfig(provider, updates);
      res.json({ success: true });
    }));

    this.app.post('/api/switch-provider', this.wrap(async (req, res) => {
      if (!this.ace?.aiManager) return res.json({ success: false, error: 'AI Provider Manager not initialized' });
      await this.ace.aiManager.switchProvider(req.body.provider);
      eventBus.emit(EVENTS.AI_PROVIDER_SWITCHED, { provider: req.body.provider });
      res.json({ success: true });
    }));

    this.app.post('/api/config', this.wrap(async (req, res) => {
      const configPath = path.join(this.baseDir, 'config/openace.config.json');
      const existing = JSON.parse(await fs.readFile(configPath, 'utf-8'));
      const updated = { ...existing, ...req.body };
      await fs.writeFile(configPath, JSON.stringify(updated, null, 2));
      res.json({ success: true });
    }));

    this.app.post('/api/permissions/autonomy', this.wrap(async (req, res) => {
      if (!this.ace?.permissionsManager) return res.json({ success: false, error: 'Permissions Manager not initialized' });
      await this.ace.permissionsManager.setAutonomyLevel(req.body.level);
      res.json({ success: true });
    }));

    this.app.post('/api/permissions/update', this.wrap(async (req, res) => {
      if (!this.ace?.permissionsManager) return res.json({ success: false, error: 'Permissions Manager not initialized' });
      await this.ace.permissionsManager.updatePermission(req.body.path, req.body.value);
      res.json({ success: true });
    }));

    this.app.post('/api/permissions/domains/add', this.wrap(async (req, res) => {
      if (!this.ace?.permissionsManager) return res.json({ success: false, error: 'Permissions Manager not initialized' });
      const domains = await this.ace.permissionsManager.addAllowedDomain(req.body.domain);
      res.json({ success: true, data: domains });
    }));

    this.app.post('/api/permissions/domains/remove', this.wrap(async (req, res) => {
      if (!this.ace?.permissionsManager) return res.json({ success: false, error: 'Permissions Manager not initialized' });
      const domains = await this.ace.permissionsManager.removeAllowedDomain(req.body.domain);
      res.json({ success: true, data: domains });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // DEPARTMENTS
  // ═══════════════════════════════════════════════════════

  registerDepartmentRoutes() {
    // Get agent status (replaces old department listing)
    this.app.get('/api/departments', this.wrap(async (req, res) => {
      const departments = this.ace?.brain?.getDepartments?.() || [];
      res.json({ success: true, data: departments });
    }));

    // Enable/disable toggle (no-op with UnifiedAgent — single agent always active)
    this.app.post('/api/departments/:id/toggle', this.wrap(async (req, res) => {
      res.json({ success: true });
    }));

    // Routing history (no longer tracked with UnifiedAgent)
    this.app.get('/api/departments/history', this.wrap(async (req, res) => {
      res.json({ success: true, data: [] });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // BUSINESS PROFILE
  // ═══════════════════════════════════════════════════════

  registerBusinessProfileRoutes() {
    // ── GET /api/businesses — list all businesses ──
    this.app.get('/api/businesses', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: true, data: { businesses: [], activeId: null } });
      res.json({
        success: true,
        data: {
          businesses: bm.getAllProfiles(),
          activeId: bm.activeId,
        },
      });
    }));

    // ── GET /api/businesses/active — active business profile ──
    this.app.get('/api/businesses/active', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: true, data: {} });
      res.json({ success: true, data: bm.getActive() || {} });
    }));

    // ── POST /api/businesses — create new business ──
    this.app.post('/api/businesses', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: false, error: 'BusinessManager not initialized' });
      const created = await bm.createBusiness(req.body);
      res.json({ success: true, data: created });
    }));

    // ── PUT /api/businesses/:id — update a business ──
    this.app.put('/api/businesses/:id', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: false, error: 'BusinessManager not initialized' });
      const updated = await bm.updateBusiness(req.params.id, req.body);
      // If this is the active business, hot-swap brain context
      if (this.ace?.brain && bm.activeId === req.params.id) {
        this.ace.brain.updateBusinessContext(bm.getContextSummary());
      }
      res.json({ success: true, data: updated });
    }));

    // ── DELETE /api/businesses/:id — delete a business ──
    this.app.delete('/api/businesses/:id', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: false, error: 'BusinessManager not initialized' });
      await bm.deleteBusiness(req.params.id);
      res.json({ success: true });
    }));

    // ── POST /api/businesses/:id/switch — switch active business ──
    this.app.post('/api/businesses/:id/switch', this.wrap(async (req, res) => {
      if (!this.ace) return res.json({ success: false, error: 'Ace not initialized' });
      const target = await this.ace.switchBusiness(req.params.id);
      res.json({ success: true, data: target });
    }));

    // ── LEGACY: /api/business-profile (keeps onboarding + existing code working) ──
    this.app.get('/api/business-profile', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: true, data: {} });
      res.json({ success: true, data: bm.getActive() || {} });
    }));

    this.app.post('/api/business-profile', this.wrap(async (req, res) => {
      const bm = this.ace?.businessProfile;
      if (!bm) return res.json({ success: false, error: 'BusinessManager not initialized' });

      const activeId = bm.activeId;
      if (!activeId) {
        // No active business yet — create one from the posted data (onboarding flow)
        const created = await bm.createBusiness(req.body);
        await bm.setActive(created.id);
        if (this.ace?.brain) {
          this.ace.brain.updateBusinessContext(bm.getContextSummary());
        }
        return res.json({ success: true, data: created });
      }

      // Update existing active business
      const updated = await bm.updateBusiness(activeId, req.body);
      if (this.ace?.brain) {
        this.ace.brain.updateBusinessContext(bm.getContextSummary());
      }
      res.json({ success: true, data: updated });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // DESKTOP AUTONOMY / CONSENT
  // ═══════════════════════════════════════════════════════

  registerDesktopAutonomyRoutes() {
    const autonomyPath = path.join(this.baseDir, 'data', 'permissions', 'desktop-autonomy.json');

    // GET /api/desktop-autonomy — get current consent status
    this.app.get('/api/desktop-autonomy', this.wrap(async (req, res) => {
      try {
        if (existsSync(autonomyPath)) {
          const raw = await fs.readFile(autonomyPath, 'utf-8');
          res.json({ success: true, data: JSON.parse(raw) });
        } else {
          // Return defaults if file doesn't exist yet
          const defaults = {
            desktopControlEnabled: false,
            consentGiven: false,
            consentDate: null,
            riskLevel: 'full',
            allowedActions: ['browser', 'apps', 'files', 'keyboard', 'mouse'],
            blockedApps: ['System Preferences', 'Disk Utility', 'Terminal'],
            requireConfirmation: true
          };
          res.json({ success: true, data: defaults });
        }
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    }));

    // POST /api/desktop-autonomy — update consent (requires explicit consent: true)
    this.app.post('/api/desktop-autonomy', this.wrap(async (req, res) => {
      try {
        const { consent, enabled, blockedApps, requireConfirmation } = req.body;

        // Read existing config
        let config = {
          desktopControlEnabled: false,
          consentGiven: false,
          consentDate: null,
          riskLevel: 'full',
          allowedActions: ['browser', 'apps', 'files', 'keyboard', 'mouse'],
          blockedApps: ['System Preferences', 'Disk Utility', 'Terminal'],
          requireConfirmation: true
        };

        if (existsSync(autonomyPath)) {
          const raw = await fs.readFile(autonomyPath, 'utf-8');
          config = { ...config, ...JSON.parse(raw) };
        }

        // Update consent — requires explicit consent: true in body
        if (consent === true) {
          config.consentGiven = true;
          config.desktopControlEnabled = true;
          config.consentDate = new Date().toISOString();
        } else if (consent === false || enabled === false) {
          config.desktopControlEnabled = false;
          // Note: we keep consentGiven true — user gave consent once, just disabled the feature
        }

        if (typeof enabled === 'boolean') {
          config.desktopControlEnabled = enabled;
        }

        if (Array.isArray(blockedApps)) {
          config.blockedApps = blockedApps;
        }

        if (typeof requireConfirmation === 'boolean') {
          config.requireConfirmation = requireConfirmation;
        }

        // Ensure directory exists
        const dirPath = path.dirname(autonomyPath);
        await fs.mkdir(dirPath, { recursive: true });

        // Save config
        await fs.writeFile(autonomyPath, JSON.stringify(config, null, 2));

        res.json({ success: true, data: config });
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    }));
  }

  // ═══════════════════════════════════════════════════════
  // DIRECT DESKTOP CONTROL — Bypasses all routing/departments
  // ═══════════════════════════════════════════════════════

  registerDesktopControlRoutes() {
    /**
     * Helper: get DesktopAgent from brain subsystems.
     * Returns null if not available.
     */
    const getDesktopAgent = () => {
      return this.ace?.brain?.unifiedAgent?.subsystems?.desktopAgent || null;
    };

    const getAIManager = () => {
      return this.ace?.aiManager || null;
    };

    // POST /api/desktop/click — Click on something by description
    // Body: { target: "the blue Submit button" }
    this.app.post('/api/desktop/click', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const agent = getDesktopAgent();
      if (!agent) return res.json({ success: false, error: 'DesktopAgent not available. Desktop control may not be initialized.' });

      const { target } = req.body;
      if (!target) return res.json({ success: false, error: 'Missing "target" — describe what to click (e.g., "the Google search button")' });

      const result = await agent.findAndClick(target);
      res.json({ success: result.success, data: result });
    }));

    // POST /api/desktop/move — Move mouse to x, y
    // Body: { x: 500, y: 300 }
    this.app.post('/api/desktop/move', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const agent = getDesktopAgent();
      if (!agent) return res.json({ success: false, error: 'DesktopAgent not available.' });

      const { x, y } = req.body;
      if (typeof x !== 'number' || typeof y !== 'number') {
        return res.json({ success: false, error: 'Missing x/y coordinates' });
      }

      await agent.moveMouse(x, y);
      await agent.click();
      res.json({ success: true, data: { x, y, action: 'moved and clicked' } });
    }));

    // POST /api/desktop/type — Type text
    // Body: { text: "hello world" }
    this.app.post('/api/desktop/type', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const agent = getDesktopAgent();
      if (!agent) return res.json({ success: false, error: 'DesktopAgent not available.' });

      const { text } = req.body;
      if (!text) return res.json({ success: false, error: 'Missing "text" to type' });

      await agent.type(text);
      res.json({ success: true, data: { typed: text } });
    }));

    // POST /api/desktop/screenshot — Take a screenshot and get AI description
    // Body: { prompt?: "describe what you see" }
    this.app.post('/api/desktop/screenshot', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const agent = getDesktopAgent();
      if (!agent) return res.json({ success: false, error: 'DesktopAgent not available.' });

      const image = await agent.seeScreen();
      const imageBase64 = await image.getBase64('image/png');

      // If a prompt is provided, send to vision AI
      let analysis = null;
      const aiManager = getAIManager();
      if (aiManager && req.body.prompt) {
        try {
          const visionResult = await aiManager.chatWithVision(req.body.prompt, imageBase64);
          analysis = visionResult.content || visionResult.text || '';
        } catch (e) {
          analysis = `Vision error: ${e.message}`;
        }
      }

      res.json({
        success: true,
        data: {
          screenshot: imageBase64.substring(0, 100) + '... (truncated)',
          screenSize: agent.screenSize,
          analysis
        }
      });
    }));

    // POST /api/desktop/scroll — Scroll up or down
    // Body: { direction: "down", amount: 5 }
    this.app.post('/api/desktop/scroll', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;

      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');

      const direction = req.body.direction || 'down';
      const amount = req.body.amount || 5;
      const scrollY = direction === 'up' ? amount : -amount;

      robot.scrollMouse(0, scrollY);
      res.json({ success: true, data: { direction, amount } });
    }));

    // POST /api/desktop/navigate — Open a URL in Chrome and bring to front
    // Body: { url: "https://google.com" }
    this.app.post('/api/desktop/navigate', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;

      const { url } = req.body;
      if (!url) return res.json({ success: false, error: 'Missing "url"' });

      // Chain of AppleScript commands to ensure Chrome is in front
      const { exec: execCmd } = await import('child_process');
      const run = (cmd) => new Promise((resolve) => {
        execCmd(cmd, (err, stdout) => resolve(stdout || ''));
      });

      await run(`osascript -e 'tell application "Google Chrome" to activate'`);
      await new Promise(r => setTimeout(r, 500));
      await run(`osascript -e 'tell application "Google Chrome" to open location "${url}"'`);
      await new Promise(r => setTimeout(r, 500));
      // Bring window to absolute front
      await run(`osascript -e 'tell application "System Events" to set frontmost of process "Google Chrome" to true'`);
      await new Promise(r => setTimeout(r, 2000));

      res.json({ success: true, data: { navigated: url } });
    }));

    // POST /api/desktop/key — Press a key combo
    // Body: { key: "enter" } or { key: "t", modifiers: ["command"] }
    this.app.post('/api/desktop/key', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;

      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const robot = require('robotjs');

      const { key, modifiers } = req.body;
      if (!key) return res.json({ success: false, error: 'Missing "key"' });

      if (modifiers && Array.isArray(modifiers)) {
        robot.keyTap(key, modifiers);
      } else {
        robot.keyTap(key);
      }
      res.json({ success: true, data: { key, modifiers } });
    }));

    // GET /api/desktop/status — Check if desktop control is available
    this.app.get('/api/desktop/status', (req, res) => {
      const agent = getDesktopAgent();
      const aiManager = getAIManager();
      res.json({
        success: true,
        data: {
          desktopAgentAvailable: !!agent,
          screenSize: agent?.screenSize || null,
          aiManagerAvailable: !!aiManager,
          geminiAvailable: !!aiManager?.providers?.gemini,
          activeProvider: aiManager?.activeProvider || null,
        }
      });
    });

  }

  // ═══════════════════════════════════════════════════════
  // DESKTOP TRAINING — Learn from user demonstrations
  // ═══════════════════════════════════════════════════════

  registerDesktopTrainRoutes() {
    const getDesktopTrainer = () => {
      return this.ace?.brain?.desktopTrainer || null;
    };

    // POST /api/desktop-train/start — Start recording a demonstration
    // Body: { name: "How to open voice memos" }
    this.app.post('/api/desktop-train/start', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const trainer = getDesktopTrainer();
      if (!trainer) return res.json({ success: false, error: 'DesktopTrainer not available. Desktop control may not be enabled.' });

      const { name } = req.body;
      if (!name) return res.json({ success: false, error: 'Missing "name" — describe what you want to teach Ace' });

      const result = await trainer.startRecording(name);
      res.json({ success: result.success, data: result });
    }));

    // POST /api/desktop-train/stop — Stop recording and analyze
    this.app.post('/api/desktop-train/stop', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      const trainer = getDesktopTrainer();
      if (!trainer) return res.json({ success: false, error: 'DesktopTrainer not available.' });

      const result = await trainer.stopRecording();
      res.json({ success: result.success, data: result });
    }));

    // GET /api/desktop-train/status — Check recording status
    this.app.get('/api/desktop-train/status', (req, res) => {
      const trainer = getDesktopTrainer();
      if (!trainer) return res.json({ success: true, data: { recording: false, available: false } });

      const status = trainer.getStatus();
      res.json({ success: true, data: { ...status, available: true } });
    });

  }

  // ═══════════════════════════════════════════════════════
  // ONBOARDING STATUS & SETUP
  // ═══════════════════════════════════════════════════════

  registerOnboardingRoutes() {
    const profilePath = path.join(this.baseDir, 'data', 'business', 'profile.json');
    const profilesPath = path.join(this.baseDir, 'data', 'business', 'profiles.json');
    const configPath = path.join(this.baseDir, 'config', 'openace.config.json');

    // GET /api/usage — how many free messages remain
    this.app.get('/api/usage', this.wrap(async (req, res) => {
      const info = this._usageTracker.getUsageInfo(req);
      res.json({ success: true, data: info });
    }));

    // GET /api/onboarding-status — check if first-run setup is needed
    this.app.get('/api/onboarding-status', this.wrap(async (req, res) => {
      try {
        // Cloud mode with env var API key — skip onboarding, AI is pre-configured
        if (process.env.OPENACE_CLOUD === 'true' && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.KIMI_API_KEY)) {
          return res.json({ success: true, data: { needsOnboarding: false } });
        }

        // Method 1: Check in-memory business profiles (most reliable)
        if (this.ace?.businessProfile?.profiles?.length > 0) {
          const name = this.ace.businessProfile.profiles[0]?.name?.trim();
          if (name) {
            return res.json({ success: true, data: { needsOnboarding: false } });
          }
        }

        // Method 2: Read directly from disk as fallback
        for (const p of [profilesPath, profilePath]) {
          try {
            await fs.access(p);
            const raw = await fs.readFile(p, 'utf-8');
            const data = JSON.parse(raw);
            const items = Array.isArray(data) ? data : [data];
            if (items.length > 0 && items[0]?.name?.trim()) {
              return res.json({ success: true, data: { needsOnboarding: false } });
            }
          } catch { /* file doesn't exist or can't be read, try next */ }
        }

        res.json({ success: true, data: { needsOnboarding: true } });
      } catch (err) {
        console.error('Onboarding status check error:', err.message);
        res.json({ success: true, data: { needsOnboarding: true } });
      }
    }));

    // GET /api/setup/status — system health check for onboarding
    this.app.get('/api/setup/status', this.wrap(async (req, res) => {
      try {
        const nodeVersion = process.version;
        const nodeOk = parseInt(nodeVersion.slice(1)) >= 18;
        const depsInstalled = existsSync(path.join(this.baseDir, 'node_modules', 'express'));
        
        // Check AI provider config
        let aiConfigured = false;
        let activeProvider = 'none';
        let providers = {};
        if (existsSync(configPath)) {
          const raw = await fs.readFile(configPath, 'utf-8');
          const config = JSON.parse(raw);
          activeProvider = config.ai_providers?.active_provider || 'none';
          const providerConfigs = config.ai_providers?.providers || {};
          for (const [name, cfg] of Object.entries(providerConfigs)) {
            providers[name] = {
              enabled: cfg.enabled || false,
              model: cfg.model || '',
              hasKey: name === 'ollama' ? true : !!(cfg.api_key && cfg.api_key.length > 5),
            };
          }
          // AI is configured if active provider is enabled and has a key
          const active = providerConfigs[activeProvider];
          aiConfigured = active?.enabled && (activeProvider === 'ollama' || (active?.api_key && active.api_key.length > 5));
        }

        // Check if Ollama is reachable
        let ollamaReachable = false;
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
          clearTimeout(timeout);
          ollamaReachable = ollamaRes.ok;
        } catch { ollamaReachable = false; }

        res.json({
          success: true,
          data: {
            nodeVersion,
            nodeOk,
            depsInstalled,
            aiConfigured,
            activeProvider,
            providers,
            ollamaReachable,
            serverRunning: true, // Obviously true if this responds
          }
        });
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    }));

    // POST /api/setup/ai-provider — configure AI provider during onboarding
    this.app.post('/api/setup/ai-provider', this.wrap(async (req, res) => {
      try {
        const { provider, apiKey, model } = req.body;
        if (!provider) return res.json({ success: false, error: 'Provider is required' });

        const raw = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(raw);

        // Update the selected provider
        if (config.ai_providers.providers[provider]) {
          config.ai_providers.providers[provider].enabled = true;
          if (apiKey !== undefined) config.ai_providers.providers[provider].api_key = apiKey;
          if (model) config.ai_providers.providers[provider].model = model;
        }

        // Set as active provider
        config.ai_providers.active_provider = provider;

        await fs.writeFile(configPath, JSON.stringify(config, null, 4));

        // Re-initialize the AI provider in memory so it takes effect immediately
        if (this.ace?.aiManager) {
          await this.ace.aiManager.initialize();
        }

        res.json({ success: true, data: { provider, configured: true } });
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    }));

    // POST /api/setup/test-provider — test if the AI provider works
    this.app.post('/api/setup/test-provider', this.wrap(async (req, res) => {
      try {
        const { provider, apiKey } = req.body;
        
        if (provider === 'ollama') {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
          const ollamaRes = await fetch('http://localhost:11434/api/tags', { signal: controller.signal });
          clearTimeout(timeout);
          if (ollamaRes.ok) {
            const data = await ollamaRes.json();
            const models = (data.models || []).map(m => m.name);
            return res.json({ success: true, data: { connected: true, models } });
          }
          return res.json({ success: false, error: 'Ollama not reachable at localhost:11434' });
        }
        
        if (provider === 'openai' && apiKey) {
          const testRes = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${apiKey}` }
          });
          return res.json({ success: testRes.ok, data: { connected: testRes.ok } });
        }

        if (provider === 'claude' && apiKey) {
          // Simple auth check
          const testRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': apiKey, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-3-5-sonnet-20241022', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
          });
          return res.json({ success: testRes.ok, data: { connected: testRes.ok } });
        }

        if (provider === 'gemini' && apiKey) {
          const testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
          return res.json({ success: testRes.ok, data: { connected: testRes.ok } });
        }

        res.json({ success: false, error: 'Cannot test without API key' });
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    }));

    // POST /api/setup/telegram — configure Telegram bot during onboarding
    this.app.post('/api/setup/telegram', this.wrap(async (req, res) => {
      try {
        const { bot_token, enabled } = req.body;
        if (!bot_token) return res.json({ success: false, error: 'Bot token is required' });

        const raw = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(raw);

        config.telegram = config.telegram || {};
        config.telegram.bot_token = bot_token;
        config.telegram.enabled = enabled !== false;

        await fs.writeFile(configPath, JSON.stringify(config, null, 4));

        res.json({ success: true, data: { configured: true } });
      } catch (err) {
        res.json({ success: false, error: err.message });
      }
    }));

    // POST /api/setup/test-telegram — validate Telegram bot token
    this.app.post('/api/setup/test-telegram', this.wrap(async (req, res) => {
      try {
        const { bot_token } = req.body;
        if (!bot_token) return res.json({ success: false, error: 'Bot token is required' });

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const tgRes = await fetch(`https://api.telegram.org/bot${bot_token}/getMe`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (tgRes.ok) {
          const data = await tgRes.json();
          if (data.ok) {
            return res.json({ success: true, data: { botName: data.result.first_name, username: data.result.username } });
          }
        }
        res.json({ success: false, error: 'Invalid bot token' });
      } catch (err) {
        res.json({ success: false, error: err.name === 'AbortError' ? 'Connection timed out' : err.message });
      }
    }));
  }

  // ═══════════════════════════════════════════════════════
  // RESEARCH
  // ═══════════════════════════════════════════════════════

  registerResearchRoutes() {
    this.app.post('/api/research/search', this.wrap(async (req, res) => {
      if (!this.ace?.researchAgent) return res.json({ success: false, error: 'Research Agent not initialized' });
      eventBus.emit(EVENTS.RESEARCH_STARTED, { query: req.body.query });
      const results = await this.ace.researchAgent.search(req.body.query, req.body);
      eventBus.emit(EVENTS.RESEARCH_COMPLETED, { query: req.body.query, resultCount: results?.length || 0 });
      res.json({ success: true, data: results });
    }));

    this.app.post('/api/research/topic', this.wrap(async (req, res) => {
      if (!this.ace?.researchAgent) return res.json({ success: false, error: 'Research Agent not initialized' });
      const results = await this.ace.researchAgent.researchTopic(req.body.topic, req.body);
      res.json({ success: true, data: results });
    }));

    this.app.post('/api/research/real-estate', this.wrap(async (req, res) => {
      if (!this.ace?.researchAgent) return res.json({ success: false, error: 'Research Agent not initialized' });
      const results = await this.ace.researchAgent.searchRealEstate?.(req.body.location, req.body) || { results: [] };
      res.json({ success: true, data: results });
    }));

    this.app.post('/api/research/leads', this.wrap(async (req, res) => {
      if (!this.ace?.researchAgent) return res.json({ success: false, error: 'Research Agent not initialized' });
      const results = await this.ace.researchAgent.searchLeads?.(req.body.industry, req.body.location, req.body) || { results: [] };
      res.json({ success: true, data: results });
    }));

    this.app.get('/api/research/saved', this.wrap(async (req, res) => {
      const researchDir = path.join(this.baseDir, 'data/research');
      const files = await fs.readdir(researchDir).catch(() => []);
      res.json({ success: true, data: files.filter(f => f.endsWith('.json')) });
    }));

    this.app.get('/api/research/load', this.wrap(async (req, res) => {
      const filePath = path.join(this.baseDir, 'data/research', req.query.filename);
      const content = await fs.readFile(filePath, 'utf-8');
      res.json({ success: true, data: JSON.parse(content) });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // EMAIL
  // ═══════════════════════════════════════════════════════

  registerEmailRoutes() {
    this.app.post('/api/send-email', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      if (!this.ace.google?.isConnected()) return res.json({ success: false, error: 'Google/Gmail not connected' });
      const { to, subject, body, isHtml } = req.body;
      if (!to) return res.json({ success: false, error: 'Missing required field: to' });
      const result = await this.ace.google.sendEmail({ to, subject: subject || 'Message from Ace', body: body || '', isHtml: isHtml !== false });
      eventBus.emit(EVENTS.EMAIL_SENT, { to, subject });
      if (this.activityLogger) this.activityLogger.logMessage('desktop', 'assistant', `📧 Email sent to ${to}: "${subject || 'No subject'}"`);
      res.json({ success: true, data: result });
    }));

    this.app.get('/api/google-status', this.wrap(async (req, res) => {
      if (!this.ace?.google) return res.json({ success: true, data: { connected: false, message: 'Google integration not initialized' } });
      const status = await this.ace.google.getStatus();
      res.json({ success: true, data: status });
    }));

    // Calendar — list upcoming events
    this.app.get('/api/google/calendar', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      if (!this.ace.google?.isConnected()) return res.json({ success: false, error: 'Google not connected' });
      const maxResults = parseInt(req.query.maxResults) || 10;
      const timeMin = req.query.timeMin || new Date().toISOString();
      const events = await this.ace.google.listEvents({ maxResults, timeMin });
      res.json({ success: true, data: events });
    }));

    // Calendar — create event / schedule meeting
    this.app.post('/api/google/calendar', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      if (!this.ace.google?.isConnected()) return res.json({ success: false, error: 'Google not connected' });
      const { title, startTime, endTime, description, attendees, durationMinutes, addMeetLink } = req.body;
      if (!title || !startTime) return res.json({ success: false, error: 'title and startTime are required' });
      let result;
      if (durationMinutes) {
        result = await this.ace.google.scheduleMeeting(title, startTime, durationMinutes, attendees || []);
      } else {
        result = await this.ace.google.createEvent({ title, startTime, endTime, description, attendees, addMeetLink: addMeetLink !== false });
      }
      res.json({ success: true, data: result });
    }));

    // Gmail — list recent / unread emails
    this.app.get('/api/google/gmail', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      if (!this.ace.google?.isConnected()) return res.json({ success: false, error: 'Google not connected' });
      const maxResults = parseInt(req.query.maxResults) || 10;
      const query = req.query.query || 'is:unread';
      const emails = await this.ace.google.listEmails({ maxResults, query });
      res.json({ success: true, data: emails });
    }));

    this.app.post('/api/email/draft', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      if (!this.ace.aiManager) return res.json({ success: false, error: 'AI Provider Manager not initialized' });
      const { lead } = req.body;
      if (!lead) return res.json({ success: false, error: 'Missing required field: lead' });

      const leadContext = [
        lead.company ? `Business Name: ${lead.company}` : null,
        lead.name && lead.name !== lead.company ? `Contact Name: ${lead.name}` : null,
        lead.industry ? `Industry: ${lead.industry}` : null,
        lead.location ? `Location: ${lead.location}` : null,
        lead.rating ? `Google Rating: ${lead.rating}/5${lead.reviewCount ? ` (${lead.reviewCount} reviews)` : ''}` : null,
        lead.businessType ? `Business Type: ${lead.businessType}` : null,
        lead.website ? `Current Website: ${lead.website}` : null,
        lead.notes ? `Notes: ${lead.notes}` : null,
        lead.source ? `Lead Source: ${lead.source}` : null,
        lead.googleMapsUrl ? `Google Maps: ${lead.googleMapsUrl}` : null,
      ].filter(Boolean).join('\n');

      const randomSeed = Math.random().toString(36).substring(2, 8);
      const messages = [
        { role: 'system', content: `You are Eric, a professional outreach specialist at LikeMindedPro, a digital services and web hosting company. You write unique, personalized cold outreach emails to local businesses. Each email you write should be different in structure, tone variation, and opening approach. Variation seed: ${randomSeed}` },
        { role: 'user', content: `Write a cold outreach email to this business lead:\n\n${leadContext}\n\nRequirements:\n- You are Eric from LikeMindedPro (a digital services and hosting company)\n- Offer our web hosting program starting at just $1\n- Include signup link: https://likemindedpro.com/hosting\n- Reference their business name, industry, and location naturally\n- Be concise: 3-4 short paragraphs\n- Friendly and professional tone, not salesy or pushy\n- Make it unique — vary sentence structure, opening line, and approach each time\n- Do NOT use placeholder brackets like [Name] — use the actual lead info\n\nFORMAT: The very first line must be ONLY the email subject line (no "Subject:" prefix). Then leave one blank line, then write the email body.` }
      ];

      const result = await this.ace.aiManager.chat(messages, { temperature: 0.9 });
      const content = (result.content || result.text || '').trim();
      const lines = content.split('\n');
      let subject = lines[0].replace(/^Subject:\s*/i, '').replace(/^["']|["']$/g, '').trim();
      const emailBody = lines.slice(1).join('\n').trim();

      eventBus.emit(EVENTS.EMAIL_DRAFT_CREATED, { lead: lead.company || lead.name });
      res.json({ success: true, data: { subject, body: emailBody } });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SOCIAL MEDIA
  // ═══════════════════════════════════════════════════════

  async getSocialMediaSystem() {
    if (!this.socialMediaSystem) {
      try {
        const { createSocialMediaSystem } = await import('../social/index.js');
        this.socialMediaSystem = await createSocialMediaSystem({
          dataDir: 'data/social',
          googleIntegration: this.ace?.google,
          telegramBot: null
        });
      } catch (error) {
        console.error('Failed to initialize Social Media System:', error.message);
      }
    }
    return this.socialMediaSystem;
  }

  registerSocialRoutes() {
    this.app.get('/api/social/status', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: true, data: { scheduler: { isRunning: false }, sessions: {} } });
      const status = system.scheduler?.getStatus() || { isRunning: false, todaysCounts: {} };
      const config = await fs.readFile(path.join(this.baseDir, 'data/social/config.json'), 'utf-8').catch(() => '{}');
      const sessions = JSON.parse(config).sessions || {};
      res.json({ success: true, data: { scheduler: status, sessions } });
    }));

    this.app.get('/api/social/calendar', this.wrap(async (req, res) => {
      const days = parseInt(req.query.days) || 7;
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: true, data: { posts: [], totalScheduled: 0 } });
      const calendar = await system.getCalendar(days);
      res.json({ success: true, data: calendar });
    }));

    this.app.get('/api/social/library/stats', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) {
        const libraryPath = path.join(this.baseDir, 'data/content/library.json');
        const data = await fs.readFile(libraryPath, 'utf-8').catch(() => '{"assets":[]}');
        const library = JSON.parse(data);
        return res.json({ success: true, data: { totalAssets: library.assets?.length || 0, unusedAssets: library.assets?.filter(a => (a.metadata?.usageCount || 0) === 0).length || 0 } });
      }
      const stats = await system.getLibraryStats();
      res.json({ success: true, data: stats });
    }));

    this.app.get('/api/social/library/assets', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      const filter = { category: req.query.category !== 'all' ? req.query.category : undefined, city: req.query.city, limit: parseInt(req.query.limit) || 50 };
      if (!system) {
        const libraryPath = path.join(this.baseDir, 'data/content/library.json');
        const data = await fs.readFile(libraryPath, 'utf-8').catch(() => '{"assets":[]}');
        let assets = JSON.parse(data).assets || [];
        if (filter.category) assets = assets.filter(a => a.metadata?.category === filter.category);
        return res.json({ success: true, data: assets.slice(0, filter.limit) });
      }
      const assets = await system.contentLibrary?.searchAssets(filter) || [];
      res.json({ success: true, data: assets });
    }));

    this.app.post('/api/social/library/upload', this.wrap(async (req, res) => {
      const filename = decodeURIComponent(req.headers['x-filename'] || `upload_${Date.now()}.jpg`);
      const ext = path.extname(filename).toLowerCase() || '.jpg';
      const isVideo = ['.mp4', '.mov', '.avi', '.webm'].includes(ext);
      const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      if (!isVideo && !isImage) return res.json({ success: false, error: `Unsupported file type: ${ext}` });

      const mediaDir = path.join(this.baseDir, 'data/content/media');
      const subDir = isVideo ? 'videos' : 'images';
      await fs.mkdir(path.join(mediaDir, subDir), { recursive: true });

      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
      const buffer = Buffer.concat(chunks);

      const assetId = `asset_${crypto.randomBytes(8).toString('hex')}`;
      const destFilename = `${assetId}_${filename}`;
      const destPath = path.join(mediaDir, subDir, destFilename);
      await fs.writeFile(destPath, buffer);

      const libraryPath = path.join(this.baseDir, 'data/content/library.json');
      await fs.mkdir(path.dirname(libraryPath), { recursive: true });
      let library = { assets: [], campaigns: [] };
      try { library = JSON.parse(await fs.readFile(libraryPath, 'utf-8')); } catch {}

      const asset = {
        id: assetId, filename, path: destPath, type: isVideo ? 'video' : 'image',
        format: ext.replace('.', ''), size: buffer.length, uploadedAt: new Date().toISOString(),
        metadata: { city: null, category: 'general', campaign: null, tags: [], description: filename.replace(ext, '').replace(/[-_]/g, ' '), usageCount: 0, lastUsed: null }
      };
      library.assets.push(asset);
      library.lastUpdated = new Date().toISOString();
      await fs.writeFile(libraryPath, JSON.stringify(library, null, 2));

      res.json({ success: true, data: asset });
    }));

    this.app.post('/api/social/strategy', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: false, error: 'Social Media System not initialized' });
      const strategy = await system.generateStrategy(req.body.city, 1);
      await system.contentStrategy?.generateContentCalendar(30);
      res.json({ success: true, data: strategy });
    }));

    this.app.post('/api/social/post', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: false, error: 'Social Media System not initialized' });
      const result = await system.postNow({ text: req.body.content }, req.body.platforms);
      res.json({ success: true, data: result });
    }));

    this.app.post('/api/social/login/:platform', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: false, error: 'Social Media System not initialized' });
      const result = await system.initiateLogin(req.params.platform);
      res.json({ success: true, data: result });
    }));

    this.app.get('/api/social/connections', this.wrap(async (req, res) => {
      const configPath = path.join(this.baseDir, 'data/social/config.json');
      const data = await fs.readFile(configPath, 'utf-8').catch(() => '{}');
      const config = JSON.parse(data);
      const connections = {
        twitter: { connected: config.sessions?.twitter?.loggedIn || false },
        linkedin: { connected: config.sessions?.linkedin?.loggedIn || false },
        instagram: { connected: config.sessions?.instagram?.loggedIn || false },
        facebook: { connected: config.sessions?.facebook?.loggedIn || false }
      };
      res.json({ success: true, data: connections });
    }));

    this.app.post('/api/social/verify/:platform', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: false, error: 'Social Media System not initialized' });
      const result = await system.checkLoginStatus(req.params.platform);
      res.json({ success: true, data: result });
    }));

    this.app.post('/api/social/browser', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: false, error: 'Social Media System not initialized' });
      await system.socialMediaAgent?.launchBrowser({ headless: false });
      res.json({ success: true, data: { message: 'Social browser opened' } });
    }));

    this.app.delete('/api/social/calendar/:postId', this.wrap(async (req, res) => {
      const system = await this.getSocialMediaSystem();
      if (!system) return res.json({ success: false, error: 'Social Media System not initialized' });
      const result = await system.contentStrategy?.cancelPost(req.params.postId);
      res.json({ success: true, data: result });
    }));

    this.app.post('/api/social/scrape-meetups', this.wrap(async (req, res) => {
      const { LikeMindedScraper } = await import('../social/LikeMindedScraper.js');
      const scraper = new LikeMindedScraper({ dataDir: 'data/social' });
      await scraper.initialize();
      const events = await scraper.scrapeAllCities();
      const schedule = await scraper.generateContentSchedule();
      res.json({ success: true, data: { events, schedule, message: `Found ${events.length} events, generated ${schedule.length} scheduled posts` } });
    }));

    this.app.get('/api/social/events', this.wrap(async (req, res) => {
      const eventsPath = path.join(this.baseDir, 'data/social/events.json');
      const data = await fs.readFile(eventsPath, 'utf-8').catch(() => '[]');
      res.json({ success: true, data: JSON.parse(data) });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════

  registerProjectRoutes() {
    // GET /api/projects — List all projects with metadata
    this.app.get('/api/projects', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      const projects = await this.ace.projectManager.listProjects();
      res.json({ success: true, data: projects });
    }));

    // GET /api/projects/:name/files — Get file tree for a project
    this.app.get('/api/projects/:name/files', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const tree = await this.ace.projectManager.getFileTree(req.params.name);
        res.json({ success: true, data: tree });
      } catch (err) {
        const status = err.message.includes('not a directory') || err.message.includes('ENOENT') ? 404 : 400;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // GET /api/projects/:name/file — Read a specific file's content
    this.app.get('/api/projects/:name/file', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      const filePath = req.query.path;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required query parameter: path' });
      }
      try {
        const result = await this.ace.projectManager.readFile(req.params.name, filePath);
        res.json({ success: true, data: result });
      } catch (err) {
        const status = err.message.includes('Security') ? 400 : err.message.includes('ENOENT') ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // GET /api/projects/:name/lastModified — Get last modified timestamp for any file in project
    this.app.get('/api/projects/:name/lastModified', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const lastModified = await this.ace.projectManager.getLastModified(req.params.name);
        res.json({ lastModified });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }));

    // GET /api/projects/:name/history — Get version history for a file
    this.app.get('/api/projects/:name/history', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const history = await this.ace.projectManager.getFileHistory(req.params.name, req.query.path);
        res.json({ history });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }));

    // POST /api/projects/:name/restore — Restore a file to a previous version
    this.app.post('/api/projects/:name/restore', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const result = await this.ace.projectManager.restoreFileVersion(
          req.params.name, req.body.path, req.body.timestamp
        );
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }));

    // PUT /api/projects/:name/file — Update/write a file
    this.app.put('/api/projects/:name/file', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      const { path: filePath, content } = req.body;
      if (!filePath) {
        return res.status(400).json({ success: false, error: 'Missing required field: path' });
      }
      if (content === undefined || content === null) {
        return res.status(400).json({ success: false, error: 'Missing required field: content' });
      }
      try {
        const result = await this.ace.projectManager.writeFile(req.params.name, filePath, content);
        res.json({ success: true, message: `File "${filePath}" written successfully`, data: result });
      } catch (err) {
        const status = err.message.includes('Security') ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // POST /api/projects — Create a new project
    this.app.post('/api/projects', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      const { name, type, description } = req.body;
      if (!name) {
        return res.status(400).json({ success: false, error: 'Missing required field: name' });
      }
      try {
        const project = await this.ace.projectManager.createProject(name, type, description);
        res.json({ success: true, data: project });
      } catch (err) {
        const status = err.message.includes('Invalid project name') ? 400 : err.message.includes('already exists') ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // GET /api/projects/:name/download — Download project as ZIP
    this.app.get('/api/projects/:name/download', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      const name = req.params.name;
      try {
        const buffer = await this.ace.projectManager.zipProject(name);
        res.set('Content-Type', 'application/zip');
        res.set('Content-Disposition', `attachment; filename="${name}.zip"`);
        res.send(buffer);
      } catch (err) {
        const status = err.message.includes('not found') || err.message.includes('ENOENT') ? 404 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // POST /api/projects/:name/open-editor — Open project in VS Code
    this.app.post('/api/projects/:name/open-editor', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      const name = req.params.name;
      const projectPath = path.resolve(this.ace.projectManager.projectsDir, name);

      if (!existsSync(projectPath)) {
        return res.status(404).json({ success: false, error: `Project "${name}" not found` });
      }

      exec(`open -a "Visual Studio Code" "${projectPath}"`, (error) => {
        if (error) {
          console.error(`[Gateway] Failed to open VS Code for "${name}":`, error.message);
          return res.status(500).json({ success: false, error: `Failed to open editor: ${error.message}` });
        }
        res.json({ success: true });
      });
    }));

    // DELETE /api/projects/:name — Delete a project
    this.app.delete('/api/projects/:name', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        await this.ace.projectManager.deleteProject(req.params.name);
        res.json({ success: true, message: `Project "${req.params.name}" deleted successfully` });
      } catch (err) {
        const status = err.message.includes('ENOENT') || err.message.includes('not found') ? 404 : err.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // POST /api/projects/import/zip — Import project from uploaded ZIP
    this.app.post('/api/projects/import/zip', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const name = req.query.name;
        if (!name) {
          return res.status(400).json({ success: false, error: 'Missing "name" query parameter' });
        }
        // req.body is a Buffer when express.raw() middleware is active
        if (!req.body || !Buffer.isBuffer(req.body) || req.body.length === 0) {
          return res.status(400).json({ success: false, error: 'No ZIP data received. Send raw ZIP bytes with Content-Type: application/zip' });
        }
        const project = await this.ace.projectManager.importFromZip(req.body, name);
        res.json({ success: true, project });
      } catch (err) {
        const status = err.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // POST /api/projects/import/folder — Import project from local folder
    this.app.post('/api/projects/import/folder', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const { path: folderPath, name } = req.body;
        if (!folderPath || !name) {
          return res.status(400).json({ success: false, error: 'Missing "path" and/or "name" in request body' });
        }
        const project = await this.ace.projectManager.importFromFolder(folderPath, name);
        res.json({ success: true, project });
      } catch (err) {
        const status = err.message.includes('not found') ? 404 : err.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));

    // POST /api/projects/link-folder — Link an external folder as a project (symlink, no copy)
    this.app.post('/api/projects/link-folder', this.wrap(async (req, res) => {
      if (!this.ace?.projectManager) {
        return res.status(500).json({ success: false, error: 'ProjectManager not initialized' });
      }
      try {
        const { path: folderPath, name } = req.body;
        if (!folderPath || !name) {
          return res.status(400).json({ success: false, error: 'Missing "path" and/or "name" in request body' });
        }
        const project = await this.ace.projectManager.linkFolder(folderPath, name);
        res.json({ success: true, project });
      } catch (err) {
        const status = err.message.includes('not found') ? 404 : err.message.includes('Invalid') ? 400 : 500;
        res.status(status).json({ success: false, error: err.message });
      }
    }));
  }

  // ═══════════════════════════════════════════════════════
  // DEPLOY PIPELINE
  // ═══════════════════════════════════════════════════════

  registerDeployRoutes() {
    // GET /api/deploy/targets — List available deploy targets
    this.app.get('/api/deploy/targets', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      try {
        const adapters = await this.ace.deployPipeline.getAdapters();
        res.json({ success: true, targets: adapters });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    }));

    // POST /api/projects/:name/deploy — Deploy a project
    this.app.post('/api/projects/:name/deploy', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      try {
        const { name } = req.params;
        const { target, options = {} } = req.body;

        if (!target) {
          return res.status(400).json({ success: false, error: 'Missing "target" in request body' });
        }

        const result = await this.ace.deployPipeline.deploy(name, target, options);
        res.json(result);
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    }));

    // GET /api/projects/:name/deploys — Get deploy history for a project
    this.app.get('/api/projects/:name/deploys', this.wrap(async (req, res) => {
      if (!this.requireAce(res)) return;
      try {
        const { name } = req.params;
        const history = this.ace.deployPipeline.getDeployHistory(name);
        res.json({ success: true, deploys: history });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    }));
  }

  // ═══════════════════════════════════════════════════════
  // CONTACTS
  // ═══════════════════════════════════════════════════════

  registerContactRoutes() {
    const getContactManager = (res) => {
      const cm = this.ace?.contactManager;
      if (!cm) {
        res.status(500).json({ success: false, error: 'ContactManager not initialized' });
        return null;
      }
      return cm;
    };

    // GET /api/contacts — List contacts with optional search/tag filter
    this.app.get('/api/contacts', this.wrap(async (req, res) => {
      const cm = getContactManager(res);
      if (!cm) return;
      const { tag, search, limit, offset } = req.query;
      const result = cm.listContacts({
        tag, search,
        limit: limit ? parseInt(limit) : 100,
        offset: offset ? parseInt(offset) : 0,
      });
      res.json({ success: true, ...result });
    }));

    // GET /api/contacts/follow-ups — Contacts needing follow-up
    this.app.get('/api/contacts/follow-ups', this.wrap(async (req, res) => {
      const cm = getContactManager(res);
      if (!cm) return;
      const days = parseInt(req.query.days) || 7;
      const contacts = cm.getContactsNeedingFollowUp(days);
      res.json({ success: true, contacts, total: contacts.length });
    }));

    // POST /api/contacts — Add a contact
    this.app.post('/api/contacts', this.wrap(async (req, res) => {
      const cm = getContactManager(res);
      if (!cm) return;
      try {
        const contact = cm.addContact(req.body);
        res.json({ success: true, contact });
      } catch (err) {
        res.status(400).json({ success: false, error: err.message });
      }
    }));

    // PUT /api/contacts/:id — Update a contact
    this.app.put('/api/contacts/:id', this.wrap(async (req, res) => {
      const cm = getContactManager(res);
      if (!cm) return;
      try {
        const contact = cm.updateContact(req.params.id, req.body);
        res.json({ success: true, contact });
      } catch (err) {
        res.status(404).json({ success: false, error: err.message });
      }
    }));

    // DELETE /api/contacts/:id — Delete a contact
    this.app.delete('/api/contacts/:id', this.wrap(async (req, res) => {
      const cm = getContactManager(res);
      if (!cm) return;
      try {
        cm.deleteContact(req.params.id);
        res.json({ success: true, message: 'Contact deleted' });
      } catch (err) {
        res.status(404).json({ success: false, error: err.message });
      }
    }));

    // POST /api/contacts/import — Bulk import contacts
    this.app.post('/api/contacts/import', this.wrap(async (req, res) => {
      const cm = getContactManager(res);
      if (!cm) return;
      const { contacts } = req.body;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ success: false, error: 'Expected { contacts: [...] }' });
      }
      const result = cm.importContacts(contacts);
      res.json({ success: true, ...result });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // EVENT BUS — Real-time SSE
  // ═══════════════════════════════════════════════════════

  registerEventBusRoutes() {
    // SSE stream for real-time dashboard updates
    this.app.get('/api/events/stream', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

      this.sseClients.add(res);

      const eventsToForward = [
        'progress:update', 'sop:started', 'sop:step:started', 'sop:step:completed', 'sop:step:failed',
        'sop:completed', 'sop:failed', 'task:added', 'task:moved', 'task:completed',
        'lead:added', 'lead:moved', 'lead:updated', 'action:detected', 'action:completed', 'action:failed',
        'browser:launched', 'browser:navigated', 'browser:screenshot', 'browser:closed',
        'chat:message:received', 'chat:response:sent', 'brain:thinking', 'brain:thought:complete',
        'scheduler:routine:due', 'scheduler:routine:completed', 'scheduler:routine:failed',
        'research:started', 'research:completed', 'email:sent', 'email:draft:created',
        'ai:provider:switched', 'system:error', 'system:initialized',
        'approval:queued', 'approval:approved', 'approval:rejected', 'approval:trust:learned',
        'system:error:diagnosed', 'system:health:degraded', 'system:health:checked',
        'system:error:uncaught', 'system:error:unhandled',
        'skill:chain:started', 'skill:chain:completed', 'skill:completed', 'skill:failed',
        'proactive:insight', 'scheduler:routine:due', 'scheduler:routine:completed',
        'routine:completed', 'pipeline:action',
        'ai:usage:warning',
        'console:log',
        'desktop:train:step', 'desktop:train:started', 'desktop:train:analyzing', 'desktop:train:complete', 'desktop:train:frame'
      ];

      const handlers = {};
      for (const evt of eventsToForward) {
        handlers[evt] = (data) => {
          try {
            res.write(`data: ${JSON.stringify({ type: evt, data, timestamp: new Date().toISOString() })}\n\n`);
          } catch {}
        };
        eventBus.on(evt, handlers[evt]);
      }

      const keepAlive = setInterval(() => {
        try { res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`); } catch { clearInterval(keepAlive); }
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAlive);
        this.sseClients.delete(res);
        for (const [evt, handler] of Object.entries(handlers)) {
          eventBus.removeListener(evt, handler);
        }
      });
    });

    this.app.get('/api/events/status', (req, res) => {
      res.json({ success: true, data: { ...eventBus.getStatus(), sseClients: this.sseClients.size } });
    });

    this.app.get('/api/events/recent', (req, res) => {
      const count = parseInt(req.query.count) || 20;
      const filter = req.query.filter || null;
      res.json({ success: true, data: eventBus.getRecentEvents(count, filter) });
    });

    // Console logs endpoint
    this.app.get('/api/logs', (req, res) => {
      const count = parseInt(req.query.count) || 200;
      const level = req.query.level || null;
      const search = req.query.search || null;
      const logs = logCapture.getRecent(count, level, search);
      const stats = logCapture.getStats();
      res.json({ success: true, data: { logs, stats } });
    });

    this.app.delete('/api/logs', (req, res) => {
      logCapture.clear();
      res.json({ success: true, message: 'Logs cleared' });
    });
  }

  // ═══════════════════════════════════════════════════════
  // APPROVALS — Human-in-the-loop action approval
  // ═══════════════════════════════════════════════════════

  registerApprovalRoutes() {
    // Get pending approvals
    this.app.get('/api/approvals', (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: true, data: { pending: [], counts: { pending: 0, approved: 0, rejected: 0, total: 0 } } });
      }
      res.json({
        success: true,
        data: {
          pending: approvalQueue.getPending(),
          counts: approvalQueue.getCounts()
        }
      });
    });

    // Get approval history
    this.app.get('/api/approvals/history', (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: true, data: [] });
      }
      const limit = parseInt(req.query.limit) || 50;
      res.json({ success: true, data: approvalQueue.getHistory(limit) });
    });

    // Approve an action
    this.app.post('/api/approvals/:id/approve', this.wrap(async (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: false, error: 'Approval system not initialized' });
      }
      
      const item = await approvalQueue.approve(req.params.id, req.body.approvedBy || 'user');
      
      // Execute the approved action through ActionEngine
      if (this.ace?.actionEngine) {
        try {
          const result = await this.ace.actionEngine.executeIntent(
            { type: item.actionType, confidence: 1.0, params: item.params },
            item.context?.originalMessage || '',
            item.context || {}
          );
          res.json({ success: true, data: { approval: item, executionResult: result } });
        } catch (execError) {
          res.json({ success: true, data: { approval: item, executionError: execError.message } });
        }
      } else {
        res.json({ success: true, data: { approval: item } });
      }
    }));

    // Reject an action
    this.app.post('/api/approvals/:id/reject', this.wrap(async (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: false, error: 'Approval system not initialized' });
      }

      const item = await approvalQueue.reject(
        req.params.id,
        req.body.reason || '',
        req.body.rejectedBy || 'user'
      );
      res.json({ success: true, data: item });
    }));

    // Get trust profile — what Ace has learned about user preferences
    this.app.get('/api/approvals/trust', (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: true, data: {} });
      }
      res.json({ success: true, data: approvalQueue.getTrustProfile() });
    });

    // Reset trust for a specific action type
    this.app.delete('/api/approvals/trust/:actionType', this.wrap(async (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: false, error: 'Approval system not initialized' });
      }
      await approvalQueue.resetTrust(req.params.actionType);
      res.json({ success: true, data: { reset: req.params.actionType } });
    }));

    // Reset all trust
    this.app.delete('/api/approvals/trust', this.wrap(async (req, res) => {
      const approvalQueue = this.ace?.approvalQueue;
      if (!approvalQueue) {
        return res.json({ success: false, error: 'Approval system not initialized' });
      }
      await approvalQueue.resetAllTrust();
      res.json({ success: true, data: { reset: 'all' } });
    }));
  }

  // ═══════════════════════════════════════════════════════
  // SCHEDULER & PROACTIVE — Routines, insights, automation
  // ═══════════════════════════════════════════════════════

  registerSchedulerRoutes() {
    // Get all routines
    this.app.get('/api/scheduler/routines', (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: true, data: [] });
      res.json({ success: true, data: scheduler.routines || [] });
    });

    // Get scheduler status (next runs, execution history)
    this.app.get('/api/scheduler/status', (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: true, data: { running: false, routines: 0 } });
      
      const timers = {};
      for (const [id, timer] of scheduler.timers.entries()) {
        timers[id] = { nextRun: timer.nextRun };
      }
      
      res.json({
        success: true,
        data: {
          running: scheduler.isRunning,
          routineCount: scheduler.routines.length,
          enabledCount: scheduler.routines.filter(r => r.enabled).length,
          timers,
          recentHistory: (scheduler.executionHistory || []).slice(-20)
        }
      });
    });

    // Add a new routine
    this.app.post('/api/scheduler/routines', this.wrap(async (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: false, error: 'Scheduler not initialized' });
      const routine = await scheduler.addRoutine(req.body);
      res.json({ success: true, data: routine });
    }));

    // Toggle routine enabled/disabled
    this.app.post('/api/scheduler/routines/:id/toggle', this.wrap(async (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: false, error: 'Scheduler not initialized' });
      
      const routine = scheduler.routines.find(r => r.id === req.params.id);
      if (!routine) return res.json({ success: false, error: 'Routine not found' });
      
      routine.enabled = !routine.enabled;
      await scheduler.saveRoutines();
      res.json({ success: true, data: routine });
    }));

    // Update a routine's properties
    this.app.put('/api/scheduler/routines/:id', this.wrap(async (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: false, error: 'Scheduler not initialized' });
      const updated = await scheduler.updateRoutine(req.params.id, req.body);
      if (!updated) return res.json({ success: false, error: 'Routine not found' });
      res.json({ success: true, data: updated });
    }));

    // Delete a routine
    this.app.delete('/api/scheduler/routines/:id', this.wrap(async (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: false, error: 'Scheduler not initialized' });
      
      scheduler.routines = scheduler.routines.filter(r => r.id !== req.params.id);
      await scheduler.saveRoutines();
      res.json({ success: true });
    }));

    // Execute routine now
    this.app.post('/api/scheduler/routines/:id/run', this.wrap(async (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: false, error: 'Scheduler not initialized' });
      const result = await scheduler.executeRoutine(req.params.id);
      res.json({ success: true, data: result });
    }));

    // Trigger pipeline check on demand
    this.app.post('/api/scheduler/pipeline-check', this.wrap(async (req, res) => {
      const scheduler = this.ace?.autonomousScheduler;
      if (!scheduler) return res.json({ success: false, error: 'Scheduler not initialized' });
      await scheduler.checkPipelineActions();
      res.json({ success: true, message: 'Pipeline check triggered' });
    }));

    // Get proactive insights
    this.app.get('/api/insights', (req, res) => {
      const monitor = this.ace?.proactiveMonitor;
      if (!monitor) return res.json({ success: true, data: [] });
      res.json({ success: true, data: monitor.insights || [] });
    });

    // Mark insight as read
    this.app.post('/api/insights/:id/read', (req, res) => {
      const monitor = this.ace?.proactiveMonitor;
      if (!monitor) return res.json({ success: false, error: 'Monitor not available' });
      const insight = monitor.insights.find(i => i.id === req.params.id);
      if (insight) insight.read = true;
      res.json({ success: true });
    });

    // Trigger proactive check now
    this.app.post('/api/insights/check', this.wrap(async (req, res) => {
      const monitor = this.ace?.proactiveMonitor;
      if (!monitor) return res.json({ success: false, error: 'Monitor not available' });
      await monitor.runChecks();
      res.json({ success: true, data: monitor.insights.slice(-10) });
    }));
  }
  // ═══════════════════════════════════════════════════════
  // WORKLOAD ROUTES — File & Codebase Knowledge Ingestion
  // ═══════════════════════════════════════════════════════

  registerWorkloadRoutes() {
    // List all ingested sources + stats
    this.app.get('/api/workload/sources', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const sources = store.getSources();
      const stats = store.getStats();
      res.json({ success: true, data: { sources, stats } });
    }));

    // Upload a single file (PDF, DOCX, TXT, CSV, code files)
    this.app.post('/api/workload/upload', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const filename = decodeURIComponent(req.headers['x-filename'] || 'uploaded.txt');
      const sourceName = decodeURIComponent(req.headers['x-source-name'] || filename);

      // Collect raw bytes (same pattern as SOP upload)
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
      const buffer = Buffer.concat(chunks);

      if (!buffer.length) return res.json({ success: false, error: 'Empty file' });

      const result = await store.ingestUploadedBuffer(buffer, filename, sourceName);
      res.json({ success: true, data: result });
    }));

    // Ingest a local folder or codebase
    this.app.post('/api/workload/ingest-folder', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const { folderPath, sourceName, type } = req.body;
      if (!folderPath) return res.json({ success: false, error: 'folderPath is required' });

      const sourceId = `src_${Date.now()}`;

      // Return immediately, ingest in background
      res.json({ success: true, data: { sourceId, status: 'ingesting', message: 'Ingestion started' } });

      try {
        if (type === 'codebase') {
          await store.ingestCodebase(folderPath, { sourceName: sourceName || folderPath, sourceId });
        } else {
          await store.ingestFolder(folderPath, { sourceName: sourceName || folderPath, sourceId });
        }
      } catch (err) {
        console.error('[Workload] Ingestion failed:', err.message);
      }
    }));

    // Delete a source and its chunks
    this.app.delete('/api/workload/sources/:id', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      await store.removeSource(req.params.id);
      res.json({ success: true, message: 'Source removed' });
    }));

    // Re-ingest a source from its original path
    this.app.post('/api/workload/sources/:id/reindex', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const result = await store.reindexSource(req.params.id);
      res.json({ success: true, data: result });
    }));

    // Search the workload store
    this.app.get('/api/workload/search', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const { q } = req.query;
      if (!q) return res.json({ success: false, error: 'Query parameter q is required' });

      const results = await store.search(q, 10);
      res.json({ success: true, data: results });
    }));

    // ── Media ──

    // List media files
    this.app.get('/api/workload/media', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const { type, tag } = req.query;
      const media = store.getMedia({ type, tag });
      res.json({ success: true, data: media });
    }));

    // Scan a folder for media files (index without copying)
    this.app.post('/api/workload/media/scan', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const { folderPath } = req.body;
      if (folderPath) {
        const result = await store.scanMediaFolder(folderPath);
        res.json({ success: true, data: result });
      } else {
        await store.scanMedia();
        res.json({ success: true, data: { total: store.media.length } });
      }
    }));

    // Upload media files (images, videos) directly via browser
    this.app.post('/api/workload/media/upload', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const filename = decodeURIComponent(req.headers['x-filename'] || `upload_${Date.now()}.jpg`);
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
      const buffer = Buffer.concat(chunks);

      if (!buffer.length) return res.json({ success: false, error: 'Empty file' });

      const path = await import('path');
      const fs = await import('fs/promises');
      const ext = path.default.extname(filename).toLowerCase();

      // Validate it's a media file
      const mediaExts = new Set([
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp',
        '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
        '.mp3', '.wav', '.ogg', '.m4a'
      ]);
      if (!mediaExts.has(ext)) {
        return res.json({ success: false, error: `Unsupported media type: ${ext}. Use the file upload for documents.` });
      }

      // Save to media directory
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destPath = path.default.join(store.mediaDir, safeName);
      await fs.default.mkdir(store.mediaDir, { recursive: true });
      await fs.default.writeFile(destPath, buffer);

      // Re-scan to pick it up
      await store.scanMedia();

      const added = store.media.find(m => m.path === destPath);
      res.json({ success: true, data: { filename: safeName, path: destPath, media: added || null } });
    }));

    // Update media tags/description
    this.app.put('/api/workload/media/:id', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      const result = await store.updateMedia(req.params.id, req.body);
      if (!result) return res.json({ success: false, error: 'Media not found' });
      res.json({ success: true, data: result });
    }));

    // Remove media from index
    this.app.delete('/api/workload/media/:id', this.wrap(async (req, res) => {
      const store = this.ace?.workloadStore;
      if (!store) return res.json({ success: false, error: 'WorkloadStore not initialized' });

      await store.removeMedia(req.params.id);
      res.json({ success: true, message: 'Media removed from index' });
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // INTEGRATION ROUTES
  // ═══════════════════════════════════════════════════════════

  registerIntegrationRoutes() {
    const mgr = () => this.ace?.integrationManager;

    // GET /api/integrations — Full catalog with user state merged
    this.app.get('/api/integrations', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: true, data: { services: [], categories: [] } });
      const services = mgr().getAll();
      const categories = mgr().getCategories();
      res.json({ success: true, data: { services, categories } });
    }));

    // GET /api/integrations/enabled — Only enabled services
    this.app.get('/api/integrations/enabled', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: true, data: [] });
      res.json({ success: true, data: mgr().getEnabled() });
    }));

    // POST /api/integrations/:id/enable
    this.app.post('/api/integrations/:id/enable', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: false, error: 'IntegrationManager not initialized' });
      const state = await mgr().enable(req.params.id);
      res.json({ success: true, data: state });
    }));

    // POST /api/integrations/:id/disable
    this.app.post('/api/integrations/:id/disable', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: false, error: 'IntegrationManager not initialized' });
      await mgr().disable(req.params.id);
      res.json({ success: true });
    }));

    // PUT /api/integrations/:id/notes — Update notes
    this.app.put('/api/integrations/:id/notes', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: false, error: 'IntegrationManager not initialized' });
      const state = await mgr().updateNotes(req.params.id, req.body.notes || '');
      res.json({ success: true, data: state });
    }));

    // GET /api/integrations/:id/sops — Linked SOPs for a service
    this.app.get('/api/integrations/:id/sops', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: true, data: [] });
      const sops = mgr().getLinkedSOPs(req.params.id);
      res.json({ success: true, data: sops });
    }));

    // POST /api/integrations/custom — Add custom service
    this.app.post('/api/integrations/custom', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: false, error: 'IntegrationManager not initialized' });
      try {
        const service = await mgr().addCustomService(req.body);
        res.json({ success: true, data: service });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // DELETE /api/integrations/custom/:id — Remove custom service
    this.app.delete('/api/integrations/custom/:id', this.wrap(async (req, res) => {
      if (!mgr()) return res.json({ success: false, error: 'IntegrationManager not initialized' });
      await mgr().removeCustomService(req.params.id);
      res.json({ success: true });
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // TWILIO ROUTES — SMS, Voice, BYO Phone Agent
  // ═══════════════════════════════════════════════════════════

  registerTwilioRoutes() {
    const twilio = () => this.ace?.twilioService;
    const mgr = () => this.ace?.integrationManager;

    // GET /api/twilio/status — Check if Twilio is configured
    this.app.get('/api/twilio/status', this.wrap(async (req, res) => {
      if (!twilio()) return res.json({ success: true, data: { configured: false } });
      const status = await twilio().getCredentialStatus();
      res.json({ success: true, data: status });
    }));

    // POST /api/twilio/credentials — Save Twilio credentials
    this.app.post('/api/twilio/credentials', this.wrap(async (req, res) => {
      if (!twilio()) return res.json({ success: false, error: 'TwilioService not initialized' });
      const { accountSid, authToken, phoneNumber } = req.body;
      if (!accountSid || !authToken || !phoneNumber) {
        return res.json({ success: false, error: 'Missing required fields: accountSid, authToken, phoneNumber' });
      }

      const result = await twilio().saveCredentials({ accountSid, authToken, phoneNumber });

      // Upgrade integration tier to 'connected'
      if (mgr()) {
        if (!mgr().state.twilio) await mgr().enable('twilio');
        mgr().state.twilio.tier = 'connected';
        await mgr()._saveState();
      }

      // Refresh UnifiedAgent tools (Twilio tools now available)
      if (this.ace?.brain?.unifiedAgent) {
        this.ace.brain.unifiedAgent.subsystems.twilioService = twilio();
        this.ace.brain.unifiedAgent.refreshTools();
      }

      res.json({ success: true, data: result });
    }));

    // POST /api/twilio/test — Test Twilio connection
    this.app.post('/api/twilio/test', this.wrap(async (req, res) => {
      if (!twilio()) return res.json({ success: false, error: 'TwilioService not initialized' });
      try {
        const result = await twilio().testConnection();
        res.json({ success: true, data: result });
      } catch (e) {
        res.json({ success: false, error: e.message });
      }
    }));

    // POST /api/twilio/byo-credentials — Save BYO phone agent credentials
    this.app.post('/api/twilio/byo-credentials', this.wrap(async (req, res) => {
      if (!twilio()) return res.json({ success: false, error: 'TwilioService not initialized' });
      const { provider, apiKey, endpointUrl, assistantId } = req.body;
      if (!provider || !apiKey) {
        return res.json({ success: false, error: 'Missing required fields: provider, apiKey' });
      }
      const result = await twilio().saveByoCredentials({ provider, apiKey, endpointUrl, assistantId });

      // Refresh tools
      if (this.ace?.brain?.unifiedAgent) {
        this.ace.brain.unifiedAgent.refreshTools();
      }

      res.json({ success: true, data: result });
    }));

    // GET /api/twilio/byo-status — Check BYO agent config
    this.app.get('/api/twilio/byo-status', this.wrap(async (req, res) => {
      if (!twilio()) return res.json({ success: true, data: { configured: false } });
      const status = await twilio().getByoCredentialStatus();
      res.json({ success: true, data: status });
    }));

    // POST /api/webhooks/twilio/sms — Inbound SMS webhook (optional, needs public URL)
    this.app.post('/api/webhooks/twilio/sms', this.wrap(async (req, res) => {
      // Respond with empty TwiML (acknowledge receipt)
      res.type('text/xml');
      res.send('<Response></Response>');
    }));

    // POST /api/webhooks/twilio/voice — Call status webhook (optional)
    this.app.post('/api/webhooks/twilio/voice', this.wrap(async (req, res) => {
      res.type('text/xml');
      res.send('<Response></Response>');
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // BILLING & CREDITS ROUTES
  // ═══════════════════════════════════════════════════════════

  registerBillingRoutes() {
    const credits = () => this.ace?.creditManager;
    const stripe = () => this.ace?.stripeService;

    // GET /api/billing/credits — Current balance + trial info
    this.app.get('/api/billing/credits', this.wrap(async (req, res) => {
      if (!credits()) return res.json({ success: true, data: { plan: 'trial', total: 0, trialDaysLeft: null } });
      res.json({ success: true, data: credits().getBalance() });
    }));

    // GET /api/billing/usage — Usage stats
    this.app.get('/api/billing/usage', this.wrap(async (req, res) => {
      if (!credits()) return res.json({ success: true, data: { today: 0, thisWeek: 0, thisMonth: 0, recentActions: [] } });
      res.json({ success: true, data: credits().getUsageStats() });
    }));

    // POST /api/billing/checkout — Create Stripe Checkout session
    this.app.post('/api/billing/checkout', this.wrap(async (req, res) => {
      if (!stripe() || !stripe().isConfigured()) {
        return res.json({ success: false, error: 'Stripe not configured. Set up in Settings → Billing.' });
      }
      const { mode, amount } = req.body;
      const customerId = credits()?.getBalance()?.stripeCustomerId || null;

      const result = await stripe().createCheckoutSession({
        mode: mode || 'top_up',
        customerId,
        amount: Number(amount) || 5,
        successUrl: `http://localhost:${process.env.PORT || 3333}`,
        cancelUrl: `http://localhost:${process.env.PORT || 3333}`,
      });
      res.json({ success: true, data: result });
    }));

    // POST /api/billing/webhook — Stripe webhook handler
    this.app.post('/api/billing/webhook', this.wrap(async (req, res) => {
      if (!stripe() || !stripe().isConfigured()) {
        return res.status(400).json({ success: false, error: 'Stripe not configured' });
      }

      const sig = req.headers['stripe-signature'];
      if (!sig) return res.status(400).json({ success: false, error: 'Missing Stripe-Signature header' });

      let event;
      try {
        event = stripe().handleWebhook(req.body, sig);
      } catch (err) {
        console.error('[Billing] Webhook signature verification failed:', err.message);
        return res.status(400).json({ success: false, error: 'Webhook signature verification failed' });
      }


      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.mode === 'subscription') {
            // New subscription activated
            await credits().setPlan('credits');
            await credits().setStripeIds(session.customer, session.subscription);
            await credits().resetSubscriptionCredits();
          } else if (session.metadata?.type === 'top_up') {
            // Credit top-up
            const creditAmount = Number(session.metadata.credits) || 500;
            await credits().addCredits(creditAmount, 'stripe_top_up');
            if (session.customer) await credits().setStripeIds(session.customer, credits().getBalance().stripeSubscriptionId);
          }
          break;
        }

        case 'invoice.paid': {
          // Subscription renewal — reset monthly credits
          await credits().resetSubscriptionCredits();
          const sub = event.data.object;
          if (sub.lines?.data?.[0]?.period?.end) {
            await credits().setCurrentPeriodEnd(new Date(sub.lines.data[0].period.end * 1000).toISOString());
          }
          break;
        }

        case 'customer.subscription.deleted': {
          // Subscription cancelled
          await credits().setPlan('trial');
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object;
          if (sub.current_period_end) {
            await credits().setCurrentPeriodEnd(new Date(sub.current_period_end * 1000).toISOString());
          }
          break;
        }
      }

      res.json({ received: true });
    }));

    // POST /api/billing/auto-reload — Configure auto-reload settings
    this.app.post('/api/billing/auto-reload', this.wrap(async (req, res) => {
      if (!credits()) return res.json({ success: false, error: 'CreditManager not initialized' });
      const { enabled, amount, threshold } = req.body;
      await credits().setAutoReload({ enabled, amount, threshold });
      res.json({ success: true, data: credits().getBalance().autoReload });
    }));

    // GET /api/billing/portal — Stripe Customer Portal
    this.app.get('/api/billing/portal', this.wrap(async (req, res) => {
      if (!stripe() || !stripe().isConfigured()) {
        return res.json({ success: false, error: 'Stripe not configured' });
      }
      const customerId = credits()?.getBalance()?.stripeCustomerId;
      if (!customerId) return res.json({ success: false, error: 'No Stripe customer ID. Subscribe first.' });

      const result = await stripe().createCustomerPortalSession(
        customerId,
        `http://localhost:${process.env.PORT || 3333}`
      );
      res.json({ success: true, data: result });
    }));

    // GET /api/billing/stripe-status — Check Stripe config
    this.app.get('/api/billing/stripe-status', this.wrap(async (req, res) => {
      if (!stripe()) return res.json({ success: true, data: { configured: false } });
      const status = await stripe().getCredentialStatus();
      res.json({ success: true, data: status });
    }));

    // POST /api/billing/plan — Switch between 'credits' and 'byo_key' plans
    this.app.post('/api/billing/plan', this.wrap(async (req, res) => {
      if (!credits()) return res.json({ success: false, error: 'CreditManager not initialized' });
      const { plan } = req.body;
      if (!['credits', 'byo_key'].includes(plan)) {
        return res.json({ success: false, error: 'Invalid plan. Must be "credits" or "byo_key".' });
      }
      await credits().setPlan(plan);
      res.json({ success: true, data: credits().getBalance() });
    }));

    // Stripe credentials are configured via data/memory/credentials/stripe.json (not exposed via API)
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE, FEEDBACK & CRASH ROUTES
  // ═══════════════════════════════════════════════════════════

  registerUpdateRoutes() {
    const updates = () => this.ace?.updateManager;
    const feedback = () => this.ace?.feedbackManager;
    const crashes = () => this.ace?.crashReporter;

    // ── Version & Update Check ──────────────────────────────

    // GET /api/system/version — Current version + update state
    this.app.get('/api/system/version', this.wrap(async (req, res) => {
      if (!updates()) return res.json({ success: true, data: { currentVersion: '1.0.0' } });
      res.json({ success: true, data: updates().getUpdateState() });
    }));

    // GET /api/system/update-check — Check GitHub for latest release
    this.app.get('/api/system/update-check', this.wrap(async (req, res) => {
      if (!updates()) return res.json({ success: false, error: 'UpdateManager not initialized' });
      const result = await updates().checkForUpdate();
      res.json({ success: true, data: result });
    }));

    // POST /api/system/update — Perform update with SSE progress stream
    this.app.post('/api/system/update', (req, res) => {
      if (!updates()) return res.json({ success: false, error: 'UpdateManager not initialized' });

      // Set up SSE
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      updates().performUpdate((progress) => {
        sendProgress(progress);
      }).then((result) => {
        sendProgress({ step: 'complete', status: result.success ? 'done' : 'error', detail: result.success ? 'Update complete — restarting...' : result.error });
        // Don't end response — server will exit and connection will close
      }).catch((error) => {
        sendProgress({ step: 'error', status: 'error', detail: error.message });
        res.end();
      });
    });

    // POST /api/system/update-fix — Clean up dirty files then retry update
    // Used when a normal update fails due to uncommitted build artifacts
    this.app.post('/api/system/update-fix', (req, res) => {
      if (!updates()) return res.json({ success: false, error: 'UpdateManager not initialized' });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const sendProgress = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Run cleanup first, then normal update
      (async () => {
        sendProgress({ step: 'fix', status: 'active', detail: 'Cleaning up build files...' });
        try {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          const baseDir = updates().baseDir;
          // Reset build artifacts that cause merge conflicts
          await execAsync('git checkout -- src/desktop/dashboard-ui/dist/ 2>/dev/null || true', { cwd: baseDir, timeout: 30000 });
          await execAsync('git checkout -- src/studio/dist/ 2>/dev/null || true', { cwd: baseDir, timeout: 30000 });
          // Stash any other local changes
          await execAsync('git stash --include-untracked 2>/dev/null || true', { cwd: baseDir, timeout: 30000 });
          sendProgress({ step: 'fix', status: 'done', detail: 'Build files cleaned' });
        } catch (e) {
          sendProgress({ step: 'fix', status: 'done', detail: 'Cleanup attempted (continuing)' });
        }

        // Now run normal update
        const result = await updates().performUpdate((progress) => sendProgress(progress));
        sendProgress({ step: 'complete', status: result.success ? 'done' : 'error', detail: result.success ? 'Update complete — restarting...' : result.error });
      })().catch((error) => {
        sendProgress({ step: 'error', status: 'error', detail: error.message });
        res.end();
      });
    });

    // POST /api/system/dismiss-update — Dismiss update banner for this version
    this.app.post('/api/system/dismiss-update', this.wrap(async (req, res) => {
      if (!updates()) return res.json({ success: false, error: 'UpdateManager not initialized' });
      const { version } = req.body;
      await updates().dismissUpdate(version);
      res.json({ success: true });
    }));

    // ── Feedback ────────────────────────────────────────────

    // POST /api/feedback — Submit feedback
    this.app.post('/api/feedback', this.wrap(async (req, res) => {
      if (!feedback()) return res.json({ success: false, error: 'FeedbackManager not initialized' });
      const { type, message } = req.body;
      if (!message || !message.trim()) return res.json({ success: false, error: 'Message is required' });
      const entry = await feedback().submitFeedback({ type: type || 'general', message });
      res.json({ success: true, data: entry });
    }));

    // GET /api/feedback — List all feedback
    this.app.get('/api/feedback', this.wrap(async (req, res) => {
      if (!feedback()) return res.json({ success: true, data: [] });
      const entries = await feedback().listFeedback();
      res.json({ success: true, data: entries });
    }));

    // ── Crash Reports ───────────────────────────────────────

    // GET /api/system/crashes — List recent crash reports
    this.app.get('/api/system/crashes', this.wrap(async (req, res) => {
      if (!crashes()) return res.json({ success: true, data: [] });
      const limit = parseInt(req.query.limit) || 50;
      const reports = await crashes().listCrashes(limit);
      res.json({ success: true, data: reports });
    }));
  }

  // ═══════════════════════════════════════════════════════════
  // FINANCE / BOOKKEEPING ROUTES
  // ═══════════════════════════════════════════════════════════

  registerFinanceRoutes() {
    const fm = () => this.ace?.financeManager;

    // GET /api/finance/summary — Stats + category totals
    this.app.get('/api/finance/summary', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      res.json({ success: true, data: fm().getStats(year) });
    }));

    // GET /api/finance/transactions — Filtered transaction list
    this.app.get('/api/finance/transactions', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const filters = {};
      if (req.query.year) filters.year = parseInt(req.query.year);
      if (req.query.month) filters.month = parseInt(req.query.month);
      if (req.query.category) filters.category = req.query.category;
      if (req.query.source) filters.source = req.query.source;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.personal !== undefined) filters.personal = req.query.personal === 'true';
      res.json({ success: true, data: fm().getTransactions(filters) });
    }));

    // POST /api/finance/upload — Upload bank statement (binary body)
    this.app.post('/api/finance/upload', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });

      const filename = decodeURIComponent(req.headers['x-filename'] || 'statement.csv');

      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      await new Promise((resolve, reject) => { req.on('end', resolve); req.on('error', reject); });
      const buffer = Buffer.concat(chunks);

      if (!buffer.length) return res.json({ success: false, error: 'Empty file' });

      const result = await fm().ingestStatement(buffer, filename);
      res.json({ success: true, data: result });
    }));

    // POST /api/finance/categorize — AI categorize uncategorized transactions
    this.app.post('/api/finance/categorize', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const { txnIds } = req.body || {};
      const result = await fm().categorizeTransactions(txnIds || null);
      res.json({ success: true, data: result });
    }));

    // POST /api/finance/transaction — Add manual expense
    this.app.post('/api/finance/transaction', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const txn = fm().addManualExpense(req.body);
      res.json({ success: true, data: txn });
    }));

    // PUT /api/finance/transaction/:id — Update transaction
    this.app.put('/api/finance/transaction/:id', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const txn = fm().updateTransaction(req.params.id, req.body);
      res.json({ success: true, data: txn });
    }));

    // DELETE /api/finance/transaction/:id — Delete transaction
    this.app.delete('/api/finance/transaction/:id', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      fm().deleteTransaction(req.params.id);
      res.json({ success: true });
    }));

    // GET /api/finance/mileage — Mileage entries
    this.app.get('/api/finance/mileage', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      res.json({ success: true, data: fm().getMileage(year) });
    }));

    // POST /api/finance/mileage/bulk — Add monthly mileage in bulk
    this.app.post('/api/finance/mileage/bulk', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const { entries, year } = req.body || {};
      const result = fm().addBulkMileage(entries, year);
      res.json({ success: true, data: result });
    }));

    // POST /api/finance/mileage — Add mileage entry
    this.app.post('/api/finance/mileage', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const entry = fm().addMileage(req.body);
      res.json({ success: true, data: entry });
    }));

    // PUT /api/finance/mileage/:id — Edit mileage
    this.app.put('/api/finance/mileage/:id', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const entry = fm().updateMileage(req.params.id, req.body);
      res.json({ success: true, data: entry });
    }));

    // DELETE /api/finance/mileage/:id — Delete mileage
    this.app.delete('/api/finance/mileage/:id', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      fm().deleteMileage(req.params.id);
      res.json({ success: true });
    }));

    // GET /api/finance/report — Generate CPA report JSON
    this.app.get('/api/finance/report', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      res.json({ success: true, data: fm().generateReport(year) });
    }));

    // GET /api/finance/export — Download CSV
    this.app.get('/api/finance/export', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      const year = req.query.year ? parseInt(req.query.year) : undefined;
      const csv = fm().exportCSV(year);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="tax-report-${year || new Date().getFullYear()}.csv"`);
      res.send(csv);
    }));

    // GET /api/finance/statements — List uploaded statements
    this.app.get('/api/finance/statements', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      res.json({ success: true, data: fm().getStatements() });
    }));

    // DELETE /api/finance/statements/:id — Delete statement + its transactions
    this.app.delete('/api/finance/statements/:id', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      fm().deleteStatement(req.params.id);
      res.json({ success: true });
    }));

    // GET /api/finance/categories — List all IRS categories
    this.app.get('/api/finance/categories', this.wrap(async (req, res) => {
      if (!fm()) return res.json({ success: false, error: 'FinanceManager not initialized' });
      res.json({ success: true, data: fm().getCategories() });
    }));
  }
}

export default ApiGateway;
