import fs from 'fs/promises';
import path from 'path';

const TRIAL_LIMITS = {
  interactions: 100,
  leads: 25,
  forms: 1,
  emails: 10,
  seoAudits: 5,
  blogPosts: 3,
  workloadFiles: 3,
};

const TRIAL_FEATURES = ['chat', 'seo', 'blog', 'pipeline', 'email'];
const PRO_FEATURES = ['chat', 'seo', 'blog', 'pipeline', 'email', 'cron', 'social'];

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TRIAL_DURATION_DAYS = 30;

export class LicenseValidator {
  constructor(licenseKey, dataDir) {
    this.licenseKey = licenseKey || null;
    this.dataDir = dataDir;
    this.cachedLicense = null;
    this.lastValidated = null;
  }

  async validate() {
    // Owner bypass — unlimited Pro, no watermark, no API call
    if (this.licenseKey === 'owner') {
      this.cachedLicense = {
        valid: true,
        plan: 'pro',
        trialDaysLeft: 0,
        features: PRO_FEATURES,
        watermark: false,
        validatedAt: Date.now(),
      };
      this.lastValidated = Date.now();
      return this.cachedLicense;
    }

    // 1. Check local cache (valid for 24 hours)
    const cachePath = path.join(this.dataDir, 'license.json');
    try {
      const raw = await fs.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(raw);
      if (cached.validatedAt && Date.now() - cached.validatedAt < CACHE_TTL_MS) {
        this.cachedLicense = cached;
        this.lastValidated = cached.validatedAt;
        return this.cachedLicense;
      }
    } catch {
      // No cache or unreadable — continue to API or default
    }

    // 2. If we have a key, call the license API
    if (this.licenseKey) {
      try {
        const res = await fetch('https://api.openaceai.com/v1/license/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: this.licenseKey }),
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const license = { ...data, validatedAt: Date.now() };
          this.cachedLicense = license;
          this.lastValidated = Date.now();
          await this._writeCache(cachePath, license);
          return this.cachedLicense;
        }
      } catch {
        // API unreachable — fall back to cache or default trial
      }
    }

    // 3. Fall back to existing cache regardless of age
    if (this.cachedLicense) return this.cachedLicense;

    // 4. Default trial — starts from first use
    const license = {
      valid: true,
      plan: 'trial',
      trialDaysLeft: TRIAL_DURATION_DAYS,
      trialStartedAt: Date.now(),
      features: TRIAL_FEATURES,
      watermark: true,
      validatedAt: Date.now(),
    };
    this.cachedLicense = license;
    this.lastValidated = Date.now();
    await this._writeCache(cachePath, license);
    return this.cachedLicense;
  }

  getPlan() {
    if (!this.cachedLicense) return 'trial';
    const { plan, trialStartedAt } = this.cachedLicense;
    if (plan === 'trial' && trialStartedAt) {
      const elapsed = Date.now() - trialStartedAt;
      if (elapsed > TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000) return 'expired';
    }
    return plan; // 'trial' | 'pro' | 'expired'
  }

  canUse(feature) {
    const plan = this.getPlan();
    if (plan === 'expired') return false;
    if (plan === 'pro') return PRO_FEATURES.includes(feature);
    return TRIAL_FEATURES.includes(feature);
  }

  async checkLimit(feature) {
    const plan = this.getPlan();
    if (plan === 'pro') return { allowed: true, remaining: Infinity, limit: Infinity };
    if (plan === 'expired') return { allowed: false, remaining: 0, limit: 0 };

    const limit = TRIAL_LIMITS[feature];
    if (limit === undefined) return { allowed: false, remaining: 0, limit: 0 };

    const usage = await this._readUsage();
    const period = this._currentPeriod();
    const used = (usage[period] && usage[period][feature]) || 0;
    const remaining = Math.max(0, limit - used);
    return { allowed: remaining > 0, remaining, limit };
  }

  async recordUsage(feature) {
    const usagePath = path.join(this.dataDir, 'usage.json');
    const usage = await this._readUsage();
    const period = this._currentPeriod();
    if (!usage[period]) usage[period] = {};
    usage[period][feature] = (usage[period][feature] || 0) + 1;
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(usagePath, JSON.stringify(usage, null, 2));
  }

  getWatermark() {
    if (!this.cachedLicense) return true;
    return this.cachedLicense.watermark !== false;
  }

  // --- Private helpers ---

  _currentPeriod() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  async _readUsage() {
    try {
      const raw = await fs.readFile(path.join(this.dataDir, 'usage.json'), 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async _writeCache(filePath, data) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch {
      // Silently ignore write failures — non-critical
    }
  }
}
