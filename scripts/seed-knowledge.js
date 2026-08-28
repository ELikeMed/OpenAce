#!/usr/bin/env node
/**
 * Seed Ace's public knowledge base into the workload store.
 *
 * The store lives under data/, which is gitignored, so a fresh deployment starts with no
 * knowledge even though the source documents ship in the repo. This rebuilds the index
 * from those documents. Safe to re-run: a document already present is replaced, not
 * duplicated, so it doubles as the re-index step after a chunker or embedding change.
 *
 *   node scripts/seed-knowledge.js
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { WorkloadStore } from '../src/core/knowledge/WorkloadStore.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DOCS_DIR = path.join(ROOT, 'training');

// Only these are public knowledge. Everything else under training/ is model weights,
// captured user transcripts, or private material and must never be indexed — the store is
// shared across all users of a cloud instance.
const PUBLIC_DOCS = [
  ['Ace-Business-Knowledge.md',          'Ace Business Knowledge Base'],
  ['Ace-Business-Strategy-Knowledge.md', 'Ace Business Strategy Knowledge Base'],
  ['Ace-Sales-Psychology-Pricing.md',    'Ace Sales Psychology & Pricing'],
  ['Ace-Philosophy-Knowledge.md',        'Ace Philosophy Knowledge Base'],
  ['Ace-Business-Planning-Knowledge.md', 'Ace Business Planning & Market Entry'],
  ['Ace-Compliance-Admin-Knowledge.md',  'Ace Business Forms, Compliance & Admin'],
  ['Ace-Customers-Demand-Knowledge.md',  'Ace Customers & Demand'],
  ['Ace-Marketing-Offers-Knowledge.md',  'Ace Marketing, Offers & Copywriting'],
  ['Ace-Coding-Knowledge.md',            'Ace Software Engineering'],
  ['Ace-Design-Knowledge.md',            'Ace Design — UI/UX, Visual & Documents'],
  ['Ace-Web-App-Development-Knowledge.md',      'Ace Web & App Development'],
  ['Ace-Shipping-Infrastructure-Knowledge.md',  'Ace Shipping & Infrastructure'],
  ['Ace-Legal-IP-Knowledge.md',          'Ace Legal & Intellectual Property'],
  ['Ace-Ecommerce-Knowledge.md',         'Ace Ecommerce'],
  ['Ace-Operations-People-Knowledge.md', 'Ace Operations, People & Customer Service'],
  ['Ace-AI-Automation-Knowledge.md',     'Ace AI & Automation'],
  ['Ace-Content-Media-Knowledge.md',     'Ace Content & Media'],
];

const store = new WorkloadStore(path.join(ROOT, 'data', 'workload'));
await store.initialize();

if (!store.embeddingsEnabled) {
  console.warn('⚠️  Embedding model unavailable — seeding with keyword search only.');
  console.warn('   Run `ollama pull nomic-embed-text`, then re-run this script for semantic search.');
}

let seeded = 0;
for (const [filename, sourceName] of PUBLIC_DOCS) {
  const filePath = path.join(DOCS_DIR, filename);

  let buffer;
  try {
    buffer = await fs.readFile(filePath);
  } catch {
    console.warn(`  skipped  ${filename} (not found)`);
    continue;
  }

  // A stable id derived from the filename, so re-seeding replaces a document in place.
  // With generated ids, a re-seed orphans whatever a running server already has loaded:
  // its in-memory index still points at the old chunk files, which no longer exist, and
  // every search silently returns nothing.
  const sourceId = 'src_kb_' + filename.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_');

  for (const existing of store.sources.filter(s => s.originalFilename === filename || s.id === sourceId)) {
    await store.removeSource(existing.id);
  }

  const result = await store.ingestUploadedBuffer(buffer, filename, sourceName, { sourceId });
  console.log(`  seeded   ${String(result.chunkCount).padStart(3)} chunks  ${sourceName}`);
  seeded++;
}

await store._rebuildIDF();

const stats = store.getStats();
console.log(`\n${seeded}/${PUBLIC_DOCS.length} documents · ${stats.totalChunks} chunks · ${stats.totalSizeFormatted}`);
console.log(`retrieval: ${store.embeddingsEnabled ? 'hybrid semantic + keyword' : 'keyword only'}`);

// Ids are stable, so a running server's index stays valid — but it still holds the old
// chunk counts and IDF table until it re-reads them.
const port = process.env.PORT || 4000;
try {
  const res = await fetch(`http://localhost:${port}/api/health`, { signal: AbortSignal.timeout(2000) });
  if (res.status !== 0) {
    console.log(`\n\u26A0\uFE0F  A server is running on port ${port}. Restart it so it picks up this index:`);
    console.log('   launchctl kickstart -k gui/$(id -u)/com.openace.server');
  }
} catch { /* nothing listening, nothing to warn about */ }
