/**
 * OpenAce Agent Orchestrator
 * The "Executive Brain" that delegates tasks to specialized agents
 * 
 * Ace acts as the CTO/CEO - understands tasks and assigns work to:
 * - CodeAgent: File editing, coding, git, npm
 * - BrowserAgent: Web automation, scraping, logins
 * - ResearchAgent: Web research, data gathering
 * - LeadAgent: Lead generation, pipeline management
 * - EmailAgent: Email campaigns, notifications
 */

import { CodeAgent } from './CodeAgent.js';

export class AgentOrchestrator {
  constructor(options = {}) {
    this.aiManager = options.aiManager;
    this.permissionsManager = options.permissionsManager;
    this.pipelineManager = options.pipelineManager;
    this.baseDir = options.baseDir || process.cwd();
    this.onProgress = options.onProgress || ((msg) => console.log(`[Orchestrator] ${msg}`));
    
    // Initialize agents
    this.agents = {};
    this.initialized = false;
  }

  /**
   * Initialize all agents
   */
  async initialize(existingAgents = {}) {
    this.onProgress('🎯 Initializing Agent Orchestrator...');

    // Code Agent - for file/code operations
    this.agents.code = new CodeAgent({
      workingDir: this.baseDir,
      permissionsManager: this.permissionsManager,
      aiManager: this.aiManager,
      onProgress: this.onProgress
    });
    await this.agents.code.initialize();

    // Use existing agents if provided (BrowserAgent, ResearchAgent)
    if (existingAgents.browser) {
      this.agents.browser = existingAgents.browser;
    }
    if (existingAgents.research) {
      this.agents.research = existingAgents.research;
    }
    if (existingAgents.pipeline) {
      this.agents.pipeline = existingAgents.pipeline;
    }
    if (existingAgents.desktop) {
      this.agents.desktop = existingAgents.desktop;
    }

    this.initialized = true;
    this.onProgress('✅ Agent Orchestrator ready');
    
    return this;
  }

  /**
   * Analyze a task and determine which agent(s) to use
   */
  async analyzeTask(task) {
    const taskStr = typeof task === 'string' ? task : (task?.description || task?.task || String(task));
    this.onProgress(`🧠 Analyzing task: "${taskStr.substring(0, 50)}..."`);

    // Pattern matching for common task types
    const patterns = {
      code: [
        // File operations
        /\b(code|write|create|edit|modify|update|add|implement|fix|refactor|debug|change|read|list|show|build)\b/i,
        /\b(file|files|folder|directory|path)\b/i,
        // UI/Design related
        /\b(logo|icon|image|ui|interface|design|color|theme|css|html|style)\b/i,
        // Code constructs
        /\b(function|class|component|module|api|endpoint|route)\b/i,
        // Technologies
        /\b(javascript|typescript|python|react|node|npm|git)\b/i,
        // Roles
        /\b(cto|developer|engineer|coding)\b/i,
        // Dashboard/OpenAce specific
        /\b(dashboard|openace|renderer)\b/i,
        // Project types
        /\b(landing\s*page|website|webapp|web\s*app|server|backend|frontend)\b/i
      ],
      browser: [
        /\b(browse|navigate|login|open|visit|scrape|click|fill form)\b/i,
        /\b(website|webpage|url|site|page)\b/i,
        /\b(likemindedpro|google|linkedin)\b/i
      ],
      research: [
        /\b(research|search|find|look up|gather|investigate)\b/i,
        /\b(information|data|details|facts)\b/i
      ],
      lead: [
        /\b(lead|prospect|contact|client|customer)\b/i,
        /\b(pipeline|crm|sales|outreach)\b/i,
        /\b(find companies|find businesses)\b/i
      ],
      email: [
        /\b(email|send|campaign|newsletter|message)\b/i,
        /\b(outreach|follow up|contact)\b/i
      ],
      deploy: [
        /\b(deploy|publish|release|ship|launch)\b/i,
        /\b(production|staging|server)\b/i
      ]
    };

    // Score each agent type
    const scores = {};
    for (const [agentType, patternList] of Object.entries(patterns)) {
      scores[agentType] = patternList.reduce((score, pattern) => {
        return score + (pattern.test(taskStr) ? 1 : 0);
      }, 0);
    }

    // Get the primary agent (highest score)
    const sortedAgents = Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort((a, b) => b[1] - a[1]);

    if (sortedAgents.length === 0) {
      return {
        primaryAgent: 'chat',
        supportingAgents: [],
        confidence: 0.5,
        reason: 'No specific agent pattern matched, using general chat'
      };
    }

    const [primaryAgent, primaryScore] = sortedAgents[0];
    const supportingAgents = sortedAgents.slice(1, 3).map(([agent]) => agent);

    return {
      primaryAgent,
      supportingAgents,
      confidence: Math.min(primaryScore / 3, 1),
      reason: `Pattern match score: ${primaryScore}`,
      scores
    };
  }

