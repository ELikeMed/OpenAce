import path from 'path';

class LocalAdapter {
  constructor(config = {}) {
    this.name = 'local';
    this.description = 'Local Preview — view project on the local dev server';
    this.port = config.port || 3333;
    this.host = config.host || 'localhost';
  }

  /**
   * Always configured since it just uses the local server
   */
  async getStatus() {
    return {
      configured: true,
      details: `Local preview available at http://${this.host}:${this.port}/projects/`
    };
  }

  /**
   * "Deploy" to local preview — just returns the local URL
   * @param {string} projectPath - Absolute path to the project directory
   * @param {object} options - { projectName, projectMeta }
   */
  async deploy(projectPath, options = {}) {
    const projectName = options.projectName || path.basename(projectPath);
    const url = `http://${this.host}:${this.port}/projects/${projectName}/`;
    
    return {
      success: true,
      url,
      logs: [
        `Project "${projectName}" is available at local preview`,
        `URL: ${url}`,
        'No deployment needed — files are served directly from the projects directory'
      ]
    };
  }
}

export default LocalAdapter;
