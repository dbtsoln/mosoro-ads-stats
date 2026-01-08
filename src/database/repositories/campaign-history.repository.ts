import { Pool } from 'pg';
import { database } from '../connection.js';
import { CampaignHistoryRecord } from '../../types/vk-ads.types.js';
import { logger } from '../../services/logger.js';

export class CampaignHistoryRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async getLastUpdatedAt(): Promise<Date | null> {
    try {
      const result = await this.pool.query<{ UpdatedAt: Date }>(
        'SELECT "UpdatedAt" FROM "CampaignHistory" ORDER BY "UpdatedAt" DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].UpdatedAt;
    } catch (error) {
      logger.error('Failed to get last updated timestamp for campaign history', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async upsertBatch(records: CampaignHistoryRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO "CampaignHistory" ("Id", "Bid", "Delivery", "Status", "CreatedAt", "UpdatedAt")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("Id", "UpdatedAt")
        DO UPDATE SET
          "Bid" = EXCLUDED."Bid",
          "Delivery" = EXCLUDED."Delivery",
          "Status" = EXCLUDED."Status",
          "CreatedAt" = EXCLUDED."CreatedAt"
      `;

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        for (const record of records) {
          await client.query(query, [
            record.id,
            record.bid,
            record.delivery,
            record.status,
            record.createdAt,
            record.updatedAt,
          ]);
        }

        await client.query('COMMIT');

        const duration = Date.now() - startTime;
        logger.info('Campaign history batch upserted', {
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
      logger.error('Failed to upsert campaign history batch', {
        error: error instanceof Error ? error.message : String(error),
        recordsCount: records.length,
      });
      throw error;
    }
  }
}