  /**
   * Route a task (wrapper for execute to handle object inputs)
   */
  async routeTask(task) {
    const taskDesc = typeof task === 'string' ? task : (task.description || task.task || 'Execute task');
    return this.execute(taskDesc);
  }

  /**
   * Create an execution plan for a task
   */
  async planTask(task, analysis = null) {
    if (!analysis) {
      analysis = await this.analyzeTask(task);
    }

    this.onProgress(`📋 Planning task with ${analysis.primaryAgent} agent...`);

    // Use AI to create detailed plan if available
    if (this.aiManager && analysis.confidence < 0.8) {
      try {
        const planPrompt = `You are the OpenAce Orchestrator. Create an execution plan for this task.

TASK: ${task}

AVAILABLE AGENTS:
- code: Read/write files, edit code, run commands (npm, git), analyze code
- browser: Navigate websites, login, fill forms, scrape data
- research: Search the web, gather information
- lead: Find leads, manage pipeline, qualify prospects
- email: Send emails, campaigns, notifications
- deploy: Deploy code, manage servers

INITIAL ANALYSIS:
- Primary Agent: ${analysis.primaryAgent}
- Supporting: ${(analysis.supportingAgents || []).join(', ') || 'none'}

Create a step-by-step plan. Return JSON:
{
  "plan": "Brief description",
  "steps": [
    {
      "agent": "code|browser|research|lead|email|deploy",
      "action": "specific action name",
      "params": { "key": "value" },
      "description": "What this step does"
    }
  ],
  "expectedOutcome": "What success looks like"
}`;

        const response = await this.aiManager.chat([
          { role: 'user', content: planPrompt }
        ]);

        // Try to parse JSON from response
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const plan = JSON.parse(jsonMatch[0]);
          return {
            success: true,
            ...plan,
            analysis
          };
        }
      } catch (error) {
        this.onProgress(`⚠️ AI planning failed, using simple plan: ${error.message}`);
      }
    }

