/**
 * CorrectionMemory — Ace learns from user corrections
 * 
 * When users say "that's wrong" or correct Ace, the correction is saved.
 * Before future AI calls, relevant corrections are injected into prompts
 * so Ace doesn't repeat the same mistakes.
 * 
 * Storage: data/memory/corrections/*.json
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Patterns that indicate a user is correcting Ace
const CORRECTION_PATTERNS = [
  /that'?s\s+(wrong|incorrect|not right|not correct|not true|inaccurate)/i,
  /no,?\s+actually/i,
  /not\s+correct/i,
  /the\s+right\s+answer\s+is/i,
  /you\s+made\s+a\s+mistake/i,
  /i\s+told\s+you\s+before/i,
  /that'?s\s+not\s+what\s+i\s+(meant|said|asked)/i,
  /wrong[.!]/i,
  /incorrect[.!]/i,
  /you'?re\s+wrong/i,
  /stop\s+saying/i,
  /don'?t\s+(say|do|use|call|refer)\s+that/i,
  /i\s+already\s+told\s+you/i,
  /please\s+remember\s+that/i,
  /correction:/i,
  /let\s+me\s+correct\s+you/i,
  /actually,?\s+it'?s/i,
];

export class CorrectionMemory {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data/memory/corrections';
    this.corrections = []; // In-memory list
  }

  /**
   * Initialize — load existing corrections
   */
  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this._loadAll();
    console.log(`📝 CorrectionMemory initialized — ${this.corrections.length} corrections learned`);
    return this;
  }

  /**
   * Check if a message looks like a correction
   * @param {string} message - User message to check
   * @returns {boolean}
   */
  static isCorrection(message) {
    if (!message || message.length < 5) return false;
    return CORRECTION_PATTERNS.some(pattern => pattern.test(message));
  }

  /**
   * Save a correction — what Ace said wrong and what the user corrected
   * @param {string} originalResponse - What Ace said (the wrong thing)
   * @param {string} correction - What the user said to correct it
   * @param {object} context - { topic, department, channelId }
   * @returns {object} The saved correction record
   */
  async saveCorrection(originalResponse, correction, context = {}) {
    const id = `correction_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Extract the key topic/subject from the correction
    const topic = context.topic || this._extractTopic(correction, originalResponse);
    
    const record = {
      id,
      originalResponse: (originalResponse || '').substring(0, 500),
      correction: correction.substring(0, 1000),
      topic,
      topicTokens: this._tokenize(topic + ' ' + correction),
      department: context.department || 'unknown',
      channelId: context.channelId || 'unknown',
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
      applied: 0, // How many times this correction has been applied
    };

    const filePath = path.join(this.dataDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(record, null, 2));

    this.corrections.push(record);

    return record;
  }

  /**
   * Find corrections relevant to a given topic or context
   * @param {string} topic - The topic to search for
   * @param {number} limit - Max corrections to return
   * @returns {Array} Relevant corrections sorted by relevance
   */
  getCorrections(topic, limit = 5) {
    if (!topic) return [];
    const topicTokens = this._tokenize(topic);
    
    const scored = this.corrections.map(c => {
      const score = this._relevanceScore(topicTokens, c.topicTokens);
      return { ...c, score };
    }).filter(c => c.score > 0.15);

    scored.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
    return scored.slice(0, limit);
  }

  /**
   * Build a correction injection block for an AI prompt
   * Returns a string to append to the system prompt with relevant corrections
   * @param {string} context - The current conversation context / user message
   * @returns {string} Correction block to inject, or empty string
   */
  applyCorrections(context) {
    if (!context || this.corrections.length === 0) return '';

    const relevant = this.getCorrections(context, 3);
    if (relevant.length === 0) return '';

    let block = '\n\n## IMPORTANT CORRECTIONS FROM THE USER\nThe user has previously corrected you on these points. Do NOT repeat these mistakes:\n';
    for (const c of relevant) {
      block += `- ❌ You said: "${c.originalResponse.substring(0, 150)}..."\n`;
      block += `  ✅ User corrected: "${c.correction.substring(0, 200)}"\n`;
      // Track that this correction was applied
      c.applied++;
    }
    
    return block;
  }

  /**
   * Manually add a correction (from API)
   */
  async addManualCorrection(wrongInfo, rightInfo, topic = '') {
    return this.saveCorrection(wrongInfo, rightInfo, { topic, department: 'manual' });
  }

  /**
   * Delete a correction
   */
  async deleteCorrection(id) {
    try {
      const filePath = path.join(this.dataDir, `${id}.json`);
      await fs.unlink(filePath);
      this.corrections = this.corrections.filter(c => c.id !== id);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get all corrections for API/UI display
   */
  getAll(limit = 50) {
    return this.corrections
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(c => ({
        id: c.id,
        originalResponse: c.originalResponse,
        correction: c.correction,
        topic: c.topic,
        department: c.department,
        createdAt: c.createdAt,
        applied: c.applied,
      }));
  }

  /**
   * Get stats for the UI
   */
  getStats() {
    return {
      totalCorrections: this.corrections.length,
      totalApplied: this.corrections.reduce((sum, c) => sum + (c.applied || 0), 0),
      topics: [...new Set(this.corrections.map(c => c.topic).filter(Boolean))].slice(0, 10),
      recentCorrections: this.corrections
        .slice(-5)
        .map(c => ({ correction: c.correction.substring(0, 80), date: c.createdAt })),
    };
  }

  // ═══════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════

  async _loadAll() {
    try {
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(path.join(this.dataDir, file), 'utf-8');
          const record = JSON.parse(data);
          // Ensure topicTokens exist
          if (!record.topicTokens) {
            record.topicTokens = this._tokenize((record.topic || '') + ' ' + (record.correction || ''));
          }
          this.corrections.push(record);
        } catch (e) {
          // Skip corrupt files
        }
      }
    } catch (e) {
      // Directory might not exist yet
    }
  }

  /**
   * Extract the main topic from a correction message
   */
  _extractTopic(correction, originalResponse) {
    // Try to extract what the correction is about
    const combined = (correction + ' ' + (originalResponse || '')).toLowerCase();
    
    // Remove common correction phrasing to get the subject
    const cleaned = combined
      .replace(/that'?s\s+(wrong|incorrect|not right|not correct)/gi, '')
      .replace(/no,?\s+actually/gi, '')
      .replace(/you\s+made\s+a\s+mistake/gi, '')
      .replace(/the\s+right\s+answer\s+is/gi, '')
      .replace(/i\s+told\s+you\s+before/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    // Take the first meaningful chunk as the topic
    const words = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 6);
    return words.join(' ') || 'general';
  }

  /**
   * Tokenize text for matching
   */
  _tokenize(text) {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'of', 'at', 'by', 'for', 'with', 'about', 'to', 'from',
      'in', 'out', 'on', 'off', 'and', 'but', 'or', 'if', 'not',
      'that', 'this', 'it', 'its', 'you', 'your', 'i', 'me', 'my',
      'we', 'our', 'they', 'them', 'he', 'she', 'no', 'yes',
    ]);

    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w));
  }

  /**
   * Calculate relevance between topic tokens and correction tokens
   */
  _relevanceScore(topicTokens, correctionTokens) {
    if (!topicTokens.length || !correctionTokens.length) return 0;
    
    const setA = new Set(topicTokens);
    const setB = new Set(correctionTokens);
    const intersection = [...setA].filter(x => setB.has(x));
    
    // Weighted: favor intersection count over union size
    return intersection.length / Math.min(setA.size, setB.size);
  }
}
