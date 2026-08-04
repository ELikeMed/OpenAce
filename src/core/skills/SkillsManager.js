/**
 * OpenAce Skills Manager
 * Allows you to teach OpenAce new abilities and tasks
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class SkillsManager {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
    this.skills = new Map();
    this.categories = ['cmo', 'cto', 'coo', 'general'];
  }

  async initialize() {
    // Load all skills from directory
    await this.loadSkills();
    console.log(`✅ Loaded ${this.skills.size} skills`);
    return this;
  }

  async loadSkills() {
    try {
      const files = await fs.readdir(this.skillsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const skillPath = path.join(this.skillsDir, file);
          const skillData = await fs.readFile(skillPath, 'utf-8');
          const skill = JSON.parse(skillData);
          this.skills.set(skill.id, skill);
        }
      }
    } catch (error) {
      console.log('No existing skills found, starting fresh');
    }
  }

  async loadNewSkill(skillPath) {
    try {
      const skillData = await fs.readFile(skillPath, 'utf-8');
      const skill = JSON.parse(skillData);
      if (skill && skill.id) {
        this.skills.set(skill.id, skill);
          return skill;
      }
    } catch (error) {
      console.error(`❌ Failed to dynamically load skill from ${skillPath}:`, error.message);
      return null;
    }
  }

  /**
   * Add a new skill to OpenAce
   */
  async addSkill(skillData) {
    const skill = {
      id: skillData.id || this.generateSkillId(skillData.name),
      name: skillData.name,
      description: skillData.description,
      category: skillData.category || 'general',
      prompt: skillData.prompt,
      tools: skillData.tools || [],
      examples: skillData.examples || [],
      created_at: new Date().toISOString(),
      enabled: true,
    };

    // Save to file
    const skillPath = path.join(this.skillsDir, `${skill.id}.json`);
    await fs.writeFile(skillPath, JSON.stringify(skill, null, 2));

    // Add to memory
    this.skills.set(skill.id, skill);

    return skill;
  }

  /**
   * Get a specific skill
   */
  getSkill(skillId) {
    return this.skills.get(skillId);
  }

  /**
   * Get all skills for a category
   */
  getSkillsByCategory(category) {
    return Array.from(this.skills.values()).filter(
      skill => skill.category === category && skill.enabled
    );
  }

  /**
   * Get all skills
   */
  getAllSkills() {
    return Array.from(this.skills.values());
  }

  /**
   * Find the best matching skill for a user message
   * Returns the skill with the highest relevance score, or null
   */
  findMatchingSkill(message) {
    const lower = message.toLowerCase();
    const words = lower.split(/\s+/).filter(w => w.length > 3);
    
    let bestSkill = null;
    let bestScore = 0;

    for (const skill of this.skills.values()) {
      if (!skill.enabled && skill.enabled !== undefined) continue;
      
      let score = 0;
      
      // Check skill name
      const nameLower = (skill.name || '').toLowerCase();
      if (lower.includes(nameLower)) score += 3;
      
      // Check skill description words
      const descWords = (skill.description || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
      for (const dw of descWords) {
        if (lower.includes(dw)) score += 0.5;
      }
      
      // Check triggers (strong signal — many skills use triggers instead of examples)
      for (const trigger of (skill.triggers || [])) {
        const trigLower = trigger.toLowerCase();
        // Direct trigger match
        if (lower.includes(trigLower) || trigLower.includes(lower)) {
          score += 5;
        }
        // Partial word overlap
        const trigWords = trigLower.split(/\s+/).filter(w => w.length > 3);
        const matchCount = trigWords.filter(tw => words.some(w => w.includes(tw) || tw.includes(w))).length;
        score += matchCount * 1.5;
      }

      // Check examples (strong signal)
      for (const example of (skill.examples || [])) {
        const exLower = example.toLowerCase();
        // Direct example match
        if (lower.includes(exLower) || exLower.includes(lower)) {
          score += 5;
        }
        // Partial word overlap
        const exWords = exLower.split(/\s+/).filter(w => w.length > 3);
        const matchCount = exWords.filter(ew => words.some(w => w.includes(ew) || ew.includes(w))).length;
        score += matchCount * 1.5;
      }

      // Check category keywords
      const categoryKeywords = {
        cmo: ['marketing', 'campaign', 'social', 'content', 'brand', 'lead', 'analytics', 'seo', 'report'],
        cto: ['code', 'tech', 'architecture', 'performance', 'security', 'deploy', 'bug', 'review', 'stack',
              'landing page', 'website', 'webapp', 'web app', 'html', 'css', 'javascript'],
        coo: ['operations', 'process', 'efficiency', 'resource', 'metrics', 'team', 'workflow', 'planning']
      };
      const catWords = categoryKeywords[skill.category] || [];
      for (const cw of catWords) {
        if (lower.includes(cw)) score += 0.3;
      }

      if (score > bestScore && score >= 2) {
        bestScore = score;
        bestSkill = skill;
      }
    }

    return bestSkill;
  }

  /**
   * Get chain targets for a skill that supports chaining
   * @param {string} skillId - The skill ID to get chain targets for
   * @returns {Array} Array of target skill objects
   */
  getChainTargets(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill || !skill.chainable || !skill.chainTargets) {
      return [];
    }
    return skill.chainTargets
      .map(targetId => this.getSkill(targetId))
      .filter(Boolean);
  }

  /**
   * Check whether a skill's data requirements are satisfied by the provided data
   * @param {string} skillId - The skill ID to check requirements for
   * @param {string} providedData - The data string to check against requirements
   * @returns {object} { complete: boolean, missing: Array<{field, description}> }
   */
  checkDataRequirements(skillId, providedData = '') {
    const skill = this.getSkill(skillId);
    if (!skill || !skill.data_requirements) {
      return { complete: true, missing: [] };
    }

    const dataLower = providedData.toLowerCase();
    const missing = skill.data_requirements
      .filter(req => req.required)
      .filter(req => {
        const fieldTerms = req.field.toLowerCase().split(/[\s_-]+/);
        return !fieldTerms.some(term => dataLower.includes(term));
      });

    return {
      complete: missing.length === 0,
      missing: missing.map(m => ({ field: m.field, description: m.description }))
    };
  }

  /**
   * Suggest chain targets after a skill completes
   * @param {string} skillId - The completed skill ID
   * @param {string} result - The skill execution result
   * @returns {object|null} Chain suggestion with message and options, or null
   */
  suggestChain(skillId, result) {
    const chainTargets = this.getChainTargets(skillId);
    if (chainTargets.length === 0) return null;

    return {
      message: `This skill can chain into: ${chainTargets.map(s => s.name).join(', ')}`,
      options: chainTargets.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        triggers: s.triggers ? s.triggers[0] : s.id
      }))
    };
  }

  /**
   * Update a skill
   */
  async updateSkill(skillId, updates) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const updatedSkill = { ...skill, ...updates, updated_at: new Date().toISOString() };
    
    const skillPath = path.join(this.skillsDir, `${skillId}.json`);
    await fs.writeFile(skillPath, JSON.stringify(updatedSkill, null, 2));

    this.skills.set(skillId, updatedSkill);
    return updatedSkill;
  }

  /**
   * Delete a skill
   */
  async deleteSkill(skillId) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill ${skillId} not found`);
    }

    const skillPath = path.join(this.skillsDir, `${skillId}.json`);
    await fs.unlink(skillPath);

    this.skills.delete(skillId);
    return true;
  }

  /**
   * Generate a skill ID from name
   */
  generateSkillId(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  /**
   * Get skills context for AI
   */
  getSkillsContext(category = null) {
    let skills = category
      ? this.getSkillsByCategory(category)
      : this.getAllSkills();

    skills = skills.filter(s => s.enabled !== false);

    if (skills.length === 0) {
      return 'No custom skills loaded yet.';
    }

    return skills.map(skill => {
      const instructions = skill.systemPrompt || skill.prompt || skill.description || '';
      const examples = skill.examples || skill.triggers || [];
      return `
