/**
 * OpenAce Code Agent — Full-Stack Development Agent
 * 
 * A fully integrated coding agent that can:
 * - Create complete projects (landing pages, webapps, APIs, etc.)
 * - Read, write, edit, and delete files with precision
 * - Run shell commands (npm, git, etc.)
 * - Scaffold multi-file projects from templates
 * - Analyze and refactor existing code
 * - Handle backend development (Express, databases)
 * - Deploy and manage applications
 */

import fs from 'fs/promises';
import path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodeAgent {
  constructor(options = {}) {
    this.workingDir = options.workingDir || process.cwd();
    this.permissionsManager = options.permissionsManager;
    this.aiManager = options.aiManager;
    this.projectManager = options.projectManager || null;
    this.onProgress = options.onProgress || ((msg) => console.log(`[CodeAgent] ${msg}`));
    
    // Safety limits
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB default
    this.allowedExtensions = options.allowedExtensions || [
      '.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.html', '.css',
      '.scss', '.yaml', '.yml', '.env', '.sh', '.py', '.rb', '.go', '.rs',
      '.vue', '.svelte', '.php', '.sql', '.xml', '.svg', '.toml', '.cfg',
      '.conf', '.ini', '.dockerfile', '.gitignore', '.env.example', '.mjs', '.cjs'
    ];
    
    // Blocked paths for safety
    this.blockedPaths = [
      '/etc', '/usr', '/bin', '/sbin', '/var', '/root',
      'node_modules', '.git/objects', '.git/hooks'
    ];

    // Project output directory
    this.outputDir = options.outputDir || path.join(this.workingDir, 'projects');
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    // Ensure output directory exists
    await fs.mkdir(this.outputDir, { recursive: true });
    this.onProgress('🔧 Code Agent initialized');
    return this;
  }

  /**
   * Check if a path is safe to operate on
   */
  isPathSafe(filepath) {
    const resolved = path.resolve(this.workingDir, filepath);
    
    // Must be within working directory or output directory
    if (!resolved.startsWith(this.workingDir) && !resolved.startsWith(this.outputDir)) {
      return { safe: false, reason: 'Path is outside working directory' };
    }
    
    // Check blocked paths
    for (const blocked of this.blockedPaths) {
      if (resolved.includes(blocked)) {
        return { safe: false, reason: `Path contains blocked directory: ${blocked}` };
      }
    }
    
    return { safe: true };
  }

  /**
   * Check file extension is allowed
   */
  isExtensionAllowed(filepath) {
    const ext = path.extname(filepath).toLowerCase();
    // Allow extensionless files (like Dockerfile, Makefile) and all allowed extensions
    return this.allowedExtensions.includes(ext) || ext === '' || filepath.endsWith('Dockerfile');
  }

  /**
   * Read a file
   */
  async readFile(filepath, options = {}) {
    this.onProgress(`📖 Reading file: ${filepath}`);
    
    const safeCheck = this.isPathSafe(filepath);
    if (!safeCheck.safe) {
      throw new Error(`Security: ${safeCheck.reason}`);
    }

    const fullPath = path.resolve(this.workingDir, filepath);
    
    try {
      const stats = await fs.stat(fullPath);
      
      if (stats.size > this.maxFileSize) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.maxFileSize})`);
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Add line numbers if requested
      if (options.withLineNumbers) {
        const lines = content.split('\n');
        const numbered = lines.map((line, i) => `${String(i + 1).padStart(4)}  ${line}`);
        return {
          success: true,
          path: filepath,
          content: numbered.join('\n'),
          lines: lines.length,
          size: stats.size
        };
      }
      
      return {
        success: true,
        path: filepath,
        content,
        lines: content.split('\n').length,
        size: stats.size
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`File not found: ${filepath}`);
      }
      throw error;
    }
  }

  /**
   * Write a file (create or overwrite)
   */
  async writeFile(filepath, content) {
    this.onProgress(`📝 Writing file: ${filepath}`);
    
    const safeCheck = this.isPathSafe(filepath);
    if (!safeCheck.safe) {
      throw new Error(`Security: ${safeCheck.reason}`);
    }

    if (!this.isExtensionAllowed(filepath)) {
      throw new Error(`File type not allowed: ${path.extname(filepath)}`);
    }

    const fullPath = path.resolve(this.workingDir, filepath);
    
    // Ensure directory exists
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Check if file exists (for logging)
    let existed = false;
    try {
      await fs.access(fullPath);
      existed = true;
    } catch {
      // File doesn't exist, that's fine
    }
    
    await fs.writeFile(fullPath, content, 'utf-8');
    
    this.onProgress(`✅ ${existed ? 'Updated' : 'Created'}: ${filepath}`);
    
    return {
      success: true,
      path: filepath,
      operation: existed ? 'updated' : 'created',
      size: content.length,
      lines: content.split('\n').length
    };
  }

  /**
   * Apply a diff/patch to a file
   * Uses search-and-replace for precise edits
   */
  async editFile(filepath, edits) {
    this.onProgress(`✏️ Editing file: ${filepath}`);
    
    const file = await this.readFile(filepath);
    let content = file.content;
    let changes = 0;
    
    // Ensure edits is always an array
    const editList = Array.isArray(edits) ? edits : [edits];
    
    for (const edit of editList) {
      if (edit.search && edit.replace !== undefined) {
        // Search and replace
        const searchStr = edit.search;
        if (content.includes(searchStr)) {
          content = content.replace(searchStr, edit.replace);
          changes++;
          this.onProgress(`  → Replaced: "${searchStr.substring(0, 50)}..."`);
        } else {
          this.onProgress(`  ⚠️ Not found: "${searchStr.substring(0, 50)}..."`);
        }
      } else if (edit.lineNumber && edit.newContent !== undefined) {
        // Line-based edit
        const lines = content.split('\n');
        if (edit.lineNumber > 0 && edit.lineNumber <= lines.length) {
          lines[edit.lineNumber - 1] = edit.newContent;
          content = lines.join('\n');
          changes++;
          this.onProgress(`  → Updated line ${edit.lineNumber}`);
        }
      } else if (edit.insertAfter) {
        // Insert after a pattern
        const index = content.indexOf(edit.insertAfter);
        if (index !== -1) {
          const insertPoint = index + edit.insertAfter.length;
          content = content.slice(0, insertPoint) + '\n' + edit.content + content.slice(insertPoint);
          changes++;
          this.onProgress(`  → Inserted after: "${edit.insertAfter.substring(0, 30)}..."`);
        }
      } else if (edit.insertBefore) {
        // Insert before a pattern
        const index = content.indexOf(edit.insertBefore);
        if (index !== -1) {
          content = content.slice(0, index) + edit.content + '\n' + content.slice(index);
          changes++;
          this.onProgress(`  → Inserted before: "${edit.insertBefore.substring(0, 30)}..."`);
        }
      } else if (edit.append) {
        // Append to end of file
        content = content + '\n' + edit.append;
        changes++;
        this.onProgress(`  → Appended content`);
      } else if (edit.prepend) {
        // Prepend to start of file
        content = edit.prepend + '\n' + content;
        changes++;
        this.onProgress(`  → Prepended content`);
      }
    }
    
    if (changes > 0) {
      await this.writeFile(filepath, content);
    }
    
    return {
      success: true,
      path: filepath,
      changesApplied: changes,
      totalEdits: editList.length
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(filepath) {
    this.onProgress(`🗑️ Deleting file: ${filepath}`);
    
    const safeCheck = this.isPathSafe(filepath);
    if (!safeCheck.safe) {
      throw new Error(`Security: ${safeCheck.reason}`);
    }

    const fullPath = path.resolve(this.workingDir, filepath);
    
    await fs.unlink(fullPath);
    
    this.onProgress(`✅ Deleted: ${filepath}`);
    
    return {
      success: true,
      path: filepath,
      operation: 'deleted'
    };
  }

  /**
   * List files in a directory
   */
  async listFiles(dirpath = '.', options = {}) {
    this.onProgress(`📁 Listing: ${dirpath}`);
    
    const safeCheck = this.isPathSafe(dirpath);
    if (!safeCheck.safe) {
      throw new Error(`Security: ${safeCheck.reason}`);
    }

    const fullPath = path.resolve(this.workingDir, dirpath);
    
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    const files = [];
    const dirs = [];
    
    for (const entry of entries) {
      // Skip hidden and ignored
      if (entry.name.startsWith('.') && !options.includeHidden) continue;
      if (entry.name === 'node_modules' && !options.includeNodeModules) continue;
      
      if (entry.isDirectory()) {
        dirs.push(entry.name + '/');
        
        // Recursively list if requested
        if (options.recursive) {
          const subPath = path.join(dirpath, entry.name);
          try {
            const subResult = await this.listFiles(subPath, options);
            files.push(...subResult.files.map(f => path.join(entry.name, f)));
          } catch (e) {
            // Skip directories we can't read
          }
        }
      } else {
        files.push(entry.name);
      }
    }
    
    return {
      success: true,
      path: dirpath,
      directories: dirs,
      files: files
    };
  }

  /**
   * Search for a pattern in files
   */
  async searchCode(pattern, directory = '.', options = {}) {
    this.onProgress(`🔍 Searching for: ${pattern}`);
    
    const safeCheck = this.isPathSafe(directory);
    if (!safeCheck.safe) {
      throw new Error(`Security: ${safeCheck.reason}`);
    }

    const results = [];
    const listing = await this.listFiles(directory, { recursive: true });
    
    for (const file of listing.files) {
      const filepath = path.join(directory, file);
      
      // Only search allowed file types
      if (!this.isExtensionAllowed(filepath)) continue;
      
      try {
        const fileResult = await this.readFile(filepath);
        const lines = fileResult.content.split('\n');
        
        const regex = options.regex ? new RegExp(pattern, 'gi') : null;
        
        lines.forEach((line, index) => {
          const matches = regex 
            ? regex.test(line) 
            : line.toLowerCase().includes(pattern.toLowerCase());
            
          if (matches) {
            results.push({
              file: filepath,
              line: index + 1,
              content: line.trim(),
              preview: line.trim().substring(0, 100)
            });
          }
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    this.onProgress(`✅ Found ${results.length} matches`);
    
    return {
      success: true,
      pattern,
      directory,
      matches: results,
      count: results.length
    };
  }

  /**
   * Run a shell command
   */
  async runCommand(command, options = {}) {
    this.onProgress(`⚡ Running: ${command}`);
    
    // Block dangerous commands
    const blockedCommands = ['rm -rf /', 'rm -rf /*', 'sudo rm', ':(){:|:&};:'];
    for (const blocked of blockedCommands) {
      if (command.includes(blocked)) {
        throw new Error(`Blocked dangerous command: ${blocked}`);
      }
    }

    const cwd = options.cwd 
      ? path.resolve(this.workingDir, options.cwd)
      : this.workingDir;

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: options.timeout || 60000, // 1 minute default
        maxBuffer: 10 * 1024 * 1024 // 10MB
      });
      
      this.onProgress(`✅ Command completed`);
      
      return {
        success: true,
        command,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        cwd
      };
    } catch (error) {
      this.onProgress(`❌ Command failed: ${error.message}`);
      return {
        success: false,
        command,
        error: error.message,
        stdout: error.stdout?.trim() || '',
        stderr: error.stderr?.trim() || '',
        cwd
      };
    }
  }

  /**
   * Git operations
   */
  async git(operation, args = []) {
    const safeArgs = Array.isArray(args) ? args : (typeof args === 'string' ? [args] : []);
    const commands = {
      status: 'git status',
      add: `git add ${safeArgs.join(' ') || '.'}`,
      commit: `git commit -m "${safeArgs[0] || 'Update by Ace'}"`,
      push: 'git push',
      pull: 'git pull',
      branch: 'git branch',
      checkout: `git checkout ${safeArgs[0] || ''}`,
      diff: 'git diff',
      log: 'git log --oneline -10',
      init: 'git init'
    };

    const cmd = commands[operation];
    if (!cmd) {
      throw new Error(`Unknown git operation: ${operation}`);
    }

    this.onProgress(`🔀 Git ${operation}...`);
    return this.runCommand(cmd);
  }

  /**
   * NPM operations
   */
  async npm(operation, args = []) {
    const safeArgs = Array.isArray(args) ? args : (typeof args === 'string' ? [args] : []);
    const commands = {
      install: `npm install ${safeArgs.join(' ')}`,
      uninstall: `npm uninstall ${safeArgs.join(' ')}`,
      run: `npm run ${safeArgs[0] || ''}`,
      test: 'npm test',
      build: 'npm run build',
      start: 'npm start',
      audit: 'npm audit',
      outdated: 'npm outdated',
      init: 'npm init -y'
    };

    const cmd = commands[operation];
    if (!cmd) {
      throw new Error(`Unknown npm operation: ${operation}`);
    }

    this.onProgress(`📦 NPM ${operation}...`);
    return this.runCommand(cmd);
  }

  /**
   * Use AI to generate the content for a new skill file.
   * @param {string} taskDescription - The description of the task for the new skill.
   * @param {string} systemPrompt - The detailed system prompt for the AI.
   * @returns {Promise<string>} The raw text content of the generated skill from the AI.
   */
  async generateSkillFile(taskDescription, systemPrompt) {
    this.onProgress(`🤖 Generating skill with AI for: "${taskDescription}"`);

    if (!this.aiManager) {
      throw new Error('AI Manager is not available to the CodeAgent.');
    }

    const messages = [{ role: 'user', content: `Task: "${taskDescription}"` }];
    
    // Using the aiManager's chat function
    const response = await this.aiManager.chat(messages, {
      provider: this.aiManager.getProviderForTask('code'),
      systemPrompt: systemPrompt,
      temperature: 0.2, // Lower temperature for more predictable JSON output
      maxTokens: 1500,
    });

    if (!response || !response.content) {
      throw new Error('AI did not return any content for the skill generation.');
    }
    
    this.onProgress(`✅ AI completed skill generation.`);
    return response.content;
  }

  // ═══════════════════════════════════════════════════════
  // PROJECT SCAFFOLDING — Create complete projects
  // ═══════════════════════════════════════════════════════

  /**
   * Create a complete project from a project type
   * This is the main entry point for project creation
   */
  async createProject(projectType, options = {}) {
    let projectName = this.sanitizeProjectName(options.name) || `${projectType}-${Date.now()}`;

    // If context provides an active project, edit it instead of creating a new one
    const context = options.context || {};
    if (context.activeProject) {
      const activeProjectName = this.sanitizeProjectName(context.activeProject);
      const existingDir = context.projectDir || path.join(this.outputDir, activeProjectName);
      this.onProgress(`[CodeAgent] ✏️ Editing existing project: ${context.activeProject}`);

      // Ensure the existing project directory exists
      await fs.mkdir(existingDir, { recursive: true });

      const results = [];

      if (context.editMode) {
        // Edit mode: use AI to modify/add files only, skip full scaffolding
        if (this.aiManager) {
          results.push(...await this.scaffoldWithAI(existingDir, projectType, options));
        } else {
          this.onProgress(`⚠️ Edit mode requires AI manager; falling back to scaffold`);
          results.push(...await this._scaffoldByType(projectType, existingDir, options));
        }
      } else {
        // Active project but not edit mode: scaffold into existing directory
        results.push(...await this._scaffoldByType(projectType, existingDir, options));
      }

      this.onProgress(`✅ Project "${activeProjectName}" updated at: ${existingDir}`);
      this.onProgress(`   Files written: ${results.length}`);

      return {
        success: true,
        projectName: activeProjectName,
        projectDir: existingDir,
        projectType,
        filesCreated: results.length,
        files: results.map(r => r.path),
        message: `✏️ **Project Updated: ${activeProjectName}**\n\n` +
                 `📂 Location: \`${existingDir}\`\n` +
                 `📄 Files: ${results.length} files written\n\n` +
                 `**Files:**\n${results.map(r => `  ✅ ${r.path}`).join('\n')}`
      };
    }

    // Use context.projectDir if set, otherwise generate from sanitized name
    const projectDir = context.projectDir || path.join(this.outputDir, projectName);
    
    this.onProgress(`🏗️ Creating ${projectType} project: ${projectName}`);
    
    await fs.mkdir(projectDir, { recursive: true });
    
    const results = [];
    results.push(...await this._scaffoldByType(projectType, projectDir, options));
    
    this.onProgress(`✅ Project "${projectName}" created at: ${projectDir}`);
    this.onProgress(`   Files created: ${results.length}`);

    // Register project with ProjectManager so it gets a project.json and shows in Studio
    if (this.projectManager) {
      try {
        await this.projectManager.ensureProjectJson(projectName);
        this.onProgress(`📋 Registered project "${projectName}" with ProjectManager`);
      } catch (err) {
        this.onProgress(`⚠️ Failed to register project with ProjectManager: ${err.message}`);
      }
    }
    
    return {
      success: true,
      projectName,
      projectDir,
      projectType,
      filesCreated: results.length,
      files: results.map(r => r.path),
      message: `🏗️ **Project Created: ${projectName}**\n\n` +
               `📂 Location: \`${projectDir}\`\n` +
               `📄 Files: ${results.length} files created\n\n` +
               `**Files:**\n${results.map(r => `  ✅ ${r.path}`).join('\n')}\n\n` +
               `To view: Open \`${projectDir}\` in your browser or code editor.`
    };
  }

  /**
   * Internal helper: run the appropriate scaffold by project type
   */
  async _scaffoldByType(projectType, projectDir, options) {
    const results = [];
    switch (projectType) {
      case 'landing-page':
        results.push(...await this.scaffoldLandingPage(projectDir, options));
        break;
      case 'webapp':
      case 'web-app':
        results.push(...await this.scaffoldWebApp(projectDir, options));
        break;
      case 'api':
      case 'express-api':
        results.push(...await this.scaffoldExpressAPI(projectDir, options));
        break;
      case 'fullstack':
        results.push(...await this.scaffoldFullStack(projectDir, options));
        break;
      case 'static-site':
        results.push(...await this.scaffoldStaticSite(projectDir, options));
        break;
      case 'react-app':
        results.push(...await this.scaffoldReactApp(projectDir, options));
        break;
      case 'react-native':
        results.push(...await this.scaffoldReactNativeApp(projectDir, options));
        break;
      case 'widget':
        results.push(...await this.scaffoldWidget(projectDir, options));
        break;
      case 'next-app':
        results.push(...await this.scaffoldNextApp(projectDir, options));
        break;
      default:
        if (this.aiManager) {
          results.push(...await this.scaffoldWithAI(projectDir, projectType, options));
        } else {
          results.push(...await this.scaffoldStaticSite(projectDir, options));
        }
    }
    return results;
  }

  /**
   * Scaffold a landing page
   */
  async scaffoldLandingPage(projectDir, options = {}) {
    const results = [];
    const title = options.title || options.name || 'Landing Page';
    const description = options.description || 'A modern, responsive landing page';
    const colors = options.colors || { primary: '#7C6FE0', secondary: '#00CEC9', accent: '#FD79A8' };
    
    // index.html — Complete landing page
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${description}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <title>${title}</title>
    <link rel="stylesheet" href="styles.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body>
    <!-- Navigation -->
    <nav class="navbar" id="navbar">
        <div class="container nav-container">
            <a href="#" class="logo">${title}</a>
            <div class="nav-links">
                <a href="#features">Features</a>
                <a href="#about">About</a>
                <a href="#testimonials">Testimonials</a>
                <a href="#cta" class="btn btn-primary btn-sm">Get Started</a>
            </div>
            <button class="mobile-toggle" id="mobileToggle" aria-label="Toggle menu">
                <span></span><span></span><span></span>
            </button>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="hero" id="hero">
        <div class="container">
            <div class="hero-content">
                <h1 class="hero-title">${title}</h1>
                <p class="hero-subtitle">${description}</p>
                <div class="hero-cta">
                    <a href="#cta" class="btn btn-primary btn-lg">Get Started Free</a>
                    <a href="#features" class="btn btn-outline btn-lg">Learn More</a>
                </div>
            </div>
        </div>
        <div class="hero-bg"></div>
    </section>

    <!-- Features Section -->
    <section class="features" id="features">
        <div class="container">
            <h2 class="section-title">Why Choose Us</h2>
            <p class="section-subtitle">Everything you need to succeed</p>
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-icon">⚡</div>
                    <h3>Lightning Fast</h3>
                    <p>Built for speed and performance. Your users will love the experience.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🔒</div>
                    <h3>Secure & Reliable</h3>
                    <p>Enterprise-grade security to protect your data and your customers.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📱</div>
                    <h3>Mobile First</h3>
                    <p>Perfectly responsive design that looks great on any device.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🎨</div>
                    <h3>Beautiful Design</h3>
                    <p>Modern, clean aesthetics that elevate your brand.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">📊</div>
                    <h3>Analytics Built-in</h3>
                    <p>Track everything that matters with powerful analytics.</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🤝</div>
                    <h3>24/7 Support</h3>
                    <p>Our team is always here to help you succeed.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- About / Stats Section -->
    <section class="about" id="about">
        <div class="container">
            <div class="stats-grid">
                <div class="stat">
                    <div class="stat-number" data-target="10000">0</div>
                    <div class="stat-label">Happy Customers</div>
                </div>
                <div class="stat">
                    <div class="stat-number" data-target="99">0</div>
                    <div class="stat-label">Uptime %</div>
                </div>
                <div class="stat">
                    <div class="stat-number" data-target="50">0</div>
                    <div class="stat-label">Countries</div>
                </div>
                <div class="stat">
                    <div class="stat-number" data-target="24">0</div>
                    <div class="stat-label">Support Hours</div>
                </div>
            </div>
        </div>
    </section>

    <!-- Testimonials -->
    <section class="testimonials" id="testimonials">
        <div class="container">
            <h2 class="section-title">What Our Users Say</h2>
            <div class="testimonials-grid">
                <div class="testimonial-card">
                    <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
                    <p class="testimonial-text">"This transformed our business. The results speak for themselves."</p>
                    <div class="testimonial-author">
                        <div class="author-avatar">JD</div>
                        <div>
                            <div class="author-name">Jane Doe</div>
                            <div class="author-role">CEO, TechCorp</div>
                        </div>
                    </div>
                </div>
                <div class="testimonial-card">
                    <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
                    <p class="testimonial-text">"Best investment we've made this year. Incredible ROI from day one."</p>
                    <div class="testimonial-author">
                        <div class="author-avatar">MS</div>
                        <div>
                            <div class="author-name">Mike Smith</div>
                            <div class="author-role">Founder, StartupXYZ</div>
                        </div>
                    </div>
                </div>
                <div class="testimonial-card">
                    <div class="testimonial-stars">⭐⭐⭐⭐⭐</div>
                    <p class="testimonial-text">"The support team is phenomenal. They genuinely care about your success."</p>
                    <div class="testimonial-author">
                        <div class="author-avatar">SJ</div>
                        <div>
                            <div class="author-name">Sarah Johnson</div>
                            <div class="author-role">VP Marketing, BigCo</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="cta-section" id="cta">
        <div class="container">
            <h2>Ready to Get Started?</h2>
            <p>Join thousands of happy customers today.</p>
            <form class="cta-form" id="ctaForm">
                <input type="email" placeholder="Enter your email" required aria-label="Email address">
                <button type="submit" class="btn btn-primary btn-lg">Start Free Trial</button>
            </form>
            <p class="cta-disclaimer">No credit card required. 14-day free trial.</p>
        </div>
    </section>

    <!-- Footer -->
    <footer class="footer">
        <div class="container">
            <div class="footer-grid">
                <div class="footer-col">
                    <h4>${title}</h4>
                    <p>${description}</p>
                </div>
                <div class="footer-col">
                    <h4>Product</h4>
                    <a href="#">Features</a>
                    <a href="#">Pricing</a>
                    <a href="#">Integrations</a>
                </div>
                <div class="footer-col">
                    <h4>Company</h4>
                    <a href="#">About</a>
                    <a href="#">Blog</a>
                    <a href="#">Careers</a>
                </div>
                <div class="footer-col">
                    <h4>Support</h4>
                    <a href="#">Help Center</a>
                    <a href="#">Contact</a>
                    <a href="#">Status</a>
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; ${new Date().getFullYear()} ${title}. All rights reserved.</p>
            </div>
        </div>
    </footer>

    <script src="script.js"></script>
</body>
</html>`;

    // styles.css — Modern, responsive CSS
    const cssContent = `/* ═══ Reset & Base ═══ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: #1a1a2e;
  line-height: 1.6;
  overflow-x: hidden;
}
a { text-decoration: none; color: inherit; }
img { max-width: 100%; }

/* ═══ Utilities ═══ */
.container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }

