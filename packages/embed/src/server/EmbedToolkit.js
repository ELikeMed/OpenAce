/**
 * OpenAce Embed SDK — Tool Implementations
 *
 * Standalone functions extracted from UnifiedAgent.js for the embeddable SDK.
 * Each function takes (args, ctx) where ctx = { subsystems, onProgress, researchMemory, dataDir }.
 *
 * NO `this` references — every function is self-contained.
 * NO browser/desktop tools — embed SDK is server-side only.
 * NO SOP execution tools — those require desktop automation.
 *
 * Returns JSON.stringify(result) just like UnifiedAgent does.
 */

import fs from 'fs/promises';
import path from 'path';


// ═══════════════════════════════════════════════════════
// RESEARCH TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Search the web via DuckDuckGo HTML (no browser needed).
 * Populates ctx.researchMemory with results for later recall.
 */
export async function toolWebSearch(args, ctx) {
  const query = args.query;
  ctx.onProgress(`Searching: ${query}`);

  let results = [];

  // DuckDuckGo fetch-based search (works on ALL platforms, no browser needed)
  ctx.onProgress('Searching DuckDuckGo...');
  try {
    results = await _searchDuckDuckGo(query, 10);
  } catch (e) {
    console.warn(`[EmbedToolkit] DuckDuckGo search failed: ${e.message}`);
  }

  // Number results
  results = results.map((r, i) => ({ position: i + 1, ...r }));
  ctx.onProgress(`Found ${results.length} results`);

  // Store for research context
  if (ctx.researchMemory) {
    ctx.researchMemory._lastResearchContext = {
      query,
      timestamp: Date.now(),
      searchResults: results,
      synthesis: null,
      sources: results.map(r => ({ title: r.title, url: r.url })),
    };
  }

  if (results.length === 0) {
    return JSON.stringify({
      query,
      resultCount: 0,
      results: [],
      hint: 'No results found. Try rephrasing the query or use read_webpage with a specific URL.'
    });
  }

  return JSON.stringify({ query, resultCount: results.length, results });
}

/**
 * Read and extract text from a URL using fetch.
 */
