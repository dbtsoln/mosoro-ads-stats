import { database } from './src/database/connection.js';
import { logger } from './src/services/logger.js';

async function checkData() {
  try {
    await database.testConnection();
    const pool = database.getPool();

    console.log('\n=== Checking Database Records ===\n');

    // Count FastStats
    const fastCount = await pool.query('SELECT COUNT(*) FROM "FastStats"');
    console.log(`📊 FastStats records: ${fastCount.rows[0].count}`);

    // Count SummaryStats
    const summaryCount = await pool.query('SELECT COUNT(*) FROM "SummaryStats"');
    console.log(`📊 SummaryStats records: ${summaryCount.rows[0].count}`);

    console.log('\n=== Latest FastStats ===\n');
    const fastStats = await pool.query(`
      SELECT "BannerId", "Timestamp", "Shows", "Clicks", "CreatedAt"
      FROM "FastStats"
      ORDER BY "CreatedAt" DESC
      LIMIT 5
    `);
    console.table(fastStats.rows);

    console.log('\n=== Latest SummaryStats ===\n');
    const summaryStats = await pool.query(`
      SELECT "BannerId", "Timestamp", "Shows", "Clicks", "Spent", "CreatedAt"
      FROM "SummaryStats"
      ORDER BY "CreatedAt" DESC
      LIMIT 3
    `);
    console.table(summaryStats.rows);

    await database.close();
  } catch (error) {
    logger.error('Failed to check data', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
}

checkData();
