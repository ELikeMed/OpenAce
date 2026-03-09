/**
 * OpenAce Knowledge Base — Upgraded with TF-IDF Search
 * 
 * Phase 4 SuperBrain Upgrade:
 * - TF-IDF scoring for relevance ranking (replaces keyword includes)
 * - Entity-aware search (people, companies, locations, dates)
 * - Recency weighting (recent knowledge ranked higher)
 * - Category filtering (marketing queries search marketing first)
 * - Access count boosting (frequently-used knowledge ranks higher)
 * - Automatic entity extraction on learn()
 */

import fs from 'fs/promises';
import path from 'path';
import { eventBus, EVENTS } from '../events/EventBus.js';

// ═══════════════════════════════════════════════════════
// TF-IDF IMPLEMENTATION (no external dependencies)
// ═══════════════════════════════════════════════════════

// Common English stop words to ignore in TF-IDF
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same',
  'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or',
  'if', 'while', 'about', 'up', 'its', 'it', 'i', 'me', 'my', 'we',
  'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
  'them', 'their', 'this', 'that', 'these', 'those', 'what', 'which',
  'who', 'whom'
]);

/**
 * Tokenize text into normalized terms (lowercase, no stop words, no short words)
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s@.-]/g, ' ')  // Keep @, ., - for emails/URLs
    .split(/\s+/)
    .filter(word => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Calculate term frequency for a document
 */
function termFrequency(terms) {
  const tf = {};
  for (const term of terms) {
    tf[term] = (tf[term] || 0) + 1;
  }
  // Normalize by document length
  const len = terms.length || 1;
  for (const term in tf) {
    tf[term] /= len;
  }
  return tf;
}

/**
 * Calculate TF-IDF score between query and a document
 */
function tfidfScore(queryTerms, docTerms, idf) {
  const docTf = termFrequency(docTerms);
  let score = 0;
  for (const term of queryTerms) {
    if (docTf[term]) {
      score += docTf[term] * (idf[term] || 1);
    }
  }
  return score;
}

// ═══════════════════════════════════════════════════════
// ENTITY EXTRACTION
// ═══════════════════════════════════════════════════════

const ENTITY_PATTERNS = {
  emails: /[\w.-]+@[\w.-]+\.\w+/g,
  urls: /https?:\/\/[^\s]+/g,
  dates: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}(?:,?\s+\d{4})?\b/gi,
  money: /\$[\d,.]+(?:\s*(?:k|m|b|million|billion|thousand))?\b/gi,
  locations: /\b(?:miami|tampa|orlando|fort lauderdale|st\.? petersburg|austin|nyc|new york|los angeles|chicago|dallas|houston|atlanta|denver|seattle|boston|san francisco|portland|nashville|phoenix)\b/gi,
  companies: /\b(?:likeminded(?:pro)?|google|facebook|meta|linkedin|twitter|instagram|zoom|slack|github)\b/gi,
  percentages: /\d+(?:\.\d+)?%/g
};

function extractEntities(text) {
  if (!text) return {};
  const entities = {};
  for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      entities[type] = [...new Set(matches.map(m => m.toLowerCase()))];
    }
  }
  return entities;
}

/**
 * Detect category from text
 */