export async function toolReadWebpage(args, ctx) {
  const url = args.url;
  ctx.onProgress(`Reading: ${url}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!resp.ok) return JSON.stringify({ error: `HTTP ${resp.status}` });

    const html = await resp.text();
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : '';

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Update research context with page content
    if (ctx.researchMemory?._lastResearchContext) {
      if (!ctx.researchMemory._lastResearchContext.pageContents) {
        ctx.researchMemory._lastResearchContext.pageContents = [];
      }
      ctx.researchMemory._lastResearchContext.pageContents.push({
        url, title, content: text.substring(0, 3000)
      });
    }

    return JSON.stringify({ url, title, content: text.substring(0, 8000), contentLength: text.length });
  } catch (e) {
    return JSON.stringify({ error: e.name === 'AbortError' ? 'Timeout' : e.message });
  }
}


// ═══════════════════════════════════════════════════════
// MEMORY / NOTES
// ═══════════════════════════════════════════════════════

/**
 * Save a note to the data directory.
 */
export async function toolSaveNote(args, ctx) {
  const { title, content, category } = args;
  if (!title || !content) return JSON.stringify({ error: 'title and content are required' });

  const dataDir = ctx.dataDir || process.cwd();
  const notesDir = path.join(dataDir, 'data', 'memory', 'notes');
  await fs.mkdir(notesDir, { recursive: true });

  const id = `note_${Date.now()}`;
  const note = {
    id,
    title,
    content,
    category: category || 'reference',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const filePath = path.join(notesDir, `${id}.json`);
  await fs.writeFile(filePath, JSON.stringify(note, null, 2));

  ctx.onProgress(`Saved: "${title}"`);
  return JSON.stringify({ success: true, id, title, category: note.category });
}

/**
 * Recall saved notes by keyword search.
 */
export async function toolRecallNotes(args, ctx) {
  const query = (args.query || '').toLowerCase();
  const dataDir = ctx.dataDir || process.cwd();
  const notesDir = path.join(dataDir, 'data', 'memory', 'notes');

  try {
    await fs.mkdir(notesDir, { recursive: true });
    const files = await fs.readdir(notesDir);
    const notes = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(notesDir, file), 'utf-8');
        const note = JSON.parse(raw);
        notes.push(note);
      } catch (e) { /* skip corrupt files */ }
    }

    if (notes.length === 0) {
      return JSON.stringify({ notes: [], message: 'No saved notes found.' });
    }

    // Score by relevance to query
    const queryWords = query.split(/\s+/).filter(w => w.length > 2);
    const scored = notes.map(note => {
      const text = `${note.title} ${note.content} ${note.category}`.toLowerCase();
      const matches = queryWords.filter(w => text.includes(w)).length;
      return { ...note, score: queryWords.length > 0 ? matches / queryWords.length : 1 };
    });

    scored.sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt));
    const results = scored.slice(0, 5);

    ctx.onProgress(`Found ${results.length} notes matching "${args.query}"`);
    return JSON.stringify({ notes: results, count: results.length });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}


// ═══════════════════════════════════════════════════════
// FORM / QUIZ TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Create a form or quiz.
 */
export async function toolCreateForm(args, ctx) {
  const fm = ctx.subsystems.formManager;
  if (!fm) return JSON.stringify({ error: 'FormManager not available' });

  const { name, description, type, publish } = args;

  // Parse JSON string parameters
  let steps, settings, results;
  try {
    steps = typeof args.steps === 'string' ? JSON.parse(args.steps) : (args.steps || []);
  } catch (e) {
    return JSON.stringify({ error: `Invalid steps JSON: ${e.message}` });
  }
  try {
    settings = args.settings ? (typeof args.settings === 'string' ? JSON.parse(args.settings) : args.settings) : {};
  } catch { settings = {}; }
  try {
    results = args.results ? (typeof args.results === 'string' ? JSON.parse(args.results) : args.results) : { enabled: false };
  } catch { results = { enabled: false }; }

  ctx.onProgress(`Creating ${type || 'form'}: ${name}`);

  try {
    const form = await fm.createForm({
      name,
      description: description || '',
      type: type || 'form',
      status: publish === 'true' ? 'published' : 'draft',
      steps,
      settings,
      results
    });

    const liveUrl = form.status === 'published' ? `/forms/${form.slug}` : null;
    ctx.onProgress(`Form "${name}" created${liveUrl ? ` — live at ${liveUrl}` : ' (draft)'}`);

    return JSON.stringify({
      success: true,
      form_id: form.id,
      slug: form.slug,
      name: form.name,
      status: form.status,
      step_count: form.steps.length,
      live_url: liveUrl,
      dashboard_url: '/forms',
      message: liveUrl
        ? `Form "${name}" is live at ${liveUrl}! Manage it on the Forms page in the dashboard.`
        : `Form "${name}" created as draft. Publish it from the Forms page to get a live URL.`
    });
  } catch (e) {
    return JSON.stringify({ error: `Form creation failed: ${e.message}` });
  }
}

/**
 * List all forms with submission counts.
 */
export async function toolListForms(args, ctx) {
  const fm = ctx.subsystems.formManager;
  if (!fm) return JSON.stringify({ error: 'FormManager not available' });

  const forms = fm.getForms();
  const formsWithCounts = await Promise.all(forms.map(async f => {
    const subs = await fm.loadSubmissions(f.id);
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      status: f.status,
      slug: f.slug,
      step_count: f.steps.length,
      submission_count: subs.length,
      live_url: f.status === 'published' ? `/forms/${f.slug}` : null,
      created: f.created_at
    };
  }));

  ctx.onProgress(`Found ${formsWithCounts.length} forms`);
  return JSON.stringify({ forms: formsWithCounts, count: formsWithCounts.length });
}

/**
 * Get submissions for a specific form.
 */
export async function toolGetFormSubmissions(args, ctx) {
  const fm = ctx.subsystems.formManager;
  if (!fm) return JSON.stringify({ error: 'FormManager not available' });

  const { form_id } = args;
  const form = fm.getForm(form_id);
  if (!form) return JSON.stringify({ error: `Form not found: ${form_id}` });

  try {
    const result = await fm.getSubmissions(form_id, { limit: 20 });
    ctx.onProgress(`${result.total} submissions for "${form.name}"`);
    return JSON.stringify({
      form_name: form.name,
      total: result.total,
      submissions: result.submissions.map(s => ({
        id: s.id,
        contact: s.contact,
        answers: s.answers,
        outcome: s.outcome,
        date: s.submitted_at
      }))
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}


// ═══════════════════════════════════════════════════════
// PROJECT TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Create a new project with files.
 */
export async function toolCreateProject(args, ctx) {
  const dataDir = ctx.dataDir || process.cwd();
  const { project_type, description, files } = args;
  const projectName = _sanitizeProjectName(args.name) || `project-${Date.now()}`;
  ctx.onProgress(`Creating project: ${projectName} (${project_type || 'landing-page'})`);

  try {
    // If files were provided directly, write them to the project
    if (files) {
      let fileList;
      try {
        fileList = typeof files === 'string' ? JSON.parse(files) : files;
        if (!Array.isArray(fileList)) fileList = null;
      } catch (e) {
        console.warn(`[EmbedToolkit] create_project: files parse failed (${e.message})`);
        fileList = null;
      }

      if (fileList && fileList.length > 0) {
        const projectDir = path.join(dataDir, 'projects', projectName);
        await fs.mkdir(projectDir, { recursive: true });

        const results = [];
        for (const file of fileList) {
          const fp = file.path || file.file_path || file.filename || file.name;
          const fc = file.content || file.code || file.source;
          if (fp && fc) {
            const filePath = path.join(projectDir, String(fp));
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, String(fc), 'utf-8');
            results.push(String(fp));
            ctx.onProgress(`Created: ${fp}`);
          }
        }

        if (results.length > 0) {
          // Create project.json metadata
          const projectMeta = {
            name: projectName,
            type: project_type || 'landing-page',
            description: description,
            created: new Date().toISOString(),
            updated: new Date().toISOString(),
            framework: 'vanilla',
            entryPoint: 'index.html',
            status: 'active'
          };
          await fs.writeFile(
            path.join(projectDir, 'project.json'),
            JSON.stringify(projectMeta, null, 2)
          );

          ctx.onProgress(`Project "${projectName}" created with ${results.length} files`);
          return JSON.stringify({
            success: true,
            projectName,
            projectDir,
            filesCreated: results.length,
            files: results,
            studioUrl: `/studio?project=${projectName}`,
            message: `Project "${projectName}" created with ${results.length} files!`
          });
        }
      }
    }

    // Fallback: create placeholder project
    const projectDir = path.join(dataDir, 'projects', projectName);
    await fs.mkdir(projectDir, { recursive: true });
    const displayName = projectName.replace(/-/g, ' ');
    const placeholder = `<!DOCTYPE html><html><head><title>${displayName}</title></head><body><h1>${displayName}</h1><p>${description || 'Project created.'}</p></body></html>`;
    await fs.writeFile(path.join(projectDir, 'index.html'), placeholder, 'utf-8');
    await fs.writeFile(path.join(projectDir, 'project.json'), JSON.stringify({
      name: projectName, type: project_type || 'landing-page', description,
      created: new Date().toISOString(), updated: new Date().toISOString(),
      framework: 'vanilla', entryPoint: 'index.html', status: 'active'
    }, null, 2));

    ctx.onProgress(`Created placeholder project "${projectName}"`);
    return JSON.stringify({
      success: true, projectName,
      studioUrl: `/studio?project=${projectName}`,
      message: `Project "${projectName}" created with a placeholder. Use write_project_file to add real content.`,
    });
  } catch (e) {
    return JSON.stringify({ error: `Project creation failed: ${e.message}` });
  }
}

/**
 * Write or overwrite a file in an existing project.
 */
export async function toolWriteProjectFile(args, ctx) {
  const { project_name, file_path: filePath, content } = args;
  if (!project_name || !filePath || !content) {
    return JSON.stringify({ error: 'project_name, file_path, and content are required' });
  }

  const dataDir = ctx.dataDir || process.cwd();
  const sanitized = _sanitizeProjectName(project_name);
  const projectDir = path.join(dataDir, 'projects', sanitized);

  try { await fs.access(projectDir); } catch {
    return JSON.stringify({ error: `Project "${sanitized}" not found. Create it first with create_project.` });
  }

  try {
    const fullPath = path.join(projectDir, filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    // Update project.json timestamp
    const metaPath = path.join(projectDir, 'project.json');
    try {
      const raw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(raw);
      meta.updated = new Date().toISOString();
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    } catch { /* no project.json, that's ok */ }

    ctx.onProgress(`Updated: ${sanitized}/${filePath}`);
    return JSON.stringify({
      success: true,
      project: sanitized,
      file: filePath,
      size: content.length,
      lines: content.split('\n').length,
      studioUrl: `/studio?project=${sanitized}`
    });
  } catch (e) {
    return JSON.stringify({ error: `Failed to write file: ${e.message}` });
  }
}

/**
 * List all files in a project.
 */
export async function toolListProjectFiles(args, ctx) {
  const { project_name } = args;
  if (!project_name) return JSON.stringify({ error: 'project_name is required' });

  const dataDir = ctx.dataDir || process.cwd();
  const sanitized = _sanitizeProjectName(project_name);
  const projectDir = path.join(dataDir, 'projects', sanitized);

  try { await fs.access(projectDir); } catch {
    return JSON.stringify({ error: `Project "${project_name}" not found` });
  }

  const files = [];
  const walk = async (dir, prefix = '') => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'project.json' || entry.name === '.history' || entry.name === 'node_modules' || entry.name === '.git') continue;
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(dir, entry.name), relPath);
      } else {
        try {
          const stat = await fs.stat(path.join(dir, entry.name));
          files.push({ path: relPath, size: stat.size });
        } catch { files.push({ path: relPath }); }
      }
    }
  };

  try {
    await walk(projectDir);
    ctx.onProgress(`Project "${sanitized}" has ${files.length} files`);
    return JSON.stringify({ project: sanitized, files, count: files.length });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

/**
 * Read a file from a project with optional line range or search.
 */
export async function toolReadProjectFile(args, ctx) {
  const { project_name, file_path: filePath, with_line_numbers, start_line, end_line, search } = args;
  if (!project_name || !filePath) {
    return JSON.stringify({ error: 'project_name and file_path are required' });
  }

  const dataDir = ctx.dataDir || process.cwd();
  const sanitized = _sanitizeProjectName(project_name);
  const projectDir = path.join(dataDir, 'projects', sanitized);

  try { await fs.access(projectDir); } catch {
    return JSON.stringify({ error: `Project "${sanitized}" not found.` });
  }

  try {
    const fullPath = path.join(projectDir, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const allLines = content.split('\n');
    const totalLines = allLines.length;

    // SEARCH MODE
    if (search) {
      const searchLower = search.toLowerCase();
      const matches = [];
      const contextLines = 2;

      for (let i = 0; i < allLines.length; i++) {
        if (allLines[i].toLowerCase().includes(searchLower)) {
          const start = Math.max(0, i - contextLines);
          const end = Math.min(allLines.length - 1, i + contextLines);
          const block = [];
          for (let j = start; j <= end; j++) {
            const marker = j === i ? '>>>' : '   ';
            block.push(`${marker}${String(j + 1).padStart(4)}  ${allLines[j]}`);
          }
          matches.push({
            line_number: i + 1,
            text: allLines[i].trim(),
            context: block.join('\n')
          });
        }
      }

      ctx.onProgress(`Search "${search}" in ${filePath}: ${matches.length} matches`);
      return JSON.stringify({
        success: true,
        project: sanitized,
        file: filePath,
        search_term: search,
        matches,
        match_count: matches.length,
        total_lines: totalLines,
      });
    }

    // LINE RANGE MODE or FULL FILE MODE
    let outputLines = allLines;
    let rangeNote = '';
    if (start_line || end_line) {
      const s = Math.max(1, start_line || 1);
      const e = Math.min(totalLines, end_line || totalLines);
      outputLines = allLines.slice(s - 1, e);
      rangeNote = ` (showing lines ${s}-${e} of ${totalLines})`;
    }

    const showLineNumbers = with_line_numbers !== false;
    const outputContent = showLineNumbers
      ? outputLines.map((line, i) => {
          const lineNum = (start_line || 1) + i;
          return `${String(lineNum).padStart(4)}  ${line}`;
        }).join('\n')
      : outputLines.join('\n');

    ctx.onProgress(`Read: ${sanitized}/${filePath} (${totalLines} lines)${rangeNote}`);
    return JSON.stringify({
      success: true,
      project: sanitized,
      file: filePath,
      content: outputContent,
      total_lines: totalLines,
      showing_lines: start_line || end_line ? { start: start_line || 1, end: end_line || totalLines } : null,
      size: content.length,
    });
  } catch (e) {
    return JSON.stringify({ error: `Failed to read file: ${e.message}` });
  }
}

/**
 * Perform surgical edits on a project file.
 */
export async function toolEditProjectFile(args, ctx) {
  const { project_name, file_path: filePath } = args;
  if (!project_name || !filePath || !args.edits) {
    return JSON.stringify({ error: 'project_name, file_path, and edits are required' });
  }

  const dataDir = ctx.dataDir || process.cwd();
  const sanitized = _sanitizeProjectName(project_name);
  const projectDir = path.join(dataDir, 'projects', sanitized);

  try { await fs.access(projectDir); } catch {
    return JSON.stringify({ error: `Project "${sanitized}" not found.` });
  }

  let edits;
  try {
    edits = typeof args.edits === 'string' ? JSON.parse(args.edits) : args.edits;
    if (!Array.isArray(edits)) edits = [edits];
  } catch (e) {
    return JSON.stringify({ error: `Invalid edits JSON: ${e.message}` });
  }

  const fullPath = path.join(projectDir, filePath);
  ctx.onProgress(`Editing: ${sanitized}/${filePath} (${edits.length} operations)`);

  try {
    let content = await fs.readFile(fullPath, 'utf-8');
    let applied = 0;
    const errors = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];

      if (edit.delete_lines) {
        const { start, end } = edit.delete_lines;
        const lines = content.split('\n');
        if (start >= 1 && end <= lines.length && start <= end) {
          lines.splice(start - 1, end - start + 1);
          content = lines.join('\n');
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: delete_lines range ${start}-${end} invalid (file has ${lines.length} lines)`);
        }
      } else if (edit.replace_lines) {
        const { start, end } = edit.replace_lines;
        const lines = content.split('\n');
        if (start >= 1 && end <= lines.length && start <= end) {
          const newLines = (edit.content || '').split('\n');
          lines.splice(start - 1, end - start + 1, ...newLines);
          content = lines.join('\n');
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: replace_lines range ${start}-${end} invalid (file has ${lines.length} lines)`);
        }
      } else if (edit.search !== undefined && edit.replace !== undefined) {
        if (content.includes(edit.search)) {
          content = content.replace(edit.search, edit.replace);
          applied++;
        } else {
          const searchPreview = edit.search.substring(0, 80).replace(/\n/g, '\\n');
          errors.push(`Edit ${i + 1}: search string not found: "${searchPreview}..."`);
        }
      } else if (edit.lineNumber !== undefined && edit.newContent !== undefined) {
        const lines = content.split('\n');
        const idx = edit.lineNumber - 1;
        if (idx >= 0 && idx < lines.length) {
          lines[idx] = edit.newContent;
          content = lines.join('\n');
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: line ${edit.lineNumber} out of range (file has ${lines.length} lines)`);
        }
      } else if (edit.insertAfter !== undefined && edit.content !== undefined) {
        const idx = content.indexOf(edit.insertAfter);
        if (idx !== -1) {
          const insertPos = idx + edit.insertAfter.length;
          content = content.slice(0, insertPos) + '\n' + edit.content + content.slice(insertPos);
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: insertAfter marker not found`);
        }
      } else if (edit.insertBefore !== undefined && edit.content !== undefined) {
        const idx = content.indexOf(edit.insertBefore);
        if (idx !== -1) {
          content = content.slice(0, idx) + edit.content + '\n' + content.slice(idx);
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: insertBefore marker not found`);
        }
      } else if (edit.append !== undefined) {
        content += '\n' + edit.append;
        applied++;
      } else if (edit.prepend !== undefined) {
        content = edit.prepend + '\n' + content;
        applied++;
      } else {
        errors.push(`Edit ${i + 1}: unknown operation`);
      }
    }

    await fs.writeFile(fullPath, content, 'utf-8');

    // Update project.json timestamp
    try {
      const metaPath = path.join(projectDir, 'project.json');
      const raw = await fs.readFile(metaPath, 'utf-8');
      const meta = JSON.parse(raw);
      meta.updated = new Date().toISOString();
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
    } catch { /* no project.json */ }

    const result = {
      success: true,
      project: sanitized,
      file: filePath,
      changes_applied: applied,
      total_edits: edits.length,
      studioUrl: `/studio?project=${sanitized}`,
      message: applied === edits.length
        ? `All ${applied} edits applied successfully to ${filePath}`
        : `Applied ${applied} of ${edits.length} edits to ${filePath}. ${errors.length} failed.`
    };
    if (errors.length > 0) result.errors = errors;

    ctx.onProgress(`Edited: ${sanitized}/${filePath} — ${applied}/${edits.length} changes applied`);
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `Edit failed: ${e.message}` });
  }
}

