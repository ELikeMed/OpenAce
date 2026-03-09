/**
 * LikeMindedScraper - Scrapes upcoming events from likemindedpro.com
 *
 * No browser needed — uses pure fetch + HTML parsing.
 *
 * Features:
 * - Scrapes all city pages for upcoming meetups
 * - Extracts event details (name, date, venue, URL)
 * - Feeds events into content calendar for automated posting
 */

import fs from 'fs/promises';

export class LikeMindedScraper {
  constructor(options = {}) {
    this.dataDir = options.dataDir || 'data/social';
    this.eventsPath = options.eventsPath || 'data/social/events.json';

    // All LikeMinded cities with their URLs
    this.cities = {
      'Miami': 'https://likemindedpro.com/miami/',
      'Fort Lauderdale': 'https://likemindedpro.com/fort-lauderdale-/',
      'West Palm Beach': 'https://likemindedpro.com/west-palm-beach/',
      'Boca Raton': 'https://likemindedpro.com/boca-raton-/',
      'Orlando': 'https://likemindedpro.com/orlando-/',
      'Tampa': 'https://likemindedpro.com/tampa/',
      'St. Pete': 'https://likemindedpro.com/st-pete/',
      'Sarasota': 'https://likemindedpro.com/sarasota/',
      'Jacksonville': 'https://likemindedpro.com/jacksonville/',
      'Austin': 'https://likemindedpro.com/austin/',
      'Dallas': 'https://likemindedpro.com/dallas/',
      'NYC': 'https://likemindedpro.com/nyc/',
      'LA': 'https://likemindedpro.com/los-angeles/',
      'Chicago': 'https://likemindedpro.com/chicago/',
      'Denver': 'https://likemindedpro.com/denver/',
      'Atlanta': 'https://likemindedpro.com/atlanta/',
      'Phoenix': 'https://likemindedpro.com/phoenix/',
      'Seattle': 'https://likemindedpro.com/seattle/',
      'San Francisco': 'https://likemindedpro.com/san-francisco/',
      'Portland': 'https://likemindedpro.com/portland/',
      'Nashville': 'https://likemindedpro.com/nashville/'
    };

    // City-specific knowledge
    this.cityKnowledge = {
      'Miami': {
        hashtags: ['#MiamiRealEstate', '#MiamiInvestors', '#SoFloREI', '#LikeMindedMiami'],
        localTags: ['#305', '#MiamiLife', '#Brickell'],
        timezone: 'America/New_York'
      },
      'Austin': {
        hashtags: ['#AustinRealEstate', '#ATXInvestors', '#AustinREI', '#LikeMindedATX'],
        localTags: ['#ATX', '#KeepAustinWeird'],
        timezone: 'America/Chicago'
      },
      'NYC': {
        hashtags: ['#NYCRealEstate', '#NYInvestors', '#NYCREI', '#LikeMindedNYC'],
        localTags: ['#NYC', '#NewYork', '#Manhattan'],
        timezone: 'America/New_York'
      },
      'LA': {
        hashtags: ['#LARealEstate', '#LAInvestors', '#LAREI', '#LikeMindedLA'],
        localTags: ['#LA', '#LosAngeles', '#SoCal'],
        timezone: 'America/Los_Angeles'
      },
      'West Palm Beach': {
        hashtags: ['#WPBRealEstate', '#PalmBeachInvestors', '#LikeMindedWPB'],
        localTags: ['#WestPalmBeach', '#PalmBeach', '#561'],
        timezone: 'America/New_York'
      },
      'Chicago': {
        hashtags: ['#ChicagoRealEstate', '#ChiTownInvestors', '#LikeMindedChi'],
        localTags: ['#Chicago', '#ChiTown'],
        timezone: 'America/Chicago'
      },
      'Denver': {
        hashtags: ['#DenverRealEstate', '#DenverInvestors', '#LikeMindedDenver'],
        localTags: ['#Denver', '#MileHighCity', '#Colorado'],
        timezone: 'America/Denver'
      },
      'Dallas': {
        hashtags: ['#DallasRealEstate', '#DFWInvestors', '#LikeMindedDFW'],
        localTags: ['#Dallas', '#DFW'],
        timezone: 'America/Chicago'
      },
      'Atlanta': {
        hashtags: ['#AtlantaRealEstate', '#ATLInvestors', '#LikeMindedATL'],
        localTags: ['#Atlanta', '#ATL'],
        timezone: 'America/New_York'
      }
    };

    this.events = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });

    // Load cached events
    try {
      const data = await fs.readFile(this.eventsPath, 'utf-8');
      this.events = JSON.parse(data);
      console.log(`📅 Loaded ${this.events.length} cached events`);
    } catch (e) {
      this.events = [];
    }

    this.initialized = true;
  }

  async saveEvents() {
    await fs.writeFile(this.eventsPath, JSON.stringify(this.events, null, 2));
  }

  /**
   * Fetch a page's HTML via native fetch
   */
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

  /**
   * Parse event data from HTML (regex-based, no DOM needed)
   */
  _parseEventsFromHtml(html, cityName) {
    const events = [];

    // Strategy 1: JSON-LD structured data
    const ldJsonRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let ldMatch;
    while ((ldMatch = ldJsonRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(ldMatch[1]);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] === 'Event') {
            events.push({
              name: item.name,
              date: item.startDate,
              venue: item.location?.name || item.location?.address || null,
              url: item.url || null,
              city: cityName,
              structured: true,
            });
          }
        }
      } catch (e) { /* invalid JSON-LD */ }
    }

    // Strategy 2: Links containing "meetup", "register", or "rsvp"
    const linkRegex = /<a[^>]+href=["']([^"']*(?:meetup|register|rsvp|event)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const href = linkMatch[1];
      const text = linkMatch[2].replace(/<[^>]+>/g, '').trim();
      if (text.length > 5 && text.length < 200) {
        // Try to extract a date from the URL
        let date = null;
        const dateInUrl = href.match(/(\d{4}-\d{2}-\d{2})/);
        if (dateInUrl) date = new Date(dateInUrl[1]).toISOString();

        events.push({
          name: text,
          date,
          venue: null,
          url: href.startsWith('http') ? href : `https://likemindedpro.com${href}`,
          city: cityName,
        });
      }
    }

    // Strategy 3: Look for heading + date patterns in event-like sections
    const eventCardRegex = /<(?:div|article|section)[^>]*class=["'][^"']*(?:event|meetup|card)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|article|section)>/gi;
    let cardMatch;
    while ((cardMatch = eventCardRegex.exec(html)) !== null) {
      const cardHtml = cardMatch[1];
      const titleMatch = cardHtml.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i);
      const dateMatch = cardHtml.match(/<time[^>]*(?:datetime=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/time>/i);
      const linkMatch2 = cardHtml.match(/<a[^>]+href=["']([^"']+)["']/i);

      const name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null;
      const date = dateMatch ? (dateMatch[1] || dateMatch[2]?.trim()) : null;
      const url = linkMatch2 ? linkMatch2[1] : null;

      if (name) {
        events.push({
          name,
          date,
          venue: null,
          url: url?.startsWith('http') ? url : url ? `https://likemindedpro.com${url}` : null,
          city: cityName,
        });
      }
    }

    return events;
  }

  /**
   * Scrape all cities for upcoming events (fetch-based, no browser)
   */
  async scrapeAllCities() {
    await this.initialize();

    console.log('🌐 Scraping LikeMinded events from all cities (fetch)...');

    const allEvents = [];

    for (const [city, url] of Object.entries(this.cities)) {
      try {
        console.log(`📍 Fetching ${city}...`);
        const html = await this._fetchHtml(url);
        const cityEvents = this._parseEventsFromHtml(html, city);

        // Add city knowledge
        const cityInfo = this.cityKnowledge[city] || {};
        const enriched = cityEvents.map(e => ({
          ...e,
          hashtags: cityInfo.hashtags || [],
          localTags: cityInfo.localTags || [],
          timezone: cityInfo.timezone || 'America/New_York',
          scrapedAt: new Date().toISOString(),
        }));

        allEvents.push(...enriched);
        if (cityEvents.length > 0) {
          console.log(`  ✓ ${cityEvents.length} events found`);
        }
      } catch (error) {
        console.log(`  ⚠️ ${city} failed: ${error.message}`);
      }
    }

    // Also try the main events page
    try {
      const mainEvents = await this._scrapeMainEventsPage();
      allEvents.push(...mainEvents);
    } catch (e) {
      console.log(`  ⚠️ Main events page failed: ${e.message}`);
    }

    // Deduplicate by URL
    const seen = new Set();
    this.events = allEvents.filter(event => {
      const key = event.url || event.name + event.date;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    await this.saveEvents();

    console.log(`✅ Found ${this.events.length} unique events`);
    return this.events;
  }

  /**
   * Scrape the main events/meetups page (fetch-based)
   */
  async _scrapeMainEventsPage() {
    const eventsUrls = [
      'https://likemindedpro.com/events/',
      'https://likemindedpro.com/meetups/',
      'https://likemindedpro.com/upcoming-events/',
    ];

    const events = [];

    for (const url of eventsUrls) {
      try {
        const html = await this._fetchHtml(url);
        const pageEvents = this._parseEventsFromHtml(html, 'Unknown');

        // Try to detect city from event text or URL
        const enriched = pageEvents.map(e => {
          const cities = Object.keys(this.cities);
          const nameAndUrl = `${e.name} ${e.url || ''}`.toLowerCase();
          const detectedCity = cities.find(c => nameAndUrl.includes(c.toLowerCase().replace(/\s/g, '-')) || nameAndUrl.includes(c.toLowerCase()));
          return { ...e, city: detectedCity || e.city };
        });

        events.push(...enriched);
      } catch (e) {
        // URL didn't work, try next
      }
    }

    return events;
  }

  /**
   * Get upcoming events (filters out past events)
   */
  getUpcomingEvents() {
    const now = new Date();
    return this.events.filter(event => {
      if (!event.date) return true;
      try {
        const eventDate = new Date(event.date);
        if (isNaN(eventDate.getTime())) return true;
        return eventDate >= now;
      } catch {
        return true;
      }
    });
  }

  /**
   * Get events for a specific city
   */
  getEventsForCity(city) {
    return this.events.filter(e =>
      e.city?.toLowerCase() === city.toLowerCase()
    );
  }

  /**
   * Generate content schedule based on scraped events
   */
  generateContentSchedule() {
    const schedule = [];
    const upcoming = this.getUpcomingEvents();

    for (const event of upcoming) {
      if (!event.date) continue;

      const eventDate = new Date(event.date);
      const cityInfo = this.cityKnowledge[event.city] || {};
      const hashtags = [...(cityInfo.hashtags || []), ...['#RealEstateInvesting', '#LikeMinded']].join(' ');

      // 7 days before
      const sevenDaysBefore = new Date(eventDate);
      sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
      if (sevenDaysBefore > new Date()) {
        schedule.push({
          type: 'meetup_announcement',
          scheduledFor: sevenDaysBefore.toISOString(),
          event: event,
          template: '7_days',
          content: `🗓️ ${event.city} Meetup in 1 WEEK!\n\n${event.name}\n📅 ${event.date}\n${event.venue ? `📍 ${event.venue}` : ''}\n\nRegister: ${event.url}\n\n${hashtags}`,
          platforms: ['twitter', 'linkedin', 'facebook', 'instagram']
        });
      }

      // 3 days before
      const threeDaysBefore = new Date(eventDate);
      threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
      if (threeDaysBefore > new Date()) {
        schedule.push({
          type: 'meetup_announcement',
          scheduledFor: threeDaysBefore.toISOString(),
          event: event,
          template: '3_days',
          content: `⏰ 3 DAYS until our ${event.city} meetup!\n\n${event.name}\n📅 ${event.date}\n\nRSVP: ${event.url}\n\n${hashtags}`,
          platforms: ['twitter', 'linkedin', 'facebook']
        });
      }

      // 1 day before
      const oneDayBefore = new Date(eventDate);
      oneDayBefore.setDate(oneDayBefore.getDate() - 1);
      if (oneDayBefore > new Date()) {
        schedule.push({
          type: 'meetup_announcement',
          scheduledFor: oneDayBefore.toISOString(),
          event: event,
          template: '1_day',
          content: `🔥 TOMORROW in ${event.city}!\n\n${event.name}\n\nLast chance to RSVP: ${event.url}\n\n${hashtags}`,
          platforms: ['twitter', 'linkedin', 'facebook', 'instagram']
        });
      }

      // Day of event
      const dayOf = new Date(eventDate);
      dayOf.setHours(12, 0, 0, 0);
      if (dayOf > new Date()) {
        schedule.push({
          type: 'meetup_announcement',
          scheduledFor: dayOf.toISOString(),
          event: event,
          template: 'day_of',
          content: `🚀 TONIGHT in ${event.city}!\n\n${event.name}\n\nSee you there! Walk-ins welcome.\n\n${hashtags}`,
          platforms: ['twitter', 'facebook']
        });
      }
    }

    // Sort by scheduled date
    schedule.sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));

    return schedule;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default LikeMindedScraper;
