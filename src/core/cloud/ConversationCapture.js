/**
 * ConversationCapture — Saves conversations in training-ready format.
 * Every chat interaction gets logged. Good conversations can be
 * used to retrain and improve the Ace model over time.
 *
 * Output: training/captured/YYYY-MM-DD.jsonl (same format as train.jsonl)
 *
 * To retrain: merge captured data with training/train.jsonl and run:
 *   python3 -m mlx_lm lora --model mlx-community/Qwen2.5-7B-Instruct-4bit \
 *     --data training/ --train --iters 200 --adapter-path training/ace-adapter
 */

import fs from 'fs';
import path from 'path';

const CAPTURE_DIR = path.join(process.cwd(), 'training', 'captured');

export class ConversationCapture {
  constructor() {
    if (!fs.existsSync(CAPTURE_DIR)) {
      fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    }
  }

  /**
   * Capture a user→assistant exchange for future training.
   * Only captures if the assistant response looks good (not an error, not too short).
   */
  capture(userMessage, assistantResponse) {
    if (!userMessage || !assistantResponse) return;
    if (assistantResponse.length < 20) return; // Skip very short/error responses
    if (assistantResponse.includes('error') || assistantResponse.includes('rate limit')) return;
    if (assistantResponse.includes('I\'m having trouble')) return; // Skip error messages

    const date = new Date().toISOString().split('T')[0];
    const filePath = path.join(CAPTURE_DIR, `${date}.jsonl`);

    const entry = JSON.stringify({
      messages: [
        { role: 'user', content: userMessage.substring(0, 500) },
        { role: 'assistant', content: assistantResponse.substring(0, 1000) },
      ],
      timestamp: new Date().toISOString(),
    });

    try {
      fs.appendFileSync(filePath, entry + '\n');
    } catch {
      // Silent fail — don't break the app if capture fails
    }
  }

  /**
   * Get stats on captured conversations.
   */
  getStats() {
    try {
      const files = fs.readdirSync(CAPTURE_DIR).filter(f => f.endsWith('.jsonl'));
      let totalExchanges = 0;
      for (const file of files) {
        const content = fs.readFileSync(path.join(CAPTURE_DIR, file), 'utf-8');
        totalExchanges += content.split('\n').filter(l => l.trim()).length;
      }
      return { files: files.length, totalExchanges, captureDir: CAPTURE_DIR };
    } catch {
      return { files: 0, totalExchanges: 0, captureDir: CAPTURE_DIR };
    }
  }
}