    // Fallback to simple single-step plan
    return {
      success: true,
      plan: `Execute task using ${analysis.primaryAgent} agent`,
      steps: [{
        agent: analysis.primaryAgent,
        action: 'execute',
        params: { task },
        description: task
      }],
      expectedOutcome: 'Task completed successfully',
      analysis
    };
  }

  /**
   * Execute a task through the appropriate agent(s)
   */
  async execute(task, options = {}) {
    if (!this.initialized) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    const taskPreview = typeof task === 'string' ? task.substring(0, 60) : 'Execute task';
    this.onProgress(`\n🚀 Starting task: "${taskPreview}..."\n`);

    try {
      // Step 1: Analyze the task
      const analysis = await this.analyzeTask(task);
      this.onProgress(`   Primary agent: ${analysis.primaryAgent} (confidence: ${(analysis.confidence * 100).toFixed(0)}%)`);

      // Step 2: Check permissions
      if (this.permissionsManager) {
        const permission = await this.checkPermissions(analysis.primaryAgent, task);
        if (!permission.allowed) {
          return {
            success: false,
            error: `Permission denied: ${permission.reason}`,
            requiresApproval: permission.requiresApproval,
            summary: `❌ Permission denied: ${permission.reason}`
          };
        }
      }

      // FAST PATH: For code tasks, skip AI planning and go directly to CodeAgent
      // The CodeAgent has built-in project type detection that works without AI planning
      if (analysis.primaryAgent === 'code' && this.agents.code) {
        this.onProgress('💻 Code task detected — using direct CodeAgent execution');
        try {
          const codeResult = await this.agents.code.executeTask(task);
          const success = codeResult.success !== false;
          return {
            success,
            task,
            plan: codeResult.plan || 'Direct code execution',
            expectedOutcome: 'Code task completed',
            stepsCompleted: success ? 1 : 0,
            totalSteps: 1,
            results: [{ step: { description: 'Execute code task' }, result: codeResult, success }],
            summary: codeResult.message || codeResult.summary || (success ? '✅ Code task completed' : '❌ Code task failed'),
            data: codeResult
          };
        } catch (codeError) {
          this.onProgress(`⚠️ Direct code execution failed: ${codeError.message}`);
          // Fall through to AI planning as backup
        }
      }

      // Step 3: Plan the task (AI-assisted for non-code tasks)
      const plan = await this.planTask(task, analysis);
      if (!plan.success) {
        return { success: false, error: 'Failed to create execution plan', summary: '❌ Failed to create execution plan' };
      }

      // Ensure plan.steps is always an array
      const steps = Array.isArray(plan.steps) ? plan.steps : [{
        agent: analysis.primaryAgent,
        action: 'execute',
        params: { task },
        description: task
      }];

      // Step 4: Execute the plan
      const results = [];
      for (const step of steps) {
        this.onProgress(`\n📍 Step: ${step.description || 'Executing...'}`);
        
        try {
          const result = await this.executeStep(step);
          // Use the step result's actual success status (not hardcoded true)
          const stepSuccess = result.success !== false && !result.error;
          results.push({ step, result, success: stepSuccess });
          
          // Check if we should continue
          if (!stepSuccess && !options.continueOnError) {
            break;
          }
        } catch (error) {
          results.push({ step, error: error.message, success: false });
          if (!options.continueOnError) {
            break;
          }
        }
      }

      // Step 5: Compile results
      const successCount = results.filter(r => r.success).length;
      const allSuccess = successCount === steps.length;

      return {
        success: allSuccess,
        task,
        plan: plan.plan,
        expectedOutcome: plan.expectedOutcome,
        stepsCompleted: successCount,
        totalSteps: steps.length,
        results,
        summary: this.summarizeResults(results)
      };
    } catch (error) {
      this.onProgress(`❌ Orchestrator error: ${error.message}`);
      return {
        success: false,
        task,
        error: error.message,
        summary: `❌ Task failed: ${error.message}`
      };
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(step) {
    const agent = this.agents[step.agent];
    
    if (!agent) {
      // If agent doesn't exist, try to handle with AI or return error
      return {
        success: false,
        error: `Agent '${step.agent}' not available`,
        skipped: true
      };
    }

    // Route to appropriate agent method
    switch (step.agent) {
      case 'code':
        return this.executeCodeStep(agent, step);
      case 'browser':
        return this.executeBrowserStep(agent, step);
      case 'research':
        return this.executeResearchStep(agent, step);
      case 'desktop':
        return this.executeDesktopStep(agent, step);
      default:
        // Generic execution
        if (typeof agent.execute === 'function') {
          return agent.execute(step.action, step.params);
        }
        return { error: `No handler for agent: ${step.agent}` };
    }
  }

  /**
   * Execute a desktop-related step
   */
  async executeDesktopStep(agent, step) {
    switch (step.action) {
      case 'findAndClick':
        return agent.findAndClick(step.params.description);
      case 'findAndType':
        return agent.findAndType(step.params.description, step.params.text);
      case 'type':
        return agent.type(step.params.text);
      default:
        return { error: `Unknown desktop action: ${step.action}` };
    }
  }

  /**
   * Execute a code-related step
   */
  async executeCodeStep(agent, step) {
    const params = step.params || {};
    
    switch (step.action) {
      case 'readFile':
        return agent.readFile(params.path);
      case 'writeFile':
        return agent.writeFile(params.path, params.content);
      case 'editFile':
        return agent.editFile(params.path, params.edits || []);
      case 'deleteFile':
        return agent.deleteFile(params.path);
      case 'listFiles':
        return agent.listFiles(params.path || '.', params);
      case 'searchCode':
        return agent.searchCode(params.pattern, params.directory);
      case 'runCommand':
        return agent.runCommand(params.command || params.cmd);
      case 'git':
        return agent.git(params.operation, params.args);
      case 'npm':
        return agent.npm(params.operation, params.args);
      case 'analyzeCode':
        return agent.analyzeCode(params.path);
      case 'createProject':
        return agent.createProject(params.projectType || params.type || 'static-site', params.options || params);
      case 'createFromTemplate':
        return agent.createFromTemplate(params.path, params.templateType, params.variables || {});
      case 'execute':
      case 'task':
        // AI-driven task execution — the primary code execution path
        return agent.executeTask(params.task || step.description || params.description, params.context || {});
      default:
        // Try to use executeTask as a catch-all for unknown actions
        if (step.description || params.task) {
          return agent.executeTask(params.task || step.description, params.context || {});
        }
        return { success: false, error: `Unknown code action: ${step.action}` };
    }
  }

  /**
   * Execute a browser-related step
   */
  async executeBrowserStep(agent, step) {
    switch (step.action) {
      case 'navigate':
        return agent.navigateTo(step.params.url);
      case 'login':
        return agent.login(step.params.credentials, step.params.selectors);
      case 'click':
        return agent.click(step.params.selector);
      case 'type':
        return agent.type(step.params.selector, step.params.text);
      case 'screenshot':
        return agent.takeScreenshot(step.params.name);
      case 'executeSOP':
        return agent.executeSOP(step.params.sopId);
      default:
        return { error: `Unknown browser action: ${step.action}` };
    }
  }

  /**
   * Execute a research-related step
   */
  async executeResearchStep(agent, step) {
    switch (step.action) {
      case 'search':
        return agent.search(step.params.query);
      case 'scrape':
        return agent.scrape(step.params.url);
      case 'gather':
        return agent.gatherInfo(step.params.topic);
      default:
        return { error: `Unknown research action: ${step.action}` };
    }
  }

  /**
   * Check permissions for an action
   */
  async checkPermissions(agentType, task) {
    if (!this.permissionsManager) {
      return { allowed: true };
    }

    const permissions = this.permissionsManager.getPermissions();
    
    // Map agent types to permission categories
    const permissionMap = {
      code: 'file_system',
      browser: 'web_access',
      email: 'communication.email',
      research: 'research',
      lead: 'pipeline',
      deploy: 'file_system'
    };

    // "chat" and "auto" types are always allowed (they're just AI responses)
    if (agentType === 'chat' || agentType === 'auto' || !permissionMap[agentType]) {
      return { allowed: true };
    }

    const category = permissionMap[agentType];
    const categoryPermissions = this.getNestedPermission(permissions, category);

    // If the category doesn't exist or doesn't have 'enabled', default to allowed
    if (categoryPermissions === undefined || categoryPermissions?.enabled !== false) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `${agentType} operations are disabled in permissions`,
      requiresApproval: true
    };
  }

  /**
   * Get nested permission value
   */
  getNestedPermission(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Summarize execution results
   */
  summarizeResults(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    let summary = '';
    
    if (successful.length > 0) {
      summary += `✅ Completed ${successful.length} step(s):\n`;
      successful.forEach(r => {
        summary += `   - ${r.step.description}\n`;
      });
    }

    if (failed.length > 0) {
      summary += `❌ Failed ${failed.length} step(s):\n`;
      failed.forEach(r => {
        summary += `   - ${r.step.description}: ${r.error}\n`;
      });
    }

    return summary;
  }

  /**
   * Quick coding task - convenience method
   */
  async code(task, context = {}) {
    this.onProgress(`💻 Code task: ${task}`);
    
    if (!this.agents.code) {
      throw new Error('Code agent not initialized');
    }

    return this.agents.code.executeTask(task, context);
  }

  /**
   * Quick file operations
   */
  async readFile(path) {
    return this.agents.code.readFile(path);
  }

  async writeFile(path, content) {
    return this.agents.code.writeFile(path, content);
  }

  async editFile(path, edits) {
    return this.agents.code.editFile(path, edits);
  }

  async searchCode(pattern, dir = '.') {
    return this.agents.code.searchCode(pattern, dir);
  }

  async runCommand(cmd) {
    return this.agents.code.runCommand(cmd);
  }

  /**
   * Get available agents
   */
  getAvailableAgents() {
    return Object.keys(this.agents).filter(name => this.agents[name] !== null);
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      availableAgents: this.getAvailableAgents(),
      workingDirectory: this.baseDir
    };
  }
}

export default AgentOrchestrator;
