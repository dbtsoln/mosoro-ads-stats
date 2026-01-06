import { Pool } from 'pg';
import { database } from '../connection.js';
import { FastStatRecord } from '../../types/vk-ads.types.js';
import { logger } from '../../services/logger.js';

export class FastStatsRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async upsertBatch(records: FastStatRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO "FastStats" ("Timestamp", "BannerId", "Shows", "Clicks")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("Timestamp", "BannerId")
        DO UPDATE SET
          "Shows" = EXCLUDED."Shows",
          "Clicks" = EXCLUDED."Clicks",
          "UpdatedAt" = NOW()
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
          ]);
        }

        await client.query('COMMIT');

        const duration = Date.now() - startTime;
        logger.info('Fast stats batch upserted', {
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
      logger.error('Failed to upsert fast stats batch', {
        error: error instanceof Error ? error.message : String(error),
        recordsCount: records.length,
      });
      throw error;
    }
  }
}
