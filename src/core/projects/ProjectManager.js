/**
 * OpenAce Project Manager — Backend service for managing projects
 * 
 * Manages all projects in the `projects/` directory:
 * - List, create, read, update, and delete projects
 * - Auto-detect project metadata for legacy projects
 * - Recursive file tree listing
 * - Secure file read/write with path traversal protection
 * - Scaffold new projects from templates
 */

import fs from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import path from 'path';
import archiver from 'archiver';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

class ProjectManager {
  constructor(projectsDir) {
    this.projectsDir = projectsDir || path.join(process.cwd(), 'projects');
    this.codeAgent = null; // Set via setCodeAgent() for rich template scaffolding
  }

  // ═══════════════════════════════════════════════════════
  // Security Helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Validate that a project name is safe (alphanumeric, hyphens, underscores)
   */
  validateProjectName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Project name is required');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid project name "${name}": only alphanumeric, hyphens, and underscores allowed`);
    }
    return true;
  }

  /**
   * Validate that a file path does not escape the project directory
   */
  validateFilePath(projectName, filePath) {
    this.validateProjectName(projectName);
    const projectDir = path.join(this.projectsDir, projectName);
    const resolved = path.resolve(projectDir, filePath);
    if (!resolved.startsWith(projectDir + path.sep) && resolved !== projectDir) {
      throw new Error(`Security: path "${filePath}" escapes the project directory`);
    }
    return resolved;
  }

  // ═══════════════════════════════════════════════════════
  // Project Listing & Metadata
  // ═══════════════════════════════════════════════════════

  /**
   * List all projects with metadata
   * Scans the projects/ directory and returns an array of project metadata objects
   */
  async listProjects() {
    console.log('[ProjectManager] Scanning projects directory...');

    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
    } catch {
      // directory already exists
    }

    const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
    const projects = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      try {
        const meta = await this.getProject(entry.name);
        projects.push(meta);
      } catch (err) {
        console.log(`[ProjectManager] Skipping "${entry.name}": ${err.message}`);
      }
    }

    console.log(`[ProjectManager] Found ${projects.length} projects`);
    return projects;
  }

  /**
   * Auto-detect and create project.json for projects that lack one
   */
  async ensureProjectJson(projectName) {
    this.validateProjectName(projectName);
    const projectDir = path.join(this.projectsDir, projectName);
    const metaPath = path.join(projectDir, 'project.json');

    // If project.json already exists, read and return it
    if (existsSync(metaPath)) {
      const raw = await fs.readFile(metaPath, 'utf-8');
      return JSON.parse(raw);
    }

    console.log(`[ProjectManager] Auto-detecting metadata for "${projectName}"...`);

    const files = await fs.readdir(projectDir);
    let type = 'static-site';
    let framework = 'vanilla';
    let entryPoint = 'index.html';
    let description = '';

    // Detect type from package.json dependencies
    if (files.includes('package.json')) {
      try {
        const pkgRaw = await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8');
        const pkg = JSON.parse(pkgRaw);
        const allDeps = {
          ...(pkg.dependencies || {}),
          ...(pkg.devDependencies || {})
        };

        if (allDeps.react || allDeps['react-dom']) {
          type = 'web-app';
          framework = 'react';
        } else if (allDeps.vue) {
          type = 'web-app';
          framework = 'vue';
        } else if (allDeps.svelte) {
          type = 'web-app';
          framework = 'svelte';
        } else if (allDeps.express) {
          type = 'express-api';
          framework = 'express';
          entryPoint = files.includes('server.js') ? 'server.js' : (files.includes('app.js') ? 'app.js' : 'index.js');
        } else if (allDeps.next) {
          type = 'web-app';
          framework = 'next';
        }

        if (pkg.description) {
          description = pkg.description;
        }
      } catch {
        // malformed package.json — continue with defaults
      }
    }

    // Detect type from files if still using defaults
    if (type === 'static-site') {
      if (files.includes('server.js') || files.includes('app.js')) {
        type = 'express-api';
        entryPoint = files.includes('server.js') ? 'server.js' : 'app.js';
      } else if (files.includes('index.html')) {
        // Heuristic: if name contains "landing" it's a landing page
        if (projectName.toLowerCase().includes('landing')) {
          type = 'landing-page';
        } else if (files.includes('app.js') || files.includes('main.js')) {
          type = 'web-app';
        } else {
          type = 'static-site';
        }
        entryPoint = 'index.html';
      }
    }

    const now = new Date().toISOString();
    const stats = await fs.stat(projectDir);
    const totalSize = await this.getProjectSize(projectDir);
    const fileCount = await this._countFiles(projectDir);

    const meta = {
      name: projectName,
      type,
      description: description || `Auto-detected ${type} project`,
      created: stats.birthtime.toISOString(),
      updated: now,
      framework,
      entryPoint,
      status: 'active'
    };

    // Write the project.json
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
    console.log(`[ProjectManager] Created project.json for "${projectName}" (type: ${type}, framework: ${framework})`);

    return meta;
  }

  /**
   * Get full metadata for a single project
   */
  async getProject(projectName) {
    this.validateProjectName(projectName);
    const projectDir = path.join(this.projectsDir, projectName);

    // Verify directory exists
    const stat = await fs.stat(projectDir);
    if (!stat.isDirectory()) {
      throw new Error(`"${projectName}" is not a directory`);
    }

    // Get or create project.json
    const meta = await this.ensureProjectJson(projectName);

    // Add computed fields
    const totalSize = await this.getProjectSize(projectDir);
    const fileCount = await this._countFiles(projectDir);

    return {
      ...meta,
      fileCount,
      totalSize
    };
  }

  // ═══════════════════════════════════════════════════════
  // File Tree
  // ═══════════════════════════════════════════════════════

  /**
   * Recursively list all files/directories in a project folder
   * Returns a nested tree structure
   */
  async getFileTree(projectName) {
    this.validateProjectName(projectName);
    const projectDir = path.join(this.projectsDir, projectName);

    // Verify project exists
    await fs.stat(projectDir);

    console.log(`[ProjectManager] Building file tree for "${projectName}"...`);
    return this._buildTree(projectDir, '');
  }

  /**
   * Recursive helper to build a file tree
   */
  async _buildTree(baseDir, relativePath) {
    const fullPath = relativePath ? path.join(baseDir, relativePath) : baseDir;
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    const tree = [];

    // Sort: directories first, then files, alphabetical within each group
    const sorted = entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of sorted) {
      const entryRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;

      // Skip node_modules and .git
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        const children = await this._buildTree(baseDir, entryRelative);
        tree.push({
          name: entry.name,
          type: 'directory',
          path: entryRelative,
          children
        });
      } else {
        const fileStat = await fs.stat(path.join(fullPath, entry.name));
        tree.push({
          name: entry.name,
          type: 'file',
          path: entryRelative,
          size: fileStat.size
        });
      }
    }

    return tree;
  }

  // ═══════════════════════════════════════════════════════
  // File Read / Write
  // ═══════════════════════════════════════════════════════

  /**
   * Read a file's content from a project
   * Validates path security to prevent directory traversal
   */
  async readFile(projectName, filePath) {
    const resolved = this.validateFilePath(projectName, filePath);
    console.log(`[ProjectManager] Reading file: ${projectName}/${filePath}`);

    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
      throw new Error(`"${filePath}" is not a file`);
    }

    const content = await fs.readFile(resolved, 'utf-8');

    return {
      content,
      path: filePath,
      size: stat.size,
      modified: stat.mtime.toISOString()
    };
  }

  /**
   * Write/update a file in a project
   * Creates parent directories if needed, updates project.json timestamp
   */
  async writeFile(projectName, filePath, content) {
    const resolved = this.validateFilePath(projectName, filePath);
    console.log(`[ProjectManager] Writing file: ${projectName}/${filePath}`);

    // --- Version History: backup existing file before overwriting ---
    if (existsSync(resolved)) {
      try {
        const currentContent = await fs.readFile(resolved, 'utf-8');
        const projectDir = path.join(this.projectsDir, projectName);
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const historyDir = path.join(projectDir, '.history', path.dirname(filePath));
        await fs.mkdir(historyDir, { recursive: true });
        const baseName = path.basename(filePath);
        const backupName = `${baseName}_${timestamp}.bak`;
        await fs.writeFile(path.join(historyDir, backupName), currentContent, 'utf-8');
        console.log(`[ProjectManager] Backed up ${filePath} -> .history/${path.join(path.dirname(filePath), backupName)}`);

        // Enforce max 10 versions per file
        const allEntries = await fs.readdir(historyDir);
        const matchingBackups = allEntries
          .filter(f => f.startsWith(baseName + '_') && f.endsWith('.bak'))
          .sort();
        if (matchingBackups.length > 10) {
          const toDelete = matchingBackups.slice(0, matchingBackups.length - 10);
          for (const old of toDelete) {
            await fs.unlink(path.join(historyDir, old));
            console.log(`[ProjectManager] Pruned old backup: ${old}`);
          }
        }
      } catch (backupErr) {
        console.warn(`[ProjectManager] Warning: could not backup ${filePath}: ${backupErr.message}`);
      }
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(resolved);
    await fs.mkdir(parentDir, { recursive: true });

    // Write the file
    await fs.writeFile(resolved, content, 'utf-8');

    // Update project.json timestamp
    const metaPath = path.join(this.projectsDir, projectName, 'project.json');
    if (existsSync(metaPath)) {
      try {
        const raw = await fs.readFile(metaPath, 'utf-8');
        const meta = JSON.parse(raw);
        meta.updated = new Date().toISOString();
        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
      } catch {
        // Non-critical — project.json may be malformed
      }
    }

    const stat = await fs.stat(resolved);
    return {
      success: true,
      path: filePath,
      size: stat.size,
      modified: stat.mtime.toISOString()
    };
  }

  /**
   * Get the latest modification time across all files in a project.
   * Skips .history/, node_modules/, .git/ directories.
   * Returns the latest mtime as an ISO string, or null if no files found.
   */
  async getLastModified(projectName) {
    this.validateProjectName(projectName);
    const projectDir = path.join(this.projectsDir, projectName);

    let latestMtime = 0;

    const walk = async (dir) => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        // Skip .history, .git, node_modules
        if (entry.name === '.history' || entry.name === '.git' || entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          const stat = await fs.stat(fullPath);
          if (stat.mtimeMs > latestMtime) latestMtime = stat.mtimeMs;
        }
      }
    };

    await walk(projectDir);
    return latestMtime === 0 ? null : new Date(latestMtime).toISOString();
  }

  /**
   * Get version history for a specific file in a project.
   * Looks in .history/{dirPath}/ for files matching {basename}_{timestamp}.bak
   * Returns an array of { timestamp, size, relativePath } sorted newest-first.
   */
  async getFileHistory(projectName, filePath) {
    this.validateProjectName(projectName);
    if (!filePath) throw new Error('filePath is required');

    const projectDir = path.join(this.projectsDir, projectName);
    const historyDir = path.join(projectDir, '.history', path.dirname(filePath));
    const baseName = path.basename(filePath);

    let entries;
    try {
      entries = await fs.readdir(historyDir);
    } catch {
      // .history dir doesn't exist yet — no history
      return [];
    }

    const backups = [];
    const prefix = baseName + '_';

    for (const entry of entries) {
      if (!entry.startsWith(prefix) || !entry.endsWith('.bak')) continue;

      // Extract timestamp from filename: {baseName}_{timestamp}.bak
      const timestampStr = entry.slice(prefix.length, -4); // remove prefix and .bak
      const fullPath = path.join(historyDir, entry);

      try {
        const stat = await fs.stat(fullPath);
        backups.push({
          timestamp: timestampStr,
          size: stat.size,
          relativePath: path.join('.history', path.dirname(filePath), entry)
        });
      } catch {
        // skip files that can't be stat'd
      }
    }

    // Sort by timestamp descending (newest first)
    backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return backups;
  }

  /**
   * Restore a specific version of a file from .history/.
   * Reads the backup content and writes it back to the current file location
   * (writeFile will create a new backup of the current version first).
   */
  async restoreFileVersion(projectName, filePath, timestamp) {
    this.validateProjectName(projectName);
    if (!filePath) throw new Error('filePath is required');
    if (!timestamp) throw new Error('timestamp is required');

    const projectDir = path.join(this.projectsDir, projectName);
    const historyDir = path.join(projectDir, '.history', path.dirname(filePath));
    const baseName = path.basename(filePath);
    const backupFile = path.join(historyDir, `${baseName}_${timestamp}.bak`);

    // Read the backup content
    let content;
    try {
      content = await fs.readFile(backupFile, 'utf-8');
    } catch (err) {
      throw new Error(`Backup not found: ${baseName}_${timestamp}.bak`);
    }

    // Write it back (this will backup the current version first)
    await this.writeFile(projectName, filePath, content);

    return { success: true, restored: filePath, timestamp };
  }

  // ═══════════════════════════════════════════════════════
  // Project CRUD
  // ═══════════════════════════════════════════════════════

  /**
   * Create a new project with scaffolded files based on type
   */
  async createProject(name, type = 'static-site', description = '') {
    this.validateProjectName(name);
    
    // If project already exists, append a number to make it unique
    let finalName = name;
    let projectDir = path.join(this.projectsDir, finalName);
    let counter = 2;
    while (existsSync(projectDir)) {
      finalName = `${name}-${counter}`;
      projectDir = path.join(this.projectsDir, finalName);
      counter++;
    }
    if (finalName !== name) {
      console.log(`[ProjectManager] Project "${name}" exists, using "${finalName}" instead`);
    }
    name = finalName;

    console.log(`[ProjectManager] Creating project "${name}" (type: ${type})...`);
    await fs.mkdir(projectDir, { recursive: true });

    const now = new Date().toISOString();
    const meta = {
      name,
      type,
      description: description || `A ${type} project`,
      created: now,
      updated: now,
      framework: 'vanilla',
      entryPoint: 'index.html',
      status: 'active'
    };

    // Scaffold based on type
    switch (type) {
      case 'landing-page':
        await this._scaffoldLandingPage(projectDir, name);
        break;
      case 'web-app':
      case 'webapp':
        await this._scaffoldWebApp(projectDir, name);
        break;
      case 'react-app':
      case 'react':
        meta.framework = 'react';
        meta.entryPoint = 'index.html';
        // Delegate to CodeAgent for rich React scaffolding if available
        if (this.codeAgent) {
          await this.codeAgent.createProject('react-app', { name, outputDir: projectDir });
        } else {
          await this._scaffoldWebApp(projectDir, name);
        }
        break;
      case 'react-native':
        meta.framework = 'react-native';
        meta.entryPoint = 'App.js';
        if (this.codeAgent) {
          await this.codeAgent.createProject('react-native', { name, outputDir: projectDir });
        } else {
          await this._scaffoldDefault(projectDir, name);
        }
        break;
      case 'next-app':
      case 'nextjs':
        meta.framework = 'nextjs';
        meta.entryPoint = 'pages/index.js';
        if (this.codeAgent) {
          await this.codeAgent.createProject('next-app', { name, outputDir: projectDir });
        } else {
          await this._scaffoldWebApp(projectDir, name);
        }
        break;
      case 'widget':
        await this._scaffoldWidget(projectDir, name);
        break;
      case 'express-api':
      case 'api':
        meta.entryPoint = 'server.js';
        meta.framework = 'express';
        await this._scaffoldExpressAPI(projectDir, name);
        break;
      case 'fullstack':
        meta.framework = 'fullstack';
        if (this.codeAgent) {
          await this.codeAgent.createProject('fullstack', { name, outputDir: projectDir });
        } else {
          await this._scaffoldWebApp(projectDir, name);
        }
        break;
      case 'static-site':
        await this._scaffoldStaticSite(projectDir, name);
        break;
      default:
        await this._scaffoldDefault(projectDir, name);
        break;
    }

    // Write project.json
    await fs.writeFile(path.join(projectDir, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8');

    console.log(`[ProjectManager] Project "${name}" created successfully`);
    return meta;
  }

  /**
   * Delete a project directory recursively
   */
  async deleteProject(projectName) {
    this.validateProjectName(projectName);
    const projectDir = path.join(this.projectsDir, projectName);

    // Verify it exists and is inside projects/
    const resolved = path.resolve(projectDir);
    if (!resolved.startsWith(path.resolve(this.projectsDir) + path.sep)) {
      throw new Error('Security: cannot delete outside of projects directory');
    }

    const stat = await fs.stat(projectDir);
    if (!stat.isDirectory()) {
      throw new Error(`"${projectName}" is not a directory`);
    }

    console.log(`[ProjectManager] Deleting project "${projectName}"...`);
    await fs.rm(projectDir, { recursive: true, force: true });
    console.log(`[ProjectManager] Project "${projectName}" deleted`);

    return { success: true, deleted: projectName };
  }

  // ═══════════════════════════════════════════════════════
  // ZIP Export
  // ═══════════════════════════════════════════════════════

  /**
   * Create a ZIP archive of a project directory
   * Excludes node_modules/ and .git/ directories
   * @param {string} projectName - Name of the project to zip
   * @returns {Promise<Buffer>} - The ZIP file as a Buffer
   */
  async zipProject(projectName) {
    this.validateProjectName(projectName);
    const projectPath = path.join(this.projectsDir, projectName);

    // Verify the project directory exists
    if (!existsSync(projectPath)) {
      throw new Error(`Project "${projectName}" not found`);
    }

    const stat = await fs.stat(projectPath);
    if (!stat.isDirectory()) {
      throw new Error(`"${projectName}" is not a directory`);
    }

    console.log(`[ProjectManager] Creating ZIP archive for "${projectName}"...`);

    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks = [];

      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`[ProjectManager] ZIP created for "${projectName}" (${buffer.length} bytes)`);
        resolve(buffer);
      });
      archive.on('error', (err) => reject(err));

      // Add all files recursively, excluding node_modules and .git
      archive.glob('**/*', {
        cwd: projectPath,
        ignore: ['node_modules/**', '.git/**'],
        dot: true
      });

      archive.finalize();
    });
  }

  // ═══════════════════════════════════════════════════════
  // ZIP / Folder Import
  // ═══════════════════════════════════════════════════════

  /**
   * Import a project from a ZIP buffer.
   * If the ZIP has a single root folder, flattens it so files aren't nested twice.
   * @param {Buffer} zipBuffer - The ZIP file as a Buffer
   * @param {string} projectName - Name for the imported project
   * @returns {Promise<object>} Project metadata
   */
  async importFromZip(zipBuffer, projectName) {
    this.validateProjectName(projectName);
    const AdmZip = require('adm-zip');

    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    if (entries.length === 0) {
      throw new Error('ZIP file is empty');
    }

    // Detect single root folder — if all entries start with the same dir, strip it
    let commonPrefix = '';
    const dirs = entries.filter(e => e.isDirectory).map(e => e.entryName);
    const files = entries.filter(e => !e.isDirectory).map(e => e.entryName);
    const allPaths = [...dirs, ...files];

    if (allPaths.length > 0) {
      const firstSegment = allPaths[0].split('/')[0] + '/';
      if (allPaths.every(p => p.startsWith(firstSegment))) {
        commonPrefix = firstSegment;
      }
    }

    // Ensure project doesn't already exist; if so, append number
    let finalName = projectName;
    let projectDir = path.join(this.projectsDir, finalName);
    let counter = 2;
    while (existsSync(projectDir)) {
      finalName = `${projectName}-${counter}`;
      projectDir = path.join(this.projectsDir, finalName);
      counter++;
    }

    await fs.mkdir(projectDir, { recursive: true });

    console.log(`[ProjectManager] Importing ZIP → "${finalName}" (${entries.length} entries, prefix: "${commonPrefix || 'none'}")...`);

    for (const entry of entries) {
      let entryPath = entry.entryName;

      // Strip common prefix
      if (commonPrefix && entryPath.startsWith(commonPrefix)) {
        entryPath = entryPath.slice(commonPrefix.length);
      }

      if (!entryPath || entryPath === '/') continue;

      // Skip node_modules, .git, __MACOSX
      if (/node_modules|\.git\/|__MACOSX/.test(entryPath)) continue;

      const targetPath = path.join(projectDir, entryPath);

      // Security: ensure path doesn't escape project dir
      const resolved = path.resolve(targetPath);
      if (!resolved.startsWith(path.resolve(projectDir) + path.sep) && resolved !== path.resolve(projectDir)) {
        console.log(`[ProjectManager] Skipping unsafe path: ${entryPath}`);
        continue;
      }

      if (entry.isDirectory) {
        await fs.mkdir(targetPath, { recursive: true });
      } else {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, entry.getData());
      }
    }

    // Auto-detect metadata
    const meta = await this.ensureProjectJson(finalName);
    console.log(`[ProjectManager] ZIP import complete: "${finalName}" (${meta.type})`);
    return { ...meta, name: finalName };
  }

  /**
   * Import a project from a local folder.
   * Copies directory recursively, skipping node_modules and .git.
   * @param {string} sourcePath - Absolute path to the source folder
   * @param {string} projectName - Name for the imported project
   * @returns {Promise<object>} Project metadata
   */
  async importFromFolder(sourcePath, projectName) {
    this.validateProjectName(projectName);

    const resolvedSource = path.resolve(sourcePath);
    if (!existsSync(resolvedSource)) {
      throw new Error(`Source folder not found: ${sourcePath}`);
    }

    const stat = await fs.stat(resolvedSource);
    if (!stat.isDirectory()) {
      throw new Error(`Source is not a directory: ${sourcePath}`);
    }

    // Ensure project doesn't already exist
    let finalName = projectName;
    let projectDir = path.join(this.projectsDir, finalName);
    let counter = 2;
    while (existsSync(projectDir)) {
      finalName = `${projectName}-${counter}`;
      projectDir = path.join(this.projectsDir, finalName);
      counter++;
    }

    console.log(`[ProjectManager] Importing folder "${resolvedSource}" → "${finalName}"...`);
    await this._copyDir(resolvedSource, projectDir);

    const meta = await this.ensureProjectJson(finalName);
    console.log(`[ProjectManager] Folder import complete: "${finalName}" (${meta.type})`);
    return { ...meta, name: finalName };
  }

  /**
   * Link an external folder as a Studio project via symlink.
   * Unlike importFromFolder, this does NOT copy files — it creates a symlink
   * so edits go directly to the original folder.
   * @param {string} sourcePath - Absolute path to the source folder
   * @param {string} projectName - Name for the linked project
   * @returns {Promise<object>} Project metadata with linked: true
   */
  async linkFolder(sourcePath, projectName) {
    this.validateProjectName(projectName);

    const resolvedSource = path.resolve(sourcePath);
    if (!existsSync(resolvedSource)) {
      throw new Error(`Source folder not found: ${sourcePath}`);
    }

    const stat = await fs.stat(resolvedSource);
    if (!stat.isDirectory()) {
      throw new Error(`Source is not a directory: ${sourcePath}`);
    }

    // Ensure project doesn't already exist
    let finalName = projectName;
    let projectDir = path.join(this.projectsDir, finalName);
    let counter = 2;
    while (existsSync(projectDir)) {
      finalName = `${projectName}-${counter}`;
      projectDir = path.join(this.projectsDir, finalName);
      counter++;
    }

    console.log(`[ProjectManager] Linking folder "${resolvedSource}" → "${finalName}"...`);
    await fs.symlink(resolvedSource, projectDir, 'dir');

    // Auto-detect project type and ensure project.json exists
    const meta = await this.ensureProjectJson(finalName);

    // Mark as linked in project.json so the UI can show a badge
    const metaPath = path.join(projectDir, 'project.json');
    const fullMeta = { ...meta, linked: true, linkedPath: resolvedSource };
    await fs.writeFile(metaPath, JSON.stringify(fullMeta, null, 2));

    console.log(`[ProjectManager] Folder linked: "${finalName}" → "${resolvedSource}" (${meta.type})`);
    return { ...fullMeta, name: finalName };
  }

  /**
   * Recursively copy a directory, skipping node_modules, .git, .DS_Store
   */
  async _copyDir(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.DS_Store') continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this._copyDir(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // Size / Stats Helpers
  // ═══════════════════════════════════════════════════════

  /**
   * Recursively calculate total size of all files in a project
   */
  async getProjectSize(projectDir) {
    let total = 0;

    const entries = await fs.readdir(projectDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(projectDir, entry.name);

      // Skip node_modules for performance
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        total += await this.getProjectSize(fullPath);
      } else {
        const stat = await fs.stat(fullPath);
        total += stat.size;
      }
    }

    return total;
  }

  /**
   * Count total files in a project directory (recursive)
   */
  async _countFiles(dir) {
    let count = 0;

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        count += await this._countFiles(path.join(dir, entry.name));
      } else {
        count++;
      }
    }

    return count;
  }

  // ═══════════════════════════════════════════════════════
  // Scaffold Templates
  // ═══════════════════════════════════════════════════════

  async _scaffoldLandingPage(projectDir, name) {
    const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await fs.writeFile(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>${title}</h1>
    <p>Welcome to ${title}</p>
  </header>
  <main>
    <section class="hero">
      <h2>Your headline here</h2>
      <p>Describe your value proposition.</p>
      <a href="#" class="cta-button">Get Started</a>
    </section>
  </main>
  <footer>
    <p>&copy; ${new Date().getFullYear()} ${title}. All rights reserved.</p>
  </footer>
</body>
</html>
`, 'utf-8');

    await fs.writeFile(path.join(projectDir, 'style.css'), `/* ${title} — Landing Page Styles */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
header { background: #1a1a2e; color: #fff; padding: 2rem; text-align: center; }
.hero { padding: 4rem 2rem; text-align: center; }
.hero h2 { font-size: 2rem; margin-bottom: 1rem; }
.cta-button { display: inline-block; padding: 0.75rem 2rem; background: #e94560; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold; margin-top: 1rem; }
.cta-button:hover { background: #c81e45; }
footer { background: #f5f5f5; padding: 1rem; text-align: center; color: #777; }
`, 'utf-8');
  }

  async _scaffoldWebApp(projectDir, name) {
    const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await fs.writeFile(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>${title}</h1>
    </header>
    <main>
      <p>App content goes here.</p>
    </main>
  </div>
  <script src="app.js"></script>
</body>
</html>
`, 'utf-8');

    await fs.writeFile(path.join(projectDir, 'app.js'), `// ${title} — Web App
console.log('${title} loaded');

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  console.log('App initialized', app);
});
`, 'utf-8');

    await fs.writeFile(path.join(projectDir, 'style.css'), `/* ${title} — Web App Styles */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
header { background: #0f3460; color: #fff; padding: 1rem 2rem; }
main { padding: 2rem; }
#app { max-width: 1200px; margin: 0 auto; }
`, 'utf-8');
  }

  async _scaffoldWidget(projectDir, name) {
    const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await fs.writeFile(path.join(projectDir, 'widget.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} Widget</title>
  <style>
    .widget-container { font-family: sans-serif; padding: 1rem; border: 1px solid #ddd; border-radius: 8px; max-width: 400px; }
    .widget-container h3 { margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="widget-container" id="widget">
    <h3>${title}</h3>
    <p>Widget content here.</p>
  </div>
  <script src="widget.js"></script>
</body>
</html>
`, 'utf-8');

    await fs.writeFile(path.join(projectDir, 'widget.js'), `// ${title} Widget
(function() {
  const widget = document.getElementById('widget');
  console.log('${title} widget initialized', widget);
})();
`, 'utf-8');
  }

  async _scaffoldExpressAPI(projectDir, name) {
    await fs.writeFile(path.join(projectDir, 'server.js'), `// ${name} — Express API Server
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to ${name} API', status: 'running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(\`${name} API running on port \${PORT}\`);
});
`, 'utf-8');

    await fs.writeFile(path.join(projectDir, 'package.json'), JSON.stringify({
      name: name.toLowerCase(),
      version: '1.0.0',
      type: 'module',
      description: `${name} Express API`,
      main: 'server.js',
      scripts: {
        start: 'node server.js',
        dev: 'node --watch server.js'
      },
      dependencies: {
        express: '^4.18.2'
      }
    }, null, 2), 'utf-8');
  }

  async _scaffoldStaticSite(projectDir, name) {
    const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await fs.writeFile(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>${title}</h1>
  <p>Welcome to ${title}.</p>
</body>
</html>
`, 'utf-8');

    await fs.writeFile(path.join(projectDir, 'style.css'), `/* ${title} — Static Site Styles */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; padding: 2rem; }
h1 { margin-bottom: 1rem; }
`, 'utf-8');
  }

  async _scaffoldDefault(projectDir, name) {
    const title = name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    await fs.writeFile(path.join(projectDir, 'index.html'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <p>Project created by OpenAce.</p>
</body>
</html>
`, 'utf-8');
  }
}

export default ProjectManager;
