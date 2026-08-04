/**
 * OpenAce Heartbeat Monitor
 * Keeps OpenAce alive and monitors system health
 * Now includes social media scheduling integration
 */

export class HeartbeatMonitor {
  constructor(openAceInstance) {
    this.ace = openAceInstance;
    this.interval = null;
    this.heartbeatCount = 0;
    this.startTime = null;
    this.isRunning = false;
    this.healthChecks = [];
    
    // Social media scheduler integration
    this.socialMediaScheduler = null;
    this.socialMediaCheckInterval = null;
    this.lastSocialMediaCheck = null;
  }

  /**
   * Set social media scheduler
   */
  setSocialMediaScheduler(scheduler) {
    this.socialMediaScheduler = scheduler;
  }

  /**
   * Start the heartbeat
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    this.startTime = Date.now();
    this.isRunning = true;

    const intervalMinutes = this.ace.config.heartbeat.interval_minutes || 60;
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`💓 Heartbeat started (every ${intervalMinutes} minutes)`);

    // Initial heartbeat
    await this.beat();

    // Schedule regular heartbeats
    this.interval = setInterval(() => {
      this.beat();
    }, intervalMs);

    // Start social media check (every 15 minutes for scheduled posts)
    if (this.socialMediaScheduler) {
      this.startSocialMediaScheduler();
    }
  }

  /**
   * Start the social media scheduler check
   */
  startSocialMediaScheduler() {
    if (this.socialMediaCheckInterval) return;
    
    const checkIntervalMs = 15 * 60 * 1000; // 15 minutes
    
    
    // Initial check
    this.checkSocialMediaPosts();
    
    // Schedule regular checks
    this.socialMediaCheckInterval = setInterval(() => {
      this.checkSocialMediaPosts();
    }, checkIntervalMs);
  }

  /**
   * Check and execute scheduled social media posts
   */
  async checkSocialMediaPosts() {
    if (!this.socialMediaScheduler) return;
    
    this.lastSocialMediaCheck = new Date().toISOString();
    
    try {
      const result = await this.socialMediaScheduler.heartbeat();
      
      if (result.duePosts > 0) {
        if (result.failed > 0) {
          console.warn(`[Heartbeat] ${result.failed} social media posts failed`);
        }
      } else {
      }
      
      // Update health checks
      this.healthChecks.push({
        name: 'Social Media Scheduler',
        status: 'healthy',
        details: `Last check: ${result.duePosts} due, ${result.executed || 0} posted`
      });
    } catch (error) {
      console.error('❌ Social media check failed:', error.message);
      this.healthChecks.push({
        name: 'Social Media Scheduler',
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Stop the heartbeat
   */
  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    
    // Stop social media scheduler
    if (this.socialMediaCheckInterval) {
      clearInterval(this.socialMediaCheckInterval);
      this.socialMediaCheckInterval = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Perform a heartbeat check
   */
  async beat() {
    this.heartbeatCount++;

    if (this.ace.config.heartbeat.check_health) {
      await this.performHealthChecks();
    }

    // This is where we can trigger proactive monitoring
    if (this.ace.proactiveMonitor) {
        this.ace.proactiveMonitor.runChecks();
    }
  }

  /**
   * Perform health checks
   */
  async performHealthChecks() {
    this.healthChecks = [];

    // Check AI provider
    try {
      const providerInfo = this.ace.aiManager.getProviderInfo();
      this.healthChecks.push({
        name: 'AI Provider',
        status: 'healthy',
        details: `${providerInfo.active} is active`
      });
    } catch (error) {
      this.healthChecks.push({
        name: 'AI Provider',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Check skills
    try {
      const skillsCount = this.ace.skillsManager.getAllSkills().length;
      this.healthChecks.push({
        name: 'Skills',
        status: 'healthy',
        details: `${skillsCount} skills loaded`
      });
    } catch (error) {
      this.healthChecks.push({
        name: 'Skills',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Check knowledge base
    try {
      const kbStats = this.ace.knowledgeBase.getStats();
      this.healthChecks.push({
        name: 'Knowledge Base',
        status: 'healthy',
        details: `${kbStats.total} entries, ${kbStats.cached} cached`
      });
    } catch (error) {
      this.healthChecks.push({
        name: 'Knowledge Base',
        status: 'unhealthy',
        error: error.message
      });
    }

  }

  /**
   * Get system uptime
   */
  getUptime() {
    if (!this.startTime) return 'N/A';

    const uptimeMs = Date.now() - this.startTime;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  }

  /**
   * Get heartbeat status
   */
  getStatus() {
    return {
      running: this.isRunning,
      count: this.heartbeatCount,
      uptime: this.getUptime(),
      health_checks: this.healthChecks,
      last_beat: new Date().toISOString()
    };
  }

  /**
   * Force a heartbeat now
   */
  async pulse() {
    await this.beat();
  }
}
