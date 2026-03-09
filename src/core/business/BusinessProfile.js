import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

/**
 * BusinessManager — manages multiple business profiles with an active pointer.
 * Replaces the old single-profile BusinessProfile class.
 *
 * Data structure:
 *   data/business/profiles.json  — array of business objects
 *   data/business/active.json    — { activeId: "slug" }
 *   data/businesses/{slug}/      — per-business data (pipeline, contacts)
 */
class BusinessManager {
  constructor(dataDir = 'data/business') {
    this.dataDir = dataDir;
    this.businessesDir = path.join(path.dirname(dataDir), 'businesses');
    this.profilesPath = path.join(dataDir, 'profiles.json');
    this.activePath = path.join(dataDir, 'active.json');

    this.profiles = [];
    this.activeId = null;
  }

  // ═══════════════════════════════════════════════════════════
  // LOAD & MIGRATION
  // ═══════════════════════════════════════════════════════════

  async load() {
    await fs.mkdir(this.dataDir, { recursive: true });

    if (existsSync(this.profilesPath)) {
      // New format — load profiles array
      const raw = await fs.readFile(this.profilesPath, 'utf-8');
      this.profiles = JSON.parse(raw);
    } else {
      // First boot — migrate from old profile.json
      await this._migrate();
    }

    // Load active pointer
    if (existsSync(this.activePath)) {
      const raw = await fs.readFile(this.activePath, 'utf-8');
      this.activeId = JSON.parse(raw).activeId;
    }

    // Fallback to first profile
    if (!this.activeId && this.profiles.length > 0) {
      this.activeId = this.profiles[0].id;
      await this._saveActive();
    }

    return this.getActive();
  }

  /**
   * Migrate old single profile.json → profiles.json (non-destructive)
   */
  async _migrate() {
    const oldPath = path.join(this.dataDir, 'profile.json');
    if (!existsSync(oldPath)) {
      this.profiles = [];
      return;
    }

    try {
      const raw = await fs.readFile(oldPath, 'utf-8');
      const old = JSON.parse(raw);
      if (!old.name) {
        this.profiles = [];
        return;
      }

      const slug = _slugify(old.name);
      const entry = {
        ...old,
        id: slug,
        slug,
        createdAt: new Date().toISOString(),
      };
      this.profiles = [entry];
      await this._saveProfiles();
      console.log(`[BusinessManager] Migrated profile.json → profiles.json (id: ${slug})`);
    } catch (e) {
      console.error('[BusinessManager] Migration failed:', e.message);
      this.profiles = [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════

  getActive() {
    return this.profiles.find(p => p.id === this.activeId) || this.profiles[0] || null;
  }

  getById(id) {
    return this.profiles.find(p => p.id === id) || null;
  }

  getAllProfiles() {
    return this.profiles;
  }

  // ═══════════════════════════════════════════════════════════
  // CRUD
  // ═══════════════════════════════════════════════════════════

  async createBusiness(profileData) {
    const slug = _slugify(profileData.name);
    if (this.profiles.find(p => p.id === slug)) {
      throw new Error(`Business "${slug}" already exists`);
    }

    const entry = {
      ...profileData,
      id: slug,
      slug,
      createdAt: new Date().toISOString(),
    };
    this.profiles.push(entry);
    await this._saveProfiles();
    await this.ensureBusinessDirs(slug);
    return entry;
  }

  async updateBusiness(id, updates) {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) throw new Error(`Business "${id}" not found`);

    // Don't allow changing id/slug
    const { id: _id, slug: _slug, ...safeUpdates } = updates;
    this.profiles[idx] = { ...this.profiles[idx], ...safeUpdates };
    await this._saveProfiles();
    return this.profiles[idx];
  }

  async deleteBusiness(id) {
    if (this.profiles.length <= 1) {
      throw new Error('Cannot delete the last business');
    }
    this.profiles = this.profiles.filter(p => p.id !== id);

    // If we deleted the active one, switch to first remaining
    if (this.activeId === id) {
      this.activeId = this.profiles[0].id;
      await this._saveActive();
    }
    await this._saveProfiles();
  }

  async setActive(id) {
    if (!this.profiles.find(p => p.id === id)) {
      throw new Error(`Business "${id}" not found`);
    }
    this.activeId = id;
    await this._saveActive();
  }

  // ═══════════════════════════════════════════════════════════
  // PER-BUSINESS DATA PATHS
  // ═══════════════════════════════════════════════════════════

  getBusinessDataDir(slug) {
    return path.join(this.businessesDir, slug);
  }

  getPipelinePath(slug) {
    return path.join(this.getBusinessDataDir(slug), 'pipeline.json');
  }

  getContactsPath(slug) {
    return path.join(this.getBusinessDataDir(slug), 'contacts.json');
  }

  async ensureBusinessDirs(slug) {
    await fs.mkdir(this.getBusinessDataDir(slug), { recursive: true });
  }

  // ═══════════════════════════════════════════════════════════
  // PERSISTENCE
  // ═══════════════════════════════════════════════════════════

  async _saveProfiles() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.profilesPath, JSON.stringify(this.profiles, null, 2));
  }

  async _saveActive() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(this.activePath, JSON.stringify({ activeId: this.activeId }, null, 2));
  }

  // ═══════════════════════════════════════════════════════════
  // LEGACY SHIMS (keeps AceBrain, ApiGateway, index.js working)
  // ═══════════════════════════════════════════════════════════

  /** @deprecated Use getActive() */
  get(key) {
    const active = this.getActive();
    return active ? active[key] : undefined;
  }

  /** @deprecated Use updateBusiness() */
  set(key, value) {
    const active = this.getActive();
    if (active) active[key] = value;
  }

  /** @deprecated Use getActive() */
  getAll() {
    return this.getActive() || {};
  }

  /** @deprecated Saves the active profile's in-memory changes */
  async save() {
    await this._saveProfiles();
  }

  isConfigured() {
    const active = this.getActive();
    return !!(active?.name?.trim());
  }

  getOwnerName() {
    return this.getActive()?.ownerName || 'Boss';
  }

  getContextSummary() {
    return _buildContextSummary(this.getActive());
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function _slugify(str) {
  return (str || 'business')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 40);
}

function _buildContextSummary(profile) {
  if (!profile || !profile.name) {
    return 'No business profile set. The user has not configured their business details yet.';
  }

  const parts = [];
  parts.push(`## Business Profile: ${profile.name}`);
  if (profile.ownerName)      parts.push(`- Owner: ${profile.ownerName} (address them by name)`);
  if (profile.industry)       parts.push(`- Industry: ${profile.industry}`);
  if (profile.mission)        parts.push(`- Mission: ${profile.mission}`);
  if (profile.targetAudience) parts.push(`- Target Audience: ${profile.targetAudience}`);
  if (profile.offerings?.length) parts.push(`- Key Offerings: ${profile.offerings.join(', ')}`);
  if (profile.location)       parts.push(`- Location: ${profile.location}`);
  if (profile.website)        parts.push(`- Website: ${profile.website}`);

  return parts.join('\n');
}

export default BusinessManager;
