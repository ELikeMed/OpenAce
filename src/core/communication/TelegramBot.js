/**
 * TelegramBot - Telegram Integration for OpenAce
 * 
 * Enables remote communication with Ace via Telegram.
 * Uses polling mode - no public server required!
 * 
 * Setup:
 * 1. Message @BotFather on Telegram
 * 2. Send /newbot and follow prompts
 * 3. Copy your bot token to config
 * 4. Start chatting with your bot!
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class TelegramBot extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      token: config.token || process.env.TELEGRAM_BOT_TOKEN,
      authorizedUsers: config.authorizedUsers || [], // Telegram user IDs or usernames
      botUsername: config.botUsername || 'OpenAceBot',
      pollingInterval: config.pollingInterval || 1000,
      enabled: config.enabled !== false
    };
    
    this.bot = null;
    this.messageHandler = null;
    this.commandHandlers = new Map();
    this.conversationHistory = new Map();
    this.isRunning = false;
    this.activityLogger = null; // Will be set by OpenAce if available
    
    // Register default commands
    this.registerDefaultCommands();
  }

  /**
   * Set the activity logger for logging all telegram conversations
   */
  setActivityLogger(logger) {
    this.activityLogger = logger;
  }

  /**
   * Initialize and start the Telegram bot
   */
  async initialize() {
    if (!this.config.enabled) {
      console.log('🤖 Telegram Bot disabled in config');
      return false;
    }

    if (!this.config.token) {
      console.error('❌ Telegram Bot: Missing bot token');
      console.log('   Get one from @BotFather on Telegram');
      console.log('   Set TELEGRAM_BOT_TOKEN or add to config');
      return false;
    }

    try {
      // Dynamic import for telegram bot api
      const TelegramBotAPI = (await import('node-telegram-bot-api')).default;
      
      this.bot = new TelegramBotAPI(this.config.token, { 
        polling: true 
      });
      
      // Get bot info
      const me = await this.bot.getMe();
      this.config.botUsername = me.username;
      
      console.log('🤖 Telegram Bot initialized');
      console.log(`   Bot: @${me.username}`);
      console.log(`   Name: ${me.first_name}`);
      console.log(`   Authorized Users: ${this.config.authorizedUsers.length || 'All (configure for security)'}`);
      
      // Set up message handlers
      this.setupHandlers();
      this.isRunning = true;
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Telegram Bot:', error.message);
      if (error.message.includes('ETELEGRAM')) {
        console.log('   Check your bot token is correct');
      } else {
        console.log('   Run: npm install node-telegram-bot-api');
      }
      return false;
    }
  }

  /**
   * Set up message and callback handlers
   */
  setupHandlers() {
    // Handle all messages
    this.bot.on('message', async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        console.error('Error handling message:', error);
        this.sendMessage(msg.chat.id, '❌ Sorry, I encountered an error. Please try again.');
      }
    });

    // Handle callback queries (button presses)
    this.bot.on('callback_query', async (query) => {
      try {
        await this.handleCallback(query);
      } catch (error) {
        console.error('Error handling callback:', error);
      }
    });

    // Handle errors
    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error.message);
    });
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;
    const text = msg.text || '';
    
    console.log(`\n📥 Telegram from @${username || userId}: "${text}"`);

    // Security: Check if user is authorized
    if (!this.isAuthorized(userId, username)) {
      console.log(`⚠️ Unauthorized user: @${username} (${userId})`);
      await this.sendMessage(chatId, 
        '🔒 Sorry, you are not authorized to use this bot.\n\n' +
        'Ask the admin to add your Telegram ID to the authorized users list.\n' +
        `Your ID: \`${userId}\``, 
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Store in conversation history
    this.addToHistory(chatId, 'user', text, msg);

    // Check for commands (starts with /)
    if (text.startsWith('/')) {
      const [command, ...args] = text.slice(1).split(' ');
      await this.handleCommand(chatId, command.toLowerCase(), args, msg);
      return;
    }

    // Process regular message
    const response = await this.processMessage(chatId, text, msg);
    
    if (response) {
      await this.sendMessage(chatId, response.text, response.options);
      this.addToHistory(chatId, 'ace', response.text);
    }
  }

  /**
   * Check if a user is authorized
   */
  isAuthorized(userId, username) {
    if (this.config.authorizedUsers.length === 0) {
      // If no authorized users configured, allow all (not recommended)
      return true;
    }
    
    return this.config.authorizedUsers.some(auth => {
      // Check by ID (number) or username (string starting with @)
      if (typeof auth === 'number') {
        return auth === userId;
      }
      if (typeof auth === 'string') {
        const cleanAuth = auth.replace('@', '').toLowerCase();
        return cleanAuth === String(userId) || 
               cleanAuth === (username || '').toLowerCase();
      }
      return false;
    });
  }

  /**
   * Handle slash commands
   */
  async handleCommand(chatId, command, args, msg) {
    // Check for registered command handler
    if (this.commandHandlers.has(command)) {
      const handler = this.commandHandlers.get(command);
      const response = await handler(chatId, args, msg);
      if (response) {
        await this.sendMessage(chatId, response.text, response.options);
        this.addToHistory(chatId, 'ace', response.text);
      }
      return;
    }

    // Unknown command
    await this.sendMessage(chatId, 
      `Unknown command: /${command}\n\nTry /help for available commands.`
    );
  }

  /**
   * Register default commands
   */
  registerDefaultCommands() {
    // /start - Welcome message
    this.registerCommand('start', async (chatId, args, msg) => {
      const name = msg.from.first_name || 'there';
      return {
        text: `👋 Hey ${name}! I'm **Ace**, your AI Executive Assistant.\n\n` +
              `I can help you with:\n` +
              `• 📊 Pipeline management\n` +
              `• 🔍 Research tasks\n` +
              `• 📋 Task tracking\n` +
              `• 🌐 Web automation\n\n` +
              `Just message me naturally or use /help for commands!`,
        options: { parse_mode: 'Markdown' }
      };
    });

    // /help - Show available commands
    this.registerCommand('help', async () => {
      return {
        text: `🤖 **Ace Commands**\n\n` +
              `📍 **General**\n` +
              `/start - Welcome message\n` +
              `/help - Show this help\n` +
              `/status - Check Ace status\n\n` +
              `📊 **Pipeline**\n` +
              `/pipeline - View pipeline summary\n` +
              `/leads - Show recent leads\n` +
              `/addlead [name] - Add a new lead\n\n` +
              `🔍 **Research**\n` +
              `/search [query] - Web search\n` +
              `/research [topic] - Deep research\n\n` +
              `📋 **Tasks**\n` +
              `/tasks - View pending tasks\n` +
              `/remind [message] - Set a reminder\n\n` +
              `💬 Or just message me naturally!`,
        options: { parse_mode: 'Markdown' }
      };
    });

    // /status - Check bot status
    this.registerCommand('status', async () => {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      
      return {
        text: `🟢 **Ace Status**\n\n` +
              `• Status: Online\n` +
              `• Uptime: ${hours}h ${minutes}m\n` +
              `• Time: ${new Date().toLocaleString()}\n` +
              `• Mode: Ready for tasks`,
        options: { parse_mode: 'Markdown' }
      };
    });

    // /pipeline - Pipeline summary
    this.registerCommand('pipeline', async () => {
      // This will be connected to actual pipeline data
      return {
        text: `📊 **Pipeline Summary**\n\n` +
              `Connecting to pipeline...\n` +
              `(Pipeline integration pending)`,
        options: { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 Refresh', callback_data: 'pipeline_refresh' },
              { text: '➕ Add Lead', callback_data: 'pipeline_add' }
            ]]
          }
        }
      };
    });

    // /tasks - Show tasks
    this.registerCommand('tasks', async () => {
      return {
        text: `📋 **Pending Tasks**\n\n` +
              `No active tasks at the moment.\n\n` +
              `Send me a task to get started!`,
        options: { parse_mode: 'Markdown' }
      };
    });

    // /search - Quick web search
    this.registerCommand('search', async (chatId, args) => {
      if (args.length === 0) {
        return { text: '🔍 Usage: /search [your query]\n\nExample: /search best CRM software 2024' };
      }
      const query = args.join(' ');
      return {
        text: `🔍 Searching for: "${query}"\n\n` +
              `(Search integration pending - will connect to BrowserAgent)`,
        options: { parse_mode: 'Markdown' }
      };
    });

    // /remind - Set a reminder
    this.registerCommand('remind', async (chatId, args, msg) => {
      if (args.length === 0) {
        return { text: '⏰ Usage: /remind [message]\n\nExample: /remind Call John at 3pm' };
      }
      const reminder = args.join(' ');
      return {
        text: `⏰ **Reminder Set**\n\n"${reminder}"\n\n` +
              `I'll keep track of this for you.`,
        options: { parse_mode: 'Markdown' }
      };
    });
  }

  /**
   * Register a custom command handler
   */
  registerCommand(command, handler) {
    this.commandHandlers.set(command.toLowerCase(), handler);
  }

  /**
   * Process a regular (non-command) message
   */
  async processMessage(chatId, text, msg) {
    // Emit event for external handlers
    this.emit('message', { chatId, text, msg });

    // If a custom handler is set, use it
    if (this.messageHandler) {
      try {
        return await this.messageHandler(chatId, text, msg);
      } catch (error) {
        console.error('Message handler error:', error);
        return { text: "Sorry, I encountered an error. I'll look into it." };
      }
    }

    // Default: Smart response based on content
    return this.getSmartResponse(text, msg);
  }

  /**
   * Generate a smart default response
   */
  getSmartResponse(text, msg) {
    const lower = text.toLowerCase();
    
    // Detect intent and respond appropriately
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return {
        text: `Hey ${msg.from.first_name || 'there'}! 👋 How can I help you today?`
      };
    }
    
    if (lower.includes('thank')) {
      return { text: "You're welcome! Let me know if you need anything else. 😊" };
    }
    
    if (lower.includes('pipeline') || lower.includes('lead')) {
      return {
        text: `📊 Want me to check the pipeline?\n\nUse /pipeline for a summary or /leads to see recent leads.`
      };
    }
    
    if (lower.includes('search') || lower.includes('find') || lower.includes('look up')) {
      return {
        text: `🔍 I can help you search! Use:\n/search [your query]\n\nOr tell me what you're looking for.`
      };
    }
    
    if (lower.includes('task') || lower.includes('todo') || lower.includes('remind')) {
      return {
        text: `📋 I can help with tasks!\n\n• /tasks - View pending\n• /remind [msg] - Set reminder\n\nOr just tell me what you need done.`
      };
    }

    // Default acknowledgment
    return {
      text: `📨 Got it! I'm processing: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"\n\n` +
            `I'm still learning - use /help to see what I can do right now.`,
      options: { parse_mode: 'Markdown' }
    };
  }

  /**
   * Handle callback queries (button presses)
   */
  async handleCallback(query) {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    console.log(`📲 Callback: ${data} from ${query.from.username}`);
    
    // Acknowledge the callback
    await this.bot.answerCallbackQuery(query.id);
    
    // Handle different callbacks
    switch (data) {
      case 'pipeline_refresh':
        await this.sendMessage(chatId, '🔄 Refreshing pipeline...');
        break;
      case 'pipeline_add':
        await this.sendMessage(chatId, '➕ To add a lead, use:\n/addlead [Lead Name]');
        break;
      default:
        console.log(`Unknown callback: ${data}`);
    }
    
    // Emit event for external handlers
    this.emit('callback', { chatId, data, query });
  }

  /**
   * Send a message to a chat
   */
  async sendMessage(chatId, text, options = {}) {
    if (!this.bot) {
      throw new Error('Telegram Bot not initialized');
    }

    // Telegram message limit is 4096 chars — chunk if needed
    const MAX_LENGTH = 4000; // Leave margin for safety
    
    if (text.length > MAX_LENGTH) {
      console.log(`📦 Message too long (${text.length} chars), splitting into chunks...`);
      return await this._sendChunkedMessage(chatId, text, options);
    }

    // Sanitize Markdown to prevent Telegram parse errors
    let safeText = text;
    if (options.parse_mode === 'Markdown') {
      safeText = this.sanitizeMarkdown(text);
    }

    try {
      const message = await this.bot.sendMessage(chatId, safeText, options);
      console.log(`📤 Sent to ${chatId}: "${safeText.substring(0, 50)}..."`);
      return message;
    } catch (error) {
      // If Markdown parsing failed, retry without parse_mode
      if (error.message && error.message.includes("can't parse entities")) {
        console.warn('⚠️ Markdown parse failed, retrying as plain text...');
        try {
          const plainOptions = { ...options };
          delete plainOptions.parse_mode;
          // Strip all markdown formatting for plain text
          const plainText = text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/_/g, '').replace(/`/g, '');
          
          // Check length again after stripping
          if (plainText.length > MAX_LENGTH) {
            return await this._sendChunkedMessage(chatId, plainText, plainOptions);
          }
          
          const message = await this.bot.sendMessage(chatId, plainText, plainOptions);
          console.log(`📤 Sent to ${chatId} (plain): "${plainText.substring(0, 50)}..."`);
          return message;
        } catch (retryError) {
          console.error('Failed to send even as plain text:', retryError.message);
          throw retryError;
        }
      }
      
      // If message is too long error, try chunking
      if (error.message && error.message.includes('message is too long')) {
        console.warn('⚠️ Message too long, splitting into chunks...');
        return await this._sendChunkedMessage(chatId, text, options);
      }
      
      console.error('Failed to send message:', error.message);
      throw error;
    }
  }

  /**
   * Split a long message into Telegram-safe chunks and send sequentially
   */
  async _sendChunkedMessage(chatId, text, options = {}) {
    const MAX_LENGTH = 4000;
    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_LENGTH) {
        chunks.push(remaining);
        break;
      }

      // Try to split at a natural boundary (newline, then space, then hard cut)
      let splitAt = remaining.lastIndexOf('\n', MAX_LENGTH);
      if (splitAt < MAX_LENGTH * 0.5) {
        splitAt = remaining.lastIndexOf(' ', MAX_LENGTH);
      }
      if (splitAt < MAX_LENGTH * 0.3) {
        splitAt = MAX_LENGTH;
      }

      chunks.push(remaining.substring(0, splitAt));
      remaining = remaining.substring(splitAt).trimStart();
    }

    console.log(`📦 Sending ${chunks.length} message chunks to ${chatId}`);
    
    let lastMessage = null;
    const chunkOptions = { ...options };
    // Don't use Markdown for chunked messages to avoid broken formatting across chunks
    delete chunkOptions.parse_mode;

    for (let i = 0; i < chunks.length; i++) {
      const chunkHeader = chunks.length > 1 ? `[${i + 1}/${chunks.length}]\n` : '';
      try {
        lastMessage = await this.bot.sendMessage(chatId, chunkHeader + chunks[i], chunkOptions);
        console.log(`📤 Sent chunk ${i + 1}/${chunks.length} to ${chatId} (${chunks[i].length} chars)`);
        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (err) {
        console.error(`Failed to send chunk ${i + 1}/${chunks.length}:`, err.message);
      }
    }
    
    return lastMessage;
  }

  /**
   * Sanitize Markdown text for Telegram's strict parser
   * Ensures all bold/italic markers are properly paired
   */
  sanitizeMarkdown(text) {
    if (!text) return text;
    
    // Fix common issues with Telegram Markdown:
    // 1. Ensure ** markers are paired
    let result = text;
    
    // Count unpaired ** markers and remove the last one if odd
    const boldMarkers = (result.match(/\*\*/g) || []).length;
    if (boldMarkers % 2 !== 0) {
      // Find the last ** and remove it
      const lastIdx = result.lastIndexOf('**');
      if (lastIdx !== -1) {
        result = result.substring(0, lastIdx) + result.substring(lastIdx + 2);
      }
    }
    
    // Count unpaired * markers (excluding **) and remove if odd
    const singleStars = result.replace(/\*\*/g, '').match(/\*/g);
    if (singleStars && singleStars.length % 2 !== 0) {
      // Remove the last lone *
      const temp = result.split('**');
      const fixed = temp.map(part => {
        const stars = (part.match(/\*/g) || []).length;
        if (stars % 2 !== 0) {
          const idx = part.lastIndexOf('*');
          return part.substring(0, idx) + part.substring(idx + 1);
        }
        return part;
      });
      result = fixed.join('**');
    }
    
    // Ensure _ markers are paired (italic in Markdown)
    const underscores = (result.match(/(?<![\\a-zA-Z0-9])_(?![\\a-zA-Z0-9])/g) || []).length;
    if (underscores % 2 !== 0) {
      // Escape lone underscores
      result = result.replace(/(?<![\\a-zA-Z0-9])_(?![_a-zA-Z0-9])/g, '\\_');
    }
    
    // Ensure ` markers are paired (code in Markdown)
    const backticks = (result.match(/(?<!`)`(?!`)/g) || []).length;
    if (backticks % 2 !== 0) {
      const lastIdx = result.lastIndexOf('`');
      if (lastIdx !== -1 && result[lastIdx - 1] !== '`' && result[lastIdx + 1] !== '`') {
        result = result.substring(0, lastIdx) + result.substring(lastIdx + 1);
      }
    }
    
    return result;
  }

  /**
   * Send a message to all authorized users (broadcast)
   */
  async broadcast(text, options = {}) {
    const results = [];
    for (const user of this.config.authorizedUsers) {
      try {
        // For numeric IDs, send directly; for usernames, we need chat ID
        if (typeof user === 'number') {
          await this.sendMessage(user, text, options);
          results.push({ user, success: true });
        }
      } catch (error) {
        results.push({ user, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Notify user of important events
   */
  async notify(message, priority = 'normal') {
    const prefix = priority === 'high' ? '🚨 ' : priority === 'low' ? 'ℹ️ ' : '📢 ';
    return this.broadcast(prefix + message);
  }

  /**
   * Send a photo
   */
  async sendPhoto(chatId, photo, caption = '') {
    return this.bot.sendPhoto(chatId, photo, { caption });
  }

  /**
   * Send a document
   */
  async sendDocument(chatId, document, caption = '') {
    return this.bot.sendDocument(chatId, document, { caption });
  }

  /**
   * Set custom message handler
   */
  setMessageHandler(handler) {
    this.messageHandler = handler;
  }

  /**
   * Add message to conversation history
   */
  addToHistory(chatId, role, content, rawMsg = null) {
    if (!this.conversationHistory.has(chatId)) {
      this.conversationHistory.set(chatId, []);
    }
    
    const history = this.conversationHistory.get(chatId);
    const timestamp = new Date().toISOString();
    
    history.push({
      role,
      content,
      timestamp,
      raw: rawMsg
    });
    
    // Keep last 100 messages per chat
    if (history.length > 100) {
      history.shift();
    }
    
    // Log to activity logger if available
    if (this.activityLogger) {
      const username = rawMsg?.from?.username || rawMsg?.from?.first_name || 'Unknown';
      this.activityLogger.logMessage(
        `telegram_${chatId}`,
        role,
        content,
        {
          source: 'telegram',
          username,
          chatId
        }
      ).catch(err => console.error('Failed to log telegram message:', err));
    }
  }

  /**
   * Get conversation history for a chat
   */
  getConversationHistory(chatId) {
    return this.conversationHistory.get(chatId) || [];
  }

  /**
   * Stop the bot
   */
  async stop() {
    if (this.bot) {
      await this.bot.stopPolling();
      this.isRunning = false;
      console.log('🤖 Telegram Bot stopped');
    }
  }
}

export default TelegramBot;
