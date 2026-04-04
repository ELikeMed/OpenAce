#!/usr/bin/env node

/**
 * npx @openace/embed init
 *
 * Interactive setup for the OpenAce Embed SDK.
 * Detects framework, finds API keys, picks widget mode, and injects into layout.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const cwd = process.cwd();

// ── Colors ──
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  red: '\x1b[31m', white: '\x1b[37m', magenta: '\x1b[35m',
};

function log(msg = '') { console.log(msg); }
function info(msg) { console.log(`${c.cyan}  \u2660${c.reset} ${msg}`); }
function success(msg) { console.log(`${c.green}  \u2713${c.reset} ${msg}`); }
function warn(msg) { console.log(`${c.yellow}  !${c.reset} ${msg}`); }
function error(msg) { console.log(`${c.red}  \u2717${c.reset} ${msg}`); }

// ── Prompt helpers ──
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question, defaultVal = '') {
  const suffix = defaultVal ? ` ${c.dim}(${defaultVal})${c.reset}` : '';
  return new Promise(resolve => {
    rl.question(`  ${question}${suffix}: `, answer => resolve(answer.trim() || defaultVal));
  });
}

function choose(question, options) {
  return new Promise(resolve => {
    log();
    log(`  ${c.bold}${question}${c.reset}`);
    log();
    options.forEach((opt, i) => {
      const num = `${c.cyan}${i + 1}${c.reset}`;
      const rec = opt.recommended ? ` ${c.green}(recommended)${c.reset}` : '';
      log(`    ${num}. ${c.bold}${opt.label}${c.reset}${rec}`);
      log(`       ${c.dim}${opt.desc}${c.reset}`);
    });
    log();
    rl.question(`  Pick [1-${options.length}]: `, answer => {
      const idx = parseInt(answer.trim()) - 1;
      resolve(options[Math.max(0, Math.min(idx, options.length - 1))].value);
    });
  });
}

// ── Framework detection ──
function detectFramework() {
  const pkg = readJSON('package.json');
  if (!pkg) return 'unknown';
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps['next']) return 'nextjs';
  if (deps['nuxt'] || deps['nuxt3']) return 'nuxt';
  if (deps['express']) return 'express';
  if (deps['fastify']) return 'fastify';
  if (deps['@remix-run/node'] || deps['@remix-run/react']) return 'remix';
  if (deps['astro']) return 'astro';
  if (deps['react'] && !deps['next']) return 'react-spa';
  if (deps['vue']) return 'vue-spa';
  return 'unknown';
}

const FRAMEWORK_NAMES = {
  nextjs: 'Next.js', nuxt: 'Nuxt', express: 'Express', fastify: 'Fastify',
  remix: 'Remix', astro: 'Astro', 'react-spa': 'React SPA', 'vue-spa': 'Vue SPA',
  unknown: 'Node.js',
};

// ── Env scanning ──
const ENV_NAMES = {
  gemini: ['GEMINI_API_KEY', 'GOOGLE_AI_KEY', 'GOOGLE_GEMINI_KEY', 'GOOGLE_API_KEY'],
  claude: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
  openai: ['OPENAI_API_KEY'],
};

function scanEnvFile() {
  const found = {};
  for (const envPath of ['.env', '.env.local', '.env.development']) {
    const full = path.join(cwd, envPath);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, 'utf-8');
    for (const [provider, names] of Object.entries(ENV_NAMES)) {
      if (found[provider]) continue;
      for (const name of names) {
        const match = content.match(new RegExp(`^${name}\\s*=\\s*(.+)`, 'm'));
        if (match && match[1].trim() && !match[1].trim().startsWith('#')) {
          found[provider] = { name, file: envPath };
          break;
        }
      }
    }
  }
  return found;
}

// ── Layout file detection ──
// Searches for common layout/admin files where the widget should be injected
function findLayoutFiles(framework) {
  const candidates = [];

  // Framework-specific layout patterns
  const patterns = {
    nextjs: [
      'src/app/layout.jsx', 'src/app/layout.tsx', 'app/layout.jsx', 'app/layout.tsx',
      'src/app/(admin)/layout.jsx', 'src/app/(admin)/layout.tsx',
      'src/app/(dashboard)/layout.jsx', 'src/app/(dashboard)/layout.tsx',
      'pages/_app.jsx', 'pages/_app.tsx', 'src/pages/_app.jsx', 'src/pages/_app.tsx',
    ],
    remix: [
      'app/root.jsx', 'app/root.tsx',
      'app/routes/_admin.jsx', 'app/routes/_admin.tsx',
      'app/routes/admin.jsx', 'app/routes/admin.tsx',
    ],
    'react-spa': [
      'src/App.jsx', 'src/App.tsx', 'src/App.js',
      'src/layouts/AdminLayout.jsx', 'src/layouts/AdminLayout.tsx',
      'src/layouts/DashboardLayout.jsx', 'src/layouts/DashboardLayout.tsx',
    ],
    nuxt: [
      'layouts/default.vue', 'layouts/admin.vue',
      'app.vue',
    ],
    'vue-spa': [
      'src/App.vue',
      'src/layouts/AdminLayout.vue', 'src/layouts/DashboardLayout.vue',
    ],
  };

  const searchList = patterns[framework] || [];

  // Also search generically for admin-related files
  const genericPatterns = [
    'src/layouts/Admin*.jsx', 'src/layouts/Admin*.tsx',
    'src/components/Layout.jsx', 'src/components/Layout.tsx',
    'src/components/AdminLayout.jsx', 'src/components/AdminLayout.tsx',
  ];

  for (const pattern of [...searchList, ...genericPatterns]) {
    // Simple glob: only handle trailing *
    if (pattern.includes('*')) {
      const dir = path.dirname(pattern);
      const prefix = path.basename(pattern).replace('*', '');
      const absDir = path.join(cwd, dir);
      if (fs.existsSync(absDir)) {
        try {
          const files = fs.readdirSync(absDir);
          for (const f of files) {
            if (f.startsWith(prefix.replace('*.', ''))) {
              candidates.push(path.join(dir, f));
            }
          }
        } catch { /* skip */ }
      }
    } else if (fs.existsSync(path.join(cwd, pattern))) {
      candidates.push(pattern);
    }
  }

  return [...new Set(candidates)];
}

