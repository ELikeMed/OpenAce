import { execSync, exec } from 'child_process';
import { writeFile, readFile, access } from 'fs/promises';
import path from 'path';

class FirebaseAdapter {
  constructor(config = {}) {
    this.name = 'firebase';
    this.description = 'Deploy to Firebase Hosting';
    this.config = config; // { defaultProjectId }
  }

  /**
   * Check if firebase-tools is installed and user is logged in
   */
  async getStatus() {
    try {
      // Check if firebase CLI exists
      execSync('firebase --version', { stdio: 'pipe' });
    } catch (err) {
      return {
        configured: false,
        details: 'firebase-tools not installed. Run: npm install -g firebase-tools'
      };
    }

    try {
      // Check if user is logged in
      const result = execSync('firebase login:list', { stdio: 'pipe', encoding: 'utf-8' });
      if (result.includes('No authorized accounts')) {
        return {
          configured: false,
          details: 'Not logged in to Firebase. Run: firebase login'
        };
      }
    } catch (err) {
      return {
        configured: false,
        details: 'Cannot verify Firebase login status. Run: firebase login'
      };
    }

    return {
      configured: true,
      details: 'Firebase CLI installed and authenticated'
    };
  }

  /**
   * Deploy to Firebase Hosting
   */
  async deploy(projectPath, options = {}) {
    const logs = [];
    const firebaseProjectId = options.firebaseProjectId ||
                               options.projectMeta?.firebaseProjectId ||
                               this.config.defaultProjectId;

    if (!firebaseProjectId) {
      return {
        success: false,
        url: null,
        logs: ['No Firebase project ID provided. Set firebaseProjectId in deploy options or project.json']
      };
    }

    logs.push(`Deploying to Firebase project: ${firebaseProjectId}`);

    try {
      // Create firebase.json if it doesn't exist
      const firebaseJsonPath = path.join(projectPath, 'firebase.json');
      try {
        await access(firebaseJsonPath);
        logs.push('Using existing firebase.json');
      } catch {
        const firebaseConfig = {
          hosting: {
            public: '.',
            ignore: ['firebase.json', '.firebaserc', 'project.json', 'node_modules/**'],
            rewrites: [
              { source: '**', destination: '/index.html' }
            ]
          }
        };
        await writeFile(firebaseJsonPath, JSON.stringify(firebaseConfig, null, 2));
        logs.push('Created firebase.json with default hosting config');
      }

      // Create .firebaserc with project ID
      const firebasercPath = path.join(projectPath, '.firebaserc');
      const firebaserc = {
        projects: {
          default: firebaseProjectId
        }
      };
      await writeFile(firebasercPath, JSON.stringify(firebaserc, null, 2));
      logs.push(`Set Firebase project to: ${firebaseProjectId}`);

      // Run firebase deploy
      logs.push('Running firebase deploy --only hosting...');

      const deployResult = await new Promise((resolve, reject) => {
        exec(
          'firebase deploy --only hosting --non-interactive',
          { cwd: projectPath, timeout: 120000, encoding: 'utf-8' },
          (error, stdout, stderr) => {
            if (error) {
              reject(new Error(`Deploy failed: ${stderr || error.message}`));
            } else {
              resolve(stdout + (stderr || ''));
            }
          }
        );
      });

      logs.push('Firebase deploy output:');
      logs.push(deployResult);

      // Parse hosting URL from output
      const urlMatch = deployResult.match(/Hosting URL:\s*(https?:\/\/\S+)/i);
      const url = urlMatch ? urlMatch[1] : `https://${firebaseProjectId}.web.app`;

      logs.push(`Deployed successfully to: ${url}`);

      return {
        success: true,
        url,
        logs
      };

    } catch (err) {
      logs.push(`Firebase deploy error: ${err.message}`);
      return {
        success: false,
        url: null,
        logs
      };
    }
  }
}

export default FirebaseAdapter;