/**
 * List all projects.
 */
export async function toolListProjects(args, ctx) {
  const dataDir = ctx.dataDir || process.cwd();
  const projectsDir = path.join(dataDir, 'projects');

  try {
    const entries = await fs.readdir(projectsDir, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const projDir = path.join(projectsDir, entry.name);
      let meta = { name: entry.name, type: 'unknown', description: '' };

      try {
        const raw = await fs.readFile(path.join(projDir, 'project.json'), 'utf-8');
        meta = { ...meta, ...JSON.parse(raw) };
      } catch { /* no project.json */ }

      try {
        const files = await fs.readdir(projDir);
        meta.fileCount = files.filter(f => f !== 'project.json').length;
      } catch { meta.fileCount = 0; }

      projects.push({
        name: meta.name,
        type: meta.type,
        description: (meta.description || '').substring(0, 100),
        fileCount: meta.fileCount,
        created: meta.created,
        updated: meta.updated,
        studioUrl: `/studio?project=${entry.name}`
      });
    }

    ctx.onProgress(`Found ${projects.length} projects`);
    return JSON.stringify({ projects, count: projects.length });
  } catch (e) {
    return JSON.stringify({ error: e.message, projects: [] });
  }
}


// ═══════════════════════════════════════════════════════
// DIRECT SITE FILE ACCESS — Read/edit actual source files
// ═══════════════════════════════════════════════════════

