/**
 * SelfHealer — Ace's self-diagnostic and recovery system
 *
 * When something breaks, Ace doesn't just say "error" and stop.
 * It reads its own source code, diagnoses the problem, and either
 * auto-fixes it or proposes a fix to the user.
 *
 * Process (from soul.json):
 *   Detect → Diagnose → Propose → Act → Verify → Learn
 *
 * Risk classification:
 *   auto_fix:   null checks, JSON parse errors, port conflicts, missing imports
 *   ask_first:  business logic, API endpoints, AI prompts, dependency updates
 *   never_auto: deleting files, changing credentials, security permissions
 */

import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eventBus } from '../events/EventBus.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Load soul.json for risk classification awareness
let _soulHealing = null;
try {
  const soulPath = path.join(PROJECT_ROOT, 'data', 'personas', 'soul.json');
  const soul = JSON.parse(readFileSync(soulPath, 'utf-8'));
  _soulHealing = soul.self_healing;
} catch (e) {
  // Silent — fallback to hardcoded classification
}

export class SelfHealer {
  constructor(options = {}) {
    this.aiManager = options.aiManager || null;
    this.baseDir = options.baseDir || PROJECT_ROOT;
    this.soulHealing = _soulHealing; // Soul.json self-healing config

    // Error history for pattern detection
    this.errorHistory = [];
    this.maxHistory = 200;

    // Fix history for learning
    this.fixHistory = [];
    this.maxFixHistory = 100;

    // Persistent fix log path
    this.fixLogPath = path.join(this.baseDir, 'data', 'diagnostics', 'fix-log.json');

    // Load existing fix log
    this._loadFixLog();

    // Health monitoring state
    this._monitorInterval = null;
    this._monitoredSubsystems = {};
  }

  /**
   * Start periodic health monitoring.
   * Runs healthCheck() on all subsystems at the given interval.
   * Emits SSE events for unhealthy subsystems.
   */
  startMonitoring(subsystems = {}, intervalMs = 300000) {
    this._monitoredSubsystems = subsystems;
    this._monitorInterval = setInterval(async () => {
      try {
        const results = await this.healthCheck(this._monitoredSubsystems);
        const unhealthy = Object.entries(results).filter(([, v]) => !v.healthy);

        if (unhealthy.length > 0) {
          eventBus.emit('system:health:degraded', {
            unhealthy: unhealthy.map(([name, details]) => ({ name, ...details })),
            timestamp: Date.now(),
          });

          for (const [name, details] of unhealthy) {
            try {
              await this.diagnose(
                new Error(`Health check failed: ${name} — ${details.error || 'unhealthy'}`),
                { component: name, department: 'system', action: 'health_check' }
              );
            } catch { /* best-effort recovery */ }
          }
        }

        eventBus.emit('system:health:checked', {
          results,
          unhealthyCount: unhealthy.length,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error('[SelfHealer] Health monitoring error:', e.message);
      }
    }, intervalMs);

    console.log(`🔧 SelfHealer health monitoring started (${intervalMs / 1000}s interval)`);
  }

  /**
   * Stop periodic monitoring
   */
  stopMonitoring() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }

  /**
   * Main entry: diagnose an error and return a user-friendly response + recovery plan.
   *
   * @param {Error} error — the caught error
   * @param {object} context — { component, department, action, message }
   * @returns {object} { userMessage, diagnosis, recovery, autoFixable, fixApplied }
   */
  async diagnose(error, context = {}) {
    const entry = {
      timestamp: Date.now(),
      error: error.message,
      stack: error.stack,
      component: context.component || 'unknown',
      department: context.department || 'unknown',
      action: context.action || 'unknown',
    };
    this.errorHistory.push(entry);
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistory);
    }

    // Step 1: Classify the error
    const classification = this._classifyError(error);

    // Step 2: Extract source location from stack trace
    const sourceLocation = this._parseStackTrace(error.stack);

    // Step 3: Read the relevant source code (if we can find it)
    let sourceSnippet = null;
    if (sourceLocation?.filePath) {
      sourceSnippet = await this._readSourceContext(sourceLocation.filePath, sourceLocation.line);
    }