/**
 * Inject the AceWidget import + component into a React/JSX file.
 * Finds the closing tag of the outermost return and inserts before it.
 */
function injectWidgetIntoReactFile(filePath, mode, position, theme, framework) {
  const absPath = path.join(cwd, filePath);
  let content = fs.readFileSync(absPath, 'utf-8');

  // Check if already injected
  if (content.includes('AceWidget') || content.includes('@openace/embed')) {
    return { success: false, reason: 'already_injected' };
  }

  // Add imports at the top (after last import)
  // Include both the component and the CSS
  const importLines = [
    `import { AceWidget } from '@openace/embed';`,
    `import '@openace/embed/css';`,
  ].join('\n');
  const lastImportIdx = content.lastIndexOf('\nimport ');
  if (lastImportIdx !== -1) {
    const endOfImportLine = content.indexOf('\n', lastImportIdx + 1);
    content = content.slice(0, endOfImportLine + 1) + importLines + '\n' + content.slice(endOfImportLine + 1);
  } else {
    content = importLines + '\n' + content;
  }

  // Pick the correct public env var prefix for this framework
  const envPrefix = getPublicEnvPrefix(framework);
  const envVarName = `${envPrefix}ACE_ADMIN_SECRET`;

  // Build the widget JSX
  const widgetProps = [];
  widgetProps.push(`serverUrl="/api/ace"`);
  widgetProps.push(`authToken={process.env.${envVarName} || ''}`);
  if (mode !== 'fab') widgetProps.push(`mode="${mode}"`);
  if (position !== 'bottom-right') widgetProps.push(`position="${position}"`);
  if (theme !== 'light') widgetProps.push(`theme="${theme}"`);

  const widgetJSX = `      <AceWidget ${widgetProps.join(' ')} />`;

  // Strategy: find the last closing tag before the final return's end
  // Look for </div>, </main>, </body>, </html>, or similar at the end of JSX
  // Insert the widget just before the closing tag of the outermost wrapper

  // For mode=button, we need to insert in a header/nav area
  // For mode=inline, they'll manually place it
  // For mode=fab, just put it before the last closing tag (it floats)

  if (mode === 'fab') {
    // Find the last return statement's closing tag
    const patterns = [
      { regex: /(\n\s*<\/body>)/g, type: 'body' },
      { regex: /(\n\s*<\/html>)/g, type: 'html' },
      { regex: /(\n\s*<\/main>)/g, type: 'main' },
      { regex: /(\n\s*<\/div>\s*\n\s*\))/g, type: 'return-div' },
    ];

    let inserted = false;
    for (const { regex } of patterns) {
      const matches = [...content.matchAll(regex)];
      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        const insertPos = lastMatch.index;
        content = content.slice(0, insertPos) + '\n' + widgetJSX + content.slice(insertPos);
        inserted = true;
        break;
      }
    }

    if (!inserted) {
      // Fallback: insert before the very last closing tag we can find
      const lastClosing = content.lastIndexOf('</');
      if (lastClosing !== -1) {
        const lineStart = content.lastIndexOf('\n', lastClosing);
        content = content.slice(0, lineStart) + '\n' + widgetJSX + content.slice(lineStart);
        inserted = true;
      }
    }

    if (!inserted) {
      return { success: false, reason: 'no_insertion_point' };
    }
  } else if (mode === 'button') {
    // For button mode, try to find a nav/header element and insert inside it
    const navPatterns = [
      { regex: /(<\/nav>)/g, type: 'nav' },
      { regex: /(<\/header>)/g, type: 'header' },
      { regex: /(<\/Header>)/g, type: 'Header' },
      { regex: /(<\/Navbar>)/g, type: 'Navbar' },
      { regex: /(<\/Nav>)/g, type: 'Nav' },
    ];

    let inserted = false;
    for (const { regex } of navPatterns) {
      const matches = [...content.matchAll(regex)];
      if (matches.length > 0) {
        const firstMatch = matches[0];
        const insertPos = firstMatch.index;
        content = content.slice(0, insertPos) + '\n' + widgetJSX + '\n        ' + content.slice(insertPos);
        inserted = true;
        break;
      }
    }

    // Fallback to fab-style placement
    if (!inserted) {
      const lastClosing = content.lastIndexOf('</');
      if (lastClosing !== -1) {
        const lineStart = content.lastIndexOf('\n', lastClosing);
        content = content.slice(0, lineStart) + '\n' + widgetJSX + content.slice(lineStart);
        inserted = true;
      }
    }

    if (!inserted) {
      return { success: false, reason: 'no_insertion_point' };
    }
  } else {
    // Inline mode — can't auto-place, just add import
    // They'll manually place <AceWidget mode="inline" /> where they want it
  }

  fs.writeFileSync(absPath, content);
  return { success: true };
}

