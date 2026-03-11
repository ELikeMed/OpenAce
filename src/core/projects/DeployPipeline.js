import { readFile, writeFile } from 'fs/promises';
import path from 'path';

class DeployPipeline {
  constructor(options = {}) {
    this.adapters = new Map();       // name → adapter instance
    this.deployHistory = [];         // track all deployments
    this.projectManager = options.projectManager;
    this.baseDir = options.baseDir || process.cwd();
    this.projectsDir = options.projectsDir || path.join(this.baseDir, 'projects');
  }

  /**
   * Register a deploy adapter
   * @param {string} name - Unique adapter name (e.g., 'local', 'firebase', 'sftp')
   * @param {object} adapter - Adapter instance implementing { name, description, configured, deploy(), getStatus() }
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name, adapter);
    console.log(`[DeployPipeline] Registered adapter: ${name}`);
  }

  /**
   * Deploy a project to a target
   * @param {string} projectName - Name of the project directory
   * @param {string} targetName - Name of the registered adapter
   * @param {object} options - Target-specific options
   * @returns {{ id, projectName, target, timestamp, success, url, logs, options, error? }}
   */
  async deploy(projectName, targetName, options = {}) {
    const timestamp = new Date().toISOString();

    // 1. Validate project exists
    const projectPath = path.join(this.projectsDir, projectName);
    const projectJsonPath = path.join(projectPath, 'project.json');

    let projectMeta;
    try {
      const raw = await readFile(projectJsonPath, 'utf-8');
      projectMeta = JSON.parse(raw);
    } catch (err) {
      return {
        success: false,
        url: null,
        target: targetName,
        timestamp,
        logs: [`Project "${projectName}" not found or has no project.json`],
        error: 'PROJECT_NOT_FOUND'
      };
    }

    // 2. Get the adapter
    const adapter = this.adapters.get(targetName);
    if (!adapter) {
      return {
        success: false,
        url: null,
        target: targetName,
        timestamp,
        logs: [`Deploy target "${targetName}" not found. Available: ${[...this.adapters.keys()].join(', ')}`],
        error: 'ADAPTER_NOT_FOUND'
      };
    }

    // 3. Check adapter is configured
    const status = await adapter.getStatus();
    if (!status.configured) {
      return {
        success: false,
        url: null,
        target: targetName,
        timestamp,
        logs: [`Deploy target "${targetName}" is not configured. ${status.details || ''}`],
        error: 'ADAPTER_NOT_CONFIGURED'
      };
    }

    // 4. Call adapter.deploy()
    let result;
    try {
      result = await adapter.deploy(projectPath, { ...options, projectName, projectMeta });
    } catch (err) {
      result = {
        success: false,
        url: null,
        logs: [`Deploy error: ${err.message}`]
      };
    }

    // 5. Build deploy record
    const deployRecord = {
      id: `deploy_${Date.now()}`,
      projectName,
      target: targetName,
      timestamp,
      success: result.success,
      url: result.url || null,
      logs: result.logs || [],
      options
    };

    // 6. Log to deployHistory
    this.deployHistory.push(deployRecord);

    // 7. Update project.json with deploy info
    try {
      if (!projectMeta.deploys) {
        projectMeta.deploys = [];
      }
      projectMeta.deploys.push({
        id: deployRecord.id,
        target: targetName,
        timestamp,
        success: result.success,
        url: result.url || null
      });
      projectMeta.lastDeploy = {
        target: targetName,
        timestamp,
        success: result.success,
        url: result.url || null
      };
      await writeFile(projectJsonPath, JSON.stringify(projectMeta, null, 2));
    } catch (err) {
      deployRecord.logs.push(`Warning: Could not update project.json: ${err.message}`);
    }

    return deployRecord;
  }

  /**
   * List available adapters with their config status
   * @returns {Promise<Array<{ name, description, configured, details }>>}
   */
  async getAdapters() {
    const results = [];
    for (const [name, adapter] of this.adapters) {
      const status = await adapter.getStatus();
      results.push({
        name,
        description: adapter.description || name,
        configured: status.configured,
        details: status.details || null
      });
    }
    return results;
  }

  /**
   * Get deploy history for a specific project (or all if no name given)
   * @param {string} [projectName] - Optional project name filter
   * @returns {Array} Deploy records
   */
  getDeployHistory(projectName) {
    if (projectName) {
      return this.deployHistory.filter(d => d.projectName === projectName);
    }
    return [...this.deployHistory];
  }
}

export default DeployPipeline;
