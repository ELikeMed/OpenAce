/**
 * ContentLibraryManager - Manages 500+ photos/videos with intelligent categorization
 * 
 * Features:
 * - Asset storage and organization
 * - Smart tagging (category, city, campaign, people, businesses)
 * - Usage tracking and freshness scoring
 * - Intelligent asset selection based on context
 * - Performance analytics per asset
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class ContentLibraryManager {
  constructor(options = {}) {
    this.dataDir = options.dataDir || 'data/content';
    this.mediaDir = options.mediaDir || 'data/content/media';
    this.libraryPath = options.libraryPath || 'data/content/library.json';
    this.aiProvider = options.aiProvider || null;
    
    // Content categories
    this.categories = [
      'meetup',
      'tool_highlight', 
      'user_spotlight',
      'campaign',
      'behind_scenes',
      'tips',
      'announcement',
      'testimonial',
      'event_promo',
      'recap',
      'general'
    ];
    
    // Supported cities
    this.cities = [
      'Miami', 'Austin', 'NYC', 'LA', 'Chicago', 
      'Denver', 'Seattle', 'Boston', 'Atlanta', 'Dallas',
      'San Francisco', 'Phoenix', 'Portland', 'Nashville'
    ];
    
    // Supported platforms
    this.platforms = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'];
    
    // Library data
    this.library = {
      assets: [],
      campaigns: [],
      lastUpdated: null
    };
    
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    // Ensure directories exist
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.mediaDir, { recursive: true });
    await fs.mkdir(path.join(this.mediaDir, 'images'), { recursive: true });
    await fs.mkdir(path.join(this.mediaDir, 'videos'), { recursive: true });
    await fs.mkdir(path.join(this.mediaDir, 'templates'), { recursive: true });

    // Load existing library or create new
    try {
      const data = await fs.readFile(this.libraryPath, 'utf-8');
      this.library = JSON.parse(data);
    } catch (error) {
      this.library = {
        assets: [],
        campaigns: [],
        lastUpdated: new Date().toISOString()
      };
      await this.saveLibrary();
    }

    this.initialized = true;
  }

  async saveLibrary() {
    this.library.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.libraryPath, JSON.stringify(this.library, null, 2));
  }

  /**
   * Add a new asset to the library
   */
  async addAsset(filePath, metadata = {}) {
    await this.initialize();

    const stats = await fs.stat(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isVideo = ['.mp4', '.mov', '.avi', '.webm'].includes(ext);
    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);

    if (!isVideo && !isImage) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    const id = `asset_${crypto.randomBytes(8).toString('hex')}`;
    const filename = path.basename(filePath);
    const type = isVideo ? 'video' : 'image';
    const subDir = isVideo ? 'videos' : 'images';
    const destPath = path.join(this.mediaDir, subDir, `${id}_${filename}`);

    // Copy file to media directory
    await fs.copyFile(filePath, destPath);

    const asset = {
      id,
      filename,
      path: destPath,
      type,
      format: ext.replace('.', ''),
      size: stats.size,
      dimensions: metadata.dimensions || null,
      uploadedAt: new Date().toISOString(),
      metadata: {
        city: metadata.city || null,
        category: metadata.category || 'general',
        campaign: metadata.campaign || null,
        tags: metadata.tags || [],
        people: metadata.people || [],
        businesses: metadata.businesses || [],
        description: metadata.description || '',
        usageCount: 0,
        lastUsed: null,
        performance: {
          avgEngagement: 0,
          platforms: {}
        }
      }
    };

    this.library.assets.push(asset);
    await this.saveLibrary();

    return asset;
  }

  /**
   * Bulk import assets from a directory
   */
  async bulkImport(sourceDir, defaultMetadata = {}) {
    await this.initialize();

    const files = await fs.readdir(sourceDir);
    const supportedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.avi', '.webm'];
    const imported = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (supportedExts.includes(ext)) {
        try {
          const filePath = path.join(sourceDir, file);
          const asset = await this.addAsset(filePath, {
            ...defaultMetadata,
            description: file.replace(ext, '').replace(/[-_]/g, ' ')
          });
          imported.push(asset);
        } catch (error) {
          console.error(`Failed to import ${file}:`, error.message);
        }
      }
    }

    return imported;
  }

  /**
   * Tag an asset with metadata
   */
  async tagAsset(assetId, metadata) {
    await this.initialize();

    const asset = this.library.assets.find(a => a.id === assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    // Merge metadata
    if (metadata.city) asset.metadata.city = metadata.city;
    if (metadata.category) asset.metadata.category = metadata.category;
    if (metadata.campaign) asset.metadata.campaign = metadata.campaign;
    if (metadata.description) asset.metadata.description = metadata.description;
    if (metadata.tags) asset.metadata.tags = [...new Set([...asset.metadata.tags, ...metadata.tags])];
    if (metadata.people) asset.metadata.people = [...new Set([...asset.metadata.people, ...metadata.people])];
    if (metadata.businesses) asset.metadata.businesses = [...new Set([...asset.metadata.businesses, ...metadata.businesses])];

    await this.saveLibrary();
    return asset;
  }

  /**
   * Bulk tag multiple assets
   */
  async bulkTag(assetIds, metadata) {
    const results = [];
    for (const id of assetIds) {
      try {
        const asset = await this.tagAsset(id, metadata);
        results.push({ id, success: true, asset });
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Smart tag using AI (requires AI provider)
   */
  async smartTag(assetId) {
    if (!this.aiProvider) {
      throw new Error('AI provider required for smart tagging');
    }

    const asset = this.library.assets.find(a => a.id === assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    // For images, use vision model to analyze
    if (asset.type === 'image') {
      try {
        const imageData = await fs.readFile(asset.path);
        const base64 = imageData.toString('base64');
        
        const prompt = `Analyze this image for a social media content library. Provide:
1. Suggested category (one of: ${this.categories.join(', ')})
2. Possible city if identifiable (one of: ${this.cities.join(', ')})
3. Relevant tags (5-10 tags)
4. Brief description (1-2 sentences)
5. Any visible people or businesses

Respond in JSON format:
{
  "category": "...",
  "city": "..." or null,
  "tags": ["..."],
  "description": "...",
  "people": ["..."],
  "businesses": ["..."]
}`;

        const response = await this.aiProvider.analyzeImage(base64, prompt);
        const analysis = JSON.parse(response);
        
        await this.tagAsset(assetId, analysis);
        return analysis;
      } catch (error) {
        console.error('Smart tagging failed:', error.message);
        throw error;
      }
    }

    return null;
  }

  /**
   * Get asset by ID
   */
  async getAsset(assetId) {
    await this.initialize();
    return this.library.assets.find(a => a.id === assetId);
  }

  /**
   * Search assets by criteria
   */
  async searchAssets(criteria = {}) {
    await this.initialize();

    let results = [...this.library.assets];

    // Filter by type
    if (criteria.type) {
      results = results.filter(a => a.type === criteria.type);
    }

    // Filter by category
    if (criteria.category) {
      results = results.filter(a => a.metadata.category === criteria.category);
    }

    // Filter by city
    if (criteria.city) {
      results = results.filter(a => a.metadata.city === criteria.city);
    }

    // Filter by campaign
    if (criteria.campaign) {
      results = results.filter(a => a.metadata.campaign === criteria.campaign);
    }

    // Filter by tags (any match)
    if (criteria.tags && criteria.tags.length > 0) {
      results = results.filter(a => 
        criteria.tags.some(tag => a.metadata.tags.includes(tag))
      );
    }

    // Filter by unused/underused
    if (criteria.maxUsageCount !== undefined) {
      results = results.filter(a => a.metadata.usageCount <= criteria.maxUsageCount);
    }

    // Filter by freshness (not used in last N days)
    if (criteria.notUsedInDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - criteria.notUsedInDays);
      results = results.filter(a => 
        !a.metadata.lastUsed || new Date(a.metadata.lastUsed) < cutoff
      );
    }

    // Sort by freshness score (prefer unused content)
    results.sort((a, b) => {
      const scoreA = this.calculateFreshnessScore(a);
      const scoreB = this.calculateFreshnessScore(b);
      return scoreB - scoreA;
    });

    // Limit results
    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Calculate freshness score (higher = fresher/better to use)
   */
  calculateFreshnessScore(asset) {
    let score = 100;

    // Reduce score based on usage count
    score -= asset.metadata.usageCount * 10;

    // Reduce score if recently used
    if (asset.metadata.lastUsed) {
      const daysSinceUsed = (Date.now() - new Date(asset.metadata.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUsed < 7) score -= 30;
      else if (daysSinceUsed < 14) score -= 20;
      else if (daysSinceUsed < 30) score -= 10;
    }

    // Boost score based on performance
    score += asset.metadata.performance.avgEngagement * 5;

    return Math.max(0, score);
  }

  /**
   * Select best asset for a specific post context
   */
  async selectAssetForPost(context) {
    const { category, city, campaign, tags, platform, preferVideo = false } = context;

    // Build search criteria
    const criteria = {
      category,
      city,
      campaign,
      tags,
      notUsedInDays: 7, // Prefer assets not used recently
      limit: 10
    };

    if (preferVideo) {
      criteria.type = 'video';
    }

    let assets = await this.searchAssets(criteria);

    // If no results, relax criteria
    if (assets.length === 0) {
      delete criteria.notUsedInDays;
      assets = await this.searchAssets(criteria);
    }

    if (assets.length === 0) {
      delete criteria.city;
      assets = await this.searchAssets(criteria);
    }

    if (assets.length === 0) {
      return null;
    }

    // Return the best match (already sorted by freshness)
    return assets[0];
  }

  /**
   * Record asset usage
   */
  async recordUsage(assetId, platform, performance = {}) {
    await this.initialize();

    const asset = this.library.assets.find(a => a.id === assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    asset.metadata.usageCount++;
    asset.metadata.lastUsed = new Date().toISOString();

    // Update platform performance
    if (!asset.metadata.performance.platforms[platform]) {
      asset.metadata.performance.platforms[platform] = {
        posts: 0,
        totalEngagement: 0
      };
    }
    
    asset.metadata.performance.platforms[platform].posts++;
    
    if (performance.engagement) {
      asset.metadata.performance.platforms[platform].totalEngagement += performance.engagement;
      
      // Recalculate average engagement
      let totalPosts = 0;
      let totalEngagement = 0;
      for (const p of Object.values(asset.metadata.performance.platforms)) {
        totalPosts += p.posts;
        totalEngagement += p.totalEngagement;
      }
      asset.metadata.performance.avgEngagement = totalPosts > 0 ? totalEngagement / totalPosts : 0;
    }

    await this.saveLibrary();
    return asset;
  }

  /**
   * Create a campaign
   */
  async createCampaign(campaign) {
    await this.initialize();

    const id = `campaign_${crypto.randomBytes(4).toString('hex')}`;
    
    const newCampaign = {
      id,
      name: campaign.name,
      description: campaign.description || '',
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      hashtags: campaign.hashtags || [],
      cities: campaign.cities || this.cities,
      assets: campaign.assets || [],
      status: 'active',
      createdAt: new Date().toISOString()
    };

    this.library.campaigns.push(newCampaign);
    await this.saveLibrary();

    return newCampaign;
  }

  /**
   * Get active campaigns
   */
  async getActiveCampaigns() {
    await this.initialize();

    const now = new Date();
    return this.library.campaigns.filter(c => {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      return c.status === 'active' && start <= now && end >= now;
    });
  }

  /**
   * Get library statistics
   */
  async getStats() {
    await this.initialize();

    const stats = {
      totalAssets: this.library.assets.length,
      byType: {},
      byCategory: {},
      byCity: {},
      totalUsage: 0,
      unusedAssets: 0,
      activeCampaigns: 0
    };

    for (const asset of this.library.assets) {
      // By type
      stats.byType[asset.type] = (stats.byType[asset.type] || 0) + 1;
      
      // By category
      const cat = asset.metadata.category || 'uncategorized';
      stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
      
      // By city
      const city = asset.metadata.city || 'unassigned';
      stats.byCity[city] = (stats.byCity[city] || 0) + 1;
      
      // Usage
      stats.totalUsage += asset.metadata.usageCount;
      if (asset.metadata.usageCount === 0) stats.unusedAssets++;
    }

    // Active campaigns
    const activeCampaigns = await this.getActiveCampaigns();
    stats.activeCampaigns = activeCampaigns.length;

    return stats;
  }

  /**
   * Get assets needing tagging
   */
  async getUntaggedAssets() {
    await this.initialize();

    return this.library.assets.filter(a => 
      !a.metadata.category || 
      a.metadata.category === 'general' ||
      a.metadata.tags.length === 0
    );
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId) {
    await this.initialize();

    const index = this.library.assets.findIndex(a => a.id === assetId);
    if (index === -1) {
      throw new Error(`Asset not found: ${assetId}`);
    }

    const asset = this.library.assets[index];
    
    // Delete file
    try {
      await fs.unlink(asset.path);
    } catch (error) {
      console.warn(`Could not delete file: ${asset.path}`);
    }

    // Remove from library
    this.library.assets.splice(index, 1);
    await this.saveLibrary();

    return { deleted: assetId };
  }

  /**
   * Export library summary
   */
  async exportSummary() {
    const stats = await this.getStats();
    const untagged = await this.getUntaggedAssets();
    const campaigns = await this.getActiveCampaigns();

    return {
      stats,
      untaggedCount: untagged.length,
      activeCampaigns: campaigns.map(c => ({
        name: c.name,
        dates: `${c.startDate} - ${c.endDate}`,
        assets: c.assets.length
      })),
      topPerformingAssets: this.library.assets
        .sort((a, b) => b.metadata.performance.avgEngagement - a.metadata.performance.avgEngagement)
        .slice(0, 5)
        .map(a => ({
          id: a.id,
          type: a.type,
          category: a.metadata.category,
          avgEngagement: a.metadata.performance.avgEngagement
        }))
    };
  }
}

export default ContentLibraryManager;
