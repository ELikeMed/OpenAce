/**
 * CreditManager — Track credit balance, trial status, and tool usage.
 *
 * Data stored in: data/billing/credits.json
 * Every tool call = 1 credit. Chat is always free.
 *
 * Plans:
 *   - trial:   10-day free trial, full access, no credit card
 *   - credits: $15/mo subscription (1,500 credits/month) + purchasable top-ups
 *   - byo_key: $15/mo platform fee, no credit limits (user provides own AI key)
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const TRIAL_DAYS = 10;
const GRACE_DAYS = 3;
const MONTHLY_CREDITS = 1500;
const MAX_USAGE_LOG = 500;

class CreditManager {
  constructor({ dataDir = 'data/billing' } = {}) {
    this.dataDir = dataDir;
    this.filePath = path.join(dataDir, 'credits.json');
    this.data = null;
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this._load();

    // First run — create trial
    if (!this.data) {
      const now = new Date();
      const expires = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      this.data = {
        plan: 'trial',
        trialStartDate: now.toISOString(),
        trialExpiresAt: expires.toISOString(),
        subscriptionCredits: 0,
        purchasedCredits: 0,
        autoReload: { enabled: false, amount: 0, threshold: 0 },
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
        usageLog: [],
      };
      await this._save();
      console.log(`[CreditManager] Trial started — expires ${expires.toLocaleDateString()}`);
    } else {
      const balance = this.getBalance();
      console.log(`[CreditManager] Plan: ${balance.plan}, Credits: ${balance.total}, Trial days left: ${balance.trialDaysLeft ?? 'N/A'}`);
    }

    return this;
  }

  // ═══════════════════════════════════════════════════════════
  // BALANCE & STATUS
  // ═══════════════════════════════════════════════════════════

  getBalance() {
    const d = this.data;
    const total = (d.subscriptionCredits || 0) + (d.purchasedCredits || 0);

    let trialDaysLeft = null;
    let trialExpired = false;
    let graceExpired = false;

    if (d.trialExpiresAt) {
      const msLeft = new Date(d.trialExpiresAt).getTime() - Date.now();
      trialDaysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      trialExpired = trialDaysLeft <= 0;
      graceExpired = trialDaysLeft <= -GRACE_DAYS;
    }

    return {
      plan: d.plan,
      subscriptionCredits: d.subscriptionCredits || 0,
      purchasedCredits: d.purchasedCredits || 0,
      total,
      trialDaysLeft,
      trialExpired,
      graceExpired,
      autoReload: d.autoReload,
      stripeCustomerId: d.stripeCustomerId,
      stripeSubscriptionId: d.stripeSubscriptionId,
      currentPeriodEnd: d.currentPeriodEnd,
    };
  }

  /**
   * Can the user execute a tool right now?
   * - Trial (not grace-expired): yes
   * - BYO key plan: yes (no credit limits)
   * - Credits plan with balance > 0: yes
   * - Otherwise: no
   */
  canUseTool() {
    const b = this.getBalance();

    // BYO key — no limits
    if (b.plan === 'byo_key') return true;

    // Active trial (including grace period)
    if (b.plan === 'trial' && !b.graceExpired) return true;

    // Credits plan with balance
    if (b.plan === 'credits' && b.total > 0) return true;

    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // CREDIT OPERATIONS
  // ═══════════════════════════════════════════════════════════

  async deductCredit(toolName) {
    // Deduct from subscription credits first, then purchased
    if (this.data.subscriptionCredits > 0) {
      this.data.subscriptionCredits--;
    } else if (this.data.purchasedCredits > 0) {
      this.data.purchasedCredits--;
    }

    // Log usage
    this.data.usageLog.push({
      tool: toolName,
      credits: 1,
      timestamp: new Date().toISOString(),
    });

    // Trim log
    if (this.data.usageLog.length > MAX_USAGE_LOG) {
      this.data.usageLog = this.data.usageLog.slice(-MAX_USAGE_LOG);
    }

    await this._save();
  }

  async addCredits(amount, source = 'top_up') {
    this.data.purchasedCredits = (this.data.purchasedCredits || 0) + amount;
    await this._save();
  }

  async resetSubscriptionCredits() {
    this.data.subscriptionCredits = MONTHLY_CREDITS;
    await this._save();
  }

  // ═══════════════════════════════════════════════════════════
  // PLAN MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async setPlan(plan) {
    this.data.plan = plan;
    if (plan === 'credits' && this.data.subscriptionCredits === 0) {
      this.data.subscriptionCredits = MONTHLY_CREDITS;
    }
    await this._save();
  }

  async setStripeIds(customerId, subscriptionId) {
    this.data.stripeCustomerId = customerId;
    this.data.stripeSubscriptionId = subscriptionId;
    await this._save();
  }

  async setCurrentPeriodEnd(periodEnd) {
    this.data.currentPeriodEnd = periodEnd;
    await this._save();
  }

  // ═══════════════════════════════════════════════════════════
  // AUTO-RELOAD
  // ═══════════════════════════════════════════════════════════

  async setAutoReload({ enabled, amount, threshold }) {
    this.data.autoReload = {
      enabled: !!enabled,
      amount: Number(amount) || 0,
      threshold: Number(threshold) || 0,
    };
    await this._save();
  }

  checkAutoReload() {
    const ar = this.data.autoReload;
    if (!ar || !ar.enabled) return { shouldReload: false };

    const total = (this.data.subscriptionCredits || 0) + (this.data.purchasedCredits || 0);
    if (total < ar.threshold && ar.amount > 0) {
      return { shouldReload: true, amount: ar.amount };
    }
    return { shouldReload: false };
  }

  // ═══════════════════════════════════════════════════════════
  // USAGE STATS
  // ═══════════════════════════════════════════════════════════

  getUsageStats() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
    const weekStart = todayStart - (new Date().getDay() * dayMs);
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

    const log = this.data.usageLog || [];

    let today = 0, thisWeek = 0, thisMonth = 0;
    for (const entry of log) {
      const ts = new Date(entry.timestamp).getTime();
      if (ts >= todayStart) today += entry.credits;
      if (ts >= weekStart) thisWeek += entry.credits;
      if (ts >= monthStart) thisMonth += entry.credits;
    }

    // Recent 20 actions
    const recentActions = log.slice(-20).reverse();

    return { today, thisWeek, thisMonth, recentActions };
  }

  // ═══════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════

  async _load() {
    try {
      if (existsSync(this.filePath)) {
        const raw = await fs.readFile(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (e) {
      console.error('[CreditManager] Failed to load:', e.message);
      this.data = null;
    }
  }

  async _save() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
  }
}

export default CreditManager;