function detectCategory(text) {
  const lower = text.toLowerCase();
  const categories = {
    marketing: ['marketing', 'campaign', 'social', 'content', 'brand', 'seo', 'lead gen', 'analytics', 'engagement', 'followers'],
    technology: ['code', 'tech', 'api', 'deploy', 'server', 'bug', 'feature', 'architecture', 'performance', 'security'],
    operations: ['operations', 'process', 'efficiency', 'kpi', 'metric', 'resource', 'team', 'workflow', 'budget'],
    sales: ['lead', 'deal', 'pipeline', 'proposal', 'client', 'prospect', 'revenue', 'close', 'pitch'],
    events: ['meetup', 'event', 'conference', 'workshop', 'networking', 'venue', 'attendee', 'schedule']
  };
  
  let bestCategory = null;
  let bestScore = 0;
  
  for (const [cat, keywords] of Object.entries(categories)) {
    const score = keywords.filter(kw => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }
  
  return bestCategory;
}

// ═══════════════════════════════════════════════════════
// KNOWLEDGE BASE CLASS
// ═══════════════════════════════════════════════════════

export class KnowledgeBase {
  constructor(knowledgeDir) {
    this.knowledgeDir = knowledgeDir;
    this.knowledge = [];
    this.cache = new Map();
    
    // TF-IDF: Inverse Document Frequency lookup (rebuilt on load)
    this.idf = {};
    this.totalDocs = 0;
  }

  async initialize() {
    try {
      await fs.mkdir(this.knowledgeDir, { recursive: true });
    } catch {}

    await this.loadKnowledge();
    this.rebuildIDF();
    console.log(`✅ Knowledge base loaded (${this.knowledge.length} entries, TF-IDF indexed)`);
    return this;
  }

  async loadKnowledge() {
    try {
      const knowledgePath = path.join(this.knowledgeDir, 'knowledge.json');
      const data = await fs.readFile(knowledgePath, 'utf-8');
      this.knowledge = JSON.parse(data);
    } catch {
      this.knowledge = [];
    }
  }

  async saveKnowledge() {
    const knowledgePath = path.join(this.knowledgeDir, 'knowledge.json');
    await fs.writeFile(knowledgePath, JSON.stringify(this.knowledge, null, 2));
  }

  /**
   * Rebuild the IDF (Inverse Document Frequency) index
   * Called after loading or after significant changes
   */
  rebuildIDF() {
    const docFreq = {};  // term → number of documents containing it
    this.totalDocs = this.knowledge.length || 1;
    
    for (const entry of this.knowledge) {
      const text = `${entry.question} ${entry.answer}`;
      const uniqueTerms = new Set(tokenize(text));
      for (const term of uniqueTerms) {
        docFreq[term] = (docFreq[term] || 0) + 1;
      }
    }
    
    // IDF = log(totalDocs / docFreq) — rarer terms get higher weight
    this.idf = {};
    for (const [term, freq] of Object.entries(docFreq)) {
      this.idf[term] = Math.log(this.totalDocs / freq);
    }
  }

  /**
   * Learn from a conversation — now with entity extraction and categorization
   */
  async learn(question, answer) {
    const fullText = `${question} ${answer}`;
    const entities = extractEntities(fullText);
    const category = detectCategory(fullText);
    
    const entry = {
      id: Date.now().toString(),
      question,
      answer,
      category,
      entities,
      tokens: tokenize(fullText),  // Pre-tokenized for fast search
      timestamp: new Date().toISOString(),
      access_count: 0
    };

    this.knowledge.push(entry);

    // Rebuild IDF periodically (every 20 entries to balance accuracy vs performance)
    if (this.knowledge.length % 20 === 0) {
      this.rebuildIDF();
    }

    // Save periodically
    if (this.knowledge.length % 10 === 0) {
      await this.saveKnowledge();
    }

    eventBus.emit(EVENTS.KNOWLEDGE_LEARNED, { id: entry.id, category, entityCount: Object.keys(entities).length });
    return entry;
  }

  /**
   * TF-IDF powered search with entity awareness and recency weighting
   * 
   * Scoring formula:
   *   score = tfidf_score * (1 + entity_bonus) * recency_weight * access_bonus
   */
  async search(query, limit = 5, options = {}) {
    const queryTerms = tokenize(query);
    const queryEntities = extractEntities(query);
    const queryCategory = options.category || detectCategory(query);
    const now = Date.now();
    
    if (queryTerms.length === 0 && Object.keys(queryEntities).length === 0) {
      return [];
    }

    const scored = this.knowledge.map(entry => {
      // 1. TF-IDF score (primary relevance signal)
      const docTerms = entry.tokens || tokenize(`${entry.question} ${entry.answer}`);
      let score = tfidfScore(queryTerms, docTerms, this.idf);
      
      // 2. Entity overlap bonus (matching entities = highly relevant)
      let entityBonus = 0;
      if (entry.entities && Object.keys(queryEntities).length > 0) {
        for (const [type, queryVals] of Object.entries(queryEntities)) {
          const entryVals = entry.entities[type] || [];
          const overlap = queryVals.filter(v => entryVals.includes(v)).length;
          entityBonus += overlap * 0.5;  // Each matching entity adds 0.5
        }
      }
      
      // 3. Category match bonus
      if (queryCategory && entry.category === queryCategory) {
        score *= 1.3; // 30% boost for same category
      }
      
      // 4. Recency weighting (exponential decay over 30 days)
      const daysSince = (now - new Date(entry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.exp(-daysSince / 30); // ~37% after 30 days, ~14% after 60 days
      
      // 5. Access count bonus (frequently used knowledge is valuable)
      const accessBonus = 1 + Math.log1p(entry.access_count || 0) * 0.1;
      
      // Final composite score
      const finalScore = score * (1 + entityBonus) * (0.5 + 0.5 * recencyWeight) * accessBonus;
      
      return { entry, score: finalScore, entityBonus, recencyWeight };
    })
    .filter(item => item.score > 0.01) // Minimum threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

    // Update access counts and emit event
    const results = scored.map(item => {
      item.entry.access_count = (item.entry.access_count || 0) + 1;
      return {
        id: item.entry.id,
        content: `Q: ${item.entry.question}\nA: ${item.entry.answer.substring(0, 300)}`,
        relevance: Math.round(item.score * 100) / 100,
        category: item.entry.category,
        entities: item.entry.entities,
        entityBonus: item.entityBonus,
        recency: Math.round(item.recencyWeight * 100) + '%',
        timestamp: item.entry.timestamp
      };
    });

    if (results.length > 0) {
      eventBus.emit(EVENTS.KNOWLEDGE_RECALLED, { query: query.substring(0, 50), resultCount: results.length, topScore: results[0]?.relevance });
    }

    return results;
  }

  /**
   * Search by entity (find all knowledge mentioning a specific entity)
   */
  searchByEntity(entityType, entityValue) {
    const lower = entityValue.toLowerCase();
    return this.knowledge
      .filter(entry => {
        const vals = entry.entities?.[entityType] || [];
        return vals.some(v => v.includes(lower));
      })
      .map(entry => ({
        id: entry.id,
        content: `Q: ${entry.question}\nA: ${entry.answer.substring(0, 200)}`,
        category: entry.category,
        timestamp: entry.timestamp
      }));
  }

  /**
   * Search by category
   */
  searchByCategory(category, limit = 10) {
    return this.knowledge
      .filter(entry => entry.category === category)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit)
      .map(entry => ({
        id: entry.id,
        content: `Q: ${entry.question}\nA: ${entry.answer.substring(0, 200)}`,
        timestamp: entry.timestamp
      }));
  }

  getCached(question) {
    const key = question.toLowerCase().trim();
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached;
    if (cached) this.cache.delete(key); // Expired
    return null;
  }

  setCache(question, response, ttl = 3600000) {
    const key = question.toLowerCase().trim();
    this.cache.set(key, { response, expires: Date.now() + ttl });
  }

  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (value.expires < now) this.cache.delete(key);
    }
  }

  getStats() {
    const categories = {};
    for (const entry of this.knowledge) {
      const cat = entry.category || 'uncategorized';
      categories[cat] = (categories[cat] || 0) + 1;
    }
    
    return {
      total: this.knowledge.length,
      cached: this.cache.size,
      categories,
      idfTermCount: Object.keys(this.idf).length,
      most_accessed: this.knowledge
        .sort((a, b) => (b.access_count || 0) - (a.access_count || 0))
        .slice(0, 5)
        .map(e => ({ question: e.question.substring(0, 60), count: e.access_count || 0 }))
    };
  }

  async export() {
    return { knowledge: this.knowledge, exported_at: new Date().toISOString(), version: '2.0.0' };
  }

  async import(data) {
    this.knowledge = data.knowledge;
    this.rebuildIDF();
    await this.saveKnowledge();
    console.log(`✅ Imported ${this.knowledge.length} knowledge entries (TF-IDF reindexed)`);
  }
}