/**
 * Inject the script tag version into an HTML file.
 */
function injectWidgetIntoHTML(filePath, mode, position, theme, adminSecret) {
  const absPath = path.join(cwd, filePath);
  let content = fs.readFileSync(absPath, 'utf-8');

  if (content.includes('ace-embed') || content.includes('OpenAce.init')) {
    return { success: false, reason: 'already_injected' };
  }

  const configParts = [`      serverUrl: '/api/ace'`];
  configParts.push(`      authToken: '${adminSecret || 'YOUR_ACE_ADMIN_SECRET'}'`);
  if (mode !== 'fab') configParts.push(`      mode: '${mode}'`);
  if (position !== 'bottom-right') configParts.push(`      position: '${position}'`);
  if (theme !== 'light') configParts.push(`      theme: '${theme}'`);

  const snippet = `
  <!-- OpenAce Embed Widget -->
  <script src="https://cdn.openaceai.com/ace-embed.min.js"></script>
  <script>
    OpenAce.init({
${configParts.join(',\n')}
    });
  </script>`;

  // Insert before </body>
  const bodyClose = content.lastIndexOf('</body>');
  if (bodyClose !== -1) {
    content = content.slice(0, bodyClose) + snippet + '\n  ' + content.slice(bodyClose);
  } else {
    content += snippet;
  }

  fs.writeFileSync(absPath, content);
  return { success: true };
}


