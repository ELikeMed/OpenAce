/**
 * OpenAce Pipeline Manager
 * Kanban-style task and lead management
 */

import fs from 'fs/promises';
import path from 'path';
import { eventBus, EVENTS } from './EventBus.js';

export class PipelineManager {
  constructor(options = {}) {
    this.pipelinePath = options.pipelinePath;
    this.permissionsManager = options.permissionsManager;
    this.pipeline = null;
  }

  async initialize() {
    await this.loadPipeline();
    // Ensure required arrays exist (older/seeded pipelines may lack items or leads)
    if (!this.pipeline.items) this.pipeline.items = [];
    if (!this.pipeline.leads) this.pipeline.leads = [];
    if (!this.pipeline.stages) this.pipeline.stages = this.getDefaultPipeline().stages;
    console.log(`✅ Pipeline loaded (${this.pipeline.items.length} tasks, ${this.pipeline.leads.length} leads)`);
    return this;
  }

  async loadPipeline() {
    try {
      const data = await fs.readFile(this.pipelinePath, 'utf-8');
      this.pipeline = JSON.parse(data);
    } catch (error) {
      console.log('No pipeline found, creating default...');
      this.pipeline = this.getDefaultPipeline();
      await this.savePipeline();
    }
  }

  async savePipeline() {
    this.pipeline.updated_at = new Date().toISOString();
    await fs.writeFile(this.pipelinePath, JSON.stringify(this.pipeline, null, 2));
  }

  /**
   * Check permission for pipeline action
   */
  checkPermission(action) {
    if (!this.permissionsManager) {
      return { allowed: true };
    }
    return this.permissionsManager.checkPermission(action);
  }

  // ==========================================
  // TASK METHODS
  // ==========================================

