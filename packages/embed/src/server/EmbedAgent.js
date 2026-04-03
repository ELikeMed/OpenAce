/**
 * EmbedAgent — Lightweight AI agent for the embeddable SDK.
 * A simplified UnifiedAgent with 28 server-safe tools + 4 SEO tools.
 * No desktop/browser automation. No SOP execution. No training mode.
 */

import { ResponseParser } from '../shared/ResponseParser.js';
import { TOOL_GROUPS, DESKTOP_KEYWORDS } from '../shared/constants.js';
import { getSeoToolDeclarations } from './SeoToolkit.js';
import * as toolkit from './EmbedToolkit.js';
import * as seoKit from './SeoToolkit.js';
import fs from 'fs/promises';
import path from 'path';

export class EmbedAgent {
  constructor({ aiManager, subsystems, onProgress, license, dataDir }) {
    this.aiManager = aiManager;
    this.subsystems = subsystems || {};
    this.onProgress = onProgress || (() => {});
    this.license = license;    // LicenseValidator instance
    this.dataDir = dataDir;

    // Load soul.json for personality
    this._soulConfig = null;
    this._loadSoul();

    // Abort flag
    this._abortRequested = false;

    // Build tool declarations
    this.toolDeclarations = this._buildToolDeclarations();
  }

  // ═══════════════════════════════════════════════════════
  // SOUL / PERSONALITY
  // ═══════════════════════════════════════════════════════

