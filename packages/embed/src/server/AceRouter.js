/**
 * AceRouter — Express-compatible route handler for the embedded SDK.
 * Handles chat (SSE streaming), pipeline, license, and Stripe webhook routes.
 */

export class AceRouter {
  constructor({ agent, license, cronRunner, subsystems }) {
    this.agent = agent;
    this.license = license;
    this.cronRunner = cronRunner;
    this.subsystems = subsystems;
    this.conversations = new Map(); // channelId → message history
  }

  // ── Route dispatcher (framework-agnostic) ──
  async handle(req, res) {
    const url = req.url || req.path || '';
    const method = req.method?.toUpperCase() || 'GET';

    // Strip base path (e.g., /api/ace/chat → /chat)
    const route = url.replace(/^\/api\/ace/, '').split('?')[0];

    try {
      if (method === 'POST' && route === '/chat') return await this.handleChat(req, res);
      if (method === 'POST' && route === '/stop') return await this.handleStop(req, res);
      if (method === 'GET' && route === '/pipeline') return await this.handlePipeline(req, res);
      if (method === 'GET' && route === '/license') return await this.handleLicense(req, res);
      if (method === 'POST' && route === '/webhook/stripe') return await this.handleStripeWebhook(req, res);
      if (method === 'GET' && route === '/health') return res.json({ ok: true, version: '1.0.0' });

      res.status?.(404);
      return res.json({ error: 'Not found' });
    } catch (err) {
      console.error('[AceRouter] Error:', err.message);
      res.status?.(500);
      return res.json({ error: err.message });
    }
  }

  // ── Chat with SSE streaming ──
  async handleChat(req, res) {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { message, conversationId = 'default' } = body || {};

    if (!message) {
      res.status?.(400);
      return res.json({ error: 'Missing "message" in request body' });
    }

    // License check
    if (this.license) {
      const check = this.license.checkLimit('interactions');
      if (!check.allowed) {
        return res.json({
          type: 'error',
          content: 'Free trial limit reached. Upgrade to Pro at openaceai.com for unlimited access.',
          upgrade: true
        });
      }
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (res.flushHeaders) res.flushHeaders();

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      if (res.flush) res.flush(); // For compression middleware
    };

    // Progress callback → SSE thinking events
    const originalOnProgress = this.agent.onProgress;
    this.agent.onProgress = (msg) => {
      send({ type: 'thinking', content: msg });
      originalOnProgress(msg);
    };

    try {
      send({ type: 'thinking', content: 'Ace is thinking...' });

      // Get/create conversation history
      if (!this.conversations.has(conversationId)) {
        this.conversations.set(conversationId, []);
      }
      const history = this.conversations.get(conversationId);

      // Add user message to history
      history.push({ role: 'user', content: message, timestamp: new Date().toISOString() });

      // Process
      const response = await this.agent.process(message, history, { conversationId });

      // Add assistant response to history
      history.push({ role: 'assistant', content: response.text || '', timestamp: new Date().toISOString() });

      // Trim history to last 60 messages
      if (history.length > 60) {
        history.splice(0, history.length - 60);
      }

      // Send response
      send({
        type: 'response',
        content: {
          message: response.text,
          toolsUsed: response.toolsUsed || [],
          question: response.question || null,
          pendingActions: response.pendingActions || null,
        },
        thinking: response.thinking || []
      });

      send({ type: 'done' });

    } catch (error) {
      console.error('[AceRouter] Chat error:', error.message);
      send({ type: 'error', content: error.message });
    } finally {
      this.agent.onProgress = originalOnProgress;
      res.end();
    }
  }

  // ── Stop processing ──
  async handleStop(req, res) {
    this.agent.abort();
    return res.json({ success: true });
  }

  // ── Get pipeline ──
  async handlePipeline(req, res) {
    const pm = this.subsystems.pipelineManager;
    if (!pm) return res.json({ error: 'Pipeline not available' });

    const pipeline = pm.pipeline || { items: [], leads: [] };
    return res.json({
      leads: pipeline.leads || [],
      tasks: pipeline.items || [],
      totalLeads: (pipeline.leads || []).length,
      totalTasks: (pipeline.items || []).length
    });
  }

  // ── License status ──
  async handleLicense(req, res) {
    if (!this.license) {
      return res.json({ plan: 'trial', trialDaysLeft: 30, watermark: true });
    }

    const plan = this.license.getPlan();
    return res.json({
      plan,
      trialDaysLeft: this.license.cachedLicense?.trialDaysLeft || 0,
      watermark: this.license.getWatermark(),
      features: this.license.cachedLicense?.features || []
    });
  }

  // ── Stripe webhook ──
  async handleStripeWebhook(req, res) {
    // Stripe webhook handling — update license status on payment
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const event = body;

      if (event.type === 'checkout.session.completed') {
        // Activate Pro plan
        if (this.license) {
          this.license.cachedLicense = {
            ...(this.license.cachedLicense || {}),
            plan: 'pro',
            watermark: false,
          };
          await this.license.saveLicenseCache();
        }
      }

      return res.json({ received: true });
    } catch (err) {
      console.error('[AceRouter] Stripe webhook error:', err.message);
      res.status?.(400);
      return res.json({ error: err.message });
    }
  }
}
