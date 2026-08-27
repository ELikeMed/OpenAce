/**
 * OpenAce Workload Store — File & Codebase Knowledge Ingestion
 *
 * Allows users to drop in files (PDFs, docs, spreadsheets, code) and entire
 * codebases. Ace ingests, chunks, indexes with TF-IDF, and can search/reference
 * the knowledge when answering questions or doing tasks.
 *
 * Separate from KnowledgeBase (Q&A pairs) to avoid IDF contamination.
 */

import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { eventBus } from '../events/EventBus.js';

// ═══════════════════════════════════════════════════════
// TF-IDF UTILITIES (same logic as KnowledgeBase.js)
// ═══════════════════════════════════════════════════════

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
  'who', 'whom', 'const', 'let', 'var', 'return', 'new', 'true', 'false',
  'null', 'undefined', 'else', 'try', 'catch', 'throw'
]);

// Light suffix stripping so a query for "restaurant" matches indexed "restaurants".
// Applied to documents and queries alike, so exactness matters less than consistency.
// Identifier-ish tokens are left alone — stemming "index.js" would strip the "s".
function stem(word) {
  if (/[./\\@]/.test(word)) return word;
  if (word.length > 4 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') && !word.endsWith('us')) return word.slice(0, -1);
  return word;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s@./\\-]/g, ' ')
    .split(/\s+/)
    // Trim punctuation the sentence left attached ("seo." -> "seo") while keeping it
    // inside the token, so filenames and domains still index as "index.js".
    .map(word => word.replace(/^[./\\-]+|[./\\-]+$/g, ''))
    .filter(word => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem);
}

function termFrequency(terms) {
  const tf = {};
  for (const term of terms) {
    tf[term] = (tf[term] || 0) + 1;
  }
  const len = terms.length || 1;
  for (const term in tf) {
    tf[term] /= len;
  }
  return tf;
}

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
// CONSTANTS
// ═══════════════════════════════════════════════════════

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '__pycache__',
  '.venv', 'vendor', 'coverage', '.cache', '.turbo', '.vercel',
  '.svelte-kit', '.nuxt', '.output'
]);

const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store',
  'Thumbs.db', '.gitkeep'
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.json', '.html', '.css', '.scss',
  '.md', '.txt', '.yaml', '.yml', '.toml', '.sql', '.graphql', '.sh',
  '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.swift', '.vue',
  '.svelte', '.env.example', '.xml', '.ini', '.cfg'
]);

const DOC_EXTENSIONS = new Set(['.pdf', '.docx', '.doc', '.txt', '.md', '.csv', '.text']);

const MAX_FILE_SIZE = 500_000; // 500KB

const LANGUAGE_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
  '.c': 'c', '.cpp': 'cpp', '.h': 'c-header', '.swift': 'swift',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.vue': 'vue', '.svelte': 'svelte',
  '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml', '.toml': 'toml',
  '.sql': 'sql', '.graphql': 'graphql', '.sh': 'shell',
  '.md': 'markdown', '.txt': 'text', '.xml': 'xml',
  '.pdf': 'pdf', '.docx': 'docx', '.doc': 'doc', '.csv': 'csv'
};

// ═══════════════════════════════════════════════════════
// CODE METADATA EXTRACTION (regex-based, no AST)
// ═══════════════════════════════════════════════════════

function extractCodeMetadata(content, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const meta = { language: LANGUAGE_MAP[ext] || 'unknown', imports: [], exports: [], functions: [], classes: [], routes: [] };

  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    // Imports
    const importMatches = content.match(/import\s+(?:{[^}]+}|\w+)\s+from\s+['"]([^'"]+)['"]/g) || [];
    meta.imports = importMatches.map(m => {
      const from = m.match(/from\s+['"]([^'"]+)['"]/);
      return from ? from[1] : m;
    });

    // Exports
    const exportMatches = content.match(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g) || [];
    meta.exports = exportMatches.map(m => m.match(/(\w+)$/)?.[1]).filter(Boolean);

    // Functions
    const funcMatches = content.match(/(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(?/g) || [];
    meta.functions = funcMatches.map(m => {
      const named = m.match(/function\s+(\w+)/);
      if (named) return named[1];
      const arrow = m.match(/(?:const|let|var)\s+(\w+)/);
      return arrow ? arrow[1] : null;
    }).filter(Boolean).slice(0, 20);

    // Classes
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    meta.classes = classMatches.map(m => m.match(/class\s+(\w+)/)?.[1]).filter(Boolean);

    // Routes (Express-style)
    const routeMatches = content.match(/(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g) || [];
    meta.routes = routeMatches.map(m => {
      const parts = m.match(/\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/);
      return parts ? `${parts[1].toUpperCase()} ${parts[2]}` : m;
    });
  } else if (ext === '.py') {
    const defMatches = content.match(/def\s+(\w+)\s*\(/g) || [];
    meta.functions = defMatches.map(m => m.match(/def\s+(\w+)/)?.[1]).filter(Boolean);

    const classMatches = content.match(/class\s+(\w+)/g) || [];
    meta.classes = classMatches.map(m => m.match(/class\s+(\w+)/)?.[1]).filter(Boolean);

    const importMatches = content.match(/(?:from\s+\S+\s+)?import\s+.+/g) || [];
    meta.imports = importMatches.slice(0, 15);
  }

  return meta;
}

// ═══════════════════════════════════════════════════════
// WORKLOAD STORE CLASS
// ═══════════════════════════════════════════════════════

const MEDIA_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
  '.mp3', '.wav', '.ogg', '.m4a'
]);

