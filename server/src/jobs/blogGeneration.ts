/**
 * AI Blog Generation Cron Job
 *
 * Automatically generates blog posts on a schedule using OpenAI.
 * Default: weekly on Monday at 9 AM UTC.
 */

import cron, { ScheduledTask } from 'node-cron';
import { config } from '../config.js';
import { generateBlogPost } from '../services/blogGenerator.js';
import { logger } from '../lib/logger.js';

let cronTask: ScheduledTask | null = null;

/**
 * Run the AI blog generation job.
 */
async function runBlogGenerationJob(): Promise<void> {
  const postsToGenerate = config.aiBlog.postsPerRun;
  logger.info(`\n📝 AI Blog Generation: generating ${postsToGenerate} post(s)...`);

  let generated = 0;
  let failed = 0;

  for (let i = 0; i < postsToGenerate; i++) {
    try {
      const post = await generateBlogPost({ autoPublish: false });
      logger.info(`  ✅ "${post.title}" (${post.tokensUsed} tokens)`);
      generated++;
    } catch (err: any) {
      logger.error(`  ❌ Post ${i + 1} failed:`, err.message);
      failed++;
    }

    // Small delay between posts to avoid rate limits
    if (i < postsToGenerate - 1) {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  logger.info(
    `📝 AI Blog Generation complete: ${generated} generated, ${failed} failed\n`,
  );
}

/**
 * Start the AI blog generation cron job.
 */
export function startBlogCron(): void {
  if (!config.aiBlog.enabled) {
    logger.info('  📝 AI Blog cron: disabled');
    return;
  }

  if (!config.openaiApiKey) {
    logger.warn(
      '  ⚠️  AI Blog cron: OPENAI_API_KEY not configured — skipping',
    );
    return;
  }

  cronTask = cron.schedule(
    config.aiBlog.cronSchedule,
    () => {
      runBlogGenerationJob().catch((err) =>
        logger.error({ err: err }, 'AI Blog cron error'),
      );
    },
    { timezone: 'UTC' },
  );

  logger.info(
    `  📝 AI Blog cron: enabled (schedule: ${config.aiBlog.cronSchedule}, posts/run: ${config.aiBlog.postsPerRun})`,
  );
}

/**
 * Stop the AI blog generation cron job.
 */
export function stopBlogCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
