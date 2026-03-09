/**
 * TaskDecomposer — Break Complex Requests into Sub-Tasks
 * 
 * SuperBrain Phase 4: When Ace detects a complex multi-step request,
 * decompose it into ordered sub-tasks BEFORE execution.
 * 
 * Example:
 *   "Create a full marketing campaign for all 5 meetups"
 *   → 1. Extract all 5 events with dates/venues/cities
 *   → 2. For each event, create pre/during/post strategy
 *   → 3. Generate content calendar across all events
 *   → 4. Create social media posts per platform per event
 *   → 5. Draft email invitations for each city
 *   → 6. Create a unified timeline view
 * 
 * Features:
 * - Complexity detection (is this a multi-step task?)
 * - AI-powered decomposition (when patterns don't match)
 * - Pattern-matched decomposition (for known task types)
 * - Parallel execution where dependencies allow
 * - Progress tracking per sub-task
 */

import { eventBus } from '../events/EventBus.js';

// Known decomposition patterns (no AI needed)
const DECOMPOSITION_PATTERNS = [
  {
    pattern: /\b(create|build|develop|plan)\b.*\b(marketing|campaign)\b.*\b(all|every|each|\d+)\b.*\b(meetup|event|city|cities)\b/i,
    steps: [
      { action: 'extract', description: 'Extract all events/cities from context' },
      { action: 'strategy', description: 'Create strategy for each event' },
      { action: 'content_calendar', description: 'Generate unified content calendar' },
      { action: 'social_posts', description: 'Create social media posts per platform' },
      { action: 'email_drafts', description: 'Draft email invitations per city' },
      { action: 'timeline', description: 'Create unified timeline view' }
    ]
  },
  {
    pattern: /\b(find|search|get)\b.*\b(leads?|contacts?|prospects?)\b.*\b(and|then)\b.*\b(email|send|reach|contact)\b/i,
    steps: [
      { action: 'search', description: 'Search for leads matching criteria' },
      { action: 'qualify', description: 'Qualify and score found leads' },
      { action: 'pipeline', description: 'Add qualified leads to pipeline' },
      { action: 'draft_emails', description: 'Draft personalized outreach emails' },
      { action: 'review', description: 'Present emails for approval before sending' }
    ]
  },
  {
    pattern: /\b(analyze|audit|review)\b.*\b(competitor|market|industry)\b/i,
    steps: [
      { action: 'identify', description: 'Identify top competitors' },
      { action: 'research', description: 'Research each competitor' },
      { action: 'compare', description: 'Create comparison matrix' },
      { action: 'insights', description: 'Generate strategic insights' },
      { action: 'report', description: 'Compile final report with recommendations' }
    ]
  },
  {
    pattern: /\b(set up|configure|deploy|launch)\b.*\b(complete|full|entire|whole)\b/i,
    steps: [
      { action: 'plan', description: 'Create implementation plan' },
      { action: 'prerequisites', description: 'Check and install prerequisites' },
      { action: 'configure', description: 'Configure core settings' },
      { action: 'implement', description: 'Implement main functionality' },
      { action: 'test', description: 'Test the setup' },
      { action: 'document', description: 'Document the configuration' }
    ]
  }
];

// Complexity indicators (words/patterns that suggest multi-step task)
const COMPLEXITY_INDICATORS = [
  /\b(and then|after that|once done|followed by|next step)\b/i,
  /\b(all|every|each|multiple|several)\b.*\b(city|cities|event|meetup|lead|prospect|platform|channel)\b/i,
  /\b(full|complete|comprehensive|entire|end-to-end)\b.*\b(campaign|strategy|audit|review|plan|system)\b/i,
  /\b(for each|per|across all|throughout)\b/i,
  /\b(step\s*1|step\s*2|first|second|third)\b/i,
  /\d+\s*(?:things|items|tasks|steps|leads|events|cities)/i,
  /\b(create|build)\b.*\b(and|with)\b.*\b(and|with)\b/i // Multiple "and"s suggest complexity
];

export class TaskDecomposer {
  constructor(options = {}) {
    this.aiManager = options.aiManager || null;
    this.onProgress = options.onProgress || ((msg) => console.log(`[TaskDecomposer] ${msg}`));
    
    // Track decomposition history
    this.history = [];
    this.maxHistory = 50;
  }

  /**
   * Detect if a message represents a complex multi-step task
   * @returns {object} { isComplex, confidence, indicators }
   */
  detectComplexity(message) {
    const matchedIndicators = COMPLEXITY_INDICATORS
      .filter(pattern => pattern.test(message))
      .map(pattern => pattern.source.substring(0, 40));
    
    // Also check word count (long messages tend to be more complex)
    const wordCount = message.split(/\s+/).length;
    const isLong = wordCount > 20;
    
    // Check for list-like structure
    const hasList = /\n\s*[-•*\d]/m.test(message) || /;\s+/g.test(message);
    
    const score = matchedIndicators.length + (isLong ? 0.5 : 0) + (hasList ? 1 : 0);
    
    return {
      isComplex: score >= 1.5,
      confidence: Math.min(score / 3, 1),
      indicators: matchedIndicators,
      wordCount,
      hasList
    };
  }

