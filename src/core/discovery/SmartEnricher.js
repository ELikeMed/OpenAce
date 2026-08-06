/**
 * SmartEnricher — AI-powered contact extraction from business websites
 *
 * Strategy: Email first, phone second.
 * 1. Multi-engine search (Google + Bing) focused on finding emails
 * 2. Website scraping across 26+ paths with mailto/structured data extraction
 * 3. Claude AI extracts and structures contacts
 * 4. Second pass: for any contact with name but no email, run targeted search
 * 5. Guarantee: if ANY email was found anywhere, at least one contact gets it
 */

import axios from 'axios';

const ENRICHMENT_PATHS = [
  '', '/contact', '/about', '/about-us', '/contact-us',
  '/team', '/our-team', '/staff', '/leadership', '/people',
  '/bio', '/attorneys', '/doctors', '/providers', '/our-doctors',
  '/meet-the-team', '/meet-us', '/who-we-are', '/professionals',
  '/our-staff', '/directory', '/physicians', '/partners', '/agents',
  '/faculty', '/employees', '/management', '/office-staff'
];

const MAX_TEXT_PER_PAGE = 6000;
const TOTAL_TIMEOUT_MS = 55000;  // 55s — extra room for Bing + second pass
const PAGE_TIMEOUT_MS = 8000;

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Junk emails to always filter out
const JUNK_EMAIL_PATTERNS = ['google', 'example.com', 'sentry', 'schema.org', 'wixpress', 'squarespace', 'wordpress', 'cloudflare', 'googleapis', 'gstatic'];

export class SmartEnricher {
  constructor({ aiManager, costTracker }) {
    this.aiManager = aiManager;
    this.costTracker = costTracker || null;
  }

