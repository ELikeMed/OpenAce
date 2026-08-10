/**
 * Auto-Trainer — Uses Gemini to automatically generate:
 * 1. Training examples (how Ace talks)
 * 2. Knowledge documents (what Ace knows)
 *
 * Run: GEMINI_API_KEY=your-key node training/auto-train.js
 *
 * Generates comprehensive business knowledge across all topics.
 * The big model teaches the small model — distillation.
 */

import fs from 'fs';
import path from 'path';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_KEY) {
  console.error('Set GEMINI_API_KEY env var. Get one free at https://aistudio.google.com/apikey');
  process.exit(1);
}

const TRAINING_FILE = new URL('./train.jsonl', import.meta.url).pathname;
const KNOWLEDGE_DIR = path.join(process.cwd(), 'data', 'workload', 'sources');

// Every business topic Ace should know about
const TOPICS = [
  // Sales
  'cold calling techniques and scripts',
  'cold email outreach best practices with templates',
  'sales funnel optimization and conversion rates',
  'lead qualification frameworks BANT MEDDIC SPIN',
  'objection handling in sales with examples',
  'follow-up strategies and cadence for sales',
  'proposal writing and pricing strategies',
  'closing techniques for B2B and B2C sales',
  'referral program design and implementation',
  'CRM best practices and pipeline management',

  // Marketing
  'SEO fundamentals for small businesses',
  'Google Business Profile optimization for local businesses',
  'social media marketing strategy by platform LinkedIn Instagram TikTok Facebook',
  'email marketing automation and drip campaigns',
  'content marketing strategy and blog writing for businesses',
  'paid advertising Google Ads Facebook Ads basics and ROI',
  'brand positioning and differentiation strategies',
  'customer retention and loyalty programs',
  'influencer marketing for small businesses',
  'video marketing and YouTube strategy for businesses',

  // Industry Knowledge
  'real estate business operations marketing and lead generation',
  'restaurant business management profit margins and marketing',
  'construction business operations bidding and lead generation',
  'healthcare practice management dental medical medspa',
  'legal practice management and client acquisition for law firms',
  'home services business plumbing HVAC electrical landscaping',
  'insurance agency operations and client prospecting',
  'financial advisory practice management and client acquisition',
  'fitness industry gym management and member retention',
  'salon and beauty business operations and marketing',
  'e-commerce business operations and customer acquisition',
  'SaaS business metrics MRR churn CAC LTV and growth strategies',
  'consulting business development and client acquisition',
  'automotive dealership and repair shop marketing',
  'property management business operations and tenant acquisition',

  // Operations
  'hiring first employees when who and how for small businesses',
  'cash flow management invoicing and accounts receivable',
  'business plan writing lean canvas and pitch deck creation',
  'pricing strategies value-based pricing and raising prices',
  'scaling a business systems people and processes',
  'delegation and time management for business owners',
  'business metrics KPIs dashboards for small businesses',
  'customer service best practices and complaint handling',
  'vendor negotiation and supply chain for small businesses',
  'business insurance types and coverage for small businesses',

  // Finance
  'small business tax planning and deductions',
  'business entity structures LLC S-Corp C-Corp sole proprietor',
  'profit margin benchmarks by industry',
  'business loan and funding options for small businesses',
  'bookkeeping basics for small business owners',
  'financial forecasting and budgeting for small businesses',

  // Growth
  'franchise model and licensing your business',
  'partnership and joint venture strategies',
  'acquisition strategy buying a small business',
  'exit strategy selling your business valuation methods',
  'passive income streams for business owners',
  'online course creation and digital product sales',
];

async function geminiGenerate(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.7 },
      }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateTrainingExamples(topic, count = 5) {
  const prompt = `Generate ${count} training conversations about: ${topic}

Each conversation is a business owner talking to an AI assistant called Ace.
Ace is sharp, direct, and sounds like a billionaire mentor texting a friend.

Rules for Ace:
- 2-3 sentences max
- ONE follow-up question
- Real numbers and tactics, not generic advice
- Never say "Great!", "Certainly!", "I'd be happy to"
- Never mention ChatGPT, Gemini, Claude — Ace is "Ace, running on Ace Clubs"

Return ONLY a JSON array:
[{"user": "...", "assistant": "..."}, ...]`;

  const raw = await geminiGenerate(prompt);
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    return JSON.parse(match[0]);
  } catch {
    return [];
  }
}

async function generateKnowledgeDoc(topic) {
  const prompt = `Write a comprehensive knowledge document about: ${topic}

This will be used as a reference document for a business AI assistant.
Include:
- Key concepts and definitions
- Specific numbers, benchmarks, and statistics
- Step-by-step processes
- Common mistakes to avoid
- Industry-specific tips
- Real-world examples

Write 800-1200 words. Be specific and practical — no fluff.
Use plain language a business owner would understand.`;

  return await geminiGenerate(prompt);
}

async function main() {
  console.log(`\n🎓 Ace Auto-Trainer — ${TOPICS.length} topics to process\n`);

  // Ensure directories exist
  fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });

  let totalExamples = 0;
  let totalDocs = 0;

  for (let i = 0; i < TOPICS.length; i++) {
    const topic = TOPICS[i];
    console.log(`[${i + 1}/${TOPICS.length}] ${topic}`);

    // Generate training examples
    try {
      const examples = await generateTrainingExamples(topic, 5);
      for (const ex of examples) {
        if (!ex.user || !ex.assistant) continue;
        const entry = JSON.stringify({
          messages: [
            { role: 'user', content: ex.user },
            { role: 'assistant', content: ex.assistant },
          ],
        });
        fs.appendFileSync(TRAINING_FILE, entry + '\n');
        totalExamples++;
      }
      console.log(`  ✓ ${examples.length} training examples`);
    } catch (e) {
      console.log(`  ⚠ Training examples failed: ${e.message}`);
    }

    // Generate knowledge document
    try {
      const doc = await generateKnowledgeDoc(topic);
      if (doc && doc.length > 200) {
        const filename = topic.replace(/[^a-zA-Z0-9]+/g, '-').substring(0, 60) + '.txt';
        fs.writeFileSync(path.join(KNOWLEDGE_DIR, filename), doc);
        totalDocs++;
        console.log(`  ✓ Knowledge doc saved (${doc.length} chars)`);
      }
    } catch (e) {
      console.log(`  ⚠ Knowledge doc failed: ${e.message}`);
    }

    // Rate limit — Gemini free tier is 15 req/min
    if (i < TOPICS.length - 1) {
      await new Promise(r => setTimeout(r, 8000));
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Training examples added: ${totalExamples}`);
  console.log(`   Knowledge documents created: ${totalDocs}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Review training/train.jsonl`);
  console.log(`   2. Go to /admin/training and click "Start Training"`);
  console.log(`   3. Wait 5-10 minutes for model to learn`);
  console.log(`   4. Knowledge docs are already live — no retraining needed\n`);
}

main().catch(console.error);
