/**
 * LeadFinder — Real Business Lead Discovery
 *
 * No browser needed — uses fetch + HTML parsing for all web scraping.
 *
 * Finds REAL businesses using multiple strategies:
 *   Priority 1: Google Places API (fastest, most structured)
 *   Priority 2: Fetch-based web search scraping (Yelp, DDG, Bing)
 *   Priority 3: Generated leads (last resort)
 *
 * Returns standardized lead objects with real names, phones, addresses, websites.
 */

export class LeadFinder {
  constructor(options = {}) {
    this.config = options.config || {};
    this.onProgress = options.onProgress || ((msg) => console.log(`[LeadFinder] ${msg}`));

    // Extract API keys from config
    const externalApis = this.config.external_apis || {};
    this.placesApiKey = externalApis.google?.places_api_key || '';
    this.serperApiKey = externalApis.serper?.api_key || '';
  }

  // ═══════════════════════════════════════════════════════
  // FETCH HELPER
  // ═══════════════════════════════════════════════════════

  async _fetchHtml(url) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response.text();
  }

  // ═══════════════════════════════════════════════════════
  // MAIN ORCHESTRATOR
  // ═══════════════════════════════════════════════════════

  /**
   * Find real business leads using the best available method.
   * Tries: Google Places API -> Fetch-based web scraping -> Generated fallback
   */
  async findLeads(industry, location, count = 5) {
    this.onProgress(`🔍 Finding ${count} real ${industry} businesses in ${location}...`);

    // Strategy 1: Google Places API
    if (this.placesApiKey) {
      try {
        this.onProgress('🗺️ Trying Google Places API...');
        const leads = await this.searchGooglePlaces(industry, location, count);
        if (leads.length > 0) {
          this.onProgress(`✅ Found ${leads.length} real leads via Google Places API`);
          return leads;
        }
      } catch (error) {
        this.onProgress(`⚠️ Google Places API failed: ${error.message}`);
      }
    } else {
      this.onProgress('ℹ️ No Google Places API key configured, skipping...');
    }

    // Strategy 2: Fetch-based web search scraping
    try {
      this.onProgress('🌐 Trying fetch-based web search scraping...');
      const leads = await this.searchWebFetch(industry, location, count);
      if (leads.length > 0) {
        this.onProgress(`✅ Found ${leads.length} real leads via web scraping`);
        return leads;
      }
    } catch (error) {
      this.onProgress(`⚠️ Fetch-based scraping failed: ${error.message}`);
    }

    // Strategy 3: Generated fallback
    this.onProgress('⚠️ All real search methods failed. Generating placeholder leads...');
    return this.generateFallbackLeads(industry, location, count);
  }

  // ═══════════════════════════════════════════════════════
  // STRATEGY 1: GOOGLE PLACES API
  // ═══════════════════════════════════════════════════════

  async searchGooglePlaces(industry, location, count = 5) {
    const query = `${industry} businesses in ${location}`;
    const results = await this._placesTextSearch(query, count);

    if (results.length > 0) {
      const detailedLeads = [];
      for (const place of results.slice(0, count)) {
        try {
          const details = await this._placesDetails(place.place_id);
          detailedLeads.push(this._placesToLead(details, industry, location));
        } catch (e) {
          detailedLeads.push(this._placesToLead(place, industry, location));
        }
      }
      return detailedLeads;
    }

    return [];
  }

  async _placesTextSearch(query, maxResults = 5) {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${this.placesApiKey}`;

    this.onProgress(`  📡 Places Text Search: "${query}"`);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results) {
      this.onProgress(`  ✓ Got ${data.results.length} places results`);
      return data.results.slice(0, maxResults);
    } else if (data.status === 'ZERO_RESULTS') {
      this.onProgress('  ⚠️ No results found for this search');
      return [];
    } else {
      throw new Error(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }
  }

  async _placesDetails(placeId) {
    const fields = 'name,formatted_address,formatted_phone_number,international_phone_number,website,rating,user_ratings_total,types,business_status,url,opening_hours';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${this.placesApiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      return data.result;
    }

    throw new Error(`Place details error: ${data.status}`);
  }

  _placesToLead(place, industry, location) {
    return {
      name: place.name || 'Unknown Business',
      company: place.name || '',
      phone: place.formatted_phone_number || place.international_phone_number || '',
      address: place.formatted_address || place.vicinity || '',
      website: place.website || '',
      email: '',
      rating: place.rating || null,
      reviewCount: place.user_ratings_total || 0,
      businessType: (place.types || []).slice(0, 3).join(', '),
      googleMapsUrl: place.url || '',
      source: 'google_places_api',
      industry: industry,
      location: location,
      placeId: place.place_id || '',
      businessStatus: place.business_status || '',
      stage: 'new',
      notes: this._buildPlacesNotes(place, industry, location),
      createdAt: new Date().toISOString()
    };
  }

  _buildPlacesNotes(place, industry, location) {
    const parts = [];
    parts.push(`Real ${industry} business in ${location}.`);
    parts.push('Found via Google Places API.');
    if (place.rating) {
      parts.push(`Rating: ${place.rating}/5 (${place.user_ratings_total || 0} reviews).`);
    }
    if (place.formatted_address) {
      parts.push(`Address: ${place.formatted_address}.`);
    }
    if (place.website) {
      parts.push(`Website: ${place.website}`);
    }
    if (place.business_status && place.business_status !== 'OPERATIONAL') {
      parts.push(`Status: ${place.business_status}`);
    }
    return parts.join(' ');
  }

  // ═══════════════════════════════════════════════════════
  // STRATEGY 2: FETCH-BASED WEB SEARCH SCRAPING
  // ═══════════════════════════════════════════════════════

  /**
   * Use fetch + HTML parsing to search for businesses.
   * Tries: Yelp → DuckDuckGo → Bing (all via fetch, no browser)
   */
  async searchWebFetch(industry, location, count = 5) {
    let extracted = [];

    // Strategy A: Yelp
    try {
      this.onProgress('  📋 Trying Yelp business listings (fetch)...');
      const yelpResults = await this._fetchYelp(industry, location);
      if (yelpResults.length > 0) {
        this.onProgress(`  ✓ Yelp returned ${yelpResults.length} businesses`);
        extracted = extracted.concat(yelpResults);
      }
    } catch (e) {
      this.onProgress(`  ⚠️ Yelp failed: ${e.message}`);
    }

    // Strategy B: DuckDuckGo
    if (extracted.length < count) {
      try {
        const query = `best ${industry} in ${location} reviews`;
        this.onProgress('  🦆 Trying DuckDuckGo search (fetch)...');
        const ddgResults = await this._fetchDuckDuckGo(query);
        if (ddgResults.length > 0) {
          this.onProgress(`  ✓ DuckDuckGo returned ${ddgResults.length} results`);
          extracted = extracted.concat(ddgResults);
        }
      } catch (e) {
        this.onProgress(`  ⚠️ DuckDuckGo failed: ${e.message}`);
      }
    }

    // Strategy C: Bing
    if (extracted.length < count) {
      try {
        const query = `${industry} ${location} phone number address`;
        this.onProgress('  🔵 Trying Bing search (fetch)...');
        const bingResults = await this._fetchBing(query);
        if (bingResults.length > 0) {
          this.onProgress(`  ✓ Bing returned ${bingResults.length} results`);
          extracted = extracted.concat(bingResults);
        }
      } catch (e) {
        this.onProgress(`  ⚠️ Bing failed: ${e.message}`);
      }
    }

    this.onProgress(`  📊 Total extracted: ${extracted.length} business entries`);

    // Deduplicate and build leads
    const leads = [];
    const seen = new Set();

    for (const biz of extracted) {
      const normalizedName = biz.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (seen.has(normalizedName) || normalizedName.length < 3) continue;
      seen.add(normalizedName);

      // If we have a website but no phone, try to scrape the website
      if (biz.website && !biz.phone && leads.length < count) {
        try {
          const contactInfo = await this._scrapeContactInfo(biz.website);
          biz.phone = contactInfo.phone || biz.phone;
          biz.email = contactInfo.email || '';
          biz.address = contactInfo.address || biz.address;
        } catch (e) { /* scraping failed, that's OK */ }
      }

      leads.push({
        name: biz.name,
        company: biz.name,
        phone: this._cleanPhone(biz.phone),
        address: biz.address || '',
        website: biz.website || '',
        email: biz.email || '',
        rating: this._parseRating(biz.rating),
        reviewCount: 0,
        businessType: biz.businessType || '',
        googleMapsUrl: biz.googleMapsUrl || '',
        source: `fetch_scrape_${biz.sourceType}`,
        industry: industry,
        location: location,
        stage: 'new',
        notes: `Real business found via web search. ${biz.snippet || ''} ${biz.address ? 'Address: ' + biz.address + '.' : ''} ${biz.phone ? 'Phone: ' + biz.phone + '.' : ''}`.trim(),
        createdAt: new Date().toISOString()
      });

      if (leads.length >= count) break;
    }

    return leads;
  }

  /**
   * Fetch + parse Yelp search results
   */
  async _fetchYelp(industry, location) {
    const yelpUrl = `https://www.yelp.com/search?find_desc=${encodeURIComponent(industry)}&find_loc=${encodeURIComponent(location)}`;
    const html = await this._fetchHtml(yelpUrl);

    const businesses = [];
    const processedNames = new Set();

    // Match business links: /biz/business-name
    const bizLinkRegex = /<a[^>]+href=["'](\/biz\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = bizLinkRegex.exec(html)) !== null) {
      const href = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();

      if (!text || text.length < 2 || text.length > 100 || processedNames.has(text)) continue;
      processedNames.add(text);

      // Look for phone in nearby text (within ~500 chars after link)
      const afterLink = html.substring(match.index, match.index + 1000);
      const phoneMatch = afterLink.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      const ratingMatch = afterLink.match(/(\d+\.?\d*)\s*star/i);
      const addressMatch = afterLink.match(/\d+\s+[A-Za-z\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Cir|Pkwy|Hwy|Suite|Ste)\b[^,\n]*/i);

      businesses.push({
        name: text,
        address: addressMatch ? addressMatch[0].trim() : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        rating: ratingMatch ? ratingMatch[1] : '',
        businessType: '',
        website: '',
        yelpUrl: `https://www.yelp.com${href}`,
        sourceType: 'yelp',
      });
    }

    return businesses;
  }

  /**
   * Fetch + parse DuckDuckGo HTML search results
   */
  async _fetchDuckDuckGo(query) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const html = await this._fetchHtml(searchUrl);

    const businesses = [];

    // Parse DDG result links and snippets
    const linkRegex = /<a[^>]+class="result__a"[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

    const links = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      let url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const realUrl = url.match(/uddg=([^&]+)/);
      if (realUrl) url = decodeURIComponent(realUrl[1]);
      if (title && url.startsWith('http') && !url.includes('duckduckgo.com')) {
        links.push({ title, url });
      }
    }

    const snippets = [];
    while ((match = snippetRegex.exec(html)) !== null) {
      snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
    }

    const skipDomains = /yelp\.com\/search|yellowpages|wikipedia|youtube|tripadvisor\.com\/(Tourism|Restaurants-g|Hotels-g)|whitepages|manta\.com|bbb\.org|chamberofcommerce/i;
    const skipTitles = /\blist of\b|\btop \d+\b|\bbest \d+\b|\bdirectory\b|\bwhite pages\b|\bnear you\b/i;

    for (let i = 0; i < links.length && i < 15; i++) {
      const { title, url } = links[i];
      const snippet = snippets[i] || '';

      if (skipDomains.test(url) || skipTitles.test(title)) continue;

      const phoneMatch = snippet.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      const addressMatch = snippet.match(/\d+\s+[A-Za-z\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Cir|Pkwy|Hwy|Suite|Ste)\b[^.;]*/i);

      let bizName = title.split(' - ')[0].split(' | ')[0].split(' — ')[0].trim();
      if (bizName.length < 3 || bizName.length > 100) continue;

      businesses.push({
        name: bizName,
        address: addressMatch ? addressMatch[0].trim() : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        rating: '',
        businessType: '',
        website: url,
        snippet: snippet.substring(0, 300),
        sourceType: 'duckduckgo',
      });
    }

    return businesses;
  }

  /**
   * Fetch + parse Bing search results
   */
  async _fetchBing(query) {
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=20`;
    const html = await this._fetchHtml(searchUrl);

    const businesses = [];

    // Parse Bing organic results
    const resultRegex = /<li[^>]+class="b_algo"[^>]*>([\s\S]*?)<\/li>/gi;
    let match;
    while ((match = resultRegex.exec(html)) !== null) {
      const block = match[1];

      const titleMatch = block.match(/<h2[^>]*><a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);

      if (!titleMatch) continue;

      const url = titleMatch[1];
      const title = titleMatch[2].replace(/<[^>]+>/g, '').trim();
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

      const skipDomains = /yelp\.com\/search|yellowpages|wikipedia|youtube|tripadvisor\.com\/Tourism/i;
      if (skipDomains.test(url)) continue;

      const phoneMatch = snippet.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
      const addressMatch = snippet.match(/\d+\s+[A-Za-z\s]+(?:St|Ave|Blvd|Dr|Rd|Ln|Way|Ct|Pl|Cir|Pkwy|Hwy|Suite|Ste)\b[^.;]*/i);

      let bizName = title.split(' - ')[0].split(' | ')[0].split(' — ')[0].trim();
      if (bizName.length < 3 || bizName.length > 100) continue;

      businesses.push({
        name: bizName,
        address: addressMatch ? addressMatch[0].trim() : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        rating: '',
        businessType: '',
        website: url,
        snippet: snippet.substring(0, 300),
        sourceType: 'bing',
      });
    }

    return businesses;
  }

  /**
   * Scrape a business website for contact info via fetch
   */
  async _scrapeContactInfo(url) {
    const result = { phone: '', email: '', address: '' };

    const contactUrls = [url];
    try {
      const baseUrl = new URL(url);
      contactUrls.push(
        `${baseUrl.origin}/contact`,
        `${baseUrl.origin}/contact-us`,
        `${baseUrl.origin}/about`
      );
    } catch (e) { /* invalid URL */ }

    for (const targetUrl of contactUrls) {
      try {
        const html = await this._fetchHtml(targetUrl);

        // Strip scripts/styles for cleaner text
        const text = html
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ');

        // Extract phone
        const phoneMatches = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g);
        const phone = phoneMatches ? phoneMatches[0] : '';

        // Extract email
        const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        const emails = (emailMatches || []).filter(e =>
          !e.includes('example.com') && !e.includes('sentry.io') &&
          !e.includes('wixpress.com') && !e.includes('schema.org')
        );
        const email = emails.length > 0 ? emails[0] : '';

        // Extract address from structured data or pattern
        let address = '';
        const addressMatch = html.match(/<address[^>]*>([\s\S]*?)<\/address>/i);
        if (addressMatch) {
          address = addressMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
        }

        if (phone || email) {
          return { phone, email, address };
        }
      } catch (e) {
        continue;
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════
  // STRATEGY 3: GENERATED FALLBACK (last resort)
  // ═══════════════════════════════════════════════════════

  generateFallbackLeads(industry, location, count = 5) {
    const firstNames = ['James', 'Sarah', 'Michael', 'Jennifer', 'David', 'Maria', 'Robert', 'Lisa', 'Carlos', 'Emily'];
    const lastNames = ['Johnson', 'Williams', 'Martinez', 'Brown', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Wilson', 'Anderson'];

    const companyPrefixes = {
      'real estate': ['Premier', 'Coastal', 'Sunshine', 'Elite', 'First', 'National', 'Heritage', 'Pacific', 'Metro', 'Crown'],
      'technology': ['TechVista', 'DataFlow', 'CloudNine', 'ByteForce', 'Neural', 'Quantum', 'Pixel', 'CyberEdge', 'DigiCore', 'CodeCraft'],
      'healthcare': ['MedCore', 'HealthFirst', 'WellCare', 'VitalPath', 'CurePoint', 'MediLink', 'PrimeCare', 'BioHealth', 'LifeSpan', 'CareView'],
      'finance': ['Capital', 'Wealth', 'Trust', 'Equity', 'Sterling', 'Meridian', 'Summit', 'Apex', 'Pinnacle', 'Fortress'],
      'construction': ['BuildRight', 'StoneBridge', 'Ironclad', 'ProBuild', 'Structural', 'Foundation', 'Keystone', 'FrameWorks', 'SolidGround', 'Apex'],
      'food & beverage': ['Culinary', 'Fresh', 'Garden', 'Harvest', 'Artisan', 'Savory', 'Golden', 'Blue Plate', 'Farm Table', 'Rustic'],
      'events': ['Encore', 'Spotlight', 'GrandEvent', 'Prestige', 'Celebration', 'Momentum', 'Horizon', 'Luxe', 'Vivid', 'Elevate'],
      'marketing': ['BrandForge', 'MediaPulse', 'CreativeEdge', 'Amplify', 'Catalyst', 'Ignite', 'Nexus', 'Prism', 'Beacon', 'Spark'],
      'legal': ['Justice', 'Liberty', 'Sterling', 'Advocate', 'Counsel', 'Lexington', 'Barrington', 'Commonwealth', 'Heritage', 'Prestige']
    };

    const companySuffixes = {
      'real estate': ['Realty', 'Properties', 'Real Estate Group', 'Homes', 'Investments'],
      'technology': ['Technologies', 'Solutions', 'Systems', 'Labs', 'Digital'],
      'healthcare': ['Health', 'Medical Group', 'Clinic', 'Wellness Center', 'Healthcare'],
      'finance': ['Financial', 'Advisors', 'Partners', 'Capital Group', 'Investments'],
      'construction': ['Construction', 'Builders', 'Contracting', 'Development', 'Services'],
      'food & beverage': ['Kitchen', 'Catering', 'Restaurant Group', 'Bistro', 'Foods'],
      'events': ['Events', 'Productions', 'Entertainment', 'Experiences', 'Co.'],
      'marketing': ['Marketing', 'Agency', 'Creative', 'Media', 'Group'],
      'legal': ['Law Firm', 'Legal Group', '& Associates', 'Attorneys', 'Law']
    };

    const prefixes = companyPrefixes[industry] || companyPrefixes['technology'];
    const suffixes = companySuffixes[industry] || companySuffixes['technology'];

    const leads = [];
    for (let i = 0; i < count; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      const company = `${prefix} ${suffix}`;
      const emailDomain = company.toLowerCase().replace(/[^a-z]/g, '') + '.com';

      leads.push({
        name: `${firstName} ${lastName}`,
        company: company,
        phone: `(${Math.floor(200 + Math.random() * 800)}) ${Math.floor(200 + Math.random() * 800)}-${Math.floor(1000 + Math.random() * 9000)}`,
        address: '',
        website: '',
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`,
        rating: null,
        reviewCount: 0,
        businessType: '',
        googleMapsUrl: '',
        source: 'generated_fallback',
        industry: industry,
        location: location,
        stage: 'new',
        notes: `⚠️ GENERATED LEAD (not verified). ${industry} prospect in ${location}. Real search methods were unavailable. Needs verification.`,
        createdAt: new Date().toISOString()
      });
    }

    return leads;
  }

  // ═══════════════════════════════════════════════════════
  // UTILITY METHODS
  // ═══════════════════════════════════════════════════════

  _cleanPhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^\d()+.\-\s]/g, '').trim();
    const phoneMatch = cleaned.match(/\+?1?\s*\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
    return phoneMatch ? phoneMatch[0] : cleaned.substring(0, 20);
  }

  _parseRating(ratingStr) {
    if (!ratingStr) return null;
    if (typeof ratingStr === 'number') return ratingStr;
    const match = String(ratingStr).match(/(\d+\.?\d*)/);
    if (match) {
      const num = parseFloat(match[1]);
      return num <= 5 ? num : null;
    }
    return null;
  }
}

export default LeadFinder;