const BLOCKED_PATTERNS = [
  /^\.env/i, /^\.git\b/, /node_modules\b/, /package-lock\.json$/,
  /\.pem$/, /\.key$/, /\.cert$/, /\.p12$/, /\.pfx$/,
  /credentials/i, /secrets?\./i, /\.sqlite3?$/, /\.db$/,
];

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.json', '.yaml', '.yml', '.toml', '.xml', '.svg',
  '.md', '.mdx', '.txt', '.csv', '.env.example',
  '.py', '.rb', '.php', '.go', '.rs', '.java',
  '.sh', '.bash', '.zsh', '.fish',
  '.vue', '.svelte', '.astro',
  '.graphql', '.gql', '.sql',
  '.conf', '.cfg', '.ini', '.properties',
  '.dockerfile', '.gitignore', '.npmrc',
]);

function _isPathSafe(filePath) {
  if (!filePath) return false;
  const normalized = path.normalize(filePath);
  if (normalized.includes('..')) return false;
  if (path.isAbsolute(normalized)) return false;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) return false;
  }
  return true;
}

function _isTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return true;
  // Also allow extensionless files like Dockerfile, Makefile, etc.
  const base = path.basename(filePath);
  if (['Dockerfile', 'Makefile', 'Procfile', 'Gemfile', 'Rakefile'].includes(base)) return true;
  return false;
}

