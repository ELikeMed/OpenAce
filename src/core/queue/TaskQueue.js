/**
 * TaskQueue — Persistent, Durable Task Queue for OpenAce
 * 
 * Unlike the in-memory actionQueue[] that was lost on restart, this queue:
 * - Persists to disk (JSON file) — survives crashes and restarts
 * - Tracks status: pending → running → completed / failed / dead
 * - Retries failed tasks with exponential backoff
 * - Priority ordering (high > medium > low)
 * - Dead letter queue for repeatedly-failed tasks
 * - Execution history for debugging
 * 
 * Usage:
 *   const queue = new TaskQueue({ dataDir: 'data/queue' });
 *   await queue.initialize();
 *   
 *   const taskId = await queue.enqueue({
 *     type: 'run_sop',
 *     payload: { sopId: 'sop_login', variables: {} },
 *     priority: 'high',
 *     source: 'scheduler'
 *   });
 *   
 *   // Process queue (called by worker loop)
 *   await queue.processNext(async (task) => {
 *     return await sopExecutor.executeSOP(task.payload.sopId);
 *   });
 */

import fs from 'fs/promises';
import path from 'path';
import { eventBus, EVENTS } from '../events/EventBus.js';

const PRIORITIES = { critical: 0, high: 1, medium: 2, low: 3 };
const STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DEAD: 'dead',        // Exceeded max retries
  CANCELLED: 'cancelled'
};

export { STATUS as TASK_STATUS };

export class TaskQueue {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data/queue';
    this.queueFile = path.join(this.dataDir, 'queue.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    
    // Configuration
    this.maxRetries = options.maxRetries || 3;
    this.retryBaseDelay = options.retryBaseDelay || 5000;     // 5 seconds
    this.retryMaxDelay = options.retryMaxDelay || 300000;     // 5 minutes
    this.maxConcurrent = options.maxConcurrent || 1;          // 1 task at a time
    this.maxHistory = options.maxHistory || 500;
    
    // State
    this.queue = [];
    this.history = [];
    this.running = new Map();  // taskId → task
    this.isProcessing = false;
    this.processingTimer = null;
    this.taskExecutor = null;
    
    // Handlers registered by type
    this.handlers = new Map();  // type → async handler function
    
    // Metrics
    this.metrics = {
      totalEnqueued: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalDead: 0,
      totalRetries: 0,
      startTime: Date.now()
    };
  }

  /**
   * Initialize — load persisted queue from disk
   */
  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Load existing queue
    try {
      const data = await fs.readFile(this.queueFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.queue = parsed.queue || [];
      this.metrics = { ...this.metrics, ...parsed.metrics };
      
      // Reset any tasks that were "running" when we crashed
      for (const task of this.queue) {
        if (task.status === STATUS.RUNNING) {
          task.status = STATUS.PENDING;
          task.retryCount = (task.retryCount || 0) + 1;
          task.lastError = 'Process crashed while running';
        }
      }
    } catch {
      this.queue = [];
    }
    
    // Load history
    try {
      const data = await fs.readFile(this.historyFile, 'utf-8');
      this.history = JSON.parse(data);
    } catch {
      this.history = [];
    }
    
    const pendingCount = this.queue.filter(t => t.status === STATUS.PENDING).length;
    console.log(`📋 TaskQueue initialized (${pendingCount} pending, ${this.history.length} in history)`);
    
    return this;
  }

