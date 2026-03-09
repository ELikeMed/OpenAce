/**
 * StateManager — Single Source of Truth for OpenAce
 * 
 * Solves the problem of duplicate state (OpenAce.conversationHistory[] vs
 * AceBrain.conversations Map) and lost state on restart.
 * 
 * Provides:
 * - Unified conversation store (shared by Dashboard + Telegram + CLI)
 * - Auto-persist to disk on every write
 * - State recovery on restart
 * - Cross-session memory
 * - Debounced writes (batches rapid updates)
 * 
 * Usage:
 *   const state = new StateManager({ dataDir: 'data/state' });
 *   await state.initialize();
 *   
 *   // Conversations
 *   state.addMessage('dashboard', 'user', 'Find me leads');
 *   state.addMessage('dashboard', 'assistant', 'On it...');
 *   const history = state.getConversation('dashboard');
 *   
 *   // Key-value store
 *   state.set('lastActiveProvider', 'ollama');
 *   const provider = state.get('lastActiveProvider');
 */

import fs from 'fs/promises';
import path from 'path';
import { eventBus } from '../events/EventBus.js';

export class StateManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data/state';
    this.conversationsFile = path.join(this.dataDir, 'conversations.json');
    this.stateFile = path.join(this.dataDir, 'state.json');
    
    // Configuration
    this.maxMessagesPerChannel = options.maxMessagesPerChannel || 100;
    this.maxChannels = options.maxChannels || 20;
    this.persistDebounceMs = options.persistDebounceMs || 2000; // 2s debounce
    
    // State stores
    this.conversations = new Map();  // channelId → Message[]
    this.store = {};                 // Generic key-value store
    
    // Debounce timers
    this._conversationDirty = false;
    this._storeDirty = false;
    this._persistTimer = null;
    
    this.initialized = false;
  }

  /**
   * Initialize — load persisted state from disk
   */
  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load conversations
    try {
      const data = await fs.readFile(this.conversationsFile, 'utf-8');
      const parsed = JSON.parse(data);
      for (const [channelId, messages] of Object.entries(parsed)) {
        this.conversations.set(channelId, messages);
      }
    } catch {
      // No existing conversations
    }
    
    // Load store
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      this.store = JSON.parse(data);
    } catch {
      this.store = {};
    }
    
    this.initialized = true;
    
    const channelCount = this.conversations.size;
    const totalMessages = [...this.conversations.values()].reduce((sum, msgs) => sum + msgs.length, 0);
    console.log(`💾 StateManager initialized (${channelCount} channels, ${totalMessages} messages, ${Object.keys(this.store).length} state keys)`);
    
    return this;
  }

  // ═══════════════════════════════════════════════════════
  // CONVERSATION MANAGEMENT
  // ═══════════════════════════════════════════════════════

  /**
   * Add a message to a conversation channel
   * @param {string} channelId - Channel identifier (e.g., 'dashboard', 'telegram_12345')
   * @param {string} role - 'user' or 'assistant'
   * @param {string} content - Message content
   * @param {object} [metadata] - Optional metadata (intent, provider, etc.)
   */
  addMessage(channelId, role, content, metadata = {}) {
    if (!this.conversations.has(channelId)) {
      this.conversations.set(channelId, []);
    }
    
    const messages = this.conversations.get(channelId);
    
    messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    });
    
    // Trim if over limit
    if (messages.length > this.maxMessagesPerChannel) {
      // Keep the most recent messages, but also preserve the first few for context
      const keepFirst = 5;
      const keepLast = this.maxMessagesPerChannel - keepFirst;
      const trimmed = [
        ...messages.slice(0, keepFirst),
        { role: 'system', content: `[${messages.length - this.maxMessagesPerChannel} older messages trimmed]`, timestamp: new Date().toISOString() },
        ...messages.slice(-keepLast)
      ];
      this.conversations.set(channelId, trimmed);
    }
    
    this._conversationDirty = true;
    this._schedulePersist();
    
    return messages[messages.length - 1];
  }

  /**
   * Get conversation history for a channel
   * @param {string} channelId
   * @param {number} [limit] - Max messages to return (default: all)
   */
  getConversation(channelId, limit = null) {
    const messages = this.conversations.get(channelId) || [];
    if (limit) return messages.slice(-limit);
    return messages;
  }

  /**
   * Get all channel IDs
   */
  getChannels() {
    return [...this.conversations.keys()];
  }

  /**
   * Get conversation summary (for context building)
   */
  getConversationSummary(channelId) {
    const messages = this.conversations.get(channelId) || [];
    if (messages.length === 0) return null;
    
    const userMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    return {
      channelId,
      totalMessages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: assistantMessages.length,
      firstMessage: messages[0]?.timestamp,
      lastMessage: messages[messages.length - 1]?.timestamp,
      recentTopics: userMessages.slice(-5).map(m => m.content.substring(0, 80))
    };
  }

  /**
   * Clear a conversation
   */
  clearConversation(channelId) {
    this.conversations.delete(channelId);
    this._conversationDirty = true;
    this._schedulePersist();
  }

  /**
   * Get formatted messages for AI context (role + content only)
   */
  getMessagesForAI(channelId, limit = 10) {
    const messages = this.getConversation(channelId, limit);
    return messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({ role: m.role, content: m.content }));
  }

  // ═══════════════════════════════════════════════════════
  // KEY-VALUE STORE
  // ═══════════════════════════════════════════════════════

  /**
   * Set a value in the state store
   */
  set(key, value) {
    this.store[key] = {
      value,
      updatedAt: new Date().toISOString()
    };
    this._storeDirty = true;
    this._schedulePersist();
  }

  /**
   * Get a value from the state store
   */
  get(key, defaultValue = null) {
    const entry = this.store[key];
    return entry ? entry.value : defaultValue;
  }

  /**
   * Delete a key from the state store
   */
  delete(key) {
    delete this.store[key];
    this._storeDirty = true;
    this._schedulePersist();
  }

  /**
   * Get all state keys
   */
  keys() {
    return Object.keys(this.store);
  }

  // ═══════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════

  /**
   * Schedule a debounced persist
   */
  _schedulePersist() {
    if (this._persistTimer) return; // Already scheduled
    
    this._persistTimer = setTimeout(async () => {
      this._persistTimer = null;
      await this.persist();
    }, this.persistDebounceMs);
  }

  /**
   * Persist all dirty state to disk immediately
   */
  async persist() {
    const writes = [];
    
    if (this._conversationDirty) {
      const convData = {};
      for (const [channelId, messages] of this.conversations) {
        convData[channelId] = messages;
      }
      writes.push(
        fs.writeFile(this.conversationsFile, JSON.stringify(convData, null, 2))
          .then(() => { this._conversationDirty = false; })
      );
    }
    
    if (this._storeDirty) {
      writes.push(
        fs.writeFile(this.stateFile, JSON.stringify(this.store, null, 2))
          .then(() => { this._storeDirty = false; })
      );
    }
    
    if (writes.length > 0) {
      try {
        await Promise.all(writes);
      } catch (error) {
        console.error('[StateManager] Persist failed:', error.message);
      }
    }
  }

  /**
   * Force immediate persist (call on shutdown)
   */
  async flush() {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    this._conversationDirty = true;
    this._storeDirty = true;
    await this.persist();
  }

  /**
   * Get status for health checks
   */
  getStatus() {
    const channels = this.getChannels();
    return {
      initialized: this.initialized,
      channels: channels.length,
      totalMessages: [...this.conversations.values()].reduce((sum, msgs) => sum + msgs.length, 0),
      stateKeys: Object.keys(this.store).length,
      channelSummaries: channels.map(ch => this.getConversationSummary(ch))
    };
  }
}

export default StateManager;
