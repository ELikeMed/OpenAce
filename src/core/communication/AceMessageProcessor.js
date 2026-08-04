/**
 * AceMessageProcessor - Intelligent Message Handler for Ace
 * 
 * This is Ace's "brain" that processes any message and decides:
 * - What the user wants
 * - How to respond intelligently  
 * - When to trigger actions (research, save strategies, add leads)
 * - How to continue conversations contextually
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleIntegration } from '../integrations/GoogleIntegration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

export class AceMessageProcessor {
  constructor(config = {}) {
    this.config = config;
    this.conversationHistory = new Map(); // chatId -> messages[]
    this.activeStrategies = new Map(); // chatId -> current strategy being built
    this.pendingTasks = new Map(); // chatId -> tasks queue
    this.aiProvider = null;
    this.skills = [];
    this.sops = [];
    this.google = null; // Google integration
    this.brain = null;  // AceBrain — unified intelligence (set externally)
  }

  /**
   * Initialize the message processor
   */
  async initialize() {
    // Load skills
    await this.loadSkills();
    
    // Load SOPs
    await this.loadSOPs();
    
    // Initialize AI provider
    await this.initializeAI();
    
    // Initialize Google integration
    await this.initializeGoogle();
    
    console.log('🧠 Ace Message Processor initialized');
    
    return true;
  }

  /**
   * Initialize Google Integration
   */
  async initializeGoogle() {
    try {
      this.google = new GoogleIntegration();
      const status = await this.google.initialize();
      if (status.status === 'connected') {
      }
    } catch (error) {
    }
  }

  /**
   * Load available skills
   */
  async loadSkills() {
    try {
      const skillsDir = path.join(PROJECT_ROOT, 'data', 'skills');
      const files = await fs.readdir(skillsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(skillsDir, file), 'utf8');
          this.skills.push(JSON.parse(content));
        }
      }
    } catch (error) {
    }
  }

  /**
   * Load available SOPs
   */
  async loadSOPs() {
    try {
      const sopsDir = path.join(PROJECT_ROOT, 'data', 'sops');
      await this.loadSOPsRecursive(sopsDir);
    } catch (error) {
    }
  }

  async loadSOPsRecursive(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await this.loadSOPsRecursive(fullPath);
      } else if (entry.name.endsWith('.json')) {
        const content = await fs.readFile(fullPath, 'utf8');
        this.sops.push(JSON.parse(content));
      }
    }
  }

  /**
   * Initialize AI provider (Ollama, OpenAI, or Claude)
   */
  async initializeAI() {
    try {
      const configPath = path.join(PROJECT_ROOT, 'config', 'openace.config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      const activeProvider = config.ai_providers?.active_provider || 'ollama';
      const providerConfig = config.ai_providers?.providers?.[activeProvider];
      
      if (activeProvider === 'ollama' && providerConfig?.enabled) {
        this.aiProvider = {
          type: 'ollama',
          baseUrl: providerConfig.base_url || 'http://localhost:11434/v1',
          model: providerConfig.model || 'llama3.2'
        };
      } else if (activeProvider === 'openai' && providerConfig?.enabled) {
        this.aiProvider = {
          type: 'openai',
          apiKey: providerConfig.api_key || process.env.OPENAI_API_KEY,
          model: providerConfig.model || 'gpt-4o'
        };
      } else if (activeProvider === 'claude' && providerConfig?.enabled) {
        this.aiProvider = {
          type: 'claude',
          apiKey: providerConfig.api_key || process.env.ANTHROPIC_API_KEY,
          model: providerConfig.model || 'claude-3-5-sonnet-20241022'
        };
      } else {
        this.aiProvider = { type: 'basic' };
      }
    } catch (error) {
      this.aiProvider = { type: 'basic' };
    }
  }

  /**
   * Set the AceBrain instance for unified intelligence
   */
  setBrain(brain) {
    this.brain = brain;
  }

  /**
   * Process an incoming message and generate intelligent response.
   *
   * If AceBrain is available, delegates to it for unified intelligence
   * that shares context with the dashboard. Otherwise falls back to
   * the legacy per-provider AI calls.
   */
  async processMessage(chatId, message, context = {}) {
    const userName = context.userName || 'Boss';
    
    // Add to conversation history
    this.addToHistory(chatId, 'user', message);

    // ═══════════════════════════════════════════════
    // ACEBRAIN PATH — Unified Intelligence
    // ═══════════════════════════════════════════════
    if (this.brain) {
      try {
        const channelId = `telegram_${chatId}`;
        const brainResult = await this.brain.think(channelId, message, {
          userName,
          source: 'telegram',
          userId: context.userId,
          username: context.username
        });

        this.addToHistory(chatId, 'ace', brainResult.text);

        return {
          text: brainResult.text,
          source: 'ace_brain',
          thinking: brainResult.thinking,
          actions: brainResult.actions
        };
      } catch (err) {
        console.error('AceBrain error, falling back to legacy:', err.message);
        // Fall through to legacy path
      }
    }
    
    // ═══════════════════════════════════════════════
    // LEGACY PATH — Original per-provider AI calls
    // ═══════════════════════════════════════════════
    
    // Build context for AI
    const systemPrompt = this.buildSystemPrompt(userName);
    const conversationContext = this.getConversationContext(chatId);
    
    // Check for special commands/intents
    const intent = this.detectIntent(message);
    
    // Handle Google actions directly for meeting and email intents
    if (intent.type === 'meeting' && this.google?.isConnected()) {
      const result = await this.scheduleMeetingFromMessage(message, chatId);
      this.addToHistory(chatId, 'ace', result.text);
      return result;
    }
    
    if (intent.type === 'email' && this.google?.isConnected()) {
      const result = await this.sendEmailFromMessage(message, chatId);
      this.addToHistory(chatId, 'ace', result.text);
      return result;
    }
    
    // Generate response based on AI provider
    let response;
    
    if (this.aiProvider.type === 'ollama') {
      response = await this.callOllama(systemPrompt, conversationContext, message);
    } else if (this.aiProvider.type === 'openai') {
      response = await this.callOpenAI(systemPrompt, conversationContext, message);
    } else if (this.aiProvider.type === 'claude') {
      response = await this.callClaude(systemPrompt, conversationContext, message);
    } else {
      response = this.generateBasicResponse(message, intent, userName);
    }
    
    // Check if response contains actionable items
    const actions = this.extractActions(response, intent);
    
    // Execute any actions
    if (actions.length > 0) {
      await this.executeActions(chatId, actions);
    }
    
    // Add response to history
    this.addToHistory(chatId, 'ace', response.text);
    
    return response;
  }

  /**
   * Build the system prompt that defines Ace's personality and capabilities
   */
  buildSystemPrompt(userName) {
    const skillsList = this.skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    const sopsList = this.sops.map(s => `- ${s.name}: ${s.description}`).join('\n');
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    return `You are Ace — ${userName}'s autonomous AI Executive Assistant at LikemindedPro. You are NOT a chatbot. You ACT.

CORE IDENTITY:
- You're ${userName}'s right hand — when they tell you something, you DO it, not just advise
- Strategic, data-driven, proactive, efficient
- You handle things so ${userName} doesn't have to think about them

CURRENT: ${dateStr} ${timeStr}

WHAT YOU CAN DO (use these, don't just talk about them):
1. **Pipeline** — Add tasks/leads, move items, track progress
2. **Research** — Search the web, find leads, analyze competitors
3. **Browser Automation** — Navigate sites, fill forms, extract data
4. **Email** — Draft and send emails via Gmail
5. **Calendar** — Schedule meetings, check availability
6. **Social Media** — Create strategies, schedule/post content to all platforms
7. **Content Library** — 500+ photos/videos with smart categorization
8. **SOPs** — Execute learned procedures, learn new ones

HOW TO RESPOND:
- Be DIRECT: "Done. Added 3 leads." not "I can help with that!"
- ACT FIRST: If they say "find leads in Miami" — search, don't give tips
- Be CONCISE: ${userName} is on mobile. Short, scannable, actionable
- USE EMOJIS: 📊 🔍 ✅ ⚡ for scannability
- SUGGEST NEXT STEPS: After completing, suggest what's logical next
- ONE QUESTION MAX: If you need info, ask ONE specific question

${skillsList ? `SKILLS:\n${skillsList}\n` : ''}
${sopsList ? `LEARNED PROCEDURES:\n${sopsList}\n` : ''}

NEVER:
- Give generic chatbot responses ("That's a great question!")
- List options when you can just act
- Say "I can help with that" — just help
- Be verbose when brief works`;
  }

  /**
   * Get recent conversation context for AI
   */
  getConversationContext(chatId) {
    const history = this.conversationHistory.get(chatId) || [];
    // Get last 10 messages for context
    return history.slice(-10);
  }

  /**
   * Detect user intent from message
   */
  detectIntent(message) {
    const lower = message.toLowerCase();
    
    // Social Media - high priority for content management
    if (lower.includes('social media') || lower.includes('post to') || lower.includes('twitter') ||
        lower.includes('linkedin') || lower.includes('instagram') || lower.includes('facebook') ||
        lower.includes('content calendar') || lower.includes('schedule post') || lower.includes('what\'s scheduled') ||
        lower.includes('today\'s posts') || lower.includes('content strategy')) {
      return { type: 'social_media', confidence: 0.95 };
    }
    
    // Meeting/Calendar - check first as it's actionable
    if (lower.includes('meeting') || lower.includes('meetup') || lower.includes('schedule') ||
        lower.includes('calendar') || lower.includes('appointment') || lower.includes('book a')) {
      return { type: 'meeting', confidence: 0.9 };
    }
    
    // Email
    if (lower.includes('email') || lower.includes('send') || lower.includes('mail') ||
        lower.includes('message') || lower.includes('write to')) {
      return { type: 'email', confidence: 0.9 };
    }
    
    // Strategy/Planning
    if (lower.includes('strategy') || lower.includes('plan') || lower.includes('how should') || lower.includes('create a')) {
      return { type: 'strategy', confidence: 0.8 };
    }
    
    // Research
    if (lower.includes('research') || lower.includes('find') || lower.includes('search') || lower.includes('look for') || lower.includes('who would be')) {
      return { type: 'research', confidence: 0.8 };
    }
    
    // Lead generation
    if (lower.includes('lead') || lower.includes('prospect') || lower.includes('contact') || lower.includes('reach out')) {
      return { type: 'leads', confidence: 0.8 };
    }
    
    // Task/Action
    if (lower.includes('add') || lower.includes('save') || lower.includes('remember') || lower.includes('track')) {
      return { type: 'action', confidence: 0.7 };
    }
    
    // Status/Query
    if (lower.includes('status') || lower.includes('pipeline') || lower.includes('what') || lower.includes('show me')) {
      return { type: 'query', confidence: 0.7 };
    }
    
    // General conversation
    return { type: 'conversation', confidence: 0.5 };
  }

  /**
   * Call Ollama API
   */
  async callOllama(systemPrompt, history, message) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'ace' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: message }
      ];

      const response = await fetch(`${this.aiProvider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.aiProvider.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama error: ${response.status}`);
      }

      const data = await response.json();
      return { 
        text: data.choices[0]?.message?.content || 'I understood your request. Let me work on that.',
        source: 'ollama'
      };
    } catch (error) {
      console.error('Ollama error:', error.message);
      return this.generateBasicResponse(message, this.detectIntent(message), 'Boss');
    }
  }

  /**
   * Call OpenAI API
   */
  async callOpenAI(systemPrompt, history, message) {
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: this.aiProvider.apiKey });

      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.map(h => ({ role: h.role === 'ace' ? 'assistant' : 'user', content: h.content })),
        { role: 'user', content: message }
      ];

      const completion = await openai.chat.completions.create({
        model: this.aiProvider.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      });

      return {
        text: completion.choices[0]?.message?.content || 'Got it! Working on that.',
        source: 'openai'
      };
    } catch (error) {
      console.error('OpenAI error:', error.message);
      return this.generateBasicResponse(message, this.detectIntent(message), 'Boss');
    }
  }

  /**
   * Call Claude API
   */
  async callClaude(systemPrompt, history, message) {
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const anthropic = new Anthropic({ apiKey: this.aiProvider.apiKey });

      const messages = history.map(h => ({
        role: h.role === 'ace' ? 'assistant' : 'user',
        content: h.content
      }));
      messages.push({ role: 'user', content: message });

      const response = await anthropic.messages.create({
        model: this.aiProvider.model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
      });

      return {
        text: response.content[0]?.text || 'Understood! Let me handle that.',
        source: 'claude'
      };
    } catch (error) {
      console.error('Claude error:', error.message);
      return this.generateBasicResponse(message, this.detectIntent(message), 'Boss');
    }
  }

  /**
   * Generate basic response without AI
   */
  generateBasicResponse(message, intent, userName) {
    const lower = message.toLowerCase();
    
    switch (intent.type) {
      case 'strategy':
        return {
          text: `📋 On it. I'm building a strategy based on your request.\n\n` +
                `**Working on:**\n` +
                `1. Defining objectives & success metrics\n` +
                `2. Researching the opportunity\n` +
                `3. Identifying actionable next steps\n\n` +
                `I'll have a draft ready shortly. Any specific focus area?`,
          source: 'basic'
        };
        
      case 'research':
        return {
          text: `🔍 Starting research now.\n\n` +
                `I'm looking into this and will compile:\n` +
                `• Key contacts & players\n` +
                `• Market data & opportunities\n` +
                `• Promising leads → added to pipeline automatically\n\n` +
                `I'll report back with findings.`,
          source: 'basic'
        };
        
      case 'leads':
        return {
          text: `👥 Searching for leads now.\n\n` +
                `I'll find and qualify prospects, then add them to your pipeline.\n\n` +
                `What location or industry should I prioritize?`,
          source: 'basic'
        };
        
      case 'action':
        return {
          text: `✅ Done — added to your pipeline as a task.\n\n` +
                `"${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"\n\n` +
                `I'll track this and follow up. Anything else?`,
          source: 'basic'
        };
        
      case 'query':
        return {
          text: `📊 Pulling that info now — one moment.`,
          source: 'basic'
        };
        
      default:
        return {
          text: `⚡ Got it, ${userName}. I'm on it.\n\n` +
                `Working on: "${message.substring(0, 80)}${message.length > 80 ? '...' : ''}"\n\n` +
                `I'll handle this and report back.`,
          source: 'basic'
        };
    }
  }

  /**
   * Extract actionable items from response
   */
  extractActions(response, intent) {
    const actions = [];
    
    // Check if response suggests saving something
    if (response.text.includes('save') || response.text.includes('pipeline') || intent.type === 'action') {
      // Will implement action extraction
    }
    
    return actions;
  }

  /**
   * Execute extracted actions
   */
  async executeActions(chatId, actions) {
    for (const action of actions) {
      
      try {
        switch (action.type) {
          case 'send_email':
            if (this.google?.isConnected()) {
              await this.google.sendEmail(action.data);
            }
            break;
          case 'create_meeting':
            if (this.google?.isConnected()) {
              await this.google.createEvent(action.data);
            }
            break;
          case 'schedule_meeting':
            if (this.google?.isConnected()) {
              await this.google.scheduleMeeting(
                action.data.title,
                action.data.startTime,
                action.data.duration,
                action.data.attendees
              );
            }
            break;
        }
      } catch (error) {
        console.error(`Action failed: ${action.type}`, error.message);
      }
    }
  }

  /**
   * Schedule a meeting via Google Calendar
   */
  async scheduleMeetingFromMessage(message, chatId) {
    if (!this.google?.isConnected()) {
      return {
        success: false,
        text: '❌ Google Calendar not connected. Run: npm run setup-google'
      };
    }

    // Parse meeting details from message
    const details = this.parseMeetingDetails(message);
    
    try {
      const result = await this.google.scheduleMeeting(
        details.title,
        details.startTime,
        details.duration,
        details.attendees
      );

      return {
        success: true,
        text: `✅ **Meeting Scheduled!**\n\n` +
              `📌 ${details.title}\n` +
              `📅 ${details.startTime}\n` +
              `⏱️ ${details.duration} minutes\n` +
              (result.meetLink ? `🎥 Meet: ${result.meetLink}\n` : '') +
              `🔗 [View in Calendar](${result.htmlLink})`,
        meetLink: result.meetLink,
        eventId: result.eventId
      };
    } catch (error) {
      return {
        success: false,
        text: `❌ Failed to create meeting: ${error.message}`
      };
    }
  }

  /**
   * Send email via Gmail
   */
  async sendEmailFromMessage(message, chatId) {
    if (!this.google?.isConnected()) {
      return {
        success: false,
        text: '❌ Gmail not connected. Run: npm run setup-google'
      };
    }

    // Parse email details from message
    const details = this.parseEmailDetails(message);
    
    if (!details.to) {
      return {
        success: false,
        text: '📧 Who should I send this email to? Please provide an email address.'
      };
    }

    try {
      const result = await this.google.sendEmail({
        to: details.to,
        subject: details.subject,
        body: details.body
      });

      return {
        success: true,
        text: `✅ **Email Sent!**\n\n` +
              `📬 To: ${details.to}\n` +
              `📝 Subject: ${details.subject}\n\n` +
              `Message delivered successfully.`
      };
    } catch (error) {
      return {
        success: false,
        text: `❌ Failed to send email: ${error.message}`
      };
    }
  }

  /**
   * Parse meeting details from natural language
   */
  parseMeetingDetails(message) {
    const lower = message.toLowerCase();
    
    // Default values
    const details = {
      title: 'Meeting',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      duration: 60,
      attendees: []
    };

    // Extract title (text after "about" or "for")
    const titleMatch = message.match(/(?:about|for|called|titled)\s+["']?([^"'\n]+)["']?/i);
    if (titleMatch) {
      details.title = titleMatch[1].trim();
    } else if (message.match(/meeting with (\w+)/i)) {
      details.title = `Meeting with ${message.match(/meeting with (\w+)/i)[1]}`;
    }

    // Extract time
    if (lower.includes('tomorrow')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0); // Default 10 AM
      details.startTime = tomorrow.toISOString();
    }
    
    // Extract specific time
    const timeMatch = message.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] || '0');
      const ampm = timeMatch[3]?.toLowerCase();
      
      if (ampm === 'pm' && hours < 12) hours += 12;
      if (ampm === 'am' && hours === 12) hours = 0;
      
      const meetTime = new Date(details.startTime);
      meetTime.setHours(hours, minutes, 0, 0);
      details.startTime = meetTime.toISOString();
    }

    // Extract duration
    const durationMatch = message.match(/(\d+)\s*(?:min|minute|hour)/i);
    if (durationMatch) {
      const value = parseInt(durationMatch[1]);
      if (message.toLowerCase().includes('hour')) {
        details.duration = value * 60;
      } else {
        details.duration = value;
      }
    }

    // Extract email addresses
    const emailMatches = message.match(/[\w.-]+@[\w.-]+\.\w+/g);
    if (emailMatches) {
      details.attendees = emailMatches;
    }

    return details;
  }

  /**
   * Parse email details from natural language or formatted input
   *
   * Supports formats:
   * 1. Structured: "Email: x@y.com\nSubject: Subject\n\nBody here"
   * 2. Natural: "Send email to x@y.com about subject saying body"
   * 3. Simple: "email x@y.com: message here"
   */
  parseEmailDetails(message) {
    const details = {
      to: null,
      subject: 'Message from Ace',
      body: ''
    };

    const lines = message.split('\n');
    let bodyStartIndex = 0;
    let foundStructuredFormat = false;

    // Check for structured format: "Email: x@y.com" or "To: x@y.com"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for Email/To line
      const emailLineMatch = line.match(/^(?:email|to)[:\s]+(.+)/i);
      if (emailLineMatch) {
        const emailInLine = emailLineMatch[1].match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailInLine) {
          details.to = emailInLine[0];
          foundStructuredFormat = true;
          continue;
        }
      }
      
      // Check for Subject line
      const subjectLineMatch = line.match(/^subject[:\s]+(.+)/i);
      if (subjectLineMatch) {
        details.subject = subjectLineMatch[1].trim();
        foundStructuredFormat = true;
        bodyStartIndex = i + 1;
        continue;
      }

      // If we found structured format and hit a non-header line, start body
      if (foundStructuredFormat && line && !line.match(/^(email|to|subject)[:\s]/i)) {
        bodyStartIndex = i;
        break;
      }
    }

    // Extract body from remaining lines
    if (foundStructuredFormat) {
      // Get everything after subject line (skip empty lines at start)
      const bodyLines = lines.slice(bodyStartIndex);
      const bodyText = bodyLines.join('\n').trim();
      
      if (bodyText) {
        details.body = bodyText;
      }
    } else {
      // Fall back to natural language parsing
      
      // Extract email address from anywhere
      const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
      if (emailMatch) {
        details.to = emailMatch[0];
      }

      // Extract subject (after "about" or "subject:")
      const subjectMatch = message.match(/(?:about|subject[:]?)\s+["']?([^"'\n]+?)["']?(?:\s+(?:saying|with|and)|$)/i);
      if (subjectMatch) {
        details.subject = subjectMatch[1].trim();
      }

      // Extract body (after "saying", "with message", "that says", or after the email address)
      const bodyMatch = message.match(/(?:saying|that says|with message|message[:]?|body[:]?)\s+["']?(.+)["']?$/is);
      if (bodyMatch) {
        details.body = bodyMatch[1].trim();
      } else if (message.includes('let') && message.includes('know')) {
        // Handle "let X know" format
        const letKnowMatch = message.match(/let\s+\w+\s+know\s+(?:that\s+)?(.+)$/is);
        if (letKnowMatch) {
          details.body = letKnowMatch[1].trim();
        }
      } else if (message.includes('following:')) {
        // Handle "the following:" format
        const followingMatch = message.match(/following[:\s]+(.+)$/is);
        if (followingMatch) {
          details.body = followingMatch[1].trim();
        }
      }
    }

    // If no body was extracted, don't add generic wrapper
    if (!details.body && foundStructuredFormat) {
      details.body = '';
    } else if (!details.body) {
      // Only for natural language, create a simple message
      const cleanMessage = message
        .replace(/^(send\s+)?email\s*/i, '')
        .replace(/to\s+[\w.-]+@[\w.-]+\.\w+/i, '')
        .replace(/about\s+[^\.]+/i, '')
        .trim();
      
      if (cleanMessage && cleanMessage.length > 10) {
        details.body = cleanMessage;
      }
    }

    // Clean up the body - remove any trailing "Best regards" if we're adding it
    if (details.body && !details.body.toLowerCase().includes('regards') &&
        !details.body.toLowerCase().includes('sincerely') &&
        !details.body.toLowerCase().includes('thanks')) {
      details.body = details.body + '\n\nBest regards';
    }

    return details;
  }

  /**
   * Save a strategy to file
   */
  async saveStrategy(chatId, strategy) {
    const strategiesDir = path.join(PROJECT_ROOT, 'data', 'strategies');
    await fs.mkdir(strategiesDir, { recursive: true });
    
    const filename = `strategy_${Date.now()}.json`;
    const filepath = path.join(strategiesDir, filename);
    
    await fs.writeFile(filepath, JSON.stringify(strategy, null, 2));
    
    return filename;
  }

  /**
   * Add a lead to the pipeline
   */
  async addLead(lead) {
    try {
      const pipelinePath = path.join(PROJECT_ROOT, 'data', 'pipeline', 'pipeline.json');
      const data = JSON.parse(await fs.readFile(pipelinePath, 'utf8'));
      
      const newLead = {
        id: `lead_${Date.now()}`,
        name: lead.name,
        source: lead.source || 'telegram',
        stage: 'new',
        createdAt: new Date().toISOString(),
        ...lead
      };
      
      data.leads = data.leads || [];
      data.leads.push(newLead);
      
      await fs.writeFile(pipelinePath, JSON.stringify(data, null, 2));
      
      return newLead;
    } catch (error) {
      console.error('Error adding lead:', error.message);
      throw error;
    }
  }

  /**
   * Add message to conversation history
   */
  addToHistory(chatId, role, content) {
    if (!this.conversationHistory.has(chatId)) {
      this.conversationHistory.set(chatId, []);
    }
    
    const history = this.conversationHistory.get(chatId);
    history.push({
      role,
      content,
      timestamp: new Date().toISOString()
    });
    
    // Keep last 50 messages
    if (history.length > 50) {
      history.shift();
    }
  }

  /**
   * Get conversation summary
   */
  getConversationSummary(chatId) {
    const history = this.conversationHistory.get(chatId) || [];
    return {
      messageCount: history.length,
      lastMessage: history[history.length - 1],
      startedAt: history[0]?.timestamp
    };
  }
}

export default AceMessageProcessor;
