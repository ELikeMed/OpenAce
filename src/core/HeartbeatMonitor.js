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
    console.log('📱 Social Media Scheduler connected to Heartbeat');
  }

  /**
   * Start the heartbeat
   */
  async start() {
    if (this.isRunning) {
      console.log('💓 Heartbeat already running');
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
    
    console.log('📱 Social Media Scheduler check started (every 15 minutes)');
    
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
    console.log(`\n📱 Social Media Check - ${new Date().toLocaleTimeString()}`);
    
    try {
      const result = await this.socialMediaScheduler.heartbeat();
      
      if (result.duePosts > 0) {
        console.log(`📬 Executed ${result.executed}/${result.duePosts} scheduled posts`);
        if (result.failed > 0) {
          console.log(`⚠️ ${result.failed} posts failed`);
        }
      } else {
        console.log('📭 No posts due at this time');
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
      console.log('📱 Social Media Scheduler stopped');
    }
    
    this.isRunning = false;
    console.log('💔 Heartbeat stopped');
  }

  /**
   * Perform a heartbeat check
   */
  async beat() {
    this.heartbeatCount++;
    const now = new Date();
    
    console.log(`\n💓 Heartbeat #${this.heartbeatCount} - ${now.toLocaleTimeString()}`);

    if (this.ace.config.heartbeat.check_health) {
      await this.performHealthChecks();
    }

    // Log uptime
    const uptime = this.getUptime();
    console.log(`⏱️  Uptime: ${uptime}`);
    
    // Log social media status if scheduler is connected
    if (this.socialMediaScheduler) {
      const status = this.socialMediaScheduler.getStatus();
      console.log(`📱 Social Media: ${status.isRunning ? 'Active' : 'Paused'} | Today's posts: ${Object.values(status.todaysCounts).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0)}`);
    }

    // This is where we can trigger proactive monitoring
    if (this.ace.proactiveMonitor) {
        console.log('💓 Heartbeat triggering proactive monitor...');
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

    // Print health check results
    console.log('\n🏥 Health Check Results:');
    this.healthChecks.forEach(check => {
      const icon = check.status === 'healthy' ? '✅' : '❌';
      console.log(`${icon} ${check.name}: ${check.details || check.error}`);
    });
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
