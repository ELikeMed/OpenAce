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

  for (const existing of store.sources.filter(s => s.originalFilename === filename)) {
    await store.removeSource(existing.id);
  }

  const result = await store.ingestUploadedBuffer(buffer, filename, sourceName);
  console.log(`  seeded   ${String(result.chunkCount).padStart(3)} chunks  ${sourceName}`);
  seeded++;
}

await store._rebuildIDF();

const stats = store.getStats();
console.log(`\n${seeded}/${PUBLIC_DOCS.length} documents · ${stats.totalChunks} chunks · ${stats.totalSizeFormatted}`);
console.log(`retrieval: ${store.embeddingsEnabled ? 'hybrid semantic + keyword' : 'keyword only'}`);
