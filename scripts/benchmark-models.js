#!/usr/bin/env node
/**
 * Benchmark local models on Ace's ACTUAL job — sovereign model selection.
 *
 *   node scripts/benchmark-models.js                      # all candidates
 *   node scripts/benchmark-models.js qwen3:8b ace-clubs   # just these
 *
 * Tests what matters for a business copilot, not trivia:
 *   voice        — short, punchy, no chatbot filler, no menu-vomit
 *   advice       — depth and specificity of business thinking
 *   tool-call    — calls the right tool with the right args
 *   restraint    — does NOT call tools for ordinary conversation
 *   honesty      — refuses to fabricate leads/contacts without data
 *   context      — actually uses injected pipeline/profile numbers
 *   faithful     — presents tool results without inventing extras
 *   json         — structured output adherence (schema-forced)
 *   speed        — tokens/sec on this machine
 *
 * Writes a full transcript to benchmark-results-<ts>.md for human judgment;
 * numeric checks are scored automatically where possible.
 *
 * NOTE: runs against the live Ollama — each suite evicts the previous model
 * (16GB box). Live chat during a run will be slow while models swap.
 */

import fs from 'fs';
import { execFileSync } from 'child_process';

const OLLAMA = 'http://localhost:11434';
const DEFAULT_MODELS = ['ace-clubs:latest', 'qwen3:8b', 'qwen3:14b'];
const models = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_MODELS;

const SOUL = `You are Ace, a business growth copilot. You talk like a sharp operator who has built companies — short, direct, useful. No filler, no "Great question!", no numbered menus of your own features unless asked. One thought at a time. You NEVER invent business names, contact info, or leads — data comes from tools or you say you'll search.`;

const CONTEXT_BLOCK = `
WHAT YOU KNOW ABOUT THIS USER:
- Name: Maria. Business: "Bright Pool Care", pool cleaning, Tampa FL.
- Pipeline: 39 leads total — 12 in "new" (never contacted), 4 in "contacted", 2 in "proposal". 3 leads have had no activity in 14+ days: Coral Bay Apartments, Westshore HOA, SunSplash Resorts.
- Goal she stated last week: get to $15k/month recurring by year end (currently ~$8k).`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_business_leads',
      description: 'Search for real businesses matching an industry and location. Returns names, addresses, phones, websites from a live data source.',
      parameters: {
        type: 'object',
        properties: {
          industry: { type: 'string', description: 'Type of business to find' },
          location: { type: 'string', description: 'City and state' },
          count: { type: 'number', description: 'How many to return, default 10' },
        },
        required: ['industry', 'location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_pipeline',
      description: "Get the user's current sales pipeline: leads and their stages.",
      parameters: { type: 'object', properties: {} },
    },
  },
];

// ── test cases ──────────────────────────────────────────────────────────────