// ── Route templates (same as before) ──
const TEMPLATES = {
  nextjs: {
    path: 'pages/api/ace/[...ace].js',
    content: (useAppRouter) => useAppRouter ? `import { createAceServer } from '@openace/embed/server';

const handler = createAceServer({
  licenseKey: process.env.OPENACE_LICENSE_KEY,
  adminSecret: process.env.ACE_ADMIN_SECRET,
});

export async function POST(req) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const res = {
    headersSent: false,
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(obj) { writer.write(new TextEncoder().encode(JSON.stringify(obj))); writer.close(); },
    end(data) { if (data) writer.write(new TextEncoder().encode(data)); writer.close(); },
    write(data) { writer.write(new TextEncoder().encode(data)); },
  };

  const body = await req.json().catch(() => ({}));
  await handler({ method: 'POST', url: req.url, headers: Object.fromEntries(req.headers), body }, res);
  return new Response(readable, { status: res.statusCode, headers: res.headers });
}

export async function GET(req) { return POST(req); }` :
`import { createAceServer } from '@openace/embed/server';

export default createAceServer({
  licenseKey: process.env.OPENACE_LICENSE_KEY,
  adminSecret: process.env.ACE_ADMIN_SECRET,
});`,
  },
  express: {
    path: 'routes/ace.js',
    content: () => `import { createAceServer } from '@openace/embed/server';

const aceHandler = createAceServer({
  licenseKey: process.env.OPENACE_LICENSE_KEY,
  adminSecret: process.env.ACE_ADMIN_SECRET,
});

// Mount: app.use('/api/ace', aceRouter);
export default function aceRouter(req, res) { return aceHandler(req, res); }`,
  },
  generic: {
    path: 'ace-server.js',
    content: () => `import { createAceServer } from '@openace/embed/server';

export default createAceServer({
  licenseKey: process.env.OPENACE_LICENSE_KEY,
  adminSecret: process.env.ACE_ADMIN_SECRET,
});`,
  },
};


// ── Helpers ──
function readJSON(f) { try { return JSON.parse(fs.readFileSync(path.join(cwd, f), 'utf-8')); } catch { return null; } }
function fileExists(p) { return fs.existsSync(path.join(cwd, p)); }

/**
 * Returns the correct public env var prefix for a framework.
 * - Next.js → NEXT_PUBLIC_
 * - CRA (react-scripts) → REACT_APP_
 * - Vite → VITE_
 * - Remix → (no prefix needed, uses server loader)
 * - Default → NEXT_PUBLIC_ (safe fallback)
 */
function getPublicEnvPrefix(framework) {
  if (framework === 'nextjs') return 'NEXT_PUBLIC_';
  if (framework === 'react-spa') {
    // Detect CRA vs Vite
    const pkg = readJSON('package.json') || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps['vite'] || deps['@vitejs/plugin-react']) return 'VITE_';
    if (deps['react-scripts']) return 'REACT_APP_';
    // Fallback: check for vite.config.*
    if (fileExists('vite.config.js') || fileExists('vite.config.ts')) return 'VITE_';
    return 'REACT_APP_'; // CRA is more common
  }
  if (framework === 'remix') return ''; // Remix uses server loaders
  if (framework === 'astro') return 'PUBLIC_';
  return 'NEXT_PUBLIC_'; // safe default
}

