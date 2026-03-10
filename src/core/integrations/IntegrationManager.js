import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * SERVICE_CATALOG — built-in services Ace knows about.
 * Each entry defines metadata; user state (enabled, keys, notes) stored separately.
 */
const SERVICE_CATALOG = [
  // ── Communication ──
  { id: 'slack', name: 'Slack', category: 'communication', description: 'Team messaging and channels', url: 'https://slack.com', keywords: ['slack', 'slack.com'] },
  { id: 'discord', name: 'Discord', category: 'communication', description: 'Community servers and voice chat', url: 'https://discord.com', keywords: ['discord', 'discord.com'] },
  { id: 'twilio', name: 'Twilio', category: 'communication', description: 'SMS, voice calls, and WhatsApp messaging', url: 'https://twilio.com', keywords: ['twilio', 'twilio.com', 'sms', 'text message'], hasBackendSupport: true },
  { id: 'whatsapp', name: 'WhatsApp Business', category: 'communication', description: 'Business messaging via WhatsApp', url: 'https://business.whatsapp.com', keywords: ['whatsapp', 'whatsapp.com'] },
  { id: 'zoom', name: 'Zoom', category: 'communication', description: 'Video meetings and webinars', url: 'https://zoom.us', keywords: ['zoom', 'zoom.us'] },
  { id: 'teams', name: 'Microsoft Teams', category: 'communication', description: 'Team collaboration and meetings', url: 'https://teams.microsoft.com', keywords: ['teams', 'microsoft teams'] },

  // ── Payments ──
  { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Online payments, invoicing, and subscriptions', url: 'https://stripe.com', keywords: ['stripe', 'stripe.com'] },
  { id: 'square', name: 'Square', category: 'payments', description: 'Point-of-sale and online payments', url: 'https://squareup.com', keywords: ['square', 'squareup.com'] },
  { id: 'paypal', name: 'PayPal', category: 'payments', description: 'Online payments and invoicing', url: 'https://paypal.com', keywords: ['paypal', 'paypal.com'] },
  { id: 'quickbooks', name: 'QuickBooks', category: 'payments', description: 'Accounting, invoicing, and bookkeeping', url: 'https://quickbooks.intuit.com', keywords: ['quickbooks', 'intuit', 'quickbooks.intuit.com'] },

  // ── CRM ──
  { id: 'hubspot', name: 'HubSpot', category: 'crm', description: 'CRM, marketing, and sales hub', url: 'https://hubspot.com', keywords: ['hubspot', 'hubspot.com'] },
  { id: 'salesforce', name: 'Salesforce', category: 'crm', description: 'Enterprise CRM and sales platform', url: 'https://salesforce.com', keywords: ['salesforce', 'salesforce.com'] },
  { id: 'pipedrive', name: 'Pipedrive', category: 'crm', description: 'Sales pipeline and deal management', url: 'https://pipedrive.com', keywords: ['pipedrive', 'pipedrive.com'] },
  { id: 'zoho', name: 'Zoho CRM', category: 'crm', description: 'CRM and business suite', url: 'https://zoho.com/crm', keywords: ['zoho', 'zoho.com'] },

  // ── Marketing ──
  { id: 'mailchimp', name: 'Mailchimp', category: 'marketing', description: 'Email marketing and automations', url: 'https://mailchimp.com', keywords: ['mailchimp', 'mailchimp.com'] },
  { id: 'sendgrid', name: 'SendGrid', category: 'marketing', description: 'Transactional and marketing email', url: 'https://sendgrid.com', keywords: ['sendgrid', 'sendgrid.com'] },
  { id: 'constant-contact', name: 'Constant Contact', category: 'marketing', description: 'Email marketing and campaigns', url: 'https://constantcontact.com', keywords: ['constant contact', 'constantcontact.com'] },
  { id: 'hootsuite', name: 'Hootsuite', category: 'marketing', description: 'Social media management and scheduling', url: 'https://hootsuite.com', keywords: ['hootsuite', 'hootsuite.com'] },

  // ── Productivity ──
  { id: 'notion', name: 'Notion', category: 'productivity', description: 'Notes, docs, wikis, and project management', url: 'https://notion.so', keywords: ['notion', 'notion.so'] },
  { id: 'trello', name: 'Trello', category: 'productivity', description: 'Kanban boards and project tracking', url: 'https://trello.com', keywords: ['trello', 'trello.com'] },
  { id: 'asana', name: 'Asana', category: 'productivity', description: 'Work management and task tracking', url: 'https://asana.com', keywords: ['asana', 'asana.com'] },
  { id: 'monday', name: 'Monday.com', category: 'productivity', description: 'Work OS and project management', url: 'https://monday.com', keywords: ['monday', 'monday.com'] },
  { id: 'google-workspace', name: 'Google Workspace', category: 'productivity', description: 'Gmail, Drive, Docs, Sheets, Calendar', url: 'https://workspace.google.com', keywords: ['google workspace', 'gmail', 'google docs', 'google sheets'] },
  { id: 'microsoft-365', name: 'Microsoft 365', category: 'productivity', description: 'Outlook, Word, Excel, OneDrive', url: 'https://microsoft365.com', keywords: ['microsoft 365', 'office 365', 'outlook', 'excel', 'word'] },

  // ── E-Commerce ──
  { id: 'shopify', name: 'Shopify', category: 'ecommerce', description: 'Online store and e-commerce platform', url: 'https://shopify.com', keywords: ['shopify', 'shopify.com'] },
  { id: 'woocommerce', name: 'WooCommerce', category: 'ecommerce', description: 'WordPress e-commerce plugin', url: 'https://woocommerce.com', keywords: ['woocommerce', 'woo commerce', 'woocommerce.com'] },
  { id: 'bigcommerce', name: 'BigCommerce', category: 'ecommerce', description: 'Enterprise e-commerce platform', url: 'https://bigcommerce.com', keywords: ['bigcommerce', 'bigcommerce.com'] },

  // ── Storage ──
  { id: 'google-drive', name: 'Google Drive', category: 'storage', description: 'Cloud file storage and sharing', url: 'https://drive.google.com', keywords: ['google drive', 'gdrive', 'drive.google.com'] },
  { id: 'dropbox', name: 'Dropbox', category: 'storage', description: 'Cloud storage and file sync', url: 'https://dropbox.com', keywords: ['dropbox', 'dropbox.com'] },
  { id: 'onedrive', name: 'OneDrive', category: 'storage', description: 'Microsoft cloud storage', url: 'https://onedrive.live.com', keywords: ['onedrive', 'one drive'] },
  { id: 'box', name: 'Box', category: 'storage', description: 'Enterprise content management', url: 'https://box.com', keywords: ['box', 'box.com'] },

  // ── Analytics ──
  { id: 'google-analytics', name: 'Google Analytics', category: 'analytics', description: 'Website traffic and user analytics', url: 'https://analytics.google.com', keywords: ['google analytics', 'ga4', 'analytics.google.com'] },
  { id: 'mixpanel', name: 'Mixpanel', category: 'analytics', description: 'Product analytics and user tracking', url: 'https://mixpanel.com', keywords: ['mixpanel', 'mixpanel.com'] },
  { id: 'hotjar', name: 'Hotjar', category: 'analytics', description: 'Heatmaps, recordings, and feedback', url: 'https://hotjar.com', keywords: ['hotjar', 'hotjar.com'] },
];

const CATEGORIES = [
  { id: 'communication', label: 'Communication' },
  { id: 'payments', label: 'Payments' },
  { id: 'crm', label: 'CRM' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'ecommerce', label: 'E-Commerce' },
  { id: 'storage', label: 'Storage' },
  { id: 'analytics', label: 'Analytics' },
];

class IntegrationManager {
  constructor({ dataDir = 'data/config', sopManager = null } = {}) {
    this.dataDir = dataDir;
    this.configPath = path.join(dataDir, 'integrations.json');
    this.sopManager = sopManager;

    // User state: { [serviceId]: { enabled, tier, apiKeys, enabledAt, notes } }
    this.state = {};
    // Custom services added by user
    this.customServices = [];
  }

  async initialize() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this._loadState();
    console.log(`[IntegrationManager] Loaded ${Object.keys(this.state).length} enabled integrations`);
    return this;
  }

  // ═══════════════════════════════════════════════════════════
  // STATE MANAGEMENT
  // ═══════════════════════════════════════════════════════════

  async enable(serviceId) {
    const service = this._findService(serviceId);
    if (!service) throw new Error(`Unknown service: ${serviceId}`);

    if (!this.state[serviceId]) {
      this.state[serviceId] = {
        enabled: true,
        tier: 'aware',
        enabledAt: new Date().toISOString(),
        notes: '',
      };
    } else {
      this.state[serviceId].enabled = true;
    }

    // Auto-detect trained tier
    await this._checkTrainedTier(serviceId);
    await this._saveState();
    return this.state[serviceId];
  }

  async disable(serviceId) {
    if (this.state[serviceId]) {
      this.state[serviceId].enabled = false;
    }
    await this._saveState();
  }

  async updateNotes(serviceId, notes) {
    if (!this.state[serviceId]) {
      await this.enable(serviceId);
    }
    this.state[serviceId].notes = notes;
    await this._saveState();
    return this.state[serviceId];
  }

  async addCustomService(data) {
    const id = 'custom-' + (data.name || 'service')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .substring(0, 40);

    if (this._findService(id)) throw new Error(`Service "${id}" already exists`);

    const custom = {
      id,
      name: data.name,
      category: data.category || 'productivity',
      description: data.description || '',
      url: data.url || '',
      keywords: [data.name.toLowerCase(), ...(data.keywords || [])],
      custom: true,
    };
    this.customServices.push(custom);
    await this._saveState();
    return custom;
  }

  async removeCustomService(id) {
    this.customServices = this.customServices.filter(s => s.id !== id);
    delete this.state[id];
    await this._saveState();
  }

  // ═══════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════

  getAll() {
    const allServices = [...SERVICE_CATALOG, ...this.customServices];
    return allServices.map(service => ({
      ...service,
      state: this.state[service.id] || { enabled: false, tier: 'off', apiKeys: {}, notes: '' },
    }));
  }

  getEnabled() {
    return this.getAll().filter(s => s.state.enabled);
  }

  getCategories() {
    return CATEGORIES;
  }

  getLinkedSOPs(serviceId) {
    if (!this.sopManager) return [];
    const service = this._findService(serviceId);
    if (!service) return [];

    try {
      const allSOPs = this.sopManager.listSOPs?.() || [];
      return allSOPs.filter(sop => {
        const text = `${sop.name || ''} ${(sop.keywords || []).join(' ')} ${(sop.triggers || []).join(' ')}`.toLowerCase();
        return service.keywords.some(kw => text.includes(kw.toLowerCase()));
      });
    } catch {
      return [];
    }
  }

  /**
   * Returns a markdown summary of the user's tech stack for system prompt injection.
   */
  getContextSummary() {
    const enabled = this.getEnabled();
    if (enabled.length === 0) return '';

    const lines = ['The user uses the following tools and services:'];
    const byCategory = {};
    for (const svc of enabled) {
      const cat = svc.category || 'other';
      if (!byCategory[cat]) byCategory[cat] = [];
      let entry = `${svc.name}`;
      if (svc.state.tier === 'connected') entry += ' (API connected)';
      else if (svc.state.tier === 'trained') entry += ' (has trained SOPs)';
      if (svc.state.notes) entry += ` — ${svc.state.notes}`;
      byCategory[cat].push(entry);
    }

    for (const [cat, services] of Object.entries(byCategory)) {
      const label = CATEGORIES.find(c => c.id === cat)?.label || cat;
      lines.push(`**${label}**: ${services.join(', ')}`);
    }

    lines.push('');
    lines.push('When the user mentions these services, you can offer to navigate to them, help them use them, or reference their trained SOPs.');

    return lines.join('\n');
  }

  /**
   * Returns list of all enabled service keywords for tool selection enhancement.
   */
  getEnabledKeywords() {
    const enabled = this.getEnabled();
    const keywords = new Set();
    for (const svc of enabled) {
      for (const kw of svc.keywords) {
        keywords.add(kw.toLowerCase());
      }
    }
    return [...keywords];
  }

  // ═══════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════

  _findService(id) {
    return SERVICE_CATALOG.find(s => s.id === id) || this.customServices.find(s => s.id === id);
  }

  async _checkTrainedTier(serviceId) {
    if (!this.state[serviceId]) return;
    // Don't downgrade services that have API connections
    if (this.state[serviceId].tier === 'connected') return;
    const linkedSOPs = this.getLinkedSOPs(serviceId);
    if (linkedSOPs.length > 0) {
      this.state[serviceId].tier = 'trained';
    } else {
      this.state[serviceId].tier = 'aware';
    }
  }

  async _loadState() {
    try {
      if (existsSync(this.configPath)) {
        const raw = await fs.readFile(this.configPath, 'utf-8');
        const data = JSON.parse(raw);
        this.state = data.state || {};
        this.customServices = data.customServices || [];
      }
    } catch (e) {
      console.error('[IntegrationManager] Failed to load state:', e.message);
      this.state = {};
      this.customServices = [];
    }
  }

  async _saveState() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify({
      state: this.state,
      customServices: this.customServices,
      updatedAt: new Date().toISOString(),
    }, null, 2));
  }
}

export { SERVICE_CATALOG, CATEGORIES };
export default IntegrationManager;
