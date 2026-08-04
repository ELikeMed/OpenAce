/**
 * ActivityLogger - Tracks all Ace actions, conversations, and work products
 * 
 * This persists everything Ace does so the desktop app can show:
 * - Telegram conversations
 * - Browser actions & screenshots
 * - Saved files (research, strategies, etc.)
 * - SOP executions
 * - Pipeline changes
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

export class ActivityLogger extends EventEmitter {
  constructor(options = {}) {
    super();
    this.dataDir = options.dataDir || path.join(process.cwd(), 'data', 'activity');
    this.logFile = path.join(this.dataDir, 'activity.json');
    this.maxEntries = options.maxEntries || 1000;
    
    // Activity data
    this.activities = [];
    this.conversations = new Map(); // chatId -> messages
    this.workProducts = []; // saved files, research, etc.
    
    // Stats
    this.stats = {
      totalMessages: 0,
      totalActions: 0,
      sopExecutions: 0,
      researchTasks: 0,
      leadsAdded: 0,
      tasksCompleted: 0,
      lastActivity: null
    };
  }

  /**
   * Initialize the activity logger
   */
  async initialize() {
    // Ensure data directory exists
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load existing activity log
    try {
      const data = await fs.readFile(this.logFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.activities = parsed.activities || [];
      this.stats = parsed.stats || this.stats;
      
      // Restore conversations
      if (parsed.conversations) {
        for (const [chatId, messages] of Object.entries(parsed.conversations)) {
          this.conversations.set(chatId, messages);
        }
      }
      
      this.workProducts = parsed.workProducts || [];
      
    } catch (error) {
      // Start fresh if no file exists
    }
    
    // Scan for existing work products
    await this.scanWorkProducts();
    
    return this;
  }

  /**
   * Log any activity
   */
  async log(activity) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...activity
    };
    
    // Add to activities
    this.activities.unshift(entry);
    
    // Trim to max entries
    if (this.activities.length > this.maxEntries) {
      this.activities = this.activities.slice(0, this.maxEntries);
    }
    
    // Update stats
    this.stats.totalActions++;
    this.stats.lastActivity = entry.timestamp;
    
    // Update specific stats
    if (activity.type === 'sop_execution') this.stats.sopExecutions++;
    if (activity.type === 'research') this.stats.researchTasks++;
    if (activity.type === 'lead_added') this.stats.leadsAdded++;
    if (activity.type === 'task_completed') this.stats.tasksCompleted++;
    
    // Emit event for live updates
    this.emit('activity', entry);
    
    // Auto-save
    await this.save();
    
    return entry;
  }

  /**
   * Log a conversation message (from Telegram or chat)
   */
  async logMessage(chatId, role, content, metadata = {}) {
    const message = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      role, // 'user' | 'ace'
      content,
      ...metadata
    };
    
    // Get or create conversation
    if (!this.conversations.has(chatId)) {
      this.conversations.set(chatId, []);
    }
    
    const conversation = this.conversations.get(chatId);
    conversation.push(message);
    
    // Keep last 500 messages per conversation
    if (conversation.length > 500) {
      this.conversations.set(chatId, conversation.slice(-500));
    }
    
    // Update stats
    this.stats.totalMessages++;
    
    // Log as activity too
    await this.log({
      type: 'message',
      source: metadata.source || 'chat',
      chatId,
      role,
      preview: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      metadata
    });
    
    // Emit for live updates
    this.emit('message', { chatId, message });
    
    return message;
  }

  /**
   * Log a work product (saved file, research output, etc.)
   */
  async logWorkProduct(product) {
    const entry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      ...product
    };
    
    this.workProducts.unshift(entry);
    
    // Log as activity
    await this.log({
      type: 'work_product',
      category: product.category,
      name: product.name,
      path: product.path,
      description: product.description
    });
    
    this.emit('workProduct', entry);
    
    return entry;
  }

  /**
   * Log a browser action/screenshot
   */
  async logBrowserAction(action) {
    return await this.log({
      type: 'browser_action',
      action: action.action,
      url: action.url,
      screenshot: action.screenshot,
      result: action.result,
      duration: action.duration
    });
  }

  /**
   * Log SOP execution
   */
  async logSOPExecution(sop, result) {
    return await this.log({
      type: 'sop_execution',
      sopId: sop.id,
      sopName: sop.name,
      category: sop.category,
      success: result.success,
      message: result.message,
      stepsCompleted: result.stepsCompleted || 0,
      duration: result.duration
    });
  }

  /**
   * Get recent activities
   */
  getRecentActivities(limit = 50, filter = {}) {
    let filtered = this.activities;
    
    if (filter.type) {
      filtered = filtered.filter(a => a.type === filter.type);
    }
    
    if (filter.source) {
      filtered = filtered.filter(a => a.source === filter.source);
    }
    
    if (filter.since) {
      filtered = filtered.filter(a => new Date(a.timestamp) > new Date(filter.since));
    }
    
    return filtered.slice(0, limit);
  }

  /**
   * Get conversation history
   */
  getConversation(chatId) {
    return this.conversations.get(chatId) || [];
  }

  /**
   * Get all conversations
   */
  getAllConversations() {
    const result = [];
    for (const [chatId, messages] of this.conversations) {
      if (messages.length > 0) {
        result.push({
          chatId,
          lastMessage: messages[messages.length - 1],
          messageCount: messages.length,
          startTime: messages[0].timestamp
        });
      }
    }
    return result.sort((a, b) => 
      new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
    );
  }

  /**
   * Get work products
   */
  getWorkProducts(filter = {}) {
    let filtered = this.workProducts;
    
    if (filter.category) {
      filtered = filtered.filter(w => w.category === filter.category);
    }
    
    return filtered;
  }

  /**
   * Scan data directories for existing work products
   */
  async scanWorkProducts() {
    const baseDir = path.join(this.dataDir, '..');
    const categories = [
      { name: 'screenshots', dir: 'automation/screenshots', ext: ['.png', '.jpg'] },
      { name: 'research', dir: 'research', ext: ['.json', '.md'] },
      { name: 'strategies', dir: 'strategies', ext: ['.json', '.md'] },
      { name: 'skills', dir: 'skills', ext: ['.json'] },
      { name: 'sops', dir: 'sops', ext: ['.json'] }
    ];
    
    const existingPaths = new Set(this.workProducts.map(w => w.path));
    
    for (const category of categories) {
      const dir = path.join(baseDir, category.dir);
      try {
        await this.scanDirectory(dir, category.name, category.ext, existingPaths);
      } catch (error) {
        // Directory doesn't exist, skip
      }
    }
  }

  async scanDirectory(dir, category, extensions, existingPaths) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, category, extensions, existingPaths);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.includes(ext) && !existingPaths.has(fullPath)) {
            const stat = await fs.stat(fullPath);
            this.workProducts.push({
              id: this.generateId(),
              category,
              name: entry.name,
              path: fullPath,
              size: stat.size,
              created: stat.birthtime.toISOString(),
              modified: stat.mtime.toISOString()
            });
          }
        }
      }
    } catch (error) {
      // Skip directories that don't exist
    }
  }

  /**
   * Get stats
   */
  getStats() {
    return {
      ...this.stats,
      conversationCount: this.conversations.size,
      workProductCount: this.workProducts.length
    };
  }

  /**
   * Save activity log to disk
   */
  async save() {
    const data = {
      activities: this.activities,
      stats: this.stats,
      conversations: Object.fromEntries(this.conversations),
      workProducts: this.workProducts,
      savedAt: new Date().toISOString()
    };
    
    await fs.writeFile(this.logFile, JSON.stringify(data, null, 2));
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear old activities
   */
  async clearOldActivities(daysOld = 30) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysOld);
    
    this.activities = this.activities.filter(a => 
      new Date(a.timestamp) > cutoff
    );
    
    await this.save();
    
    return { remaining: this.activities.length };
  }
}

export default ActivityLogger;