  async _loadSoul() {
    try {
      const soulPath = new URL('../shared/soul.json', import.meta.url).pathname;
      const data = await fs.readFile(soulPath, 'utf-8');
      this._soulConfig = JSON.parse(data);
    } catch {
      // Fallback — inline personality
      this._soulConfig = null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // TOOL DECLARATIONS
  // ═══════════════════════════════════════════════════════

  _buildToolDeclarations() {
    const declarations = [];

    // ── Research ──
    declarations.push({
      name: 'web_search',
      description: 'Search the web using DuckDuckGo. Returns titles, URLs, and snippets.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'The search query' }
        },
        required: ['query']
      }
    });

    declarations.push({
      name: 'read_webpage',
      description: 'Fetch and read the content of a webpage URL. Returns extracted text.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The URL to read' },
          extract: { type: 'STRING', description: 'What to extract: "text" (default), "links", "emails", "all"' }
        },
        required: ['url']
      }
    });

    // ── Email ──
    declarations.push({
      name: 'send_email',
      description: 'Send an email via Gmail SMTP. CRITICAL: Always use \\n\\n between paragraphs in the body.',
      parameters: {
        type: 'OBJECT',
        properties: {
          to: { type: 'STRING', description: 'Recipient email address' },
          subject: { type: 'STRING', description: 'Email subject line' },
          body: { type: 'STRING', description: 'Email body text. Use \\n\\n between paragraphs for proper spacing.' },
          html: { type: 'STRING', description: 'Optional HTML version. If omitted, HTML auto-generated from body.' }
        },
        required: ['to', 'subject', 'body']
      }
    });

    // ── Pipeline / CRM ──
    declarations.push({
      name: 'find_leads',
      description: 'Search for business leads by industry and location.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search query (e.g., "interior designers in Austin TX")' },
          location: { type: 'STRING', description: 'City/state to search in' }
        },
        required: ['query']
      }
    });

    declarations.push({
      name: 'save_leads',
      description: 'Save one or more leads to the pipeline. Returns saved lead IDs.',
      parameters: {
        type: 'OBJECT',
        properties: {
          leads: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                company: { type: 'STRING' },
                contact_name: { type: 'STRING' },
                email: { type: 'STRING' },
                phone: { type: 'STRING' },
                website: { type: 'STRING' },
                source: { type: 'STRING' },
                notes: { type: 'STRING' }
              },
              required: ['company']
            }
          }
        },
        required: ['leads']
      }
    });

    declarations.push({
      name: 'get_pipeline',
      description: 'Get leads and tasks from the pipeline. Returns full lead objects with IDs, emails, stages.',
      parameters: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', description: '"leads", "tasks", or "all" (default)' }
        }
      }
    });

    declarations.push({
      name: 'move_lead',
      description: 'Move a lead to a different pipeline stage.',
      parameters: {
        type: 'OBJECT',
        properties: {
          lead_id: { type: 'STRING', description: 'Lead ID or company name' },
          stage: { type: 'STRING', description: 'Stage: new, contacted, qualified, proposal, negotiation, won, lost' },
          note: { type: 'STRING', description: 'Optional note for this stage change' }
        },
        required: ['lead_id', 'stage']
      }
    });

    // ── Contacts ──
    declarations.push({
      name: 'manage_contacts',
      description: 'Add, search, or list contacts.',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', description: '"add", "search", or "list"' },
          name: { type: 'STRING' },
          email: { type: 'STRING' },
          phone: { type: 'STRING' },
          query: { type: 'STRING', description: 'Search query (for action=search)' }
        },
        required: ['action']
      }
    });

    // ── Scheduling & Goals ──
    declarations.push({
      name: 'schedule_task',
      description: 'Create a scheduled/recurring task.',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Task name' },
          schedule: { type: 'STRING', description: 'Cron expression or natural language (daily, weekly, etc.)' },
          action: { type: 'STRING', description: 'What to do when triggered' }
        },
        required: ['name', 'schedule', 'action']
      }
    });

    declarations.push({
      name: 'manage_goals',
      description: 'Track active missions and goals. Create, update progress, or list goals.',
      parameters: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING', description: '"create", "update", "list", "complete"' },
          description: { type: 'STRING' },
          goal_id: { type: 'STRING' },
          progress_increment: { type: 'NUMBER' }
        },
        required: ['action']
      }
    });

    // ── Memory ──
    declarations.push({
      name: 'save_note',
      description: 'Save a note to memory for later recall.',
      parameters: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: 'Note title/key' },
          content: { type: 'STRING', description: 'Note content' }
        },
        required: ['title', 'content']
      }
    });

    declarations.push({
      name: 'recall_notes',
      description: 'Search saved notes by keyword.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search keyword' }
        },
        required: ['query']
      }
    });

    // ── Forms ──
    if (this.subsystems.formManager) {
      declarations.push({
        name: 'create_form',
        description: 'Create a form, quiz, or survey.',
        parameters: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING', description: 'Form name' },
            fields: { type: 'ARRAY', description: 'Array of field objects: { name, type, required, options }' },
            description: { type: 'STRING' }
          },
          required: ['name', 'fields']
        }
      });

      declarations.push({
        name: 'list_forms',
        description: 'List all forms.',
        parameters: { type: 'OBJECT', properties: {} }
      });

      declarations.push({
        name: 'get_form_submissions',
        description: 'Get submissions for a form.',
        parameters: {
          type: 'OBJECT',
          properties: {
            form_id: { type: 'STRING', description: 'Form ID' }
          },
          required: ['form_id']
        }
      });
    }

    // ── Projects ──
    declarations.push({
      name: 'create_project',
      description: 'Create a new web project (HTML/CSS/JS).',
      parameters: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Project name' },
          template: { type: 'STRING', description: 'Template: "blank", "landing", "blog"' }
        },
        required: ['name']
      }
    });

    declarations.push({
      name: 'write_project_file',
      description: 'Write or create a file in a project.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: { type: 'STRING' },
          file_path: { type: 'STRING' },
          content: { type: 'STRING' }
        },
        required: ['project_name', 'file_path', 'content']
      }
    });

    declarations.push({
      name: 'read_project_file',
      description: 'Read a file from a project.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: { type: 'STRING' },
          file_path: { type: 'STRING' },
          search: { type: 'STRING', description: 'Optional: search for text in the file' }
        },
        required: ['project_name', 'file_path']
      }
    });

    declarations.push({
      name: 'list_project_files',
      description: 'List all files in a project.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: { type: 'STRING' }
        },
        required: ['project_name']
      }
    });

    // ── Workload / Knowledge ──
    if (this.subsystems.workloadStore) {
      declarations.push({
        name: 'search_workload',
        description: 'Search ingested files and documents.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Search query' }
          },
          required: ['query']
        }
      });
    }

    // ── SEO Tools (NEW — SDK exclusive) ──
    const seoDeclarations = getSeoToolDeclarations();
    declarations.push(...seoDeclarations);

    return [{ functionDeclarations: declarations }];
  }

  // ═══════════════════════════════════════════════════════
  // TOOL SUBSETTING
  // ═══════════════════════════════════════════════════════

  _selectToolsForMessage(message) {
    const lower = message.toLowerCase();
    const allTools = this.toolDeclarations[0].functionDeclarations;

    const groups = {
      memory:    ['save_note', 'recall_notes'],
      research:  ['web_search', 'read_webpage'],
      pipeline:  ['find_leads', 'save_leads', 'get_pipeline', 'move_lead'],
      email:     ['send_email'],
      contacts:  ['manage_contacts'],
      calendar:  ['list_calendar_events', 'create_calendar_event', 'delete_calendar_event'],
      social:    ['post_social_media', 'schedule_social_post', 'create_content_plan', 'select_media_for_content'],
      projects:  ['create_project', 'write_project_file', 'read_project_file', 'list_project_files'],
      forms:     ['create_form', 'list_forms', 'get_form_submissions'],
      workload:  ['search_workload'],
      goals:     ['manage_goals'],
      scheduler: ['schedule_task'],
      seo:       ['analyze_seo', 'generate_blog_post', 'optimize_page_seo', 'generate_structured_data'],
    };

    const triggers = [
      { group: 'research',  patterns: [/\bsearch\b/, /\bfind\b/, /\blook\s*up\b/, /\bresearch\b/, /\bgoogle\b/, /\binvestigate\b/] },
      { group: 'pipeline',  patterns: [/\blead/i, /\bpipeline\b/, /\bprospect/i, /\bcrm\b/, /\bsave.*lead/i/] },
      { group: 'email',     patterns: [/\bemail\b/, /\bsend\b.*\b(message|note|mail)\b/, /\breach out\b/, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/] },
      { group: 'contacts',  patterns: [/\bcontact/i] },
      { group: 'calendar',  patterns: [/\bcalendar\b/, /\bmeeting\b/, /\bevent\b/, /\bappointment\b/] },
      { group: 'social',    patterns: [/\bpost\b/, /\bsocial\b/, /\btwitter\b/, /\blinkedin\b/, /\bfacebook\b/, /\binstagram\b/, /\btiktok\b/, /\bcontent\s*plan\b/] },
      { group: 'projects',  patterns: [/\bproject\b/, /\bcode\b/, /\bbuild\b/, /\bhtml\b/, /\bcss\b/, /\bfile\b/, /\bedit\b/] },
      { group: 'forms',     patterns: [/\bform\b/, /\bquiz\b/, /\bsurvey\b/, /\bsubmission/i] },
      { group: 'workload',  patterns: [/\bworkload\b/, /\bdocument\b/, /\bmedia\b/, /\bupload\b/] },
      { group: 'goals',     patterns: [/\bgoal/i, /\btarget\b/, /\bmission\b/, /\bper\s*(day|week|month)\b/] },
      { group: 'scheduler', patterns: [/\bschedule\b/, /\broutine\b/, /\bdaily\b/, /\bweekly\b/] },
      { group: 'seo',       patterns: [/\bseo\b/i, /\bblog\b/, /\bschema\b/, /\bmeta\s*tag/i, /\bstructured\s*data\b/i, /\brank/i, /\boptimize\b/, /\bkeyword/i, /\bjson-?ld\b/i] },
    ];

    const selectedGroups = new Set(['memory']);

    for (const { group, patterns } of triggers) {
      for (const pattern of patterns) {
        if (pattern.test(lower)) {
          selectedGroups.add(group);
          break;
        }
      }
    }

    // Cross-group dependencies
    if (selectedGroups.has('pipeline')) {
      selectedGroups.add('research');
      selectedGroups.add('email');
    }
    if (selectedGroups.has('email')) {
      selectedGroups.add('contacts');
    }
    if (selectedGroups.has('seo')) {
      selectedGroups.add('research');
      selectedGroups.add('projects');
    }

    // Fallback — if only memory matched
    if (selectedGroups.size <= 1) {
      selectedGroups.add('research');
      selectedGroups.add('pipeline');
      selectedGroups.add('goals');
      selectedGroups.add('seo');
    }

    const selectedToolNames = new Set();
    for (const group of selectedGroups) {
      if (groups[group]) {
        for (const tool of groups[group]) selectedToolNames.add(tool);
      }
    }

    const filtered = allTools.filter(t => selectedToolNames.has(t.name));
    return [{ functionDeclarations: filtered }];
  }

  // ═══════════════════════════════════════════════════════
  // SYSTEM PROMPT
  // ═══════════════════════════════════════════════════════

  async _buildSystemPrompt(userMessage = '') {
    const soul = this._soulConfig;
    let prompt = '';

    // Identity from soul.json
    if (soul) {
      prompt += `# WHO YOU ARE\n${soul.core_identity?.who_i_am || 'You are Ace, an AI assistant.'}\n\n`;
      prompt += `# YOUR RELATIONSHIP WITH THE USER\n${soul.core_identity?.relationship_to_user || ''}\n\n`;
      prompt += `# YOUR PERSONALITY\n${soul.core_identity?.emotional_baseline || ''}\n`;
      if (soul.personality?.traits) {
        prompt += soul.personality.traits.map(t => `- ${t}`).join('\n') + '\n\n';
      }
    } else {
      prompt += `# WHO YOU ARE\nYou are Ace — an AI executive assistant embedded in the user's app. You handle SEO, content, leads, email, and more. You're direct, helpful, and honest.\n\n`;
    }

    // Anti-hallucination rules
    prompt += `# ABSOLUTE RULES — NEVER VIOLATE THESE
1. **TOOLS ARE MANDATORY** — To perform ANY action, you MUST call the corresponding tool. NEVER describe doing something without calling the tool.
2. **NEVER FABRICATE DATA** — Do not invent URLs, email addresses, phone numbers, or search results. If you don't know, say so and offer to look it up.
3. **NEVER CLAIM ACTIONS YOU DIDN'T TAKE** — If you didn't call send_email, don't say "I sent the email."
4. **SAY "I DON'T KNOW" WHEN APPROPRIATE** — If the user asks for factual data you don't have, use web_search to find real data.
5. **TOOL RESULTS ARE TRUTH** — Your response must be based on actual tool results.
6. **NO FAKE URLS** — Only share URLs that came from tool results.
7. **USE YOUR CONVERSATION HISTORY** — Before saying "I don't have that", check the conversation above. Don't ask for information you were already given.
8. **PIPELINE IS YOUR SOURCE OF TRUTH** — Before claiming a lead exists or doesn't, call get_pipeline. When you save a lead, note the returned ID.
9. **EMAIL FORMATTING** — When composing emails, ALWAYS use \\n\\n between paragraphs. Never send a wall of text. If the user drafted an email body, use it EXACTLY with proper paragraph breaks.

`;

    // Current date/time
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    prompt += `# CURRENT DATE & TIME\nToday is **${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}**.\n\n`;

    // Tool guidance
    prompt += `# AVAILABLE TOOLS
## Research & SEO
- **web_search**: Search the web. Use for finding information, leads, competitors.
- **read_webpage**: Read a URL's content. Use to extract contact info, analyze pages.
- **analyze_seo**: Analyze a page's SEO (meta tags, headings, structured data, images). Returns scored report.
- **generate_blog_post**: Generate an SEO-optimized blog post. Returns title, content, meta, structured data.
- **optimize_page_seo**: Get SEO improvement suggestions for a URL + target keywords.
- **generate_structured_data**: Create JSON-LD schema (Article, FAQ, HowTo, LocalBusiness, etc.).

## Lead Management
- **find_leads**: Search for business leads by industry/location.
- **save_leads**: Save leads to the pipeline. Returns saved IDs.
- **get_pipeline**: View all leads/tasks with full details (ID, email, stage, notes).
- **move_lead**: Move a lead to a new stage (new → contacted → qualified → proposal → won/lost).

## Communication
- **send_email**: Send email via Gmail SMTP. Always format with paragraph breaks.
- **manage_contacts**: Add, search, or list contacts.

## Content & Social
- **create_form**: Create forms, quizzes, surveys.
- **save_note** / **recall_notes**: Save and retrieve notes.

## Projects
- **create_project**: Create a new web project.
- **write_project_file**: Write a file in a project.
- **read_project_file**: Read a file from a project.

`;

    // Desktop upsell guidance
    prompt += `# DESKTOP CAPABILITIES
Some tasks require the full OpenAce desktop app (browser automation, SOP recording, screen control, teaching processes). When the user asks for these, respond helpfully but note:
"That feature requires the full OpenAce desktop app — it can control your browser, record processes, manage your full pipeline, and more. Check it out at openaceai.com."
Do NOT pretend you can do desktop-level automation from the embedded version.

`;

    // Business context from subsystems
    if (this.subsystems.businessContext) {
      prompt += `# BUSINESS CONTEXT\n${this.subsystems.businessContext}\n\n`;
    }

    return prompt;
  }

  // ═══════════════════════════════════════════════════════
  // TOOL EXECUTION
  // ═══════════════════════════════════════════════════════

  async _executeTool(name, args) {
    const ctx = {
      subsystems: this.subsystems,
      onProgress: this.onProgress,
      aiManager: this.aiManager,
      dataDir: this.dataDir,
    };

    switch (name) {
      // Research
      case 'web_search': return await toolkit.toolWebSearch(args, ctx);
      case 'read_webpage': return await toolkit.toolReadWebpage(args, ctx);

      // Email
      case 'send_email': return await toolkit.toolSendEmail(args, ctx);

      // Pipeline
      case 'find_leads': return await toolkit.toolFindLeads(args, ctx);
      case 'save_leads': return await toolkit.toolSaveLeads(args, ctx);
      case 'get_pipeline': return await toolkit.toolGetPipeline(args, ctx);
      case 'move_lead': return await toolkit.toolMoveLead(args, ctx);
      case 'set_lead_dnc': return await toolkit.toolSetLeadDnc(args, ctx);

      // Contacts
      case 'manage_contacts': return await toolkit.toolManageContacts(args, ctx);

      // Scheduling & Goals
      case 'schedule_task': return await toolkit.toolScheduleTask(args, ctx);
      case 'manage_goals': return await toolkit.toolManageGoals(args, ctx);

      // Memory
      case 'save_note': return await toolkit.toolSaveNote(args, ctx);
      case 'recall_notes': return await toolkit.toolRecallNotes(args, ctx);

      // Forms
      case 'create_form': return await toolkit.toolCreateForm(args, ctx);
      case 'list_forms': return await toolkit.toolListForms(args, ctx);
      case 'get_form_submissions': return await toolkit.toolGetFormSubmissions(args, ctx);

      // Projects
      case 'create_project': return await toolkit.toolCreateProject(args, ctx);
      case 'write_project_file': return await toolkit.toolWriteProjectFile(args, ctx);
      case 'read_project_file': return await toolkit.toolReadProjectFile(args, ctx);
      case 'list_project_files': return await toolkit.toolListProjectFiles(args, ctx);

      // Workload
      case 'search_workload': return await toolkit.toolSearchWorkload(args, ctx);

      // SEO (NEW)
      case 'analyze_seo': return await seoKit.toolAnalyzeSeo(args, ctx);
      case 'generate_blog_post': return await seoKit.toolGenerateBlogPost(args, ctx);
      case 'optimize_page_seo': return await seoKit.toolOptimizePageSeo(args, ctx);
      case 'generate_structured_data': return await seoKit.toolGenerateStructuredData(args, ctx);

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  // ═══════════════════════════════════════════════════════
  // TOOL LOOP
  // ═══════════════════════════════════════════════════════

  async _runToolLoop(result, toolsCalled, thinking, maxIterations = 25) {
    let iterations = 0;

    while (result.functionCalls && result.functionCalls.length > 0 && iterations < maxIterations) {
      if (this._abortRequested) {
        this.onProgress('Stopped by user');
        result.functionCalls = [];
        break;
      }

      iterations++;
      const toolResults = [];

      for (const call of result.functionCalls) {
        if (this._abortRequested) break;

        thinking.push(`Tool: ${call.name}`);
        this.onProgress(`Using ${call.name.replace(/_/g, ' ')}`);
        toolsCalled.push(call.name);

        // License check — deduct usage
        if (this.license) {
          const check = this.license.checkLimit('interactions');
          if (!check.allowed) {
            toolResults.push({
              functionResponse: {
                name: call.name,
                response: { error: 'Usage limit reached. Upgrade to Pro at openaceai.com for unlimited access.' }
              }
            });
            continue;
          }
          await this.license.recordUsage('interactions');
        }

        try {
          const toolResult = await this._executeTool(call.name, call.args || {});
          const summarized = this._truncateToolResult(toolResult, 4000);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { result: summarized }
            }
          });
        } catch (toolError) {
          console.error(`[EmbedAgent] Tool ${call.name} failed:`, toolError.message);
          toolResults.push({
            functionResponse: {
              name: call.name,
              response: { error: toolError.message }
            }
          });
        }
      }

      if (this._abortRequested) {
        result.functionCalls = [];
        break;
      }

      // Send tool results back to AI
      this.onProgress('Processing results');
      try {
        const followUp = await result.chat.sendMessage(toolResults);
        const response = followUp.response;

        let text = '';
        try {
          text = typeof response.text === 'function' ? response.text() : String(response.text || '');
        } catch { /* no text if more function calls */ }

        result = {
          ...result,
          response,
          text,
          functionCalls: response.functionCalls?.() || [],
        };
      } catch (followUpError) {
        console.error('[EmbedAgent] Follow-up error:', followUpError.message);
        break;
      }
    }

    return { result, iterations };
  }

  _truncateToolResult(result, maxLen = 4000) {
    const str = typeof result === 'string' ? result : JSON.stringify(result);
    if (str.length <= maxLen) return str;

    // Try to parse as JSON and truncate arrays
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) {
        while (JSON.stringify(parsed).length > maxLen && parsed.length > 1) {
          parsed.pop();
        }
        return JSON.stringify(parsed);
      }
      if (parsed.results && Array.isArray(parsed.results)) {
        while (JSON.stringify(parsed).length > maxLen && parsed.results.length > 1) {
          parsed.results.pop();
        }
        return JSON.stringify(parsed);
      }
    } catch { /* not JSON */ }

    return str.substring(0, maxLen) + '... (truncated)';
  }

  // ═══════════════════════════════════════════════════════
  // MAIN ENTRY — Process a message
  // ═══════════════════════════════════════════════════════

  async process(message, conversationHistory = [], channelContext = {}) {
    this._abortRequested = false;
    const thinking = ['Processing...'];
    const toolsCalled = [];

    // Build messages for AI
    const systemPrompt = await this._buildSystemPrompt(message);
    const messages = [];

    // Include recent conversation history (last 25 messages)
    const recentHistory = conversationHistory.slice(-25);
    let foundFirstUser = false;
    for (const msg of recentHistory) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' ? 'assistant' : 'user';
      if (!foundFirstUser && role === 'assistant') continue;
      foundFirstUser = true;
      messages.push({
        role,
        content: String(msg.content || '').substring(0, 5000)
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Check for desktop upsell
    const lowerMsg = message.toLowerCase();
    const isDesktopRequest = DESKTOP_KEYWORDS.some(kw => lowerMsg.includes(kw));

    // Call AI with tools
    this.onProgress('Thinking');
    try {
      let result;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const selectedTools = this._selectToolsForMessage(message);
          result = await this.aiManager.chatWithTools(messages, {
            systemPrompt,
            tools: selectedTools,
          });
          break;
        } catch (apiError) {
          if (apiError.message?.includes('429') && attempt < 2) {
            const waitSec = (attempt + 1) * 5;
            this.onProgress(`Rate limited, retrying in ${waitSec}s`);
            await new Promise(r => setTimeout(r, waitSec * 1000));
            continue;
          }
          throw apiError;
        }
      }

      // Run tool loop
      const { result: finalResult, iterations } = await this._runToolLoop(result, toolsCalled, thinking);

      // Extract final text
      let responseText = '';
      try {
        responseText = finalResult.text || '';
        if (typeof finalResult.response?.text === 'function') {
          responseText = finalResult.response.text();
        }
      } catch { /* no text */ }

      // Parse ACE_QUESTION / ACE_ACTIONS
      const parsed = ResponseParser.parse(responseText);

      // Add desktop upsell if needed
      if (isDesktopRequest && !parsed.cleanText.includes('openaceai.com')) {
        parsed.cleanText += '\n\n> **Want more power?** The full OpenAce desktop app can control your browser, record processes, and automate anything on your screen. [Get it at openaceai.com](https://openaceai.com)';
      }

      return {
        text: parsed.cleanText,
        question: parsed.question,
        pendingActions: parsed.pendingActions,
        toolsUsed: [...new Set(toolsCalled)],
        thinking,
        iterations,
      };

    } catch (error) {
      console.error('[EmbedAgent] Process error:', error.message);
      return {
        text: `Something went wrong on my end — ${error.message}. Let me try a different approach. What were you looking for?`,
        toolsUsed: toolsCalled,
        thinking,
      };
    }
  }

  // ── Direct tool execution (for CronRunner) ──
  async executeTool(name, args) {
    return await this._executeTool(name, args);
  }

  // ── Abort ──
  abort() {
    this._abortRequested = true;
  }

  resetAbort() {
    this._abortRequested = false;
  }
}
