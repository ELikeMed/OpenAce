/**
 * SkillChainer — Dependency Graph & Automatic Skill Triggering
 * 
 * SuperBrain Phase 4: Skills are no longer isolated templates. They can:
 * - Depend on other skills (skill B needs output from skill A)
 * - Trigger follow-up skills automatically (skill A completing triggers skill B)
 * - Produce typed output contracts (structured data, not just text)
 * - Track execution history for outcome measurement
 * 
 * Usage:
 *   const chainer = new SkillChainer(skillsManager);
 *   const chain = chainer.buildChain('marketing-campaign');
 *   // Returns: [event-data, marketing-campaign, content-calendar, social-schedule]
 *   
 *   const results = await chainer.executeChain(chain, { context });
 */

import { eventBus } from '../events/EventBus.js';

export class SkillChainer {
  constructor(options = {}) {
    this.skillsManager = options.skillsManager || null;
    this.aiManager = options.aiManager || null;
    this.onProgress = options.onProgress || ((msg) => console.log(`[SkillChainer] ${msg}`));
    
    // Execution history for tracking outcomes
    this.executionHistory = [];
    this.maxHistory = 100;
  }

  /**
   * Build a dependency-ordered execution chain for a skill
   * Uses topological sort to resolve dependencies
   * 
   * @param {string} skillId - The target skill to execute
   * @returns {string[]} Ordered list of skill IDs to execute
   */
  buildChain(skillId) {
    if (!this.skillsManager) return [skillId];
    
    const allSkills = this.skillsManager.getAllSkills();
    const skillMap = new Map(allSkills.map(s => [s.id || s.name, s]));
    const targetSkill = skillMap.get(skillId);
    
    if (!targetSkill) return [skillId];
    
    // Resolve dependencies (what this skill needs before running)
    const chain = [];
    const visited = new Set();
    
    const resolve = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const skill = skillMap.get(id);
      if (!skill) return;
      
      // Resolve dependencies first (depth-first)
      const deps = skill.depends_on || [];
      for (const dep of deps) {
        resolve(dep);
      }
      
      chain.push(id);
    };
    
