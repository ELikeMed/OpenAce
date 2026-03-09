/**
 * OpenAce Permissions Manager
 * Controls what Ace can do autonomously vs what requires approval
 */

import fs from 'fs/promises';

export class PermissionsManager {
  constructor(permissionsPath) {
    this.permissionsPath = permissionsPath;
    this.permissions = null;
    this.actionLog = [];
  }

  async initialize() {
    await this.loadPermissions();
    console.log(`✅ Permissions loaded (autonomy: ${this.permissions.global.autonomy_level})`);
    return this;
  }

  async loadPermissions() {
    try {
      const data = await fs.readFile(this.permissionsPath, 'utf-8');
      this.permissions = JSON.parse(data);
    } catch (error) {
      console.log('No permissions file found, creating default...');
      this.permissions = this.getDefaultPermissions();
      await this.savePermissions();
    }
  }

  async savePermissions() {
    this.permissions.updated_at = new Date().toISOString();
    await fs.writeFile(
      this.permissionsPath,
      JSON.stringify(this.permissions, null, 2)
    );
  }

  /**
   * Check if an action is allowed
   * @param {string} action - The action to check (e.g., 'web_search', 'send_email')
   * @param {object} context - Additional context about the action
   * @returns {object} - { allowed: boolean, reason: string, requiresApproval: boolean }
   */
  checkPermission(action, context = {}) {
    const riskLevel = this.getActionRiskLevel(action);
    const autonomyLevel = this.permissions.global.autonomy_level;

    // Determine if action is allowed based on autonomy level
    let allowed = false;
    let requiresApproval = false;
    let reason = '';

    switch (autonomyLevel) {
      case 'low':
        // Only auto-execute explicitly allowed low-risk actions
        if (riskLevel === 'low_risk' && this.isInAutoExecuteList(action)) {
          allowed = true;
          reason = 'Action is low-risk and auto-execute enabled';
        } else {
          requiresApproval = true;
          reason = 'Low autonomy - requires approval';
        }
        break;

      case 'medium':
        // Auto-execute low-risk, notify on medium, require approval on high
        if (riskLevel === 'low_risk') {
          allowed = true;
          reason = 'Action is low-risk';
        } else if (riskLevel === 'medium_risk') {
          allowed = true;
          requiresApproval = false;
          reason = 'Action is medium-risk - will notify';
        } else {
          requiresApproval = true;
          reason = 'High-risk action requires approval';
        }
        break;

      case 'high':
        // Auto-execute low and medium, require approval only for high
        if (riskLevel === 'high_risk') {
          requiresApproval = true;
          reason = 'High-risk action requires approval';
        } else {
          allowed = true;
          reason = 'High autonomy - action allowed';
        }
        break;

      case 'full':
        // Execute everything (dangerous!)
        allowed = true;
        reason = 'Full autonomy enabled';
        break;

      default:
        requiresApproval = true;
        reason = 'Unknown autonomy level';
    }

    // Check specific permission categories
    const categoryCheck = this.checkCategoryPermission(action, context);
    if (!categoryCheck.allowed) {
      allowed = false;
      requiresApproval = false; // Can't even request approval if category disabled
      reason = categoryCheck.reason;
    }

    return { allowed, requiresApproval, reason, riskLevel };
  }

