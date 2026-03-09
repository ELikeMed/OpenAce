/**
 * ApprovalQueue — Human-in-the-Loop Approval System with Adaptive Trust
 *
 * When Ace's autonomy level requires it, risky actions are queued
 * for user approval instead of being executed immediately.
 *
 * Modes (from soul.json):
 *   Guardian (1)     — Ask before doing anything beyond reading data
 *   Collaborative (2) — Auto-execute safe actions, ask for medium/high risk
 *   Trusted (3)       — Auto-execute most things, only ask for critical
 *   Autopilot (4)     — Execute everything, just notify on completion
 *
 * Adaptive Trust:
 *   Every approval/rejection updates a trust profile. When the user
 *   approves the same action type 5+ times, it gets auto-approved.
 *   When rejected 3+ times, it always asks — regardless of autonomy level.
 *
 * Risk levels:
 *   1 (low)      - Data reads, research, pipeline queries
 *   2 (med)      - Browser navigation, SOP execution, project edits
 *   3 (high)     - Sending emails, posting to social media, modifying data
 *   4 (critical) - Deployment, credential changes, bulk operations
 */

import { eventBus, EVENTS } from '../events/EventBus.js';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

// Action risk classification
const ACTION_RISK_LEVELS = {
  // Risk 1 — Safe reads
  'pipeline_status': 1,
  'research': 1,
  'conversation': 1,
  'use_skill': 1,

  // Risk 2 — Browser actions & SOPs
  'browse': 2,
  'run_sop': 2,
  'find_leads': 2,
  'create_strategy': 2,

  // Risk 3 — Data modification & outbound
  'add_task': 2,
  'add_lead': 2,
  'move_task': 2,
  'move_lead': 2,
  'send_email': 3,
  'social_media': 3,
  'schedule_routine': 3,
  'edit_project': 2,

  // Risk 4 — Critical
  'deploy_project': 4,
  'system_maintenance': 4,
  'create_project': 3,
};

// Soul.json mode names → numeric levels
const MODE_NAMES = {
  guardian: 1,
  collaborative: 2,
  trusted: 3,
  autopilot: 4,
};

// Auto-approve threshold: user approved this type N times → skip approval
const AUTO_APPROVE_THRESHOLD = 5;
// Always-ask threshold: user rejected this type N times → always ask
const ALWAYS_ASK_THRESHOLD = 3;

