import cron from 'node-cron';
import fs from 'fs/promises';
import path from 'path';

export class CronRunner {
  constructor(agent, license, dataDir) {
    this.agent = agent;       // EmbedAgent instance
    this.license = license;   // LicenseValidator instance
    this.dataDir = dataDir;
    this.jobs = new Map();    // name -> { task, config, schedule, lastRun, lastResult }
  }

  /**
   * Start all configured cron jobs. Requires Pro tier (license.canUse('cron')).
   *
   * cronConfig example:
   * {
   *   blogPost: { schedule: '0 9 *\/2 * *', tool: 'generate_blog_post', config: { topics: 'auto' } },
   *   seoAudit: { schedule: '0 0 * * 1',   tool: 'analyze_seo',        config: { url: 'https://mysite.com' } }
   * }
   */
  start(cronConfig) {
    if (!this.license.canUse('cron')) {
      console.warn('[CronRunner] Cron jobs require a Pro license. Skipping start.');
      return;
    }

    if (!cronConfig || typeof cronConfig !== 'object') {
      console.warn('[CronRunner] No cron configuration provided.');
      return;
    }

    for (const [name, jobConfig] of Object.entries(cronConfig)) {
      if (this.jobs.has(name)) {
        console.warn(`[CronRunner] Job "${name}" already registered. Skipping.`);
        continue;
      }

      if (!jobConfig.schedule || !jobConfig.tool) {
        console.warn(`[CronRunner] Job "${name}" missing schedule or tool. Skipping.`);
        continue;
      }

      if (!cron.validate(jobConfig.schedule)) {
        console.warn(`[CronRunner] Job "${name}" has invalid cron expression: "${jobConfig.schedule}". Skipping.`);
        continue;
      }

      const task = cron.schedule(jobConfig.schedule, async () => {
        await this._executeJob(name, jobConfig);
      }, { scheduled: true });

      this.jobs.set(name, {
        task,
        config: jobConfig,
        schedule: jobConfig.schedule,
        lastRun: null,
        lastResult: null,
      });

      console.log(`[CronRunner] Scheduled "${name}" with cron "${jobConfig.schedule}" -> tool: ${jobConfig.tool}`);
    }

    console.log(`[CronRunner] Started ${this.jobs.size} cron job(s).`);
  }

  /**
   * Stop all running cron jobs and clear the registry.
   */
  stop() {
    for (const [name, job] of this.jobs) {
      try {
        job.task.stop();
        console.log(`[CronRunner] Stopped job "${name}".`);
      } catch (err) {
        console.error(`[CronRunner] Error stopping job "${name}":`, err.message);
      }
    }
    this.jobs.clear();
    console.log('[CronRunner] All cron jobs stopped.');
  }

  /**
   * Execute a single cron job: call the agent tool, persist the result.
   */
  async _executeJob(name, jobConfig) {
    const startTime = Date.now();
    console.log(`[CronRunner] Executing job "${name}" (tool: ${jobConfig.tool}) at ${new Date(startTime).toISOString()}`);

    let result;
    let success = false;

    try {
      result = await this.agent.executeTool(jobConfig.tool, jobConfig.config || {});
      success = true;
    } catch (err) {
      result = { error: err.message };
      console.error(`[CronRunner] Job "${name}" failed:`, err.message);
    }

    const elapsed = Date.now() - startTime;
    const entry = {
      job: name,
      tool: jobConfig.tool,
      config: jobConfig.config || {},
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: elapsed,
      success,
      result,
    };

    // Update in-memory state
    const job = this.jobs.get(name);
    if (job) {
      job.lastRun = entry.completedAt;
      job.lastResult = success ? 'success' : 'error';
    }

    // Persist result to disk
    await this._saveResult(name, startTime, entry);

    console.log(`[CronRunner] Job "${name}" completed in ${elapsed}ms (${success ? 'success' : 'error'}).`);
  }

  /**
   * Returns the status of all registered jobs.
   */
  getStatus() {
    const statuses = [];
    for (const [name, job] of this.jobs) {
      statuses.push({
        name,
        schedule: job.schedule,
        tool: job.config.tool,
        lastRun: job.lastRun || null,
        lastResult: job.lastResult || null,
      });
    }
    return statuses;
  }

  /**
   * Save a job execution result to {dataDir}/cron/{name}/{timestamp}.json
   */
  async _saveResult(name, timestamp, entry) {
    const dir = path.join(this.dataDir, 'cron', name);
    const filePath = path.join(dir, `${timestamp}.json`);
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
    } catch (err) {
      console.error(`[CronRunner] Failed to save result for "${name}":`, err.message);
    }
  }
}
