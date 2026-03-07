/**
 * Standalone Book Import Script
 *
 * Run manually:
 *   npm run import              — auto-detect (initial if empty, else daily)
 *   npm run import -- --initial — force full initial import
 *   npm run import -- --daily   — force daily incremental import
 *
 * This can also be called from an external cron (e.g., OS crontab)
 * as an alternative to the built-in node-cron scheduler.
 */

import { initDatabase, initPool } from './database.js';
import { initImportJobsTable, runImportJob, type ImportJobResult } from './jobs/bookImport.js';

// Parse CLI args
const args = process.argv.slice(2);
let forceType: 'initial' | 'daily' | undefined;

if (args.includes('--initial')) {
  forceType = 'initial';
} else if (args.includes('--daily')) {
  forceType = 'daily';
}

console.log('╔══════════════════════════════════════════╗');
console.log('║     📚 Book Import from Google Books     ║');
console.log('╚══════════════════════════════════════════╝\n');

async function main() {
  // Initialize database and schema (must await before any DB calls)
  await initPool();
  await initDatabase();
  await initImportJobsTable();

  const start = Date.now();

  try {
    const result: ImportJobResult = await runImportJob(forceType, (msg) => {
      console.log(msg);
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log('\n─── Import Summary ────────────────────────');
    console.log(`  Type:             ${result.type}`);
    console.log(`  Total fetched:    ${result.totalFetched}`);
    console.log(`  New books added:  ${result.newBooksInserted}`);
    console.log(`  Existing updated: ${result.existingBooksUpdated}`);
    console.log(`  Skipped:          ${result.skippedDuplicates}`);
    console.log(`  Errors:           ${result.errors.length}`);
    console.log(`  Duration:         ${elapsed}s`);
    console.log('───────────────────────────────────────────\n');

    if (result.errors.length > 0) {
      console.log('Errors:');
      for (const err of result.errors.slice(0, 20)) {
        console.log(`  • ${err}`);
      }
      if (result.errors.length > 20) {
        console.log(`  ... and ${result.errors.length - 20} more`);
      }
    }

    process.exit(0);
  } catch (err: any) {
    console.error(`\n❌ Import failed: ${err.message}`);
    process.exit(1);
  }
}

main();
