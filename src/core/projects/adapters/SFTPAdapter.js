import SftpClient from 'ssh2-sftp-client';
import { readdir, stat } from 'fs/promises';
import path from 'path';

class SFTPAdapter {
  constructor(config = {}) {
    this.name = 'sftp';
    this.description = 'Deploy via SFTP to remote server';
    this.config = {
      host: config.host || '',
      port: config.port || 22,
      username: config.username || '',
      password: config.password || '',
      basePath: config.basePath || '/var/www/html'
    };
  }

  /**
   * Check if SFTP credentials are configured
   */
  async getStatus() {
    if (!this.config.host || !this.config.username) {
      return {
        configured: false,
        details: 'SFTP not configured. Set host, username, and password in config/openace.config.json under deploy.sftp'
      };
    }

    // Don't test connection here - just verify config exists
    return {
      configured: true,
      details: `SFTP configured for ${this.config.username}@${this.config.host}:${this.config.port} → ${this.config.basePath}`
    };
  }

  /**
   * Deploy project files via SFTP
   * @param {string} projectPath - Absolute path to the project directory
   * @param {object} options - { projectName, projectMeta, deployPath? }
   */
  async deploy(projectPath, options = {}) {
    const logs = [];
    const sftp = new SftpClient();

    // Determine remote path: options.deployPath > projectMeta.deployPath > basePath/projectName
    const remotePath = options.deployPath || 
                       options.projectMeta?.deployPath || 
                       path.posix.join(this.config.basePath, options.projectName || path.basename(projectPath));

    logs.push(`Deploying to ${this.config.host}:${remotePath}`);

    try {
      // Connect
      logs.push(`Connecting to ${this.config.host}:${this.config.port}...`);
      await sftp.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password
      });
      logs.push('Connected successfully');

      // Ensure remote directory exists
      try {
        await sftp.mkdir(remotePath, true);
        logs.push(`Ensured remote directory exists: ${remotePath}`);
      } catch (err) {
        logs.push(`Note: mkdir for ${remotePath}: ${err.message}`);
      }

      // Upload all project files recursively
      const uploadCount = await this._uploadDirectory(sftp, projectPath, remotePath, logs);
      logs.push(`Uploaded ${uploadCount} files`);

      // Build the URL
      // Assume the basePath maps to the web root
      const relativePath = remotePath.replace(this.config.basePath, '').replace(/^\//, '');
      const url = `https://${this.config.host}/${relativePath}`;
      logs.push(`Deployed to: ${url}`);

      await sftp.end();
      logs.push('SFTP connection closed');

      return {
        success: true,
        url,
        logs
      };

    } catch (err) {
      logs.push(`SFTP deploy error: ${err.message}`);
      try { await sftp.end(); } catch { /* ignore close errors */ }
      return {
        success: false,
        url: null,
        logs
      };
    }
  }

  /**
   * Recursively upload a directory
   * @private
   */
  async _uploadDirectory(sftp, localDir, remoteDir, logs) {
    let count = 0;
    const entries = await readdir(localDir, { withFileTypes: true });

    for (const entry of entries) {
      const localPath = path.join(localDir, entry.name);
      const remoteDest = path.posix.join(remoteDir, entry.name);

      // Skip certain files/directories
      if (['node_modules', '.git', '.firebaserc', 'firebase.json', 'project.json'].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        try {
          await sftp.mkdir(remoteDest, true);
        } catch { /* directory may already exist */ }
        count += await this._uploadDirectory(sftp, localPath, remoteDest, logs);
      } else {
        try {
          await sftp.put(localPath, remoteDest);
          logs.push(`  ↑ ${entry.name}`);
          count++;
        } catch (err) {
          logs.push(`  ✗ Failed to upload ${entry.name}: ${err.message}`);
        }
      }
    }

    return count;
  }
}

export default SFTPAdapter;