  /**
   * Check category-specific permissions
   */
  checkCategoryPermission(action, context) {
    // Web access permissions
    if (action.startsWith('web_') || action === 'scrape_page') {
      if (!this.permissions.web_access.enabled) {
        return { allowed: false, reason: 'Web access is disabled' };
      }
      if (context.domain && !this.isDomainAllowed(context.domain)) {
        return { allowed: false, reason: `Domain ${context.domain} is not in allowed list` };
      }
      if (action === 'web_fill_form' && !this.permissions.web_access.can_fill_forms) {
        return { allowed: false, reason: 'Form filling is disabled' };
      }
      if (action === 'web_login' && !this.permissions.web_access.can_login) {
        return { allowed: false, reason: 'Login to services is disabled' };
      }
    }

    // Pipeline permissions
    if (action.startsWith('pipeline_')) {
      if (!this.permissions.pipeline.enabled) {
        return { allowed: false, reason: 'Pipeline access is disabled' };
      }
      if (action === 'pipeline_add_lead' && !this.permissions.pipeline.can_add_leads) {
        return { allowed: false, reason: 'Adding leads is disabled' };
      }
      if (action === 'pipeline_add_task' && !this.permissions.pipeline.can_add_tasks) {
        return { allowed: false, reason: 'Adding tasks is disabled' };
      }
      if (action === 'pipeline_move' && !this.permissions.pipeline.can_move_stages) {
        return { allowed: false, reason: 'Moving pipeline stages is disabled' };
      }
      if (action === 'pipeline_delete' && !this.permissions.pipeline.can_delete) {
        return { allowed: false, reason: 'Deleting from pipeline is disabled' };
      }
    }

    // Communication permissions
    if (action.startsWith('email_') || action.startsWith('call_')) {
      if (action.startsWith('email_')) {
        if (!this.permissions.communication.email.enabled) {
          return { allowed: false, reason: 'Email is disabled' };
        }
        if (action === 'email_send' && !this.permissions.communication.email.can_send) {
          return { allowed: false, reason: 'Sending emails is disabled' };
        }
      }
      if (action.startsWith('call_')) {
        if (!this.permissions.communication.calls.enabled) {
          return { allowed: false, reason: 'Calls are disabled' };
        }
        if (action === 'call_initiate' && !this.permissions.communication.calls.can_initiate) {
          return { allowed: false, reason: 'Initiating calls is disabled' };
        }
      }
    }

    // File system permissions
    if (action.startsWith('file_')) {
      if (!this.permissions.file_system.enabled) {
        return { allowed: false, reason: 'File system access is disabled' };
      }
      if (context.path && !this.isPathAllowed(context.path)) {
        return { allowed: false, reason: `Path ${context.path} is not in allowed list` };
      }
      if (action === 'file_create' && !this.permissions.file_system.can_create) {
        return { allowed: false, reason: 'Creating files is disabled' };
      }
      if (action === 'file_modify' && !this.permissions.file_system.can_modify) {
        return { allowed: false, reason: 'Modifying files is disabled' };
      }
      if (action === 'file_delete' && !this.permissions.file_system.can_delete) {
        return { allowed: false, reason: 'Deleting files is disabled' };
      }
    }

    // Research permissions
    if (action.startsWith('research_')) {
      if (!this.permissions.research.enabled) {
        return { allowed: false, reason: 'Research is disabled' };
      }
    }

    return { allowed: true, reason: 'Category permission check passed' };
  }

  /**
   * Get the risk level for an action
   */
  getActionRiskLevel(action) {
    const { risk_levels } = this.permissions;
    
    if (risk_levels.low_risk.includes(action)) return 'low_risk';
    if (risk_levels.medium_risk.includes(action)) return 'medium_risk';
    if (risk_levels.high_risk.includes(action)) return 'high_risk';
    
    // Default to medium risk for unknown actions
    return 'medium_risk';
  }

  /**
   * Check if action is in auto-execute list
   */
  isInAutoExecuteList(action) {
    return this.permissions.global.auto_execute.includes(this.getActionRiskLevel(action));
  }

  /**
   * Check if a domain is allowed for web access
   */
  isDomainAllowed(domain) {
    const { allowed_domains, blocked_domains } = this.permissions.web_access;
    
    // Check if explicitly blocked
    if (blocked_domains.some(d => domain.includes(d))) {
      return false;
    }
    
    // Check if in allowed list (or if list is empty, allow all)
    if (allowed_domains.length === 0) return true;
    return allowed_domains.some(d => domain.includes(d));
  }

  /**
   * Check if a file path is allowed
   */
  isPathAllowed(filePath) {
    const { allowed_paths } = this.permissions.file_system;
    const expandedPath = filePath.replace('~', process.env.HOME);
    
    return allowed_paths.some(p => {
      const expandedAllowed = p.replace('~', process.env.HOME);
      return expandedPath.startsWith(expandedAllowed);
    });
  }

  /**
   * Log an action (for activity tracking)
   */
  logAction(action, context, result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      context,
      result,
      riskLevel: this.getActionRiskLevel(action)
    };
    
    this.actionLog.push(logEntry);
    
    // Keep only last 1000 actions in memory
    if (this.actionLog.length > 1000) {
      this.actionLog = this.actionLog.slice(-1000);
    }
    