  async enrich(prospect) {
    if (!prospect.website) {
      return this._enrichFromGoogleOnly(prospect);
    }

    return Promise.race([
      this._doEnrich(prospect),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Enrichment timed out')), TOTAL_TIMEOUT_MS)
      )
    ]);
  }

  async _enrichFromGoogleOnly(prospect) {
    const searchData = await this._multiEngineSearch(prospect);
    if (!searchData && !prospect.emails?.length && !prospect.phone) {
      return { contacts: [], pagesScraped: 0, tokensUsed: 0 };
    }
    const result = await this._runAI(prospect, [], searchData);
    const finalContacts = this._ensureEmailOnContact(result.contacts, searchData, prospect);
    const filledContacts = await this._fillMissingEmails(finalContacts, prospect);
    return { contacts: filledContacts, pagesScraped: 0, tokensUsed: result.tokensUsed };
  }

  async _doEnrich(prospect) {
    const [searchData, scrapeResult] = await Promise.all([
      this._multiEngineSearch(prospect),
      this._scrapeWebsite(prospect.website),
    ]);

    const { pageTexts, mailtoEmails, structuredEmails } = scrapeResult;
    const pagesScraped = pageTexts.length;

    // Merge scraped emails into search data
    const mergedSearch = this._mergeSearchData(searchData, mailtoEmails, structuredEmails);

    console.log(`🔍 Enrich "${prospect.name}": ${pageTexts.length} pages, ${mailtoEmails.length} mailto, ${structuredEmails.length} structured, search: ${mergedSearch ? `${mergedSearch.emails.length} emails` : 'none'}`);

    if (pageTexts.length === 0 && !mergedSearch && !prospect.emails?.length && !prospect.phone) {
      console.log(`🔍 Enrich "${prospect.name}": No data found anywhere — returning empty`);
      return { contacts: [], pagesScraped: 0, tokensUsed: 0 };
    }

    const result = await this._runAI(prospect, pageTexts, mergedSearch);
    console.log(`🔍 Enrich "${prospect.name}": AI returned ${result.contacts.length} contacts`);

    // Ensure at least one contact has an email if we found any
    const guaranteed = this._ensureEmailOnContact(result.contacts, mergedSearch, prospect);
    const finalContacts = await this._fillMissingEmails(guaranteed, prospect);

    return {
      contacts: finalContacts,
      pagesScraped,
      tokensUsed: result.tokensUsed,
    };
  }

  // --- Multi-Engine Search (Google + Bing) ---

  async _multiEngineSearch(prospect) {
    const name = prospect.name || '';
    const city = prospect.address?.split(',')[1]?.trim() || '';
    const state = prospect.address?.split(',')[2]?.trim()?.split(' ')[0] || '';
    const location = [city, state].filter(Boolean).join(' ');
    const domain = prospect.website ? this._extractDomain(prospect.website) : '';

    const allEmails = new Set();
    const allPhones = new Set();
    const allSnippets = [];

    // Google Custom Search API queries (most reliable, if configured)
    const customSearchQueries = [
      `"${name}" ${location} email contact`,
      `"${name}" ${location} office manager email`,
      domain ? `site:${domain} email contact` : null,
    ].filter(Boolean);

    for (const query of customSearchQueries) {
      try {
        const result = await this._googleCustomSearch(query);
        if (result) {
          result.emails.forEach(e => allEmails.add(e));
          result.phones.forEach(p => allPhones.add(p));
          if (result.snippets) allSnippets.push(result.snippets);
        }
      } catch {}
      // If we already found emails via Custom Search, skip remaining queries (save cost)
      if (allEmails.size > 0) break;
      await new Promise(r => setTimeout(r, 100));
    }

    // Google HTML scraping queries (fallback)
    const googleQueries = [
      `"${name}" ${location} email contact`,
      `"${name}" ${location} office manager OR admin OR front desk email`,
      domain ? `site:${domain} email contact` : null,
      `"${name}" site:linkedin.com ${location}`,
    ].filter(Boolean);

    // Bing queries (different phrasing catches different results)
    const bingQueries = [
      `"${name}" ${location} email`,
      `"${name}" ${location} contact office`,
      domain ? `site:${domain} contact email phone` : null,
    ].filter(Boolean);

    // Run Google searches
    for (const query of googleQueries) {
      try {
        const result = await this._googleSearch(query);
        if (result) {
          result.emails.forEach(e => allEmails.add(e));
          result.phones.forEach(p => allPhones.add(p));
          if (result.snippets) allSnippets.push(result.snippets);
        }
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }

    // Run Bing searches
    for (const query of bingQueries) {
      try {
        const result = await this._bingSearch(query);
        if (result) {
          result.emails.forEach(e => allEmails.add(e));
          result.phones.forEach(p => allPhones.add(p));
          if (result.snippets) allSnippets.push(result.snippets);
        }
      } catch {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (allEmails.size === 0 && allPhones.size === 0 && allSnippets.length === 0) {
      return null;
    }

    return {
      emails: [...allEmails],
      phones: [...allPhones],
      snippets: allSnippets.join('\n'),
    };
  }

  async _googleSearch(query) {
    try {
      const encoded = encodeURIComponent(query);
      const html = await this._fetchPage(`https://www.google.com/search?q=${encoded}&num=10`);
      if (!html) return null;
      return this._extractFromSearchPage(html);
    } catch {
      return null;
    }
  }

  async _bingSearch(query) {
    try {
      const encoded = encodeURIComponent(query);
      const html = await this._fetchPage(`https://www.bing.com/search?q=${encoded}&count=10`);
      if (!html) return null;
      return this._extractFromSearchPage(html);
    } catch {
      return null;
    }
  }

  /**
   * Google Custom Search JSON API — structured results, much more reliable than HTML scraping.
   * Returns null if not configured (graceful fallback).
   */
  async _googleCustomSearch(query) {
    const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
    const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
    if (!key || !cx) return null;

    try {
      const res = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: { q: query, key, cx, num: 10 },
        timeout: 5000,
      });

      // Track cost
      if (this.costTracker) {
        this.costTracker.trackCustomSearch(null, 1, `Custom Search: ${query.substring(0, 50)}`).catch(() => {});
      }

      const items = res.data.items || [];
      if (items.length === 0) return null;

      // Combine titles + snippets into text for extraction
      const text = items.map(i => `${i.title || ''} ${i.snippet || ''}`).join('\n');
      return this._extractFromSearchPage(text);
    } catch {
      return null;
    }
  }

  _extractFromSearchPage(html) {
    const text = this._htmlToText(html);

    const emails = (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [])
      .filter(e => !JUNK_EMAIL_PATTERNS.some(j => e.toLowerCase().includes(j)));
    const phones = (text.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || []);

    const snippetLines = text.split('\n')
      .filter(line => line.length > 20 && line.length < 300)
      .filter(line => !line.includes('Google') && !line.includes('Sign in') && !line.includes('Cookie')
                   && !line.includes('Bing') && !line.includes('Microsoft'))
      .slice(0, 15)
      .join('\n');

    return {
      emails: [...new Set(emails)],
      phones: [...new Set(phones)],
      snippets: snippetLines,
    };
  }

  // --- Second Pass: Search for Missing Emails ---

  async _fillMissingEmails(contacts, prospect) {
    const needEmail = contacts.filter(c => c.name && !c.email && c.name !== 'General');
    if (needEmail.length === 0) return contacts;

    const domain = prospect.website ? this._extractDomain(prospect.website) : '';
    const bizName = prospect.name || '';

    // Targeted search for each contact's email (max 3, alternate engines)
    for (let i = 0; i < Math.min(needEmail.length, 3); i++) {
      const contact = needEmail[i];
      try {
        const query = `"${contact.name}" "${bizName}" email`;
        // Alternate between Google and Bing to avoid rate limits
        const searchFn = i % 2 === 0 ? this._googleSearch.bind(this) : this._bingSearch.bind(this);
        const result = await searchFn(query);
        if (result?.emails?.length) {
          const domainMatch = domain
            ? result.emails.find(e => e.includes(domain))
            : null;
          contact.email = domainMatch || result.emails[0];
        } else {
          contact.needsEmail = true;
        }
        await new Promise(r => setTimeout(r, 300));
      } catch {}
    }

    return contacts;
  }

  // --- Ensure at least one contact has an email ---

  _ensureEmailOnContact(contacts, searchData, prospect) {
    // Collect ALL emails we've found from any source
    const allFoundEmails = new Set();
    if (searchData?.emails) searchData.emails.forEach(e => allFoundEmails.add(e));
    if (prospect.emails) prospect.emails.filter(Boolean).forEach(e => allFoundEmails.add(e));
    contacts.forEach(c => { if (c.email) allFoundEmails.add(c.email); });

    // If any contact already has an email, we're good
    if (contacts.some(c => c.email && c.email.includes('@'))) return contacts;

    // No contact has an email, but we found emails — assign to General contact
    if (allFoundEmails.size > 0) {
      const bestEmail = [...allFoundEmails][0];
      const generalContact = contacts.find(c => c.name === 'General' || c.role?.toLowerCase().includes('general'));
      if (generalContact) {
        generalContact.email = bestEmail;
        generalContact.isDecisionMaker = true;
      } else {
        // Create a General contact with the email
        contacts.unshift({
          name: 'General',
          role: 'Main Office',
          email: bestEmail,
          phone: prospect.phone || '',
          isDecisionMaker: true,
          source: 'website',
          enrichedAt: new Date().toISOString(),
          verified: false,
        });
      }
    }

    return contacts;
  }

  // --- Website Scraping (Enhanced) ---

  async _scrapeWebsite(website) {
    const baseUrl = this._normalizeUrl(website);
    const fetches = ENRICHMENT_PATHS.map(p =>
      this._fetchPage(`${baseUrl}${p}`).catch(() => null)
    );
    const results = await Promise.allSettled(fetches);

    const pageTexts = [];
    const mailtoEmails = new Set();
    const structuredEmails = new Set();

    for (let i = 0; i < results.length; i++) {
      const html = results[i].status === 'fulfilled' ? results[i].value : null;
      if (!html) continue;

      // Extract emails from raw HTML before stripping tags
      this._extractEmailsFromHtml(html, mailtoEmails, structuredEmails);

      const text = this._htmlToText(html);
      if (text.length > 50) {
        pageTexts.push({ url: `${baseUrl}${ENRICHMENT_PATHS[i]}`, text });
      }
    }

    // If we got zero pages, try Google's cached version of the homepage
    if (pageTexts.length === 0) {
      try {
        const cachedHtml = await this._fetchPage(`https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(baseUrl)}`);
        if (cachedHtml) {
          this._extractEmailsFromHtml(cachedHtml, mailtoEmails, structuredEmails);
          const text = this._htmlToText(cachedHtml);
          if (text.length > 50) {
            pageTexts.push({ url: `${baseUrl} (cached)`, text });
          }
        }
      } catch {}
    }

    return {
      pageTexts,
      mailtoEmails: [...mailtoEmails],
      structuredEmails: [...structuredEmails],
    };
  }

  // Extract emails from raw HTML — catches mailto: links, JSON-LD, meta tags, JS variables
  _extractEmailsFromHtml(html, mailtoSet, structuredSet) {
    // 1. mailto: links — most reliable source
    const mailtoMatches = html.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
    for (const m of mailtoMatches) {
      const email = m.replace(/^mailto:/i, '').toLowerCase();
      if (!JUNK_EMAIL_PATTERNS.some(j => email.includes(j))) {
        mailtoSet.add(email);
      }
    }

    // 2. JSON-LD structured data (schema.org)
    const jsonLdBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
    for (const block of jsonLdBlocks) {
      const jsonContent = block.replace(/<\/?script[^>]*>/gi, '');
      try {
        const data = JSON.parse(jsonContent);
        this._extractEmailsFromJsonLd(data, structuredSet);
      } catch {}
    }

    // 3. href="mailto:" in anchor tags (catches obfuscated ones)
    const hrefMailto = html.match(/href=["']mailto:([^"'?]+)/gi) || [];
    for (const m of hrefMailto) {
      const email = m.replace(/^href=["']mailto:/i, '').toLowerCase();
      if (email.includes('@') && !JUNK_EMAIL_PATTERNS.some(j => email.includes(j))) {
        mailtoSet.add(email);
      }
    }

    // 4. Emails in JavaScript variables and data attributes
    const jsEmails = html.match(/["']([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})["']/g) || [];
    for (const m of jsEmails) {
      const email = m.replace(/["']/g, '').toLowerCase();
      if (!JUNK_EMAIL_PATTERNS.some(j => email.includes(j))) {
        structuredSet.add(email);
      }
    }
  }

  _extractEmailsFromJsonLd(data, emailSet) {
    if (!data) return;
    if (Array.isArray(data)) {
      data.forEach(item => this._extractEmailsFromJsonLd(item, emailSet));
      return;
    }
    if (typeof data === 'object') {
      if (data.email) {
        const email = String(data.email).replace(/^mailto:/i, '').toLowerCase();
        if (email.includes('@') && !JUNK_EMAIL_PATTERNS.some(j => email.includes(j))) {
          emailSet.add(email);
        }
      }
      // Recurse into nested objects
      for (const val of Object.values(data)) {
        if (typeof val === 'object' && val) {
          this._extractEmailsFromJsonLd(val, emailSet);
        }
      }
    }
  }

  // Merge scraped emails into search data
  _mergeSearchData(searchData, mailtoEmails, structuredEmails) {
    const allEmails = new Set();
    const allPhones = new Set();
    let snippets = '';

    if (searchData) {
      searchData.emails.forEach(e => allEmails.add(e));
      searchData.phones.forEach(p => allPhones.add(p));
      snippets = searchData.snippets || '';
    }

    // mailto: emails are highest quality — add first
    mailtoEmails.forEach(e => allEmails.add(e));
    structuredEmails.forEach(e => allEmails.add(e));

    if (allEmails.size === 0 && allPhones.size === 0 && !snippets) return null;

    return {
      emails: [...allEmails],
      phones: [...allPhones],
      snippets,
    };
  }

  // --- AI Processing ---

  async _runAI(prospect, pageTexts, searchData) {
    const pagesContent = pageTexts.map(p =>
      `--- PAGE: ${p.url} ---\n${p.text.slice(0, MAX_TEXT_PER_PAGE)}\n--- END PAGE ---`
    ).join('\n\n');

    const existingEmails = (prospect.emails || []).filter(Boolean);
    const existingPhone = prospect.phone || '';

    let dataSection = '';
    if (existingEmails.length || existingPhone) {
      dataSection += '\nData from initial scan:\n';
      if (existingEmails.length) dataSection += `Emails: ${existingEmails.join(', ')}\n`;
      if (existingPhone) dataSection += `Phone: ${existingPhone}\n`;
    }

    if (searchData) {
      dataSection += '\nData from search engines (Google + Bing):\n';
      if (searchData.emails.length) dataSection += `Emails found: ${searchData.emails.join(', ')}\n`;
      if (searchData.phones.length) dataSection += `Phones found: ${searchData.phones.join(', ')}\n`;
      if (searchData.snippets) dataSection += `Relevant snippets:\n${searchData.snippets.slice(0, 3000)}\n`;
    }

    if (dataSection) {
      dataSection = dataSection + '\nUse ALL of this data in your response.\n';
    }

    const prompt = `You are extracting contact information from a business for a B2B outreach team. We want to find the best person to contact — usually an office manager, admin assistant, front desk coordinator, operations manager, or decision-maker.

EMAIL IS THE #1 PRIORITY. Every contact MUST have an email if at all possible.

Business: "${prospect.name}"
Category: ${prospect.category || 'unknown'}
Address: ${prospect.address}
Website: ${prospect.website || 'none'}
Google Rating: ${prospect.googleRating || 'N/A'} (${prospect.googleReviewCount || 0} reviews)
Google Types: ${(prospect.googleTypes || []).slice(0, 5).join(', ')}
${dataSection}
${pageTexts.length > 0 ? 'Website content:' : 'No website content was available to scrape.'}

${pagesContent}

YOUR TASK: Find people at this business with their EMAIL ADDRESSES. Use ALL sources:
1. Website content above (if any)
2. Emails, phones, and search snippets provided
3. YOUR OWN KNOWLEDGE about this business from your training data
4. LinkedIn data if present in search results
5. Logical inference — construct emails from names + the business domain

For each person provide:
- name: Full name
- role: Job title
- email: Email address — ONLY include real emails you found in the data. Do NOT guess or construct emails.
- phone: Phone number if available
- isDecisionMaker: true if they likely handle purchasing decisions or vendor relationships (office managers, admin, front desk = true; doctors/lawyers/owners = false unless tiny office)

RULES:
- ONLY use real email addresses found in website content, search results, or existing data. NEVER make up or guess an email address.
- ALWAYS include a "General" contact with the main office email (info@, contact@, office@, or the first email found). This is MANDATORY if ANY email was found.
- If the business name contains a person's name ("Law Office of Kenneth Rubin"), include that person
- For emails with first names (jenny@domain.com), infer the full name
- NEVER return an empty array if we have ANY data at all
- For small offices (1-5 people), the owner IS the decision maker
- If you find LinkedIn profiles, include those people with their roles
- General/info emails ARE valid for outreach — always include them

Return ONLY a valid JSON array.`;

    const response = await this.aiManager.chat(
      [{ role: 'user', content: prompt }],
      { maxTokens: 2000, systemPrompt: '' }
    );

    const content = response.content || response;
    const contacts = this._parseContacts(content, prospect.website);
    const tokensUsed = response.usage
      ? (response.usage.input_tokens + response.usage.output_tokens)
      : 0;
    return { contacts, tokensUsed };
  }

  // --- Parsing ---

  _parseContacts(content, websiteUrl) {
    try {
      // Try to extract JSON array — handle Claude adding text before/after
      let jsonStr = null;

      // Method 1: find the JSON array
      const jsonMatch = content.match(/\[[\s\S]*?\](?=\s*$|\s*[^,\]}])/);
      if (jsonMatch) jsonStr = jsonMatch[0];

      // Method 2: if that failed, try finding [ and the last ]
      if (!jsonStr) {
        const start = content.indexOf('[');
        const end = content.lastIndexOf(']');
        if (start !== -1 && end > start) {
          jsonStr = content.slice(start, end + 1);
        }
      }

      if (!jsonStr) {
        console.log('SmartEnricher: No JSON array found in response:', content.slice(0, 200));
        return [];
      }

      // Clean up common JSON issues
      jsonStr = jsonStr.replace(/,\s*\]/g, ']'); // trailing comma
      jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, ' '); // control characters

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch (e) {
        // Try fixing truncated JSON by closing brackets
        try {
          parsed = JSON.parse(jsonStr + ']');
        } catch {
          console.error('SmartEnricher: JSON parse failed:', e.message, 'Raw:', jsonStr.slice(0, 300));
          return [];
        }
      }

      if (!Array.isArray(parsed)) return [];

      const websiteDomain = websiteUrl ? this._extractDomain(websiteUrl) : '';
      const now = new Date().toISOString();

      return parsed
        .filter(c => c && c.name)
        .map(c => ({
          name: String(c.name || '').trim(),
          role: String(c.role || '').trim(),
          email: this._cleanEmail(c.email),
          phone: String(c.phone || '').trim(),
          isDecisionMaker: !!c.isDecisionMaker,
          source: 'website',
          enrichedAt: now,
          verified: c.email && websiteDomain
            ? this._extractDomain(c.email).includes(websiteDomain) || websiteDomain.includes(this._extractDomain(c.email))
            : false
        }));
    } catch (err) {
      console.error('SmartEnricher: Failed to parse AI response:', err.message);
      return [];
    }
  }

  // --- Utilities ---

  _cleanEmail(raw) {
    const email = String(raw || '').trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) return '';
    // Filter out AI hallucinated junk
    const junk = ['not_found', 'unknown', 'none', 'n/a', 'no_email', 'noemail', 'notfound', 'not found', 'example'];
    if (junk.some(j => email.includes(j))) return '';
    if (JUNK_EMAIL_PATTERNS.some(j => email.includes(j))) return '';
    return email;
  }

  _normalizeUrl(url) {
    let u = url.trim();
    if (!u.startsWith('http')) u = 'https://' + u;
    return u.replace(/\/+$/, '');
  }

  _extractDomain(urlOrEmail) {
    try {
      if (urlOrEmail.includes('@')) {
        return urlOrEmail.split('@')[1]?.split('.').slice(-2).join('.').toLowerCase() || '';
      }
      return new URL(urlOrEmail).hostname.replace(/^www\./, '').split('.').slice(-2).join('.').toLowerCase();
    } catch {
      return '';
    }
  }

  async _fetchPage(url) {
    const res = await axios.get(url, {
      timeout: PAGE_TIMEOUT_MS,
      maxContentLength: 500000,
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      validateStatus: s => s < 400
    });
    return typeof res.data === 'string' ? res.data : '';
  }

  _htmlToText(html) {
    let text = html;
    text = text.replace(/<script[\s\S]*?<\/script>/gi, '');
    text = text.replace(/<style[\s\S]*?<\/style>/gi, '');
    text = text.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    text = text.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n/g, '\n');
    return text.trim();
  }
}
