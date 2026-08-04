/**
 * OpenAce Research Agent
 * Autonomous web research with multiple search backends
 *
 * Search Strategy (in order of reliability):
 * 1. DuckDuckGo HTML search (fetch-based, no API key, reliable)
 * 2. Direct URL scraping via fetch for content extraction
 *
 * No Puppeteer — all searches use native fetch + HTML parsing.
 * Respects permissions and logs all actions.
 */

import fs from 'fs/promises';
import path from 'path';

export class ResearchAgent {
  constructor(options = {}) {
    this.permissionsManager = options.permissionsManager;
    this.config = options.config || {};
    this.dataDir = options.dataDir || './data/research';
    this.maxConcurrentTabs = options.maxConcurrentTabs || 3;
    this.results = [];
    this.isRunning = false;
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch (e) { /* exists */ }

    console.log('🔍 Research Agent initialized');
    return this;
  }

  // ═══════════════════════════════════════════════════════
  // PERMISSIONS & LOGGING
  // ═══════════════════════════════════════════════════════

  checkPermission(action, context = {}) {
    if (!this.permissionsManager) {
      return { allowed: true, reason: 'No permissions manager' };
    }
    return this.permissionsManager.checkPermission(action, context);
  }

  logAction(action, context, result) {
    if (this.permissionsManager) {
      this.permissionsManager.logAction(action, context, result);
    }
  }

  // ═══════════════════════════════════════════════════════
  // SEARCH — Fetch-Based Web Search
  // ═══════════════════════════════════════════════════════

  /**
   * Search the web using DuckDuckGo fetch (no browser needed)
   */
  async webSearch(query, options = {}) {
    const maxResults = options.maxResults || 10;

    // Check permission
    const permission = this.checkPermission('web_search', { domain: 'duckduckgo.com' });
    if (!permission.allowed && !permission.requiresApproval) {
      this.logAction('web_search', { query }, { success: false, reason: permission.reason });
      throw new Error(`Search not allowed: ${permission.reason}`);
    }

    let results = [];
    let searchBackend = 'none';

    // DuckDuckGo HTML fetch (reliable, no bot detection)
    try {
      results = await this.searchDuckDuckGo(query, maxResults);
      searchBackend = 'duckduckgo';
    } catch (e) {
    }

    const searchResult = {
      query,
      timestamp: new Date().toISOString(),
      backend: searchBackend,
      results: results.slice(0, maxResults)
    };

    this.results.push(searchResult);
    this.logAction('web_search', { query, backend: searchBackend }, { success: results.length > 0, count: results.length });

    return searchResult;
  }

