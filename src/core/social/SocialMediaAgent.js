/**
 * SocialMediaAgent - Manages browser-based posting to all social platforms
 *
 * No Puppeteer — uses BrowserAgent (AppleScript-based Chrome control).
 *
 * Features:
 * - Maintains logged-in sessions via real Chrome (user's actual browser)
 * - Posts text, images, and videos to each platform
 * - Handles platform-specific formatting and limitations
 * - Tracks post success/failure
 * - Smart fallback to BrowserAgent for intelligent element detection
 */

import fs from 'fs/promises';
import path from 'path';
import { BrowserAgent } from '../automation/BrowserAgent.js';

export class SocialMediaAgent {
  constructor(options = {}) {
    this.dataDir = options.dataDir || 'data/social';
    this.sessionsDir = options.sessionsDir || 'data/social/sessions';
    this.screenshotsDir = options.screenshotsDir || 'data/social/screenshots';
    this.configPath = options.configPath || 'data/social/config.json';

    // BrowserAgent for Chrome control (AppleScript-based)
    this.smartBrowser = new BrowserAgent({
      dataDir: this.dataDir,
      onProgress: (msg) => console.log(`[SmartPost] ${msg}`)
    });

    // Platform configurations
    this.platforms = {
      twitter: {
        name: 'Twitter/X',
        url: 'https://twitter.com',
        composeUrl: 'https://twitter.com/compose/tweet',
        maxChars: 280,
        supportsImages: true,
        supportsVideo: true,
        maxImages: 4,
        selectors: {
          loginEmail: 'input[autocomplete="username"]',
          loginPassword: 'input[name="password"]',
          tweetInput: '[data-testid="tweetTextarea_0"]',
          postButton: '[data-testid="tweetButton"]',
        }
      },
      linkedin: {
        name: 'LinkedIn',
        url: 'https://linkedin.com',
        feedUrl: 'https://www.linkedin.com/feed/',
        maxChars: 3000,
        supportsImages: true,
        supportsVideo: true,
        maxImages: 9,
        selectors: {
          startPostButton: [
            'button[aria-label="Start a post"]',
            '.share-box-feed-entry__trigger',
            'button.artdeco-button--secondary',
          ],
          postTextarea: [
            '.ql-editor[data-placeholder]',
            '.ql-editor',
            '[contenteditable="true"][role="textbox"]',
            '[contenteditable="true"]',
          ],
          postButton: [
            'button.share-actions__primary-action',
            '.share-actions__primary-action',
            'button[data-control-name="share.post"]',
          ],
        }
      },
      instagram: {
        name: 'Instagram',
        url: 'https://instagram.com',
        maxChars: 2200,
        supportsImages: true,
        supportsVideo: true,
        supportsReels: true,
        maxImages: 10,
        note: 'Best used via mobile or Meta Business API',
        selectors: {
          createButton: '[aria-label="New post"]',
          captionInput: 'textarea[aria-label="Write a caption..."]',
        }
      },
      facebook: {
        name: 'Facebook',
        url: 'https://facebook.com',
        maxChars: 63206,
        supportsImages: true,
        supportsVideo: true,
        maxImages: 10,
        selectors: {
          createPostButton: '[aria-label*="Create a post"]',
          postTextarea: '[contenteditable="true"]',
          postButton: '[aria-label="Post"]'
        }
      }
    };

    this.config = {
      sessions: {},
      credentials: {},
      lastPostTimes: {},
      dailyPostCounts: {}
    };

    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.sessionsDir, { recursive: true });
    await fs.mkdir(this.screenshotsDir, { recursive: true });

    try {
      const data = await fs.readFile(this.configPath, 'utf-8');
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch (error) {
      await this.saveConfig();
    }

    this.initialized = true;
  }

