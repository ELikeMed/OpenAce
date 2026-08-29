/**
 * SpeechService — server-side text to speech using the voices installed on macOS.
 *
 * The browser's own speechSynthesis was being used, which on iOS falls back to Apple's
 * "compact" voices — the robotic ones. Generating here instead means every device gets the
 * same good voice, including phones, and it stays local: no external speech API, nothing
 * leaves the machine.
 *
 * Falls back to reporting unavailability rather than failing, so the client can drop back to
 * browser speech on a platform without `say`.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

// Chosen over the novelty voices that ship alongside them. Ordered by quality; the first one
// actually installed wins. Premium and Enhanced variants are downloads, so most machines will
// fall through to the plain names.
const VOICE_PREFERENCE = [
  'Jamie (Premium)', 'Ava (Premium)', 'Zoe (Premium)', 'Evan (Premium)', 'Nathan (Premium)',
  'Ava (Enhanced)', 'Allison (Enhanced)', 'Samantha (Enhanced)', 'Tom (Enhanced)',
  'Jamie', 'Ava', 'Allison', 'Samantha', 'Tom', 'Evan', 'Daniel', 'Karen',
];

const MAX_CHARS = 2500;

export class SpeechService {
  constructor(dataDir) {
    this.cacheDir = path.resolve(dataDir, 'tts');
    this.voice = null;
    this.available = false;
  }

  async initialize() {
    try {
      const { stdout } = await run('say', ['-v', '?'], { timeout: 10_000 });
      const installed = stdout.split('\n')
        .map(l => l.match(/^(.+?)\s{2,}([a-z]{2}_[A-Z]{2})/))
        .filter(Boolean)
        .map(m => ({ name: m[1].trim(), lang: m[2] }));

      const english = installed.filter(v => v.lang.startsWith('en'));
      this.voice = VOICE_PREFERENCE.find(p => english.some(v => v.name === p))
        || english.find(v => /premium|enhanced/i.test(v.name))?.name
        || english[0]?.name
        || null;

      this.available = !!this.voice;
      await fs.mkdir(this.cacheDir, { recursive: true });
      console.log(this.available
        ? `🔊 Speech ready (voice: ${this.voice})`
        : 'ℹ️  Speech unavailable — the browser will fall back to its own voice');
    } catch {
      this.available = false;
      console.log('ℹ️  Speech unavailable (no `say` on this platform) — browser fallback');
    }
    return this;
  }

  listVoices() {
    return { current: this.voice, available: this.available };
  }

  /**
   * Render text to an audio file, returning its path. Identical text is generated once and
   * reused — a reply is often replayed, and synthesis is CPU work on a machine that is also
   * running the model.
   */
  async synthesize(text, { voice, rate } = {}) {
    if (!this.available) throw new Error('Speech synthesis is not available on this server');

    const clean = String(text || '').trim().slice(0, MAX_CHARS);
    if (!clean) throw new Error('Nothing to say');

    const useVoice = voice && /^[\w()\s.-]+$/.test(voice) ? voice : this.voice;
    // Slightly under the default 175 wpm — the default reads faster than people speak.
    const useRate = Number.isFinite(Number(rate)) ? Math.min(300, Math.max(100, Number(rate))) : 165;

    const key = crypto.createHash('sha1').update(`${useVoice}|${useRate}|${clean}`).digest('hex');
    const m4aPath = path.join(this.cacheDir, `${key}.m4a`);

    try {
      await fs.access(m4aPath);
      return m4aPath;
    } catch { /* not cached yet */ }

    const aiffPath = path.join(this.cacheDir, `${key}.aiff`);
    // Text goes via a file, never the command line — a reply can contain quotes, newlines
    // and anything else the model wrote.
    const txtPath = path.join(this.cacheDir, `${key}.txt`);
    await fs.writeFile(txtPath, clean, 'utf-8');

    try {
      await run('say', ['-v', useVoice, '-r', String(useRate), '-f', txtPath, '-o', aiffPath], { timeout: 60_000 });
      // afconvert ships with macOS, so this adds no dependency.
      await run('afconvert', [aiffPath, m4aPath, '-f', 'm4af', '-d', 'aac'], { timeout: 60_000 });
      return m4aPath;
    } finally {
      await fs.unlink(txtPath).catch(() => {});
      await fs.unlink(aiffPath).catch(() => {});
    }
  }
}
