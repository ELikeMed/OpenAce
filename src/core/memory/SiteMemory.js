/**
 * Site Memory - Ace's Brain for Websites
 * 
 * Stores knowledge about sites Ace has visited:
 * - Page structure (buttons, forms, navigation)
 * - Login credentials and methods
 * - Learned navigation patterns
 * 
 * This means Ace doesn't need to re-learn or waste API tokens!
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class SiteMemory {
  constructor(options = {}) {
    this.dataDir = options.dataDir || './data/memory';
    this.sites = new Map();
    this.credentials = new Map(); // Encrypted credentials
    this.encryptionKey = options.encryptionKey || 'ace-default-key-change-in-production';
  }

  /**
   * Initialize - load existing site knowledge
   */
  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'sites'), { recursive: true });
    await fs.mkdir(path.join(this.dataDir, 'credentials'), { recursive: true });
    
    // Load existing site knowledge
    await this.loadAllSites();
    await this.loadCredentials();
    
    console.log(`🧠 Site Memory initialized with ${this.sites.size} known sites`);
    return this;
  }

  /**
   * Load all site knowledge from disk
   */
  async loadAllSites() {
    try {
      const sitesDir = path.join(this.dataDir, 'sites');
      const files = await fs.readdir(sitesDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(sitesDir, file), 'utf8');
          const site = JSON.parse(data);
          this.sites.set(site.domain, site);
        }
      }
    } catch (e) {
      // No sites yet
    }
  }

  /**
   * Load encrypted credentials
   */
  async loadCredentials() {
    try {
      const credFile = path.join(this.dataDir, 'credentials', 'credentials.enc');
      const data = await fs.readFile(credFile, 'utf8');
      const decrypted = this.decrypt(data);
      const creds = JSON.parse(decrypted);
      
      for (const [key, value] of Object.entries(creds)) {
        this.credentials.set(key, value);
      }
    } catch (e) {
      // No credentials yet
    }
  }

  /**
   * Save credentials (encrypted)
   */
  async saveCredentials() {
    const creds = Object.fromEntries(this.credentials);
    const encrypted = this.encrypt(JSON.stringify(creds));
    await fs.writeFile(
      path.join(this.dataDir, 'credentials', 'credentials.enc'),
      encrypted
    );
  }

  /**
   * Encrypt data
   */
  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt data
   */
  decrypt(encryptedText) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Extract domain from URL
   */
  getDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  /**
   * Remember site structure (from page exploration)
   */
  async rememberSite(url, exploration) {
    const domain = this.getDomain(url);
    
    const siteKnowledge = {
      domain,
      url,
      lastVisited: new Date().toISOString(),
      title: exploration.analysis?.title || '',
      
      // Page structure
      navigation: exploration.analysis?.navigation || [],
      sections: exploration.analysis?.sections || [],
      buttons: exploration.analysis?.buttons || [],
      forms: exploration.analysis?.forms || [],
      tables: exploration.analysis?.tables || [],
      cards: exploration.analysis?.cards || [],
      
      // Learned patterns
      loginFlow: this.sites.get(domain)?.loginFlow || null,
      commonActions: this.sites.get(domain)?.commonActions || [],
      
      // Visit history
      visitCount: (this.sites.get(domain)?.visitCount || 0) + 1
    };

    this.sites.set(domain, siteKnowledge);
    
    // Save to disk
    await fs.writeFile(
      path.join(this.dataDir, 'sites', `${domain}.json`),
      JSON.stringify(siteKnowledge, null, 2)
    );

    return siteKnowledge;
  }

  /**
   * Remember login flow for a site
   */
  async rememberLoginFlow(url, loginFlow) {
    const domain = this.getDomain(url);
    
    const existing = this.sites.get(domain) || { domain };
    existing.loginFlow = {
      ...loginFlow,
      learnedAt: new Date().toISOString()
    };
    existing.lastUpdated = new Date().toISOString();
    
    this.sites.set(domain, existing);
    
    await fs.writeFile(
      path.join(this.dataDir, 'sites', `${domain}.json`),
      JSON.stringify(existing, null, 2)
    );

    return existing;
  }

  /**
   * Store credentials for a site
   */
  async storeCredentials(id, credentials) {
    this.credentials.set(id, {
      ...credentials,
      storedAt: new Date().toISOString()
    });
    
    await this.saveCredentials();
  }

  /**
   * Get credentials for a site
   */
  getCredentials(id) {
    return this.credentials.get(id);
  }

  /**
   * Check if we know a site
   */
  knowsSite(url) {
    const domain = this.getDomain(url);
    return this.sites.has(domain);
  }

  /**
   * Get site knowledge
   */
  getSiteKnowledge(url) {
    const domain = this.getDomain(url);
    return this.sites.get(domain);
  }

  /**
   * Get navigation instructions for a site
   */
  getNavigationHelp(url, targetText) {
    const knowledge = this.getSiteKnowledge(url);
    if (!knowledge) return null;

    // Search navigation, buttons, and sections for matching text
    const target = targetText.toLowerCase();
    
    // Check navigation
    const navMatch = knowledge.navigation?.find(n => 
      n.text.toLowerCase().includes(target)
    );
    if (navMatch) {
      return { type: 'navigation', ...navMatch };
    }

    // Check buttons
    const btnMatch = knowledge.buttons?.find(b => 
      b.text.toLowerCase().includes(target)
    );
    if (btnMatch) {
      return { type: 'button', ...btnMatch };
    }

    // Check sections
    const secMatch = knowledge.sections?.find(s => 
      s.heading.toLowerCase().includes(target)
    );
    if (secMatch) {
      return { type: 'section', ...secMatch };
    }

    return null;
  }

  /**
   * Get all known sites
   */
  getAllSites() {
    return Array.from(this.sites.values());
  }

  /**
   * Get summary of knowledge for AI context
   */
  getSummary() {
    const sites = this.getAllSites();
    if (sites.length === 0) {
      return "I don't know any sites yet. I'll learn as I visit them.";
    }

    let summary = "Sites I know:\n";
    for (const site of sites) {
      summary += `\n• ${site.domain}`;
      if (site.title) summary += ` - ${site.title}`;
      if (site.loginFlow) summary += ' (can log in)';
      if (site.navigation?.length > 0) {
        summary += `\n  Navigation: ${site.navigation.slice(0, 5).map(n => n.text).join(', ')}`;
      }
    }
    
    return summary;
  }
}

export default SiteMemory;