SKILL: ${skill.name}
Category: ${(skill.category || 'general').toUpperCase()}
Description: ${skill.description || ''}
Instructions: ${instructions}
${examples.length > 0 ? `Examples:\n${examples.map(e => `- ${e}`).join('\n')}` : ''}
---`;
    }).join('\n');
  }
}

// Default skills that come with OpenAce
export const DEFAULT_SKILLS = [
  {
    id: 'weekly-marketing-report',
    name: 'Weekly Marketing Report',
    description: 'Generate a comprehensive weekly marketing performance report',
    category: 'cmo',
    prompt: `Analyze marketing data and create a weekly report including:
    1. Traffic and engagement metrics
    2. Campaign performance
    3. Lead generation results
    4. Social media insights
    5. Key wins and areas for improvement
    6. Recommendations for next week`,
    examples: [
      'Create my weekly marketing report',
      'Show me this week\'s marketing performance'
    ]
  },
  {
    id: 'code-review',
    name: 'Code Review Assistant',
    description: 'Review code for quality, security, and best practices',
    category: 'cto',
    prompt: `Review the provided code and analyze:
    1. Code quality and readability
    2. Security vulnerabilities
    3. Performance issues
    4. Best practices compliance
    5. Suggested improvements
    6. Priority of changes (P0, P1, P2)`,
    examples: [
      'Review this code',
      'Check my PR for issues'
    ]
  },
  {
    id: 'operations-dashboard',
    name: 'Operations Dashboard',
    description: 'Generate operations metrics and efficiency report',
    category: 'coo',
    prompt: `Create an operations overview including:
    1. Key operational metrics
    2. Process efficiency analysis
    3. Resource utilization
    4. Bottlenecks and blockers
    5. Cost analysis
    6. Optimization recommendations`,
    examples: [
      'Show me operations metrics',
      'Create operations dashboard'
    ]
  },
  {
    id: 'competitor-analysis',
    name: 'Competitor Analysis',
    description: 'Research and analyze competitor activities',
    category: 'cmo',
    prompt: `Research competitors and provide:
    1. Recent activities and launches
    2. Marketing strategies
    3. Pricing changes
    4. Social media presence
    5. Customer sentiment
    6. Opportunities for differentiation`,
    examples: [
      'Analyze our competitors',
      'What are competitors doing?'
    ]
  },
  {
    id: 'tech-stack-review',
    name: 'Tech Stack Review',
    description: 'Evaluate technology stack and recommend improvements',
    category: 'cto',
    prompt: `Review the tech stack and assess:
    1. Current technologies and versions
    2. Security and maintenance status
    3. Performance and scalability
    4. Cost efficiency
    5. Modern alternatives
    6. Migration recommendations`,
    examples: [
      'Review our tech stack',
      'Should we upgrade our technologies?'
    ]
  },
  {
    id: 'resource-planning',
    name: 'Resource Planning',
    description: 'Plan and optimize resource allocation',
    category: 'coo',
    prompt: `Analyze resource allocation and provide:
    1. Current resource distribution
    2. Capacity vs demand analysis
    3. Underutilized resources
    4. Over-allocated areas
    5. Hiring recommendations
    6. Optimization strategy`,
    examples: [
      'Help me plan resources',
      'Are we properly staffed?'
    ]
  }
];
