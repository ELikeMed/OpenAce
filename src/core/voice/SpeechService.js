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
// American first — Ace is not British. Premium and Enhanced variants are free downloads
// and are preferred when present; the plain US voices below are what ships by default.
// Override with OPENACE_VOICE to use any installed voice by name.
const VOICE_PREFERENCE = [
  // American male, best quality first — Ace is male, so female voices are a last resort
  // rather than a ranked option.
  'Evan (Premium)', 'Nathan (Premium)',
  'Tom (Enhanced)', 'Evan (Enhanced)', 'Nathan (Enhanced)',
  'Reed (English (US))', 'Rocko (English (US))', 'Eddy (English (US))',
  'Tom', 'Evan', 'Nathan', 'Aaron',
  // Non-US male before any female voice
  'Daniel', 'Jamie (Premium)', 'Oliver', 'Arthur',
  // Only if nothing above is installed
  'Ava (Premium)', 'Allison (Enhanced)', 'Samantha', 'Ava', 'Allison',
];

const MAX_CHARS = 2500;

// Piper is a small neural TTS engine (MIT). Its voices are markedly more natural than the
// stock Apple ones, which on this machine are the compact quality — the only Premium voice
// installed is British, and installing more is a System Settings operation with no CLI.
// Vendored into the project so it is contained and removable: delete vendor/ to fall back.
const PIPER_PY = 'vendor/tts-venv/bin/python';
const PIPER_MODEL = 'vendor/voices/en_US-ryan-high.onnx';

export class SpeechService {
  constructor(dataDir, projectRoot = process.cwd()) {
    this.cacheDir = path.resolve(dataDir, 'tts');
    this.projectRoot = projectRoot;
    this.voice = null;
    this.available = false;
    this.engine = null; // 'piper' | 'say'
  }

  async initialize() {
    await fs.mkdir(this.cacheDir, { recursive: true }).catch(() => {});

    // Prefer Piper when it is present and actually runs.
    this.piperPy = path.resolve(this.projectRoot, PIPER_PY);
    this.piperModel = path.resolve(this.projectRoot, PIPER_MODEL);
    try {
      await fs.access(this.piperPy);
      await fs.access(this.piperModel);
      this.engine = 'piper';
      this.available = true;
      this.voice = 'Ryan (Piper)';
      console.log('🔊 Speech ready (Piper neural voice: Ryan, US male)');
      return this;
    } catch { /* not vendored — fall through to the system voices */ }

    try {
      const { stdout } = await run('say', ['-v', '?'], { timeout: 10_000 });
      const installed = stdout.split('\n')
        // Long names like "Reed (English (US))" leave only a single space before the
        // language code, so requiring two dropped exactly the US voices we want.
        .map(l => l.match(/^(.+?)\s+([a-z]{2}_[A-Z]{2})(?:\s|$)/))
        .filter(Boolean)
        .map(m => ({ name: m[1].trim(), lang: m[2] }));

      const english = installed.filter(v => v.lang.startsWith('en'));
      const override = process.env.OPENACE_VOICE;

      // Novelty voices ship alongside the real ones and must never be chosen by accident.
      const NOVELTY = /^(bad news|good news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|wobble|trinoids|whisper|zarvox|albert|junior|grandma|grandpa|bruce|hysterical|deranged|princess|ralph|kathy|fred|agnes|victoria)/i;
      const usable = english.filter(v => !NOVELTY.test(v.name));

      this.voice = (override && english.some(v => v.name === override) ? override : null)
        || VOICE_PREFERENCE.find(p => usable.some(v => v.name === p))
        || usable.find(v => /premium|enhanced/i.test(v.name) && v.lang === 'en_US')?.name
        || usable.find(v => v.lang === 'en_US')?.name
        || usable.find(v => /premium|enhanced/i.test(v.name))?.name
        || usable[0]?.name
        || null;

      this.available = !!this.voice;
      if (this.available) this.engine = 'say';
      console.log(this.available
        ? `🔊 Speech ready (system voice: ${this.voice})`
        : 'ℹ️  Speech unavailable — the browser will fall back to its own voice');
    } catch {
      this.available = false;
      console.log('ℹ️  Speech unavailable (no `say` on this platform) — browser fallback');
    }
    return this;
  }

  listVoices() {
    return { current: this.voice, available: this.available, engine: this.engine };
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
    void useVoice;
    // Slightly under the default 175 wpm — the default reads faster than people speak.
    const useRate = Number.isFinite(Number(rate)) ? Math.min(300, Math.max(100, Number(rate))) : 165;

    const key = crypto.createHash('sha1').update(`${useVoice}|${useRate}|${clean}`).digest('hex');
    const m4aPath = path.join(this.cacheDir, `${key}.m4a`);

    try {
      await fs.access(m4aPath);
      return m4aPath;
    } catch { /* not cached yet */ }

    if (this.engine === 'piper') {
      const wavPath = path.join(this.cacheDir, `${key}.wav`);
      try {
        // Text on stdin, never the command line — a reply can contain anything.
        await new Promise((resolve, reject) => {
          const child = execFile(
            this.piperPy,
            ['-m', 'piper', '-m', this.piperModel, '-f', wavPath],
            { timeout: 90_000, cwd: this.projectRoot },
            (err) => (err ? reject(err) : resolve())
          );
          child.stdin.end(clean);
        });
        await run('afconvert', [wavPath, m4aPath, '-f', 'm4af', '-d', 'aac'], { timeout: 60_000 });
        return m4aPath;
      } finally {
        await fs.unlink(wavPath).catch(() => {});
      }
    }

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