const MEDIA_TYPE_MAP = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
  '.webp': 'image', '.svg': 'image', '.bmp': 'image', '.ico': 'image',
  '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video',
  '.webm': 'video', '.m4v': 'video',
  '.mp3': 'audio', '.wav': 'audio', '.ogg': 'audio', '.m4a': 'audio'
};

// ═══════════════════════════════════════════════════════
// EMBEDDINGS — local, via Ollama. No external service.
// ═══════════════════════════════════════════════════════

const EMBED_URL = process.env.OLLAMA_EMBED_URL || 'http://localhost:11434/api/embeddings';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const EMBED_CONCURRENCY = 4;
const EMBED_REPROBE_MS = 60_000;

// Weight on semantic similarity when blending with the keyword score. Swept on a
// 36-question set: top-1 accuracy was 18/36 at 0 (keyword only), 20/36 at 0.7, 26/36 at
// 0.9, and 24/36 at 1.0 — the small keyword term is what keeps exact tokens like "BANT"
// competitive, which pure vector search loses.
//
// Cosine is deliberately left un-normalised here. Min-max scaling the vector scores across
// the candidate set ranked marginally better, but it makes the top hit score ~1.0 even when
// every candidate is poor, which would destroy the absolute threshold in getMinRelevance().
const VECTOR_WEIGHT = 0.9;

// nomic-embed-text is trained with task prefixes; using them widened the gap between a
// matching and a non-matching passage from 0.19 to 0.27 in local testing.
const EMBED_PREFIX = { document: 'search_document: ', query: 'search_query: ' };

