/**
 * ResearchMemory — Ace remembers past research results
 * 
 * When Ace completes a research task, results are persisted to disk.
 * On future similar queries, Ace can recall recent results and offer
 * them instead of re-searching.
 * 
 * Storage: data/memory/research/*.json
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

export class ResearchMemory {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data/memory/research';
    this.maxAge = options.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    this.cache = []; // In-memory index for fast recall
  }

  /**
   * Initialize — ensure directories exist, load index into memory
   */
  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this._loadIndex();
    console.log(`🔬 ResearchMemory initialized — ${this.cache.length} saved sessions`);
    return this;
  }

  /**
   * Save research results to disk
   * @param {string} query - The search query
   * @param {string|object} results - The research results (text or structured data)
   * @param {string} source - Where the data came from (e.g. 'desktop_browser', 'fetch')
   * @returns {object} The saved research record
   */
  async saveResearch(query, results, source = 'unknown') {
    const id = `research_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const record = {
      id,
      query,
      queryNormalized: this._normalize(query),
      queryTokens: this._tokenize(query),
      results: typeof results === 'string' ? results : JSON.stringify(results),
      source,
      timestamp: Date.now(),
      createdAt: new Date().toISOString(),
    };

    const filePath = path.join(this.dataDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(record, null, 2));

    // Add to in-memory cache
    this.cache.push({
      id: record.id,
      query: record.query,
      queryNormalized: record.queryNormalized,
      queryTokens: record.queryTokens,
      source: record.source,
      timestamp: record.timestamp,
      createdAt: record.createdAt,
      resultLength: record.results.length
    });

    return record;
  }

  /**
   * Recall past research that fuzzy-matches a new query
   * Returns results within maxAge (default 24h) sorted by relevance
   * @param {string} query - The new search query
   * @param {object} options - { maxAge, minScore, limit }
   * @returns {Array} Matching research records with scores
   */
  async recallResearch(query, options = {}) {
    const maxAge = options.maxAge || this.maxAge;
    const minScore = options.minScore || 0.3;
    const limit = options.limit || 5;
    const now = Date.now();

    const queryNorm = this._normalize(query);
    const queryTokens = this._tokenize(query);

    const matches = [];

    for (const entry of this.cache) {
      // Skip if too old
      if (now - entry.timestamp > maxAge) continue;

      // Calculate fuzzy similarity score
      const score = this._similarityScore(queryNorm, queryTokens, entry.queryNormalized, entry.queryTokens);
      if (score >= minScore) {
        matches.push({ ...entry, score });
      }
    }

    // Sort by score descending, then by recency
    matches.sort((a, b) => b.score - a.score || b.timestamp - a.timestamp);
    const topMatches = matches.slice(0, limit);

    // Load full results for top matches
    const fullResults = [];
    for (const match of topMatches) {
      try {
        const filePath = path.join(this.dataDir, `${match.id}.json`);
        const data = await fs.readFile(filePath, 'utf-8');
        const record = JSON.parse(data);
        fullResults.push({ ...record, score: match.score });
      } catch (e) {
        // File might have been deleted
      }
    }

    return fullResults;
  }

  /**
   * Get the N most recent research sessions
   * @param {number} limit - How many to return
   * @returns {Array} Recent research index entries
   */
  getRecentResearch(limit = 10) {
    return this.cache
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Get full record by ID
   */
  async getById(id) {
    try {
      const filePath = path.join(this.dataDir, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  }

  /**
   * Delete a research record
   */
  async deleteResearch(id) {
    try {
      const filePath = path.join(this.dataDir, `${id}.json`);
      await fs.unlink(filePath);
      this.cache = this.cache.filter(e => e.id !== id);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Clear all research older than maxAge
   */
  async purgeOld(maxAge) {
    // When maxAge is 0, delete everything (cutoff = Date.now())
    const age = maxAge != null ? maxAge : this.maxAge;
    const cutoff = Date.now() - age;
    const toDelete = this.cache.filter(e => e.timestamp < cutoff);
    for (const entry of toDelete) {
      await this.deleteResearch(entry.id);
    }
    return toDelete.length;
  }

  /**
   * Get stats for the UI
   */
  getStats() {
    const now = Date.now();
    const recent24h = this.cache.filter(e => now - e.timestamp < 24 * 60 * 60 * 1000);
    return {
      totalSessions: this.cache.length,
      recent24h: recent24h.length,
      topics: this.cache.slice(-10).map(e => ({ query: e.query, date: e.createdAt, source: e.source })),
    };
  }

  // ═══════════════════════════════════════
  // INTERNAL HELPERS
  // ═══════════════════════════════════════

  /**
   * Load the index of all research files into memory (lightweight — no full results)
   */
  async _loadIndex() {
    try {
      const files = await fs.readdir(this.dataDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const data = await fs.readFile(path.join(this.dataDir, file), 'utf-8');
          const record = JSON.parse(data);
          this.cache.push({
            id: record.id,
            query: record.query,
            queryNormalized: record.queryNormalized || this._normalize(record.query),
            queryTokens: record.queryTokens || this._tokenize(record.query),
            source: record.source,
            timestamp: record.timestamp,
            createdAt: record.createdAt,
            resultLength: (record.results || '').length,
          });
        } catch (e) {
          // Skip corrupt files
        }
      }
    } catch (e) {
      // Directory might not exist yet
    }
  }

  /**
   * Normalize a query string for comparison
   */
  _normalize(query) {
    return (query || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize a query into significant words (remove stop words)
   */
  _tokenize(query) {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
      'should', 'may', 'might', 'must', 'can', 'could', 'of', 'at', 'by',
      'for', 'with', 'about', 'against', 'between', 'through', 'during',
      'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
      'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
      'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how',
      'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
      'too', 'very', 'just', 'because', 'and', 'but', 'or', 'if',
      'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
      'i', 'me', 'my', 'myself', 'we', 'our', 'you', 'your', 'he', 'she',
      'it', 'they', 'them', 'find', 'search', 'look', 'get', 'show',
    ]);

    return this._normalize(query)
      .split(' ')
      .filter(w => w.length > 1 && !stopWords.has(w));
  }

  /**
   * Calculate fuzzy similarity between two queries
   * Uses token overlap (Jaccard) + substring matching
   */
  _similarityScore(normA, tokensA, normB, tokensB) {
    // Exact match
    if (normA === normB) return 1.0;

    // Token overlap (Jaccard similarity)
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    const jaccard = union.size > 0 ? intersection.size / union.size : 0;

    // Substring bonus: if one query contains the other
    let substringBonus = 0;
    if (normA.includes(normB) || normB.includes(normA)) {
      substringBonus = 0.3;
    }

    // Partial word match bonus (stems)
    let partialBonus = 0;
    for (const tokenA of tokensA) {
      for (const tokenB of tokensB) {
        if (tokenA.length > 3 && tokenB.length > 3) {
          if (tokenA.startsWith(tokenB.substring(0, 4)) || tokenB.startsWith(tokenA.substring(0, 4))) {
            partialBonus += 0.05;
          }
        }
      }
    }
    partialBonus = Math.min(partialBonus, 0.2);

    return Math.min(jaccard + substringBonus + partialBonus, 1.0);
  }
}
