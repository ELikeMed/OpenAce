/**
 * Training Data Generator — Uses your AI provider to generate
 * more training examples for Ace automatically.
 *
 * Usage:
 *   node training/generate-data.js --topic "healthcare" --count 20
 *   node training/generate-data.js --topic "sales objections" --count 30
 *   node training/generate-data.js --topic "restaurant marketing" --count 15
 *
 * Requires: GEMINI_API_KEY or OPENAI_API_KEY env var
 */

import fs from 'fs';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OUTPUT_FILE = new URL('./generated.jsonl', import.meta.url).pathname;

const args = process.argv.slice(2);
const topicIdx = args.indexOf('--topic');
const countIdx = args.indexOf('--count');
const topic = topicIdx >= 0 ? args[topicIdx + 1] : 'general business';
const count = countIdx >= 0 ? parseInt(args[countIdx + 1]) : 10;

const PROMPT = `Generate ${count} training conversations for a business AI assistant called "Ace" (powered by "Ace Clubs").

Topic: ${topic}

Rules for Ace's responses:
- 2-3 sentences max, asks ONE follow-up question
- Sounds like a sharp colleague texting about work
- Never says "Great!", "Certainly!", "I'd be happy to" — jumps straight in
- Contains REAL business knowledge with specific numbers/tactics
- Never mentions ChatGPT, Gemini, Claude, OpenAI — Ace is "Ace, running on Ace Clubs"

Return ONLY a JSON array of objects, each with this structure:
[
  {"user": "What the user says", "assistant": "What Ace responds"},
  ...
]

No markdown, no explanation — just the JSON array.`;

async function generateWithGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function generateWithOpenAI(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function main() {
  console.log(`Generating ${count} examples about "${topic}"...`);

  let raw;
  if (GEMINI_KEY) {
    console.log('Using Gemini API...');
    raw = await generateWithGemini(PROMPT);
  } else if (OPENAI_KEY) {
    console.log('Using OpenAI API...');
    raw = await generateWithOpenAI(PROMPT);
  } else {
    console.error('Set GEMINI_API_KEY or OPENAI_API_KEY env var');
    process.exit(1);
  }

  // Extract JSON from response
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('Could not parse response:', raw.substring(0, 200));
    process.exit(1);
  }

  const conversations = JSON.parse(jsonMatch[0]);
  let added = 0;

  for (const conv of conversations) {
    if (!conv.user || !conv.assistant) continue;
    const entry = JSON.stringify({
      messages: [
        { role: 'user', content: conv.user },
        { role: 'assistant', content: conv.assistant },
      ],
    });
    fs.appendFileSync(OUTPUT_FILE, entry + '\n');
    added++;
  }

  console.log(`Added ${added} examples to ${OUTPUT_FILE}`);
  console.log(`\nTo merge into training data:`);
  console.log(`  cat training/generated.jsonl >> training/train.jsonl`);
  console.log(`\nTo retrain:`);
  console.log(`  python3 -m mlx_lm lora --model mlx-community/Qwen2.5-7B-Instruct-4bit \\`);
  console.log(`    --data training/ --train --iters 200 --batch-size 1 \\`);
  console.log(`    --learning-rate 1e-5 --adapter-path training/ace-adapter`);
}

main().catch(console.error);
