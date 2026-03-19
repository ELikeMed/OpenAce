/**
 * OpenAce AI Provider Manager
 * Connects to multiple AI providers using existing subscriptions
 * No expensive pay-per-use APIs - use what you already have!
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AIProviderManager {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = null;
    this.activeProvider = null;
    this.providers = {};

    // Token usage tracking — warnings instead of hard limits
    this.usage = {
      gemini: { requestsThisMinute: 0, tokensThisMinute: 0, lastReset: Date.now() },
    };
    this.eventBus = null; // Set by OpenAce after init
  }

  async initialize() {
    // Load configuration (handle missing config gracefully for first run)
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      this.config = JSON.parse(configData);
    } catch (err) {
      console.warn('⚠️ No config file found. OpenAce will start in setup mode.');
      this.config = { ai_providers: { active_provider: 'gemini', providers: {} } };
      this.needsConfiguration = true;
      return this;
    }

    // Initialize enabled providers (skip if API key is empty)
    const providerConfigs = this.config.ai_providers.providers;

    if (providerConfigs.claude?.enabled && providerConfigs.claude.api_key) {
      this.providers.claude = new Anthropic({
        apiKey: providerConfigs.claude.api_key,
      });
    }

    if (providerConfigs.openai?.enabled && providerConfigs.openai.api_key) {
      this.providers.openai = new OpenAI({
        apiKey: providerConfigs.openai.api_key,
      });
    }

    if (providerConfigs.gemini?.enabled && providerConfigs.gemini.api_key) {
      this.providers.gemini = new GoogleGenerativeAI(
        providerConfigs.gemini.api_key
      );
    }

    if (providerConfigs.ollama?.enabled) {
      this.providers.ollama = new OpenAI({
        baseURL: providerConfigs.ollama.base_url,
        apiKey: 'ollama', // Ollama doesn't need real API key
      });
    }

    // Set active provider
    this.activeProvider = this.config.ai_providers.active_provider;

    // Check if any provider is actually configured
    if (Object.keys(this.providers).length === 0) {
      console.warn('⚠️ No AI providers configured. Complete the onboarding wizard at http://localhost:3333 to get started.');
      this.needsConfiguration = true;
      return this;
    }

    // ─── HEALTH CHECK: Verify the active provider is reachable ───
    await this.verifyActiveProvider();

    console.log(`✅ OpenAce initialized with ${this.activeProvider}`);
    return this;
  }

  /**
   * Send a message to OpenAce and get a response
   */
  /**
   * Detect if a task is "heavy" and should be routed to Gemini instead of Ollama.
   * Heavy tasks involve desktop automation, complex research, or multi-step computer control.
   */
  isHeavyTask(messages) {
    if (!this.providers.gemini) return false;
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return false;
    const text = (lastUserMessage.content || '').toLowerCase();
    const heavyPatterns = [
      /take (full )?control/,
      /open (up )?(google|chrome|browser|a website|the browser)/,
      /browse to|navigate to|go to (the )?(website|page|url)/,
      /search (google|the web|online) for/,
      /act like a human and/,
      /screenshot (the |my )?desktop/,
      /click (on |the )?/,
      /type (in |into )?/,
      /scroll (down|up|through)/,
      /fill (out|in) (the )?form/,
      /download (the |a )?file/,
      /research .{20,}/,  // Long research requests
    ];
    return heavyPatterns.some(p => p.test(text));
  }

  async chat(messages, options = {}) {
    // Auto-route heavy tasks (desktop control, browser automation) to Gemini if available
    let provider = options.provider || this.activeProvider;
    if (provider === 'ollama' && !options.provider && this.isHeavyTask(messages)) {
      console.log('[AIProviderManager] Heavy task detected — routing to Gemini');
      provider = 'gemini';
    }

    if (!this.providers[provider]) {
      // If routed provider isn't available, fall back to active
      provider = this.activeProvider;
    }

    // Extract live context for the system prompt
    const liveContext = options.liveContext || '';

    try {
      switch (provider) {
        case 'claude':
          return await this.chatClaude(messages, { ...options, liveContext });
        case 'openai':
          return await this.chatOpenAI(messages, { ...options, liveContext });
        case 'gemini':
          return await this.chatGemini(messages, { ...options, liveContext });
        case 'ollama':
          return await this.chatOllama(messages, { ...options, liveContext });
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Error with ${provider}:`, error.message);
      throw error;
    }
  }

  /**
   * Send a message and an image to the Vision AI provider.
   */
  async chatWithVision(prompt, imageBase64, options = {}) {
    // Check task routing first, then fall back to active provider
    let provider = options.provider || this.getProviderForTask('vision');
    // If still on Ollama, prefer Gemini for vision (better at coordinate detection)
    if (provider === 'ollama' && this.providers.gemini) {
      provider = 'gemini';
    }

    if (!this.providers[provider]) {
      throw new Error(`Provider ${provider} is not enabled`);
    }

    try {
      switch (provider) {
        case 'openai':
          return await this.chatOpenAIWithVision(prompt, imageBase64, options);
        case 'ollama':
          return await this.chatOllamaWithVision(prompt, imageBase64, options);
        case 'gemini':
          return await this.chatGeminiWithVision(prompt, imageBase64, options);
        case 'claude':
          return await this.chatClaudeWithVision(prompt, imageBase64, options);
        default:
          throw new Error(`Vision is not supported for provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Vision error with ${provider}:`, error.message);
      throw error;
    }
  }

  async chatClaude(messages, options) {
    const config = this.config.ai_providers.providers.claude;
    const systemPrompt = options.systemPrompt || this.getSystemPrompt(options.liveContext || '');
    
    const response = await this.providers.claude.messages.create({
      model: config.model,
      max_tokens: options.maxTokens || 4096,
      messages: messages,
      system: systemPrompt,
    });

    return {
      content: response.content[0].text,
      provider: 'claude',
      model: config.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      }
    };
  }

  async chatClaudeWithVision(prompt, imageBase64, options = {}) {
    const config = this.config.ai_providers.providers.claude;
    const model = config.vision_model || config.model || 'claude-opus-4-6';

    // Accept raw base64 or data URL — strip prefix if present
    const base64Data = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;

    const response = await this.providers.claude.messages.create({
      model,
      max_tokens: options.maxTokens || 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: base64Data }
          },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const content = response.content[0]?.text || '';
    return {
      content,
      text: content,
      provider: 'claude',
      model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      }
    };
  }

  async chatOllamaWithVision(prompt, imageBase64, options) {
    const config = this.config.ai_providers.providers.ollama;
    // Ensure we use a vision-capable model
    const model = config.vision_model || 'llava';

    // Ollama's OpenAI-compatible API expects the image in a slightly different format
    const base64Data = imageBase64.split(',')[1];

    const response = await this.providers.ollama.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      max_tokens: options.maxTokens || 1024,
      // NOTE: Do NOT use response_format: { type: 'json_object' } here.
      // llava does not support structured output and it crashes the call.
    });

    let content = response.choices[0].message.content;

    // --- Defensive JSON parsing ---
    try {
      // First, try to parse directly
      JSON.parse(content);
    } catch {
      // If parsing fails, try to extract from a code block
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch && jsonMatch[1]) {
        content = jsonMatch[1];
        try {
          // Verify the extracted content is valid JSON
          JSON.parse(content);
        } catch (e) {
          throw new Error('AI returned invalid JSON inside the code block.');
        }
      } else {
        // If no code block, try to find ANY valid JSON in the string
        const looseJsonMatch = content.match(/\{[\s\S]*\}/);
        if (looseJsonMatch && looseJsonMatch[0]) {
          content = looseJsonMatch[0];
          try {
            // Verify the extracted content is valid JSON
            JSON.parse(content);
          } catch (e) {
            throw new Error('AI returned a string containing invalid JSON.');
          }
        } else {
          throw new Error('AI response was not valid JSON and no JSON could be extracted.');
        }
      }
    }

    return {
      content: content,
      provider: 'ollama',
      model: model,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      }
    };
  }

  async chatOpenAIWithVision(prompt, imageBase64, options) {
    const config = this.config.ai_providers.providers.openai;
    // Ensure we use a vision-capable model
    const model = config.vision_model || 'gpt-4o';

    const response = await this.providers.openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: imageBase64,
              },
            },
          ],
        },
      ],
      max_tokens: options.maxTokens || 1024,
    });

    return {
      content: response.choices[0].message.content,
      provider: 'openai',
      model: model,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
      }
    };
  }

  async chatGeminiWithVision(prompt, imageBase64, options) {
  const config = this.config.ai_providers.providers.gemini;
  // Use the configured model (gemini-2.5-flash supports vision natively)
  // Fallback chain: vision_model → main model → gemini-2.5-flash
  const modelName = config.vision_model || config.model || 'gemini-2.5-flash';
  const model = this.providers.gemini.getGenerativeModel({ model: modelName });
  
  const mimeTypeMatch = imageBase64.match(/data:(image\/\w+);base64,/);
  if (!mimeTypeMatch) {
  throw new Error('Invalid image data URL format.');
  }
  const mimeType = mimeTypeMatch[1];
  const base64Data = imageBase64.split(',')[1];
  
  const imagePart = {
  inlineData: {
  data: base64Data,
  mimeType,
  },
  };
  
  const result = await model.generateContent([prompt, imagePart]);
  const response = await result.response;
  const text = response.text();
  
  return {
  content: text,
  provider: 'gemini',
  model: modelName,
  usage: { input_tokens: 0, output_tokens: 0 }, // Gemini API doesn't provide token counts for vision yet
  };
  }
  
  async chatOpenAI(messages, options) {
  const config = this.config.ai_providers.providers.openai;
    const systemPrompt = options.systemPrompt || this.getSystemPrompt(options.liveContext || '');
    
    const response = await this.providers.openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      max_tokens: options.maxTokens || 4096,
    });

    return {
      content: response.choices[0].message.content,
      provider: 'openai',
      model: config.model,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
      }
    };
  }

  async chatGemini(messages, options) {
    const config = this.config.ai_providers.providers.gemini;
    const systemPrompt = options.systemPrompt || this.getSystemPrompt(options.liveContext || '');
    
    // Get model - don't use systemInstruction to avoid SDK compatibility issues
    const model = this.providers.gemini.getGenerativeModel({ model: config.model });

    // Build the full prompt: prepend system prompt to the user's message
    // This avoids SDK-specific systemInstruction format issues
    const validMessages = messages.filter(msg => msg.role !== 'system');
    
    if (validMessages.length === 0) {
      throw new Error('No valid messages for Gemini');
    }

    // Prepend system prompt to the first user message
    const fullMessages = validMessages.map((msg, i) => {
      if (i === 0 && systemPrompt) {
        return { ...msg, content: `${systemPrompt}\n\n${msg.content}` };
      }
      return msg;
    });

    try {
      // For single messages, use generateContent directly
      if (fullMessages.length === 1) {
        const result = await model.generateContent(fullMessages[0].content);
        const response = result.response;
        const text = typeof response.text === 'function' ? response.text() : String(response.text || '');
        
        return {
          content: text,
          provider: 'gemini',
          model: config.model,
          usage: { input_tokens: 0, output_tokens: 0 }
        };
      }

      // For multi-turn conversations, use chat
      const history = fullMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(msg.content || '') }]
      }));
      
      const chat = model.startChat({ history });
      const lastMessage = fullMessages[fullMessages.length - 1];
      const result = await chat.sendMessage(String(lastMessage.content || ''));
      const response = result.response;
      const text = typeof response.text === 'function' ? response.text() : String(response.text || '');

      return {
        content: text,
        provider: 'gemini',
        model: config.model,
        usage: { input_tokens: 0, output_tokens: 0 }
      };
    } catch (geminiError) {
      console.error('[Gemini] API error details:', geminiError.message);
      throw geminiError;
    }
  }

  /**
   * Gemini with function calling (tool use).
   * Returns raw response + functionCalls + chat object for multi-turn tool loops.
   * This is the first provider adapter — OpenAI/Claude adapters can be added later.
   */
  async chatGeminiWithTools(messages, options) {
    const config = this.config.ai_providers.providers.gemini;
    const systemPrompt = options.systemPrompt || '';
    const model = this.providers.gemini.getGenerativeModel({
      model: config.model,
      tools: options.tools || [],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 65536,  // No output limit — let Ace think and respond fully
      },
      ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}),
    });

    const history = [];
    for (const msg of messages.slice(0, -1)) {
      if (msg.role === 'system') continue;
      history.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(msg.content || '') }]
      });
    }

    const lastMessage = messages[messages.length - 1];
    const lastText = String(lastMessage.content || '');

    const chat = model.startChat({ history });

    const result = await chat.sendMessage(lastText);
    const response = result?.response;

    if (!response) {
      console.error('[AIProvider] Gemini returned null/undefined response');
      return { response: null, text: '', functionCalls: [], provider: 'gemini', model: config.model, chat };
    }

    // Extract text safely — functionCall responses may not have text()
    let text = '';
    try {
      text = typeof response.text === 'function' ? response.text() : String(response.text || '');
    } catch (e) {
      // response.text() throws if the response is purely function calls
    }

    // Track usage and emit warnings (never block)
    try { this._trackGeminiUsage(response); } catch (e) { /* usage tracking should never block */ }

    return {
      response,
      text,
      functionCalls: response.functionCalls?.() || [],
      provider: 'gemini',
      model: config.model,
      chat,
    };
  }

  /**
   * Track Gemini API usage and emit warnings when approaching limits.
   * NEVER blocks or limits — just warns so the user knows.
   */
  _trackGeminiUsage(response) {
    const now = Date.now();
    const usage = this.usage.gemini;

    // Reset counter every minute
    if (now - usage.lastReset > 60000) {
      usage.requestsThisMinute = 0;
      usage.tokensThisMinute = 0;
      usage.lastReset = now;
    }

    usage.requestsThisMinute++;

    // Extract token count from response metadata if available
    try {
      const meta = response.usageMetadata;
      if (meta) {
        usage.tokensThisMinute += (meta.totalTokenCount || meta.candidatesTokenCount || 0);
      }
    } catch { /* metadata not always available */ }

    // Gemini free tier: 15 RPM, 1M TPM, 1500 RPD
    // Warn at 80% of per-minute limits
    if (usage.requestsThisMinute >= 12 && usage.requestsThisMinute % 3 === 0) {
      const warning = `⚠️ Heads up: ${usage.requestsThisMinute} Gemini requests this minute (free tier allows 15/min). Ace will keep working but responses may slow down if the limit is hit.`;
      console.warn('[AIProvider]', warning);
      if (this.eventBus) {
        this.eventBus.emit('ai:usage:warning', { provider: 'gemini', message: warning, requestsThisMinute: usage.requestsThisMinute });
      }
    }
  }

  /**
   * Provider-agnostic tool-calling entry point.
   * Delegates to the appropriate provider adapter based on config.
   * Currently only Gemini is implemented — OpenAI/Claude adapters ~50 lines each.
   */
  async chatWithTools(messages, options) {
    // For now, always use Gemini for tool calling (free tier, best function calling support)
    if (!this.providers.gemini) {
      throw new Error('Gemini provider not configured. Tool-calling requires Gemini (free tier available).');
    }
    return this.chatGeminiWithTools(messages, options);
  }

  async chatOllama(messages, options) {
    const config = this.config.ai_providers.providers.ollama;
    // Support empty systemPrompt (e.g., IntentRouter classification calls)
    const systemPrompt = 'systemPrompt' in options ? options.systemPrompt : this.getSystemPrompt(options.liveContext || '');

    // Build messages array — skip system message if systemPrompt is empty/falsy
    const allMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages
    ];

    const response = await this.providers.ollama.chat.completions.create({
      model: config.model,
      messages: allMessages,
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
    });

    return {
      content: response.choices[0].message.content,
      provider: 'ollama',
      model: config.model,
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      }
    };
  }

  /**
   * Get OpenAce's system prompt with personality
   */
  getSystemPrompt(liveContext = '') {
    const personality = this.config.personality || {};
    const name = personality.name || 'Ace';
    const role = personality.role || 'AI Executive Assistant';
    const traits = Array.isArray(personality.traits) ? personality.traits.join(', ') : 'proactive, intelligent, action-oriented';
    const commStyle = personality.communication_style || 'Clear, concise, and actionable';
    
    return `You are ${name} — not a chatbot, but an autonomous AI Executive Assistant who DOES things.

IDENTITY:
- Name: ${name}
- Role: ${role} for LikemindedPro
- Traits: ${traits}
- Communication: ${commStyle}
- You are the user's right hand. When they tell you something, you ACT — not just advise.

CORE PRINCIPLE — ACT, DON'T JUST TALK:
You are fundamentally different from a chatbot. When the user says "find me leads in Miami", you don't say "Here are some tips for finding leads." You say "On it — I'm searching for leads in Miami now" and trigger the action. When they say "add this to the pipeline", you actually add it. When they say "draft an email", you draft it and prepare to send.

NEVER respond with generic advice when you can take direct action. If you CAN do it, DO it. If you need clarification first, ask ONE specific question then act.

YOUR CAPABILITIES (things you can actually DO):
1. **Pipeline Management** — Add tasks, add leads, move items between stages, track progress
2. **Research** — Search the web, analyze competitors, find leads, gather market data
3. **Browser Automation** — Navigate websites, fill forms, extract data, take screenshots
4. **Email** — Draft and send emails via Gmail (when connected)
5. **Calendar** — Schedule meetings, check availability (when connected)
6. **Content & Social Media** — Create strategies, schedule posts, manage content library
7. **Code & Files** — Write code, edit files, create documents, build features
8. **SOPs** — Execute learned procedures automatically, learn new ones from instructions
9. **Knowledge Base** — Remember information, recall past conversations, build institutional knowledge

ACTION TAGS — When you want to execute an action, include these tags in your response:
- [ACTION:add_task:{"title":"Task name","priority":"high"}] — Add a task to pipeline
- [ACTION:add_lead:{"name":"Name","company":"Co","source":"research"}] — Add a lead
- [ACTION:move_task:{"taskId":"id","stage":"in_progress"}] — Move a task
- [ACTION:move_lead:{"leadId":"id","stage":"contacted"}] — Move a lead
- [ACTION:research:{"query":"search terms","type":"web"}] — Start a web research task
- [ACTION:save_knowledge:{"topic":"topic","content":"what to remember"}] — Save information
- [ACTION:create_strategy:{"name":"Strategy name","type":"marketing","content":"..."}] — Save a strategy
- [ACTION:browse:{"url":"https://...","task":"what to do there"}] — Automate browser action

You can include multiple ACTION tags in one response. The system will execute them and show results.

HOW TO RESPOND:
1. **Be direct** — "I'll handle that" not "I can help you with that"
2. **Take action immediately** — Include ACTION tags whenever you're doing something
3. **Report results** — "Done. Added 3 leads to pipeline" not "You could try adding leads"
4. **Be proactive** — Notice things. "I see your pipeline has 5 leads stuck in 'New'. Want me to start reaching out?"
5. **Remember context** — Reference past conversations, track ongoing projects
6. **Think ahead** — After completing a task, suggest the logical next step
7. **Be concise but complete** — Executive-level communication, no fluff
8. **Use formatting** — Bullet points, bold for emphasis, emojis for scannability

EXECUTIVE DOMAINS:
- **CMO**: Marketing strategy, campaigns, social media, lead gen, analytics, content
- **CTO**: Code, architecture, tech decisions, security, deployments, debugging
- **COO**: Operations, processes, resource planning, KPIs, efficiency, workflow

${liveContext}

CRITICAL RULES:
- NEVER say "I can't do that" if the capability exists above — DO it
- NEVER give generic chatbot responses like "That's a great question!" or "Here are some tips"
- ALWAYS bias toward action over discussion
- When unsure what the user wants, ask ONE clarifying question, don't give a menu of options
- You are an EXECUTIVE assistant — you handle things so the boss doesn't have to
- Treat every message as a potential work order, not a conversation starter`;
  }

  /**
   * Verify the active provider is reachable at startup
   * Falls back to another enabled provider if the primary is down
   */
  async verifyActiveProvider() {
    // Verify Gemini connectivity (most common provider)
    if (this.providers.gemini) {
      try {
        const config = this.config.ai_providers.providers.gemini;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        // Lightweight test: list models endpoint (minimal token usage)
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${config.api_key}&pageSize=1`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        if (resp.ok) {
          console.log(`✅ Gemini API is reachable (model: ${config.model || 'gemini-2.5-flash'})`);
        } else if (resp.status === 400 || resp.status === 403) {
          console.warn(`⚠️ Gemini API key issue (HTTP ${resp.status}). Check your API key at https://aistudio.google.com/apikey`);
        } else {
          console.warn(`⚠️ Gemini API returned HTTP ${resp.status}. API calls may fail.`);
        }
      } catch (err) {
        const msg = err.name === 'AbortError' ? 'timed out after 8 seconds' : err.message;
        console.warn(`⚠️ Cannot reach Gemini API: ${msg}`);
        console.warn('   Check your internet connection and firewall settings.');
        console.warn('   The domain generativelanguage.googleapis.com must be accessible on port 443.');
        if (process.platform === 'win32') {
          console.warn('   Windows users: check Windows Firewall and any VPN/proxy settings.');
          console.warn('   Run this in PowerShell to test: Invoke-WebRequest -Uri "https://generativelanguage.googleapis.com" -UseBasicParsing');
        }
      }
    }

    if (this.activeProvider === 'ollama') {
      const baseUrl = this.config.ai_providers.providers.ollama.base_url || 'http://localhost:11434/v1';
      const healthUrl = baseUrl.replace('/v1', '');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(healthUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log(`✅ Ollama is reachable at ${healthUrl}`);
      } catch (err) {
        console.warn(`⚠️ Ollama is NOT reachable at ${healthUrl}: ${err.message}`);
        console.warn('   Make sure Ollama is running: ollama serve');
        
        // Try to fall back to another enabled provider
        const fallbackOrder = ['openai', 'claude', 'gemini'];
        for (const fallback of fallbackOrder) {
          if (this.providers[fallback]) {
            console.warn(`🔄 Falling back to ${fallback} provider`);
            this.activeProvider = fallback;
            return;
          }
        }
        console.warn('⚠️ No fallback providers available. AI calls will fail until Ollama is started.');
      }
    }
  }

  /**
   * Switch active AI provider
   */
  async switchProvider(providerName) {
    if (!this.providers[providerName]) {
      throw new Error(`Provider ${providerName} is not available or enabled`);
    }
    
    this.activeProvider = providerName;
    this.config.ai_providers.active_provider = providerName;
    
    // Save updated config
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2)
    );
    
    console.log(`✅ Switched to ${providerName}`);
    return providerName;
  }

  /**
   * Get current provider info
   */
  getProviderInfo() {
    return {
      active: this.activeProvider,
      available: Object.keys(this.providers),
      config: this.config.ai_providers.providers[this.activeProvider]
    };
  }

  /**
   * Get UI-friendly status for all providers (for Settings page)
   */
  getProvidersStatus() {
    const providers = this.config.ai_providers?.providers || {};
    const status = {};
    for (const [name, cfg] of Object.entries(providers)) {
      status[name] = {
        enabled: !!cfg.enabled,
        active: name === this.activeProvider,
        connected: !!this.providers[name],
        model: cfg.model || '',
        visionModel: cfg.vision_model || '',
        hasKey: !!(cfg.api_key && cfg.api_key.length > 0),
        maskedKey: cfg.api_key ? cfg.api_key.slice(0, 6) + '...' + cfg.api_key.slice(-4) : '',
        baseUrl: cfg.base_url || '',
      };
    }
    return status;
  }

  /**
   * Update config for a single provider and reinitialize it at runtime.
   * Accepts { api_key, model, vision_model, enabled, base_url }.
   */
  async updateProviderConfig(providerName, updates) {
    if (!this.config.ai_providers.providers[providerName]) {
      throw new Error(`Unknown provider: ${providerName}`);
    }

    const cfg = this.config.ai_providers.providers[providerName];

    // Merge updates
    if (updates.api_key !== undefined) cfg.api_key = updates.api_key;
    if (updates.model !== undefined) cfg.model = updates.model;
    if (updates.vision_model !== undefined) cfg.vision_model = updates.vision_model;
    if (updates.enabled !== undefined) cfg.enabled = updates.enabled;
    if (updates.base_url !== undefined) cfg.base_url = updates.base_url;

    // Remove old SDK client
    delete this.providers[providerName];

    // Reinitialize if enabled
    if (cfg.enabled) {
      try {
        switch (providerName) {
          case 'claude':
            if (cfg.api_key) this.providers.claude = new Anthropic({ apiKey: cfg.api_key });
            break;
          case 'openai':
            if (cfg.api_key) this.providers.openai = new OpenAI({ apiKey: cfg.api_key });
            break;
          case 'gemini':
            if (cfg.api_key) this.providers.gemini = new GoogleGenerativeAI(cfg.api_key);
            break;
          case 'ollama':
            this.providers.ollama = new OpenAI({
              baseURL: cfg.base_url || 'http://localhost:11434/v1',
              apiKey: 'ollama',
            });
            break;
        }
      } catch (e) {
        console.error(`Failed to reinitialize ${providerName}:`, e.message);
      }
    }

    // If active provider was disabled, fall back
    if (this.activeProvider === providerName && !this.providers[providerName]) {
      const fallback = Object.keys(this.providers)[0];
      if (fallback) {
        this.activeProvider = fallback;
        this.config.ai_providers.active_provider = fallback;
        console.log(`Active provider ${providerName} disabled, fell back to ${fallback}`);
      }
    }

    // Save config to disk
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    console.log(`✅ Updated ${providerName} config`);
  }

  // ═══════════════════════════════════════════════════════
  // PER-TASK PROVIDER ROUTING
  // ═══════════════════════════════════════════════════════

  /**
   * Get the provider assigned to a specific task type.
   * Returns the assigned provider if it's connected, otherwise falls back to activeProvider.
   * Task types: 'code', 'vision', 'research'
   */
  getProviderForTask(taskType) {
    const routing = this.config.ai_providers?.task_routing || {};
    const assigned = routing[taskType];
    if (assigned && this.providers[assigned]) return assigned;
    // Code tasks default to Gemini — Ollama 7B is too weak for quality code generation
    if (taskType === 'code' && this.providers.gemini) return 'gemini';
    return this.activeProvider;
  }

  /**
   * Get current task routing config (for Settings UI).
   */
  getTaskRouting() {
    return this.config.ai_providers?.task_routing || {};
  }

  /**
   * Save per-task provider routing preferences.
   * Accepts { code: 'claude', vision: 'gemini', research: null }
   */
  async setTaskRouting(routing) {
    if (!this.config.ai_providers.task_routing) {
      this.config.ai_providers.task_routing = {};
    }
    for (const [task, provider] of Object.entries(routing)) {
      this.config.ai_providers.task_routing[task] = provider || null;
    }
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
    console.log('✅ Updated task routing:', this.config.ai_providers.task_routing);
  }
}