/* ═══ Buttons ═══ */
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 12px 28px; border-radius: 8px; font-weight: 600;
  font-size: 1rem; cursor: pointer; transition: all 0.3s ease;
  border: 2px solid transparent;
}
.btn-primary { background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary}); color: white; }
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4); }
.btn-outline { border-color: ${colors.primary}; color: ${colors.primary}; background: transparent; }
.btn-outline:hover { background: ${colors.primary}; color: white; }
.btn-sm { padding: 8px 20px; font-size: 0.875rem; }
.btn-lg { padding: 16px 36px; font-size: 1.1rem; }

/* ═══ Navbar ═══ */
.navbar {
  position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
  padding: 16px 0; transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.navbar.scrolled { padding: 8px 0; box-shadow: 0 2px 20px rgba(0,0,0,0.1); }
.nav-container { display: flex; align-items: center; justify-content: space-between; }
.logo { font-size: 1.5rem; font-weight: 800; background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary}); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.nav-links { display: flex; align-items: center; gap: 32px; }
.nav-links a { font-weight: 500; transition: color 0.3s; }
.nav-links a:hover { color: ${colors.primary}; }
.mobile-toggle { display: none; flex-direction: column; gap: 5px; background: none; border: none; cursor: pointer; padding: 4px; }
.mobile-toggle span { display: block; width: 24px; height: 2px; background: #333; transition: all 0.3s; }

/* ═══ Hero ═══ */
.hero {
  position: relative; min-height: 100vh; display: flex; align-items: center;
  padding: 120px 0 80px; overflow: hidden;
}
.hero-bg {
  position: absolute; inset: 0; z-index: -1;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
}
.hero-content { max-width: 700px; }
.hero-title {
  font-size: clamp(2.5rem, 5vw, 4rem); font-weight: 800; line-height: 1.1;
  margin-bottom: 24px;
  background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
  -webkit-background-clip: text; -webkit-text-fill-color: transparent;
}
.hero-subtitle { font-size: 1.25rem; color: #555; margin-bottom: 40px; max-width: 560px; }
.hero-cta { display: flex; gap: 16px; flex-wrap: wrap; }

/* ═══ Features ═══ */
.features { padding: 100px 0; }
.section-title { font-size: 2.25rem; font-weight: 800; text-align: center; margin-bottom: 12px; }
.section-subtitle { text-align: center; color: #666; font-size: 1.1rem; margin-bottom: 60px; }
.features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; }
.feature-card {
  padding: 36px; border-radius: 16px; background: white;
  border: 1px solid #eee; transition: all 0.3s ease;
}
.feature-card:hover { transform: translateY(-5px); box-shadow: 0 12px 40px rgba(0,0,0,0.08); border-color: ${colors.primary}40; }
.feature-icon { font-size: 2.5rem; margin-bottom: 16px; }
.feature-card h3 { font-size: 1.25rem; margin-bottom: 8px; }
.feature-card p { color: #666; }

/* ═══ Stats ═══ */
.about { padding: 80px 0; background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary}); color: white; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; text-align: center; }
.stat-number { font-size: 3rem; font-weight: 800; }
.stat-label { font-size: 1rem; opacity: 0.9; }

/* ═══ Testimonials ═══ */
.testimonials { padding: 100px 0; background: #f8f9fa; }
.testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px; }
.testimonial-card {
  padding: 36px; background: white; border-radius: 16px;
  border: 1px solid #eee; transition: all 0.3s;
}
.testimonial-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.08); }
.testimonial-stars { margin-bottom: 16px; }
.testimonial-text { font-size: 1.05rem; color: #444; margin-bottom: 24px; font-style: italic; }
.testimonial-author { display: flex; align-items: center; gap: 12px; }
.author-avatar {
  width: 44px; height: 44px; border-radius: 50%;
  background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
  color: white; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 0.875rem;
}
.author-name { font-weight: 600; }
.author-role { font-size: 0.875rem; color: #888; }

/* ═══ CTA ═══ */
.cta-section {
  padding: 100px 0; text-align: center;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  color: white;
}
.cta-section h2 { font-size: 2.5rem; margin-bottom: 16px; }
.cta-section p { font-size: 1.1rem; opacity: 0.8; margin-bottom: 40px; }
.cta-form { display: flex; gap: 12px; max-width: 500px; margin: 0 auto; }
.cta-form input {
  flex: 1; padding: 16px 20px; border-radius: 8px; border: none;
  font-size: 1rem; outline: none;
}
.cta-disclaimer { font-size: 0.875rem; opacity: 0.6; margin-top: 16px; }

/* ═══ Footer ═══ */
.footer { padding: 60px 0 30px; background: #0d1117; color: #8b949e; }
.footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; margin-bottom: 40px; }
.footer-col h4 { color: white; margin-bottom: 16px; font-size: 1rem; }
.footer-col a { display: block; margin-bottom: 8px; transition: color 0.3s; }
.footer-col a:hover { color: ${colors.primary}; }
.footer-bottom { border-top: 1px solid #21262d; padding-top: 20px; text-align: center; font-size: 0.875rem; }

/* ═══ Responsive ═══ */
@media (max-width: 768px) {
  .nav-links { display: none; }
  .mobile-toggle { display: flex; }
  .nav-links.active {
    display: flex; flex-direction: column; position: absolute;
    top: 100%; left: 0; right: 0; background: white;
    padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    gap: 16px;
  }
  .hero-cta { flex-direction: column; }
  .hero-cta .btn { width: 100%; }
  .cta-form { flex-direction: column; }
  .footer-grid { grid-template-columns: 1fr; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ═══ Animations ═══ */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
.hero-content { animation: fadeInUp 0.8s ease; }
.feature-card, .testimonial-card { opacity: 0; animation: fadeInUp 0.6s ease forwards; }
.feature-card:nth-child(1) { animation-delay: 0.1s; }
.feature-card:nth-child(2) { animation-delay: 0.2s; }
.feature-card:nth-child(3) { animation-delay: 0.3s; }
.feature-card:nth-child(4) { animation-delay: 0.4s; }
.feature-card:nth-child(5) { animation-delay: 0.5s; }
.feature-card:nth-child(6) { animation-delay: 0.6s; }
`;

    // script.js — Interactive functionality
    const jsContent = `// ═══ Navbar scroll effect ═══
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// ═══ Mobile menu ═══
const mobileToggle = document.getElementById('mobileToggle');
const navLinks = document.querySelector('.nav-links');
mobileToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('active');
});

// Close mobile menu on link click
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('active'));
});