function appendToEnv(key, value) {
  const envPath = path.join(cwd, '.env');
  const line = `${key}=${value}\n`;
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    if (content.includes(`${key}=`)) {
      fs.writeFileSync(envPath, content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`));
    } else {
      fs.appendFileSync(envPath, (content.endsWith('\n') ? '' : '\n') + line);
    }
  } else {
    fs.writeFileSync(envPath, `# OpenAce Embed SDK\n${line}`);
  }
}

function getEnvValue(key) {
  for (const ep of ['.env', '.env.local']) {
    const fp = path.join(cwd, ep);
    if (!fs.existsSync(fp)) continue;
    const m = fs.readFileSync(fp, 'utf-8').match(new RegExp(`^${key}\\s*=\\s*(.+)`, 'm'));
    if (m) return m[1].trim();
  }
  return process.env[key] || '';
}

function writeFile(filePath, content) {
  const fp = path.join(cwd, filePath);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content + '\n');
}


// ════════════════════════════════════════
// ── Main ──
// ════════════════════════════════════════
async function main() {
  log();
  log(`${c.bold}${c.cyan}  \u2660 OpenAce Embed SDK \u2014 Setup${c.reset}`);
  log(`${c.dim}  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${c.reset}`);
  log();

  // ── Step 1: Framework ──
  const framework = detectFramework();
  const isReact = ['nextjs', 'react-spa', 'remix'].includes(framework);
  info(`Detected framework: ${c.bold}${FRAMEWORK_NAMES[framework]}${c.reset}`);

  // ── Step 2: API keys ──
  const envKeys = scanEnvFile();
  const keyCount = Object.keys(envKeys).length;

  if (keyCount > 0) {
    log();
    success(`Found ${keyCount} AI API key${keyCount > 1 ? 's' : ''} in your environment:`);
    for (const [provider, detail] of Object.entries(envKeys)) {
      log(`    ${c.green}${provider}${c.reset} \u2192 ${detail.name} ${c.dim}(${detail.file})${c.reset}`);
    }
    log(`    ${c.dim}Auto-detected at runtime. No config needed!${c.reset}`);
  } else {
    log();
    warn('No AI API keys found in .env files.');
    log(`    ${c.dim}Ace needs at least one AI provider to work.${c.reset}`);
    log();
    const addKey = await ask('Add a Gemini API key now? (free at ai.google.dev) [y/N]', 'n');
    if (addKey.toLowerCase() === 'y') {
      const key = await ask('GEMINI_API_KEY');
      if (key) { appendToEnv('GEMINI_API_KEY', key); success('Added GEMINI_API_KEY to .env'); }
    }
  }

  // ── Step 3: License key ──
  log();
  let licenseKey = getEnvValue('OPENACE_LICENSE_KEY');
  if (licenseKey) {
    success(`License key found: ${c.dim}${licenseKey.slice(0, 12)}...${c.reset}`);
  } else {
    info('No license key found. Ace will run in 30-day trial mode.');
    const lk = await ask('Have a license key? Paste it (or Enter to skip)', '');
    if (lk) { appendToEnv('OPENACE_LICENSE_KEY', lk); success('Added OPENACE_LICENSE_KEY to .env'); licenseKey = lk; }
  }

  // ── Step 4: Admin secret ──
  log();
  let adminSecret = getEnvValue('ACE_ADMIN_SECRET');
  if (adminSecret) {
    success(`Admin secret found: ${c.dim}${adminSecret.slice(0, 8)}...${c.reset}`);
  } else {
    const cr = await import('crypto');
    adminSecret = cr.randomBytes(24).toString('hex');
    appendToEnv('ACE_ADMIN_SECRET', adminSecret);
    // Also add the public version for client-side access in React frameworks
    if (isReact) {
      const prefix = getPublicEnvPrefix(framework);
      if (prefix) {
        appendToEnv(`${prefix}ACE_ADMIN_SECRET`, adminSecret);
      }
    }
    success('Generated admin secret and added to .env');
  }

  // ── Step 5: Create API route ──
  log();
  const template = TEMPLATES[framework] || TEMPLATES.generic;
  let routePath = template.path;
  let useAppRouter = false;
  if (framework === 'nextjs') {
    if (fileExists('src/app') || fileExists('app')) {
      useAppRouter = true;
      routePath = fileExists('src/app') ? 'src/app/api/ace/[...route]/route.js' : 'app/api/ace/[...route]/route.js';
    }
  }

  if (fileExists(routePath)) {
    warn(`Route file exists: ${routePath}`);
    const ow = await ask('Overwrite? [y/N]', 'n');
    if (ow.toLowerCase() === 'y') { writeFile(routePath, template.content(useAppRouter)); success(`Updated ${routePath}`); }
    else info('Skipping route file.');
  } else {
    writeFile(routePath, template.content(useAppRouter));
    success(`Created ${routePath}`);
  }

  // ═══════════════════════════════════════
  // ── Step 6: Widget mode ──
  // ═══════════════════════════════════════
  const mode = await choose('Where should Ace appear on your site?', [
    {
      value: 'fab',
      label: '\u2660 Floating button (bottom corner)',
      desc: 'A spade icon that floats in the corner. Click to open chat. Most popular.',
      recommended: true,
    },
    {
      value: 'button',
      label: '\u2660 Header button ("Ask Ace")',
      desc: 'A pill-shaped button in your nav bar. Clean, professional look.',
    },
    {
      value: 'inline',
      label: '\u2660 Inline panel',
      desc: 'Embeds directly into your page layout. Best for dedicated admin panels.',
    },
  ]);
  success(`Widget mode: ${c.bold}${mode}${c.reset}`);

  // Position (only for fab mode)
  let position = 'bottom-right';
  if (mode === 'fab') {
    position = await choose('Which corner?', [
      { value: 'bottom-right', label: 'Bottom right', desc: 'Standard position. Most familiar.', recommended: true },
      { value: 'bottom-left', label: 'Bottom left', desc: 'If you have another widget on the right.' },
    ]);
  }

  // Theme
  const theme = await choose('Color theme?', [
    { value: 'light', label: 'Light', desc: 'White background, dark text.', recommended: true },
    { value: 'dark', label: 'Dark', desc: 'Dark background, light text. Great for admin dashboards.' },
    { value: 'auto', label: 'Auto', desc: 'Follows the user\'s system preference.' },
  ]);

  // ═══════════════════════════════════════
  // ── Step 7: Find and inject into layout ──
  // ═══════════════════════════════════════
  log();
  info('Looking for layout files to inject the widget...');

  const layoutFiles = findLayoutFiles(framework);

  if (layoutFiles.length > 0) {
    log();
    // Show what we found
    for (const f of layoutFiles) {
      log(`    ${c.dim}Found: ${f}${c.reset}`);
    }
    log();

    // Pick the best candidate
    // Prefer admin layouts, then app layouts, then root layouts
    const adminFile = layoutFiles.find(f => /admin|dashboard/i.test(f));
    const appFile = layoutFiles.find(f => /App\.(jsx|tsx|js)$/i.test(f));
    const layoutFile = layoutFiles.find(f => /layout\.(jsx|tsx)$/i.test(f));
    const rootFile = layoutFiles.find(f => /root\.(jsx|tsx)$/i.test(f));
    const bestCandidate = adminFile || layoutFile || appFile || rootFile || layoutFiles[0];

    const targetFile = await ask(
      `Inject widget into which file?`,
      bestCandidate
    );

    if (targetFile && fileExists(targetFile)) {
      const ext = path.extname(targetFile).toLowerCase();
      const isJSX = ['.jsx', '.tsx', '.js', '.ts'].includes(ext);
      const isHTML = ['.html', '.ejs', '.hbs'].includes(ext);
      const isVue = ext === '.vue';

      let result;

      if (isJSX) {
        result = injectWidgetIntoReactFile(targetFile, mode, position, theme, framework);
      } else if (isHTML) {
        result = injectWidgetIntoHTML(targetFile, mode, position, theme, adminSecret);
      } else if (isVue) {
        // For Vue, inject as HTML-style inside the template
        result = { success: false, reason: 'vue_manual' };
      } else {
        result = { success: false, reason: 'unknown_type' };
      }

      if (result.success) {
        success(`Injected AceWidget into ${c.bold}${targetFile}${c.reset}`);
        if (mode === 'inline') {
          log(`    ${c.dim}Move <AceWidget mode="inline" /> to where you want the panel.${c.reset}`);
        }
      } else if (result.reason === 'already_injected') {
        info('AceWidget already exists in this file. Skipping.');
      } else {
        warn(`Couldn\u2019t auto-inject into ${targetFile}. Add it manually:`);
        printManualSnippet(framework, isReact, mode, position, theme, adminSecret);
      }
    } else {
      warn('File not found. Add the widget manually:');
      printManualSnippet(framework, isReact, mode, position, theme, adminSecret);
    }
  } else {
    // No layout files found — print snippet
    warn('No layout files detected. Add the widget manually:');
    printManualSnippet(framework, isReact, mode, position, theme, adminSecret);
  }

  // ═══════════════════════════════════════
  // ── Step 8: Summary ──
  // ═══════════════════════════════════════
  log();
  log(`${c.dim}  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${c.reset}`);
  log(`${c.bold}${c.green}  \u2660 OpenAce Embed is ready!${c.reset}`);
  log();

  // Checklist
  success(`Server route: ${routePath}`);
  success(`Widget mode: ${mode}${position !== 'bottom-right' ? ` (${position})` : ''}, ${theme} theme`);

  if (keyCount > 0) {
    success(`AI: ${Object.keys(envKeys).join(' + ')} (auto-detected)`);
  } else if (licenseKey) {
    success('AI: OpenAce proxy (via license key)');
  } else {
    warn('AI: Add GEMINI_API_KEY to .env before first use');
  }

  log();
  log(`  ${c.dim}Start your dev server and Ace will be waiting for you.${c.reset}`);
  log(`  ${c.dim}Only admins with the secret can see/use it.${c.reset}`);
  log(`  ${c.dim}Docs: https://openaceai.com/embed/docs${c.reset}`);
  log();

  rl.close();
}


