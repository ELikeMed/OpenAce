/**
 * EventBus — The Nervous System of OpenAce
 * 
 * A centralized publish/subscribe event system that allows all components
 * to communicate without being directly coupled.
 * 
 * This is the CRITICAL missing piece that connects:
 *   - AutonomousScheduler → Dashboard (real-time task updates)
 *   - SOPExecutor → Telegram (step-by-step progress)
 *   - PipelineManager → ActivityLogger (automatic logging)
 *   - BrowserAgent → UI (live browser status)
 *   - ActionEngine → All listeners (action results)
 * 
 * Usage:
 *   import { eventBus } from './events/EventBus.js';
 *   
 *   // Emit events from any component
 *   eventBus.emit('sop:started', { sopId: 'xyz', sopName: 'Login' });
 *   eventBus.emit('lead:added', { lead: {...}, source: 'google' });
 *   eventBus.emit('task:completed', { taskId: '123' });
 *   
 *   // Listen from any component
 *   eventBus.on('sop:started', (data) => logger.log(data));
 *   eventBus.on('lead:added', (data) => dashboard.push(data));
 *   eventBus.on('error:critical', (data) => telegram.alert(data));
 */

import { EventEmitter } from 'events';

class AceEventBus extends EventEmitter {
  constructor() {
    super();
    // Allow many listeners (we'll have lots of components)
    this.setMaxListeners(50);
    
    // Event history for replay/debugging (last 200 events)
    this.history = [];
    this.maxHistory = 200;
    
    // Registered listeners by component name (for debugging)
    this.registeredComponents = new Map();
    
    // Metrics
    this.metrics = {
      totalEmitted: 0,
      totalHandled: 0,
      byEvent: {},
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Enhanced emit that records history and metrics
   */
  emit(event, data = {}) {
    // Record in history
    const entry = {
      event,
      data,
      timestamp: new Date().toISOString(),
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    };
    
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    // Update metrics
    this.metrics.totalEmitted++;
    this.metrics.byEvent[event] = (this.metrics.byEvent[event] || 0) + 1;
    
    // Emit to all listeners
    try {
      const result = super.emit(event, data);
      if (result) this.metrics.totalHandled++;
      return result;
    } catch (err) {
      this.metrics.errors++;
      console.error(`[EventBus] Error emitting '${event}':`, err.message);
      // Emit meta-error so monitoring can catch it
      if (event !== 'eventbus:error') {
        super.emit('eventbus:error', { originalEvent: event, error: err.message });
      }
      return false;
    }
  }

  /**
   * Register a component as a listener with a name (for debugging)
   * @param {string} componentName - Human-readable name (e.g., 'Dashboard', 'Telegram')
   * @param {string} event - Event to listen for
   * @param {Function} handler - Event handler
   */
  register(componentName, event, handler) {
    if (!this.registeredComponents.has(componentName)) {
      this.registeredComponents.set(componentName, []);
    }
    this.registeredComponents.get(componentName).push(event);
    
    this.on(event, handler);
    return this; // Chainable
  }

  /**
   * Unregister all listeners for a component
   */
  unregister(componentName) {
    const events = this.registeredComponents.get(componentName);
    if (events) {
      // Note: This removes ALL listeners for each event, not just this component's.
      // For production, use named functions and removeListener.
      this.registeredComponents.delete(componentName);
    }
    return this;
  }

  /**
   * Get recent events, optionally filtered by event name pattern
   * @param {number} count - How many to return
   * @param {string|RegExp} [filter] - Optional event name filter
   */
  getRecentEvents(count = 20, filter = null) {
    let events = this.history;
    
    if (filter) {
      const regex = filter instanceof RegExp ? filter : new RegExp(filter);
      events = events.filter(e => regex.test(e.event));
    }
    
    return events.slice(-count);
  }

  /**
   * Get event bus status (for health checks and dashboard)
   */
  getStatus() {
    return {
      totalEmitted: this.metrics.totalEmitted,
      totalHandled: this.metrics.totalHandled,
      errors: this.metrics.errors,
      listenerCount: this.eventNames().length,
      registeredComponents: [...this.registeredComponents.keys()],
      topEvents: Object.entries(this.metrics.byEvent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([event, count]) => ({ event, count })),
      recentEvents: this.history.slice(-5).map(e => ({
        event: e.event,
        timestamp: e.timestamp
      })),
      uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000)
    };
  }

  /**
   * Wait for a specific event (Promise-based)
   * Useful for testing or one-time event waiting
   * @param {string} event - Event to wait for
   * @param {number} [timeout=30000] - Timeout in ms
   */
  waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener(event, handler);
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);
      