// ═══ Animated counters ═══
const counters = document.querySelectorAll('.stat-number');
const observerOptions = { threshold: 0.5 };

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const target = parseInt(entry.target.dataset.target);
      animateCounter(entry.target, target);
      counterObserver.unobserve(entry.target);
    }
  });
}, observerOptions);

counters.forEach(counter => counterObserver.observe(counter));

function animateCounter(el, target) {
  let current = 0;
  const increment = target / 60;
  const timer = setInterval(() => {
    current += increment;
    if (current >= target) { current = target; clearInterval(timer); }
    el.textContent = Math.floor(current).toLocaleString() + (target === 99 ? '%' : target === 24 ? '/7' : '+');
  }, 30);
}

// ═══ Form submission ═══
const ctaForm = document.getElementById('ctaForm');
ctaForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = ctaForm.querySelector('input').value;
  if (email) {
    ctaForm.innerHTML = '<p style="color: #4ade80; font-size: 1.2rem; font-weight: 600;">✅ Thanks! We\\'ll be in touch.</p>';
  }
});

// ═══ Scroll reveal ═══
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feature-card, .testimonial-card').forEach(el => {
  revealObserver.observe(el);
});

console.log('🚀 Landing page loaded successfully');
`;

    // Write all files
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'index.html'), htmlContent));
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'styles.css'), cssContent));
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'script.js'), jsContent));
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'README.md'), 
      `# ${title}\n\n${description}\n\n## Getting Started\n\nOpen \`index.html\` in your browser.\n\n## Built by\n\nGenerated by OpenAce Code Agent 🤖\n`));
    
    return results;
  }

  /**
   * Scaffold a web application (React-like SPA)
   */
  async scaffoldWebApp(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'webapp';
    
    // package.json
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'package.json'), JSON.stringify({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: options.description || 'Web application',
      type: 'module',
      scripts: {
        dev: 'npx serve .',
        build: 'echo "Build step here"'
      }
    }, null, 2)));

    // index.html with SPA setup
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'index.html'), 
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <div id="app"></div>\n  <script type="module" src="app.js"></script>\n</body>\n</html>`));
    
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'app.js'), 
      `// ${name} — Main Application\nconst app = document.getElementById('app');\napp.innerHTML = '<h1>Welcome to ${name}</h1><p>Your web app is ready!</p>';\nconsole.log('App initialized');`));
    
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'styles.css'), 
      `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; }\n#app { max-width: 1200px; margin: 0 auto; padding: 20px; }`));
    
    return results;
  }

  /**
   * Scaffold an Express API
   */
  async scaffoldExpressAPI(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'api';
    
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'package.json'), JSON.stringify({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      description: options.description || 'Express API',
      type: 'module',
      scripts: {
        start: 'node server.js',
        dev: 'node --watch server.js'
      },
      dependencies: { express: '^4.18.0', cors: '^2.8.5' }
    }, null, 2)));
    
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'server.js'), 
      `import express from 'express';\nimport cors from 'cors';\n\nconst app = express();\nconst PORT = process.env.PORT || 3000;\n\napp.use(cors());\napp.use(express.json());\n\n// Health check\napp.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));\n\n// Routes\napp.get('/api/items', (req, res) => res.json({ items: [], message: 'API ready' }));\napp.post('/api/items', (req, res) => res.json({ success: true, item: req.body }));\n\napp.listen(PORT, () => console.log(\`🚀 API running on http://localhost:\${PORT}\`));`));
    
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'README.md'), 
      `# ${name}\n\n## Setup\n\`\`\`\nnpm install\nnpm start\n\`\`\`\n\n## Endpoints\n- GET /api/health — Health check\n- GET /api/items — List items\n- POST /api/items — Create item\n`));
    
    return results;
  }

  /**
   * Scaffold a full-stack application
   */
  async scaffoldFullStack(projectDir, options = {}) {
    const results = [];
    
    // Backend
    await fs.mkdir(path.join(projectDir, 'server'), { recursive: true });
    const apiResults = await this.scaffoldExpressAPI(path.join(projectDir, 'server'), options);
    results.push(...apiResults);
    
    // Frontend
    await fs.mkdir(path.join(projectDir, 'client'), { recursive: true });
    const webResults = await this.scaffoldWebApp(path.join(projectDir, 'client'), options);
    results.push(...webResults);
    
    // Root package.json
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'package.json'), JSON.stringify({
      name: (options.name || 'fullstack-app').toLowerCase().replace(/\s+/g, '-'),
      version: '1.0.0',
      scripts: {
        'start:server': 'cd server && npm start',
        'start:client': 'cd client && npx serve .',
        dev: 'npm run start:server & npm run start:client'
      }
    }, null, 2)));
    
    return results;
  }

  /**
   * Scaffold a static site
   */
  async scaffoldStaticSite(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'static-site';
    
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'index.html'), 
      `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${name}</title>\n  <style>body{font-family:system-ui;max-width:800px;margin:0 auto;padding:20px;}h1{color:#333;}</style>\n</head>\n<body>\n  <h1>${name}</h1>\n  <p>Your static site is ready.</p>\n</body>\n</html>`));
    
    return results;
  }

  /**
   * Scaffold a Vite + React 18 application
   */
  async scaffoldReactApp(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'react-app';
    const safeName = name.toLowerCase().replace(/\s+/g, '-');
    const description = options.description || 'A modern React application built with Vite';

    this.onProgress(`⚛️ Scaffolding React app: ${name}`);

    // package.json
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'package.json'), JSON.stringify({
      name: safeName,
      private: true,
      version: '1.0.0',
      description,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-router-dom': '^6.20.0'
      },
      devDependencies: {
        '@vitejs/plugin-react': '^4.2.0',
        'vite': '^5.0.0'
      }
    }, null, 2)));

    // vite.config.js
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'vite.config.js'),
`import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
`));

    // index.html — Vite entry point
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'index.html'),
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${description}" />
  <link rel="icon" type="image/svg+xml" href="/vite.svg" />
  <title>${name}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`));

    // src/main.jsx — React 18 createRoot with BrowserRouter
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/main.jsx'),
`import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
`));

    // src/App.jsx — Main app with React Router
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/App.jsx'),
`import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

