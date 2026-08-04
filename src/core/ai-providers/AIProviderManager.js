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

  async initialize(configOverride) {
    // Accept config as an object (used by @openace/embed SDK)
    if (configOverride) {
      this.config = configOverride;
    } else {
      // Load configuration from file (handle missing config gracefully for first run)
      try {
        const configData = await fs.readFile(this.configPath, 'utf-8');
        this.config = JSON.parse(configData);
      } catch (err) {
        console.warn('⚠️ No config file found. OpenAce will start in setup mode.');
        this.config = { ai_providers: { active_provider: '', providers: {} } };
        this.needsConfiguration = true;
        return this;
      }
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

    if (providerConfigs.kimi?.enabled && providerConfigs.kimi.api_key) {
      this.providers.kimi = new OpenAI({
        baseURL: 'https://api.moonshot.cn/v1',
        apiKey: providerConfigs.kimi.api_key,
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
   * Detect if a task is "heavy" and should be routed away from Ollama.
   * Heavy tasks involve desktop automation, complex research, or multi-step computer control.
   * Returns a capable provider name, or null if no upgrade needed.
   */
  _getHeavyTaskProvider(messages) {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return null;
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
    if (!heavyPatterns.some(p => p.test(text))) return null;
    // Route to the best available non-Ollama provider
    for (const p of ['gemini', 'claude', 'openai', 'kimi']) {
      if (this.providers[p]) return p;
    }
    return null;
  }

  async chat(messages, options = {}) {
    // Auto-route heavy tasks away from Ollama to a capable provider
    let provider = options.provider || this.activeProvider;
    if (provider === 'ollama' && !options.provider) {
      const heavyProvider = this._getHeavyTaskProvider(messages);
      if (heavyProvider) {
        provider = heavyProvider;
      }
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
        case 'kimi':
          return await this.chatKimi(messages, { ...options, liveContext });
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
    // If still on Ollama, route to a vision-capable provider
    if (provider === 'ollama') {
      for (const p of ['gemini', 'claude', 'openai']) {
        if (this.providers[p]) { provider = p; break; }
      }
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
   * Routes to the active provider's tool-calling adapter.
   */
  async chatWithTools(messages, options) {
    // Route to the active provider's tool-calling adapter
    const provider = this.activeProvider;
    if (provider === 'claude' && this.providers.claude) return this.chatClaudeWithTools(messages, options);
    if (provider === 'openai' && this.providers.openai) return this.chatOpenAIWithTools(messages, options);
    if (provider === 'gemini' && this.providers.gemini) return this.chatGeminiWithTools(messages, options);
    if (provider === 'ollama' && this.providers.ollama) return this.chatOllamaWithTools(messages, options);
    if (provider === 'kimi' && this.providers.kimi) return this.chatKimiWithTools(messages, options);
    // Fallback — try best available
    if (this.providers.gemini) return this.chatGeminiWithTools(messages, options);
    if (this.providers.claude) return this.chatClaudeWithTools(messages, options);
    if (this.providers.openai) return this.chatOpenAIWithTools(messages, options);
    if (this.providers.kimi) return this.chatKimiWithTools(messages, options);
    if (this.providers.ollama) return this.chatOllamaWithTools(messages, options);
    throw new Error('No AI provider configured. Add a Gemini, Claude, or OpenAI API key in Settings.');
  }

  // ═══════════════════════════════════════════════════════
  // CLAUDE TOOL-CALLING ADAPTER
  // ═══════════════════════════════════════════════════════

  /**
   * Convert Gemini tool format to Claude tool format.
   * Gemini: [{ functionDeclarations: [{ name, description, parameters: { type: 'OBJECT', properties: { x: { type: 'STRING' } } } }] }]
   * Claude: [{ name, description, input_schema: { type: 'object', properties: { x: { type: 'string' } } } }]
   */
  _convertToolsForClaude(geminiTools) {
    const declarations = geminiTools?.[0]?.functionDeclarations || [];
    return declarations.map(t => ({
      name: t.name,
      description: t.description || '',
      input_schema: this._convertGeminiSchemaToJson(t.parameters || {}),
    }));
  }

  /** Recursively convert Gemini schema types (uppercase) to JSON Schema (lowercase). */
  _convertGeminiSchemaToJson(schema) {
    if (!schema || typeof schema !== 'object') return {};
    const result = {};
    if (schema.type) result.type = schema.type.toLowerCase();
    if (schema.description) result.description = schema.description;
    if (schema.required) result.required = schema.required;
    if (schema.enum) result.enum = schema.enum;
    if (schema.properties) {
      result.properties = {};
      for (const [key, val] of Object.entries(schema.properties)) {
        result.properties[key] = this._convertGeminiSchemaToJson(val);
      }
    }
    if (schema.items) result.items = this._convertGeminiSchemaToJson(schema.items);
    return result;
  }

  /**
   * Claude with function calling (tool use).
   * Returns the same interface as chatGeminiWithTools:
   *   { response, text, functionCalls: [{name, args}], provider, model, chat }
   * where chat.sendMessage(toolResults) accepts Gemini-format tool results.
   */
  async chatClaudeWithTools(messages, options) {
    const config = this.config.ai_providers.providers.claude;
    const systemPrompt = options.systemPrompt || '';
    const claudeTools = this._convertToolsForClaude(options.tools);
    const model = config.model || 'claude-sonnet-4-20250514';

    // Build Claude messages from conversation history
    const claudeMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      }));

    const response = await this.providers.claude.messages.create({
      model,
      max_tokens: 8192,
      system: systemPrompt,
      tools: claudeTools,
      messages: claudeMessages,
    });

    // Parse Claude response into Gemini-compatible format
    const { text, functionCalls, toolUseBlocks } = this._parseClaudeToolResponse(response);

    // Create stateful chat wrapper that mimics Gemini's chat.sendMessage()
    const conversationHistory = [...claudeMessages];
    // Add assistant response to history
    conversationHistory.push({ role: 'assistant', content: response.content });

    const self = this;
    const chat = {
      sendMessage: async (input) => {
        // Handle both plain string messages (nudges/continuations) and tool result arrays
        if (typeof input === 'string') {
          conversationHistory.push({ role: 'user', content: input });
        } else if (Array.isArray(input) && input[0]?.functionResponse) {
          // Convert Gemini tool results to Claude tool_result blocks
          const toolResultContent = input.map(tr => {
            const fr = tr.functionResponse;
            const toolBlock = toolUseBlocks.find(b => b.name === fr.name) || {};
            const resultText = fr.response.error
              ? `Error: ${fr.response.error}`
              : (typeof fr.response.result === 'string' ? fr.response.result : JSON.stringify(fr.response.result));
            return {
              type: 'tool_result',
              tool_use_id: toolBlock.id || fr.name,
              content: resultText,
            };
          });
          conversationHistory.push({ role: 'user', content: toolResultContent });
        } else {
          conversationHistory.push({ role: 'user', content: String(input) });
        }

        const followUp = await self.providers.claude.messages.create({
          model,
          max_tokens: 8192,
          system: systemPrompt,
          tools: claudeTools,
          messages: conversationHistory,
        });

        const parsed = self._parseClaudeToolResponse(followUp);
        toolUseBlocks.length = 0;
        toolUseBlocks.push(...parsed.toolUseBlocks);

        conversationHistory.push({ role: 'assistant', content: followUp.content });

        return {
          response: {
            text: () => parsed.text,
            functionCalls: () => parsed.functionCalls,
          },
        };
      },
    };

    return {
      response: {
        text: () => text,
        functionCalls: () => functionCalls,
      },
      text,
      functionCalls,
      provider: 'claude',
      model,
      chat,
    };
  }

  /** Parse a Claude API response into { text, functionCalls, toolUseBlocks }. */
  _parseClaudeToolResponse(response) {
    let text = '';
    const functionCalls = [];
    const toolUseBlocks = [];

    for (const block of response.content || []) {
      if (block.type === 'text') {
        text += block.text;
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
        functionCalls.push({ name: block.name, args: block.input || {} });
      }
    }

    return { text, functionCalls, toolUseBlocks };
  }

  // ═══════════════════════════════════════════════════════
  // OPENAI TOOL-CALLING ADAPTER
  // ═══════════════════════════════════════════════════════

  /**
   * Convert Gemini tool format to OpenAI tool format.
   * OpenAI: [{ type: 'function', function: { name, description, parameters: { type: 'object', ... } } }]
   */
  _convertToolsForOpenAI(geminiTools) {
    const declarations = geminiTools?.[0]?.functionDeclarations || [];
    return declarations.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description || '',
        parameters: this._convertGeminiSchemaToJson(t.parameters || {}),
      },
    }));
  }

  /**
   * OpenAI with function calling (tool use).
   * Returns the same interface as chatGeminiWithTools.
   */
  async chatOpenAIWithTools(messages, options) {
    const config = this.config.ai_providers.providers.openai;
    const systemPrompt = options.systemPrompt || '';
    const openaiTools = this._convertToolsForOpenAI(options.tools);
    const model = config.model || 'gpt-4o';

    // Build OpenAI messages
    const openaiMessages = [];
    if (systemPrompt) openaiMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages) {
      if (m.role === 'system') continue;
      openaiMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      });
    }

    const response = await this.providers.openai.chat.completions.create({
      model,
      messages: openaiMessages,
      tools: openaiTools,
      max_tokens: 8192,
    });

    const choice = response.choices[0];
    const { text, functionCalls, toolCallBlocks } = this._parseOpenAIToolResponse(choice);

    // Create stateful chat wrapper
    const conversationHistory = [...openaiMessages];
    conversationHistory.push(choice.message);

    const self = this;
    const chat = {
      sendMessage: async (input) => {
        // Handle both plain string messages (nudges/continuations) and tool result arrays
        if (typeof input === 'string') {
          conversationHistory.push({ role: 'user', content: input });
        } else if (Array.isArray(input) && input[0]?.functionResponse) {
          for (const tr of input) {
            const fr = tr.functionResponse;
            const toolCall = toolCallBlocks.find(b => b.function.name === fr.name) || {};
            const resultText = fr.response.error
              ? `Error: ${fr.response.error}`
              : (typeof fr.response.result === 'string' ? fr.response.result : JSON.stringify(fr.response.result));
            conversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id || fr.name,
              content: resultText,
            });
          }
        } else {
          conversationHistory.push({ role: 'user', content: String(input) });
        }

        const followUp = await self.providers.openai.chat.completions.create({
          model,
          messages: conversationHistory,
          tools: openaiTools,
          max_tokens: 8192,
        });

        const fChoice = followUp.choices[0];
        const parsed = self._parseOpenAIToolResponse(fChoice);
        toolCallBlocks.length = 0;
        toolCallBlocks.push(...parsed.toolCallBlocks);

        conversationHistory.push(fChoice.message);

        return {
          response: {
            text: () => parsed.text,
            functionCalls: () => parsed.functionCalls,
          },
        };
      },
    };

    return {
      response: {
        text: () => text,
        functionCalls: () => functionCalls,
      },
      text,
      functionCalls,
      provider: 'openai',
      model,
      chat,
    };
  }

  /** Parse an OpenAI choice into { text, functionCalls, toolCallBlocks }. */
  _parseOpenAIToolResponse(choice) {
    const message = choice.message;
    const text = message.content || '';
    const functionCalls = [];
    const toolCallBlocks = [];

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        toolCallBlocks.push(tc);
        let args = {};
        try { args = JSON.parse(tc.function.arguments || '{}'); } catch {}
        functionCalls.push({ name: tc.function.name, args });
      }
    }

    return { text, functionCalls, toolCallBlocks };
  }

  /**
   * Ollama with function calling (tool use).
   * Ollama exposes an OpenAI-compatible API, so this mirrors chatOpenAIWithTools
   * but uses the Ollama client. Requires a tool-calling-capable model
   * (e.g., qwen2.5, llama3.1, mistral, hermes3).
   */
  async chatOllamaWithTools(messages, options) {
    const config = this.config.ai_providers.providers.ollama;
    const systemPrompt = options.systemPrompt || '';
    const openaiTools = this._convertToolsForOpenAI(options.tools);
    const model = config.model || 'qwen2.5';

    const ollamaMessages = [];
    if (systemPrompt) ollamaMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages) {
      if (m.role === 'system') continue;
      ollamaMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      });
    }

    const response = await this.providers.ollama.chat.completions.create({
      model,
      messages: ollamaMessages,
      tools: openaiTools,
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
    });

    const choice = response.choices[0];
    const { text, functionCalls, toolCallBlocks } = this._parseOpenAIToolResponse(choice);

    const conversationHistory = [...ollamaMessages];
    conversationHistory.push(choice.message);

    const self = this;
    const chat = {
      sendMessage: async (input) => {
        if (typeof input === 'string') {
          conversationHistory.push({ role: 'user', content: input });
        } else if (Array.isArray(input) && input[0]?.functionResponse) {
          for (const tr of input) {
            const fr = tr.functionResponse;
            const toolCall = toolCallBlocks.find(b => b.function.name === fr.name) || {};
            const resultText = fr.response.error
              ? `Error: ${fr.response.error}`
              : (typeof fr.response.result === 'string' ? fr.response.result : JSON.stringify(fr.response.result));
            conversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id || fr.name,
              content: resultText,
            });
          }
        } else {
          conversationHistory.push({ role: 'user', content: String(input) });
        }

        const followUp = await self.providers.ollama.chat.completions.create({
          model,
          messages: conversationHistory,
          tools: openaiTools,
          ...(options.maxTokens && { max_tokens: options.maxTokens }),
        });

        const fChoice = followUp.choices[0];
        const parsed = self._parseOpenAIToolResponse(fChoice);
        toolCallBlocks.length = 0;
        toolCallBlocks.push(...parsed.toolCallBlocks);
        conversationHistory.push(fChoice.message);

        return {
          response: {
            text: () => parsed.text,
            functionCalls: () => parsed.functionCalls,
          },
        };
      },
    };

    return {
      response: {
        text: () => text,
        functionCalls: () => functionCalls,
      },
      text,
      functionCalls,
      provider: 'ollama',
      model,
      chat,
    };
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

  // ═══════════════════════════════════════════════════════
  // KIMI K3 (Moonshot AI) — OpenAI-compatible API
  // $3/M input, $15/M output — cheapest frontier model
  // ═══════════════════════════════════════════════════════

  async chatKimi(messages, options) {
    const config = this.config.ai_providers.providers.kimi;
    const systemPrompt = 'systemPrompt' in options ? options.systemPrompt : this.getSystemPrompt(options.liveContext || '');
    const model = config.model || 'kimi-k3';

    const kimiMessages = [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      })),
    ];

    const response = await this.providers.kimi.chat.completions.create({
      model,
      messages: kimiMessages,
      ...(options.maxTokens && { max_tokens: options.maxTokens }),
    });

    return {
      content: response.choices[0].message.content,
      provider: 'kimi',
      model,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
      },
    };
  }

  async chatKimiWithTools(messages, options) {
    const config = this.config.ai_providers.providers.kimi;
    const systemPrompt = options.systemPrompt || '';
    const openaiTools = this._convertToolsForOpenAI(options.tools);
    const model = config.model || 'kimi-k3';

    const kimiMessages = [];
    if (systemPrompt) kimiMessages.push({ role: 'system', content: systemPrompt });
    for (const m of messages) {
      if (m.role === 'system') continue;
      kimiMessages.push({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || ''),
      });
    }

    const response = await this.providers.kimi.chat.completions.create({
      model,
      messages: kimiMessages,
      tools: openaiTools,
      max_tokens: 8192,
    });

    const choice = response.choices[0];
    const { text, functionCalls, toolCallBlocks } = this._parseOpenAIToolResponse(choice);

    const conversationHistory = [...kimiMessages];
    conversationHistory.push(choice.message);

    const self = this;
    const chat = {
      sendMessage: async (input) => {
        if (typeof input === 'string') {
          conversationHistory.push({ role: 'user', content: input });
        } else if (Array.isArray(input) && input[0]?.functionResponse) {
          for (const tr of input) {
            const fr = tr.functionResponse;
            const toolCall = toolCallBlocks.find(b => b.function.name === fr.name) || {};
            const resultText = fr.response.error
              ? `Error: ${fr.response.error}`
              : (typeof fr.response.result === 'string' ? fr.response.result : JSON.stringify(fr.response.result));
            conversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id || fr.name,
              content: resultText,
            });
          }
        } else {
          conversationHistory.push({ role: 'user', content: String(input) });
        }

        const followUp = await self.providers.kimi.chat.completions.create({
          model,
          messages: conversationHistory,
          tools: openaiTools,
          max_tokens: 8192,
        });

        const fChoice = followUp.choices[0];
        const parsed = self._parseOpenAIToolResponse(fChoice);
        toolCallBlocks.length = 0;
        toolCallBlocks.push(...parsed.toolCallBlocks);
        conversationHistory.push(fChoice.message);

        return {
          response: {
            text: () => parsed.text,
            functionCalls: () => parsed.functionCalls,
          },
        };
      },
    };

    return {
      response: {
        text: () => text,
        functionCalls: () => functionCalls,
      },
      text,
      functionCalls,
      provider: 'kimi',
      model,
      chat,
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
      }
    }

    // Save config to disk
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
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
    // Code/vision tasks: avoid Ollama (too weak), prefer active provider or best available
    if ((taskType === 'code' || taskType === 'vision') && this.activeProvider === 'ollama') {
      for (const p of ['gemini', 'claude', 'openai']) {
        if (this.providers[p]) return p;
      }
    }
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
  }
}