    return logEntry;
  }

  /**
   * Get recent actions
   */
  getRecentActions(limit = 50) {
    return this.actionLog.slice(-limit).reverse();
  }

  /**
   * Update a permission setting
   */
  async updatePermission(path, value) {
    const keys = path.split('.');
    let obj = this.permissions;
    
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    
    obj[keys[keys.length - 1]] = value;
    await this.savePermissions();
    
    return this.permissions;
  }

  /**
   * Add a domain to allowed list
   */
  async addAllowedDomain(domain) {
    if (!this.permissions.web_access.allowed_domains.includes(domain)) {
      this.permissions.web_access.allowed_domains.push(domain);
      await this.savePermissions();
    }
    return this.permissions.web_access.allowed_domains;
  }

  /**
   * Remove a domain from allowed list
   */
  async removeAllowedDomain(domain) {
    this.permissions.web_access.allowed_domains = 
      this.permissions.web_access.allowed_domains.filter(d => d !== domain);
    await this.savePermissions();
    return this.permissions.web_access.allowed_domains;
  }

  /**
   * Add a path to allowed file system paths
   */
  async addAllowedPath(filePath) {
    if (!this.permissions.file_system.allowed_paths.includes(filePath)) {
      this.permissions.file_system.allowed_paths.push(filePath);
      await this.savePermissions();
    }
    return this.permissions.file_system.allowed_paths;
  }

  /**
   * Set autonomy level (accepts string names, soul.json mode names, or numeric values)
   * Modes from soul.json: guardian (1), collaborative (2), trusted (3), autopilot (4/5)
   */
  async setAutonomyLevel(level) {
    const validLevels = ['low', 'medium', 'high', 'full'];

    // Map soul.json mode names → internal levels
    const modeMap = { guardian: 'low', collaborative: 'medium', trusted: 'high', autopilot: 'full' };
    if (typeof level === 'string' && modeMap[level.toLowerCase()]) {
      level = modeMap[level.toLowerCase()];
    }

    // Map numeric levels → string levels
    const numericMap = { 1: 'low', 2: 'medium', 3: 'high', 4: 'full', 5: 'full' };
    if (typeof level === 'number' || !isNaN(Number(level))) {
      level = numericMap[Number(level)] || 'medium';
    }

    if (!validLevels.includes(level)) {
      throw new Error(`Invalid autonomy level: ${level}. Must be one of: ${validLevels.join(', ')} (or guardian/collaborative/trusted/autopilot)`);
    }

    this.permissions.global.autonomy_level = level;
    await this.savePermissions();

    return level;
  }

  /**
   * Get autonomy level as a numeric value (1-4) for ApprovalQueue compatibility
   * Maps to soul.json modes: 1=guardian, 2=collaborative, 3=trusted, 4=autopilot
   */
  getAutonomyLevel() {
    const levelMap = { 'low': 1, 'medium': 2, 'high': 3, 'full': 4 };
    return levelMap[this.permissions?.global?.autonomy_level] || 3;
  }

  /**
   * Get the soul.json mode name for the current autonomy level
   */
  getModeName() {
    const nameMap = { 'low': 'guardian', 'medium': 'collaborative', 'high': 'trusted', 'full': 'autopilot' };
    return nameMap[this.permissions?.global?.autonomy_level] || 'trusted';
  }

  /**
   * Get all permissions
   */
  getPermissions() {
    return this.permissions;
  }

  /**
   * Get default permissions
   */
  getDefaultPermissions() {
    return {
      global: {
        autonomy_level: 'medium',
        require_confirmation_for: ['high_risk'],
        auto_execute: ['low_risk'],
        notify_on_completion: true,
        working_hours: {
          enabled: false,
          start: '09:00',
          end: '18:00',
          timezone: 'America/New_York'
        }
      },
      web_access: {
        enabled: true,
        allowed_domains: ['google.com', 'linkedin.com'],
        blocked_domains: [],
        can_fill_forms: false,
        can_login: false,
        can_download: true,
        max_concurrent_tabs: 3,
        timeout_seconds: 30
      },
      pipeline: {
        enabled: true,
        can_add_leads: true,
        can_add_tasks: true,
        can_move_stages: true,
        can_update_items: true,
        can_delete: true,
        notify_on_new_lead: true,
        notify_on_stage_change: true,
        auto_stages: ['inbox', 'research']
      },
      communication: {
        email: {
          enabled: false,
          provider: '',
          can_send: false,
          can_draft: true,
          can_read: false,
          require_approval: true,
          allowed_recipients: [],
          templates_only: true
        },
        calls: {
          enabled: false,
          integration_url: '',
          can_initiate: false,
          can_schedule: true,
          require_approval: true
        },
        notifications: {
          desktop: true,
          sound: false
        }
      },
      file_system: {
        enabled: true,
        allowed_paths: ['~/Documents/OpenAce'],
        can_create: true,
        can_modify: true,
        can_delete: false,
        max_file_size_mb: 50,
        allowed_extensions: ['.txt', '.md', '.json', '.csv', '.pdf']
      },
      research: {
        enabled: true,
        can_search_web: true,
        can_scrape_pages: true,
        can_save_results: true,
        max_results_per_search: 10,
        rate_limit_per_hour: 60
      },
      integrations: {
        enabled: false,
        allowed_urls: [],
        api_keys: {},
        webhooks: []
      },
      risk_levels: {
        low_risk: ['web_search', 'read_file', 'add_to_pipeline', 'generate_report', 'create_draft'],
        medium_risk: ['move_pipeline_stage', 'modify_file', 'schedule_meeting', 'access_new_website'],
        high_risk: ['send_email', 'make_call', 'delete_item', 'login_to_service', 'api_call']
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }
}

export default PermissionsManager;