function Home() {
  return (
    <main className="page">
      <section className="hero">
        <h1>Welcome to ${name}</h1>
        <p>${description}</p>
        <div className="hero-actions">
          <a href="#features" className="btn btn-primary">Get Started</a>
        </div>
      </section>
      <section className="features" id="features">
        <h2>Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Lightning Fast</h3>
            <p>Powered by Vite for instant hot module replacement and blazing fast builds.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">⚛️</span>
            <h3>React 18</h3>
            <p>Built with the latest React features including concurrent rendering.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🧭</span>
            <h3>Client-Side Routing</h3>
            <p>Seamless navigation with React Router for a smooth SPA experience.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function About() {
  return (
    <main className="page">
      <section className="about-section">
        <h1>About ${name}</h1>
        <p>${description}</p>
        <p>
          This project was scaffolded with OpenAce Code Agent using Vite and React 18.
          It includes React Router for client-side navigation, a modular component structure,
          and modern CSS styling out of the box.
        </p>
        <h2>Tech Stack</h2>
        <ul className="tech-list">
          <li>React 18 with concurrent features</li>
          <li>Vite 5 for development and building</li>
          <li>React Router 6 for navigation</li>
          <li>Modern CSS with flexbox and grid</li>
        </ul>
      </section>
    </main>
  );
}

function App() {
  return (
    <div className="app">
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
`));

    // src/App.css — Modern styles
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/App.css'),
`/* ═══ Reset & Base ═══ */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-primary: #646cff;
  --color-primary-hover: #535bf2;
  --color-bg: #ffffff;
  --color-bg-soft: #f9fafb;
  --color-text: #213547;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;
  --font-family: 'Inter', system-ui, -apple-system, sans-serif;
  --max-width: 1200px;
}

body {
  font-family: var(--font-family);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.2s ease;
}

a:hover {
  color: var(--color-primary-hover);
}

/* ═══ App Layout ═══ */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page {
  flex: 1;
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* ═══ Buttons ═══ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.75rem;
  border-radius: 8px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(100, 108, 255, 0.4);
}

/* ═══ Header ═══ */
.header {
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  padding: 1rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
  backdrop-filter: blur(8px);
}

.header-inner {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text);
}

.header-nav {
  display: flex;
  gap: 1.5rem;
  list-style: none;
}

.header-nav a {
  color: var(--color-text-muted);
  font-weight: 500;
  padding: 0.25rem 0;
  transition: color 0.2s;
}

.header-nav a:hover,
.header-nav a.active {
  color: var(--color-primary);
}

/* ═══ Hero ═══ */
.hero {
  text-align: center;
  padding: 4rem 0 3rem;
}

.hero h1 {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 1rem;
  background: linear-gradient(135deg, var(--color-primary), #9333ea);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero p {
  font-size: 1.2rem;
  color: var(--color-text-muted);
  max-width: 600px;
  margin: 0 auto 2rem;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
}

/* ═══ Features ═══ */
.features {
  padding: 3rem 0;
}

.features h2 {
  text-align: center;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 2rem;
  transition: transform 0.2s, box-shadow 0.2s;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.feature-icon {
  font-size: 2rem;
  display: block;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1.15rem;
  margin-bottom: 0.5rem;
}

.feature-card p {
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

/* ═══ About ═══ */
.about-section {
  padding: 2rem 0;
}

.about-section h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.about-section h2 {
  font-size: 1.5rem;
  margin-top: 2rem;
  margin-bottom: 1rem;
}

.about-section p {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
  max-width: 700px;
}

.tech-list {
  list-style: none;
  padding: 0;
}

.tech-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.tech-list li::before {
  content: '✓ ';
  color: var(--color-primary);
  font-weight: 700;
}

/* ═══ Footer ═══ */
.footer {
  background: var(--color-bg-soft);
  border-top: 1px solid var(--color-border);
  padding: 2rem 0;
  text-align: center;
  margin-top: auto;
}

.footer p {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

/* ═══ Responsive ═══ */
@media (max-width: 768px) {
  .hero h1 {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .header-nav {
    gap: 1rem;
  }
}
`));

    // src/components/Header.jsx
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/components/Header.jsx'),
`import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Header() {
  const location = useLocation();

  return (
    <header className="header">
      <div className="header-inner">
        <Link to="/" className="header-logo">${name}</Link>
        <nav>
          <ul className="header-nav">
            <li><Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link></li>
            <li><Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>About</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}

export default Header;
`));

    // src/components/Footer.jsx
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/components/Footer.jsx'),
`import React from 'react';

function Footer() {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} ${name}. All rights reserved.</p>
    </footer>
  );
}

export default Footer;
`));

    // README.md
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'README.md'),
`# ${name}

${description}

## Getting Started

### Prerequisites
- Node.js 18+ installed

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Opens the app at [http://localhost:3000](http://localhost:3000) with hot module replacement.

### Build for Production

\`\`\`bash
npm run build
\`\`\`

### Preview Production Build

\`\`\`bash
npm run preview
\`\`\`

## Project Structure

\`\`\`
├── index.html          # Vite entry point
├── vite.config.js      # Vite configuration
├── package.json        # Dependencies and scripts
├── src/
│   ├── main.jsx        # React 18 root with BrowserRouter
│   ├── App.jsx         # Main app with routes
│   ├── App.css         # Global styles
│   └── components/
│       ├── Header.jsx  # Navigation header
│       └── Footer.jsx  # Page footer
└── README.md
\`\`\`

## Built With

- [React 18](https://react.dev/) — UI library
- [Vite 5](https://vitejs.dev/) — Build tool
- [React Router 6](https://reactrouter.com/) — Client-side routing

## Generated by

OpenAce Code Agent 🤖
`));

    this.onProgress(`⚛️ React app scaffolded: ${results.length} files created`);
    return results;
  }

  /**
   * Scaffold an Expo-based React Native application
   */
  async scaffoldReactNativeApp(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'react-native-app';
    const safeName = name.toLowerCase().replace(/\s+/g, '-');
    const description = options.description || 'A React Native app built with Expo';

    this.onProgress(`📱 Scaffolding React Native app: ${name}`);

    // package.json
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'package.json'), JSON.stringify({
      name: safeName,
      version: '1.0.0',
      description,
      main: 'node_modules/expo/AppEntry.js',
      scripts: {
        start: 'expo start',
        android: 'expo start --android',
        ios: 'expo start --ios',
        web: 'expo start --web'
      },
      dependencies: {
        'expo': '~49.0.0',
        'expo-status-bar': '~1.6.0',
        'react': '18.2.0',
        'react-native': '0.72.6',
        '@react-navigation/native': '^6.1.9',
        '@react-navigation/native-stack': '^6.9.17',
        'react-native-screens': '~3.22.0',
        'react-native-safe-area-context': '4.6.3'
      },
      devDependencies: {
        '@babel/core': '^7.20.0'
      },
      private: true
    }, null, 2)));

    // app.json — Expo config
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'app.json'), JSON.stringify({
      expo: {
        name: name,
        slug: safeName,
        version: '1.0.0',
        orientation: 'portrait',
        icon: './assets/icon.png',
        userInterfaceStyle: 'light',
        splash: {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#ffffff'
        },
        assetBundlePatterns: ['**/*'],
        ios: {
          supportsTablet: true,
          bundleIdentifier: `com.app.${safeName.replace(/-/g, '')}`
        },
        android: {
          adaptiveIcon: {
            foregroundImage: './assets/adaptive-icon.png',
            backgroundColor: '#ffffff'
          },
          package: `com.app.${safeName.replace(/-/g, '')}`
        },
        web: {
          favicon: './assets/favicon.png'
        },
        platforms: ['ios', 'android', 'web']
      }
    }, null, 2)));

    // App.js — Entry point
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'App.js'),
`import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <NavigationContainer>
      <AppNavigator />
      <StatusBar style="auto" />
    </NavigationContainer>
  );
}
`));

    // src/navigation/AppNavigator.js
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/navigation/AppNavigator.js'),
`import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: {
          backgroundColor: '#6366f1',
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '700',
        },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: '${name}' }}
      />
    </Stack.Navigator>
  );
}
`));

    // src/screens/HomeScreen.js
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/screens/HomeScreen.js'),
`import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Header from '../components/Header';

export default function HomeScreen({ navigation }) {
  const [count, setCount] = useState(0);

  const features = [
    { icon: '⚡', title: 'Fast Development', desc: 'Hot reload for instant feedback' },
    { icon: '📱', title: 'Cross Platform', desc: 'iOS, Android, and Web from one codebase' },
    { icon: '🧭', title: 'Navigation', desc: 'Stack-based navigation with React Navigation' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Header title="${name}" />

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Welcome!</Text>
          <Text style={styles.heroSubtitle}>${description}</Text>
        </View>

        <View style={styles.counterSection}>
          <Text style={styles.counterLabel}>Tap Counter</Text>
          <Text style={styles.counterValue}>{count}</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => setCount(prev => prev + 1)}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Tap Me</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Features</Text>
          {features.map((feature, index) => (
            <View key={index} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDesc}>{feature.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 16,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1f2937',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },
  counterSection: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  counterLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  counterValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#6366f1',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  featuresSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 14,
    color: '#6b7280',
  },
});
`));

    // src/components/Header.js
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'src/components/Header.js'),
`import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function Header({ title }) {
  return (
    <View style={styles.header}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>🚀</Text>
      </View>
      <Text style={styles.title}>{title || 'My App'}</Text>
      <Text style={styles.subtitle}>Built with Expo + React Native</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 8,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 28,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#9ca3af',
  },
});
`));

    // README.md
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'README.md'),
`# ${name}

${description}

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Expo CLI: \`npm install -g expo-cli\`
- iOS Simulator (Mac) or Android Emulator, or the Expo Go app on your device

### Installation

\`\`\`bash
npm install
\`\`\`

### Run the App

\`\`\`bash
npx expo start
\`\`\`

Then:
- Press \`i\` for iOS Simulator
- Press \`a\` for Android Emulator
- Scan the QR code with Expo Go on your device

## Project Structure

\`\`\`
├── App.js                        # Entry point with NavigationContainer
├── app.json                      # Expo configuration
├── package.json                  # Dependencies and scripts
├── src/
│   ├── navigation/
│   │   └── AppNavigator.js       # Stack navigator setup
│   ├── screens/
│   │   └── HomeScreen.js         # Home screen component
│   └── components/
│       └── Header.js             # Reusable header component
└── README.md
\`\`\`

## Built With

- [Expo](https://expo.dev/) ~49.0 — React Native framework
- [React Native](https://reactnative.dev/) — Mobile UI framework
- [React Navigation](https://reactnavigation.org/) — Navigation library

## Generated by

OpenAce Code Agent 🤖
`));

    this.onProgress(`📱 React Native app scaffolded: ${results.length} files created`);
    return results;
  }

  /**
   * Scaffold an embeddable widget (HTML + JS)
   */
  async scaffoldWidget(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'widget';
    const safeName = name.toLowerCase().replace(/\s+/g, '-');
    const description = options.description || 'An embeddable widget component';

    this.onProgress(`🧩 Scaffolding widget: ${name}`);

    // index.html — Demo page
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'index.html'),
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #1f2937;
      line-height: 1.6;
      background: #f3f4f6;
    }
    .demo-header {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      padding: 3rem 1.5rem;
      text-align: center;
    }
    .demo-header h1 { font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; }
    .demo-header p { opacity: 0.85; max-width: 500px; margin: 0 auto; }
    .demo-content {
      max-width: 960px;
      margin: 2rem auto;
      padding: 0 1.5rem;
    }
    .demo-section {
      background: #fff;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    }
    .demo-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #e5e7eb;
    }
    .demo-section p { color: #6b7280; margin-bottom: 1rem; }
    .demo-footer {
      text-align: center;
      padding: 2rem;
      color: #9ca3af;
      font-size: 0.875rem;
    }
  </style>
  <link rel="stylesheet" href="widget.css" />
</head>
<body>
  <div class="demo-header">
    <h1>${name}</h1>
    <p>${description}</p>
  </div>

  <div class="demo-content">
    <div class="demo-section">
      <h2>Widget Demo — Default Configuration</h2>
      <p>The widget below is rendered with default settings.</p>
      <div id="widget-default"></div>
    </div>

    <div class="demo-section">
      <h2>Widget Demo — Custom Configuration</h2>
      <p>This widget instance uses a custom theme color and title.</p>
      <div id="widget-custom"></div>
    </div>

    <div class="demo-section">
      <h2>Surrounding Page Content</h2>
      <p>
        This area represents normal page content that exists alongside the widget.
        The widget is fully self-contained and does not interfere with the host page styles.
      </p>
      <p>
        Widgets use the <code>.ace-widget-*</code> class namespace to avoid CSS conflicts.
      </p>
    </div>
  </div>

  <div class="demo-footer">
    <p>&copy; ${new Date().getFullYear()} ${name}. Built with OpenAce Code Agent.</p>
  </div>

  <script src="widget.js"></script>
  <script>
    // Default widget instance
    AceWidget.create('#widget-default', {
      title: '${name}',
      message: '${description}',
      theme: '#6366f1'
    });

    // Custom widget instance
    AceWidget.create('#widget-custom', {
      title: 'Custom Widget',
      message: 'This instance has custom options applied.',
      theme: '#10b981',
      showTimestamp: true
    });
  </script>
</body>
</html>
`));

    // widget.js — Self-contained widget using IIFE
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'widget.js'),
`/**
 * ${name} — Embeddable Widget
 * ${description}
 *
 * Usage:
 *   AceWidget.create('#container', { title: 'My Widget', theme: '#6366f1' });
 */
;(function (global) {
  'use strict';

  var DEFAULTS = {
    title: 'Ace Widget',
    message: 'Welcome! This is an embeddable widget.',
    theme: '#6366f1',
    showTimestamp: false,
    collapsible: true,
    position: 'inline' // 'inline' or 'fixed-bottom-right'
  };

  /**
   * AceWidget constructor
   * @param {HTMLElement} targetEl — the container element
   * @param {Object} opts — configuration options
   */
  function AceWidget(targetEl, opts) {
    this.target = targetEl;
    this.options = Object.assign({}, DEFAULTS, opts || {});
    this.isCollapsed = false;
    this._render();
  }

  AceWidget.prototype._render = function () {
    var o = this.options;
    var wrapper = document.createElement('div');
    wrapper.className = 'ace-widget-container';
    if (o.position === 'fixed-bottom-right') {
      wrapper.classList.add('ace-widget-fixed');
    }

    // Header
    var header = document.createElement('div');
    header.className = 'ace-widget-header';
    header.style.backgroundColor = o.theme;

    var titleEl = document.createElement('span');
    titleEl.className = 'ace-widget-title';
    titleEl.textContent = o.title;
    header.appendChild(titleEl);

    if (o.collapsible) {
      var toggleBtn = document.createElement('button');
      toggleBtn.className = 'ace-widget-toggle';
      toggleBtn.textContent = '−';
      toggleBtn.setAttribute('aria-label', 'Toggle widget');
      var self = this;
      toggleBtn.addEventListener('click', function () {
        self.isCollapsed = !self.isCollapsed;
        body.style.display = self.isCollapsed ? 'none' : 'block';
        footer.style.display = self.isCollapsed ? 'none' : 'flex';
        toggleBtn.textContent = self.isCollapsed ? '+' : '−';
      });
      header.appendChild(toggleBtn);
    }

    // Body
    var body = document.createElement('div');
    body.className = 'ace-widget-body';

    var msgEl = document.createElement('p');
    msgEl.className = 'ace-widget-message';
    msgEl.textContent = o.message;
    body.appendChild(msgEl);

    // Interactive input area
    var inputRow = document.createElement('div');
    inputRow.className = 'ace-widget-input-row';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ace-widget-input';
    input.placeholder = 'Type something...';

    var sendBtn = document.createElement('button');
    sendBtn.className = 'ace-widget-send';
    sendBtn.textContent = 'Send';
    sendBtn.style.backgroundColor = o.theme;
    sendBtn.addEventListener('click', function () {
      if (input.value.trim()) {
        var response = document.createElement('div');
        response.className = 'ace-widget-response';
        response.textContent = 'You said: ' + input.value;
        body.insertBefore(response, inputRow);
        input.value = '';
      }
    });

    input.addEventListener('keypress', function (e) {
      if (e.key === 'Enter') sendBtn.click();
    });

    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    body.appendChild(inputRow);

    // Footer
    var footer = document.createElement('div');
    footer.className = 'ace-widget-footer';

    var powered = document.createElement('span');
    powered.className = 'ace-widget-powered';
    powered.textContent = 'Powered by ${name}';
    footer.appendChild(powered);

    if (o.showTimestamp) {
      var timestamp = document.createElement('span');
      timestamp.className = 'ace-widget-timestamp';
      timestamp.textContent = new Date().toLocaleTimeString();
      footer.appendChild(timestamp);
    }

    // Assemble
    wrapper.appendChild(header);
    wrapper.appendChild(body);
    wrapper.appendChild(footer);

    this.target.appendChild(wrapper);
    this.wrapper = wrapper;
  };

  AceWidget.prototype.destroy = function () {
    if (this.wrapper && this.wrapper.parentNode) {
      this.wrapper.parentNode.removeChild(this.wrapper);
    }
  };

  AceWidget.prototype.setOption = function (key, value) {
    this.options[key] = value;
    this.target.innerHTML = '';
    this._render();
  };

  // Static factory
  AceWidget.create = function (selector, opts) {
    var el = typeof selector === 'string'
      ? document.querySelector(selector)
      : selector;
    if (!el) {
      console.error('[AceWidget] Target element not found:', selector);
      return null;
    }
    return new AceWidget(el, opts);
  };

  // Expose globally
  global.AceWidget = AceWidget;

})(typeof window !== 'undefined' ? window : this);
`));

    // widget.css — Namespaced widget styles
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'widget.css'),
`/* ═══ Ace Widget Styles ═══ */
/* All classes prefixed with .ace-widget- to avoid conflicts */

.ace-widget-container {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  max-width: 400px;
  font-size: 14px;
  line-height: 1.5;
  color: #1f2937;
}

.ace-widget-container.ace-widget-fixed {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 9999;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.15);
}