  /**
   * Add a new task to the pipeline
   */
  async addTask(taskData) {
    const permission = this.checkPermission('pipeline_add_task');
    if (!permission.allowed && !permission.requiresApproval) {
      throw new Error(`Cannot add task: ${permission.reason}`);
    }

    const task = {
      id: `task-${Date.now()}`,
      type: 'task',
      title: taskData.title,
      description: taskData.description || '',
      stage: taskData.stage || 'inbox',
      priority: taskData.priority || 'medium',
      assigned_to: taskData.assigned_to || 'ace',
      created_by: taskData.created_by || 'user',
      due_date: taskData.due_date || null,
      tags: taskData.tags || [],
      notes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.pipeline.items.push(task);
    await this.savePipeline();

    console.log(`📋 Task added: ${task.title}`);
    eventBus.emit(EVENTS.TASK_ADDED, { task });
    return task;
  }

  /**
   * Update a task
   */
  async updateTask(taskId, updates) {
    const permission = this.checkPermission('pipeline_update');
    if (!permission.allowed && !permission.requiresApproval) {
      throw new Error(`Cannot update task: ${permission.reason}`);
    }

    const index = this.pipeline.items.findIndex(t => t.id === taskId);
    if (index === -1) {
      throw new Error('Task not found');
    }

    this.pipeline.items[index] = {
      ...this.pipeline.items[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.savePipeline();
    return this.pipeline.items[index];
  }

  /**
   * Move task to different stage
   */
  async moveTask(taskId, newStage) {
    const permission = this.checkPermission('pipeline_move');
    if (!permission.allowed && !permission.requiresApproval) {
      throw new Error(`Cannot move task: ${permission.reason}`);
    }

    const task = await this.updateTask(taskId, { stage: newStage });
    console.log(`📋 Task moved to ${newStage}: ${task.title}`);
    return task;
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    const permission = this.checkPermission('pipeline_delete');
    if (!permission.allowed) {
      throw new Error(`Cannot delete task: ${permission.reason}`);
    }

    const index = this.pipeline.items.findIndex(t => t.id === taskId);
    if (index === -1) {
      throw new Error('Task not found');
    }

    const task = this.pipeline.items.splice(index, 1)[0];
    await this.savePipeline();
    
    console.log(`🗑️ Task deleted: ${task.title}`);
    return task;
  }

  /**
   * Get all tasks
   */
  getTasks() {
    return this.pipeline.items;
  }

  /**
   * Get tasks by stage
   */
  getTasksByStage(stageId) {
    return this.pipeline.items.filter(t => t.stage === stageId);
  }

  /**
   * Get task by ID
   */
  getTask(taskId) {
    return this.pipeline.items.find(t => t.id === taskId);
  }

  // ==========================================
  // LEAD METHODS
  // ==========================================

  /**
   * Add a new lead
   */
  async addLead(leadData) {
    const permission = this.checkPermission('pipeline_add_lead');
    if (!permission.allowed && !permission.requiresApproval) {
      throw new Error(`Cannot add lead: ${permission.reason}`);
    }

    const lead = {
      id: `lead-${Date.now()}`,
      type: 'lead',
      company: leadData.company,
      contact_name: leadData.contact_name || '',
      email: leadData.email || '',
      phone: leadData.phone || '',
      website: leadData.website || '',
      stage: leadData.stage || 'new',
      value: leadData.value || 0,
      source: leadData.source || 'manual',
      form_id: leadData.form_id || null,
      submission_id: leadData.submission_id || null,
      do_not_contact: leadData.do_not_contact || false,
      notes: leadData.notes || [],
      tags: leadData.tags || [],
      created_by: leadData.created_by || 'ace',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.pipeline.leads.push(lead);
    await this.savePipeline();

    console.log(`👤 Lead added: ${lead.company}`);
    eventBus.emit(EVENTS.LEAD_ADDED, { lead });
    return lead;
  }

  /**
   * Update a lead
   */
  async updateLead(leadId, updates) {
    const permission = this.checkPermission('pipeline_update');
    if (!permission.allowed && !permission.requiresApproval) {
      throw new Error(`Cannot update lead: ${permission.reason}`);
    }

    const index = this.pipeline.leads.findIndex(l => l.id === leadId);
    if (index === -1) {
      throw new Error('Lead not found');
    }

    this.pipeline.leads[index] = {
      ...this.pipeline.leads[index],
      ...updates,
      updated_at: new Date().toISOString()
    };

    await this.savePipeline();
    return this.pipeline.leads[index];
  }

  /**
   * Add a note to a lead
   */
  async addNote(leadId, note, author = 'user') {
    const lead = this.getLead(leadId);
    if (!lead) throw new Error('Lead not found');
    const prefix = author === 'ace' ? '[Ace] ' : '';
    const formatted = `[${new Date().toLocaleDateString()}] ${prefix}${note}`;
    const notes = [...(lead.notes || []), formatted];
    return this.updateLead(leadId, { notes });
  }

  /**
   * Move lead to different stage
   */
  async moveLead(leadId, newStage) {
    const permission = this.checkPermission('pipeline_move');
    if (!permission.allowed && !permission.requiresApproval) {
      throw new Error(`Cannot move lead: ${permission.reason}`);
    }

    const lead = await this.updateLead(leadId, { stage: newStage });
    console.log(`👤 Lead moved to ${newStage}: ${lead.company}`);
    return lead;
  }

  /**
   * Delete a lead
   */
  async deleteLead(leadId) {
    const permission = this.checkPermission('pipeline_delete');
    if (!permission.allowed) {
      throw new Error(`Cannot delete lead: ${permission.reason}`);
    }

    const index = this.pipeline.leads.findIndex(l => l.id === leadId);
    if (index === -1) {
      throw new Error('Lead not found');
    }

    const lead = this.pipeline.leads.splice(index, 1)[0];
    await this.savePipeline();
    
    console.log(`🗑️ Lead deleted: ${lead.company}`);
    return lead;
  }

  /**
   * Get all leads
   */
  getLeads() {
    return this.pipeline.leads;
  }

  /**
   * Get leads by stage
   */
  getLeadsByStage(stageId) {
    return this.pipeline.leads.filter(l => l.stage === stageId);
  }

  /**
   * Get lead by ID
   */
  getLead(leadId) {
    return this.pipeline.leads.find(l => l.id === leadId);
  }

  // ==========================================
  // STAGE METHODS
  // ==========================================

  /**
   * Get task stages
   */
  getTaskStages() {
    return this.pipeline.stages;
  }

  /**
   * Get lead stages
   */
  getLeadStages() {
    return this.pipeline.lead_stages;
  }

  /**
   * Add custom stage
   */
  async addTaskStage(stageData) {
    const stage = {
      id: stageData.id || `stage-${Date.now()}`,
      name: stageData.name,
      color: stageData.color || '#6c757d',
      order: stageData.order || this.pipeline.stages.length + 1,
      auto_assign: stageData.auto_assign || null
    };

    this.pipeline.stages.push(stage);
    this.pipeline.stages.sort((a, b) => a.order - b.order);
    await this.savePipeline();

    return stage;
  }

  // ==========================================
  // STATISTICS
  // ==========================================

  /**
   * Get pipeline statistics
   */
  getStats() {
    const tasks = this.pipeline.items;
    const leads = this.pipeline.leads;

    return {
      tasks: {
        total: tasks.length,
        by_stage: this.pipeline.stages.map(s => ({
          stage: s.name,
          count: tasks.filter(t => t.stage === s.id).length
        })),
        by_priority: {
          urgent: tasks.filter(t => t.priority === 'urgent').length,
          high: tasks.filter(t => t.priority === 'high').length,
          medium: tasks.filter(t => t.priority === 'medium').length,
          low: tasks.filter(t => t.priority === 'low').length
        },
        assigned_to_ace: tasks.filter(t => t.assigned_to === 'ace').length
      },
      leads: {
        total: leads.length,
        by_stage: this.pipeline.lead_stages.map(s => ({
          stage: s.name,
          count: leads.filter(l => l.stage === s.id).length
        })),
        total_value: leads.reduce((sum, l) => sum + (l.value || 0), 0),
        won_value: leads.filter(l => l.stage === 'won').reduce((sum, l) => sum + (l.value || 0), 0)
      }
    };
  }

  /**
   * Get full pipeline data
   */
  getPipeline() {
    return this.pipeline;
  }

  /**
   * Get default pipeline structure
   */
  getDefaultPipeline() {
    return {
      stages: [
        { id: 'inbox', name: 'Inbox', color: '#6c757d', order: 1, auto_assign: 'ace' },
        { id: 'research', name: 'Research', color: '#007bff', order: 2, auto_assign: 'ace' },
        { id: 'in_progress', name: 'In Progress', color: '#ffc107', order: 3, auto_assign: null },
        { id: 'review', name: 'Review', color: '#17a2b8', order: 4, auto_assign: null },
        { id: 'done', name: 'Done', color: '#28a745', order: 5, auto_assign: null }
      ],
      items: [],
      lead_stages: [
        { id: 'new', name: 'New Lead', color: '#6c757d', order: 1 },
        { id: 'contacted', name: 'Contacted', color: '#007bff', order: 2 },
        { id: 'qualified', name: 'Qualified', color: '#17a2b8', order: 3 },
        { id: 'proposal', name: 'Proposal Sent', color: '#ffc107', order: 4 },
        { id: 'negotiation', name: 'Negotiation', color: '#fd7e14', order: 5 },
        { id: 'won', name: 'Won', color: '#28a745', order: 6 },
        { id: 'lost', name: 'Lost', color: '#dc3545', order: 7 }
      ],
      leads: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Toggle do-not-contact flag on a lead.
   */
  async setDoNotContact(leadId, value, reason) {
    const lead = this.pipeline.leads.find(l => l.id === leadId);
    if (!lead) throw new Error('Lead not found');

    lead.do_not_contact = !!value;
    lead.updated_at = new Date().toISOString();
    if (reason) {
      lead.notes.push(`[${new Date().toLocaleDateString()}] ${value ? 'Marked do-not-contact' : 'Removed do-not-contact'}: ${reason}`);
    }
    await this.savePipeline();
    return lead;
  }

  // ═══════════════════════════════════════════════════════
  // AUTONOMOUS PIPELINE INTELLIGENCE
  // ═══════════════════════════════════════════════════════

  /**
   * Get leads that need attention based on age and stage
   */
  getActionableLeads() {
    const now = Date.now();
    const leads = this.pipeline?.leads || [];
    const actionable = [];

    for (const lead of leads) {
      // Skip do-not-contact leads entirely
      if (lead.do_not_contact) continue;

      const age = now - new Date(lead.updated_at || lead.created_at).getTime();
      const ageHours = age / (1000 * 60 * 60);

      // New leads sitting >24h without action
      if (lead.stage === 'new' && ageHours > 24) {
        actionable.push({
          lead,
          action: 'research_and_outreach',
          reason: `New lead for ${Math.floor(ageHours / 24)} day(s) — needs research and initial contact`,
          priority: ageHours > 72 ? 'high' : 'medium',
        });
      }

      // Contacted leads with no follow-up in >48h
      if (lead.stage === 'contacted' && ageHours > 48) {
        actionable.push({
          lead,
          action: 'follow_up',
          reason: `Contacted ${Math.floor(ageHours / 24)} day(s) ago — needs follow-up`,
          priority: ageHours > 96 ? 'high' : 'medium',
        });
      }

      // Leads with missing contact info (not lost/won)
      if (!lead.email && !lead.phone && lead.stage !== 'lost' && lead.stage !== 'won') {
        actionable.push({
          lead,
          action: 'find_contact_info',
          reason: 'No email or phone — needs contact info research',
          priority: 'medium',
        });
      }
    }

    return actionable.sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return (p[a.priority] || 2) - (p[b.priority] || 2);
    });
  }

  /**
   * Get pipeline health summary for dashboards and routine injection
   */
  getHealthSummary() {
    const leads = this.pipeline?.leads || [];
    const now = Date.now();

    const newLeads = leads.filter(l => l.stage === 'new');
    const staleNew = newLeads.filter(l => {
      const age = now - new Date(l.updated_at || l.created_at).getTime();
      return age > 24 * 60 * 60 * 1000;
    });
    const contacted = leads.filter(l => l.stage === 'contacted');
    const staleContacted = contacted.filter(l => {
      const age = now - new Date(l.updated_at || l.created_at).getTime();
      return age > 48 * 60 * 60 * 1000;
    });
    const noContact = leads.filter(l => !l.email && !l.phone && l.stage !== 'lost' && l.stage !== 'won' && !l.do_not_contact);
    const won = leads.filter(l => l.stage === 'won');

    return {
      total: leads.length,
      new: newLeads.length,
      staleNew: staleNew.length,
      contacted: contacted.length,
      staleContacted: staleContacted.length,
      noContactInfo: noContact.length,
      won: won.length,
      needsAttention: staleNew.length + staleContacted.length + noContact.length,
    };
  }
}

export default PipelineManager;