  async saveConfig() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2));
  }

  // ═══════════════════════════════════════════════════════
  // BROWSER — delegates to BrowserAgent (real Chrome)
  // ═══════════════════════════════════════════════════════

  async launchBrowser() {
    await this.initialize();
    await this.smartBrowser.launchBrowser();
  }

  async closeBrowser() {
    await this.smartBrowser.close();
  }

  // ═══════════════════════════════════════════════════════
  // LOGIN STATUS
  // ═══════════════════════════════════════════════════════

  async checkLoginStatus(platform) {
    await this.initialize();
    const config = this.platforms[platform];
    if (!config) throw new Error(`Unknown platform: ${platform}`);

    try {
      await this.smartBrowser.launchBrowser();
      await this.smartBrowser.navigateTo(config.url);
      await this.delay(3000);

      const isLoggedIn = await this._detectLoginStatus(platform);

      const screenshotPath = path.join(this.screenshotsDir, `${platform}_status_${Date.now()}.png`);
      await this.smartBrowser.takeScreenshot(`${platform}_status`);

      this.config.sessions[platform] = {
        loggedIn: isLoggedIn,
        lastChecked: new Date().toISOString()
      };
      await this.saveConfig();

      return { platform, loggedIn: isLoggedIn, screenshot: screenshotPath };
    } catch (error) {
      return { platform, loggedIn: false, error: error.message };
    }
  }

  async _detectLoginStatus(platform) {
    const checks = {
      twitter: `!!document.querySelector('[data-testid="SideNav_NewTweet_Button"]') || !!document.querySelector('[data-testid="AppTabBar_Home_Link"]')`,
      linkedin: `!!document.querySelector('.feed-shared-actor') || !!document.querySelector('.global-nav__me')`,
      instagram: `!!document.querySelector('[aria-label="Home"]') || !!document.querySelector('[aria-label="Profile"]')`,
      facebook: `!!document.querySelector('[aria-label*="Create"]') || !!document.querySelector('[aria-label="Notifications"]')`,
    };

    const jsCheck = checks[platform];
    if (!jsCheck) return false;

    try {
      return await this.smartBrowser._executeJsInChrome(jsCheck);
    } catch (e) {
      return false;
    }
  }

  // ═══════════════════════════════════════════════════════
  // LOGIN — Opens real Chrome for user to login manually
  // ═══════════════════════════════════════════════════════

  async initiateLogin(platform) {
    await this.initialize();
    const config = this.platforms[platform];
    if (!config) throw new Error(`Unknown platform: ${platform}`);


    try {
      await this.smartBrowser.launchBrowser();
      await this.smartBrowser.navigateTo(config.url);

      return {
        platform,
        message: `Chrome opened! Login to ${config.name}, then click Verify. Your session persists in the real browser.`,
        browserOpen: true
      };
    } catch (error) {
      console.error(`❌ Failed to open ${platform} login:`, error.message);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  // POSTING — Platform-specific
  // ═══════════════════════════════════════════════════════

  async postToTwitter(content, options = {}) {
    const config = this.platforms.twitter;
    try {
      await this.smartBrowser.launchBrowser();
      await this.smartBrowser.navigateTo(config.composeUrl);
      await this.delay(2000);

      await this.smartBrowser.page.waitForSelector(config.selectors.tweetInput, { timeout: 10000 });

      const text = content.text.substring(0, config.maxChars);
      await this.smartBrowser._executeJsInChrome(`
        const el = document.querySelector('[data-testid="tweetTextarea_0"]');
        if (el) { el.focus(); }
      `);
      await this.smartBrowser._typeSlowly(text);
      await this.delay(500);

      await this.smartBrowser.page.click(config.selectors.postButton);
      await this.delay(3000);

      this.updatePostCount('twitter');
      return { success: true, platform: 'twitter', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Twitter post failed:', error.message);
      return { success: false, platform: 'twitter', error: error.message };
    }
  }

  async postToLinkedIn(content, options = {}) {
    const config = this.platforms.linkedin;
    try {
      await this.smartBrowser.launchBrowser();
      await this.smartBrowser.navigateTo(config.feedUrl);
      await this.delay(3000);

      // Click start post button
      let clickedStart = false;
      for (const selector of config.selectors.startPostButton) {
        try {
          await this.smartBrowser.page.waitForSelector(selector, { timeout: 3000 });
          await this.smartBrowser.page.click(selector);
          clickedStart = true;
          break;
        } catch (e) { continue; }
      }

      if (!clickedStart) {
        try { await this.smartBrowser.clickByText('Start a post'); clickedStart = true; } catch (e) {}
      }
      if (!clickedStart) throw new Error('Could not find start post button');

      await this.delay(2000);

      // Find and type into textarea
      let found = false;
      for (const selector of config.selectors.postTextarea) {
        try {
          await this.smartBrowser.page.waitForSelector(selector, { timeout: 3000 });
          await this.smartBrowser.page.click(selector);
          found = true;
          break;
        } catch (e) { continue; }
      }
      if (!found) {
        await this.smartBrowser._executeJsInChrome(`
          const el = document.querySelector('[contenteditable="true"]');
          if (el) { el.click(); el.focus(); }
        `);
      }

      await this.delay(500);
      const text = content.text.substring(0, config.maxChars);
      await this.smartBrowser._typeSlowly(text);
      await this.delay(1000);

      // Click post button
      let posted = false;
      for (const selector of config.selectors.postButton) {
        try {
          await this.smartBrowser.page.waitForSelector(selector, { timeout: 3000 });
          await this.smartBrowser.page.click(selector);
          posted = true;
          break;
        } catch (e) { continue; }
      }
      if (!posted) {
        try { await this.smartBrowser.clickByText('Post'); posted = true; } catch (e) {}
      }

      await this.delay(3000);
      this.updatePostCount('linkedin');

      return { success: posted, platform: 'linkedin', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('LinkedIn post failed:', error.message);
      return { success: false, platform: 'linkedin', error: error.message };
    }
  }

  async postToInstagram(content, options = {}) {
    if (!options.mediaPath) {
      return { success: false, platform: 'instagram', error: 'Instagram requires an image or video' };
    }

    // Instagram posting via browser is unreliable — recommend mobile or API
    this.smartBrowser.onProgress('⚠️ Instagram posting works best via the mobile app or Meta Business API');
    return { success: false, platform: 'instagram', error: 'Instagram browser posting not supported — use mobile app or Meta API' };
  }

  async postToFacebook(content, options = {}) {
    try {
      await this.smartBrowser.launchBrowser();
      await this.smartBrowser.navigateTo('https://www.facebook.com/');
      await this.delay(3000);

      // Click create post area
      const createSelectors = ['[aria-label*="Create"]', '[aria-label*="What\'s on your mind"]'];
      let clicked = false;
      for (const sel of createSelectors) {
        try {
          await this.smartBrowser.page.waitForSelector(sel, { timeout: 3000 });
          await this.smartBrowser.page.click(sel);
          clicked = true;
          break;
        } catch (e) { continue; }
      }
      if (!clicked) {
        try { await this.smartBrowser.clickByText("What's on your mind"); clicked = true; } catch (e) {}
      }
      if (!clicked) throw new Error('Could not find create post button');

      await this.delay(2000);

      // Focus the contenteditable area
      await this.smartBrowser._executeJsInChrome(`
        const el = document.querySelector('[contenteditable="true"][role="textbox"]') || document.querySelector('[contenteditable="true"]');
        if (el) { el.click(); el.focus(); }
      `);
      await this.delay(500);

      const text = content.text.substring(0, this.platforms.facebook.maxChars);
      await this.smartBrowser._typeSlowly(text);
      await this.delay(1000);

      // Click Post button
      let posted = false;
      try { await this.smartBrowser.clickByText('Post'); posted = true; } catch (e) {}
      if (!posted) {
        try {
          await this.smartBrowser.page.waitForSelector('[aria-label="Post"]', { timeout: 3000 });
          await this.smartBrowser.page.click('[aria-label="Post"]');
          posted = true;
        } catch (e) {}
      }

      await this.delay(3000);
      this.updatePostCount('facebook');

      return { success: posted, platform: 'facebook', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Facebook post failed:', error.message);
      return { success: false, platform: 'facebook', error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════
  // MULTI-PLATFORM POSTING
  // ═══════════════════════════════════════════════════════

  async postToAll(content, options = {}) {
    const results = { timestamp: new Date().toISOString(), platforms: {} };
    const platforms = options.platforms || ['twitter', 'linkedin', 'facebook'];

    for (const platform of platforms) {
      const status = await this.checkLoginStatus(platform);
      if (!status.loggedIn) {
        results.platforms[platform] = { success: false, error: `Not logged in to ${platform}` };
        continue;
      }

      const adaptedContent = this.adaptContentForPlatform(content, platform);
      results.platforms[platform] = await this.postWithFallback(platform, adaptedContent, options);
      await this.delay(2000);
    }

    return results;
  }

  async smartPost(platform, content, options = {}) {
    try {
      await this.smartBrowser.initialize();
      const result = await this.smartBrowser.postToSocialMedia(platform, content, options);
      if (result.success) this.updatePostCount(platform);
      return result;
    } catch (error) {
      console.error(`Smart post to ${platform} failed:`, error.message);
      return { success: false, platform, error: error.message };
    }
  }

  async postWithFallback(platform, content, options = {}) {
    const postMethods = {
      twitter: () => this.postToTwitter(content, options),
      linkedin: () => this.postToLinkedIn(content, options),
      instagram: () => this.postToInstagram(content, options),
      facebook: () => this.postToFacebook(content, options)
    };

    const postMethod = postMethods[platform.toLowerCase()];
    if (!postMethod) return { success: false, error: `Unknown platform: ${platform}` };

    try {
      const result = await postMethod();
      if (result.success) return result;
      return await this.smartPost(platform, content, options);
    } catch (error) {
      return await this.smartPost(platform, content, options);
    }
  }

  async smartPostToAll(content, options = {}) {
    const results = { timestamp: new Date().toISOString(), platforms: {} };
    const platforms = options.platforms || ['linkedin', 'facebook', 'twitter'];

    for (const platform of platforms) {
      results.platforms[platform] = await this.postWithFallback(platform, content, options);
      await this.delay(2000);
    }

    return results;
  }

  // ═══════════════════════════════════════════════════════
  // CONTENT ADAPTATION
  // ═══════════════════════════════════════════════════════

  adaptContentForPlatform(content, platform) {
    const config = this.platforms[platform];
    let text = content.text;

    if (text.length > config.maxChars) {
      text = text.substring(0, config.maxChars - 3) + '...';
    }

    switch (platform) {
      case 'twitter':
        if (text.length > 280) text = text.substring(0, 277) + '...';
        break;
      case 'linkedin':
      case 'instagram':
        if (content.hashtags?.length > 0) {
          const hashtagStr = content.hashtags.slice(0, platform === 'instagram' ? 30 : 5).join(' ');
          if ((text + '\n\n' + hashtagStr).length <= config.maxChars) {
            text = text + '\n\n' + hashtagStr;
          }
        }
        break;
    }

    return { ...content, text };
  }

  // ═══════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════

  updatePostCount(platform) {
    const today = new Date().toISOString().split('T')[0];
    if (!this.config.dailyPostCounts[today]) this.config.dailyPostCounts[today] = {};
    if (!this.config.dailyPostCounts[today][platform]) this.config.dailyPostCounts[today][platform] = 0;
    this.config.dailyPostCounts[today][platform]++;
    this.config.lastPostTimes[platform] = new Date().toISOString();
    this.saveConfig();
  }

  async getStats() {
    await this.initialize();
    const today = new Date().toISOString().split('T')[0];
    return {
      todaysPosts: this.config.dailyPostCounts[today] || {},
      lastPostTimes: this.config.lastPostTimes,
      sessions: this.config.sessions
    };
  }

  async closeSmartBrowser() {
    await this.smartBrowser.close();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default SocialMediaAgent;