export class ApprovalQueue {
  constructor(options = {}) {
    this.queue = [];           // Pending approvals
    this.history = [];         // Completed/rejected approvals
    this.maxHistory = 200;
    this.dataDir = options.dataDir || './data/approvals';
    this.onProgress = options.onProgress || ((msg) => console.log(`[ApprovalQueue] ${msg}`));

    // Callback for when an action is approved
    this.onApproved = null;

    // Adaptive trust profile — learned from user's approval patterns
    this.trustProfile = {};
    this.trustProfilePath = path.join(this.dataDir, 'trust-profile.json');

    this.initialized = false;
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });

    // Load pending approvals from disk
    try {
      const data = await fs.readFile(path.join(this.dataDir, 'pending.json'), 'utf8');
      this.queue = JSON.parse(data);
    } catch (e) {
      this.queue = [];
    }

    // Load history
    try {
      const data = await fs.readFile(path.join(this.dataDir, 'history.json'), 'utf8');
      this.history = JSON.parse(data);
    } catch (e) {
      this.history = [];
    }

    // Load trust profile
    try {
      if (existsSync(this.trustProfilePath)) {
        this.trustProfile = JSON.parse(readFileSync(this.trustProfilePath, 'utf-8'));
      }
    } catch (e) {
      this.trustProfile = {};
    }

    this.initialized = true;
    const trustCount = Object.keys(this.trustProfile).length;
    console.log(`✅ ApprovalQueue initialized (${this.queue.length} pending, ${trustCount} trust patterns)`);
    return this;
  }

  /**
   * Check if an action needs approval based on autonomy level + trust profile.
   * Trust profile overrides: auto-approved patterns skip the queue,
   * always-rejected patterns always queue regardless of level.
   *
   * @param {string} actionType - The intent/action type
   * @param {number|string} autonomyLevel - Numeric (1-5) or mode name (guardian/collaborative/trusted/autopilot)
   * @returns {{ needed: boolean, autoApprovalNote: string|null, reason: string }}
   */
  needsApproval(actionType, autonomyLevel = 3) {
    // Accept mode names from soul.json
    if (typeof autonomyLevel === 'string') {
      autonomyLevel = MODE_NAMES[autonomyLevel.toLowerCase()] || 3;
    }
    if (autonomyLevel >= 5) return { needed: false, autoApprovalNote: null, reason: 'full_auto' };

    // Check trust profile FIRST — learned patterns override defaults
    const trust = this.trustProfile[actionType];
    if (trust) {
      // User always rejects this → always ask, no matter the level
      if (trust.rejections >= ALWAYS_ASK_THRESHOLD && trust.approvalRate < 0.3) {
        return { needed: true, autoApprovalNote: null, reason: 'always_ask_trust' };
      }
      // User consistently approves this → auto-approve
      if (trust.approvals >= AUTO_APPROVE_THRESHOLD && trust.approvalRate > 0.8) {
        this.onProgress(`🤝 Auto-approved "${actionType}" (trusted pattern: ${trust.approvals} approvals)`);
        return {
          needed: false,
          autoApprovalNote: `I went ahead and did this since you've approved "${actionType}" ${trust.approvals} times before.`,
          reason: 'trusted_pattern',
        };
      }
    }

    const riskLevel = ACTION_RISK_LEVELS[actionType] || 2;

    // Autonomy level determines the approval threshold
    // Guardian (1): queue anything above risk 1
    // Collaborative (2): queue above risk 2
    // Trusted (3): queue above risk 3
    // Autopilot (4): queue only risk 4
    const thresholds = { 1: 1, 2: 2, 3: 3, 4: 3 };
    const threshold = thresholds[autonomyLevel] || 2;

    return {
      needed: riskLevel > threshold,
      autoApprovalNote: null,
      reason: riskLevel > threshold ? 'risk_above_threshold' : 'within_autonomy',
    };
  }

  /**
   * Get the risk level for an action
   */
  getRiskLevel(actionType) {
    return ACTION_RISK_LEVELS[actionType] || 2;
  }

  /**
   * Queue an action for approval
   * @param {object} action - The action to queue
   * @returns {object} The queued approval item
   */
  async queueForApproval(action) {
    const item = {
      id: `approval_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      actionType: action.type || action.intent || 'unknown',
      title: action.title || action.description || `Execute: ${action.type}`,
      description: action.description || action.message || '',
      riskLevel: this.getRiskLevel(action.type || action.intent),
      params: action.params || {},
      context: action.context || {},
      status: 'pending',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      resolvedBy: null,
    };

    this.queue.push(item);
    await this.savePending();

    this.onProgress(`⏳ Queued for approval: "${item.title}" (risk: ${item.riskLevel})`);

    eventBus.emit('approval:queued', {
      id: item.id,
      actionType: item.actionType,
      title: item.title,
      riskLevel: item.riskLevel,
      pendingCount: this.queue.length
    });

    return item;
  }

  /**
   * Approve a queued action — also updates trust profile
   * @param {string} id - Approval ID
   * @param {string} approvedBy - Who approved (default: 'user')
   * @returns {object} The approved item (to be executed)
   */
  async approve(id, approvedBy = 'user') {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Approval not found: ${id}`);
    }

    const item = this.queue.splice(index, 1)[0];
    item.status = 'approved';
    item.resolvedAt = new Date().toISOString();
    item.resolvedBy = approvedBy;

    this.history.push(item);
    if (this.history.length > this.maxHistory) this.history.shift();

    await this.savePending();
    await this.saveHistory();

    // Update trust profile — Ace learns that this action type is trusted
    this._updateTrust(item.actionType, 'approved');

    this.onProgress(`✅ Approved: "${item.title}"`);

    eventBus.emit('approval:approved', {
      id: item.id,
      actionType: item.actionType,
      title: item.title,
      pendingCount: this.queue.length
    });

    return item;
  }

  /**
   * Reject a queued action — also updates trust profile
   * @param {string} id - Approval ID
   * @param {string} reason - Rejection reason
   * @param {string} rejectedBy - Who rejected
   */
  async reject(id, reason = '', rejectedBy = 'user') {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Approval not found: ${id}`);
    }

    const item = this.queue.splice(index, 1)[0];
    item.status = 'rejected';
    item.resolvedAt = new Date().toISOString();
    item.resolvedBy = rejectedBy;
    item.rejectionReason = reason;

    this.history.push(item);
    if (this.history.length > this.maxHistory) this.history.shift();

    await this.savePending();
    await this.saveHistory();

    // Update trust profile — Ace learns that this action type needs caution
    this._updateTrust(item.actionType, 'rejected');

    this.onProgress(`❌ Rejected: "${item.title}" — ${reason || 'no reason'}`);

    eventBus.emit('approval:rejected', {
      id: item.id,
      actionType: item.actionType,
      title: item.title,
      reason,
      pendingCount: this.queue.length
    });

    return item;
  }

  /**
   * Get all pending approvals
   */
  getPending() {
    return this.queue.filter(item => item.status === 'pending');
  }

  /**
   * Get approval history
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  /**
   * Get counts
   */
  getCounts() {
    return {
      pending: this.queue.length,
      approved: this.history.filter(h => h.status === 'approved').length,
      rejected: this.history.filter(h => h.status === 'rejected').length,
      total: this.history.length
    };
  }

  /**
   * Get the trust profile — shows what Ace has learned about user preferences
   */
  getTrustProfile() {
    return this.trustProfile;
  }

  /**
   * Reset trust for a specific action type (user wants to un-learn a pattern)
   */
  async resetTrust(actionType) {
    delete this.trustProfile[actionType];
    await this._saveTrustProfile();
  }

  /**
   * Reset all trust (start fresh)
   */
  async resetAllTrust() {
    this.trustProfile = {};
    await this._saveTrustProfile();
  }

  // ─── Adaptive Trust ──────────────────────────

  /**
   * Update the trust profile when an action is approved/rejected.
   * This is how Ace learns: every decision the user makes teaches
   * Ace what to auto-do vs. what to always ask about.
   */
  _updateTrust(actionType, decision) {
    if (!actionType || actionType === 'unknown') return;

    if (!this.trustProfile[actionType]) {
      this.trustProfile[actionType] = {
        approvals: 0,
        rejections: 0,
        approvalRate: 0,
        lastDecision: null,
        lastUpdated: null,
      };
    }

    const entry = this.trustProfile[actionType];
    if (decision === 'approved') {
      entry.approvals++;
    } else {
      entry.rejections++;
    }

    const total = entry.approvals + entry.rejections;
    entry.approvalRate = total > 0 ? entry.approvals / total : 0;
    entry.lastDecision = decision;
    entry.lastUpdated = new Date().toISOString();

    // Log the learning + emit SSE events
    if (entry.approvals === AUTO_APPROVE_THRESHOLD && entry.approvalRate > 0.8) {
      this.onProgress(`🧠 Learned: "${actionType}" is trusted (${entry.approvals} consecutive approvals — will auto-approve)`);
      eventBus.emit('approval:trust:learned', {
        actionType,
        learned: 'auto_approve',
        message: `Ace learned to auto-approve "${actionType}" after ${entry.approvals} approvals`,
        approvals: entry.approvals,
        approvalRate: entry.approvalRate,
      });
    }
    if (entry.rejections === ALWAYS_ASK_THRESHOLD && entry.approvalRate < 0.3) {
      this.onProgress(`🧠 Learned: "${actionType}" needs caution (${entry.rejections} rejections — will always ask)`);
      eventBus.emit('approval:trust:learned', {
        actionType,
        learned: 'always_ask',
        message: `Ace learned to always ask about "${actionType}" after ${entry.rejections} rejections`,
        rejections: entry.rejections,
        approvalRate: entry.approvalRate,
      });
    }

    // Save async (non-blocking)
    this._saveTrustProfile();
  }

  // ─── Persistence ─────────────────────────────

  async savePending() {
    try {
      await fs.writeFile(
        path.join(this.dataDir, 'pending.json'),
        JSON.stringify(this.queue, null, 2)
      );
    } catch (e) { /* ignore */ }
  }

  async saveHistory() {
    try {
      await fs.writeFile(
        path.join(this.dataDir, 'history.json'),
        JSON.stringify(this.history.slice(-this.maxHistory), null, 2)
      );
    } catch (e) { /* ignore */ }
  }

  async _saveTrustProfile() {
    try {
      await fs.writeFile(
        this.trustProfilePath,
        JSON.stringify(this.trustProfile, null, 2)
      );
    } catch (e) { /* ignore */ }
  }
}

export default ApprovalQueue;
