/**
 * GoalTracker — Persistent mission/goal tracking for Ace
 *
 * Goals are injected into every AI prompt so Ace always knows
 * what it's working toward. Users set goals via chat or Telegram.
 */

import fs from 'fs/promises';
import path from 'path';

export class GoalTracker {
  constructor(options = {}) {
    this.goalsPath = options.goalsPath || './data/goals/goals.json';
    this.prefsPath = options.prefsPath || path.join(path.dirname(this.goalsPath), 'preferences.json');
    this.goals = [];
    this.preferences = {
      suggestionsAccepted: 0,
      suggestionsDeclined: 0,
      autoCreateThreshold: 5,   // after N accepts, stop asking and auto-create
      stopAskingThreshold: 3,   // after N declines in a row, stop suggesting
      consecutiveDeclines: 0,
    };
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.goalsPath, 'utf8');
      this.goals = JSON.parse(data);
    } catch {
      this.goals = [];
      await this.save();
    }
    // Load suggestion preferences
    try {
      const prefsData = await fs.readFile(this.prefsPath, 'utf8');
      this.preferences = { ...this.preferences, ...JSON.parse(prefsData) };
    } catch { /* no prefs file yet */ }

    console.log(`[GoalTracker] Initialized with ${this.goals.length} goals (${this.getActiveGoals().length} active)`);
    return this;
  }

  async savePreferences() {
    await fs.mkdir(path.dirname(this.prefsPath), { recursive: true });
    await fs.writeFile(this.prefsPath, JSON.stringify(this.preferences, null, 2));
  }

  async save() {
    await fs.mkdir(path.dirname(this.goalsPath), { recursive: true });
    await fs.writeFile(this.goalsPath, JSON.stringify(this.goals, null, 2));
  }

  async addGoal(goalData) {
    const goal = {
      id: `goal_${Date.now()}`,
      description: goalData.description,
      type: goalData.type || 'custom', // lead_gen | outreach | research | custom
      target: goalData.target || null,  // { count, unit, per } e.g. { count: 10, unit: 'leads', per: 'day' }
      criteria: goalData.criteria || '',
      status: 'active', // active | paused | completed
      progress: {
        current: goalData.initialProgress || 0,
        history: []
      },
      nextAction: goalData.nextAction || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.goals.push(goal);
    await this.save();
    return goal;
  }

  async updateProgress(goalId, increment, note = '') {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;

    goal.progress.current += increment;
    goal.progress.history.push({
      timestamp: new Date().toISOString(),
      increment,
      total: goal.progress.current,
      note
    });

    // Keep last 20 history entries
    if (goal.progress.history.length > 20) {
      goal.progress.history = goal.progress.history.slice(-20);
    }

    goal.updatedAt = new Date().toISOString();

    // Auto-complete if target reached
    if (goal.target?.count && goal.progress.current >= goal.target.count) {
      goal.status = 'completed';
    }

    await this.save();
    return goal;
  }

  async updateGoal(goalId, updates) {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;

    if (updates.nextAction !== undefined) goal.nextAction = updates.nextAction;
    if (updates.status !== undefined) goal.status = updates.status;
    if (updates.description !== undefined) goal.description = updates.description;
    if (updates.criteria !== undefined) goal.criteria = updates.criteria;
    if (updates.target !== undefined) goal.target = updates.target;
    goal.updatedAt = new Date().toISOString();

    await this.save();
    return goal;
  }

  async completeGoal(goalId) {
    return this.updateGoal(goalId, { status: 'completed' });
  }

  async deleteGoal(goalId) {
    const idx = this.goals.findIndex(g => g.id === goalId);
    if (idx === -1) return null;
    const removed = this.goals.splice(idx, 1)[0];
    await this.save();
    return removed;
  }

  getGoal(goalId) {
    return this.goals.find(g => g.id === goalId) || null;
  }

  getActiveGoals() {
    return this.goals.filter(g => g.status === 'active');
  }

  getAllGoals() {
    return this.goals;
  }

  /**
   * Record that the user accepted or declined a goal suggestion.
   * Over time, Ace learns: many accepts → auto-create, many declines → stop asking.
   */
  async recordSuggestionResponse(accepted) {
    if (accepted) {
      this.preferences.suggestionsAccepted++;
      this.preferences.consecutiveDeclines = 0;
    } else {
      this.preferences.suggestionsDeclined++;
      this.preferences.consecutiveDeclines++;
    }
    await this.savePreferences();
  }

  /**
   * Returns the suggestion behavior Ace should use:
   * - 'auto_create': user has accepted enough times → just create goals automatically
   * - 'suggest': normal behavior → ask with [ACE_QUESTION] cards
   * - 'dont_ask': user has declined too many times → stop suggesting
   */
  getSuggestionBehavior() {
    if (this.preferences.suggestionsAccepted >= this.preferences.autoCreateThreshold) {
      return 'auto_create';
    }
    if (this.preferences.consecutiveDeclines >= this.preferences.stopAskingThreshold) {
      return 'dont_ask';
    }
    return 'suggest';
  }

  /**
   * Compact summary for prompt injection — keeps token count low
   */
  getGoalsSummary() {
    const active = this.getActiveGoals();
    if (active.length === 0) return '';

    let summary = '';
    for (const g of active) {
      summary += `- ${g.description}`;
      if (g.target) {
        summary += ` [Target: ${g.target.count} ${g.target.unit || 'items'}/${g.target.per || 'day'}, Progress: ${g.progress.current}]`;
      }
      if (g.criteria) summary += ` | Criteria: ${g.criteria}`;
      if (g.nextAction) summary += ` | Next: ${g.nextAction}`;
      summary += '\n';
    }
    return summary;
  }
}

export default GoalTracker;