/**
 * List files in the site's source directory. Supports glob-like pattern matching.
 */
export async function toolListSourceFiles(args, ctx) {
  const sourceDir = ctx.subsystems?.sourceDir;
  if (!sourceDir) return JSON.stringify({ error: 'Source directory not configured. Set sourceDir in createAceServer config.' });

  const dir = args.directory || '.';
  const pattern = (args.pattern || '').toLowerCase();

  if (!_isPathSafe(dir === '.' ? 'safe' : dir)) {
    return JSON.stringify({ error: 'Invalid directory path.' });
  }

  const targetDir = dir === '.' ? sourceDir : path.join(sourceDir, dir);

  try {
    const files = await _walkDir(targetDir, sourceDir, pattern, 0, 3);
    ctx.onProgress(`Found ${files.length} files`);

    return JSON.stringify({
      success: true,
      sourceDir: path.basename(sourceDir),
      directory: dir,
      files: files.slice(0, 100),
      total: files.length,
      truncated: files.length > 100,
    });
  } catch (e) {
    return JSON.stringify({ error: `Failed to list files: ${e.message}` });
  }
}

async function _walkDir(dir, rootDir, pattern, depth, maxDepth) {
  if (depth > maxDepth) return [];
  const files = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = path.relative(rootDir, path.join(dir, entry.name));

      // Skip blocked paths
      if (!_isPathSafe(relPath)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

      if (entry.isDirectory()) {
        if (['node_modules', '.git', '.next', 'dist', 'build', '.cache', '__pycache__'].includes(entry.name)) continue;
        const subFiles = await _walkDir(path.join(dir, entry.name), rootDir, pattern, depth + 1, maxDepth);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        if (!pattern || relPath.toLowerCase().includes(pattern) || entry.name.toLowerCase().includes(pattern)) {
          const stat = await fs.stat(path.join(dir, entry.name));
          files.push({
            path: relPath,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            isText: _isTextFile(entry.name),
          });
        }
      }
    }
  } catch (e) {
    // Permission denied or inaccessible — skip
  }

  return files;
}

/**
 * Read a source file from the site's codebase.
 */
export async function toolReadSourceFile(args, ctx) {
  const sourceDir = ctx.subsystems?.sourceDir;
  if (!sourceDir) return JSON.stringify({ error: 'Source directory not configured. Set sourceDir in createAceServer config.' });

  const filePath = args.file_path;
  if (!filePath) return JSON.stringify({ error: 'file_path is required' });
  if (!_isPathSafe(filePath)) return JSON.stringify({ error: 'Invalid file path. Cannot access dotfiles, node_modules, or credentials.' });

  const fullPath = path.join(sourceDir, filePath);

  try {
    await fs.access(fullPath);
  } catch {
    return JSON.stringify({ error: `File not found: ${filePath}` });
  }

  if (!_isTextFile(filePath)) {
    const stat = await fs.stat(fullPath);
    return JSON.stringify({
      success: true,
      file: filePath,
      binary: true,
      size: stat.size,
      message: 'This is a binary file. Cannot display contents. Use edit_source_file for text files only.'
    });
  }

  try {
    const stat = await fs.stat(fullPath);
    if (stat.size > 500_000) {
      return JSON.stringify({ error: `File too large (${(stat.size / 1024).toFixed(0)} KB). Max 500 KB.` });
    }

    let content = await fs.readFile(fullPath, 'utf-8');
    const lineCount = content.split('\n').length;

    // If a line range is requested
    if (args.start_line || args.end_line) {
      const lines = content.split('\n');
      const start = Math.max(1, parseInt(args.start_line) || 1) - 1;
      const end = Math.min(lines.length, parseInt(args.end_line) || lines.length);
      content = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n');
      ctx.onProgress(`Read ${filePath} (lines ${start + 1}-${end})`);
    } else {
      // Add line numbers for files over 20 lines
      if (lineCount > 20) {
        content = content.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
      }
      ctx.onProgress(`Read ${filePath} (${lineCount} lines)`);
    }

    // Search within file if requested
    let searchResults = null;
    if (args.search) {
      const lines = content.split('\n');
      searchResults = lines
        .map((line, i) => ({ line: i + 1, text: line.replace(/^\d+: /, '') }))
        .filter(l => l.text.toLowerCase().includes(args.search.toLowerCase()))
        .slice(0, 20);
    }

    const result = {
      success: true,
      file: filePath,
      lines: lineCount,
      content: content.substring(0, 50_000),
      truncated: content.length > 50_000,
    };
    if (searchResults) result.searchResults = searchResults;

    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `Failed to read file: ${e.message}` });
  }
}

