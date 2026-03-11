import fs from 'fs/promises';
import path from 'path';

class NetlifyAdapter {
  constructor(config = {}) {
    this.name = 'netlify';
    this.description = 'Deploy to Netlify';
    this.config = {
      token: config.token || process.env.NETLIFY_TOKEN || '',
      siteId: config.siteId || '',
    };
  }

  async getStatus() {
    if (!this.config.token) {
      return {
        configured: false,
        details: 'Netlify token not set. Add deploy.netlify.token to config/openace.config.json or set NETLIFY_TOKEN env var'
      };
    }
    // Verify token works
    try {
      const res = await fetch('https://api.netlify.com/api/v1/user', {
        headers: { 'Authorization': `Bearer ${this.config.token}` }
      });
      if (!res.ok) {
        return { configured: false, details: 'Netlify token is invalid. Check your token.' };
      }
      const user = await res.json();
      return { configured: true, details: `Netlify authenticated as ${user.email || user.slug}` };
    } catch (e) {
      return { configured: false, details: `Cannot reach Netlify API: ${e.message}` };
    }
  }

  async deploy(projectPath, options = {}) {
    const logs = [];
    const token = this.config.token;
    if (!token) {
      return { success: false, url: null, logs: ['No Netlify token configured'] };
    }

    try {
      // Collect all files recursively
      const files = await this._collectFiles(projectPath, projectPath);
      logs.push(`Found ${files.length} files to deploy`);

      // Build the file digest (SHA1 hashes for each file)
      const fileHashes = {};
      const fileContents = {};
      for (const file of files) {
        const content = await fs.readFile(file.fullPath);
        const hashBuffer = await crypto.subtle.digest('SHA-1', content);
        const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        fileHashes[file.relativePath] = hash;
        fileContents[hash] = { content, path: file.relativePath };
      }

      // Create or get site
      let siteId = options.siteId || this.config.siteId;
      if (!siteId) {
        logs.push('Creating new Netlify site...');
        const createRes = await fetch('https://api.netlify.com/api/v1/sites', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        });
        if (!createRes.ok) {
          const err = await createRes.text();
          return { success: false, url: null, logs: [...logs, `Failed to create site: ${err}`] };
        }
        const site = await createRes.json();
        siteId = site.id;
        logs.push(`Created site: ${site.name} (${site.id})`);
      }

      // Create deploy with file digest
      logs.push('Creating deployment...');
      const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: fileHashes
        })
      });

      if (!deployRes.ok) {
        const err = await deployRes.text();
        return { success: false, url: null, logs: [...logs, `Deploy creation failed: ${err}`] };
      }

      const deploy = await deployRes.json();
      logs.push(`Deploy created: ${deploy.id}`);

      // Upload required files (ones Netlify doesn't already have)
      const required = deploy.required || [];
      logs.push(`Uploading ${required.length} files...`);

      for (const hash of required) {
        const file = fileContents[hash];
        if (!file) continue;

        const uploadRes = await fetch(
          `https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${encodeURIComponent(file.path)}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/octet-stream'
            },
            body: file.content
          }
        );

        if (!uploadRes.ok) {
          logs.push(`Warning: Failed to upload ${file.path}`);
        }
      }

      // Get final deploy URL
      const url = deploy.ssl_url || deploy.url || `https://${deploy.subdomain}.netlify.app`;
      logs.push(`Deployed to: ${url}`);

      return {
        success: true,
        url,
        siteId,
        logs
      };

    } catch (err) {
      logs.push(`Netlify deploy error: ${err.message}`);
      return { success: false, url: null, logs };
    }
  }

  async _collectFiles(basePath, currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    const files = [];
    const skip = ['node_modules', '.git', '.firebaserc', 'firebase.json', 'project.json'];

    for (const entry of entries) {
      if (skip.includes(entry.name)) continue;
      const fullPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this._collectFiles(basePath, fullPath));
      } else {
        files.push({
          fullPath,
          relativePath: '/' + path.relative(basePath, fullPath)
        });
      }
    }
    return files;
  }
}

export default NetlifyAdapter;
