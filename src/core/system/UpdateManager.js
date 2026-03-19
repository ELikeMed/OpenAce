/**
 * UpdateManager — Version checking, one-click updates, and data migrations.
 *
 * Checks GitHub Releases API on startup + every 24 hours.
 * Update sequence: backup → git pull → npm install → rebuild dashboard → migrate → restart.
 * State stored in: data/config/update-state.json
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { exec, spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_BACKUPS = 3;
const GITHUB_REPO = 'ELikeMed/OpenAce';

export class UpdateManager {
  constructor({ baseDir } = {}) {
    this.baseDir = baseDir || path.join(__dirname, '..', '..', '..');
    this.stateFile = path.join(this.baseDir, 'data/config/update-state.json');
    this.migrationsDir = path.join(this.baseDir, 'src/core/migrations');
    this.backupDir = path.join(this.baseDir, '.update-backups');
    this.state = null;
    this.currentVersion = null;
    this.checkInterval = null;
  }

  async initialize() {
    // Read version from package.json
    try {
      const pkg = JSON.parse(await fs.readFile(path.join(this.baseDir, 'package.json'), 'utf8'));
      this.currentVersion = pkg.version || '1.0.0';
    } catch {
      this.currentVersion = '1.0.0';
    }

    // Load or create state
    await this._loadState();
    if (!this.state) {
      this.state = {
        lastChecked: null,
        latestVersion: null,
        releaseNotes: null,
        releaseUrl: null,
        publishedAt: null,
        dismissedVersion: null,
        dataSchemaVersion: 1,
        migrationsApplied: [],
      };
      await this._saveState();
    }

    // Run pending migrations on startup
    await this.runPendingMigrations();

    // Schedule background checks
    this.checkInterval = setInterval(() => {
      this.checkForUpdate().catch(e => console.error('[UpdateManager] Background check failed:', e.message));
    }, CHECK_INTERVAL_MS);

    console.log(`[UpdateManager] Initialized — v${this.currentVersion}, schema v${this.state.dataSchemaVersion}`);
    return this;
  }

  getCurrentVersion() {
    return this.currentVersion;
  }

  getUpdateState() {
    return {
      currentVersion: this.currentVersion,
      latestVersion: this.state.latestVersion,
      releaseNotes: this.state.releaseNotes,
      releaseUrl: this.state.releaseUrl,
      publishedAt: this.state.publishedAt,
      lastChecked: this.state.lastChecked,
      dismissedVersion: this.state.dismissedVersion,
      updateAvailable: this._isUpdateAvailable(),
      dataSchemaVersion: this.state.dataSchemaVersion,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // VERSION CHECKING
  // ═══════════════════════════════════════════════════════════

  async checkForUpdate() {
    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'OpenAce-Updater' },
      });

      if (response.status === 404) {
        // No releases yet
        this.state.lastChecked = new Date().toISOString();
        await this._saveState();
        return { updateAvailable: false, currentVersion: this.currentVersion, latestVersion: null };
      }

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = (release.tag_name || '').replace(/^v/, '');

      this.state.latestVersion = latestVersion;
      this.state.releaseNotes = release.body || '';
      this.state.releaseUrl = release.html_url || '';
      this.state.publishedAt = release.published_at || null;
      this.state.lastChecked = new Date().toISOString();
      await this._saveState();

      const updateAvailable = this._isUpdateAvailable();
      if (updateAvailable) {
        console.log(`[UpdateManager] Update available: v${this.currentVersion} → v${latestVersion}`);
      }

      return {
        updateAvailable,
        currentVersion: this.currentVersion,
        latestVersion,
        releaseUrl: this.state.releaseUrl,
        releaseNotes: this.state.releaseNotes,
        publishedAt: this.state.publishedAt,
      };
    } catch (error) {
      console.error('[UpdateManager] Check failed:', error.message);
      return {
        updateAvailable: false,
        currentVersion: this.currentVersion,
        latestVersion: this.state.latestVersion,
        error: error.message,
      };
    }
  }

  async dismissUpdate(version) {
    this.state.dismissedVersion = version || this.state.latestVersion;
    await this._saveState();
  }

  // ═══════════════════════════════════════════════════════════
  // ONE-CLICK UPDATE
  // ═══════════════════════════════════════════════════════════

  async performUpdate(progressCallback) {
    const progress = (step, status, detail) => {
      if (progressCallback) progressCallback({ step, status, detail });
    };

    try {
      // Step 1: Backup data
      progress('backup', 'active', 'Backing up data...');
      await this._backupData();
      progress('backup', 'done', 'Data backed up');

      // Step 2: Git pull
      progress('pull', 'active', 'Pulling latest code...');
      const pullResult = await this._exec('git pull origin main', this.baseDir);
      if (pullResult.includes('fatal:') || pullResult.includes('error:')) {
        throw new Error(`Git pull failed: ${pullResult}`);
      }
      progress('pull', 'done', pullResult.trim().split('\n').pop());

      // Step 3: npm install
      progress('install', 'active', 'Installing dependencies...');
      await this._exec('npm install', this.baseDir);
      progress('install', 'done', 'Dependencies installed');

      // Step 4: Rebuild dashboard + studio
      progress('build', 'active', 'Building dashboard...');
      const dashboardDir = path.join(this.baseDir, 'src/desktop/dashboard-ui');
      await this._exec('npm install && npm run build', dashboardDir);
      const studioDir = path.join(this.baseDir, 'src/studio');
      try {
        await this._exec('npm install && npm run build', studioDir);
      } catch (e) {
        console.log('[UpdateManager] Studio build failed (non-critical):', e.message);
      }
      progress('build', 'done', 'Dashboard & Studio rebuilt');

      // Step 5: Run migrations
      progress('migrate', 'active', 'Running migrations...');
      const migrationCount = await this.runPendingMigrations();
      progress('migrate', 'done', migrationCount > 0 ? `${migrationCount} migration(s) applied` : 'No migrations needed');

      // Step 6: Refresh version from updated package.json
      try {
        const pkg = JSON.parse(await fs.readFile(path.join(this.baseDir, 'package.json'), 'utf8'));
        this.currentVersion = pkg.version || this.currentVersion;
      } catch { /* keep current */ }

      // Step 7: Restart — spawn new server process before exiting
      progress('restart', 'active', 'Restarting server...');

      const startScript = path.join(this.baseDir, 'scripts/start-dashboard.js');
      const isWindows = process.platform === 'win32';

      // Spawn a detached process that waits for this one to die, then starts fresh
      if (isWindows) {
        spawn('cmd', ['/c', `timeout /t 3 /nobreak >nul && node "${startScript}"`], {
          cwd: this.baseDir,
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        }).unref();
      } else {
        spawn('sh', ['-c', `sleep 3 && node "${startScript}"`], {
          cwd: this.baseDir,
          detached: true,
          stdio: 'ignore',
        }).unref();
      }

      // Give the SSE response time to flush, then exit so port is freed
      setTimeout(() => process.exit(0), 2000);

      return { success: true, version: this.currentVersion };
    } catch (error) {
      progress('error', 'error', error.message);
      console.error('[UpdateManager] Update failed:', error);
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // DATA MIGRATIONS
  // ═══════════════════════════════════════════════════════════

  async runPendingMigrations() {
    if (!existsSync(this.migrationsDir)) return 0;

    // Read migration files
    const files = (await fs.readdir(this.migrationsDir))
      .filter(f => f.endsWith('.js') && /^\d{3}_/.test(f))
      .sort();

    const applied = new Set(this.state.migrationsApplied || []);
    let count = 0;

    for (const file of files) {
      if (applied.has(file)) continue;

      try {
        const migrationPath = path.join(this.migrationsDir, file);
        const migration = (await import(pathToFileURL(migrationPath).href)).default;

        if (migration.version <= this.state.dataSchemaVersion && applied.size > 0) continue;

        console.log(`[UpdateManager] Running migration: ${file} — ${migration.description}`);
        await migration.up();

        this.state.migrationsApplied.push(file);
        if (migration.version > this.state.dataSchemaVersion) {
          this.state.dataSchemaVersion = migration.version;
        }
        await this._saveState();
        count++;
      } catch (error) {
        console.error(`[UpdateManager] Migration ${file} failed:`, error.message);
        break; // Stop on first failure
      }
    }

    if (count > 0) {
      console.log(`[UpdateManager] ${count} migration(s) applied. Schema version: ${this.state.dataSchemaVersion}`);
    }
    return count;
  }

  // ═══════════════════════════════════════════════════════════
  // BACKUP
  // ═══════════════════════════════════════════════════════════

  async _backupData() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
    const dataDir = path.join(this.baseDir, 'data');

    await fs.mkdir(this.backupDir, { recursive: true });

    // Copy data directory
    await this._exec(`cp -r "${dataDir}" "${backupPath}"`, this.baseDir);

    // Prune old backups (keep last MAX_BACKUPS)
    const backups = (await fs.readdir(this.backupDir))
      .filter(d => d.startsWith('backup-'))
      .sort()
      .reverse();

    for (let i = MAX_BACKUPS; i < backups.length; i++) {
      const old = path.join(this.backupDir, backups[i]);
      await fs.rm(old, { recursive: true, force: true });
    }

    return backupPath;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  _isUpdateAvailable() {
    if (!this.state.latestVersion || !this.currentVersion) return false;
    return this._compareVersions(this.state.latestVersion, this.currentVersion) > 0;
  }

  _compareVersions(a, b) {
    const pa = (a || '').split('.').map(Number);
    const pb = (b || '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pa[i] || 0) - (pb[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  }

  _exec(command, cwd) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd, timeout: 300000 }, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve(stdout + stderr);
      });
    });
  }

  async _loadState() {
    try {
      if (existsSync(this.stateFile)) {
        this.state = JSON.parse(await fs.readFile(this.stateFile, 'utf8'));
      }
    } catch {
      this.state = null;
    }
  }

  async _saveState() {
    await fs.mkdir(path.dirname(this.stateFile), { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
  }

  shutdown() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}