const CASES = [
  {
    id: 'voice-greeting',
    system: SOUL,
    messages: [{ role: 'user', content: 'Hi' }],
    check: (r) => ({
      short: r.text.length < 220,
      noMenu: !/\b1\.\s|\bhere's what i can do\b/i.test(r.text),
      noFiller: !/great question|happy to help|certainly!/i.test(r.text),
    }),
  },
  {
    id: 'advice-depth',
    system: SOUL,
    messages: [{ role: 'user', content: "I run a pool cleaning company in Tampa. Revenue's been stuck at $8k/month for six months. What would you actually do in my position?" }],
    check: (r) => ({
      specific: /(recurring|route|contract|hoa|apartment|property manag|commercial|price|upsell|referral)/i.test(r.text),
      notGeneric: !/social media presence|engage with your audience|create valuable content/i.test(r.text),
    }),
  },
  {
    id: 'tool-call',
    system: SOUL,
    tools: TOOLS,
    messages: [{ role: 'user', content: 'find me plumbing companies in Denver' }],
    check: (r) => {
      const call = r.toolCalls?.[0];
      let args = {};
      try { args = typeof call?.function?.arguments === 'string' ? JSON.parse(call.function.arguments) : (call?.function?.arguments || {}); } catch { /* unparseable */ }
      return {
        calledTool: call?.function?.name === 'search_business_leads',
        rightArgs: /plumb/i.test(args.industry || '') && /denver/i.test(args.location || ''),
      };
    },
  },
  {
    id: 'tool-restraint',
    system: SOUL,
    tools: TOOLS,
    messages: [{ role: 'user', content: "what's a good subject line for a cold email to property managers?" }],
    check: (r) => ({
      noToolCall: !r.toolCalls?.length,
      gaveAnswer: r.text.length > 20,
    }),
  },
  {
    id: 'honesty-no-fabrication',
    system: SOUL,
    messages: [{ role: 'user', content: 'give me 5 HVAC company leads in Phoenix with their emails and phone numbers right now' }],
    check: (r) => ({
      // Any phone-number-looking or email-looking output = fabrication
      noFakeContacts: !/\(\d{3}\)\s?\d{3}[- ]?\d{4}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(r.text),
      offersSearch: /(search|pull|look up|find real|let me get)/i.test(r.text),
    }),
  },
  {
    id: 'context-use',
    system: SOUL + CONTEXT_BLOCK,
    messages: [{ role: 'user', content: 'what should I focus on today?' }],
    check: (r) => ({
      usedNumbers: /\b12\b|\bnever contacted\b|uncontacted/i.test(r.text),
      namedStale: /(coral bay|westshore|sunsplash)/i.test(r.text),
      tiedToGoal: /15k|recurring|8k/i.test(r.text),
    }),
  },
  {
    id: 'faithful-results',
    system: SOUL,
    tools: TOOLS,
    messages: [
      { role: 'user', content: 'find pool supply stores in Tampa' },
      // Ollama's native API wants arguments as an object here, not a JSON string
      { role: 'assistant', content: '', tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search_business_leads', arguments: { industry: 'pool supply stores', location: 'Tampa, FL' } } }] },
      { role: 'tool', tool_call_id: 'call_1', content: JSON.stringify({ results: [
        { name: 'Tampa Pool Supply Co', phone: '(813) 555-0142', website: 'tampapoolsupply.com' },
        { name: 'Bay Area Pools & Spas', phone: '(813) 555-0987', website: 'bayareapools.com' },
        { name: 'Crystal Clear Pool Products', phone: '(813) 555-3311', website: null },
      ]})},
    ],
    check: (r) => {
      const names = ['Tampa Pool Supply Co', 'Bay Area Pools & Spas', 'Crystal Clear Pool Products'];
      const mentioned = names.filter(n => r.text.includes(n)).length;
      // Count business-name-like patterns it mentions that we didn't provide
      const invented = /(Sunshine Pools|Aqua|Blue Wave|Splash Zone)/i.test(r.text);
      return { allThreePresented: mentioned === 3, nothingInvented: !invented };
    },
  },
  {
    id: 'json-extraction',
    system: 'Extract structured data. Respond ONLY with JSON matching the schema.',
    messages: [{ role: 'user', content: "Just got off a call — guy named Dave Kowalski runs a 12-truck landscaping outfit called GreenScape Pros out of Sarasota, wants a quote for his office pool. Cell is 941-555-2277." }],
    format: {
      type: 'object',
      properties: {
        contact_name: { type: 'string' },
        company: { type: 'string' },
        industry: { type: 'string' },
        location: { type: 'string' },
        phone: { type: 'string' },
      },
      required: ['contact_name', 'company'],
    },
    check: (r) => {
      try {
        const j = JSON.parse(r.text);
        return {
          validJson: true,
          rightData: j.contact_name?.includes('Kowalski') && /greenscape/i.test(j.company || '') && /sarasota/i.test(j.location || ''),
        };
      } catch { return { validJson: false, rightData: false }; }
    },
  },
];

// ── runner ──────────────────────────────────────────────────────────────────

async function chat(model, testCase) {
  const body = {
    model,
    messages: [{ role: 'system', content: testCase.system }, ...testCase.messages],
    stream: false,
    keep_alive: '3m',
    options: { temperature: 0.4, num_ctx: 8192 },
  };
  if (testCase.tools) body.tools = testCase.tools;
  if (testCase.format) body.format = testCase.format;
  // qwen3 supports toggling reasoning; harmless elsewhere (ignored if unsupported)
  if (/qwen3/.test(model)) body.think = false;

  const t0 = Date.now();
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const wallMs = Date.now() - t0;

  let text = data.message?.content || '';
  // Strip any leaked reasoning blocks
  text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  return {
    text,
    toolCalls: data.message?.tool_calls || null,
    wallMs,
    tokensPerSec: data.eval_count && data.eval_duration
      ? (data.eval_count / (data.eval_duration / 1e9))
      : null,
  };
}

const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const reportPath = `benchmark-results-${ts}.md`;
let report = `# Model benchmark — ${new Date().toISOString()}\n\nModels: ${models.join(', ')}\n`;
const scores = {};

for (const model of models) {
  console.log(`\n━━━ ${model} ━━━`);
  report += `\n\n## ${model}\n`;
  scores[model] = { passed: 0, total: 0, tps: [] };

  for (const c of CASES) {
    process.stdout.write(`  ${c.id.padEnd(24)}`);
    try {
      const r = await chat(model, c);
      const checks = c.check(r);
      const pass = Object.values(checks).filter(Boolean).length;
      const total = Object.values(checks).length;
      scores[model].passed += pass;
      scores[model].total += total;
      if (r.tokensPerSec) scores[model].tps.push(r.tokensPerSec);

      const flag = pass === total ? '✓' : pass === 0 ? '✗' : '~';
      console.log(`${flag} ${pass}/${total}  ${Object.entries(checks).map(([k, v]) => `${v ? '' : '!'}${k}`).join(' ')}  (${(r.wallMs / 1000).toFixed(1)}s)`);

      report += `\n### ${c.id} — ${pass}/${total} ${JSON.stringify(checks)}\n`;
      report += `_${(r.wallMs / 1000).toFixed(1)}s${r.tokensPerSec ? `, ${r.tokensPerSec.toFixed(0)} tok/s` : ''}_\n\n`;
      if (r.toolCalls) report += '```json\n' + JSON.stringify(r.toolCalls, null, 2) + '\n```\n';
      if (r.text) report += '> ' + r.text.replace(/\n/g, '\n> ') + '\n';
    } catch (e) {
      console.log(`ERROR ${e.message.slice(0, 80)}`);
      report += `\n### ${c.id} — ERROR: ${e.message.slice(0, 200)}\n`;
      scores[model].total += 1;
    }
  }

  // Evict before the next model — 16GB box
  try { execFileSync('ollama', ['stop', model], { stdio: 'ignore' }); } catch { /* fine */ }
}

// ── summary ─────────────────────────────────────────────────────────────────

console.log('\n\n━━━ SUMMARY ━━━');
report += '\n\n## Summary\n\n| model | score | avg tok/s |\n|---|---|---|\n';
for (const [m, s] of Object.entries(scores)) {
  const tps = s.tps.length ? (s.tps.reduce((a, b) => a + b) / s.tps.length).toFixed(0) : '?';
  const line = `${m.padEnd(18)} ${s.passed}/${s.total}   ${tps} tok/s`;
  console.log('  ' + line);
  report += `| ${m} | ${s.passed}/${s.total} | ${tps} |\n`;
}

fs.writeFileSync(reportPath, report);
console.log(`\nFull transcripts: ${reportPath}\n`);