  /**
   * DuckDuckGo HTML search via fetch (no browser needed)
   */
  async searchDuckDuckGo(query, maxResults = 10) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });

    if (!response.ok) throw new Error(`DuckDuckGo HTTP ${response.status}`);

    const html = await response.text();
    const results = [];

    // Parse DuckDuckGo HTML results
    const resultRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    let match;
    let position = 0;
    while ((match = resultRegex.exec(html)) !== null && position < maxResults) {
      let url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = match[3].replace(/<[^>]+>/g, '').trim();

      // DuckDuckGo uses redirect URLs — extract the actual URL
      if (url.includes('uddg=')) {
        const urlMatch = url.match(/uddg=([^&]+)/);
        if (urlMatch) url = decodeURIComponent(urlMatch[1]);
      }

      // Skip DuckDuckGo internal links
      if (url.startsWith('http') && !url.includes('duckduckgo.com')) {
        position++;
        results.push({
          position,
          title,
          url,
          snippet,
          source: 'duckduckgo'
        });
      }
    }

    // Fallback: try simpler regex if the above didn't work
    if (results.length === 0) {
      const simpleRegex = /<a[^>]+class="result__url"[^>]+href="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
      const titleRegex = /<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/gi;

      const urls = [];
      const titles = [];

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

      for (let i = 0; i < Math.min(urls.length, titles.length, maxResults); i++) {
        if (urls[i].startsWith('http')) {
          results.push({
            position: i + 1,
            title: titles[i] || '',
            url: urls[i],
            snippet: '',
            source: 'duckduckgo'
          });
        }
      }
    }

    return results;
  }

  // Keep backward compatibility
  async searchGoogle(query, options = {}) {
    return this.webSearch(query, options);
  }

  // ═══════════════════════════════════════════════════════
  // SCRAPING — Page Content Extraction (fetch-based)
  // ═══════════════════════════════════════════════════════

  /**
   * Scrape content from a URL via fetch (no browser needed)
   */
  async scrapePage(url, options = {}) {
    const domain = new URL(url).hostname;

    const permission = this.checkPermission('scrape_page', { domain });
    if (!permission.allowed && !permission.requiresApproval) {
      this.logAction('scrape_page', { url }, { success: false, reason: permission.reason });
      throw new Error(`Scraping not allowed: ${permission.reason}`);
    }

    try {
      const content = await this.fetchPage(url);
      const scrapeResult = { url, domain, timestamp: new Date().toISOString(), ...content };
      this.logAction('scrape_page', { url }, { success: true });
      return scrapeResult;
    } catch (error) {
      this.logAction('scrape_page', { url }, { success: false, error: error.message });
      throw error;
    }
  }

  /**
   * Lightweight fetch-based page scrape (no browser needed)
   */
  async fetchPage(url) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(10000)
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      // Extract meta description
      const metaMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i);
      const metaDescription = metaMatch ? metaMatch[1] : '';

      // Strip HTML tags for body text
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      let text = '';
      if (bodyMatch) {
        text = bodyMatch[1]
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000);
      }

      // Extract links
      const links = [];
      const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 50) {
        const href = linkMatch[1];
        const linkText = linkMatch[2].replace(/<[^>]+>/g, '').trim();
        if (linkText && href.startsWith('http')) {
          links.push({ text: linkText, href });
        }
      }

      return { url, title, metaDescription, text, links, domain: new URL(url).hostname };
    } catch (error) {
      return { url, title: '', metaDescription: '', text: '', links: [], domain: new URL(url).hostname, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // RESEARCH — Full Topic Research Pipeline
  // ═══════════════════════════════════════════════════════

  /**
   * Research a topic - search + scrape top results
   * Returns structured data with real URLs and content
   */
  async researchTopic(topic, options = {}) {
    const maxPages = options.maxPages || 3;
    const maxSearchResults = options.maxSearchResults || 10;


    // Clean the query — strip conversational parts for better search results
    const cleanQuery = this.cleanSearchQuery(topic);

    try {
      // Step 1: Search the web
      const search = await this.webSearch(cleanQuery, { maxResults: maxSearchResults });

      if (search.results.length === 0) {
        return {
          topic,
          cleanQuery,
          timestamp: new Date().toISOString(),
          search: { ...search, results: [] },
          pages: [],
          summary: 'No search results found. Try a different query.'
        };
      }


      // Step 2: Fetch top results for detailed content
      const scrapedPages = [];
      for (let i = 0; i < Math.min(maxPages, search.results.length); i++) {
        const result = search.results[i];
        try {
          const content = await this.fetchPage(result.url);
          scrapedPages.push({ ...result, content });
        } catch (error) {
          scrapedPages.push({ ...result, content: null });
        }
      }

      const research = {
        topic,
        cleanQuery,
        timestamp: new Date().toISOString(),
        search,
        pages: scrapedPages,
        summary: this.generateSummary(search.results, scrapedPages)
      };

      await this.saveResearch(research);
      return research;

    } catch (error) {
      console.error(`Research failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Clean a conversational message into a search-optimized query
   */
  cleanSearchQuery(topic) {
    return topic
      .replace(/^(hey\s+ace[\s,!.]*|ace[\s,!.]*|can you|could you|would you|please|i need you to|i want you to)\s*/i, '')
      .replace(/\b(do some|do a|run a|run some|perform a|perform some)\b\s*/gi, '')
      .replace(/\b(research on|research about|research into|look into|look up|find out about|tell me about|search for)\b\s*/gi, '')
      .replace(/\?+$/, '')
      .trim()
      || topic;
  }

  /**
   * Generate a summary including all URLs
   */
  generateSummary(searchResults, scrapedPages) {
    const sources = [];

    for (const result of searchResults) {
      sources.push({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        scraped: scrapedPages?.some(p => p.url === result.url) || false
      });
    }

    return {
      totalSearchResults: searchResults.length,
      totalPagesScraped: scrapedPages?.filter(p => p.content && !p.content.error).length || 0,
      sources,
      keyPoints: scrapedPages
        ?.filter(p => p.content?.metaDescription)
        .map((p, i) => `${i + 1}. ${p.title}: ${p.content.metaDescription}`)
        || []
    };
  }

  // ═══════════════════════════════════════════════════════
  // PROPERTY RESEARCH — Specialized Real Estate Search
  // ═══════════════════════════════════════════════════════

  /**
   * Search for real estate deals with URLs from listing sites
   */
  async searchRealEstateDeals(location, options = {}) {
    const { minPrice, maxPrice, propertyType, keywords } = options;

    let baseQuery = `${propertyType || 'property'} for sale ${location}`;
    if (keywords) baseQuery += ` ${keywords}`;
    if (minPrice || maxPrice) {
      if (minPrice && maxPrice) baseQuery += ` $${minPrice}-$${maxPrice}`;
      else if (maxPrice) baseQuery += ` under $${maxPrice}`;
      else baseQuery += ` from $${minPrice}`;
    }


    const queries = [
      `site:zillow.com ${baseQuery}`,
      `site:realtor.com ${baseQuery}`,
      `site:redfin.com ${baseQuery}`,
      baseQuery + ' listing'
    ];

    const allResults = [];
    for (const query of queries) {
      try {
        const search = await this.webSearch(query, { maxResults: 5 });
        for (const result of search.results) {
          if (!allResults.some(r => r.url === result.url)) {
            allResults.push(result);
          }
        }
      } catch (error) {
      }
    }

    const directUrls = this.generateRealEstateUrls(location, options);

    const research = {
      query: baseQuery,
      location,
      options,
      timestamp: new Date().toISOString(),
      searchResults: allResults,
      directListingUrls: directUrls,
      totalResults: allResults.length
    };

    await this.saveResearch(research);
    return research;
  }

  /**
   * Generate direct URLs to real estate listing sites
   */
  generateRealEstateUrls(location, options = {}) {
    const loc = encodeURIComponent(location);
    const maxPrice = options.maxPrice || '';
    const propertyType = options.propertyType || '';

    const urls = [];

    urls.push({
      site: 'Zillow',
      url: `https://www.zillow.com/homes/for_sale/${location.replace(/\s+/g, '-')}_rb/${maxPrice ? `0-${maxPrice}_price/` : ''}`,
      description: `Browse all ${location} listings on Zillow`
    });

    urls.push({
      site: 'Realtor.com',
      url: `https://www.realtor.com/realestateandhomes-search/${location.replace(/[\s,]+/g, '_')}/type-single-family-home${maxPrice ? `/price-na-${maxPrice}` : ''}`,
      description: `Browse ${location} homes on Realtor.com`
    });

    urls.push({
      site: 'Redfin',
      url: `https://www.redfin.com/state/Florida/filter/max-price=${maxPrice || 'none'},property-type=land+house`,
      description: `Browse ${location} properties on Redfin`
    });

    if (/\b(land|acre|lot|vacant)\b/i.test(propertyType)) {
      urls.push({
        site: 'LandWatch',
        url: `https://www.landwatch.com/florida-land-for-sale${maxPrice ? `?maxPrice=${maxPrice}` : ''}`,
        description: `Browse Florida land on LandWatch`
      });

      urls.push({
        site: 'Land.com',
        url: `https://www.land.com/Florida/all-land/${maxPrice ? `under-${maxPrice}/` : ''}`,
        description: `Browse Florida land on Land.com`
      });
    }

    if (/\b(owner|seller)\s*financ/i.test(propertyType) || /\b(owner|seller)\s*financ/i.test(options.keywords || '')) {
      urls.push({
        site: 'Owner Financed Homes',
        url: `https://www.google.com/search?q=owner+financing+homes+for+sale+${loc}`,
        description: `Google search for owner financed homes in ${location}`
      });
    }

    return urls;
  }

  /**
   * Search for leads/prospects
   */
  async searchLeads(industry, location, options = {}) {
    const query = `${industry} companies ${location} contact`;


    const search = await this.webSearch(query, { maxResults: 10 });

    const leads = search.results.map(r => ({
      company: r.title.split(' - ')[0].split(' | ')[0],
      website: r.url,
      description: r.snippet,
      source: search.backend || 'web_search',
      foundAt: new Date().toISOString()
    }));

    return {
      query,
      industry,
      location,
      timestamp: new Date().toISOString(),
      leads
    };
  }

  // ═══════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════

  async saveResearch(research) {
    const permission = this.checkPermission('file_create', { path: this.dataDir });
    if (!permission.allowed) {
      return null;
    }

    const filename = `research-${Date.now()}.json`;
    const filepath = path.join(this.dataDir, filename);

    await fs.writeFile(filepath, JSON.stringify(research, null, 2));

    return filepath;
  }

  async loadResearch(filename) {
    const filepath = path.join(this.dataDir, filename);
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data);
  }

  async listResearch() {
    try {
      const files = await fs.readdir(this.dataDir);
      return files.filter(f => f.startsWith('research-') && f.endsWith('.json'));
    } catch (error) {
      return [];
    }
  }

  getRecentResults(limit = 10) {
    return this.results.slice(-limit);
  }
}

export default ResearchAgent;