function printManualSnippet(framework, isReact, mode, position, theme, adminSecret) {
  log();
  if (isReact) {
    const envPrefix = getPublicEnvPrefix(framework);
    const envVarName = `${envPrefix}ACE_ADMIN_SECRET`;
    log(`${c.dim}  // Add to your admin layout:${c.reset}`);
    log(`${c.cyan}  import { AceWidget } from '@openace/embed';${c.reset}`);
    log(`${c.cyan}  import '@openace/embed/css';${c.reset}`);
    log();
    const props = [`serverUrl="/api/ace"`];
    props.push(`authToken={process.env.${envVarName} || ''}`);
    if (mode !== 'fab') props.push(`mode="${mode}"`);
    if (position !== 'bottom-right') props.push(`position="${position}"`);
    if (theme !== 'light') props.push(`theme="${theme}"`);
    log(`${c.cyan}  <AceWidget`);
    for (const p of props) log(`${c.cyan}    ${p}`);
    log(`${c.cyan}  />${c.reset}`);
  } else {
    log(`${c.dim}  <!-- Add before </body> in your admin page: -->${c.reset}`);
    log(`${c.cyan}  <script src="https://cdn.openaceai.com/ace-embed.min.js"></script>`);
    log(`  <script>`);
    log(`    OpenAce.init({`);
    log(`      serverUrl: '/api/ace',`);
    log(`      authToken: '${adminSecret || 'YOUR_ACE_ADMIN_SECRET'}',`);
    if (mode !== 'fab') log(`      mode: '${mode}',`);
    if (position !== 'bottom-right') log(`      position: '${position}',`);
    if (theme !== 'light') log(`      theme: '${theme}',`);
    log(`    });`);
    log(`  </script>${c.reset}`);
  }
}


main().catch(err => {
  error(err.message);
  process.exit(1);
});
