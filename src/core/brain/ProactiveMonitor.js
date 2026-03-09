/**
 * ProactiveMonitor — Autonomous Insight Generation
 * 
 * SuperBrain Phase 4: Instead of only responding when asked, Ace monitors
 * the system state and proactively generates insights, warnings, and suggestions.
 * 
 * Monitors:
 * - Pipeline health (stuck leads, overdue tasks, idle pipeline)
 * - Scheduler status (failed routines, missed schedules)
 * - Knowledge gaps (frequently asked topics with no knowledge)
 * - Opportunity detection (trends in data, time-based triggers)
 * - System health (memory usage, error rates, provider status)
 * 
 * Outputs insights via EventBus so Dashboard and Telegram can display them.
 * 
 * Usage:
 *   const monitor = new ProactiveMonitor({ ... });
 *   monitor.start(60000); // Check every 60 seconds
 */

import { eventBus, EVENTS } from '../events/EventBus.js';

export class ProactiveMonitor {
  constructor(options = {}) {
    this.pipelineManager = options.pipelineManager || null;
    this.taskQueue = options.taskQueue || null;
    this.knowledgeBase = options.knowledgeBase || null;
    this.autonomousScheduler = options.autonomousScheduler || null;
    this.stateManager = options.stateManager || null;
    this.onProgress = options.onProgress || ((msg) => console.log(`[ProactiveMonitor] ${msg}`));
    
    // State
    this.isRunning = false;
    this.checkInterval = null;
    this.insights = [];
    this.maxInsights = 50;
    this.lastCheck = null;
    
    // Thresholds
    this.thresholds = {
      stuckLeadDays: 7,           // Lead hasn't moved stages in 7 days
      overdueTaskDays: 3,         // Task in 'in_progress' for 3+ days
      idlePipelineDays: 2,        // No pipeline activity in 2 days
      failedQueueTaskThreshold: 3, // 3+ failed tasks → alert
      lowKnowledgeThreshold: 5,   // Less than 5 entries → suggest learning
      highErrorRate: 10            // 10+ errors in event bus → alert
    };
  }

  /**
   * Start the proactive monitoring loop
   * @param {number} intervalMs - How often to check (default: 5 minutes)
   */
  start(intervalMs = 300000) {
    // No longer starts its own interval, will be triggered by HeartbeatMonitor
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    console.log('🔮 ProactiveMonitor stopped');
  }