    // Step 3.5: Check fixHistory for a known successful fix pattern
    const matchingFix = this._findMatchingFix(error, context);
    if (matchingFix?.previousFix?.action) {
      try {
        const patternFixApplied = await this._executeAutoFix(matchingFix.previousFix.action, {
          type: matchingFix.classification.type,
          risk: matchingFix.classification.risk,
          sourceLocation,
          sourceSnippet,
        });
        if (patternFixApplied) {
          this._recordFix(entry, matchingFix.previousFix.action, true);
          eventBus.emit('system:error:diagnosed', {
            type: matchingFix.classification.type,
            risk: matchingFix.classification.risk,
            summary: `Applied known fix from pattern learning (${matchingFix.matchType} match)`,
            context,
            fixApplied: true,
            patternLearned: true,
            timestamp: Date.now(),
          });
          return {
            userMessage: `Hit a familiar issue in ${context.department || 'the system'} — I've seen this before and already applied the fix.`,
            diagnosis: { type: matchingFix.classification.type, risk: matchingFix.classification.risk, summary: 'Pattern-matched fix applied', sourceLocation, sourceSnippet },
            recovery: { strategy: 'Applied learned fix', autoAction: matchingFix.previousFix.action },
            autoFixable: true,
            fixApplied: true,
          };
        }
      } catch {
        // Pattern fix failed — continue with normal diagnosis flow
      }
    }

    // Step 4: Build diagnosis
    const diagnosis = {
      type: classification.type,
      risk: classification.risk,
      summary: classification.summary,
      sourceLocation,
      sourceSnippet,
      frequency: this._getErrorFrequency(error.message),
    };

    // Step 4.5: If pattern matcher returned 'unknown' and we have AI, do deep diagnosis
    if (classification.type === 'unknown' && this.aiManager && sourceSnippet) {
      try {
        const aiDiagnosis = await this._aiDiagnose(error, diagnosis, context);
        if (aiDiagnosis) {
          diagnosis.aiAnalysis = aiDiagnosis.analysis;
          diagnosis.summary = aiDiagnosis.summary || diagnosis.summary;
          diagnosis.suggestedFix = aiDiagnosis.suggestedFix;
        }
      } catch (aiErr) {
        // AI diagnosis is best-effort — don't let it break the flow
      }
    }

    // Step 5: Build user-friendly message (soul.json error philosophy — never raw errors)
    const userMessage = diagnosis.aiAnalysis
      ? this._buildAIUserMessage(diagnosis, context)
      : this._buildUserMessage(diagnosis, context);

    // Step 6: Determine recovery strategy
    const recovery = this._buildRecoveryPlan(diagnosis, context);

    // Step 7: If auto-fixable and we have a known fix, attempt it
    let fixApplied = false;
    if (classification.risk === 'auto_fix' && recovery.autoAction) {
      try {
        fixApplied = await this._executeAutoFix(recovery.autoAction, diagnosis);
        if (fixApplied) {
          this._recordFix(entry, recovery.autoAction, true);
        }
      } catch (fixError) {
        this._recordFix(entry, recovery.autoAction, false);
      }
    }

    // Emit event for monitoring
    eventBus.emit('system:error:diagnosed', {
      ...diagnosis,
      context,
      fixApplied,
      timestamp: Date.now(),
    });