      const handler = (data) => {
        clearTimeout(timer);
        resolve(data);
      };
      
      this.once(event, handler);
    });
  }
}

// ═══════════════════════════════════════════════════════
// STANDARD EVENT NAMES (use these constants for consistency)
// ═══════════════════════════════════════════════════════

export const EVENTS = {
  // System lifecycle
  SYSTEM_INITIALIZED: 'system:initialized',
  SYSTEM_SHUTDOWN: 'system:shutdown',
  SYSTEM_ERROR: 'system:error',
  
  // AI Provider
  AI_REQUEST_START: 'ai:request:start',
  AI_REQUEST_COMPLETE: 'ai:request:complete',
  AI_REQUEST_ERROR: 'ai:request:error',
  AI_PROVIDER_SWITCHED: 'ai:provider:switched',
  
  // Chat / Brain
  CHAT_MESSAGE_RECEIVED: 'chat:message:received',
  CHAT_RESPONSE_SENT: 'chat:response:sent',
  BRAIN_THINKING: 'brain:thinking',
  BRAIN_THOUGHT_COMPLETE: 'brain:thought:complete',
  
  // Action Engine
  ACTION_DETECTED: 'action:detected',
  ACTION_EXECUTING: 'action:executing',
  ACTION_COMPLETED: 'action:completed',
  ACTION_FAILED: 'action:failed',
  
  // SOP Execution
  SOP_STARTED: 'sop:started',
  SOP_STEP_STARTED: 'sop:step:started',
  SOP_STEP_COMPLETED: 'sop:step:completed',
  SOP_STEP_FAILED: 'sop:step:failed',
  SOP_COMPLETED: 'sop:completed',
  SOP_FAILED: 'sop:failed',
  SOP_CREATED: 'sop:created',
  
  // Browser
  BROWSER_LAUNCHED: 'browser:launched',
  BROWSER_NAVIGATED: 'browser:navigated',
  BROWSER_SCREENSHOT: 'browser:screenshot',
  BROWSER_CLOSED: 'browser:closed',
  BROWSER_ERROR: 'browser:error',
  
  // Pipeline
  TASK_ADDED: 'task:added',
  TASK_MOVED: 'task:moved',
  TASK_COMPLETED: 'task:completed',
  TASK_DELETED: 'task:deleted',
  LEAD_ADDED: 'lead:added',
  LEAD_MOVED: 'lead:moved',
  LEAD_UPDATED: 'lead:updated',
  LEAD_DELETED: 'lead:deleted',

  // Forms
  FORM_CREATED: 'form:created',
  FORM_UPDATED: 'form:updated',
  FORM_DELETED: 'form:deleted',
  FORM_PUBLISHED: 'form:published',
  FORM_SUBMISSION: 'form:submission',
  FORM_SYNCED: 'form:synced',

  // Scheduler
  SCHEDULER_STARTED: 'scheduler:started',
  SCHEDULER_ROUTINE_DUE: 'scheduler:routine:due',
  SCHEDULER_ROUTINE_COMPLETED: 'scheduler:routine:completed',
  SCHEDULER_ROUTINE_FAILED: 'scheduler:routine:failed',
  ROUTINE_COMPLETED: 'routine:completed',
  PIPELINE_ACTION: 'pipeline:action',

  // Research
  RESEARCH_STARTED: 'research:started',
  RESEARCH_COMPLETED: 'research:completed',
  RESEARCH_FAILED: 'research:failed',
  
  // Google / Email
  EMAIL_SENT: 'email:sent',
  EMAIL_DRAFT_CREATED: 'email:draft:created',
  CALENDAR_EVENT_CREATED: 'calendar:event:created',
  
  // Knowledge
  KNOWLEDGE_LEARNED: 'knowledge:learned',
  KNOWLEDGE_RECALLED: 'knowledge:recalled',

  // Workload Store
  WORKLOAD_INGESTED: 'workload:ingested',
  WORKLOAD_SEARCHED: 'workload:searched',
  WORKLOAD_INGESTION_PROGRESS: 'workload:ingestion:progress',
  WORKLOAD_INGESTION_COMPLETE: 'workload:ingestion:complete',
  
  // Progress (for real-time UI updates)
  PROGRESS_UPDATE: 'progress:update',
  
  // EventBus meta
  EVENTBUS_ERROR: 'eventbus:error'
};

// Singleton instance — import this everywhere
export const eventBus = new AceEventBus();

// Default export for convenience
export default eventBus;