/* Header */
.ace-widget-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  color: #ffffff;
}

.ace-widget-title {
  font-weight: 700;
  font-size: 15px;
}

.ace-widget-toggle {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #ffffff;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.ace-widget-toggle:hover {
  background: rgba(255, 255, 255, 0.35);
}

/* Body */
.ace-widget-body {
  padding: 16px;
}

.ace-widget-message {
  color: #4b5563;
  margin-bottom: 16px;
}

.ace-widget-response {
  background: #f3f4f6;
  padding: 8px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  color: #374151;
  font-size: 13px;
}

/* Input */
.ace-widget-input-row {
  display: flex;
  gap: 8px;
}

.ace-widget-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
  font-family: inherit;
}

.ace-widget-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.ace-widget-send {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.2s;
  font-family: inherit;
}

.ace-widget-send:hover {
  opacity: 0.9;
}

/* Footer */
.ace-widget-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

.ace-widget-powered {
  font-size: 11px;
  color: #9ca3af;
}

.ace-widget-timestamp {
  font-size: 11px;
  color: #9ca3af;
}

/* ═══ Responsive ═══ */
@media (max-width: 480px) {
  .ace-widget-container {
    max-width: 100%;
    border-radius: 0;
  }

  .ace-widget-container.ace-widget-fixed {
    bottom: 0;
    right: 0;
    left: 0;
    border-radius: 12px 12px 0 0;
  }
}
`));

    // embed.html — Example embed snippet
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'embed.html'),
`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — Embed Examples</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #1f2937;
      line-height: 1.6;
    }
    h1 { margin-bottom: 0.5rem; }
    h2 { margin-top: 2rem; margin-bottom: 0.75rem; color: #6366f1; }
    p { color: #6b7280; margin-bottom: 1rem; }
    pre {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1.25rem;
      border-radius: 10px;
      overflow-x: auto;
      font-size: 0.875rem;
      line-height: 1.5;
    }
    code { font-family: 'Fira Code', 'Consolas', monospace; }
    .note {
      background: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 1rem;
      border-radius: 0 8px 8px 0;
      margin: 1rem 0;
    }
    .note strong { color: #92400e; }
  </style>
</head>
<body>
  <h1>📦 ${name} — Embed Guide</h1>
  <p>Choose the embed method that works best for your use case.</p>

  <h2>Method 1: Script Tag (Recommended)</h2>
  <p>Include the widget CSS and JS files, then initialize on a target container.</p>
  <pre><code>&lt;!-- 1. Add the stylesheet in your &lt;head&gt; --&gt;
&lt;link rel="stylesheet" href="https://your-cdn.com/${safeName}/widget.css" /&gt;

&lt;!-- 2. Add a container element where you want the widget --&gt;
&lt;div id="my-widget"&gt;&lt;/div&gt;

&lt;!-- 3. Include the script and initialize --&gt;
&lt;script src="https://your-cdn.com/${safeName}/widget.js"&gt;&lt;/script&gt;
&lt;script&gt;
  AceWidget.create('#my-widget', {
    title: 'My Widget',
    message: 'Hello from the embedded widget!',
    theme: '#6366f1',
    showTimestamp: true,
    collapsible: true
  });
&lt;/script&gt;</code></pre>

  <h2>Method 2: iFrame Embed</h2>
  <p>For full isolation, embed the widget demo page in an iframe.</p>
  <pre><code>&lt;iframe
  src="https://your-cdn.com/${safeName}/index.html"
  width="420"
  height="500"
  style="border: none; border-radius: 12px;"
  title="${name}"
&gt;&lt;/iframe&gt;</code></pre>

  <h2>Configuration Options</h2>
  <pre><code>AceWidget.create(selector, {
  title: 'Widget Title',        // Header title text
  message: 'Body message',      // Main message displayed in the body
  theme: '#6366f1',             // Primary color (header, buttons)
  showTimestamp: false,          // Show current time in footer
  collapsible: true,             // Allow collapse/expand
  position: 'inline'             // 'inline' or 'fixed-bottom-right'
});</code></pre>

  <h2>API Methods</h2>
  <pre><code>// Create a widget instance
var widget = AceWidget.create('#container', { title: 'Hello' });

// Update an option (re-renders the widget)
widget.setOption('theme', '#10b981');

// Remove the widget from the DOM
widget.destroy();</code></pre>

  <div class="note">
    <strong>Note:</strong> When using the script tag method, make sure to load
    <code>widget.css</code> before <code>widget.js</code> for proper styling on first render.
  </div>
</body>
</html>
`));

    // README.md
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'README.md'),
`# ${name}

${description}

## Quick Start

Open \`index.html\` in your browser to see the widget demo.

## Embed on Your Site

### Script Tag (Recommended)

\`\`\`html
<link rel="stylesheet" href="widget.css" />
<div id="my-widget"></div>
<script src="widget.js"></script>
<script>
  AceWidget.create('#my-widget', {
    title: 'My Widget',
    message: 'Hello!',
    theme: '#6366f1'
  });
</script>
\`\`\`

### iFrame

\`\`\`html
<iframe src="index.html" width="420" height="500" style="border:none;"></iframe>
\`\`\`

## Configuration Options

| Option          | Type    | Default        | Description                         |
|-----------------|---------|----------------|-------------------------------------|
| \`title\`        | string  | 'Ace Widget'   | Header title text                   |
| \`message\`      | string  | 'Welcome!'     | Body message content                |
| \`theme\`        | string  | '#6366f1'      | Primary color (header, buttons)     |
| \`showTimestamp\` | boolean | false          | Display current time in footer      |
| \`collapsible\`  | boolean | true           | Allow collapse/expand toggle        |
| \`position\`     | string  | 'inline'       | 'inline' or 'fixed-bottom-right'   |

## API Methods

\`\`\`javascript
// Create instance
var widget = AceWidget.create('#container', options);

// Update option (re-renders)
widget.setOption('theme', '#10b981');

// Remove widget from DOM
widget.destroy();
\`\`\`

## Customization

### Custom Styles

All widget CSS classes are prefixed with \`.ace-widget-\` to avoid conflicts:

- \`.ace-widget-container\` — Outer wrapper
- \`.ace-widget-header\` — Header bar
- \`.ace-widget-body\` — Content area
- \`.ace-widget-footer\` — Footer bar
- \`.ace-widget-input\` — Text input
- \`.ace-widget-send\` — Send button

Override any class in your own stylesheet to customize the appearance.

## Files

| File         | Description                        |
|--------------|------------------------------------|
| index.html   | Demo page showing the widget       |
| widget.js    | Self-contained widget (IIFE)       |
| widget.css   | Namespaced widget styles           |
| embed.html   | Embed instructions and examples    |
| README.md    | This file                          |

## Generated by

OpenAce Code Agent 🤖
`));

    this.onProgress(`🧩 Widget scaffolded: ${results.length} files created`);
    return results;
  }

  /**
   * Scaffold a Next.js application
   */
  async scaffoldNextApp(projectDir, options = {}) {
    const results = [];
    const name = options.name || 'next-app';
    const safeName = name.toLowerCase().replace(/\s+/g, '-');
    const description = options.description || 'A Next.js web application';

    this.onProgress(`▲ Scaffolding Next.js app: ${name}`);

    // package.json
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'package.json'), JSON.stringify({
      name: safeName,
      version: '1.0.0',
      private: true,
      description,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint'
      },
      dependencies: {
        'next': '^14.0.0',
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      }
    }, null, 2)));

    // next.config.js
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'next.config.js'),
`/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

module.exports = nextConfig;
`));

    // pages/_app.js — App wrapper
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'pages/_app.js'),
`import '../styles/globals.css';
import Layout from '../components/Layout';

export default function App({ Component, pageProps }) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
`));

    // pages/index.js — Home page
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'pages/index.js'),
`import Head from 'next/head';
import Link from 'next/link';

export default function Home() {
  return (
    <>
      <Head>
        <title>${name}</title>
        <meta name="description" content="${description}" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <section className="hero">
        <h1 className="hero-title">${name}</h1>
        <p className="hero-subtitle">${description}</p>
        <div className="hero-actions">
          <Link href="/about" className="btn btn-primary">Learn More</Link>
        </div>
      </section>

      <section className="features">
        <h2 className="section-title">Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <span className="feature-icon">⚡</span>
            <h3>Server-Side Rendering</h3>
            <p>Pages are pre-rendered on the server for fast initial loads and great SEO.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">📁</span>
            <h3>File-Based Routing</h3>
            <p>Create pages by adding files to the pages directory — no config needed.</p>
          </div>
          <div className="feature-card">
            <span className="feature-icon">🔄</span>
            <h3>API Routes</h3>
            <p>Build your backend API alongside your frontend in the same project.</p>
          </div>
        </div>
      </section>
    </>
  );
}
`));

    // pages/about.js — About page
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'pages/about.js'),
`import Head from 'next/head';
import Link from 'next/link';

export default function About() {
  return (
    <>
      <Head>
        <title>About — ${name}</title>
        <meta name="description" content="About ${name}" />
      </Head>

      <section className="about-page">
        <h1>About ${name}</h1>
        <p className="about-lead">${description}</p>
        <p>
          This project was scaffolded with OpenAce Code Agent using Next.js 14.
          It includes server-side rendering, file-based routing, and a clean
          component structure to get you started quickly.
        </p>

        <h2>Tech Stack</h2>
        <ul className="tech-list">
          <li>Next.js 14 — React framework with SSR</li>
          <li>React 18 — UI library with concurrent features</li>
          <li>CSS Modules support — Scoped styling</li>
          <li>File-based routing — pages/ directory</li>
        </ul>

        <div className="about-cta">
          <Link href="/" className="btn btn-primary">← Back to Home</Link>
        </div>
      </section>
    </>
  );
}
`));

    // styles/globals.css — Global styles
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'styles/globals.css'),
`/* ═══ Reset & Base ═══ */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-primary: #0070f3;
  --color-primary-hover: #0060df;
  --color-bg: #ffffff;
  --color-bg-soft: #fafafa;
  --color-text: #111827;
  --color-text-muted: #6b7280;
  --color-border: #eaeaea;
  --font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  --max-width: 1100px;
}

html,
body {
  font-family: var(--font-family);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: var(--color-primary);
  text-decoration: none;
  transition: color 0.15s ease;
}

a:hover {
  color: var(--color-primary-hover);
}

/* ═══ Layout ═══ */
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.layout-main {
  flex: 1;
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

/* ═══ Header / Nav ═══ */
.layout-header {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0.75rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-logo {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-text);
}

.nav-links {
  display: flex;
  gap: 1.5rem;
  list-style: none;
}

.nav-links a {
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 0.95rem;
  transition: color 0.15s;
}

.nav-links a:hover {
  color: var(--color-primary);
}

/* ═══ Footer ═══ */
.layout-footer {
  border-top: 1px solid var(--color-border);
  padding: 1.5rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  background: var(--color-bg-soft);
}

/* ═══ Buttons ═══ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1.5rem;
  border-radius: 7px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.btn-primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  color: #fff;
}

/* ═══ Hero ═══ */
.hero {
  text-align: center;
  padding: 4rem 0 3rem;
}

.hero-title {
  font-size: 2.75rem;
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 1rem;
}

.hero-subtitle {
  font-size: 1.15rem;
  color: var(--color-text-muted);
  max-width: 560px;
  margin: 0 auto 2rem;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

/* ═══ Features ═══ */
.features {
  padding: 3rem 0;
}

.section-title {
  text-align: center;
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 2rem;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.feature-card {
  background: var(--color-bg-soft);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 1.5rem;
  transition: box-shadow 0.2s, transform 0.2s;
}

.feature-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.feature-icon {
  font-size: 1.75rem;
  display: block;
  margin-bottom: 0.75rem;
}

.feature-card h3 {
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.feature-card p {
  color: var(--color-text-muted);
  font-size: 0.95rem;
}

/* ═══ About Page ═══ */
.about-page {
  padding: 2rem 0;
  max-width: 700px;
}

.about-page h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin-bottom: 1rem;
}

.about-page h2 {
  font-size: 1.35rem;
  margin-top: 2rem;
  margin-bottom: 0.75rem;
}

.about-lead {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.about-page p {
  color: var(--color-text-muted);
  margin-bottom: 1rem;
}

.tech-list {
  list-style: none;
  padding: 0;
  margin-bottom: 2rem;
}

.tech-list li {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

.tech-list li::before {
  content: '→ ';
  color: var(--color-primary);
  font-weight: 600;
}

.about-cta {
  margin-top: 2rem;
}

/* ═══ Responsive ═══ */
@media (max-width: 768px) {
  .hero-title {
    font-size: 2rem;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .nav-links {
    gap: 1rem;
  }
}
`));

    // components/Layout.js — Layout wrapper
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'components/Layout.js'),
`import Link from 'next/link';

export default function Layout({ children }) {
  return (
    <div className="layout">
      <header className="layout-header">
        <nav className="nav">
          <Link href="/" className="nav-logo">${name}</Link>
          <ul className="nav-links">
            <li><Link href="/">Home</Link></li>
            <li><Link href="/about">About</Link></li>
          </ul>
        </nav>
      </header>

      <main className="layout-main">
        {children}
      </main>

      <footer className="layout-footer">
        <p>&copy; {new Date().getFullYear()} ${name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
`));

    // README.md
    results.push(await this.writeFileAbsolute(path.join(projectDir, 'README.md'),
`# ${name}

${description}

## Getting Started

### Prerequisites
- Node.js 18+ installed

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Opens the app at [http://localhost:3000](http://localhost:3000).

### Build for Production

\`\`\`bash
npm run build
\`\`\`

### Start Production Server

\`\`\`bash
npm start
\`\`\`

## Project Structure

\`\`\`
├── pages/
│   ├── _app.js         # App wrapper (imports global styles)
│   ├── index.js        # Home page
│   └── about.js        # About page
├── components/
│   └── Layout.js       # Layout with header nav and footer
├── styles/
│   └── globals.css     # Global styles (reset, typography, layout)
├── next.config.js      # Next.js configuration
├── package.json        # Dependencies and scripts
└── README.md
\`\`\`

## Built With

- [Next.js 14](https://nextjs.org/) — React framework with SSR
- [React 18](https://react.dev/) — UI library
- CSS — Global styles with CSS variables

## Generated by

OpenAce Code Agent 🤖
`));

    this.onProgress(`▲ Next.js app scaffolded: ${results.length} files created`);
    return results;
  }

  /**
   * Use AI to scaffold a custom project type
   */
  async scaffoldWithAI(projectDir, projectType, options = {}) {
    if (!this.aiManager) {
      return await this.scaffoldStaticSite(projectDir, options);
    }

    this.onProgress(`🤖 Using AI to scaffold: ${projectType}`);

    const prompt = `You are a code generator. Create a complete project of type: "${projectType}".
${options.description ? `Description: ${options.description}` : ''}

Return a JSON object with files to create:
{
  "files": [
    { "path": "index.html", "content": "complete file content here" },
    { "path": "styles.css", "content": "complete CSS here" }
  ]
}

Rules:
- Include ALL file content (no placeholders)
- Create production-ready code
- Include proper HTML meta tags
- Use modern CSS (flexbox, grid)
- Add comments for clarity
- Return ONLY the JSON, no markdown`;

    try {
      const response = await this.aiManager.chat([{ role: 'user', content: prompt }], { provider: this.aiManager.getProviderForTask('code'), maxTokens: 32000 });
      const jsonMatch = (response.content || response.text || '').match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        const results = [];
        
        for (const file of (plan.files || [])) {
          if (file.path && file.content) {
            results.push(await this.writeFileAbsolute(path.join(projectDir, file.path), file.content));
          }
        }
        
        return results;
      }
    } catch (error) {
      this.onProgress(`⚠️ AI scaffolding failed: ${error.message}`);
    }

    // Fallback to static site
    return await this.scaffoldStaticSite(projectDir, options);
  }

  /**
   * Write a file using an absolute path (for project scaffolding)
   */
  async writeFileAbsolute(fullPath, content) {
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
    
    const relativePath = path.relative(this.workingDir, fullPath);
    this.onProgress(`  ✅ Created: ${relativePath}`);
    
    return {
      success: true,
      path: relativePath,
      fullPath,
      operation: 'created',
      size: content.length
    };
  }

  // ═══════════════════════════════════════════════════════
  // TEMPLATES
  // ═══════════════════════════════════════════════════════

  /**
   * Create a new file from a template
   */
  async createFromTemplate(filepath, templateType, variables = {}) {
    this.onProgress(`📄 Creating from template: ${templateType}`);
    
    const templates = {
      'js-module': `/**\n * ${variables.name || 'Module'}\n * ${variables.description || 'Description'}\n */\n\nexport class ${variables.className || 'MyClass'} {\n  constructor(options = {}) {\n    this.options = options;\n  }\n\n  async initialize() {\n    return this;\n  }\n}\n\nexport default ${variables.className || 'MyClass'};\n`,
      'react-component': `import React from 'react';\n\nconst ${variables.name || 'Component'} = ({ ${variables.props || ''} }) => {\n  return (\n    <div className="${variables.className || 'component'}">\n      ${variables.content || '// Content here'}\n    </div>\n  );\n};\n\nexport default ${variables.name || 'Component'};\n`,
      'express-route': `import express from 'express';\nconst router = express.Router();\n\nrouter.get('/', async (req, res) => {\n  res.json({ message: '${variables.name || 'endpoint'} ready' });\n});\n\nrouter.post('/', async (req, res) => {\n  try {\n    const data = req.body;\n    res.json({ success: true, data });\n  } catch (error) {\n    res.status(500).json({ error: error.message });\n  }\n});\n\nexport default router;\n`,
      'html-page': `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${variables.title || 'Page'}</title>\n  <style>body{font-family:system-ui;}</style>\n</head>\n<body>\n  <h1>${variables.title || 'Hello'}</h1>\n</body>\n</html>\n`,
      'test': `import { describe, it, expect, beforeEach } from 'vitest';\nimport { ${variables.className || 'MyClass'} } from './${variables.importPath || 'module'}';\n\ndescribe('${variables.className || 'MyClass'}', () => {\n  let instance;\n\n  beforeEach(() => {\n    instance = new ${variables.className || 'MyClass'}();\n  });\n\n  it('should initialize', async () => {\n    await instance.initialize();\n    expect(instance).toBeDefined();\n  });\n});\n`,
      'api-endpoint': `export async function handler(req, res) {\n  try {\n    ${variables.logic || '// Logic here'}\n    res.json({ success: true });\n  } catch (error) {\n    console.error('${variables.name || 'Endpoint'} error:', error);\n    res.status(500).json({ error: error.message });\n  }\n}\n\nexport default handler;\n`
    };

    const template = templates[templateType];
    if (!template) {
      throw new Error(`Unknown template type: ${templateType}. Available: ${Object.keys(templates).join(', ')}`);
    }

    return this.writeFile(filepath, template);
  }

  // ═══════════════════════════════════════════════════════
  // AI-POWERED CODE OPERATIONS
  // ═══════════════════════════════════════════════════════

  /**
   * Analyze code and suggest improvements (requires AI)
   */
  async analyzeCode(filepath) {
    if (!this.aiManager) {
      throw new Error('AI Manager required for code analysis');
    }

    const file = await this.readFile(filepath, { withLineNumbers: true });
    
    this.onProgress(`🔬 Analyzing: ${filepath}`);

    const prompt = `Analyze this code and provide:
1. Summary of what it does
2. Potential issues or bugs
3. Suggested improvements
4. Security concerns if any

File: ${filepath}
\`\`\`
${file.content}
\`\`\``;

    const analysis = await this.aiManager.chat([
      { role: 'user', content: prompt }
    ], { provider: this.aiManager.getProviderForTask('code') });

    return {
      success: true,
      path: filepath,
      analysis: analysis.content || analysis.text || 'Analysis complete'
    };
  }

  /**
   * Execute a coding task using AI
   * This is the main AI-powered task execution method
   */
  async executeTask(task, context = {}) {
    if (!this.aiManager) {
      // Without AI, try to match to a project scaffold
      return this.executeTaskWithoutAI(task);
    }

    this.onProgress(`🤖 Executing coding task: ${typeof task === 'string' ? task.substring(0, 80) : 'task'}...`);

    const taskStr = typeof task === 'string' ? task : (task.description || task.task || JSON.stringify(task));

    // Check if this is a project creation task — use AI to generate modern code
    const projectMatch = taskStr.match(/\b(create|build|make|generate)\b.*\b(landing\s*page|website|web\s*app|webapp|api|server|app|application|site)\b/i);
    const isStudioEdit = context?.isEdit === true;

    if (projectMatch && !isStudioEdit) {
      const projectName = this.extractProjectName(taskStr);
      const projectDir = path.join(this.outputDir || path.join(process.cwd(), 'projects'), projectName);

      this.onProgress(`🏗️ Creating project: ${projectName}...`);

      try {
        await fs.mkdir(projectDir, { recursive: true });

        // Use AI to generate a complete, modern, production-quality project
        const aiPrompt = `You are a senior full-stack developer creating a PRODUCTION-QUALITY project.

TASK: ${taskStr}

PROJECT NAME: ${projectName}
OUTPUT DIRECTORY: projects/${projectName}/

DESIGN REQUIREMENTS — MANDATORY:
- Dark theme: background #0A0B14, cards #12131F, elevated #1A1B2E
- Primary color: #7C6FE0 (purple), secondary: #00CEC9 (teal), accent: #FD79A8 (pink)
- Font: Inter (import from Google Fonts, weights 300-800)
- Modern glassmorphism: backdrop-filter blur, subtle borders rgba(255,255,255,0.07)
- Smooth animations: CSS transitions, scroll reveals via IntersectionObserver
- Responsive: mobile-first, works on all screen sizes
- Professional typography: clamp() for fluid sizes, tight letter-spacing on headings

TECHNICAL REQUIREMENTS:
- Single index.html file with ALL CSS and JS embedded (no separate files)
- Use CSS custom properties for the color system
- Semantic HTML5 elements
- No frameworks or build tools needed — pure HTML/CSS/JS that works immediately
- Include hover effects, smooth transitions, gradient accents
- Use emoji or Unicode for icons (no external icon libraries needed)

Return ONLY a JSON object:
{
  "plan": "What you're building",
  "actions": [
    { "type": "write", "path": "projects/${projectName}/index.html", "content": "COMPLETE HTML content here" }
  ],
  "summary": "What was built"
}

CRITICAL: Include the COMPLETE file content. No placeholders, no "...", no shortcuts. The HTML must be a fully working, beautiful, modern page.`;

        const response = await this.aiManager.chat([
          { role: 'user', content: aiPrompt }
        ], { provider: this.aiManager.getProviderForTask('code'), maxTokens: 32000 });

        const responseText = response.content || response.text || '';
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const plan = JSON.parse(jsonMatch[0]);
          const actions = Array.isArray(plan.actions) ? plan.actions : [];
          const results = [];

          for (const action of actions) {
            if (action.type === 'write' && action.content) {
              const result = await this.writeFile(action.path, action.content);
              results.push({ action, result });
            }
          }

          // Ensure project.json exists
          const metaPath = path.join(projectDir, 'project.json');
          try {
            await fs.access(metaPath);
          } catch {
            await fs.writeFile(metaPath, JSON.stringify({
              name: projectName,
              type: taskStr.toLowerCase().includes('landing') ? 'landing-page' : 'webapp',
              description: taskStr.substring(0, 300),
              created: new Date().toISOString(),
              updated: new Date().toISOString(),
              framework: 'vanilla',
              entryPoint: 'index.html',
              status: 'active'
            }, null, 2));
          }

          // Count created files
          const filesCreated = results.filter(r => r.result?.success !== false);
          const filesList = filesCreated.map(r => r.action.path);

          return {
            success: true,
            projectName,
            projectDir,
            projectType: taskStr.toLowerCase().includes('landing') ? 'landing-page' : 'webapp',
            filesCreated: filesList.length,
            files: filesList,
            message: `✅ **${projectName}** created with ${filesList.length} file(s).\n\n${plan.summary || plan.plan || 'Project ready!'}`,
            plan: plan.plan,
            summary: plan.summary
          };
        }
      } catch (aiError) {
      }

      // Fallback: use hardcoded templates if AI fails
      const typeMap = {
        'landing page': 'landing-page', 'landingpage': 'landing-page', 'website': 'landing-page',
        'web app': 'webapp', 'webapp': 'webapp', 'api': 'express-api', 'server': 'express-api',
        'app': 'webapp', 'application': 'webapp', 'site': 'static-site'
      };
      const matchedType = Object.entries(typeMap).find(([key]) => taskStr.toLowerCase().includes(key));
      if (matchedType) {
        return this.createProject(matchedType[1], { name: projectName, description: taskStr, context });
      }
    }

    // Gather context
    let contextInfo = '';
    if (context.files && Array.isArray(context.files)) {
      for (const filepath of context.files) {
        try {
          const file = await this.readFile(filepath);
          contextInfo += `\n\n--- ${filepath} ---\n${file.content}`;
        } catch (error) {
          contextInfo += `\n\n--- ${filepath} --- (error: ${error.message})`;
        }
      }
    }

    const prompt = `You are the Code Agent for OpenAce. Execute this coding task:

TASK: ${taskStr}

${contextInfo ? `CONTEXT FILES:${contextInfo}` : ''}

WORKING DIRECTORY: ${this.workingDir}
OUTPUT DIRECTORY: ${this.outputDir}

Respond with a JSON object containing:
{
  "plan": "Brief description of what you'll do",
  "actions": [
    { "type": "write", "path": "projects/myproject/file.js", "content": "complete file content" },
    { "type": "edit", "path": "path/to/file.js", "edits": [{ "search": "old text", "replace": "new text" }] },
    { "type": "command", "cmd": "npm install package" },
    { "type": "createProject", "projectType": "landing-page", "options": { "name": "my-page" } }
  ],
  "summary": "What was accomplished"
}

IMPORTANT:
- Include COMPLETE file contents in write actions (no placeholders or "..." shortcuts)
- Write files to the projects/ directory for new projects
- For edits, provide exact search strings that exist in the file
- Return ONLY valid JSON`;

    try {
      const response = await this.aiManager.chat([
        { role: 'user', content: prompt }
      ], { provider: this.aiManager.getProviderForTask('code'), maxTokens: 32000 });

      const responseText = response.content || response.text || '';

      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // AI didn't return JSON — try to extract useful content
        return {
          success: true,
          task: taskStr,
          plan: 'AI provided guidance',
          summary: responseText.substring(0, 500),
          message: responseText
        };
      }

      const plan = JSON.parse(jsonMatch[0]);
      
      this.onProgress(`📋 Plan: ${plan.plan || 'Executing...'}`);
      
      const results = [];
      const actions = Array.isArray(plan.actions) ? plan.actions : [];
      
      for (const action of actions) {
        let result;
        
        try {
          switch (action.type) {
            case 'write':
              result = await this.writeFile(action.path, action.content || '');
              break;
            case 'edit':
              result = await this.editFile(action.path, action.edits || []);
              break;
            case 'delete':
              result = await this.deleteFile(action.path);
              break;
            case 'command':
              result = await this.runCommand(action.cmd || action.command);
              break;
            case 'createProject':
              result = await this.createProject(action.projectType, action.options || {});
              break;
            default:
              result = { skipped: true, reason: `Unknown action type: ${action.type}` };
          }
        } catch (actionError) {
          result = { success: false, error: actionError.message };
        }
        
        results.push({ action, result });
      }

      const successCount = results.filter(r => r.result?.success !== false).length;

      return {
        success: successCount > 0 || actions.length === 0,
        task: taskStr,
        plan: plan.plan || 'Task executed',
        summary: plan.summary || `Executed ${successCount}/${actions.length} actions`,
        message: `✅ **Code Task Complete**\n\n${plan.plan || ''}\n\n${plan.summary || `${successCount} actions executed`}`,
        actionsExecuted: results
      };
    } catch (error) {
      this.onProgress(`⚠️ AI execution error: ${error.message}`);
      
      // Try project scaffolding as fallback
      return this.executeTaskWithoutAI(taskStr);
    }
  }

  /**
   * Execute a task without AI by pattern matching
   */
  executeTaskWithoutAI(task) {
    const taskStr = typeof task === 'string' ? task : (task?.description || '');
    const lower = taskStr.toLowerCase();
    
    // Detect project type from the task description
    if (lower.includes('landing page') || lower.includes('landingpage')) {
      return this.createProject('landing-page', { name: this.extractProjectName(taskStr), description: taskStr, context: {} });
    }
    if (lower.includes('web app') || lower.includes('webapp')) {
      return this.createProject('webapp', { name: this.extractProjectName(taskStr), description: taskStr, context: {} });
    }
    if (lower.includes('api') || lower.includes('server') || lower.includes('backend')) {
      return this.createProject('express-api', { name: this.extractProjectName(taskStr), description: taskStr, context: {} });
    }
    if (lower.includes('website') || lower.includes('site')) {
      return this.createProject('landing-page', { name: this.extractProjectName(taskStr), description: taskStr, context: {} });
    }
    
    return {
      success: false,
      task: taskStr,
      error: 'Could not determine what to create. Try specifying: landing page, webapp, api, or website.',
      summary: '❌ Could not determine project type'
    };
  }

  /**
   * Sanitize a project name for safe filesystem use
   * Strips [Studio Project: ...] prefix and invalid characters
   */
  sanitizeProjectName(name) {
    if (!name) return null;
    
    // Strip [Studio Project: ...] prefix if somehow still present
    name = name.replace(/^\[Studio Project:\s*(.+?)\]\s*/i, '$1');
    
    // Remove brackets, colons, and other invalid filesystem characters
    name = name.replace(/[\[\]:*?"<>|{}()]/g, '');
    
    // Convert to lowercase kebab-case
    name = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    // Ensure it's not empty after sanitization
    if (!name || name.length === 0) {
        name = `project-${Date.now()}`;
    }
    
    return name;
  }

  /**
   * Extract a project name from a task description
   */
  extractProjectName(task) {
    // Strip [Studio Project: ...] prefix before attempting extraction
    task = task.replace(/^\[Studio Project:\s*(.+?)\]\s*/i, '$1');

    // Try to find a quoted name
    const quoted = task.match(/["']([^"']+)["']/);
    if (quoted) return this.sanitizeProjectName(quoted[1]);
    
    // Try to find "called X" or "named X"
    const named = task.match(/\b(?:called|named)\s+["']?([A-Za-z][a-zA-Z0-9\s-]+)/);
    if (named) return this.sanitizeProjectName(named[1].trim());

    // Try to find "X app/webapp/site/page/widget/tool" pattern
    const appName = task.match(/\b([a-zA-Z]+(?:\s+[a-zA-Z]+)?)\s+(app|webapp|website|site|page|widget|tool|tracker|dashboard|platform)\b/i);
    if (appName) {
      const name = appName[1].toLowerCase().replace(/\b(a|an|the|my|our|this|new|simple|basic|cool|nice)\b/g, '').trim();
      if (name.length > 1) return this.sanitizeProjectName(`${name}-${appName[2]}`.toLowerCase());
    }

    // Try "for X" pattern (e.g., "build a webapp for tracking workouts")
    const forPattern = task.match(/\bfor\s+(?:a\s+|an\s+|the\s+)?([a-zA-Z]+(?:\s+[a-zA-Z]+){0,2})/i);
    if (forPattern) {
      const subject = forPattern[1].toLowerCase()
        .replace(/\b(a|an|the|my|our|that|this)\b/g, '').trim();
      if (subject.length > 2) return this.sanitizeProjectName(subject);
    }
    
    // Generate from meaningful keywords (extensive stop-word list)
    const stopWords = new Set([
      'hey', 'hi', 'hello', 'ace', 'can', 'you', 'could', 'would', 'will',
      'please', 'help', 'me', 'my', 'our', 'i', 'we', 'us', 'the', 'a', 'an',
      'create', 'build', 'make', 'generate', 'develop', 'write', 'code',
      'new', 'for', 'with', 'like', 'want', 'need', 'some', 'something',
      'that', 'this', 'and', 'or', 'but', 'also', 'more', 'very',
      'to', 'be', 'is', 'are', 'was', 'were', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got',
      'really', 'just', 'about', 'what', 'how', 'where', 'when',
      'think', 'know', 'let', 'lets', 'should', 'put', 'together'
    ]);
    
    const words = task.toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
      .slice(0, 3);
    
    return this.sanitizeProjectName(words.join('-')) || `project-${Date.now()}`;
  }
}

export default CodeAgent;