  /**
   * Run all proactive checks
   */
  async runChecks() {
    this.lastCheck = new Date().toISOString();
    const newInsights = [];

    try {
      // 1. Pipeline health
      const pipelineInsights = await this.checkPipeline();
      newInsights.push(...pipelineInsights);

      // 2. Task queue health
      const queueInsights = this.checkTaskQueue();
      newInsights.push(...queueInsights);

      // 3. Knowledge base gaps
      const knowledgeInsights = this.checkKnowledge();
      newInsights.push(...knowledgeInsights);

      // 4. System health
      const systemInsights = this.checkSystemHealth();
      newInsights.push(...systemInsights);

      // 5. Time-based triggers
      const timeInsights = this.checkTimeTriggers();
      newInsights.push(...timeInsights);

    } catch (error) {
      console.error('[ProactiveMonitor] Check failed:', error.message);
    }

    // Emit new insights
    for (const insight of newInsights) {
      // Avoid duplicate insights (same type within 1 hour)
      const isDuplicate = this.insights.some(existing =>
        existing.type === insight.type &&
        existing.key === insight.key &&
        (Date.now() - new Date(existing.timestamp).getTime()) < 3600000
      );

      if (!isDuplicate) {
        insight.id = `insight_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        insight.timestamp = new Date().toISOString();
        insight.read = false;

        this.insights.push(insight);
        eventBus.emit('proactive:insight', insight);
      }
    }

    // Trim insights
    if (this.insights.length > this.maxInsights) {
      this.insights = this.insights.slice(-this.maxInsights);
    }
  }

  /**
   * Check pipeline for stuck leads, overdue tasks, idle state
   */
  async checkPipeline() {
    const insights = [];
    if (!this.pipelineManager) return insights;

    try {
      const pipeline = await this.pipelineManager.getPipeline();
      const tasks = pipeline.items || [];
      const leads = pipeline.leads || [];
      const now = Date.now();

      // Check for stuck leads (in same stage for too long)
      for (const lead of leads) {
        if (lead.stage === 'won' || lead.stage === 'lost') continue;
        const lastUpdate = new Date(lead.updated_at || lead.created_at).getTime();
        const daysSince = (now - lastUpdate) / (1000 * 60 * 60 * 24);
        
        if (daysSince > this.thresholds.stuckLeadDays) {
          insights.push({
            type: 'warning',
            category: 'pipeline',
            key: `stuck_lead_${lead.id}`,
            title: `Lead stuck: ${lead.company || lead.name}`,
            message: `Lead "${lead.company || lead.name}" has been in "${lead.stage}" for ${Math.floor(daysSince)} days. Consider following up or updating the stage.`,
            action: { type: 'move_lead', leadId: lead.id },
            severity: 'medium'
          });
        }
      }

      // Check for overdue tasks
      for (const task of tasks) {
        if (task.stage === 'done') continue;
        if (task.stage === 'in_progress') {
          const lastUpdate = new Date(task.updated_at || task.created_at).getTime();
          const daysSince = (now - lastUpdate) / (1000 * 60 * 60 * 24);
          
          if (daysSince > this.thresholds.overdueTaskDays) {
            insights.push({
              type: 'warning',
              category: 'pipeline',
              key: `overdue_task_${task.id}`,
              title: `Task overdue: ${task.title}`,
              message: `Task "${task.title}" has been in progress for ${Math.floor(daysSince)} days. Is it blocked?`,
              action: { type: 'review_task', taskId: task.id },
              severity: 'medium'
            });
          }
        }
      }

      // Check for idle pipeline
      const allItems = [...tasks, ...leads];
      if (allItems.length > 0) {
        const mostRecent = Math.max(...allItems.map(i => new Date(i.updated_at || i.created_at).getTime()));
        const daysSinceActivity = (now - mostRecent) / (1000 * 60 * 60 * 24);
        
        if (daysSinceActivity > this.thresholds.idlePipelineDays) {
          insights.push({
            type: 'suggestion',
            category: 'pipeline',
            key: 'idle_pipeline',
            title: 'Pipeline is idle',
            message: `No pipeline activity in ${Math.floor(daysSinceActivity)} days. Want me to search for new leads or review pending tasks?`,
            severity: 'low'
          });
        }
      }

      // Pipeline summary
      const newLeads = leads.filter(l => l.stage === 'new').length;
      if (newLeads > 5) {
        insights.push({
          type: 'suggestion',
          category: 'pipeline',
          key: 'many_new_leads',
          title: `${newLeads} uncontacted leads`,
          message: `You have ${newLeads} leads in "New" stage. Want me to start reaching out?`,
          severity: 'low'
        });
      }
    } catch (error) {
      // Pipeline not available
    }

    return insights;
  }

  /**
   * Check task queue for failed tasks
   */
  checkTaskQueue() {
    const insights = [];
    if (!this.taskQueue) return insights;

    const status = this.taskQueue.getStatus();
    
    if (status.deadLetterCount >= this.thresholds.failedQueueTaskThreshold) {
      insights.push({
        type: 'error',
        category: 'system',
        key: 'dead_letter_tasks',
        title: `${status.deadLetterCount} failed tasks in queue`,
        message: `${status.deadLetterCount} tasks have exceeded max retries. Review dead letter queue.`,
        severity: 'high'
      });
    }

    return insights;
  }

  /**
   * Check knowledge base for gaps
   */
  checkKnowledge() {
    const insights = [];
    if (!this.knowledgeBase) return insights;

    const stats = this.knowledgeBase.getStats();
    
    if (stats.total < this.thresholds.lowKnowledgeThreshold) {
      insights.push({
        type: 'suggestion',
        category: 'knowledge',
        key: 'low_knowledge',
        title: 'Knowledge base is sparse',
        message: `Only ${stats.total} entries in knowledge base. The more I learn, the better I perform. Try teaching me about your business, processes, and preferences.`,
        severity: 'low'
      });
    }

    return insights;
  }

  /**
   * Check system health
   */
  checkSystemHealth() {
    const insights = [];

    // Check EventBus error rate
    const busStatus = eventBus.getStatus();
    if (busStatus.errors > this.thresholds.highErrorRate) {
      insights.push({
        type: 'error',
        category: 'system',
        key: 'high_error_rate',
        title: 'High error rate detected',
        message: `EventBus has recorded ${busStatus.errors} errors. Some components may be malfunctioning.`,
        severity: 'high'
      });
    }

    // Check memory usage
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    if (heapUsedMB > 400) {
      insights.push({
        type: 'warning',
        category: 'system',
        key: 'high_memory',
        title: 'High memory usage',
        message: `Heap usage is ${heapUsedMB}MB. Consider restarting if performance degrades.`,
        severity: 'medium'
      });
    }

    return insights;
  }

  /**
   * Check time-based triggers (morning greeting, weekly review, etc.)
   */
  checkTimeTriggers() {
    const insights = [];
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay(); // 0=Sunday, 1=Monday, ...

    // Monday morning: weekly review suggestion
    if (day === 1 && hour >= 8 && hour <= 10) {
      insights.push({
        type: 'suggestion',
        category: 'productivity',
        key: 'weekly_review',
        title: '📅 Monday: Weekly Review',
        message: 'Good morning! Ready to review last week\'s pipeline, plan this week\'s priorities, and check on pending leads?',
        severity: 'low'
      });
    }

    // Friday afternoon: week wrap-up
    if (day === 5 && hour >= 15 && hour <= 17) {
      insights.push({
        type: 'suggestion',
        category: 'productivity',
        key: 'week_wrapup',
        title: '📋 Friday: Week Wrap-up',
        message: 'End of week approaching. Want me to generate a weekly summary of completed tasks, new leads, and upcoming items?',
        severity: 'low'
      });
    }

    return insights;
  }

  /**
   * Get all unread insights
   */
  getUnreadInsights() {
    return this.insights.filter(i => !i.read);
  }

  /**
   * Mark an insight as read
   */
  markAsRead(insightId) {
    const insight = this.insights.find(i => i.id === insightId);
    if (insight) insight.read = true;
  }

  /**
   * Mark all insights as read
   */
  markAllAsRead() {
    for (const insight of this.insights) {
      insight.read = true;
    }
  }

  /**
   * Get all insights
   */
  getAllInsights(limit = 20) {
    return this.insights.slice(-limit);
  }

  /**
   * Get status for health checks
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      lastCheck: this.lastCheck,
      totalInsights: this.insights.length,
      unreadInsights: this.insights.filter(i => !i.read).length,
      insightsByCategory: this.insights.reduce((acc, i) => {
        acc[i.category] = (acc[i.category] || 0) + 1;
        return acc;
      }, {}),
      insightsBySeverity: this.insights.reduce((acc, i) => {
        acc[i.severity] = (acc[i.severity] || 0) + 1;
        return acc;
      }, {})
    };
  }
}

export default ProactiveMonitor;