async function embedText(text, kind = 'document') {
  const res = await fetch(EMBED_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: (EMBED_PREFIX[kind] || '') + text })
  });
  if (!res.ok) throw new Error(`embed failed: ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json.embedding) || json.embedding.length === 0) throw new Error('embed returned no vector');
  // 5 decimals keeps the chunk files a manageable size without measurably affecting cosine.
  return json.embedding.map(v => Math.round(v * 1e5) / 1e5);
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export class WorkloadStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.chunksDir = path.join(dataDir, 'chunks');
    this.filesDir = path.join(dataDir, 'files');
    this.mediaDir = path.join(dataDir, 'media');
    this.indexPath = path.join(dataDir, 'index.json');
    this.sources = [];
    this.media = []; // { id, filename, path, type, size, tags, description, addedAt }
    this.removedMediaPaths = []; // Paths user removed — skip on rescan
    this.idf = {};
    this.totalChunks = 0;
    this._allTokenSets = []; // For IDF rebuilding
    this.embeddingsEnabled = false; // set by initialize() after probing Ollama
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.chunksDir, { recursive: true });
    await fs.mkdir(this.filesDir, { recursive: true });
    await fs.mkdir(this.mediaDir, { recursive: true });

    await this._loadIndex();
    await this._rebuildIDF();
    await this._probeEmbeddings();
    await this.scanMedia(); // Auto-scan media folder on startup

    const totalChunks = this.sources.reduce((sum, s) => sum + (s.chunkCount || 0), 0);
    const mode = this.embeddingsEnabled ? 'hybrid semantic + keyword' : 'keyword only';
    console.log(`\u2705 Workload store loaded (${this.sources.length} sources, ${totalChunks} chunks, ${this.media.length} media files, ${mode})`);
    return this;
  }

  // ── Index Management ──

  // Semantic search is a local Ollama call. If the model or the daemon is unavailable the
  // store silently stays on keyword search rather than failing to load.
  async _probeEmbeddings() {
    try {
      await embedText('probe', 'query');
      if (!this.embeddingsEnabled) console.log('\u2705 Workload: semantic search active');
      this.embeddingsEnabled = true;
    } catch {
      this.embeddingsEnabled = false;
      console.log(`\u2139\uFE0F  Workload: embedding model "${EMBED_MODEL}" unavailable, using keyword search`);
    }
    this._lastProbe = Date.now();
  }

  // Ollama runs as a desktop app in the same login session as the server, so on a reboot
  // the two race — probing once at startup can lose and leave the store permanently on
  // keyword search. Retry occasionally so it recovers on its own once Ollama is up.
  async _maybeReprobe() {
    if (this.embeddingsEnabled) return;
    if (this._lastProbe && Date.now() - this._lastProbe < EMBED_REPROBE_MS) return;
    await this._probeEmbeddings();
    // Documents ingested while embeddings were down have no vectors; backfill them so
    // semantic search covers the whole corpus rather than whatever arrived after recovery.
    if (this.embeddingsEnabled) await this._backfillMissingEmbeddings();
  }

  async _backfillMissingEmbeddings() {
    for (const source of this.sources) {
      const chunks = await this._loadChunks(source.id);
      if (chunks.length === 0 || chunks.every(c => c.embedding)) continue;
      await this._embedChunks(chunks);
      await fs.writeFile(path.join(this.chunksDir, `${source.id}.json`), JSON.stringify(chunks, null, 2));
      console.log(`[Workload] backfilled embeddings for ${source.name}`);
    }
  }

  // Relevance is on a different scale in each mode, so the caller asks rather than guessing.
  //
  // 0.55 was calibrated against on- and off-topic query sets. It admits every on-topic
  // question measured (the lowest scored 0.572) and rejects roughly half the off-topic ones
  // — "hello", "who won the world cup", "capital of France", "write me a python script".
  // It cannot separate the rest: nomic-embed-text has a high similarity floor, so an
  // unrelated short query still scores ~0.5 against a topical corpus, and neither a z-score
  // nor a top-minus-mean margin separated the two sets any better. Queries like "send an
  // email to John" still clear the bar, which is why the injected block is framed as
  // possibly-irrelevant reference material rather than as authoritative context.
  getMinRelevance() {
    return this.embeddingsEnabled ? 0.55 : 0.03;
  }

  async _loadIndex() {
    try {
      const data = await fs.readFile(this.indexPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.sources = parsed.sources || [];
      this.media = parsed.media || [];
      this.removedMediaPaths = parsed.removedMediaPaths || [];
    } catch {
      this.sources = [];
      this.media = [];
      this.removedMediaPaths = [];
    }
  }

  async _saveIndex() {
    await fs.writeFile(this.indexPath, JSON.stringify({
      version: '1.0.0',
      sources: this.sources,
      media: this.media,
      removedMediaPaths: this.removedMediaPaths
    }, null, 2));
  }

  async _loadChunks(sourceId) {
    try {
      const data = await fs.readFile(path.join(this.chunksDir, `${sourceId}.json`), 'utf-8');
      return JSON.parse(data);
    } catch (err) {
      // An indexed source whose chunks have vanished means this instance is serving a
      // stale index — typically because something re-ingested out of process while the
      // server was running. Silence here turns that into "the knowledge base is empty"
      // with no indication why, so say it once per source.
      if (!this._warnedMissingChunks) this._warnedMissingChunks = new Set();
      if (!this._warnedMissingChunks.has(sourceId)) {
        this._warnedMissingChunks.add(sourceId);
        console.warn(`[Workload] chunks missing for indexed source ${sourceId} (${err.code || err.message}). ` +
                     `The in-memory index is stale — reload() or restart to pick up on-disk changes.`);
      }
      return [];
    }
  }

  // Re-read the index from disk. Lets a running instance pick up an out-of-process
  // re-ingest without a restart.
  async reload() {
    await this._loadIndex();
    await this._rebuildIDF();
    this._warnedMissingChunks = null;
    const chunks = this.sources.reduce((n, s) => n + (s.chunkCount || 0), 0);
    console.log(`\u2705 Workload store reloaded (${this.sources.length} sources, ${chunks} chunks)`);
    return { sources: this.sources.length, chunks };
  }

  async _saveChunks(sourceId, chunks) {
    // Every ingest path funnels through here, so embedding at this point covers files,
    // uploads, folders, and codebases without touching each one.
    if (this.embeddingsEnabled) await this._embedChunks(chunks);
    await fs.writeFile(path.join(this.chunksDir, `${sourceId}.json`), JSON.stringify(chunks, null, 2));
  }

  // Embeds in small concurrent batches. A failure downgrades that chunk to keyword-only
  // rather than aborting the whole ingest.
  async _embedChunks(chunks) {
    const pending = chunks.filter(c => !c.embedding && c.content);
    if (pending.length === 0) return;

    let failures = 0;
    for (let i = 0; i < pending.length; i += EMBED_CONCURRENCY) {
      const batch = pending.slice(i, i + EMBED_CONCURRENCY);
      await Promise.all(batch.map(async (chunk) => {
        try {
          chunk.embedding = await embedText(chunk.content, 'document');
        } catch {
          failures++;
        }
      }));
    }
    if (failures > 0) console.warn(`[Workload] ${failures}/${pending.length} chunks could not be embedded`);
  }

  // ── IDF Rebuilding ──

  async _rebuildIDF() {
    const docFreq = {};
    let totalDocs = 0;

    for (const source of this.sources) {
      if (source.status !== 'ready') continue;
      const chunks = await this._loadChunks(source.id);
      for (const chunk of chunks) {
        totalDocs++;
        const uniqueTerms = new Set(chunk.tokens || tokenize(chunk.content));
        for (const term of uniqueTerms) {
          docFreq[term] = (docFreq[term] || 0) + 1;
        }
      }
    }

    this.totalChunks = totalDocs || 1;
    this.idf = {};
    for (const [term, freq] of Object.entries(docFreq)) {
      this.idf[term] = Math.log(this.totalChunks / freq);
    }
  }

  // ── File Parsing ──

  async _parseFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const buffer = await fs.readFile(filePath);

    if (ext === '.pdf') {
      try {
        const pdfParse = await import('pdf-parse');
        const pdf = pdfParse.default || pdfParse;
        const result = await pdf(buffer);
        return result.text || '';
      } catch (e) {
        console.warn(`[WorkloadStore] PDF parse failed for ${filePath}: ${e.message}`);
        return '';
      }
    }

    if (ext === '.docx' || ext === '.doc') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (e) {
        console.warn(`[WorkloadStore] DOCX parse failed for ${filePath}: ${e.message}`);
        return '';
      }
    }

    // Everything else: try as UTF-8
    return buffer.toString('utf-8');
  }

  async _parseBuffer(buffer, filename) {
    const ext = path.extname(filename).toLowerCase();

    if (ext === '.pdf') {
      try {
        const { PDFParse } = await import('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text || '';
      } catch (e) {
        console.warn(`[WorkloadStore] PDF parse failed: ${e.message}`);
        return '';
      }
    }

    if (ext === '.docx' || ext === '.doc') {
      try {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (e) {
        console.warn(`[WorkloadStore] DOCX parse failed: ${e.message}`);
        return '';
      }
    }

    return buffer.toString('utf-8');
  }

  // ── Chunking ──

  _chunkText(text, maxChars = 800, overlap = 100) {
    const chunks = [];
    // Split at paragraph boundaries
    const paragraphs = text.split(/\n\s*\n/);
    let current = '';
    let heading = '';       // most recent markdown heading seen
    let chunkHeading = '';  // heading in force when `current` began

    // Prefix each chunk with its section heading. A chunk split away from its heading
    // otherwise loses the very words a question asks for — "Pricing Strategy" content
    // that never repeats the word "pricing" is unreachable by a query about pricing.
    const push = (body) => {
      const t = body.trim();
      if (!t) return;
      chunks.push(chunkHeading && !t.startsWith(chunkHeading) ? `${chunkHeading}\n\n${t}` : t);
    };

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) heading = trimmed.split('\n')[0].trim();

      if (current.length + trimmed.length + 2 > maxChars && current.length > 0) {
        push(current);
        // Overlap: keep last portion
        const overlapText = current.slice(-overlap);
        chunkHeading = heading;
        current = overlapText + '\n\n' + trimmed;
      } else {
        if (!current) chunkHeading = heading;
        current += (current ? '\n\n' : '') + trimmed;
      }
    }
    if (current.trim()) push(current);

    // If no paragraph breaks, split by character
    if (chunks.length === 0 && text.trim().length > 0) {
      for (let i = 0; i < text.length; i += maxChars - overlap) {
        chunks.push(text.slice(i, i + maxChars).trim());
      }
    }

    return chunks;
  }

  _chunkCode(content, filePath) {
    // Small files: keep as single chunk
    if (content.length <= 1500) {
      return [content];
    }

    // Extract import block to prepend to each chunk
    const lines = content.split('\n');
    const importLines = [];
    let importEnd = 0;
    for (let i = 0; i < lines.length && i < 30; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('from ') || line.startsWith('const ') && line.includes('require(')) {
        importLines.push(lines[i]);
        importEnd = i + 1;
      } else if (line === '' && importLines.length > 0) {
        importEnd = i + 1;
      } else if (importLines.length > 0 && !line.startsWith('import') && !line.startsWith('//') && line !== '') {
        break;
      }
    }
    const importBlock = importLines.length > 0 ? importLines.join('\n') + '\n\n' : '';

    // Split at function/class boundaries (blank line sections)
    const sections = [];
    let currentSection = '';
    let lineNum = importEnd;

    for (let i = importEnd; i < lines.length; i++) {
      const line = lines[i];
      const isBreak = (
        line.trim() === '' &&
        i + 1 < lines.length &&
        (lines[i + 1].match(/^(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var|\/\*\*|\/\/\s*[═─])/) ||
         lines[i + 1].trim().startsWith('})'))
      );

      currentSection += line + '\n';

      if ((isBreak || currentSection.length > 1200) && currentSection.trim().length > 50) {
        sections.push(currentSection.trim());
        currentSection = '';
      }
    }
    if (currentSection.trim().length > 50) {
      sections.push(currentSection.trim());
    }

    // Prepend imports to each chunk for context
    return sections.map(s => {
      if (s.includes('import ') || s.length + importBlock.length > 2000) return s;
      return importBlock + s;
    });
  }

  _chunkCSV(content) {
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    const header = lines[0];
    const chunks = [];
    const batchSize = 20;

    for (let i = 1; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize);
      chunks.push(header + '\n' + batch.join('\n'));
    }

    return chunks.length > 0 ? chunks : [content];
  }

  // ── Ingestion ──

  async ingestFile(filePath, sourceName) {
    const sourceId = `src_${Date.now()}`;
    const filename = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Update source entry
    const source = {
      id: sourceId,
      name: sourceName || filename,
      type: 'file',
      path: filePath,
      originalFilename: filename,
      fileCount: 1,
      chunkCount: 0,
      totalSize: 0,
      ingestedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      extensions: [ext],
      status: 'ingesting'
    };
    this.sources.push(source);
    await this._saveIndex();

    try {
      const content = await this._parseFile(filePath);
      if (!content.trim()) {
        source.status = 'failed';
        await this._saveIndex();
        return { error: 'No text content extracted' };
      }

      source.totalSize = Buffer.byteLength(content, 'utf-8');

      const isCode = CODE_EXTENSIONS.has(ext) && !DOC_EXTENSIONS.has(ext);
      const isCSV = ext === '.csv';
      let textChunks;
      if (isCSV) {
        textChunks = this._chunkCSV(content);
      } else if (isCode) {
        textChunks = this._chunkCode(content, filePath);
      } else {
        textChunks = this._chunkText(content);
      }

      const chunks = textChunks.map((text, idx) => ({
        id: `chk_${sourceId}_${idx}`,
        sourceId,
        filePath: filename,
        fileType: LANGUAGE_MAP[ext] || 'text',
        chunkIndex: idx,
        totalChunks: textChunks.length,
        content: text,
        tokens: tokenize(text),
        metadata: isCode ? extractCodeMetadata(text, filePath) : { language: LANGUAGE_MAP[ext] || 'text' }
      }));

      await this._saveChunks(sourceId, chunks);
      source.chunkCount = chunks.length;
      source.status = 'ready';
      await this._saveIndex();
      await this._rebuildIDF();

      eventBus.emit('workload:ingested', { sourceId, name: source.name, chunkCount: chunks.length });
      return { sourceId, name: source.name, chunkCount: chunks.length, status: 'ready' };
    } catch (e) {
      source.status = 'failed';
      await this._saveIndex();
      return { error: e.message };
    }
  }

  async ingestUploadedBuffer(buffer, filename, sourceName, options = {}) {
    // Save raw file for re-ingestion
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const savedPath = path.join(this.filesDir, `${Date.now()}_${safeName}`);
    await fs.writeFile(savedPath, buffer);

    // A caller re-ingesting a document it already owns can pin the id, so re-seeding
    // replaces chunks in place instead of orphaning whatever a running server has loaded.
    const sourceId = options.sourceId || `src_${Date.now()}`;
    const ext = path.extname(filename).toLowerCase();

    const source = {
      id: sourceId,
      name: sourceName || filename,
      type: 'file',
      path: savedPath,
      originalFilename: filename,
      fileCount: 1,
      chunkCount: 0,
      totalSize: buffer.length,
      ingestedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      extensions: [ext],
      status: 'ingesting'
    };
    this.sources.push(source);
    await this._saveIndex();

    try {
      const content = await this._parseBuffer(buffer, filename);
      if (!content.trim()) {
        source.status = 'failed';
        await this._saveIndex();
        return { error: 'No text content extracted from file' };
      }

      const isCSV = ext === '.csv';
      const isCode = CODE_EXTENSIONS.has(ext) && !DOC_EXTENSIONS.has(ext);
      let textChunks;
      if (isCSV) {
        textChunks = this._chunkCSV(content);
      } else if (isCode) {
        textChunks = this._chunkCode(content, filename);
      } else {
        textChunks = this._chunkText(content);
      }

      const chunks = textChunks.map((text, idx) => ({
        id: `chk_${sourceId}_${idx}`,
        sourceId,
        filePath: filename,
        fileType: LANGUAGE_MAP[ext] || 'text',
        chunkIndex: idx,
        totalChunks: textChunks.length,
        content: text,
        tokens: tokenize(text),
        metadata: isCode ? extractCodeMetadata(text, filename) : { language: LANGUAGE_MAP[ext] || 'text' }
      }));

      await this._saveChunks(sourceId, chunks);
      source.chunkCount = chunks.length;
      source.status = 'ready';
      await this._saveIndex();
      await this._rebuildIDF();

      eventBus.emit('workload:ingested', { sourceId, name: source.name, chunkCount: chunks.length });
      return { sourceId, name: source.name, chunkCount: chunks.length, status: 'ready' };
    } catch (e) {
      source.status = 'failed';
      await this._saveIndex();
      return { error: e.message };
    }
  }

  async ingestCodebase(codePath, options = {}) {
    const sourceId = options.sourceId || `src_${Date.now()}`;
    const sourceName = options.sourceName || path.basename(codePath);

    const source = {
      id: sourceId,
      name: sourceName,
      type: 'codebase',
      path: codePath,
      fileCount: 0,
      chunkCount: 0,
      totalSize: 0,
      ingestedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      extensions: [],
      status: 'ingesting'
    };
    this.sources.push(source);
    await this._saveIndex();

    try {
      const allChunks = [];
      const extensionSet = new Set();
      let fileCount = 0;

      const walk = async (dir, relativeBase = '') => {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch { return; }

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(relativeBase, entry.name);

          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await walk(fullPath, relativePath);
          } else if (entry.isFile()) {
            if (SKIP_FILES.has(entry.name)) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!CODE_EXTENSIONS.has(ext)) continue;

            // Check file size
            try {
              const stat = await fs.stat(fullPath);
              if (stat.size > MAX_FILE_SIZE) continue;
              source.totalSize += stat.size;
            } catch { continue; }

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              if (!content.trim()) continue;

              extensionSet.add(ext);
              fileCount++;

              const isCSV = ext === '.csv';
              let textChunks;
              if (isCSV) {
                textChunks = this._chunkCSV(content);
              } else {
                textChunks = this._chunkCode(content, fullPath);
              }

              const meta = extractCodeMetadata(content, fullPath);

              for (let idx = 0; idx < textChunks.length; idx++) {
                allChunks.push({
                  id: `chk_${sourceId}_${fileCount}_${idx}`,
                  sourceId,
                  filePath: relativePath,
                  fileType: LANGUAGE_MAP[ext] || 'text',
                  chunkIndex: idx,
                  totalChunks: textChunks.length,
                  content: textChunks[idx],
                  tokens: tokenize(textChunks[idx]),
                  metadata: {
                    ...meta,
                    lineStart: 0,
                    lineEnd: textChunks[idx].split('\n').length
                  }
                });
              }

              // Progress event every 10 files
              if (fileCount % 10 === 0) {
                eventBus.emit('workload:ingestion:progress', {
                  sourceId, sourceName, filesProcessed: fileCount, chunksCreated: allChunks.length
                });
              }
            } catch (e) {
              // Skip unreadable files
              console.warn(`[WorkloadStore] Skipping ${relativePath}: ${e.message}`);
            }
          }
        }
      };

      await walk(codePath);

      await this._saveChunks(sourceId, allChunks);
      source.fileCount = fileCount;
      source.chunkCount = allChunks.length;
      source.extensions = [...extensionSet];
      source.status = 'ready';
      source.lastUpdated = new Date().toISOString();
      await this._saveIndex();
      await this._rebuildIDF();

      eventBus.emit('workload:ingestion:complete', {
        sourceId, sourceName, fileCount, chunkCount: allChunks.length
      });

      return { sourceId, name: sourceName, fileCount, chunkCount: allChunks.length, status: 'ready' };
    } catch (e) {
      source.status = 'failed';
      await this._saveIndex();
      eventBus.emit('workload:ingestion:failed', { sourceId, error: e.message });
      return { error: e.message };
    }
  }

  async ingestFolder(folderPath, options = {}) {
    // Same as ingestCodebase but also processes docs (PDF, DOCX)
    const sourceId = options.sourceId || `src_${Date.now()}`;
    const sourceName = options.sourceName || path.basename(folderPath);

    const source = {
      id: sourceId,
      name: sourceName,
      type: 'folder',
      path: folderPath,
      fileCount: 0,
      chunkCount: 0,
      totalSize: 0,
      ingestedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      extensions: [],
      status: 'ingesting'
    };
    this.sources.push(source);
    await this._saveIndex();

    try {
      const allChunks = [];
      const extensionSet = new Set();
      let fileCount = 0;
      const allExtensions = new Set([...CODE_EXTENSIONS, ...DOC_EXTENSIONS]);

      const walk = async (dir, relativeBase = '') => {
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch { return; }

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.join(relativeBase, entry.name);

          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            await walk(fullPath, relativePath);
          } else if (entry.isFile()) {
            if (SKIP_FILES.has(entry.name)) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!allExtensions.has(ext)) continue;

            try {
              const stat = await fs.stat(fullPath);
              if (stat.size > MAX_FILE_SIZE) continue;
              source.totalSize += stat.size;
            } catch { continue; }

            try {
              let content;
              if (DOC_EXTENSIONS.has(ext) && ext !== '.txt' && ext !== '.md' && ext !== '.csv') {
                content = await this._parseFile(fullPath);
              } else {
                content = await fs.readFile(fullPath, 'utf-8');
              }
              if (!content.trim()) continue;

              extensionSet.add(ext);
              fileCount++;

              const isCode = CODE_EXTENSIONS.has(ext) && !DOC_EXTENSIONS.has(ext);
              const isCSV = ext === '.csv';
              let textChunks;
              if (isCSV) {
                textChunks = this._chunkCSV(content);
              } else if (isCode) {
                textChunks = this._chunkCode(content, fullPath);
              } else {
                textChunks = this._chunkText(content);
              }

              const meta = isCode ? extractCodeMetadata(content, fullPath) : { language: LANGUAGE_MAP[ext] || 'text' };

              for (let idx = 0; idx < textChunks.length; idx++) {
                allChunks.push({
                  id: `chk_${sourceId}_${fileCount}_${idx}`,
                  sourceId,
                  filePath: relativePath,
                  fileType: LANGUAGE_MAP[ext] || 'text',
                  chunkIndex: idx,
                  totalChunks: textChunks.length,
                  content: textChunks[idx],
                  tokens: tokenize(textChunks[idx]),
                  metadata: meta
                });
              }

              if (fileCount % 10 === 0) {
                eventBus.emit('workload:ingestion:progress', {
                  sourceId, sourceName, filesProcessed: fileCount, chunksCreated: allChunks.length
                });
              }
            } catch (e) {
              console.warn(`[WorkloadStore] Skipping ${relativePath}: ${e.message}`);
            }
          }
        }
      };

      await walk(folderPath);

      await this._saveChunks(sourceId, allChunks);
      source.fileCount = fileCount;
      source.chunkCount = allChunks.length;
      source.extensions = [...extensionSet];
      source.status = 'ready';
      source.lastUpdated = new Date().toISOString();
      await this._saveIndex();
      await this._rebuildIDF();

      eventBus.emit('workload:ingestion:complete', {
        sourceId, sourceName, fileCount, chunkCount: allChunks.length
      });

      return { sourceId, name: sourceName, fileCount, chunkCount: allChunks.length, status: 'ready' };
    } catch (e) {
      source.status = 'failed';
      await this._saveIndex();
      eventBus.emit('workload:ingestion:failed', { sourceId, error: e.message });
      return { error: e.message };
    }
  }

  // ── Search ──

  async search(query, limit = 5) {
    const queryTerms = tokenize(query);
    // With embeddings, a query of pure stopwords is still meaningful semantically.
    if (queryTerms.length === 0 && !this.embeddingsEnabled) return [];

    await this._maybeReprobe();

    // Semantic half of the hybrid. Falls back to keyword-only if the embed call fails.
    let queryVec = null;
    if (this.embeddingsEnabled) {
      try {
        queryVec = await embedText(query, 'query');
      } catch {
        queryVec = null;
      }
    }

    const allResults = [];

    for (const source of this.sources) {
      if (source.status !== 'ready') continue;
      const chunks = await this._loadChunks(source.id);

      for (const chunk of chunks) {
        const docTerms = chunk.tokens || tokenize(chunk.content);
        let score = tfidfScore(queryTerms, docTerms, this.idf);

        // Boost for metadata matches (routes, functions, classes)
        if (chunk.metadata) {
          const metaText = [
            ...(chunk.metadata.functions || []),
            ...(chunk.metadata.classes || []),
            ...(chunk.metadata.routes || []),
            ...(chunk.metadata.exports || [])
          ].join(' ').toLowerCase();

          const metaTerms = tokenize(metaText);
          const metaOverlap = queryTerms.filter(t => metaTerms.includes(t)).length;
          if (metaOverlap > 0) score *= 1 + metaOverlap * 0.3;
        }

        // Boost for file path matches
        const pathTerms = tokenize(chunk.filePath);
        const pathOverlap = queryTerms.filter(t => pathTerms.includes(t)).length;
        if (pathOverlap > 0) score *= 1 + pathOverlap * 0.2;

        const vecScore = queryVec ? cosineSimilarity(queryVec, chunk.embedding) : 0;

        if (score > 0.01 || vecScore > 0) {
          allResults.push({
            id: chunk.id,
            sourceId: chunk.sourceId,
            sourceName: source.name,
            filePath: chunk.filePath,
            fileType: chunk.fileType,
            content: chunk.content,
            relevance: Math.round(score * 1000) / 1000,
            keywordScore: score,
            vectorScore: vecScore,
            metadata: chunk.metadata,
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks
          });
        }
      }
    }

    // Hybrid ranking. Keyword scores are unbounded and vary by corpus, so they are
    // normalised against the best hit in this result set before being blended. Semantic
    // similarity carries most of the weight; the keyword term is what keeps exact tokens
    // like "BANT" or "EBITDA" competitive, which pure vector search tends to lose.
    if (queryVec) {
      const maxKw = Math.max(...allResults.map(r => r.keywordScore), 0);
      for (const r of allResults) {
        const kw = maxKw > 0 ? r.keywordScore / maxKw : 0;
        r.relevance = Math.round((VECTOR_WEIGHT * r.vectorScore + (1 - VECTOR_WEIGHT) * kw) * 1000) / 1000;
      }
    }

    allResults.sort((a, b) => b.relevance - a.relevance);
    const results = allResults.slice(0, limit);

    if (results.length > 0) {
      eventBus.emit('workload:searched', { query: query.substring(0, 50), resultCount: results.length });
    }

    return results;
  }

  async searchBySource(sourceId, query, limit = 5) {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const chunks = await this._loadChunks(sourceId);
    const source = this.sources.find(s => s.id === sourceId);

    const results = chunks
      .map(chunk => {
        const docTerms = chunk.tokens || tokenize(chunk.content);
        const score = tfidfScore(queryTerms, docTerms, this.idf);
        return { ...chunk, relevance: Math.round(score * 1000) / 1000, sourceName: source?.name };
      })
      .filter(r => r.relevance > 0.01)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, limit);

    return results;
  }

  async searchByFileType(fileType, query, limit = 5) {
    const queryTerms = tokenize(query);
    if (queryTerms.length === 0) return [];

    const allResults = [];
    for (const source of this.sources) {
      if (source.status !== 'ready') continue;
      const chunks = await this._loadChunks(source.id);

      for (const chunk of chunks) {
        // Match file type category
        const isMatch = fileType === 'code'
          ? ['javascript', 'typescript', 'python', 'ruby', 'go', 'rust', 'java', 'c', 'cpp', 'swift'].includes(chunk.fileType)
          : fileType === 'document'
          ? ['pdf', 'docx', 'doc', 'text', 'markdown'].includes(chunk.fileType)
          : fileType === 'spreadsheet'
          ? chunk.fileType === 'csv'
          : chunk.fileType === fileType;

        if (!isMatch) continue;

        const docTerms = chunk.tokens || tokenize(chunk.content);
        const score = tfidfScore(queryTerms, docTerms, this.idf);
        if (score > 0.01) {
          allResults.push({
            ...chunk,
            relevance: Math.round(score * 1000) / 1000,
            sourceName: source.name
          });
        }
      }
    }

    allResults.sort((a, b) => b.relevance - a.relevance);
    return allResults.slice(0, limit);
  }

  // ── Management ──

  async removeSource(sourceId) {
    this.sources = this.sources.filter(s => s.id !== sourceId);
    try {
      await fs.unlink(path.join(this.chunksDir, `${sourceId}.json`));
    } catch {}
    await this._saveIndex();
    await this._rebuildIDF();
  }

  async reindexSource(sourceId) {
    const source = this.sources.find(s => s.id === sourceId);
    if (!source) return { error: 'Source not found' };

    // Remove old data
    this.sources = this.sources.filter(s => s.id !== sourceId);
    try {
      await fs.unlink(path.join(this.chunksDir, `${sourceId}.json`));
    } catch {}

    // Re-ingest
    if (source.type === 'codebase') {
      return await this.ingestCodebase(source.path, { sourceName: source.name, sourceId });
    } else if (source.type === 'folder') {
      return await this.ingestFolder(source.path, { sourceName: source.name, sourceId });
    } else {
      return await this.ingestFile(source.path, source.name);
    }
  }

  getSources() {
    return this.sources.map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      path: s.path,
      originalFilename: s.originalFilename,
      fileCount: s.fileCount,
      chunkCount: s.chunkCount,
      totalSize: s.totalSize,
      extensions: s.extensions,
      status: s.status,
      ingestedAt: s.ingestedAt,
      lastUpdated: s.lastUpdated
    }));
  }

  getStats() {
    const readySources = this.sources.filter(s => s.status === 'ready');
    const totalChunks = readySources.reduce((sum, s) => sum + (s.chunkCount || 0), 0);
    const totalSize = readySources.reduce((sum, s) => sum + (s.totalSize || 0), 0);
    const allExtensions = {};
    for (const s of readySources) {
      for (const ext of (s.extensions || [])) {
        allExtensions[ext] = (allExtensions[ext] || 0) + 1;
      }
    }

    return {
      totalSources: readySources.length,
      totalChunks,
      totalSize,
      totalSizeFormatted: totalSize > 1_000_000 ? `${(totalSize / 1_000_000).toFixed(1)} MB` : `${(totalSize / 1_000).toFixed(0)} KB`,
      fileTypes: allExtensions,
      idfTermCount: Object.keys(this.idf).length,
      mediaCount: this.media.length
    };
  }

  // ── Media Management ──

  /**
   * Scan the media folder for images/videos/audio.
   * Picks up any new files dropped in, preserves existing tags/descriptions.
   */
  async scanMedia() {
    let entries;
    try {
      entries = await fs.readdir(this.mediaDir, { withFileTypes: true });
    } catch { return; }

    const existingByPath = new Map(this.media.map(m => [m.path, m]));
    const scanned = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!MEDIA_EXTENSIONS.has(ext)) continue;

      const fullPath = path.join(this.mediaDir, entry.name);
      const existing = existingByPath.get(fullPath);

      if (existing) {
        // Keep existing metadata (tags, description)
        scanned.push(existing);
      } else {
        // New file — add with auto-generated tags from filename
        let stat;
        try { stat = await fs.stat(fullPath); } catch { continue; }

        const nameNoExt = path.basename(entry.name, ext);
        const autoTags = nameNoExt
          .replace(/[_\-\.]/g, ' ')
          .split(/\s+/)
          .filter(w => w.length > 1)
          .map(w => w.toLowerCase());

        scanned.push({
          id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          filename: entry.name,
          path: fullPath,
          type: MEDIA_TYPE_MAP[ext] || 'file',
          ext,
          size: stat.size,
          sizeFormatted: stat.size > 1_000_000
            ? `${(stat.size / 1_000_000).toFixed(1)} MB`
            : `${(stat.size / 1_000).toFixed(0)} KB`,
          tags: autoTags,
          description: '',
          addedAt: new Date().toISOString()
        });
      }
    }

    // Keep external files (from scanMediaFolder) that aren't in our mediaDir
    const externalMedia = this.media.filter(m => !m.path.startsWith(this.mediaDir));
    this.media = [...scanned, ...externalMedia];
    await this._saveIndex();
  }

  /**
   * Scan an external folder for media files (doesn't copy them — just indexes).
   */
  async scanMediaFolder(folderPath) {
    let entries;
    try {
      entries = await fs.readdir(folderPath, { withFileTypes: true });
    } catch (e) {
      return { error: `Cannot read folder: ${e.message}` };
    }

    const existingByPath = new Map(this.media.map(m => [m.path, m]));
    const removedSet = new Set(this.removedMediaPaths);
    let added = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!MEDIA_EXTENSIONS.has(ext)) continue;

      const fullPath = path.join(folderPath, entry.name);
      if (existingByPath.has(fullPath)) continue; // Already indexed
      if (removedSet.has(fullPath)) continue; // User removed this

      let stat;
      try { stat = await fs.stat(fullPath); } catch { continue; }

      const nameNoExt = path.basename(entry.name, ext);
      const autoTags = nameNoExt.replace(/[_\-\.]/g, ' ').split(/\s+/).filter(w => w.length > 1).map(w => w.toLowerCase());

      this.media.push({
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        filename: entry.name,
        path: fullPath,
        type: MEDIA_TYPE_MAP[ext] || 'file',
        ext,
        size: stat.size,
        sizeFormatted: stat.size > 1_000_000
          ? `${(stat.size / 1_000_000).toFixed(1)} MB`
          : `${(stat.size / 1_000).toFixed(0)} KB`,
        tags: autoTags,
        description: '',
        addedAt: new Date().toISOString()
      });
      added++;
    }

    await this._saveIndex();
    return { added, total: this.media.length };
  }

  /**
   * Update tags/description for a media file.
   */
  async updateMedia(mediaId, updates) {
    const item = this.media.find(m => m.id === mediaId);
    if (!item) return null;

    if (updates.tags !== undefined) item.tags = updates.tags;
    if (updates.description !== undefined) item.description = updates.description;

    await this._saveIndex();
    return item;
  }

  /**
   * Remove a media file. If uploaded to our media dir, deletes the copy.
   * If scanned from an external folder, just removes from index and remembers
   * the path so rescan won't re-add it.
   */
  async removeMedia(mediaId) {
    const item = this.media.find(m => m.id === mediaId);
    if (!item) return;

    const isOurCopy = item.path.startsWith(this.mediaDir);
    if (isOurCopy) {
      // Safe to delete — it's our copy in data/workload/media/
      try { await fs.unlink(item.path); } catch {}
    } else {
      // External file — don't delete, but remember so rescan skips it
      if (!this.removedMediaPaths.includes(item.path)) {
        this.removedMediaPaths.push(item.path);
      }
    }

    this.media = this.media.filter(m => m.id !== mediaId);
    await this._saveIndex();
  }

  /**
   * Get all indexed media files.
   */
  getMedia(filter) {
    let results = this.media;
    if (filter?.type) {
      results = results.filter(m => m.type === filter.type);
    }
    if (filter?.tag) {
      const tag = filter.tag.toLowerCase();
      results = results.filter(m => m.tags.some(t => t.includes(tag)));
    }
    return results;
  }
}
