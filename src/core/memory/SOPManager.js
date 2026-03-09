/**
 * SOP Manager - Ace's Brain for Procedures
 * 
 * Stores Standard Operating Procedures that Ace has learned:
 * - Step-by-step workflows
 * - Site-specific actions
 * - Scheduled tasks
 * 
 * SOPs are executed WITHOUT calling AI - saving tokens!
 */

import fs from 'fs/promises';
import path from 'path';

export class SOPManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data/sops';
    this.sops = new Map();
    this.categories = ['lead_generation', 'email', 'meetups', 'general', 'custom'];
  }

  /**
   * Initialize - load existing SOPs
   */
  async initialize() {
    // Create directories for each category
    for (const category of this.categories) {
      await fs.mkdir(path.join(this.dataDir, category), { recursive: true });
    }
    
    // Load existing SOPs
    await this.loadAllSOPs();
    
    console.log(`📋 SOP Manager initialized with ${this.sops.size} procedures`);
    return this;
  }

  /**
   * Load all SOPs from disk
   */
  async loadAllSOPs() {
    for (const category of this.categories) {
      try {
        const categoryDir = path.join(this.dataDir, category);
        const files = await fs.readdir(categoryDir);
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const data = await fs.readFile(path.join(categoryDir, file), 'utf8');
            const sop = JSON.parse(data);

            // Normalize: migrate triggerPatterns → triggers/keywords if missing
            if (sop.triggerPatterns && (!sop.triggers || sop.triggers.length === 0)) {
              sop.triggers = sop.triggerPatterns;
            }
            if (sop.triggerPatterns && (!sop.keywords || sop.keywords.length === 0)) {
              const allText = [...(sop.triggerPatterns || []), sop.name || ''].join(' ');
              sop.keywords = allText.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            }

            this.sops.set(sop.id, sop);
          }
        }
      } catch (e) {
        // Category directory might not exist or be empty
      }
    }
  }

  /**
   * Create a new SOP
   */
  async createSOP(sopData) {
    // Filter stop words from keywords — prevents garbage matches
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
      'through', 'after', 'before', 'and', 'but', 'or', 'so', 'if', 'then',
      'that', 'this', 'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you',
      'your', 'he', 'she', 'they', 'them', 'what', 'which', 'who', 'when',
      'where', 'how', 'not', 'no', 'yes', 'all', 'just', 'some', 'any',
      'each', 'every', 'up', 'out', 'get', 'got', 'last', 'spoke', 'said',
      'know', 'think', 'want', 'need', 'help', 'please', 'also', 'like',
    ]);
    const cleanKeywords = (sopData.keywords || []).filter(kw => {
      const clean = kw.toLowerCase().replace(/[?!.,]+$/, '');
      return clean.length > 2 && !STOP_WORDS.has(clean);
    });

    const sop = {
      id: sopData.id || `sop_${Date.now()}`,
      name: sopData.name,
      description: sopData.description || '',
      category: sopData.category || 'custom',

      // Trigger conditions
      triggers: sopData.triggers || [],
      keywords: cleanKeywords,

      // Steps to execute — normalize any {{variable}} names to known aliases
      steps: this._normalizeStepVariables(sopData.steps || []),

      // Desktop SOP metadata (from DesktopTrainer)
      ...(sopData.startingState ? { startingState: sopData.startingState } : {}),
      ...(sopData.type ? { type: sopData.type } : {}),

      // Metadata
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastRun: null,
      runCount: 0,

      // Scheduling
      schedule: sopData.schedule || null,
      enabled: sopData.enabled ?? true
    };

    this.sops.set(sop.id, sop);
    
    // Save to disk
    await this.saveSOP(sop);
    
    console.log(`📋 Created SOP: ${sop.name}`);
    return sop;
  }

  /**
   * Save SOP to disk
   */
  async saveSOP(sop) {
    const categoryDir = path.join(this.dataDir, sop.category || 'general');
    await fs.mkdir(categoryDir, { recursive: true });
    const filepath = path.join(categoryDir, `${sop.id}.json`);
    await fs.writeFile(filepath, JSON.stringify(sop, null, 2));
    // Update in-memory cache
    this.sops.set(sop.id, sop);
  }

  /**
   * Normalize {{variable}} names in SOP steps to standard names.
   * Prevents issues where AI or users create SOPs with non-standard variable names
   * like {{prompt_query}} or {{search_term}} that wouldn't resolve at runtime.
   */
  _normalizeStepVariables(steps) {
    // Variables that all mean "the user's message"
    const queryAliases = new Set([
      'prompt_query', 'search_query', 'user_query', 'search_term',
      'search_text', 'prompt_text', 'user_message', 'user_input',
      'input', 'request', 'user_request'
    ]);
    // Normalize these all to 'query' (the primary key in _extractSOPVariables)
    const normalizeVar = (varName) => queryAliases.has(varName) ? 'query' : varName;

    return steps.map(step => {
      const normalized = { ...step };
      for (const [key, value] of Object.entries(normalized)) {
        if (typeof value === 'string' && value.includes('{{')) {
          normalized[key] = value.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
            const fixed = normalizeVar(varName);
            if (fixed !== varName) {
              console.log(`📋 SOP variable normalized: {{${varName}}} → {{${fixed}}}`);
            }
            return `{{${fixed}}}`;
          });
        }
      }
      return normalized;
    });
  }

  /**
   * Get SOP by ID
   */
  getSOP(id) {
    return this.sops.get(id);
  }

  /**
   * Find SOP by keywords (intent matching)
   */
  findSOPByIntent(text) {
    const lowerText = text.toLowerCase();

    // Stop words — too common to be meaningful SOP keywords
    const STOP_WORDS = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'about', 'between',
      'through', 'after', 'before', 'above', 'below', 'and', 'but', 'or',
      'so', 'if', 'then', 'that', 'this', 'it', 'its', 'i', 'me', 'my',
      'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'what',
      'which', 'who', 'when', 'where', 'how', 'not', 'no', 'yes', 'all',
      'just', 'some', 'any', 'each', 'every', 'up', 'out', 'get', 'got',
      'last', 'spoke', 'said', 'know', 'think', 'want', 'need', 'help',
    ]);

    // First, check explicit triggers (exact phrase match — still reliable)
    for (const sop of this.sops.values()) {
      if (!sop.enabled) continue;

      for (const trigger of sop.triggers || []) {
        if (trigger.length > 5 && lowerText.includes(trigger.toLowerCase())) {
          return sop;
        }
      }
    }

    // Then check keywords — require meaningful match ratio, not just count
    let bestMatch = null;
    let bestRatio = 0;

    for (const sop of this.sops.values()) {
      if (!sop.enabled) continue;

      // Filter out stop words from keywords — only count meaningful ones
      const meaningfulKeywords = (sop.keywords || []).filter(kw =>
        kw.length > 2 && !STOP_WORDS.has(kw.toLowerCase().replace(/[?!.,]+$/, ''))
      );

      if (meaningfulKeywords.length === 0) continue;

      const matchCount = meaningfulKeywords.filter(kw =>
        lowerText.includes(kw.toLowerCase())
      ).length;

      const matchRatio = matchCount / meaningfulKeywords.length;

      // Require at least 40% match AND minimum 2 meaningful keyword matches
      // (or 1 match if the SOP only has 1 meaningful keyword)
      const meetsThreshold = (matchCount >= 2 && matchRatio >= 0.4)
        || (matchCount === 1 && meaningfulKeywords.length === 1);

      if (meetsThreshold && matchRatio > bestRatio) {
        bestMatch = sop;
        bestRatio = matchRatio;
      }
    }

    return bestMatch;
  }

  /**
   * Get SOPs by category
   */
  getSOPsByCategory(category) {
    return Array.from(this.sops.values()).filter(sop => sop.category === category);
  }

  /**
   * Get all SOPs
   */
  getAllSOPs() {
    return Array.from(this.sops.values());
  }

  /**
   * Get enabled SOPs
   */
  getEnabledSOPs() {
    return Array.from(this.sops.values()).filter(sop => sop.enabled);
  }

  /**
   * Update SOP run count and last run time
   */
  async recordRun(sopId, success = true) {
    const sop = this.sops.get(sopId);
    if (!sop) return;

    sop.lastRun = new Date().toISOString();
    sop.runCount = (sop.runCount || 0) + 1;
    sop.lastRunSuccess = success;
    
    await this.saveSOP(sop);
  }

  /**
   * Delete SOP
   */
  async deleteSOP(sopId) {
    const sop = this.sops.get(sopId);
    if (!sop) return false;

    this.sops.delete(sopId);
    
    try {
      await fs.unlink(path.join(this.dataDir, sop.category, `${sop.id}.json`));
    } catch (e) {
      // File might not exist
    }
    
    return true;
  }

  /**
   * Get summary for AI context
   */
  getSummary() {
    const sops = this.getAllSOPs();
    if (sops.length === 0) {
      return "I don't have any procedures stored yet.";
    }

    let summary = "My stored procedures:\n";
    
    for (const category of this.categories) {
      const categorySops = sops.filter(s => s.category === category && s.enabled);
      if (categorySops.length > 0) {
        summary += `\n${category.replace('_', ' ').toUpperCase()}:\n`;
        for (const sop of categorySops) {
          summary += `  • ${sop.name}`;
          if (sop.triggers?.length > 0) {
            summary += ` (triggers: ${sop.triggers.slice(0, 2).join(', ')})`;
          }
          summary += '\n';
        }
      }
    }
    
    return summary;
  }

  // Default SOPs removed — SOPs are now user-created only via Training or chat
}

export default SOPManager;
