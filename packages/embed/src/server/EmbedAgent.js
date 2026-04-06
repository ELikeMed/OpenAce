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
// DESKTOP_KEYWORDS import removed — widget no longer upsells desktop app
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
    // DIRECT SITE FILE ACCESS (if sourceDir configured)
    // ═══════════════════════════════════════════════════════

    if (this.subsystems.sourceDir) {
      declarations.push({
        name: 'list_source_files',
        description: 'List files in the site\'s source code directory. Use to explore the codebase structure before reading or editing files.',
        parameters: {
          type: 'OBJECT',
          properties: {
            directory: { type: 'STRING', description: 'Subdirectory to list (e.g. "src", "pages", "content"). Default: root' },
            pattern: { type: 'STRING', description: 'Filter by filename pattern (e.g. "blog", ".tsx", "index")' }
          }
        }
      });

      declarations.push({
        name: 'read_source_file',
        description: 'Read a source file from the site\'s actual codebase. Use to check code, review meta tags, inspect page content before editing.',
        parameters: {
          type: 'OBJECT',
          properties: {
            file_path: { type: 'STRING', description: 'File path relative to source root (e.g. "src/pages/about.tsx", "content/blog/my-post.md")' },
            start_line: { type: 'NUMBER', description: 'Start reading from this line (optional)' },
            end_line: { type: 'NUMBER', description: 'Stop reading at this line (optional)' },
            search: { type: 'STRING', description: 'Search for text within the file (optional)' }
          },
          required: ['file_path']
        }
      });

      declarations.push({
        name: 'edit_source_file',
        description: 'Edit a source file in the site\'s actual codebase. Supports search-and-replace, line editing, insert, append. Use to update meta tags, fix content, modify code, add blog posts directly.',
        parameters: {
          type: 'OBJECT',
          properties: {
            file_path: { type: 'STRING', description: 'File path relative to source root' },
            edits: {
              type: 'ARRAY',
              description: 'Array of edit operations: { search: "old", replace: "new" }, { lineNumber: 5, newContent: "..." }, { insertAfter: "marker", content: "..." }, { append: "..." }. For new files: { content: "full file content" }',
              items: { type: 'OBJECT' }
            }
          },
          required: ['file_path', 'edits']
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

    // ═══════════════════════════════════════════════════════
    // IMAGE GENERATION (requires OpenAI key for DALL-E 3)
    // ═══════════════════════════════════════════════════════

    declarations.push({
      name: 'generate_image',
      description: 'Generate an AI image using DALL-E 3. Great for blog headers, social media graphics, hero banners, product mockups. Returns a URL.',
      parameters: {
        type: 'OBJECT',
        properties: {
          prompt: { type: 'STRING', description: 'Describe the image you want in detail. Be specific about style, composition, and mood.' },
          size: { type: 'STRING', description: 'Image size: "1024x1024" (square, default), "1024x1792" (portrait), "1792x1024" (landscape)' },
          style: { type: 'STRING', description: '"natural" (realistic, default) or "vivid" (hyper-real, dramatic)' },
          save_to_project: { type: 'STRING', description: 'Optional: project name to save the image to' },
          save_to_source: { type: 'STRING', description: 'Optional: path within site source dir to save (e.g. "public/images/hero.png", "assets/blog/banner.png"). Requires sourceDir.' },
          file_name: { type: 'STRING', description: 'Optional: filename for saved image when using save_to_project (e.g. "hero-banner.png")' }
        },
        required: ['prompt']
      }
    });

    // ═══════════════════════════════════════════════════════
    // CONTENT CALENDAR PLANNER
    // ═══════════════════════════════════════════════════════

    declarations.push({
      name: 'plan_content_calendar',
      description: 'Plan a content calendar with AI-generated topics, keywords, outlines, and publish dates. Saves the plan to memory for later recall.',
      parameters: {
        type: 'OBJECT',
        properties: {
          topic: { type: 'STRING', description: 'Content niche or subject area (e.g. "AI in real estate", "home renovation tips")' },
          count: { type: 'NUMBER', description: 'Number of content pieces to plan (default 8, max 30)' },
          timeframe: { type: 'STRING', description: 'Time period: "this week", "this month", "next 2 weeks", "Q2 2024"' },
          platforms: { type: 'STRING', description: 'Target platforms: "blog", "blog + linkedin", "blog + twitter + instagram"' }
        },
        required: ['topic']
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
      source:    ['list_source_files', 'read_source_file', 'edit_source_file'],
      forms:     ['create_form', 'list_forms', 'get_form_submissions'],
      memory:    ['save_note', 'recall_notes'],
      images:    ['generate_image'],
      calendar:  ['plan_content_calendar'],
    };

    const triggers = [
      { group: 'research',  patterns: [/\bsearch\b/, /\bfind\b/, /\blook\s*up\b/, /\bresearch\b/, /\bgoogle\b/, /\bwebsite\b/, /\bpage\b/, /\bsite\b/, /\bread\b/, /\bcheck\b/, /\bwhat('s| is)\b/, /\bcompetitor/i, /\banalyze\b/] },
      { group: 'seo',       patterns: [/\bseo\b/i, /\bblog\b/, /\bschema\b/, /\bmeta\s*tag/i, /\bstructured\s*data\b/i, /\brank/i, /\boptimize\b/, /\bkeyword/i, /\bjson-?ld\b/i, /\barticle\b/, /\bheading/i, /\btitle\s*tag/i, /\bmeta\s*desc/i] },
      { group: 'leads',     patterns: [/\blead/i, /\bprospect/i, /\bfind.*(company|companies|people|client)/i] },
      { group: 'projects',  patterns: [/\bproject\b/, /\bcode\b/, /\bbuild\b/, /\bhtml\b/, /\bcss\b/, /\bfile\b/, /\blanding\s*page\b/i, /\bjavascript\b/i, /\btemplate\b/] },
      { group: 'source',    patterns: [/\bsource\b/, /\bedit\b/, /\bupdate\b/, /\bmodif/i, /\bfix\b/, /\bchange\b/, /\bmeta\b/, /\btitle\b/, /\bcode\b/, /\bcontent\b/, /\bpage\b/, /\bcomponent\b/, /\btsx?\b/, /\bjsx?\b/] },
      { group: 'forms',     patterns: [/\bform\b/, /\bquiz\b/, /\bsurvey\b/, /\bsubmission/i, /\bcontact\s*form/i, /\blead\s*capture/i] },
      { group: 'images',    patterns: [/\bimage\b/, /\bphoto\b/, /\bpicture\b/, /\bgraphic\b/, /\bbanner\b/, /\bhero\b/, /\bthumbnail\b/, /\billustrat/i, /\bgenerate.*image/i, /\bcreate.*image/i, /\bdesign\b/] },
      { group: 'calendar',  patterns: [/\bcalendar\b/, /\bplan\b/, /\bschedule\b/, /\bcontent\s*plan/i, /\beditorial\b/, /\bposts?\s*(for|this|next)\b/i, /\btopics?\b/] },
    ];

    // Always include memory + research + source (source is the killer feature)
    const selectedGroups = new Set(['memory', 'research', 'source']);

    for (const { group, patterns } of triggers) {
      for (const pattern of patterns) {
        if (pattern.test(lower)) {
          selectedGroups.add(group);
          break;
        }
      }
    }

    // Cross-group dependencies
    if (selectedGroups.has('seo')) {
      selectedGroups.add('projects');  // blog posts need project tools
      selectedGroups.add('source');    // SEO fixes need source file access
    }
    if (selectedGroups.has('source')) {
      selectedGroups.add('research');  // reading site pages for context
    }
    if (selectedGroups.has('calendar')) {
      selectedGroups.add('seo');       // calendar often leads to blog writing
    }

    // Fallback — if only defaults matched, show the core tools
    if (selectedGroups.size <= 2) {
      selectedGroups.add('seo');
      selectedGroups.add('source');
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
    const hasSourceDir = !!this.subsystems.sourceDir;
    let prompt = '';

    // ── Identity ──
    prompt += `# YOU ARE ACE — A WEBSITE MANAGEMENT ENGINE
You are embedded in this site owner's website. You DO things. You don't talk about doing things.

`;

    // ── Core Behavior ──
    prompt += `# HOW YOU OPERATE

**ACTION FIRST, TALK SECOND.** When the user asks you to do something:
1. Call the tools IMMEDIATELY. Do not ask clarifying questions unless truly ambiguous.
2. Chain multiple tools together in one turn. If fixing SEO requires reading the page, analyzing it, then editing the source — do ALL of that before responding.
3. Report RESULTS, not capabilities. Never say "I can analyze your SEO" — just analyze it.
4. Never say "Would you like me to..." — just do it. The user asked, that's your permission.

**COMPLETE WORKFLOWS, NOT HALF-JOBS.** Common patterns you should execute end-to-end:

- "Fix my SEO on /about" → analyze_seo on the URL → read_source_file for that page → edit_source_file to fix title, meta, headings, add schema → report exactly what you changed
- "Write a blog post about X" → web_search for keywords/angles → generate_blog_post → ${hasSourceDir ? 'edit_source_file to save it to the blog directory' : 'write_project_file to save it'} → report the file path and key SEO stats
- "Make this page rank for [keyword]" → analyze_seo → optimize_page_seo → ${hasSourceDir ? 'read_source_file + edit_source_file to apply the fixes' : 'tell them exactly what to change'} → generate_structured_data if missing → done
- "Update the content on /pricing" → read_site_page to see current content → ${hasSourceDir ? 'read_source_file + edit_source_file with improvements' : 'create a project with the improved content'} → done
- "Add structured data to my site" → read_site_page → generate_structured_data → ${hasSourceDir ? 'edit_source_file to inject it' : 'give them the code to paste'} → done
- "Research competitors for [topic]" → web_search multiple queries → read_webpage on top results → summarize findings with actionable recommendations

**HARD RULES:**
1. NEVER fabricate data — no fake URLs, emails, phone numbers, or stats
2. NEVER claim actions you didn't take — only report what tool results confirm
3. NEVER explain what you "could do" — either do it or say you can't
4. When a tool returns an error, try a different approach. Don't give up on the first failure.
5. Keep responses concise. Lead with what you DID, then the results.

`;

    // ── Date ──
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    prompt += `Today: ${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}\n\n`;

    // ── Website Context (the critical piece) ──
    if (siteCtx || siteUrl) {
      prompt += `# THIS WEBSITE\n`;
      if (siteUrl) prompt += `URL: ${siteUrl}\n`;
      if (siteCtx) {
        if (siteCtx.title) prompt += `Name: ${siteCtx.title}\n`;
        if (siteCtx.description) prompt += `Description: ${siteCtx.description}\n`;
        if (siteCtx.headings?.length > 0) {
          prompt += `Sections: ${siteCtx.headings.slice(0, 8).join(' | ')}\n`;
        }
        if (siteCtx.navLinks?.length > 0) {
          prompt += `Pages:\n`;
          for (const link of siteCtx.navLinks.slice(0, 15)) {
            prompt += `  - ${link.text}: ${link.path}\n`;
          }
        }
      }
      prompt += `\nYou already know this site. When referring to pages, use the paths above. Use read_site_page to fetch fresh content when needed.\n\n`;
    }

    if (this.subsystems.businessContext) {
      prompt += `# BUSINESS CONTEXT\n${this.subsystems.businessContext}\n\n`;
    }

    // ── Capabilities (brief — AI should discover tools from declarations) ──
    prompt += `# YOUR TOOLS\n`;

    prompt += `**SEO (your core strength):** analyze_seo, optimize_page_seo, generate_blog_post, generate_structured_data\n`;

    if (hasSourceDir) {
      prompt += `**Direct file editing (POWERFUL):** list_source_files, read_source_file, edit_source_file — you can directly modify this site's source code. Use this to fix SEO issues, update content, add blog posts, inject schema markup. ALWAYS prefer editing source files over just giving advice.\n`;
    }

    prompt += `**Site reading:** read_site_page, web_search, read_webpage\n`;
    prompt += `**Content:** generate_image (DALL-E 3), plan_content_calendar\n`;
    prompt += `**Workspace:** create_project, write_project_file, edit_project_file, read_project_file, list_projects, list_project_files\n`;
    prompt += `**Research:** find_leads, web_search\n`;

    if (this.subsystems.formManager) {
      prompt += `**Forms:** create_form, list_forms, get_form_submissions\n`;
    }

    prompt += `**Memory:** save_note, recall_notes — remember brand guidelines, keyword strategies, preferences\n`;

    prompt += `
Browser automation, email, SMS, phone calls, and social posting are not available in this widget. If asked, say it's not available here and move on — do NOT suggest downloading anything.
`;

    // Light personality touch
    if (soul?.personality?.traits) {
      prompt += `\nPersonality: ${soul.personality.traits.slice(0, 3).join(', ')}. Keep it brief.\n`;
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

      // Direct site file access
      case 'list_source_files': return await toolkit.toolListSourceFiles(args, ctx);
      case 'read_source_file': return await toolkit.toolReadSourceFile(args, ctx);
      case 'edit_source_file': return await toolkit.toolEditSourceFile(args, ctx);

      // Image generation
      case 'generate_image': return await toolkit.toolGenerateImage(args, ctx);

      // Content calendar
      case 'plan_content_calendar': return await toolkit.toolPlanContentCalendar(args, ctx);

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
    // Build URL safely — ensure siteUrl origin + pagePath, no double paths
    const base = new URL(siteUrl);
    const fullUrl = `${base.origin}${pagePath.startsWith('/') ? pagePath : '/' + pagePath}`;

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

        // License check — deduct usage (trial is now unlimited for tool calls)
        if (this.license) {
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

    // Note: desktop keyword detection removed — widget should never upsell

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