  /**
   * Register a handler for a task type
   * @param {string} type - Task type (e.g., 'run_sop', 'send_email', 'research')
   * @param {Function} handler - Async function that processes the task. Receives task object.
   */
  registerHandler(type, handler) {
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * Add a task to the queue
   * @returns {string} Task ID
   */
  async enqueue(taskData) {
    const task = {
      id: `tq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      type: taskData.type,
      payload: taskData.payload || {},
      priority: taskData.priority || 'medium',
      source: taskData.source || 'unknown',
      status: STATUS.PENDING,
      retryCount: 0,
      maxRetries: taskData.maxRetries ?? this.maxRetries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduledFor: taskData.scheduledFor || null,  // ISO string for delayed execution
      lastError: null,
      result: null
    };
    
    this.queue.push(task);
    this.metrics.totalEnqueued++;
    
    await this.persist();
    
    eventBus.emit('queue:task:enqueued', { taskId: task.id, type: task.type, priority: task.priority });
    
    return task.id;
  }

  /**
   * Get the next task to process (highest priority, oldest first)
   */
  getNext() {
    const now = new Date().toISOString();
    
    return this.queue
      .filter(t => {
        if (t.status !== STATUS.PENDING) return false;
        // Check if scheduled for future
        if (t.scheduledFor && t.scheduledFor > now) return false;
        // Check if in retry cooldown
        if (t.nextRetryAt && t.nextRetryAt > now) return false;
        return true;
      })
      .sort((a, b) => {
        // Sort by priority first, then by creation time
        const pDiff = (PRIORITIES[a.priority] || 2) - (PRIORITIES[b.priority] || 2);
        if (pDiff !== 0) return pDiff;
        return new Date(a.createdAt) - new Date(b.createdAt);
      })[0] || null;
  }

  /**
   * Process the next available task
   * @returns {object|null} Task result or null if nothing to process
   */
  async processNext() {
    if (this.running.size >= this.maxConcurrent) return null;
    
    const task = this.getNext();
    if (!task) return null;
    
    const handler = this.handlers.get(task.type);
    if (!handler) {
      console.warn(`[TaskQueue] No handler for task type: ${task.type}`);
      task.status = STATUS.DEAD;
      task.lastError = `No handler registered for type: ${task.type}`;
      await this.persist();
      return null;
    }
    
    // Mark as running
    task.status = STATUS.RUNNING;
    task.startedAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    this.running.set(task.id, task);
    await this.persist();
    
    eventBus.emit('queue:task:started', { taskId: task.id, type: task.type });
    
    try {
      const result = await handler(task);
      
      // Success
      task.status = STATUS.COMPLETED;
      task.result = result;
      task.completedAt = new Date().toISOString();
      task.updatedAt = new Date().toISOString();
      this.metrics.totalCompleted++;
      
      eventBus.emit('queue:task:completed', { taskId: task.id, type: task.type, result });
      
    } catch (error) {
      task.lastError = error.message;
      task.updatedAt = new Date().toISOString();
      
      if (task.retryCount < task.maxRetries) {
        // Retry with exponential backoff
        task.status = STATUS.PENDING;
        task.retryCount++;
        const delay = Math.min(
          this.retryBaseDelay * Math.pow(2, task.retryCount - 1),
          this.retryMaxDelay
        );
        task.nextRetryAt = new Date(Date.now() + delay).toISOString();
        this.metrics.totalRetries++;
        
        eventBus.emit('queue:task:retry', { taskId: task.id, type: task.type, retryCount: task.retryCount, delay });
        
      } else {
        // Dead letter — exceeded max retries
        task.status = STATUS.DEAD;
        task.deadAt = new Date().toISOString();
        this.metrics.totalDead++;
        
        eventBus.emit('queue:task:dead', { taskId: task.id, type: task.type, error: error.message, retries: task.retryCount });
      }
      
      this.metrics.totalFailed++;
    } finally {
      this.running.delete(task.id);
      
      // Move completed/dead tasks to history
      if (task.status === STATUS.COMPLETED || task.status === STATUS.DEAD) {
        this.queue = this.queue.filter(t => t.id !== task.id);
        this.history.push(task);
        
        // Trim history
        if (this.history.length > this.maxHistory) {
          this.history = this.history.slice(-this.maxHistory);
        }
      }
      
      await this.persist();
    }
    
    return task;
  }

  /**
   * Start the processing loop
   * @param {number} intervalMs - How often to check for tasks (default: 2s)
   * @param {function} taskExecutor - The function to execute tasks
   */
  startProcessing(intervalMs = 2000, taskExecutor) {
    if (this.isProcessing) return;
    this.taskExecutor = taskExecutor;
    this.isProcessing = true;
    
    const loop = async () => {
      if (!this.isProcessing) return;
      
      try {
        await this.processNext();
      } catch (error) {
        console.error('[TaskQueue] Processing error:', error.message);
      }
      
      this.processingTimer = setTimeout(loop, intervalMs);
    };
    
    loop();
    }

  /**
   * Stop the processing loop
   */
  stopProcessing() {
    this.isProcessing = false;
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
  }

  /**
   * Cancel a pending task
   */
  async cancel(taskId) {
    const task = this.queue.find(t => t.id === taskId);
    if (!task) return false;
    if (task.status !== STATUS.PENDING) return false;
    
    task.status = STATUS.CANCELLED;
    task.cancelledAt = new Date().toISOString();
    task.updatedAt = new Date().toISOString();
    
    // Move to history
    this.queue = this.queue.filter(t => t.id !== taskId);
    this.history.push(task);
    
    await this.persist();
    eventBus.emit('queue:task:cancelled', { taskId });
    return true;
  }

  /**
   * Retry a dead task (move it back to pending)
   */
  async retryDead(taskId) {
    const task = this.history.find(t => t.id === taskId && t.status === STATUS.DEAD);
    if (!task) return false;
    
    task.status = STATUS.PENDING;
    task.retryCount = 0;
    task.lastError = null;
    task.nextRetryAt = null;
    task.updatedAt = new Date().toISOString();
    
    // Move from history back to queue
    this.history = this.history.filter(t => t.id !== taskId);
    this.queue.push(task);
    
    await this.persist();
    return true;
  }

  /**
   * Get queue status for dashboard
   */
  getStatus() {
    const pendingByPriority = {};
    for (const task of this.queue.filter(t => t.status === STATUS.PENDING)) {
      pendingByPriority[task.priority] = (pendingByPriority[task.priority] || 0) + 1;
    }
    
    return {
      pending: this.queue.filter(t => t.status === STATUS.PENDING).length,
      running: this.running.size,
      pendingByPriority,
      pendingByType: this.groupBy(this.queue.filter(t => t.status === STATUS.PENDING), 'type'),
      deadLetterCount: this.history.filter(t => t.status === STATUS.DEAD).length,
      recentCompleted: this.history.filter(t => t.status === STATUS.COMPLETED).slice(-5).map(t => ({
        id: t.id, type: t.type, completedAt: t.completedAt
      })),
      metrics: this.metrics,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get all pending tasks
   */
  getPending() {
    return this.queue.filter(t => t.status === STATUS.PENDING);
  }

  /**
   * Get dead letter tasks
   */
  getDeadLetters() {
    return this.history.filter(t => t.status === STATUS.DEAD);
  }

  /**
   * Get recent history
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Persist queue and history to disk
   */
  async persist() {
    try {
      await fs.writeFile(this.queueFile, JSON.stringify({
        queue: this.queue,
        metrics: this.metrics,
        lastPersisted: new Date().toISOString()
      }, null, 2));
      
      await fs.writeFile(this.historyFile, JSON.stringify(this.history, null, 2));
    } catch (error) {
      console.error('[TaskQueue] Failed to persist:', error.message);
    }
  }

  /**
   * Helper: group array by key
   */
  groupBy(arr, key) {
    return arr.reduce((acc, item) => {
      const group = item[key] || 'unknown';
      acc[group] = (acc[group] || 0) + 1;
      return acc;
    }, {});
  }
  
}
export default TaskQueue;