    resolve(skillId);
    return chain;
  }

  /**
   * Find a skill chain that matches a decomposed task
   * Maps task descriptions/actions to available skills, then builds the execution chain.
   *
   * @param {object} task - A decomposed task with { action, description }
   * @returns {object[]} Array of { skill, params, skillId } for execution, or []
   */
  async findChain(task) {
    if (!this.skillsManager) return [];
    
    const allSkills = this.skillsManager.getAllSkills();
    if (!allSkills || allSkills.length === 0) return [];
    
    const taskAction = (task.action || '').toLowerCase();
    const taskDesc = (task.description || '').toLowerCase();
    
    // Strategy 1: Direct action-to-skill mapping
    const actionSkillMap = {
      'research': ['competitor-analysis', 'seo-audit', 'tech-stack-review'],
      'search': ['scan-website-for-events', 'competitor-analysis'],
      'extract': ['scan-website-for-events'],
      'strategy': ['business-strategy', 'content-writer', 'social-media-expert'],
      'content_calendar': ['weekly-marketing-report', 'social-media-expert'],
      'social_posts': ['social-media-expert', 'content-writer'],
      'email_drafts': ['content-writer'],
      'draft': ['content-writer'],
      'email': ['content-writer'],
      'analyze': ['competitor-analysis', 'seo-audit', 'tech-stack-review'],
      'compare': ['competitor-analysis'],
      'insights': ['business-strategy'],
      'report': ['weekly-marketing-report', 'operations-dashboard'],
      'plan': ['business-strategy', 'resource-planning'],
      'schedule': ['social-media-expert', 'resource-planning'],
      'pipeline': ['operations-dashboard'],
      'browse': ['scan-website-for-events'],
      'configure': ['tech-stack-review'],
      'implement': ['code-review'],
      'test': ['code-review'],
      'identify': ['competitor-analysis'],
    };
    
    // Find matching skill IDs from action map
    const candidateIds = actionSkillMap[taskAction] || [];
    
    // Strategy 2: Keyword match against skill names/descriptions
    for (const skill of allSkills) {
      const skillId = (skill.id || skill.name || '').toLowerCase();
      const skillDesc = (skill.description || '').toLowerCase();
      const skillName = (skill.name || '').toLowerCase();
      
      // Check if task description mentions the skill name or keywords
      if (taskDesc.includes(skillName) || skillName.includes(taskAction)) {
        if (!candidateIds.includes(skillId)) {
          candidateIds.unshift(skillId); // Higher priority
        }
      }
      
      // Check skill topic keywords
      if (skill.topicKeywords) {
        const matches = skill.topicKeywords.filter(kw =>
          taskDesc.includes(kw.toLowerCase())
        );
        if (matches.length >= 2 && !candidateIds.includes(skillId)) {
          candidateIds.push(skillId);
        }
      }
    }
    
    // Strategy 3: AI-assisted skill matching (if no candidates found)
    if (candidateIds.length === 0 && this.aiManager) {
      try {
        const skillList = allSkills.map(s => `${s.id || s.name}: ${s.description || 'No description'}`).join('\n');
        const response = await this.aiManager.chat([{
          role: 'user',
          content: `Given this task: "${task.description}"\n\nWhich of these skills best matches? Return ONLY the skill ID, nothing else.\n\n${skillList}`
        }], { maxTokens: 50 });
        
        const matchedId = response.content.trim().toLowerCase().replace(/['"]/g, '');
        const validSkill = allSkills.find(s => (s.id || s.name || '').toLowerCase() === matchedId);
        if (validSkill) {
          candidateIds.push(matchedId);
        }
      } catch (e) {
        // AI matching failed, that's ok
      }
    }
    
    if (candidateIds.length === 0) return [];
    
    // Build chain for the best matching skill (first candidate)
    const bestSkillId = candidateIds[0];
    const chain = this.buildChain(bestSkillId);
    
    // Return as executable steps
    return chain.map(skillId => ({
      skill: skillId,
      skillId,
      params: {
        taskAction: task.action,
        taskDescription: task.description,
        originalTask: task,
      }
    }));
  }

  /**
   * Get the full trigger chain (what skills are triggered AFTER a skill completes)
   * 
   * @param {string} skillId - The skill that completed
   * @returns {string[]} Skills that should be triggered
   */
  getTriggeredSkills(skillId) {
    if (!this.skillsManager) return [];
    
    const allSkills = this.skillsManager.getAllSkills();
    const skill = allSkills.find(s => (s.id || s.name) === skillId);
    
    return skill?.triggers || [];
  }

  /**
   * Execute a skill chain with data flowing between skills
   * 
   * @param {string[]} chain - Ordered skill IDs from buildChain()
   * @param {object} context - Initial context/data
   * @returns {object} Combined results from all skills
   */
  async executeChain(chain, context = {}) {
    if (!this.aiManager) {
      return { success: false, error: 'AI Manager not available for skill execution' };
    }
    
    const startTime = Date.now();
    const results = {};
    let accumulatedData = { ...context };
    
    this.onProgress(`🔗 Executing skill chain: ${chain.join(' → ')}`);
    eventBus.emit('skill:chain:started', { chain, context: Object.keys(context) });
    
    for (let i = 0; i < chain.length; i++) {
      const skillId = chain[i];
      this.onProgress(`⚡ [${i + 1}/${chain.length}] Running skill: ${skillId}`);
      
      try {
        const skill = this.skillsManager?.getAllSkills().find(s => (s.id || s.name) === skillId);
        
        if (!skill) {
          results[skillId] = { success: false, error: `Skill not found: ${skillId}` };
          continue;
        }
        
        // Build the prompt with accumulated data from previous skills
        const prompt = this.buildSkillPrompt(skill, accumulatedData);
        
        const aiResponse = await this.aiManager.chat([
          { role: 'user', content: prompt }
        ]);
        
        const output = this.parseSkillOutput(aiResponse.content, skill);
        
        results[skillId] = {
          success: true,
          output,
          provider: aiResponse.provider,
          timestamp: new Date().toISOString()
        };
        
        // Feed output into accumulated data for next skill
        accumulatedData[skillId] = output;
        accumulatedData.previousSkillOutput = output;
        
        eventBus.emit('skill:completed', { skillId, chainPosition: i + 1, totalChain: chain.length });
        
      } catch (error) {
        results[skillId] = { success: false, error: error.message };
        this.onProgress(`❌ Skill ${skillId} failed: ${error.message}`);
        eventBus.emit('skill:failed', { skillId, error: error.message });
        
        // Don't break the chain — continue with other skills that don't depend on this one
      }
    }
    
    // Check for triggered follow-up skills
    const lastSkill = chain[chain.length - 1];
    const triggeredSkills = this.getTriggeredSkills(lastSkill);
    
    const duration = Date.now() - startTime;
    
    // Record execution
    const execution = {
      id: `exec_${Date.now()}`,
      chain,
      results,
      triggeredSkills,
      duration,
      timestamp: new Date().toISOString(),
      success: Object.values(results).every(r => r.success)
    };
    
    this.executionHistory.push(execution);
    if (this.executionHistory.length > this.maxHistory) {
      this.executionHistory.shift();
    }
    
    eventBus.emit('skill:chain:completed', {
      chain,
      success: execution.success,
      duration,
      triggeredSkills
    });
    
    return {
      ...execution,
      triggeredSkills,
      message: triggeredSkills.length > 0
        ? `Chain complete. Triggered follow-up skills: ${triggeredSkills.join(', ')}`
        : 'Chain complete.'
    };
  }

  /**
   * Build an AI prompt for a skill using its template and accumulated data
   */
  buildSkillPrompt(skill, data) {
    let prompt = skill.prompt || skill.description || `Execute the ${skill.name} skill.`;
    
    // Inject accumulated data context
    if (Object.keys(data).length > 0) {
      const contextStr = Object.entries(data)
        .filter(([k, v]) => k !== 'previousSkillOutput' && typeof v !== 'function')
        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v).substring(0, 500) : String(v).substring(0, 500)}`)
        .join('\n');
      
      if (contextStr) {
        prompt += `\n\nCONTEXT FROM PREVIOUS STEPS:\n${contextStr}`;
      }
    }
    
    // Add output format requirement if skill has output contract
    if (skill.outputs) {
      prompt += `\n\nOUTPUT FORMAT: Return a JSON object with these fields: ${JSON.stringify(skill.outputs)}`;
    }
    
    return prompt;
  }

  /**
   * Parse skill output — try to extract structured JSON, fall back to text
   */
  parseSkillOutput(rawOutput, skill) {
    // Try to extract JSON
    const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return { type: 'structured', data: JSON.parse(jsonMatch[0]), raw: rawOutput };
      } catch {}
    }
    
    // Fall back to text output
    return { type: 'text', data: rawOutput, raw: rawOutput };
  }

  /**
   * Get execution history
   */
  getHistory(limit = 20) {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Get status for health checks
   */
  getStatus() {
    return {
      executionsTotal: this.executionHistory.length,
      recentExecutions: this.executionHistory.slice(-5).map(e => ({
        chain: e.chain,
        success: e.success,
        duration: e.duration,
        timestamp: e.timestamp
      }))
    };
  }
}

export default SkillChainer;
