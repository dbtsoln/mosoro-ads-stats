import { Pool } from 'pg';
import { database } from '../connection.js';
import { SummaryStatRecord } from '../../types/vk-ads.types.js';
import { logger } from '../../services/logger.js';

export class SummaryStatsRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async insertBatch(records: SummaryStatRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO "SummaryStats" ("Timestamp", "BannerId", "Shows", "Clicks", "Spent")
        VALUES ($1, $2, $3, $4, $5)
      `;

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        for (const record of records) {
          await client.query(query, [
            record.timestamp,
            record.bannerId,
            record.shows,
            record.clicks,
            record.spent,
          ]);
        }

        await client.query('COMMIT');

        const duration = Date.now() - startTime;
        logger.info('Summary stats batch inserted', {
          recordsCount: records.length,
          duration,
        });

        return records.length;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Failed to insert summary stats batch', {
        error: error instanceof Error ? error.message : String(error),
        recordsCount: records.length,
      });
      throw error;
    }
  }
}