    return {
      userMessage,
      diagnosis,
      recovery,
      autoFixable: classification.risk === 'auto_fix',
      fixApplied,
    };
  }

  /**
   * Health check: run diagnostics on all subsystems
   */
  async healthCheck(subsystems = {}) {
    const results = {};

    // Check AI provider
    if (this.aiManager) {
      try {
        const status = this.aiManager.getStatus?.() || {};
        results.aiProvider = {
          healthy: !!status.connected || !!status.provider,
          details: status,
        };
      } catch (e) {
        results.aiProvider = { healthy: false, error: e.message };
      }
    }

    // Check subsystems
    for (const [name, sub] of Object.entries(subsystems)) {
      try {
        if (typeof sub?.getStatus === 'function') {
          results[name] = { healthy: true, details: sub.getStatus() };
        } else {
          results[name] = { healthy: true, details: 'no status method' };
        }
      } catch (e) {
        results[name] = { healthy: false, error: e.message };
      }
    }

    // Check data directories
    const dataDirs = ['data/pipeline', 'data/memory', 'data/personas'];
    for (const dir of dataDirs) {
      const fullPath = path.join(this.baseDir, dir);
      results[dir] = { healthy: existsSync(fullPath), path: fullPath };
    }

    return results;
  }

  /**
   * Read Ace's own source code for diagnosis
   */
  async readOwnSource(relPath) {
    const absPath = path.resolve(this.baseDir, relPath);
    // Security: only read files within the project
    if (!absPath.startsWith(this.baseDir)) {
      return null;
    }
    try {
      return await fs.readFile(absPath, 'utf-8');
    } catch {
      return null;
    }
  }

  // ─── AI-POWERED DIAGNOSIS ────────────────────────────────

  /**
   * Use AI to analyze an error + source code when pattern matching isn't enough.
   * Returns a deeper analysis with a suggested fix.
   */
  async _aiDiagnose(error, diagnosis, context) {
    if (!this.aiManager) return null;

    const codeContext = diagnosis.sourceSnippet?.code
      ?.map(l => `${l.isError ? '>>> ' : '    '}${l.num}: ${l.text}`)
      .join('\n') || 'No source code available';

    const prompt = `You are Ace's self-diagnostic system. An error occurred and you need to diagnose it.

ERROR: ${error.message}
FILE: ${diagnosis.sourceLocation?.filePath || 'unknown'}:${diagnosis.sourceLocation?.line || '?'}
COMPONENT: ${context.component || 'unknown'}
DEPARTMENT: ${context.department || 'unknown'}
ACTION: ${context.action || 'unknown'}

SOURCE CODE AROUND ERROR:
${codeContext}

Respond in this EXACT JSON format (no markdown, no backticks):
{"summary":"One sentence plain-English explanation of what went wrong","analysis":"2-3 sentences explaining the root cause","suggestedFix":"One sentence describing the fix, or null if unsure","riskLevel":"auto_fix or ask_first"}`;

    try {
      const response = await this.aiManager.chat(
        [{ role: 'user', content: prompt }],
        { systemPrompt: 'You are a code diagnostic system. Respond ONLY with valid JSON. No markdown.', maxTokens: 300 }
      );

      const text = response?.content || response?.text || String(response);
      // Extract JSON from response (handle models that wrap in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // AI diagnosis is best-effort
    }
    return null;
  }

  /**
   * Build a user message that incorporates AI diagnosis
   */
  _buildAIUserMessage(diagnosis, context) {
    const dept = context.department || 'system';
    const freq = diagnosis.frequency;
    const recurringNote = freq.lastHour > 2
      ? ` This has happened ${freq.lastHour} times in the last hour — I'm tracking it.`
      : '';

    let msg = `Hit an issue in my ${dept} system. ${diagnosis.summary}${recurringNote}`;

    if (diagnosis.suggestedFix) {
      msg += ` I think I know the fix: ${diagnosis.suggestedFix}`;
    } else {
      msg += ` I'm looking into it.`;
    }

    return msg;
  }

  // ─── PRIVATE METHODS ───────────────────────────────────

  /**
   * Classify error by type and risk level
   */
  _classifyError(error) {
    const msg = error.message || '';
    const stack = error.stack || '';

    // Null / undefined reference
    if (/cannot read propert|undefined is not|null is not|TypeError/i.test(msg)) {
      return { type: 'null_reference', risk: 'auto_fix', summary: 'A null or undefined value was accessed where an object was expected.' };
    }

    // JSON parse errors
    if (/JSON|Unexpected token|SyntaxError.*JSON/i.test(msg)) {
      return { type: 'json_parse', risk: 'auto_fix', summary: 'A data file has invalid JSON format.' };
    }

    // Network / connection errors
    if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(msg)) {
      return { type: 'network', risk: 'auto_fix', summary: 'A network connection failed — a service might be down or unreachable.' };
    }

    // Port conflicts
    if (/EADDRINUSE|address already in use/i.test(msg)) {
      return { type: 'port_conflict', risk: 'auto_fix', summary: 'The port is already being used by another process.' };
    }

    // Module / import errors
    if (/Cannot find module|MODULE_NOT_FOUND|ERR_MODULE/i.test(msg)) {
      return { type: 'missing_module', risk: 'auto_fix', summary: 'A required module or file is missing.' };
    }

    // File system errors
    if (/ENOENT|no such file|EACCES|permission denied/i.test(msg)) {
      return { type: 'filesystem', risk: 'auto_fix', summary: 'A file or directory is missing or inaccessible.' };
    }

    // AI provider errors
    if (/ollama|openai|anthropic|model.*not found|rate limit|quota/i.test(msg)) {
      return { type: 'ai_provider', risk: 'ask_first', summary: 'The AI provider returned an error — the model may be unavailable or rate-limited.' };
    }

    // API / routing errors
    if (/404|405|500|route|endpoint/i.test(msg)) {
      return { type: 'api_error', risk: 'ask_first', summary: 'An API endpoint returned an error.' };
    }

    // Check soul.json never_auto list — NEVER auto-fix these
    if (this.soulHealing?.risk_classification?.never_auto) {
      const neverPatterns = this.soulHealing.risk_classification.never_auto;
      const combined = `${msg} ${stack}`.toLowerCase();
      for (const pattern of neverPatterns) {
        if (combined.includes(pattern.toLowerCase().split(' ')[0])) {
          return { type: 'protected', risk: 'never_auto', summary: `This affects ${pattern} — requires manual intervention.` };
        }
      }
    }

    // Default: unknown — ask before fixing
    return { type: 'unknown', risk: 'ask_first', summary: `An unexpected error occurred: ${msg.substring(0, 120)}` };
  }

  /**
   * Parse a stack trace to find the source location
   */
  _parseStackTrace(stack) {
    if (!stack) return null;
    // Match lines like "at functionName (/path/to/file.js:123:45)"
    // or "at file:///path/to/file.js:123:45"
    const lines = stack.split('\n');
    for (const line of lines) {
      // Skip node_modules
      if (line.includes('node_modules')) continue;

      const match = line.match(/(?:at\s+.*?\s+\(|at\s+)((?:file:\/\/)?[^:)]+):(\d+):(\d+)/);
      if (match) {
        let filePath = match[1].replace('file://', '');
        const lineNum = parseInt(match[2], 10);
        const col = parseInt(match[3], 10);

        // Make relative if within project
        if (filePath.startsWith(this.baseDir)) {
          filePath = path.relative(this.baseDir, filePath);
        }

        // Only return if it's our source
        if (filePath.startsWith('src/') || filePath.startsWith('scripts/')) {
          return { filePath, line: lineNum, column: col, raw: line.trim() };
        }
      }
    }
    return null;
  }

  /**
   * Read source code around the error location
   */
  async _readSourceContext(relPath, line, contextLines = 5) {
    const source = await this.readOwnSource(relPath);
    if (!source) return null;

    const lines = source.split('\n');
    const start = Math.max(0, line - contextLines - 1);
    const end = Math.min(lines.length, line + contextLines);

    return {
      file: relPath,
      startLine: start + 1,
      endLine: end,
      errorLine: line,
      code: lines.slice(start, end).map((l, i) => ({
        num: start + i + 1,
        text: l,
        isError: start + i + 1 === line,
      })),
    };
  }

  /**
   * Count how many times a similar error has occurred recently
   */
  _getErrorFrequency(errorMessage) {
    const recent = this.errorHistory.filter(
      (e) => e.timestamp > Date.now() - 3600000 // last hour
    );
    const similar = recent.filter((e) => e.error === errorMessage);
    return { lastHour: similar.length, total: this.errorHistory.length };
  }

  /**
   * Build a user-friendly message following soul.json error philosophy
   */
  _buildUserMessage(diagnosis, context) {
    const { type, summary, frequency } = diagnosis;
    const dept = context.department || 'system';

    // Recurring error? Mention it
    const recurringNote =
      frequency.lastHour > 2
        ? ` This has happened ${frequency.lastHour} times in the last hour — I'm tracking it.`
        : '';

    switch (type) {
      case 'null_reference':
        return `Hit a hiccup in my ${dept} system — tried to use something that wasn't there yet. ${recurringNote}I'm looking into it.`;
      case 'json_parse':
        return `One of my data files got corrupted. ${recurringNote}Let me try to fix it.`;
      case 'network':
        return `Couldn't reach the service I needed — might be temporarily down. ${recurringNote}Let me try another way.`;
      case 'port_conflict':
        return `There's a port conflict — something else is using the same address. I can sort this out.`;
      case 'missing_module':
        return `A file or module I need is missing. ${recurringNote}Let me check what happened.`;
      case 'filesystem':
        return `Couldn't access a file I needed. ${recurringNote}Checking permissions and paths.`;
      case 'ai_provider':
        return `My AI brain hit a snag — the model might be busy or unavailable. ${recurringNote}Let me try again or switch approaches.`;
      case 'api_error':
        return `Got an unexpected response from an API call. ${recurringNote}Looking into what went wrong.`;
      default:
        return `Something unexpected happened on my end — not your fault. ${summary}${recurringNote}`;
    }
  }

  /**
   * Build a recovery plan based on diagnosis
   */
  _buildRecoveryPlan(diagnosis, context) {
    const { type } = diagnosis;

    switch (type) {
      case 'null_reference':
        return {
          strategy: 'Add safety check before accessing the value',
          autoAction: { type: 'ai_patch', errorType: 'null_reference' },
          suggestion: 'I can add a null check to prevent this. Want me to patch it?',
        };
      case 'json_parse':
        return {
          strategy: 'Reset the corrupted data file to a valid default',
          autoAction: diagnosis.sourceLocation ? { type: 'reset_json', file: diagnosis.sourceLocation.filePath } : null,
          suggestion: 'The data file is corrupted. I can reset it to a clean default.',
        };
      case 'network':
        return {
          strategy: 'Retry the connection, then try alternative endpoint',
          autoAction: { type: 'retry', delay: 2000, maxRetries: 2 },
          suggestion: 'Let me retry in a moment. If it keeps failing, I\'ll try a different approach.',
        };
      case 'port_conflict':
        return {
          strategy: 'Kill the process using the port and restart',
          autoAction: null, // Too risky for auto
          suggestion: 'Another process is using the port. Want me to restart the service?',
        };
      case 'missing_module':
        return {
          strategy: 'Check if the module needs to be installed or if the path is wrong',
          autoAction: null,
          suggestion: 'A module is missing. This might need a quick npm install or a path fix.',
        };
      case 'filesystem':
        return {
          strategy: 'Create missing directories or check file permissions',
          autoAction: { type: 'ensure_dir' },
          suggestion: 'A file path doesn\'t exist. I can create the missing directory.',
        };
      case 'ai_provider':
        return {
          strategy: 'Retry with exponential backoff, then try fallback model',
          autoAction: { type: 'retry', delay: 3000, maxRetries: 3 },
          suggestion: 'The AI model is having issues. I\'ll retry in a moment.',
        };
      default:
        return {
          strategy: 'Log the error and notify the user',
          autoAction: null,
          suggestion: `I ran into something I haven't seen before. Here's what happened: ${diagnosis.summary}`,
        };
    }
  }

  /**
   * Execute an automatic fix (only for safe, well-understood patterns)
   */
  async _executeAutoFix(action, diagnosis) {
    switch (action.type) {
      case 'retry':
        // Retry is handled by the caller — just signal that retry is recommended
        return false; // Not a "fix" per se — caller should retry

      case 'ensure_dir': {
        if (!diagnosis.sourceLocation?.filePath) return false;
        const dir = path.dirname(path.join(this.baseDir, diagnosis.sourceLocation.filePath));
        try {
          await fs.mkdir(dir, { recursive: true });
          return true;
        } catch {
          return false;
        }
      }

      case 'reset_json': {
        if (!action.file) return false;
        const fullPath = path.join(this.baseDir, action.file);
        if (!fullPath.startsWith(this.baseDir)) return false; // security
        try {
          // Only reset data files, never source code
          if (!action.file.startsWith('data/')) return false;
          await fs.writeFile(fullPath, '{}', 'utf-8');
          return true;
        } catch {
          return false;
        }
      }

      case 'ai_patch': {
        const patch = await this._generatePatch(diagnosis);
        if (!patch) return false;
        // Auto-apply only to data/ files; src/ patches stored for user review
        if (patch.file.startsWith('data/')) {
          return await this._applyPatch(patch);
        }
        // Store patch suggestion on diagnosis for user review
        diagnosis.suggestedPatch = patch;
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Record a fix attempt for learning
   */
  _recordFix(errorEntry, action, success) {
    this.fixHistory.push({
      timestamp: Date.now(),
      error: errorEntry.error,
      component: errorEntry.component,
      action,
      success,
    });
    if (this.fixHistory.length > this.maxFixHistory) {
      this.fixHistory = this.fixHistory.slice(-this.maxFixHistory);
    }
    this._saveFixLog();
  }

  /**
   * Save fix history to disk for persistent learning
   */
  async _saveFixLog() {
    try {
      const dir = path.dirname(this.fixLogPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.fixLogPath, JSON.stringify(this.fixHistory, null, 2), 'utf-8');
    } catch {
      // Non-critical — don't crash on logging failure
    }
  }

  /**
   * Load fix history from disk
   */
  _loadFixLog() {
    try {
      if (existsSync(this.fixLogPath)) {
        this.fixHistory = JSON.parse(readFileSync(this.fixLogPath, 'utf-8'));
      }
    } catch {
      this.fixHistory = [];
    }
  }

  /**
   * Search fixHistory for a previously successful fix matching this error.
   * Returns the most recent matching fix, or null.
   */
  _findMatchingFix(error, context = {}) {
    const classification = this._classifyError(error);
    const component = context.component || 'unknown';

    for (let i = this.fixHistory.length - 1; i >= 0; i--) {
      const fix = this.fixHistory[i];
      if (!fix.success) continue;

      const fixClassification = this._classifyError({ message: fix.error, stack: '' });
      if (fixClassification.type !== classification.type) continue;

      if (fix.component === component || fix.component === 'unknown') {
        return {
          previousFix: fix,
          matchType: fix.component === component ? 'exact' : 'component_wildcard',
          classification,
        };
      }
    }
    return null;
  }

  /**
   * Generate a code patch using AI for a diagnosed error.
   * Only generates patches for well-understood error types.
   */
  async _generatePatch(diagnosis) {
    if (!this.aiManager || !diagnosis.sourceSnippet) return null;

    const codeContext = diagnosis.sourceSnippet.code
      .map(l => `${l.isError ? '>>> ' : '    '}${l.num}: ${l.text}`)
      .join('\n');

    const prompt = `You are a code patching system. Generate a MINIMAL fix for this error.

ERROR TYPE: ${diagnosis.type}
ERROR: ${diagnosis.summary}
FILE: ${diagnosis.sourceLocation?.filePath}
LINE: ${diagnosis.sourceLocation?.line}

CODE:
${codeContext}

Rules:
- Output ONLY the fixed lines (the complete lines that need to change)
- For null_reference: add a null/undefined guard
- For missing_module: suggest the import fix
- Keep changes minimal — only fix the error, don't refactor
- Output as JSON: {"lines": [{"lineNumber": N, "original": "...", "replacement": "..."}], "description": "what the fix does"}
- If you're not confident, output: {"lines": [], "description": "unsure"}`;

    try {
      const response = await this.aiManager.chat(
        [{ role: 'user', content: prompt }],
        { systemPrompt: 'Output ONLY valid JSON. No markdown.', maxTokens: 400 }
      );
      const text = response?.content || response?.text || String(response);
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const patch = JSON.parse(jsonMatch[0]);
        if (patch.lines && patch.lines.length > 0) {
          return {
            file: diagnosis.sourceLocation.filePath,
            lines: patch.lines,
            description: patch.description,
            risk: diagnosis.risk,
          };
        }
      }
    } catch { /* best-effort */ }
    return null;
  }

  /**
   * Apply a code patch to a source file.
   * Security: only auto-apply to data/ files. src/ patches require user review.
   */
  async _applyPatch(patch) {
    if (!patch?.file || !patch.lines?.length) return false;

    const fullPath = path.join(this.baseDir, patch.file);
    if (!fullPath.startsWith(this.baseDir)) return false;

    // Only auto-patch data/ files; src/ files are stored for review
    if (!patch.file.startsWith('data/')) return false;

    try {
      const source = await fs.readFile(fullPath, 'utf-8');
      const lines = source.split('\n');

      for (const change of patch.lines) {
        const idx = change.lineNumber - 1;
        if (idx >= 0 && idx < lines.length) {
          if (lines[idx].trim() === change.original.trim()) {
            lines[idx] = change.replacement;
          }
        }
      }

      await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get recent error summary for monitoring dashboards
   */
  getErrorSummary() {
    const lastHour = this.errorHistory.filter((e) => e.timestamp > Date.now() - 3600000);
    const byType = {};
    for (const e of lastHour) {
      const classification = this._classifyError({ message: e.error, stack: '' });
      byType[classification.type] = (byType[classification.type] || 0) + 1;
    }
    return {
      errorsLastHour: lastHour.length,
      totalErrors: this.errorHistory.length,
      totalFixes: this.fixHistory.length,
      successfulFixes: this.fixHistory.filter((f) => f.success).length,
      byType,
    };
  }
}