/**
 * Edit a source file in the site's codebase.
 * Same edit operations as edit_project_file: search/replace, line edit, insert, etc.
 */
export async function toolEditSourceFile(args, ctx) {
  const sourceDir = ctx.subsystems?.sourceDir;
  if (!sourceDir) return JSON.stringify({ error: 'Source directory not configured. Set sourceDir in createAceServer config.' });

  const filePath = args.file_path;
  if (!filePath || !args.edits) return JSON.stringify({ error: 'file_path and edits are required' });
  if (!_isPathSafe(filePath)) return JSON.stringify({ error: 'Invalid file path. Cannot edit dotfiles, node_modules, or credentials.' });
  if (!_isTextFile(filePath)) return JSON.stringify({ error: 'Can only edit text files.' });

  const fullPath = path.join(sourceDir, filePath);

  let edits;
  try {
    edits = typeof args.edits === 'string' ? JSON.parse(args.edits) : args.edits;
    if (!Array.isArray(edits)) edits = [edits];
  } catch (e) {
    return JSON.stringify({ error: `Invalid edits JSON: ${e.message}` });
  }

  try {
    // For new files, create with content if the edit is a single "content" operation
    let content;
    try {
      content = await fs.readFile(fullPath, 'utf-8');
    } catch {
      // File doesn't exist — check if this is a create operation
      if (edits.length === 1 && edits[0].content && !edits[0].search && !edits[0].lineNumber) {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, edits[0].content, 'utf-8');
        ctx.onProgress(`Created new file: ${filePath}`);
        return JSON.stringify({
          success: true,
          file: filePath,
          created: true,
          message: `Created new file: ${filePath}`
        });
      }
      return JSON.stringify({ error: `File not found: ${filePath}` });
    }

    let applied = 0;
    const errors = [];

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i];

      if (edit.delete_lines) {
        const { start, end } = edit.delete_lines;
        const lines = content.split('\n');
        if (start >= 1 && end <= lines.length && start <= end) {
          lines.splice(start - 1, end - start + 1);
          content = lines.join('\n');
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: delete_lines range ${start}-${end} invalid (file has ${lines.length} lines)`);
        }
      } else if (edit.replace_lines) {
        const { start, end } = edit.replace_lines;
        const lines = content.split('\n');
        if (start >= 1 && end <= lines.length && start <= end) {
          const newLines = (edit.content || '').split('\n');
          lines.splice(start - 1, end - start + 1, ...newLines);
          content = lines.join('\n');
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: replace_lines range ${start}-${end} invalid (file has ${lines.length} lines)`);
        }
      } else if (edit.search !== undefined && edit.replace !== undefined) {
        if (content.includes(edit.search)) {
          content = edit.replace_all
            ? content.replaceAll(edit.search, edit.replace)
            : content.replace(edit.search, edit.replace);
          applied++;
        } else {
          const preview = edit.search.substring(0, 80).replace(/\n/g, '\\n');
          errors.push(`Edit ${i + 1}: search string not found: "${preview}..."`);
        }
      } else if (edit.lineNumber !== undefined && edit.newContent !== undefined) {
        const lines = content.split('\n');
        const idx = edit.lineNumber - 1;
        if (idx >= 0 && idx < lines.length) {
          lines[idx] = edit.newContent;
          content = lines.join('\n');
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: line ${edit.lineNumber} out of range (file has ${lines.length} lines)`);
        }
      } else if (edit.insertAfter !== undefined && edit.content !== undefined) {
        const idx = content.indexOf(edit.insertAfter);
        if (idx !== -1) {
          const insertPos = idx + edit.insertAfter.length;
          content = content.slice(0, insertPos) + '\n' + edit.content + content.slice(insertPos);
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: insertAfter marker not found`);
        }
      } else if (edit.insertBefore !== undefined && edit.content !== undefined) {
        const idx = content.indexOf(edit.insertBefore);
        if (idx !== -1) {
          content = content.slice(0, idx) + edit.content + '\n' + content.slice(idx);
          applied++;
        } else {
          errors.push(`Edit ${i + 1}: insertBefore marker not found`);
        }
      } else if (edit.append !== undefined) {
        content += '\n' + edit.append;
        applied++;
      } else if (edit.prepend !== undefined) {
        content = edit.prepend + '\n' + content;
        applied++;
      } else {
        errors.push(`Edit ${i + 1}: unknown operation`);
      }
    }

    await fs.writeFile(fullPath, content, 'utf-8');

    const result = {
      success: true,
      file: filePath,
      changes_applied: applied,
      total_edits: edits.length,
      lines: content.split('\n').length,
      message: applied === edits.length
        ? `All ${applied} edits applied to ${filePath}`
        : `Applied ${applied}/${edits.length} edits to ${filePath}. ${errors.length} failed.`
    };
    if (errors.length > 0) result.errors = errors;

    ctx.onProgress(`Edited: ${filePath} — ${applied}/${edits.length} changes`);
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `Edit failed: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// IMAGE GENERATION — DALL-E 3 / OpenAI Images API
// ═══════════════════════════════════════════════════════

/**
 * Generate an image using AI (DALL-E 3 via OpenAI API).
 * Returns the image URL. Can optionally save to a project.
 */
export async function toolGenerateImage(args, ctx) {
  const { prompt: imagePrompt, size, style, save_to_project, save_to_source, file_name } = args;

  if (!imagePrompt) return JSON.stringify({ error: 'prompt is required — describe the image you want.' });

  // Get OpenAI key from AI manager config
  const openaiKey = ctx.subsystems?.openaiKey
    || process.env.OPENAI_API_KEY
    || process.env.OPENAI_KEY;

  if (!openaiKey) {
    return JSON.stringify({
      error: 'Image generation requires an OpenAI API key (for DALL-E 3). Add OPENAI_API_KEY to your .env file.',
      hint: 'Get a key at platform.openai.com/api-keys'
    });
  }

  ctx.onProgress('Generating image...');

  try {
    const imageSize = size || '1024x1024'; // 1024x1024, 1024x1792, 1792x1024
    const imageStyle = style || 'natural';  // natural or vivid

    const resp = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt: imagePrompt,
        n: 1,
        size: imageSize,
        style: imageStyle,
        response_format: 'url',
      }),
    });

    if (!resp.ok) {
      const errBody = await resp.text();
      const errJson = JSON.parse(errBody).error?.message || errBody;
      return JSON.stringify({ error: `DALL-E API error: ${errJson}` });
    }

    const data = await resp.json();
    const imageUrl = data.data?.[0]?.url;
    const revisedPrompt = data.data?.[0]?.revised_prompt;

    if (!imageUrl) {
      return JSON.stringify({ error: 'No image URL returned from DALL-E.' });
    }

    const result = {
      success: true,
      url: imageUrl,
      prompt: imagePrompt,
      revised_prompt: revisedPrompt,
      size: imageSize,
      style: imageStyle,
      expires: 'URL expires in ~1 hour. Download or save to a project to keep it.',
    };

    // Optionally save to a project
    if (save_to_project) {
      try {
        const imgResp = await fetch(imageUrl);
        const buffer = Buffer.from(await imgResp.arrayBuffer());
        const dataDir = ctx.dataDir || process.cwd();
        const sanitized = save_to_project.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
        const projectDir = path.join(dataDir, 'projects', sanitized);

        await fs.mkdir(path.join(projectDir, 'images'), { recursive: true });
        const fileName = file_name || `image-${Date.now()}.png`;
        const savePath = path.join(projectDir, 'images', fileName);
        await fs.writeFile(savePath, buffer);

        result.saved = true;
        result.savedPath = `images/${fileName}`;
        result.project = save_to_project;
        ctx.onProgress(`Image saved to ${save_to_project}/images/${fileName}`);
      } catch (saveErr) {
        result.saveError = `Could not save to project: ${saveErr.message}`;
      }
    }

    // Optionally save to site's source directory
    if (save_to_source && ctx.subsystems?.sourceDir) {
      try {
        if (!_isPathSafe(save_to_source)) {
          result.saveError = 'Invalid save path — must be a safe relative path within source directory.';
        } else {
          const imgResp2 = await fetch(imageUrl);
          const buffer2 = Buffer.from(await imgResp2.arrayBuffer());
          const destPath = path.join(ctx.subsystems.sourceDir, save_to_source);
          await fs.mkdir(path.dirname(destPath), { recursive: true });
          await fs.writeFile(destPath, buffer2);

          result.savedToSource = true;
          result.sourcePath = save_to_source;
          ctx.onProgress(`Image saved to source: ${save_to_source}`);
        }
      } catch (srcErr) {
        result.saveError = `Could not save to source: ${srcErr.message}`;
      }
    } else if (save_to_source && !ctx.subsystems?.sourceDir) {
      result.saveError = 'save_to_source requires sourceDir to be configured in createAceServer().';
    }

    ctx.onProgress('Image generated');
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `Image generation failed: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// CONTENT CALENDAR PLANNER
// ═══════════════════════════════════════════════════════

