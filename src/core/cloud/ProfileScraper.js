/**
 * ProfileScraper — Scrapes a business website to auto-fill user profiles.
 *
 * Given a URL, extracts:
 * - Business name (from title, og:title, or h1)
 * - Description (from meta description or og:description)
 * - Industry keywords
 * - Location (from address, schema.org, or page content)
 * - Contact email and phone
 *
 * Used during onboarding: user gives their website, Ace fills in everything.
 */

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export class ProfileScraper {

  async scrape(url) {
    if (!url) return null;
    let baseUrl = url;
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
    baseUrl = baseUrl.replace(/\/+$/, '');

    const profile = {
      businessName: null,
      description: null,
      industry: null,
      location: null,
      email: null,
      phone: null,
      website: baseUrl,
    };

    try {
      // Scrape homepage
      const html = await this._fetch(baseUrl);
      if (!html) return profile;

      // Extract meta tags
      const title = this._extract(html, /<title[^>]*>([^<]+)<\/title>/i);
      const ogTitle = this._extractMeta(html, 'og:title');
      const metaDesc = this._extractMeta(html, 'description') || this._extractMeta(html, 'og:description');
      const h1 = this._extract(html, /<h1[^>]*>([^<]+)<\/h1>/i);

      // Business name: og:title > title > h1 (clean up common suffixes)
      let name = ogTitle || title || h1 || '';
      name = name.replace(/\s*[-–|•]\s*(Home|Welcome|Official.*|Website).*$/i, '').trim();
      name = name.replace(/\s*(LLC|Inc|Corp|Ltd|Co)\.?\s*$/i, '').trim();
      if (name && name.length < 80) profile.businessName = name;

      // Description
      if (metaDesc && metaDesc.length > 20) {
        profile.description = metaDesc.substring(0, 300);
      }

      // Extract emails
      const emails = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
      const goodEmails = emails.filter(e =>
        !e.includes('example.com') && !e.includes('wixpress') && !e.includes('sentry') &&
        !e.includes('wordpress') && !e.includes('cloudflare') && !e.includes('googleapis')
      );
      if (goodEmails.length > 0) profile.email = goodEmails[0];

      // Extract phone
      const phones = html.match(/(?:\+1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)[0-9]{3}[-.\s]?[0-9]{4}/g) || [];
      if (phones.length > 0) profile.phone = phones[0];

      // Extract location from schema.org, address tags, or common patterns
      const schemaAddress = this._extract(html, /"addressLocality"\s*:\s*"([^"]+)"/);
      const schemaRegion = this._extract(html, /"addressRegion"\s*:\s*"([^"]+)"/);
      if (schemaAddress) {
        profile.location = schemaRegion ? `${schemaAddress}, ${schemaRegion}` : schemaAddress;
      }
      if (!profile.location) {
        // Try to find city, state pattern in text
        const cityState = html.match(/(?:located in|based in|serving)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2})/i);
        if (cityState) profile.location = cityState[1];
      }

      // Industry detection from keywords
      const text = (metaDesc || '') + ' ' + (title || '') + ' ' + html.substring(0, 5000).toLowerCase();
      profile.industry = this._detectIndustry(text);

      // Try /about page for more info
      try {
        const aboutHtml = await this._fetch(baseUrl + '/about');
        if (aboutHtml) {
          if (!profile.description) {
            const aboutMeta = this._extractMeta(aboutHtml, 'description');
            if (aboutMeta) profile.description = aboutMeta.substring(0, 300);
          }
          if (!profile.email) {
            const aboutEmails = aboutHtml.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
            const goodAbout = aboutEmails.filter(e => !e.includes('example.com') && !e.includes('wixpress'));
            if (goodAbout.length > 0) profile.email = goodAbout[0];
          }
        }
      } catch { /* skip about page */ }

    } catch (e) {
      console.error(`[ProfileScraper] Failed to scrape ${baseUrl}:`, e.message);
    }

    return profile;
  }

  async _fetch(url) {
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!resp.ok) return null;
      return await resp.text();
    } catch { return null; }
  }

  _extract(html, regex) {
    const match = html.match(regex);
    return match ? match[1].trim() : null;
  }

  _extractMeta(html, name) {
    const patterns = [
      new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${name}["']`, 'i'),
      new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${name}["']`, 'i'),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m) return m[1].trim();
    }
    return null;
  }

  _detectIndustry(text) {
    const industries = [
      { keywords: ['real estate', 'property', 'realty', 'homes', 'houses', 'mortgage', 'realtor'], industry: 'Real Estate' },
      { keywords: ['restaurant', 'food', 'dining', 'catering', 'chef', 'menu'], industry: 'Food & Beverage' },
      { keywords: ['construction', 'contractor', 'builder', 'remodel', 'renovation'], industry: 'Construction' },
      { keywords: ['dental', 'dentist', 'orthodont', 'teeth', 'smile'], industry: 'Dental' },
      { keywords: ['medical', 'health', 'clinic', 'doctor', 'patient', 'therapy', 'medspa'], industry: 'Healthcare' },
      { keywords: ['law', 'legal', 'attorney', 'lawyer', 'litigation'], industry: 'Legal' },
      { keywords: ['plumbing', 'hvac', 'electrical', 'roofing', 'landscap', 'cleaning'], industry: 'Home Services' },
      { keywords: ['insurance', 'coverage', 'policy', 'claims'], industry: 'Insurance' },
      { keywords: ['financial', 'investment', 'wealth', 'advisor', 'planning'], industry: 'Financial Services' },
      { keywords: ['fitness', 'gym', 'training', 'workout', 'yoga'], industry: 'Fitness & Wellness' },
      { keywords: ['salon', 'beauty', 'hair', 'spa', 'barber', 'nail'], industry: 'Beauty' },
      { keywords: ['software', 'saas', 'tech', 'platform', 'app', 'developer'], industry: 'Technology' },
      { keywords: ['market', 'brand', 'advertis', 'agency', 'creative', 'digital'], industry: 'Marketing' },
      { keywords: ['consult', 'coach', 'advisory', 'strategy'], industry: 'Consulting' },
      { keywords: ['auto', 'car', 'vehicle', 'mechanic', 'dealership'], industry: 'Automotive' },
      { keywords: ['education', 'tutor', 'school', 'learning', 'training'], industry: 'Education' },
      { keywords: ['ecommerce', 'shop', 'store', 'retail', 'product'], industry: 'Retail' },
    ];
    const lower = text.toLowerCase();
    for (const { keywords, industry } of industries) {
      const matches = keywords.filter(k => lower.includes(k)).length;
      if (matches >= 2) return industry;
    }
    return null;
  }
}
