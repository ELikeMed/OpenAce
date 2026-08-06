/**
 * ContactEnricher — Scrapes business websites for contact information
 *
 * Looks for email addresses, phone numbers, and contact page info
 * from the business's website.
 */

import axios from 'axios';

// Common contact page paths to check
const CONTACT_PATHS = ['', '/contact', '/about', '/contact-us', '/about-us'];

// Email regex
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone regex (US formats)
const PHONE_REGEX = /(?:\+1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}/g;

export class ContactEnricher {
  constructor() {
    this.timeout = 8000; // 8 second timeout per request
  }

  /**
   * Enrich a prospect with contact info from their website
   */
  async enrich(prospect) {
    if (!prospect.website) return { emails: [], phones: [], contactPerson: null };

    const results = {
      emails: new Set(),
      phones: new Set(),
      contactPerson: null
    };

    // Normalize website URL
    let baseUrl = prospect.website;
    if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
    baseUrl = baseUrl.replace(/\/+$/, '');

    for (const path of CONTACT_PATHS) {
      try {
        const url = baseUrl + path;
        const html = await this._fetchPage(url);
        if (!html) continue;

        // Extract emails
        const emails = html.match(EMAIL_REGEX) || [];
        for (const email of emails) {
          const lower = email.toLowerCase();
          // Filter out common junk
          if (!lower.includes('example.com') &&
              !lower.includes('sentry.io') &&
              !lower.includes('wixpress') &&
              !lower.includes('googleapis') &&
              !lower.endsWith('.png') &&
              !lower.endsWith('.jpg')) {
            results.emails.add(lower);
          }
        }

        // Extract phones
        const phones = html.match(PHONE_REGEX) || [];
        for (const phone of phones) {
          const cleaned = phone.replace(/[^0-9+]/g, '');
          if (cleaned.length >= 10) {
            results.phones.add(phone.trim());
          }
        }

      } catch {
        // Skip failed pages
      }
    }

    return {
      emails: [...results.emails].slice(0, 5),
      phones: [...results.phones].slice(0, 3),
      contactPerson: null // Could be enhanced with AI later
    };
  }

  /**
   * Batch enrich multiple prospects
   */
  async batchEnrich(prospects) {
    const results = [];
    for (const prospect of prospects) {
      try {
        const contactInfo = await this.enrich(prospect);
        results.push(contactInfo);
      } catch {
        results.push({ emails: [], phones: [], contactPerson: null });
      }
      // Be polite to servers
      await new Promise(r => setTimeout(r, 500));
    }
    return results;
  }

  async _fetchPage(url) {
    try {
      const res = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; LocalBusinessBot/1.0)',
          'Accept': 'text/html'
        },
        maxRedirects: 3,
        // Only get first 500KB
        maxContentLength: 500 * 1024
      });
      return typeof res.data === 'string' ? res.data : '';
    } catch {
      return null;
    }
  }
}