/**
 * Plan a content calendar — generates topic ideas with keywords, dates, and notes.
 * Saves the plan to memory (notes) so it can be recalled later.
 */
export async function toolPlanContentCalendar(args, ctx) {
  const { topic, count, timeframe, platforms } = args;

  if (!topic) return JSON.stringify({ error: 'topic is required — what niche or subject area?' });

  const postCount = Math.min(Math.max(parseInt(count) || 8, 1), 30);
  const period = timeframe || 'this month';

  ctx.onProgress(`Planning ${postCount} content pieces about "${topic}"...`);

  // Use AI to generate the content plan
  const aiManager = ctx.aiManager;
  if (!aiManager) {
    return JSON.stringify({ error: 'AI provider not available for content planning.' });
  }

  const now = new Date();
  const platformNote = platforms ? `Target platforms: ${platforms}. ` : '';

  const planPrompt = `You are a content marketing expert. Create a content calendar with exactly ${postCount} pieces of content about "${topic}" for ${period}.

${platformNote}Today's date: ${now.toISOString().split('T')[0]}

For EACH piece of content, provide:
1. **title** — Engaging, SEO-friendly title
2. **type** — "blog_post", "social_post", "video_script", "infographic", "case_study", or "newsletter"
3. **publish_date** — Suggested publish date (YYYY-MM-DD format, spread across the timeframe)
4. **keywords** — 3-5 target keywords (array)
5. **outline** — Brief 2-3 bullet point outline of what to cover
6. **cta** — Call to action for the piece
7. **notes** — Any special considerations

Respond with ONLY a valid JSON array of objects. No markdown, no explanation.`;

  try {
    const result = await aiManager.chatWithTools(
      [{ role: 'user', content: planPrompt }],
      { systemPrompt: 'You are a content strategy assistant. Respond with valid JSON only.', tools: [] }
    );

    let planText = result.text || '';
    // Strip markdown code blocks if present
    planText = planText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let plan;
    try {
      plan = JSON.parse(planText);
      if (!Array.isArray(plan)) plan = [plan];
    } catch {
      // If AI didn't return clean JSON, try to extract it
      const jsonMatch = planText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        plan = JSON.parse(jsonMatch[0]);
      } else {
        return JSON.stringify({
          success: false,
          error: 'Could not parse content plan from AI. Try again.',
          raw: planText.substring(0, 500),
        });
      }
    }

    // Enrich with status tracking
    const calendar = plan.map((item, i) => ({
      id: i + 1,
      ...item,
      status: 'planned',
    }));

    // Save to notes for later recall
    const dataDir = ctx.dataDir || process.cwd();
    const notesDir = path.join(dataDir, 'notes');
    await fs.mkdir(notesDir, { recursive: true });

    const noteKey = `content-calendar-${now.toISOString().split('T')[0]}`;
    const noteContent = {
      topic,
      created: now.toISOString(),
      timeframe: period,
      items: calendar,
    };

    await fs.writeFile(
      path.join(notesDir, `${noteKey}.json`),
      JSON.stringify(noteContent, null, 2),
      'utf-8'
    );

    ctx.onProgress(`Content calendar created: ${calendar.length} pieces planned`);

    return JSON.stringify({
      success: true,
      topic,
      timeframe: period,
      total: calendar.length,
      calendar,
      saved_as: noteKey,
      hint: 'Use recall_notes with "content calendar" to view this plan later. Use generate_blog_post to write any of these pieces.',
    });
  } catch (e) {
    return JSON.stringify({ error: `Content calendar planning failed: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// PRIVATE HELPERS
// ═══════════════════════════════════════════════════════

/**
 * Search DuckDuckGo HTML (fetch-based, no browser needed).
 */
async function _searchDuckDuckGo(query, maxResults = 10) {
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    }
  });
  if (!resp.ok) throw new Error(`DuckDuckGo HTTP ${resp.status}`);

  const html = await resp.text();
  const results = [];

  // Parse DuckDuckGo HTML results
  const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    let url = match[1];
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    const snippet = match[3].replace(/<[^>]+>/g, '').trim();
    // Extract actual URL from DuckDuckGo redirect
    if (url.includes('uddg=')) {
      const urlMatch = url.match(/uddg=([^&]+)/);
      if (urlMatch) url = decodeURIComponent(urlMatch[1]);
    }
    if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
      results.push({ title, url, snippet, source: 'duckduckgo' });
    }
  }

  // Simpler fallback regex if the main one didn't match
  if (results.length === 0) {
    const simpleRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>/gi;
    const titleRegex = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;
    const urls = [], titles = [];
    let m;
    while ((m = simpleRegex.exec(html)) !== null) {
      let u = m[1];
      if (u.includes('uddg=')) {
        const um = u.match(/uddg=([^&]+)/);
        if (um) u = decodeURIComponent(um[1]);
      }
      urls.push(u);
    }
    while ((m = titleRegex.exec(html)) !== null) {
      titles.push(m[1].replace(/<[^>]+>/g, '').trim());
    }
    for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
      if (urls[i].startsWith('http') && !urls[i].includes('duckduckgo.com')) {
        results.push({ title: titles[i] || '', url: urls[i], snippet: '', source: 'duckduckgo' });
      }
    }
  }

  return results;
}

/**
 * Sanitize a project name for use as a directory name.
 */
function _sanitizeProjectName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}


// ═══════════════════════════════════════════════════════
// TOOL REGISTRY — Maps tool names to functions
// ═══════════════════════════════════════════════════════

/**
 * Master map from tool name (as used in function calling) to implementation.
 * Import this to wire up tools in the embed server's tool-calling loop.
 */
export const TOOL_REGISTRY = {
  // Research
  web_search: toolWebSearch,
  read_webpage: toolReadWebpage,

  // Memory
  save_note: toolSaveNote,
  recall_notes: toolRecallNotes,

  // Forms
  create_form: toolCreateForm,
  list_forms: toolListForms,
  get_form_submissions: toolGetFormSubmissions,

  // Projects
  create_project: toolCreateProject,
  write_project_file: toolWriteProjectFile,
  read_project_file: toolReadProjectFile,
  edit_project_file: toolEditProjectFile,
  list_project_files: toolListProjectFiles,
  list_projects: toolListProjects,

  // Direct site file access
  list_source_files: toolListSourceFiles,
  read_source_file: toolReadSourceFile,
  edit_source_file: toolEditSourceFile,

  // Image generation
  generate_image: toolGenerateImage,

  // Content calendar
  plan_content_calendar: toolPlanContentCalendar,
};