  /**
   * Decompose a complex task into ordered sub-tasks
   * First tries pattern matching, falls back to AI decomposition
   * 
   * @param {string} message - The user's complex request
   * @param {object} context - Current context (pipeline state, active skills, etc.)
   * @returns {object} { steps, method, totalSteps }
   */
  async decompose(message, context = {}) {
    const complexity = this.detectComplexity(message);
    
    if (!complexity.isComplex) {
      return {
        steps: [{ id: 1, action: 'execute', description: message, status: 'pending' }],
        method: 'single_task',
        totalSteps: 1,
        complexity
      };
    }

    this.onProgress(`🧩 Complex task detected (confidence: ${(complexity.confidence * 100).toFixed(0)}%). Decomposing...`);

    // 1. Try pattern-matched decomposition first (no AI needed)
    for (const pattern of DECOMPOSITION_PATTERNS) {
      if (pattern.pattern.test(message)) {
        const steps = pattern.steps.map((step, i) => ({
          id: i + 1,
          ...step,
          status: 'pending',
          result: null
        }));
        
        this.onProgress(`📋 Decomposed into ${steps.length} steps (pattern match)`);
        
        const result = { steps, method: 'pattern_match', totalSteps: steps.length, complexity };
        this.recordDecomposition(message, result);
        return result;
      }
    }

    // 2. Fall back to AI decomposition
    if (this.aiManager) {
      try {
        return await this.decomposeWithAI(message, context, complexity);
      } catch (error) {
        this.onProgress(`⚠️ AI decomposition failed: ${error.message}`);
      }
    }

    // 3. Final fallback: treat as single task
    return {
      steps: [{ id: 1, action: 'execute', description: message, status: 'pending' }],
      method: 'fallback',
      totalSteps: 1,
      complexity
    };
  }

  /**
   * Use AI to decompose a complex task
   */
  async decomposeWithAI(message, context, complexity) {
    const prompt = `You are a task decomposer. Break this complex request into ordered sub-tasks.

USER REQUEST: "${message}"

CONTEXT:
${context.pipelineState ? `Pipeline: ${context.pipelineState.taskCount} tasks, ${context.pipelineState.leadCount} leads` : 'No pipeline data'}
${context.relevantSOPs ? `Available SOPs: ${context.relevantSOPs.map(s => s.name).join(', ')}` : 'No SOPs'}
${context.relevantSkills ? `Available Skills: ${context.relevantSkills.map(s => s.name).join(', ')}` : 'No skills'}

Return ONLY a JSON array of steps:
[
  { "id": 1, "action": "action_type", "description": "What this step does", "depends_on": [] },
  { "id": 2, "action": "action_type", "description": "What this step does", "depends_on": [1] }
]

Action types: extract, search, research, create, draft, schedule, analyze, compare, email, browse, pipeline, report
Include depends_on to indicate which steps must complete before this one.`;

    const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { maxTokens: 800 });
    
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');
    
    const steps = JSON.parse(jsonMatch[0]).map(step => ({
      ...step,
      status: 'pending',
      result: null
    }));

    this.onProgress(`📋 AI decomposed into ${steps.length} steps`);

    const result = { steps, method: 'ai_decomposition', totalSteps: steps.length, complexity };
    this.recordDecomposition(message, result);
    return result;
  }

  /**
   * Get which steps can execute in parallel (no unfinished dependencies)
   */
  getExecutableSteps(decomposition) {
    return decomposition.steps.filter(step => {
      if (step.status !== 'pending') return false;
      const deps = step.depends_on || [];
      return deps.every(depId => {
        const dep = decomposition.steps.find(s => s.id === depId);
        return dep && dep.status === 'completed';
      });
    });
  }

  /**
   * Mark a step as completed
   */
  completeStep(decomposition, stepId, result) {
    const step = decomposition.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'completed';
      step.result = result;
      step.completedAt = new Date().toISOString();
    }
    return decomposition;
  }

  /**
   * Mark a step as failed
   */
  failStep(decomposition, stepId, error) {
    const step = decomposition.steps.find(s => s.id === stepId);
    if (step) {
      step.status = 'failed';
      step.error = error;
    }
    return decomposition;
  }

  /**
   * Check if all steps are done
   */
  isComplete(decomposition) {
    return decomposition.steps.every(s => s.status === 'completed' || s.status === 'failed');
  }

  /**
   * Get progress summary
   */
  getProgress(decomposition) {
    const completed = decomposition.steps.filter(s => s.status === 'completed').length;
    const failed = decomposition.steps.filter(s => s.status === 'failed').length;
    const pending = decomposition.steps.filter(s => s.status === 'pending').length;
    const running = decomposition.steps.filter(s => s.status === 'running').length;
    
    return {
      completed,
      failed,
      pending,
      running,
      total: decomposition.steps.length,
      percentage: Math.round((completed / decomposition.steps.length) * 100)
    };
  }

  recordDecomposition(message, result) {
    this.history.push({
      message: message.substring(0, 100),
      method: result.method,
      stepCount: result.totalSteps,
      timestamp: new Date().toISOString()
    });
    if (this.history.length > this.maxHistory) this.history.shift();
  }

  getHistory() {
    return this.history;
  }
}

export default TaskDecomposer;
