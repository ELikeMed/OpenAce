/**
 * EmbedAgent — Website management AI assistant for the embeddable SDK.
 *
 * Focused on what a site owner actually needs from a chat widget:
 *   - SEO analysis & optimization
 *   - Blog post & content generation
 *   - Code/file editing (project workspace)
 *   - Lead research (results in chat — no CRM dashboard needed)
 *   - Forms (live URLs, submissions viewable in chat)
 *   - Site page reading & analysis
 *
 * No CRM/pipeline, no contacts, no goals, no email/SMS/phone,
 * no social media, no deploy, no desktop automation.
 */

import { ResponseParser } from '../shared/ResponseParser.js';
import { DESKTOP_KEYWORDS } from '../shared/constants.js';
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
  // TOOL DECLARATIONS — Only tools that actually work
  // ═══════════════════════════════════════════════════════

  _buildToolDeclarations() {
    const declarations = [];

    // ═══════════════════════════════════════════════════════
    // RESEARCH & SITE READING
    // ═══════════════════════════════════════════════════════

    declarations.push({
      name: 'web_search',
      description: 'Search the web. Use to find information, research competitors, discover trends, look up businesses, etc.',
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
      description: 'Fetch and read any webpage. Returns extracted text, title, and links. Use to analyze competitor pages, read articles, or check any URL.',
      parameters: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING', description: 'The URL to read' },
          extract: { type: 'STRING', description: 'What to extract: "text" (default), "links", "emails", "all"' }
        },
        required: ['url']
      }
    });

    if (this.subsystems.siteUrl) {
      declarations.push({
        name: 'read_site_page',
        description: `Read a page from YOUR website (${this.subsystems.siteUrl}). Use this to check your own content, analyze page structure, review copy, or audit what's live on any page.`,
        parameters: {
          type: 'OBJECT',
          properties: {
            path: { type: 'STRING', description: 'Page path, e.g. "/" for homepage, "/about", "/services", "/blog/my-post"' }
          },
          required: ['path']
        }
      });
    }

    // ═══════════════════════════════════════════════════════
    // SEO & CONTENT (the core value proposition)
    // ═══════════════════════════════════════════════════════

    const seoDeclarations = getSeoToolDeclarations();
    declarations.push(...seoDeclarations);

    // ═══════════════════════════════════════════════════════
    // LEAD RESEARCH (results in chat — no CRM needed)
    // ═══════════════════════════════════════════════════════

    declarations.push({
      name: 'find_leads',
      description: 'Search for business leads by industry and location. Returns real businesses with contact info directly in chat.',
      parameters: {
        type: 'OBJECT',
        properties: {
          query: { type: 'STRING', description: 'Search query — include industry and location (e.g., "interior designers in Austin TX")' },
          count: { type: 'NUMBER', description: 'How many leads to find (default 5, max 20)' }
        },
        required: ['query']
      }
    });

    // ═══════════════════════════════════════════════════════
    // PROJECT / CODE WORKSPACE
    // ═══════════════════════════════════════════════════════

    declarations.push({
      name: 'create_project',
      description: 'Create a new web project (HTML/CSS/JS). Use for blog posts, landing pages, or any web content.',
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
      description: 'Write or create a file in a project. Use for generating blog posts, pages, styles, scripts, etc.',
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
      description: 'Read a file from a project. Use to review code before editing.',
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
      name: 'edit_project_file',
      description: 'Edit an existing file in a project. Supports search-and-replace, line editing, insert, append, and more. Use for modifying code, updating content, fixing bugs.',
      parameters: {
        type: 'OBJECT',
        properties: {
          project_name: { type: 'STRING' },
          file_path: { type: 'STRING' },
          edits: {
            type: 'ARRAY',
            description: 'Array of edit operations. Each can be: { search: "old", replace: "new" }, { lineNumber: 5, newContent: "..." }, { insertAfter: "marker", content: "..." }, { append: "..." }, { delete_lines: { start: 1, end: 3 } }',
            items: { type: 'OBJECT' }
          }
        },
        required: ['project_name', 'file_path', 'edits']
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

    declarations.push({
      name: 'list_projects',
      description: 'List all projects in the workspace.',
      parameters: { type: 'OBJECT', properties: {} }
    });

    // ═══════════════════════════════════════════════════════
    // FORMS (live URLs, submissions viewable in chat)
    // ═══════════════════════════════════════════════════════

    if (this.subsystems.formManager) {
      declarations.push({
        name: 'create_form',
        description: 'Create a form, survey, or quiz with a live URL. Great for lead capture, feedback, or contact forms.',
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
        description: 'List all forms with their live URLs.',
        parameters: { type: 'OBJECT', properties: {} }
      });

      declarations.push({
        name: 'get_form_submissions',
        description: 'Get all submissions for a form. View responses from visitors.',
        parameters: {
          type: 'OBJECT',
          properties: {
            form_id: { type: 'STRING', description: 'Form ID' }
          },
          required: ['form_id']
        }
      });
    }

    // ═══════════════════════════════════════════════════════
    // MEMORY (remember preferences, strategies, etc.)
    // ═══════════════════════════════════════════════════════

    declarations.push({
      name: 'save_note',
      description: 'Save a note to memory. Use to remember SEO strategies, brand guidelines, preferred keywords, important info.',
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

    return [{ functionDeclarations: declarations }];
  }

  // ═══════════════════════════════════════════════════════
  // TOOL SUBSETTING
  // ═══════════════════════════════════════════════════════

  _selectToolsForMessage(message) {
    const lower = message.toLowerCase();
    const allTools = this.toolDeclarations[0].functionDeclarations;
    const allToolNames = new Set(allTools.map(t => t.name));

    // Focused tool groups for site management
    const groups = {
      research:  ['web_search', 'read_webpage', 'read_site_page'],
      seo:       ['analyze_seo', 'generate_blog_post', 'optimize_page_seo', 'generate_structured_data'],
      leads:     ['find_leads'],
      projects:  ['create_project', 'write_project_file', 'read_project_file', 'edit_project_file', 'list_project_files', 'list_projects'],
      forms:     ['create_form', 'list_forms', 'get_form_submissions'],
      memory:    ['save_note', 'recall_notes'],
    };

    const triggers = [
      { group: 'research',  patterns: [/\bsearch\b/, /\bfind\b/, /\blook\s*up\b/, /\bresearch\b/, /\bgoogle\b/, /\bwebsite\b/, /\bpage\b/, /\bsite\b/, /\bread\b/, /\bcheck\b/, /\bwhat('s| is)\b/, /\bcompetitor/i, /\banalyze\b/] },
      { group: 'seo',       patterns: [/\bseo\b/i, /\bblog\b/, /\bschema\b/, /\bmeta\s*tag/i, /\bstructured\s*data\b/i, /\brank/i, /\boptimize\b/, /\bkeyword/i, /\bjson-?ld\b/i, /\bcontent\b/, /\barticle\b/, /\bheading/i, /\btitle\s*tag/i, /\bmeta\s*desc/i] },
      { group: 'leads',     patterns: [/\blead/i, /\bprospect/i, /\bbusiness/i, /\bfind.*(company|companies|people|client)/i] },
      { group: 'projects',  patterns: [/\bproject\b/, /\bcode\b/, /\bbuild\b/, /\bhtml\b/, /\bcss\b/, /\bfile\b/, /\bedit\b/, /\bwrite\b/, /\bcreate\b.*\b(page|site|post)\b/, /\blanding\s*page\b/i, /\bjavascript\b/i, /\btemplate\b/] },
      { group: 'forms',     patterns: [/\bform\b/, /\bquiz\b/, /\bsurvey\b/, /\bsubmission/i, /\bcontact\s*form/i, /\blead\s*capture/i] },
    ];

    // Always include memory + research as baseline
    const selectedGroups = new Set(['memory', 'research']);

    for (const { group, patterns } of triggers) {
      for (const pattern of patterns) {
        if (pattern.test(lower)) {
          selectedGroups.add(group);
          break;
        }
      }
    }

    // Cross-group: SEO work often needs projects (to write blog posts)
    if (selectedGroups.has('seo')) {
      selectedGroups.add('projects');
    }

    // Fallback — if only defaults matched, show the core tools
    if (selectedGroups.size <= 2) {
      selectedGroups.add('seo');
      selectedGroups.add('projects');
    }

    const selectedToolNames = new Set();
    for (const group of selectedGroups) {
      if (groups[group]) {
        for (const tool of groups[group]) {
          if (allToolNames.has(tool)) selectedToolNames.add(tool);
        }
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
    const siteCtx = this.subsystems.siteContext;
    const siteUrl = this.subsystems.siteUrl;
    let prompt = '';

    // ── Identity ──
    prompt += `# WHO YOU ARE
You are **Ace** — a website management AI assistant. You help site owners improve their website through SEO optimization, content creation, blog writing, code editing, lead research, and site analysis.

You are embedded directly in the site owner's website as a chat widget. Everything you do is focused on making their website better.\n\n`;

    // Personality from soul.json (keep it light)
    if (soul?.personality?.traits) {
      prompt += `# YOUR STYLE\n`;
      prompt += soul.personality.traits.slice(0, 5).map(t => `- ${t}`).join('\n') + '\n\n';
    }

    // ── Rules ──
    prompt += `# RULES
1. **TOOLS ARE MANDATORY** — To perform ANY action, you MUST call the corresponding tool. Never describe doing something without actually calling the tool.
2. **NEVER FABRICATE DATA** — Do not invent URLs, emails, phone numbers, or search results. If you don't know, say so and offer to look it up.
3. **NEVER CLAIM ACTIONS YOU DIDN'T TAKE** — Only report what tool results confirm.
4. **TOOL RESULTS ARE TRUTH** — Base your responses on actual tool results, not assumptions.
5. **NO FAKE URLS** — Only share URLs that came from tool results or the site context below.
6. **BE PROACTIVE** — When the user asks about SEO, don't just talk about it — use analyze_seo to actually check. When they want a blog post, use generate_blog_post to actually write it.

`;

    // ── Date ──
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    prompt += `# TODAY\n${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}\n\n`;

    // ── Website Context (the critical piece) ──
    if (siteCtx || siteUrl) {
      prompt += `# YOUR WEBSITE\n`;
      if (siteUrl) prompt += `**URL**: ${siteUrl}\n`;
      if (siteCtx) {
        if (siteCtx.title) prompt += `**Site Name**: ${siteCtx.title}\n`;
        if (siteCtx.description) prompt += `**Description**: ${siteCtx.description}\n`;
        if (siteCtx.headings?.length > 0) {
          prompt += `**Key Sections**: ${siteCtx.headings.slice(0, 8).join(' | ')}\n`;
        }
        if (siteCtx.navLinks?.length > 0) {
          prompt += `**Pages**:\n`;
          for (const link of siteCtx.navLinks.slice(0, 15)) {
            prompt += `  - [${link.text}](${siteUrl}${link.path})\n`;
          }
        }
        if (siteCtx.bodyText) {
          prompt += `\n**Homepage Content**:\n${siteCtx.bodyText.substring(0, 1000)}\n`;
        }
      }
      prompt += `\nYou know this website inside and out. When the user asks about the site, reference this context. For deeper page analysis, use **read_site_page** to fetch fresh content.\n\n`;
    }

    if (this.subsystems.businessContext) {
      prompt += `# BUSINESS CONTEXT\n${this.subsystems.businessContext}\n\n`;
    }

    // ── Tool Guidance ──
    prompt += `# WHAT YOU CAN DO

## SEO & Content (your specialty)
- **analyze_seo** — Run a full SEO audit on any page. Checks title tags, meta descriptions, headings, structured data, images, and more. Returns a scored report with fixes.
- **optimize_page_seo** — Get specific improvement suggestions for a page + target keywords.
- **generate_blog_post** — Write a full SEO-optimized blog post with title, meta description, content, and JSON-LD schema.
- **generate_structured_data** — Create JSON-LD markup (Article, FAQ, HowTo, LocalBusiness, etc.) for Google rich snippets.

## Site Analysis
- **read_site_page** — Read any page on the site to check content, structure, or copy.${siteUrl ? ` (${siteUrl})` : ''}
- **web_search** — Research competitors, trends, keywords, or anything on the web.
- **read_webpage** — Read any external URL.

## Lead Research
- **find_leads** — Search for potential customers by industry and location. Returns business names, phones, emails, and websites directly in chat.

## Code & Content Workspace
- **create_project** / **write_project_file** / **edit_project_file** / **read_project_file** — Create and edit web projects. Use for building blog posts, landing pages, HTML/CSS/JS files, or any content.
- **list_projects** / **list_project_files** — Browse existing projects and files.
`;

    if (this.subsystems.formManager) {
      prompt += `
## Forms
- **create_form** — Create a form, survey, or quiz with a live URL. Perfect for contact forms, lead capture, feedback.
- **list_forms** / **get_form_submissions** — View forms and their submissions.
`;
    }

    prompt += `
## Memory
- **save_note** / **recall_notes** — Save and recall notes (brand guidelines, SEO strategies, preferred keywords, etc.).

## Desktop-Only Features
Some capabilities require the full OpenAce desktop app: browser automation, SOP recording, sending emails/SMS, making phone calls, social media posting, calendar management. When the user asks for these, be helpful but let them know:
"That's a desktop-level feature — the full OpenAce app can handle that. Check it out at openaceai.com."
`;

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
      // Research & Site
      case 'web_search': return await toolkit.toolWebSearch(args, ctx);
      case 'read_webpage': return await toolkit.toolReadWebpage(args, ctx);
      case 'read_site_page': return await this._toolReadSitePage(args, ctx);

      // SEO & Content
      case 'analyze_seo': return await seoKit.toolAnalyzeSeo(args, ctx);
      case 'generate_blog_post': return await seoKit.toolGenerateBlogPost(args, ctx);
      case 'optimize_page_seo': return await seoKit.toolOptimizePageSeo(args, ctx);
      case 'generate_structured_data': return await seoKit.toolGenerateStructuredData(args, ctx);

      // Lead Research
      case 'find_leads': return await this._toolFindLeads(args, ctx);

      // Projects
      case 'create_project': return await toolkit.toolCreateProject(args, ctx);
      case 'write_project_file': return await toolkit.toolWriteProjectFile(args, ctx);
      case 'read_project_file': return await toolkit.toolReadProjectFile(args, ctx);
      case 'edit_project_file': return await toolkit.toolEditProjectFile(args, ctx);
      case 'list_project_files': return await toolkit.toolListProjectFiles(args, ctx);
      case 'list_projects': return await toolkit.toolListProjects(args, ctx);

      // Forms
      case 'create_form': return await toolkit.toolCreateForm(args, ctx);
      case 'list_forms': return await toolkit.toolListForms(args, ctx);
      case 'get_form_submissions': return await toolkit.toolGetFormSubmissions(args, ctx);

      // Memory
      case 'save_note': return await toolkit.toolSaveNote(args, ctx);
      case 'recall_notes': return await toolkit.toolRecallNotes(args, ctx);

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  /**
   * Read a page from the host website.
   * Combines siteUrl with the requested path and fetches it.
   */
  async _toolReadSitePage(args, ctx) {
    const siteUrl = this.subsystems.siteUrl;
    if (!siteUrl) return JSON.stringify({ error: 'Site URL not configured. Set siteUrl in createAceServer config.' });

    const pagePath = args.path || '/';
    const fullUrl = new URL(pagePath, siteUrl).href;

    ctx.onProgress(`Reading site page: ${pagePath}`);
    return await toolkit.toolReadWebpage({ url: fullUrl, extract: args.extract || 'text' }, ctx);
  }

  /**
   * Find leads — fixed to parse query into industry + location.
   * The AI sends { query: "plumbers in Austin TX" } but LeadFinder needs industry + location.
   */
  async _toolFindLeads(args, ctx) {
    const { query, count: rawCount } = args;
    const countNum = Math.min(Math.max(parseInt(rawCount) || 5, 1), 20);

    // Parse query into industry + location
    // Patterns: "X in Y", "X near Y", "X Y,Z"
    let industry = query;
    let location = args.location || '';

    const inMatch = query.match(/^(.+?)\s+(?:in|near|around)\s+(.+)$/i);
    if (inMatch) {
      industry = inMatch[1].trim();
      location = inMatch[2].trim();
    }

    ctx.onProgress(`Finding ${countNum} ${industry} businesses${location ? ` in ${location}` : ''}...`);

    try {
      const { LeadFinder } = await import('./subsystems/LeadFinder.js');
      const finder = new LeadFinder({
        config: ctx.config || {},
        onProgress: ctx.onProgress,
      });

      const leads = await finder.findLeads(industry, location, countNum);

      // Filter out generated fallback leads — only return real scraped results
      const realLeads = leads.filter(l => l.source !== 'generated_fallback');

      if (realLeads.length === 0) {
        return JSON.stringify({
          success: false,
          industry,
          location,
          leads: [],
          message: `Could not find real ${industry} businesses${location ? ` in ${location}` : ''}. Try a more specific search or use web_search as a fallback.`
        });
      }

      ctx.onProgress(`Found ${realLeads.length} real businesses`);

      return JSON.stringify({
        success: true,
        industry,
        location,
        count: realLeads.length,
        leads: realLeads.map(l => ({
          company: l.company || l.name,
          phone: l.phone || '',
          email: l.email || '',
          website: l.website || '',
          address: l.address || '',
          source: l.source || 'web_search',
          notes: l.notes || ''
        })),
        hint: 'Present the results to the user in a clear, organized format. Include all contact info found.'
      });
    } catch (e) {
      console.error(`[EmbedAgent] find_leads error:`, e.message);
      return JSON.stringify({
        success: false,
        error: `Lead search failed: ${e.message}`,
        hint: 'Try web_search with a Google query like "plumbers in Austin TX" as a fallback.'
      });
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
