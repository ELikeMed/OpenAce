/**
 * SocialMediaScheduler - Autonomous posting via heartbeat integration
 * 
 * Features:
 * - Monitors scheduled posts and executes them at the right time
 * - Integrates with HeartbeatMonitor for autonomous operation
 * - Selects appropriate media from ContentLibrary
 * - Tracks success/failure and adapts strategy
 * - Sends notifications on post completion
 */

import fs from 'fs/promises';
import path from 'path';

export class SocialMediaScheduler {
  constructor(options = {}) {
    this.dataDir = options.dataDir || 'data/social';
    this.logPath = options.logPath || 'data/social/scheduler_log.json';
    
    // Required components
    this.contentStrategy = options.contentStrategy || null;
    this.socialMediaAgent = options.socialMediaAgent || null;
    this.contentLibrary = options.contentLibrary || null;
    this.telegramBot = options.telegramBot || null;
    
    // Scheduler settings
    this.settings = {
      enabled: true,
      checkIntervalMinutes: 15,
      maxRetries: 3,
      retryDelayMinutes: 30,
      notifyOnPost: true,
      notifyOnFailure: true,
      requireApproval: false, // If true, sends to Telegram for approval first
      dailyLimits: {
        twitter: 10,
        linkedin: 5,
        instagram: 5,
        facebook: 5
      }
    };
    
    // Runtime state
    this.isRunning = false;
    this.lastCheck = null;
    this.todaysCounts = {};
    
    // Log
    this.log = {
      posts: [],
      errors: [],
      lastUpdated: null
    };
    
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });

    // Load log
    try {
      const data = await fs.readFile(this.logPath, 'utf-8');
      this.log = JSON.parse(data);
    } catch (error) {
      await this.saveLog();
    }

    // Reset daily counts if new day
    this.resetDailyCountsIfNeeded();

    console.log('⏰ Social Media Scheduler initialized');
    this.initialized = true;
  }

  async saveLog() {
    this.log.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.logPath, JSON.stringify(this.log, null, 2));
  }

  /**
   * Reset daily counts at midnight
   */
  resetDailyCountsIfNeeded() {
    const today = new Date().toISOString().split('T')[0];
    if (this.todaysCounts.date !== today) {
      this.todaysCounts = {
        date: today,
        twitter: 0,
        linkedin: 0,
        instagram: 0,
        facebook: 0
      };
    }
  }

  /**
   * Start the scheduler (called by HeartbeatMonitor)
   */
  async start() {
    await this.initialize();
    this.isRunning = true;
    console.log('⏰ Social Media Scheduler started');
    
    // Initial check
    await this.checkAndPost();
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.isRunning = false;
    console.log('⏰ Social Media Scheduler stopped');
  }

  /**
   * Main heartbeat function - check for due posts and execute
   */
  async heartbeat() {
    if (!this.isRunning || !this.settings.enabled) {
      return { skipped: true, reason: 'Scheduler not running' };
    }

    await this.initialize();
    return await this.checkAndPost();
  }

  /**
   * Check for due posts and execute them
   */
  async checkAndPost() {
    this.resetDailyCountsIfNeeded();
    this.lastCheck = new Date().toISOString();

    if (!this.contentStrategy) {
      return { error: 'ContentStrategy not configured' };
    }

    // Get posts due in the next window
    const duePosts = await this.contentStrategy.getDuePosts(this.settings.checkIntervalMinutes);
    
    if (duePosts.length === 0) {
      return { 
        checked: true, 
        duePosts: 0, 
        message: 'No posts due' 
      };
    }

    console.log(`📬 ${duePosts.length} posts due for execution`);

    const results = [];
    
    for (const post of duePosts) {
      // Check daily limit
      if (this.todaysCounts[post.platform] >= this.settings.dailyLimits[post.platform]) {
        console.log(`⚠️ Daily limit reached for ${post.platform}`);
        continue;
      }

      try {
        const result = await this.executePost(post);
        results.push(result);
        
        if (result.success) {
          this.todaysCounts[post.platform]++;
          
          // Notify success
          if (this.settings.notifyOnPost && this.telegramBot) {
            await this.notifyPostSuccess(post, result);
          }
        } else if (this.settings.notifyOnFailure && this.telegramBot) {
          await this.notifyPostFailure(post, result);
        }
      } catch (error) {
        console.error(`Failed to execute post ${post.id}:`, error.message);
        results.push({
          postId: post.id,
          success: false,
          error: error.message
        });
      }
    }

    await this.saveLog();

    return {
      checked: true,
      duePosts: duePosts.length,
      executed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Execute a single post
   */
  async executePost(post) {
    console.log(`📤 Executing post ${post.id} to ${post.platform}`);

    // Select media if needed
    let mediaPath = post.mediaPath;
    
    if (post.requiresMedia && !mediaPath && this.contentLibrary) {
      const asset = await this.contentLibrary.selectAssetForPost({
        category: post.type,
        city: post.city,
        platform: post.platform
      });
      
      if (asset) {
        mediaPath = asset.path;
        post.assetId = asset.id;
      }
    }

    // Execute post via SocialMediaAgent
    if (!this.socialMediaAgent) {
      throw new Error('SocialMediaAgent not configured');
    }

    let result;
    
    switch (post.platform) {
      case 'twitter':
        result = await this.socialMediaAgent.postToTwitter(
          { text: post.content, hashtags: post.hashtags },
          { mediaPath }
        );
        break;
      case 'linkedin':
        result = await this.socialMediaAgent.postToLinkedIn(
          { text: post.content, hashtags: post.hashtags },
          { mediaPath }
        );
        break;
      case 'instagram':
        result = await this.socialMediaAgent.postToInstagram(
          { text: post.content, hashtags: post.hashtags },
          { mediaPath }
        );
        break;
      case 'facebook':
        result = await this.socialMediaAgent.postToFacebook(
          { text: post.content, hashtags: post.hashtags },
          { mediaPath }
        );
        break;
      default:
        throw new Error(`Unknown platform: ${post.platform}`);
    }

    // Record result
    await this.contentStrategy.markPostCompleted(post.id, result);

    // Record asset usage
    if (result.success && post.assetId && this.contentLibrary) {
      await this.contentLibrary.recordUsage(post.assetId, post.platform);
    }

    // Log
    this.log.posts.push({
      postId: post.id,
      platform: post.platform,
      timestamp: new Date().toISOString(),
      success: result.success,
      screenshot: result.screenshot
    });

    if (!result.success) {
      this.log.errors.push({
        postId: post.id,
        platform: post.platform,
        timestamp: new Date().toISOString(),
        error: result.error
      });
    }

    return {
      postId: post.id,
      ...result
    };
  }

  /**
   * Notify on successful post
   */
  async notifyPostSuccess(post, result) {
    if (!this.telegramBot) return;

    const message = `✅ **Post Published!**

📱 Platform: ${post.platform}
🏙️ City: ${post.city || 'General'}
📝 Type: ${post.type}

Content:
"${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}"

⏰ Posted at: ${new Date().toLocaleTimeString()}`;

    try {
      await this.telegramBot.sendMessage(message);
      
      // Send screenshot if available
      if (result.screenshot) {
        await this.telegramBot.sendPhoto(result.screenshot, 'Post confirmation');
      }
    } catch (error) {
      console.error('Failed to send notification:', error.message);
    }
  }

  /**
   * Notify on failed post
   */
  async notifyPostFailure(post, result) {
    if (!this.telegramBot) return;

    const message = `❌ **Post Failed!**

📱 Platform: ${post.platform}
🏙️ City: ${post.city || 'General'}
📝 Type: ${post.type}

Error: ${result.error}

⏰ Attempted at: ${new Date().toLocaleTimeString()}

Would you like me to retry?`;

    try {
      await this.telegramBot.sendMessage(message);
    } catch (error) {
      console.error('Failed to send failure notification:', error.message);
    }
  }

  /**
   * Send post for approval before executing
   */
  async sendForApproval(post) {
    if (!this.telegramBot) return false;

    const message = `📝 **Post Ready for Approval**

📱 Platform: ${post.platform}
🏙️ City: ${post.city || 'General'}
📝 Type: ${post.type}
⏰ Scheduled: ${new Date(post.scheduledDateTime).toLocaleString()}

Content:
"${post.content}"

Reply with:
• "approve" to post now
• "skip" to skip this post
• "edit [new content]" to modify`;

    try {
      await this.telegramBot.sendMessage(message);
      return true;
    } catch (error) {
      console.error('Failed to send approval request:', error.message);
      return false;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      enabled: this.settings.enabled,
      lastCheck: this.lastCheck,
      todaysCounts: this.todaysCounts,
      dailyLimits: this.settings.dailyLimits,
      recentPosts: this.log.posts.slice(-10),
      recentErrors: this.log.errors.slice(-5)
    };
  }

  /**
   * Update scheduler settings
   */
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    console.log('⚙️ Scheduler settings updated');
  }

  /**
   * Get upcoming posts preview
   */
  async getUpcomingPreview(hours = 24) {
    if (!this.contentStrategy) return [];

    const summary = await this.contentStrategy.getCalendarSummary(Math.ceil(hours / 24));
    return summary.posts.filter(post => {
      const postTime = new Date(post.scheduledDateTime);
      const hoursUntil = (postTime - new Date()) / (1000 * 60 * 60);
      return hoursUntil >= 0 && hoursUntil <= hours;
    });
  }

  /**
   * Force post now (manual trigger)
   */
  async postNow(content, platforms = ['twitter'], options = {}) {
    const results = {};
    const mediaPath = options.mediaPath || null;

    for (const platform of platforms) {
      try {
        let result;
        const postContent = typeof content === 'string' ? { text: content } : content;
        const postOptions = mediaPath ? { mediaPath } : {};

        switch (platform) {
          case 'twitter':
            result = await this.socialMediaAgent.postToTwitter(postContent, postOptions);
            break;
          case 'linkedin':
            result = await this.socialMediaAgent.postToLinkedIn(postContent, postOptions);
            break;
          case 'instagram':
            result = await this.socialMediaAgent.postToInstagram(postContent, postOptions);
            break;
          case 'facebook':
            result = await this.socialMediaAgent.postToFacebook(postContent, postOptions);
            break;
          default:
            result = { success: false, error: `Unknown platform: ${platform}` };
        }

        results[platform] = result;

        if (result?.success) {
          this.todaysCounts[platform] = (this.todaysCounts[platform] || 0) + 1;
        }
      } catch (error) {
        results[platform] = { success: false, error: error.message };
      }
    }

    // Log
    this.log.posts.push({
      type: 'manual',
      platforms,
      mediaPath,
      timestamp: new Date().toISOString(),
      results
    });
    await this.saveLog();

    return results;
  }

  /**
   * Generate daily report
   */
  async generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    
    const todaysPosts = this.log.posts.filter(p => 
      p.timestamp && p.timestamp.startsWith(today)
    );
    
    const todaysErrors = this.log.errors.filter(e =>
      e.timestamp && e.timestamp.startsWith(today)
    );

    // Get upcoming for tomorrow
    const tomorrow = await this.getUpcomingPreview(48);
    const tomorrowPosts = tomorrow.filter(p => {
      const postDate = new Date(p.scheduledDateTime).toISOString().split('T')[0];
      const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      return postDate === tomorrowDate;
    });

    return {
      date: today,
      summary: {
        totalPosted: todaysPosts.filter(p => p.success).length,
        totalFailed: todaysErrors.length,
        byPlatform: this.todaysCounts
      },
      tomorrow: {
        scheduledCount: tomorrowPosts.length,
        posts: tomorrowPosts.map(p => ({
          time: new Date(p.scheduledDateTime).toLocaleTimeString(),
          platform: p.platform,
          type: p.type,
          city: p.city
        }))
      },
      recommendations: await this.generateRecommendations()
    };
  }

  /**
   * Generate posting recommendations
   */
  async generateRecommendations() {
    const recommendations = [];

    // Check content coverage
    if (this.contentLibrary) {
      const stats = await this.contentLibrary.getStats();
      
      if (stats.unusedAssets > 50) {
        recommendations.push({
          type: 'content',
          priority: 'medium',
          message: `You have ${stats.unusedAssets} unused assets. Consider incorporating them into your content strategy.`
        });
      }
    }

    // Check posting frequency
    const totalToday = Object.values(this.todaysCounts)
      .filter(v => typeof v === 'number')
      .reduce((a, b) => a + b, 0);
    
    if (totalToday < 4) {
      recommendations.push({
        type: 'frequency',
        priority: 'low',
        message: 'Consider posting more frequently to maintain engagement.'
      });
    }

    return recommendations;
  }
}

export default SocialMediaScheduler;
