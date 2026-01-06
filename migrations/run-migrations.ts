import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { database } from '../src/database/connection.js';
import { logger } from '../src/services/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function runMigrations() {
  try {
    await database.testConnection();

    const migrations = [
      '000_drop_old_tables.sql',
      '001_create_fast_stats_table.sql',
      '002_create_summary_stats_table.sql',
      '003_create_campaign_meta_table.sql',
      '004_create_ad_group_meta_table.sql',
      '005_create_banner_meta_table.sql',
    ];

    const pool = database.getPool();

    for (const migration of migrations) {
      const migrationPath = join(__dirname, migration);
      const sql = readFileSync(migrationPath, 'utf-8');

      logger.info(`Running migration: ${migration}`);

      await pool.query(sql);

      logger.info(`Migration completed: ${migration}`);
    }

    logger.info('All migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  } finally {
    await database.close();
  }
}

runMigrations();
