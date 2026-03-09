/**
 * Social Media Module - Export all social media components
 */

export { ContentLibraryManager } from '../content/ContentLibraryManager.js';
export { SocialMediaAgent } from './SocialMediaAgent.js';
export { ContentStrategyAgent } from './ContentStrategyAgent.js';
export { SocialMediaScheduler } from './SocialMediaScheduler.js';
export { LikeMindedScraper } from './LikeMindedScraper.js';

/**
 * Create a fully integrated Social Media System
 */
export async function createSocialMediaSystem(options = {}) {
  const { ContentLibraryManager } = await import('../content/ContentLibraryManager.js');
  const { SocialMediaAgent } = await import('./SocialMediaAgent.js');
  const { ContentStrategyAgent } = await import('./ContentStrategyAgent.js');
  const { SocialMediaScheduler } = await import('./SocialMediaScheduler.js');

  // Initialize content library
  const contentLibrary = new ContentLibraryManager({
    dataDir: options.dataDir || 'data/content',
    aiProvider: options.aiProvider
  });
  await contentLibrary.initialize();

  // Initialize social media agent
  const socialMediaAgent = new SocialMediaAgent({
    dataDir: options.dataDir || 'data/social'
  });
  await socialMediaAgent.initialize();

  // Initialize content strategy
  const contentStrategy = new ContentStrategyAgent({
    dataDir: options.dataDir || 'data/social',
    googleIntegration: options.googleIntegration,
    contentLibrary,
    aiProvider: options.aiProvider
  });
  await contentStrategy.initialize();

  // Initialize scheduler
  const scheduler = new SocialMediaScheduler({
    dataDir: options.dataDir || 'data/social',
    contentStrategy,
    socialMediaAgent,
    contentLibrary,
    telegramBot: options.telegramBot
  });
  await scheduler.initialize();

  return {
    contentLibrary,
    socialMediaAgent,
    contentStrategy,
    scheduler,
    
    // Quick access methods
    async postNow(content, platforms, options = {}) {
      return scheduler.postNow(content, platforms, options);
    },
    
    async schedulePost(post) {
      return contentStrategy.scheduleCustomPost(post);
    },
    
    async generateStrategy(city, months = 1) {
      return contentStrategy.generateCityStrategy(city, months);
    },
    
    async getCalendar(days = 7) {
      return contentStrategy.getCalendarSummary(days);
    },
    
    async getTodaysPlan() {
      return contentStrategy.getTodaysPlan();
    },
    
    async addMedia(filePath, metadata) {
      return contentLibrary.addAsset(filePath, metadata);
    },
    
    async bulkImportMedia(sourceDir, defaultMetadata) {
      return contentLibrary.bulkImport(sourceDir, defaultMetadata);
    },
    
    async getLibraryStats() {
      return contentLibrary.getStats();
    },
    
    async startScheduler() {
      return scheduler.start();
    },
    
    async stopScheduler() {
      return scheduler.stop();
    },
    
    async getSchedulerStatus() {
      return scheduler.getStatus();
    },
    
    async checkLoginStatus(platform) {
      return socialMediaAgent.checkLoginStatus(platform);
    },
    
    async initiateLogin(platform) {
      return socialMediaAgent.initiateLogin(platform);
    }
  };
}

export default createSocialMediaSystem;
