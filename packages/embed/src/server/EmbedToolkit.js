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

/**
 * Recall past research from memory.
 */
export async function toolRecallResearch(args, ctx) {
  if (!ctx.researchMemory) return JSON.stringify({ error: 'Research memory not available' });

  try {
    const topic = args.topic;
    let results;

    if (topic) {
      results = await ctx.researchMemory.recallResearch(topic, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        minScore: 0.3,
        limit: 5,
      });
    } else {
      results = await ctx.researchMemory.getRecentResearch?.(10) || [];
    }

    const formatted = results.map(r => {
      const ago = Math.round((Date.now() - r.timestamp) / (1000 * 60 * 60));
      const agoStr = ago < 24 ? `${ago}h ago` : `${Math.round(ago / 24)}d ago`;
      let synopsis = r.results || r.synthesis || '';
      try { synopsis = JSON.parse(synopsis).synthesis || synopsis; } catch { /* not JSON */ }
      return {
        query: r.query,
        timeAgo: agoStr,
        synopsis: String(synopsis).substring(0, 300),
        score: r.score,
      };
    });

    return JSON.stringify({ researchHistory: formatted, count: formatted.length });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

/**
 * Retrieve site memory (remembered facts about a domain).
 */
export async function toolGetSiteMemory(args, ctx) {
  const sm = ctx.subsystems.siteMemory;
  if (!sm) return JSON.stringify({ error: 'Site memory not available' });

  try {
    const memory = await sm.recall(args.domain);
    if (!memory) return JSON.stringify({ domain: args.domain, known: false });
    return JSON.stringify({ domain: args.domain, known: true, ...memory });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}


// ═══════════════════════════════════════════════════════
// EMAIL TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Send an email via Gmail SMTP.
 * Auto-generates HTML from plain text for paragraph preservation.
 * Auto-moves matching pipeline lead to "contacted" stage.
 */
export async function toolSendEmail(args, ctx) {
  const { to, subject, body, html } = args;
  ctx.onProgress(`Sending email to ${to}`);

  // Hard block: check if this email belongs to a do-not-contact lead
  const pm = ctx.subsystems.pipelineManager;
  if (pm?.pipeline?.leads) {
    const dncLead = pm.pipeline.leads.find(l =>
      l.email && l.email.toLowerCase() === to.toLowerCase() && l.do_not_contact
    );
    if (dncLead) {
      ctx.onProgress(`Blocked: ${dncLead.company} is marked do-not-contact`);
      return JSON.stringify({
        error: `Cannot email ${to} — "${dncLead.company}" is marked as do-not-contact. Remove the flag first if you want to reach out.`,
        blocked: true,
        leadId: dncLead.id,
        company: dncLead.company
      });
    }
  }

  try {
    // Dynamic import — GmailSMTPService may not be in the same relative path
    // for the embed package. The host app must provide it via ctx.subsystems.gmailService
    // or we attempt to create one.
    let smtp;
    if (ctx.subsystems.gmailService) {
      smtp = ctx.subsystems.gmailService;
    } else {
      // Try dynamic import from the main OpenAce path
      const { GmailSMTPService } = await import('./subsystems/GmailSMTPService.js');
      smtp = new GmailSMTPService();
      await smtp.initialize();
    }

    const emailOptions = { to, subject, body };
    if (html) {
      emailOptions.html = html;
    } else if (body && body.includes('\n')) {
      // Auto-generate HTML from plain text so paragraph breaks are preserved
      const htmlBody = body
        .split(/\n\n+/)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      emailOptions.html = htmlBody;
    }

    const result = await smtp.sendEmail(emailOptions);

    // Auto-move matching lead to "contacted" stage
    let leadMoved = null;
    if (pm?.pipeline?.leads) {
      const matchingLead = pm.pipeline.leads.find(l =>
        l.email && l.email.toLowerCase() === to.toLowerCase() && l.stage === 'new'
      );
      if (matchingLead) {
        try {
          await pm.moveLead(matchingLead.id, 'contacted');
          if (!matchingLead.notes) matchingLead.notes = [];
          matchingLead.notes.push(`[${new Date().toLocaleDateString()}] Emailed: ${subject}`);
          await pm.savePipeline();
          leadMoved = matchingLead.company;
          ctx.onProgress(`Lead "${matchingLead.company}" moved to Contacted`);
        } catch (e) { /* ignore move errors */ }
      }
    }

    return JSON.stringify({ success: true, to, subject, messageId: result?.messageId, leadMoved });
  } catch (e) {
    return JSON.stringify({ error: `Email failed: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// PHONE / SMS TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Send SMS via Twilio.
 * Auto-moves matching pipeline lead to "contacted" stage.
 */
export async function toolSendSMS(args, ctx) {
  const { to, body } = args;
  ctx.onProgress(`Sending SMS to ${to}`);

  try {
    const twilio = ctx.subsystems.twilioService;
    if (!twilio?.isConfigured()) {
      return JSON.stringify({ error: 'Twilio not configured. Set up in Settings > Integrations > Twilio.' });
    }

    const result = await twilio.sendSMS({ to, body });

    // Auto-move matching lead to "contacted" (same pattern as email)
    let leadMoved = null;
    const pm = ctx.subsystems.pipelineManager;
    if (pm?.pipeline?.leads) {
      const normalTo = to.replace(/\D/g, '');
      const matchingLead = pm.pipeline.leads.find(l =>
        l.phone && l.phone.replace(/\D/g, '') === normalTo && l.stage === 'new'
      );
      if (matchingLead) {
        try {
          await pm.moveLead(matchingLead.id, 'contacted');
          leadMoved = matchingLead.company;
          ctx.onProgress(`Lead "${matchingLead.company}" moved to Contacted`);
        } catch { /* ignore move errors */ }
      }
    }

    return JSON.stringify({ success: true, to, messageSid: result.messageSid, leadMoved });
  } catch (e) {
    return JSON.stringify({ error: `SMS failed: ${e.message}` });
  }
}

/**
 * Make a TTS call via Twilio.
 */
export async function toolMakeCall(args, ctx) {
  const { to, message } = args;
  ctx.onProgress(`Calling ${to} via Twilio`);

  try {
    const twilio = ctx.subsystems.twilioService;
    if (!twilio?.isConfigured()) {
      return JSON.stringify({ error: 'Twilio not configured. Set up in Settings > Integrations > Twilio.' });
    }

    const result = await twilio.makeCall({ to, message });
    return JSON.stringify({ success: true, to, callSid: result.callSid, message: 'Call initiated — message will be spoken via TTS' });
  } catch (e) {
    return JSON.stringify({ error: `Call failed: ${e.message}` });
  }
}

/**
 * Dispatch a BYO AI phone agent call (Vapi/Bland/Retell).
 */
export async function toolDispatchPhoneCall(args, ctx) {
  const { to, task } = args;
  ctx.onProgress(`Dispatching AI phone call to ${to}`);

  try {
    const twilio = ctx.subsystems.twilioService;
    if (!twilio?.isByoConfigured()) {
      return JSON.stringify({ error: 'BYO Phone Agent not configured. Set up in Settings > Integrations > Twilio > AI Phone Agent.' });
    }

    const result = await twilio.dispatchPhoneCall({ to, task });
    return JSON.stringify({ success: true, to, callId: result.callId, provider: result.provider, message: 'AI agent call dispatched' });
  } catch (e) {
    return JSON.stringify({ error: `Dispatch failed: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// PIPELINE / LEAD TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Find leads using the LeadFinder engine (fetch-based, no browser).
 */
export async function toolFindLeads(args, ctx) {
  const { industry, location, count: rawCount } = args;
  const count = Math.min(Math.max(parseInt(rawCount) || 5, 1), 20);

  ctx.onProgress(`Finding ${count} ${industry} businesses in ${location}...`);

  try {
    const { LeadFinder } = await import('./subsystems/LeadFinder.js');
    const finder = new LeadFinder({
      config: ctx.config || {},
      onProgress: ctx.onProgress,
    });

    const leads = await finder.findLeads(industry, location, count);

    // Filter out generated fallback leads — only return real scraped results
    const realLeads = leads.filter(l => l.source !== 'generated_fallback');

    if (realLeads.length === 0) {
      return JSON.stringify({
        success: false,
        industry,
        location,
        leads: [],
        message: `Could not find real ${industry} businesses in ${location}. Try a more specific location or different industry term.`
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
      hint: 'Use save_leads to add these to the pipeline. Present the results to the user first.'
    });
  } catch (e) {
    console.error(`[EmbedToolkit] find_leads error:`, e.message);
    return JSON.stringify({
      success: false,
      error: `Lead search failed: ${e.message}`,
      hint: 'Try web_search with a Google query like "plumbers in Austin TX" as a fallback.'
    });
  }
}

/**
 * Save leads to the pipeline with validation and dedup.
 */
export async function toolSaveLeads(args, ctx) {
  const pm = ctx.subsystems.pipelineManager;
  if (!pm) return JSON.stringify({ error: 'Pipeline not available' });

  const leads = args.leads || [];
  const saved = [];
  const existingLeads = pm.pipeline?.leads || [];

  for (const lead of leads) {
    // Quality validation — reject fabricated/placeholder leads
    const rejection = _validateLead(lead);
    if (rejection) {
      saved.push({ status: 'rejected', company: lead.company || '(no name)', reason: rejection });
      continue;
    }

    // Dedup check — skip if company name or email already in pipeline
    const normName = (lead.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isDupe = existingLeads.some(existing => {
      const existingNorm = (existing.company || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normName && existingNorm && normName === existingNorm) return true;
      if (lead.email && existing.email && lead.email.toLowerCase() === existing.email.toLowerCase()) return true;
      return false;
    });
    if (isDupe) {
      saved.push({ status: 'skipped', company: lead.company, reason: 'duplicate' });
      continue;
    }

    try {
      const result = await pm.addLead({
        company: lead.company,
        contact_name: lead.contact_name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        website: lead.website || '',
        source: lead.source || 'research',
        notes: lead.notes ? [lead.notes] : [],
      });
      saved.push({
        status: 'saved',
        id: result.id,
        company: result.company || lead.company,
        email: result.email || lead.email || '',
        contact_name: result.contact_name || lead.contact_name || ''
      });
    } catch (e) {
      saved.push({ status: 'failed', company: lead.company, error: e.message });
    }
  }

  ctx.onProgress(`Processed ${saved.length} leads`);

  // Check if there's an active goal covering this work
  const gt = ctx.subsystems.goalTracker;
  const actualSaved = saved.filter(s => s.status === 'saved').length;
  let goalHint = null;

  if (gt && actualSaved > 0) {
    const activeGoals = gt.getActiveGoals();
    const hasRelevantGoal = activeGoals.some(g =>
      g.type === 'lead_gen' || g.description.toLowerCase().includes('lead')
    );

    if (hasRelevantGoal) {
      goalHint = `You have an active lead-gen mission. Update its progress with manage_goals (progress_increment: ${actualSaved}).`;
    } else if (actualSaved >= 3) {
      goalHint = `You just saved ${actualSaved} leads but have no active lead-gen mission. Consider asking the user if they want to track this as an ongoing mission.`;
    }
  }

  const rejected = saved.filter(s => s.status === 'rejected').length;
  const skipped = saved.filter(s => s.status === 'skipped').length;
  const failed = saved.filter(s => s.status === 'failed').length;
  const result = {
    success: actualSaved > 0,
    savedCount: actualSaved,
    rejected,
    skipped,
    failed,
    total: leads.length,
    leads: saved,
  };
  if (goalHint) result.goal_hint = goalHint;
  return JSON.stringify(result);
}

/**
 * Get pipeline data (leads and/or tasks).
 */
export async function toolGetPipeline(args, ctx) {
  const pm = ctx.subsystems.pipelineManager;
  if (!pm) return JSON.stringify({ error: 'Pipeline not available' });

  const type = args.type || 'all';
  const pipeline = pm.pipeline || { items: [], leads: [] };

  const formatLead = (l) => ({
    id: l.id,
    company: l.company,
    contact_name: l.contact_name || '',
    email: l.email || '',
    phone: l.phone || '',
    website: l.website || '',
    stage: l.stage || 'new',
    notes: l.notes || []
  });

  if (type === 'leads') {
    return JSON.stringify({
      leads: pipeline.leads.slice(-30).map(formatLead),
      totalLeads: pipeline.leads.length
    });
  } else if (type === 'tasks') {
    return JSON.stringify({ tasks: pipeline.items.slice(-20), totalTasks: pipeline.items.length });
  }
  return JSON.stringify({
    tasks: pipeline.items.slice(-10),
    leads: pipeline.leads.slice(-20).map(formatLead),
    totalTasks: pipeline.items.length,
    totalLeads: pipeline.leads.length
  });
}

/**
 * Move a lead to a new pipeline stage.
 */
export async function toolMoveLead(args, ctx) {
  const pm = ctx.subsystems.pipelineManager;
  if (!pm) return JSON.stringify({ error: 'Pipeline not available' });

  const { lead_id, stage, note } = args;
  const validStages = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
  if (!validStages.includes(stage)) {
    return JSON.stringify({ error: `Invalid stage "${stage}". Valid: ${validStages.join(', ')}` });
  }

  // Allow finding lead by company name if lead_id doesn't look like an ID
  let resolvedId = lead_id;
  if (lead_id && !lead_id.startsWith('lead-')) {
    const leads = pm.pipeline?.leads || [];
    const match = leads.find(l =>
      (l.company || '').toLowerCase().includes(lead_id.toLowerCase()) ||
      (l.contact_name || '').toLowerCase().includes(lead_id.toLowerCase())
    );
    if (match) {
      resolvedId = match.id;
    } else {
      return JSON.stringify({
        error: `Lead "${lead_id}" not found. Use get_pipeline to see all leads with their IDs.`
      });
    }
  }

  try {
    await pm.moveLead(resolvedId, stage);
    // Add note if provided
    if (note && pm.pipeline) {
      const lead = pm.pipeline.leads.find(l => l.id === resolvedId);
      if (lead) {
        if (!lead.notes) lead.notes = [];
        lead.notes.push(`[${new Date().toLocaleDateString()}] ${note}`);
        await pm.savePipeline();
      }
    }
    ctx.onProgress(`Lead moved to "${stage}"`);
    return JSON.stringify({ success: true, lead_id: resolvedId, newStage: stage });
  } catch (e) {
    return JSON.stringify({
      error: `${e.message}. Use get_pipeline to see all leads with their correct IDs.`
    });
  }
}

/**
 * Set or clear do-not-contact flag on a lead.
 */
export async function toolSetLeadDNC(args, ctx) {
  const pm = ctx.subsystems.pipelineManager;
  if (!pm) return JSON.stringify({ error: 'Pipeline not available' });

  const { lead_id, do_not_contact, reason } = args;
  try {
    const lead = await pm.setDoNotContact(lead_id, do_not_contact, reason);
    const status = do_not_contact ? 'protected from outreach' : 'cleared for outreach';
    ctx.onProgress(`"${lead.company}" ${status}`);
    return JSON.stringify({ success: true, lead_id, company: lead.company, do_not_contact: lead.do_not_contact, status });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}


// ═══════════════════════════════════════════════════════
// CONTACTS
// ═══════════════════════════════════════════════════════

/**
 * Add, search, or list contacts.
 */
export async function toolManageContacts(args, ctx) {
  const cm = ctx.subsystems.contactManager;
  if (!cm) return JSON.stringify({ error: 'Contact manager not available' });

  const { action, name, email, phone, query } = args;

  if (action === 'add') {
    if (!name || !email) return JSON.stringify({ error: 'Name and email required to add contact' });
    try {
      const contact = cm.addContact({ name, email, phone: phone || null, source: 'ace' });
      await cm.save();
      return JSON.stringify({ success: true, contact: { name: contact.name, email: contact.email } });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  }

  if (action === 'search') {
    const results = cm.searchContacts(query || name || '');
    return JSON.stringify({ results: results.slice(0, 10).map(c => ({ name: c.name, email: c.email, phone: c.phone })) });
  }

  if (action === 'list') {
    return JSON.stringify({ contacts: cm.contacts.slice(0, 20).map(c => ({ name: c.name, email: c.email })), total: cm.contacts.length });
  }

  return JSON.stringify({ error: `Unknown action: ${action}` });
}


// ═══════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════

/**
 * Schedule a recurring task (briefing or SOP).
 */
export async function toolScheduleTask(args, ctx) {
  const scheduler = ctx.subsystems.autonomousScheduler;
  if (!scheduler) return JSON.stringify({ error: 'Scheduler not available' });

  try {
    // Parse time — default to 09:00, validate HH:MM format
    const time = args.time || '09:00';
    if (args.time && !/^\d{1,2}:\d{2}$/.test(args.time)) {
      return JSON.stringify({ error: `Invalid time format "${args.time}". Must be HH:MM 24-hour format like "09:00" or "14:30".` });
    }

    // Parse days — convert day names to numbers (0=Sun, 1=Mon, ... 6=Sat)
    const dayMap = { sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6 };
    let days = [1, 2, 3, 4, 5]; // default weekdays
    if (args.days) {
      const daysStr = args.days.toLowerCase().trim();
      if (daysStr === 'every day' || daysStr === 'daily' || daysStr === 'all') {
        days = [0, 1, 2, 3, 4, 5, 6];
      } else if (daysStr === 'weekdays' || daysStr === 'weekday') {
        days = [1, 2, 3, 4, 5];
      } else if (daysStr === 'weekends' || daysStr === 'weekend') {
        days = [0, 6];
      } else {
        const parsed = daysStr.split(/[,\s]+/).map(d => dayMap[d.trim()]).filter(d => d !== undefined);
        if (parsed.length > 0) days = parsed;
      }
    }

    // Determine type and build routine config
    const routineType = (args.type || 'briefing').toLowerCase();
    const routineConfig = {
      name: args.name,
      time,
      days,
      type: routineType === 'sop' ? 'sop' : 'briefing',
      enabled: true,
      sendToTelegram: args.send_to_telegram !== false,
      delivery: args.delivery || (args.send_to_telegram === false ? 'dashboard' : 'both'),
    };

    if (routineType === 'sop') {
      routineConfig.sopIds = [args.action];
      routineConfig.description = `Run SOP: ${args.action}`;
    } else {
      routineConfig.prompt = args.action;
      routineConfig.description = args.action;
    }

    const routine = await scheduler.addRoutine(routineConfig);

    if (!routine?.id) {
      return JSON.stringify({ success: false, error: 'Routine was not saved — scheduler returned no ID. Please try again.' });
    }

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayDisplay = days.map(d => dayNames[d]).join(', ');

    return JSON.stringify({
      success: true,
      id: routine.id,
      name: args.name,
      type: routineConfig.type,
      time,
      days: dayDisplay,
      action: args.action,
      message: `Scheduled "${args.name}" to run at ${time} on ${dayDisplay}.`
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}


// ═══════════════════════════════════════════════════════
// GOALS / MISSIONS
// ═══════════════════════════════════════════════════════

/**
 * Add, update, list, or complete goals/missions.
 */
export async function toolManageGoals(args, ctx) {
  const gt = ctx.subsystems.goalTracker;
  if (!gt) return JSON.stringify({ error: 'Goal tracker not available' });

  try {
    const action = (args.action || '').toLowerCase();

    if (action === 'add') {
      const target = args.target_count ? {
        count: args.target_count,
        unit: args.target_unit || 'items',
        per: args.target_per || 'day'
      } : null;

      const goal = await gt.addGoal({
        description: args.description || 'Untitled goal',
        type: args.type || 'custom',
        target,
        criteria: args.criteria || '',
        nextAction: args.next_action || null
      });

      ctx.onProgress(`New mission: ${goal.description}`);
      return JSON.stringify({
        success: true,
        goal,
        message: `Mission created: "${goal.description}"${target ? ` (Target: ${target.count} ${target.unit}/${target.per})` : ''}`
      });
    }

    if (action === 'update_progress') {
      if (!args.goal_id) {
        // Try to find the most relevant active goal
        const active = gt.getActiveGoals();
        if (active.length === 1) args.goal_id = active[0].id;
        else return JSON.stringify({ error: 'Multiple active goals — specify goal_id', goals: active.map(g => ({ id: g.id, description: g.description })) });
      }

      const goal = await gt.updateProgress(args.goal_id, args.progress_increment || 1, args.note || '');
      if (!goal) return JSON.stringify({ error: `Goal not found: ${args.goal_id}` });

      ctx.onProgress(`Progress: ${goal.description} → ${goal.progress.current}${goal.target ? '/' + goal.target.count : ''}`);
      return JSON.stringify({
        success: true,
        goal_id: goal.id,
        progress: goal.progress.current,
        target: goal.target?.count || null,
        status: goal.status,
        message: `Progress updated: ${goal.progress.current}${goal.target ? '/' + goal.target.count + ' ' + goal.target.unit : ''}`
      });
    }

    if (action === 'list') {
      const goals = gt.getAllGoals();
      return JSON.stringify({
        success: true,
        total: goals.length,
        active: goals.filter(g => g.status === 'active').length,
        goals: goals.map(g => ({
          id: g.id,
          description: g.description,
          type: g.type,
          status: g.status,
          progress: g.progress.current,
          target: g.target,
          nextAction: g.nextAction
        }))
      });
    }

    if (action === 'complete') {
      if (!args.goal_id) return JSON.stringify({ error: 'goal_id required for complete' });
      const goal = await gt.completeGoal(args.goal_id);
      if (!goal) return JSON.stringify({ error: `Goal not found: ${args.goal_id}` });
      ctx.onProgress(`Mission complete: ${goal.description}`);
      return JSON.stringify({ success: true, message: `Mission completed: "${goal.description}"` });
    }

    if (action === 'update') {
      if (!args.goal_id) return JSON.stringify({ error: 'goal_id required for update' });
      const updates = {};
      if (args.next_action) updates.nextAction = args.next_action;
      if (args.description) updates.description = args.description;
      if (args.criteria) updates.criteria = args.criteria;
      const goal = await gt.updateGoal(args.goal_id, updates);
      if (!goal) return JSON.stringify({ error: `Goal not found: ${args.goal_id}` });
      return JSON.stringify({ success: true, goal_id: goal.id, message: `Goal updated: "${goal.description}"` });
    }

    if (action === 'record_suggestion') {
      const accepted = args.accepted !== false && args.accepted !== 'false';
      await gt.recordSuggestionResponse(accepted);
      const behavior = gt.getSuggestionBehavior();
      return JSON.stringify({
        success: true,
        accepted,
        currentBehavior: behavior,
        message: accepted
          ? 'Noted — user likes goal tracking. Will keep suggesting.'
          : 'Noted — user declined. Will reduce suggestions.'
      });
    }

    return JSON.stringify({ error: `Unknown action: ${action}. Use add, update_progress, list, complete, update, or record_suggestion.` });
  } catch (e) {
    return JSON.stringify({ error: e.message });
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
// CALENDAR TOOLS (Google Calendar)
// ═══════════════════════════════════════════════════════

/**
 * List upcoming Google Calendar events.
 */
export async function toolListCalendarEvents(args, ctx) {
  const google = ctx.subsystems.google;
  if (!google) return JSON.stringify({ error: 'Google integration not available' });
  if (!google.isConnected()) return JSON.stringify({ error: 'Google account not connected. Go to Settings > Google to connect.' });

  try {
    const events = await google.listEvents({
      maxResults: args.max_results || 10,
      timeMin: args.time_min || new Date().toISOString(),
    });

    const formatted = events.map(e => ({
      id: e.id,
      title: e.summary || '(No title)',
      start: e.start?.dateTime || e.start?.date || '',
      end: e.end?.dateTime || e.end?.date || '',
      location: e.location || '',
      description: (e.description || '').substring(0, 200),
      attendees: (e.attendees || []).map(a => a.email).slice(0, 10),
      meetLink: e.hangoutLink || '',
      status: e.status,
    }));

    ctx.onProgress(`Found ${formatted.length} upcoming events`);
    return JSON.stringify({ events: formatted, count: formatted.length });
  } catch (e) {
    return JSON.stringify({ error: `Calendar error: ${e.message}` });
  }
}

/**
 * Create a Google Calendar event with optional attendees and Meet link.
 */
export async function toolCreateCalendarEvent(args, ctx) {
  const google = ctx.subsystems.google;
  if (!google) return JSON.stringify({ error: 'Google integration not available' });
  if (!google.isConnected()) return JSON.stringify({ error: 'Google account not connected. Go to Settings > Google to connect.' });

  const { title, start_time, end_time, duration_minutes, description, attendees, add_meet_link, send_invites } = args;

  try {
    // Parse attendees from comma-separated string
    let attendeeList = [];
    if (attendees) {
      attendeeList = attendees.split(',').map(e => e.trim()).filter(e => e.includes('@'));
    }

    let result;
    if (end_time) {
      result = await google.createEvent({
        title,
        startTime: start_time,
        endTime: end_time,
        description: description || '',
        attendees: attendeeList,
        addMeetLink: add_meet_link !== false,
        sendInvites: send_invites || false,
      });
    } else {
      result = await google.scheduleMeeting(
        title,
        start_time,
        duration_minutes || 60,
        attendeeList
      );
    }

    ctx.onProgress(`Created: "${title}"`);
    return JSON.stringify({
      success: true,
      event_id: result.eventId,
      title,
      start: result.start,
      end: result.end,
      meet_link: result.meetLink || '',
      html_link: result.htmlLink || '',
      message: `Event "${title}" created!${result.meetLink ? ` Meet link: ${result.meetLink}` : ''}`
    });
  } catch (e) {
    return JSON.stringify({ error: `Failed to create event: ${e.message}` });
  }
}

/**
 * Delete a Google Calendar event by ID.
 */
export async function toolDeleteCalendarEvent(args, ctx) {
  const google = ctx.subsystems.google;
  if (!google) return JSON.stringify({ error: 'Google integration not available' });
  if (!google.isConnected()) return JSON.stringify({ error: 'Google account not connected. Go to Settings > Google to connect.' });

  const { event_id } = args;
  if (!event_id) return JSON.stringify({ error: 'event_id is required' });

  try {
    await google.deleteEvent(event_id);
    ctx.onProgress('Event deleted');
    return JSON.stringify({ success: true, deleted: event_id, message: 'Event deleted and attendees notified.' });
  } catch (e) {
    return JSON.stringify({ error: `Failed to delete event: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// SOCIAL MEDIA TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Post content to social media platforms immediately.
 */
export async function toolPostSocialMedia(args, ctx) {
  const social = ctx.subsystems.socialMedia;
  if (!social) return JSON.stringify({ error: 'Social media system not available' });

  const { content, media_path } = args;
  const platforms = (args.platforms || 'twitter').split(',').map(p => p.trim());

  ctx.onProgress(`Posting to ${platforms.join(', ')}${media_path ? ' with media' : ''}`);

  try {
    const result = await social.postNow(content, platforms, { mediaPath: media_path });

    const summary = {};
    for (const [platform, res] of Object.entries(result)) {
      summary[platform] = res.success ? 'posted' : `failed: ${res.error || 'unknown'}`;
    }

    const succeeded = Object.keys(summary).filter(k => summary[k] === 'posted');
    const failed = Object.keys(summary).filter(k => summary[k] !== 'posted');
    ctx.onProgress('Post complete');
    return JSON.stringify({
      success: succeeded.length > 0,
      partial: succeeded.length > 0 && failed.length > 0,
      content: content.substring(0, 100),
      platforms: summary,
      media: media_path || null,
      message: failed.length > 0
        ? `Posted to ${succeeded.join(', ') || 'none'}. Failed on: ${failed.join(', ')}.`
        : `Posted to ${succeeded.join(', ')}.`
    });
  } catch (e) {
    return JSON.stringify({ error: `Social post failed: ${e.message}` });
  }
}

/**
 * Schedule a social media post for a future time.
 */
export async function toolScheduleSocialPost(args, ctx) {
  const social = ctx.subsystems.socialMedia;
  if (!social) return JSON.stringify({ error: 'Social media system not available' });

  const { content, scheduled_time, media_path } = args;
  const platforms = (args.platforms || 'twitter').split(',').map(p => p.trim());

  // Validate scheduled_time is a valid ISO date
  const parsedDate = new Date(scheduled_time);
  if (isNaN(parsedDate.getTime())) {
    return JSON.stringify({ error: `Invalid scheduled_time "${scheduled_time}". Must be ISO 8601 format like "2026-03-14T09:00:00". Calculate the exact date from today's date.` });
  }
  if (parsedDate < new Date()) {
    return JSON.stringify({ error: `scheduled_time "${scheduled_time}" is in the past. Use a future date.` });
  }

  ctx.onProgress(`Scheduling post for ${scheduled_time}${media_path ? ' with media' : ''}`);

  try {
    const results = [];
    for (const platform of platforms) {
      const result = await social.schedulePost({
        content,
        platform,
        scheduledDateTime: scheduled_time,
        mediaPath: media_path || null,
      });
      results.push(result);
    }

    ctx.onProgress('Post scheduled');
    return JSON.stringify({
      success: true,
      content: content.substring(0, 100),
      platforms,
      scheduled_time,
      media: media_path || null,
      posts_created: results.length,
      message: `Post scheduled for ${scheduled_time} on ${platforms.join(', ')}${media_path ? ' with media attached' : ''}`
    });
  } catch (e) {
    return JSON.stringify({ error: `Schedule failed: ${e.message}` });
  }
}

/**
 * Batch-schedule a content plan with multiple posts across platforms.
 */
export async function toolCreateContentPlan(args, ctx) {
  const social = ctx.subsystems.socialMedia;
  if (!social) return JSON.stringify({ error: 'Social media system not available' });

  let posts;
  try {
    posts = JSON.parse(args.posts_json);
  } catch (e) {
    return JSON.stringify({ error: `Invalid JSON in posts_json: ${e.message}` });
  }

  if (!Array.isArray(posts) || posts.length === 0) {
    return JSON.stringify({ error: 'posts_json must be a non-empty array of posts' });
  }

  ctx.onProgress(`Creating content plan with ${posts.length} posts`);

  const results = [];
  let successCount = 0;

  for (const post of posts) {
    try {
      if (!post.content || !post.platform || !post.scheduled_time) {
        results.push({ error: 'Missing required fields (content, platform, scheduled_time)', post: post.content?.substring(0, 50) });
        continue;
      }

      const postDate = new Date(post.scheduled_time);
      if (isNaN(postDate.getTime())) {
        results.push({ error: `Invalid scheduled_time "${post.scheduled_time}" — must be ISO 8601`, post: post.content?.substring(0, 50) });
        continue;
      }

      const scheduled = await social.schedulePost({
        content: post.content,
        platform: post.platform,
        scheduledDateTime: post.scheduled_time,
        mediaPath: post.media_path || null,
        hashtags: post.hashtags ? post.hashtags.split(/\s+/).filter(h => h.startsWith('#')) : [],
      });

      successCount++;
      results.push({
        success: true,
        id: scheduled.id,
        platform: post.platform,
        time: post.scheduled_time,
        has_media: !!post.media_path,
        preview: post.content.substring(0, 80)
      });
    } catch (e) {
      results.push({
        error: e.message,
        platform: post.platform,
        time: post.scheduled_time
      });
    }
  }

  ctx.onProgress(`Content plan created: ${successCount}/${posts.length} posts scheduled`);

  const allSucceeded = successCount === posts.length;
  return JSON.stringify({
    success: allSucceeded,
    partial: !allSucceeded && successCount > 0,
    total_requested: posts.length,
    total_scheduled: successCount,
    total_failed: posts.length - successCount,
    posts: results,
    message: allSucceeded
      ? `Content plan created! ${successCount} posts scheduled across platforms.`
      : `Content plan partially created: ${successCount}/${posts.length} posts scheduled. ${posts.length - successCount} failed — check the posts array for error details.`
  });
}

/**
 * Smart media picker — select photos/videos from workload store by theme.
 */
export async function toolSelectMediaForContent(args, ctx) {
  const store = ctx.subsystems.workloadStore;
  if (!store) return JSON.stringify({ error: 'Workload store not available — no media library' });

  const { theme, photo_count = 0, video_count = 0 } = args;
  const totalNeeded = (photo_count || 0) + (video_count || 0);

  if (totalNeeded === 0) {
    return JSON.stringify({ error: 'Specify photo_count and/or video_count' });
  }

  // Get all media
  const allImages = store.getMedia({ type: 'image' });
  const allVideos = store.getMedia({ type: 'video' });

  // Score media by theme relevance (tag matching + filename matching)
  const themeWords = theme.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  const scoreMedia = (item) => {
    let score = 0;
    const allText = `${item.filename} ${(item.tags || []).join(' ')} ${item.description || ''}`.toLowerCase();
    for (const word of themeWords) {
      if (allText.includes(word)) score += 2;
      for (const tag of (item.tags || [])) {
        if (tag.includes(word) || word.includes(tag)) score += 1;
      }
    }
    // Add randomness so same media isn't always picked
    score += Math.random() * 0.5;
    return score;
  };

  // Score and sort
  const scoredImages = allImages.map(m => ({ ...m, _score: scoreMedia(m) }))
    .sort((a, b) => b._score - a._score);
  const scoredVideos = allVideos.map(m => ({ ...m, _score: scoreMedia(m) }))
    .sort((a, b) => b._score - a._score);

  // Select top matches
  const selectedPhotos = scoredImages.slice(0, photo_count || 0);
  const selectedVideos = scoredVideos.slice(0, video_count || 0);
  const selected = [...selectedPhotos, ...selectedVideos];

  if (selected.length === 0) {
    return JSON.stringify({
      error: 'No matching media found',
      available_images: allImages.length,
      available_videos: allVideos.length,
      suggestion: 'Add media files to the workload media folder and scan them.'
    });
  }

  return JSON.stringify({
    success: true,
    theme,
    selected: selected.map(m => ({
      id: m.id,
      filename: m.filename,
      path: m.path,
      type: m.type,
      tags: m.tags,
      description: m.description,
      relevance_score: Math.round(m._score * 10) / 10
    })),
    photos_selected: selectedPhotos.length,
    videos_selected: selectedVideos.length,
    photos_available: allImages.length,
    videos_available: allVideos.length,
    tip: 'Use the "path" field as media_path when scheduling posts via schedule_social_post or create_content_plan.'
  });
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
// WORKLOAD / KNOWLEDGE TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Search ingested workload files using TF-IDF.
 */
export async function toolSearchWorkload(args, ctx) {
  const store = ctx.subsystems.workloadStore;
  if (!store) return JSON.stringify({ error: 'Workload store not available' });

  try {
    const { query, source, file_type } = args;
    let results;

    if (source) {
      const sources = store.getSources();
      const match = sources.find(s => s.name.toLowerCase().includes(source.toLowerCase()));
      if (match) {
        results = await store.searchBySource(match.id, query);
      } else {
        results = await store.search(query, 5);
      }
    } else if (file_type) {
      results = await store.searchByFileType(file_type, query);
    } else {
      results = await store.search(query, 5);
    }

    ctx.onProgress(`Found ${results.length} relevant chunks in workload store`);
    return JSON.stringify({
      results: results.map(r => ({
        filePath: r.filePath,
        sourceName: r.sourceName,
        fileType: r.fileType,
        content: r.content?.substring(0, 1500),
        relevance: r.relevance,
        metadata: r.metadata
      })),
      count: results.length
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

/**
 * List all workload sources and stats.
 */
export async function toolListWorkloadSources(args, ctx) {
  const store = ctx.subsystems.workloadStore;
  if (!store) return JSON.stringify({ error: 'Workload store not available' });

  try {
    const sources = store.getSources();
    const stats = store.getStats();
    return JSON.stringify({ sources, stats });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}

/**
 * List media files from the workload store.
 */
export async function toolListMedia(args, ctx) {
  const store = ctx.subsystems.workloadStore;
  if (!store) return JSON.stringify({ error: 'Workload store not available' });

  try {
    const media = store.getMedia({ type: args.type, tag: args.tag });
    return JSON.stringify({
      media: media.map(m => ({
        id: m.id,
        filename: m.filename,
        path: m.path,
        type: m.type,
        size: m.sizeFormatted,
        tags: m.tags,
        description: m.description
      })),
      count: media.length,
      tip: 'Use the file path when attaching media to social posts or emails.'
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
}


// ═══════════════════════════════════════════════════════
// DEPLOY TOOLS
// ═══════════════════════════════════════════════════════

/**
 * Deploy a project to a target (netlify, firebase, sftp, local).
 */
export async function toolDeployProject(args, ctx) {
  const dp = ctx.subsystems.deployPipeline;
  if (!dp) return JSON.stringify({ error: 'Deploy pipeline not available' });

  const { project_name, target } = args;
  const deployTarget = target || 'local';

  ctx.onProgress(`Deploying "${project_name}" to ${deployTarget}`);

  try {
    const result = await dp.deploy(project_name, deployTarget);

    if (result.success) {
      ctx.onProgress(`Deployed to: ${result.url}`);
      return JSON.stringify({
        success: true,
        project: project_name,
        target: deployTarget,
        url: result.url,
        logs: (result.logs || []).slice(-5),
        message: `Project "${project_name}" deployed to ${deployTarget}! URL: ${result.url}`
      });
    }

    return JSON.stringify({
      success: false,
      project: project_name,
      target: deployTarget,
      logs: result.logs || [],
      error: result.logs?.slice(-1)[0] || 'Deploy failed'
    });
  } catch (e) {
    return JSON.stringify({ error: `Deploy failed: ${e.message}` });
  }
}


// ═══════════════════════════════════════════════════════
// SEO TOOLS (stubs — check subsystem availability)
// ═══════════════════════════════════════════════════════

/**
 * Analyze SEO for a URL or project page.
 */
export async function toolAnalyzeSeo(args, ctx) {
  const seo = ctx.subsystems.seoEngine;
  if (!seo) return JSON.stringify({ error: 'SEO engine not available. This feature requires the SEO subsystem.' });

  try {
    const result = await seo.analyze(args.url || args.page_url);
    ctx.onProgress('SEO analysis complete');
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `SEO analysis failed: ${e.message}` });
  }
}

/**
 * Generate a blog post on a given topic.
 */
export async function toolGenerateBlogPost(args, ctx) {
  const seo = ctx.subsystems.seoEngine;
  if (!seo) return JSON.stringify({ error: 'SEO engine not available. This feature requires the SEO subsystem.' });

  try {
    const result = await seo.generateBlogPost({
      topic: args.topic,
      keywords: args.keywords,
      tone: args.tone || 'professional',
      length: args.length || 'medium',
    });
    ctx.onProgress('Blog post generated');
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `Blog generation failed: ${e.message}` });
  }
}

/**
 * Optimize on-page SEO for a specific page.
 */
export async function toolOptimizePageSeo(args, ctx) {
  const seo = ctx.subsystems.seoEngine;
  if (!seo) return JSON.stringify({ error: 'SEO engine not available. This feature requires the SEO subsystem.' });

  try {
    const result = await seo.optimizePage({
      project_name: args.project_name,
      file_path: args.file_path,
      target_keywords: args.target_keywords,
    });
    ctx.onProgress('Page SEO optimized');
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `SEO optimization failed: ${e.message}` });
  }
}

/**
 * Generate structured data (JSON-LD schema) for a page.
 */
export async function toolGenerateStructuredData(args, ctx) {
  const seo = ctx.subsystems.seoEngine;
  if (!seo) return JSON.stringify({ error: 'SEO engine not available. This feature requires the SEO subsystem.' });

  try {
    const result = await seo.generateStructuredData({
      page_type: args.page_type,
      business_info: args.business_info,
    });
    ctx.onProgress('Structured data generated');
    return JSON.stringify(result);
  } catch (e) {
    return JSON.stringify({ error: `Schema generation failed: ${e.message}` });
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
 * Validate a lead — reject fabricated/placeholder leads.
 * Returns a rejection reason string, or null if valid.
 */
function _validateLead(lead) {
  const name = (lead.company || '').trim();

  // Must have a company name
  if (!name || name.length < 3) return 'Missing company name';

  // Reject generic placeholder patterns: "Firm A", "Company B", "Business 1"
  if (/\b(firm|company|business|corp|group|agency)\s+[a-z0-9]{1,2}$/i.test(name)) {
    return 'Generic placeholder name detected';
  }

  // Reject "[City] [Industry] Firm [Letter]" pattern (e.g. "Dallas Real Estate Firm A")
  if (/^[A-Z][a-z]+\s+(Real Estate|Marketing|Tech|Software|Consulting|Insurance|Financial)\s+(Firm|Company|Business|Corp|Agency|Group)\s+[A-Z0-9]$/i.test(name)) {
    return 'Fabricated company name pattern';
  }

  // Reject "Example" or "Test" companies
  if (/^(example|test|sample|placeholder|dummy|fake)\b/i.test(name)) {
    return 'Test/example company name';
  }

  // Must have at least ONE real contact field (email, phone, or website)
  const hasEmail = lead.email && lead.email.includes('@') && lead.email.includes('.');
  const hasPhone = lead.phone && /\d{7,}/.test(lead.phone.replace(/\D/g, ''));
  const hasWebsite = lead.website && /\.\w{2,}/.test(lead.website);

  if (!hasEmail && !hasPhone && !hasWebsite) {
    return 'No valid contact info (need email, phone, or website)';
  }

  return null; // Valid lead
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
  recall_research: toolRecallResearch,
  get_site_memory: toolGetSiteMemory,

  // Email
  send_email: toolSendEmail,

  // Phone / SMS
  send_sms: toolSendSMS,
  make_call: toolMakeCall,
  dispatch_phone_call: toolDispatchPhoneCall,

  // Pipeline
  find_leads: toolFindLeads,
  save_leads: toolSaveLeads,
  get_pipeline: toolGetPipeline,
  move_lead: toolMoveLead,
  set_lead_dnc: toolSetLeadDNC,

  // Contacts
  manage_contacts: toolManageContacts,

  // Scheduler
  schedule_task: toolScheduleTask,

  // Goals
  manage_goals: toolManageGoals,

  // Memory
  save_note: toolSaveNote,
  recall_notes: toolRecallNotes,

  // Calendar
  list_calendar_events: toolListCalendarEvents,
  create_calendar_event: toolCreateCalendarEvent,
  delete_calendar_event: toolDeleteCalendarEvent,

  // Social
  post_social_media: toolPostSocialMedia,
  schedule_social_post: toolScheduleSocialPost,
  create_content_plan: toolCreateContentPlan,
  select_media_for_content: toolSelectMediaForContent,

  // Forms
  create_form: toolCreateForm,
  list_forms: toolListForms,
  get_form_submissions: toolGetFormSubmissions,

  // Projects
  create_project: toolCreateProject,
  write_project_file: toolWriteProjectFile,
  list_project_files: toolListProjectFiles,
  read_project_file: toolReadProjectFile,
  edit_project_file: toolEditProjectFile,
  list_projects: toolListProjects,

  // Workload
  search_workload: toolSearchWorkload,
  list_workload_sources: toolListWorkloadSources,
  list_media: toolListMedia,

  // Deploy
  deploy_project: toolDeployProject,

  // SEO
  analyze_seo: toolAnalyzeSeo,
  generate_blog_post: toolGenerateBlogPost,
  optimize_page_seo: toolOptimizePageSeo,
  generate_structured_data: toolGenerateStructuredData,
};
