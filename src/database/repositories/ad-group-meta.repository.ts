import { Pool } from 'pg';
import { database } from '../connection.js';
import { AdGroupMetaRecord } from '../../types/vk-ads.types.js';
import { logger } from '../../services/logger.js';

export class AdGroupMetaRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async getLastUpdatedAt(): Promise<Date | null> {
    try {
      const result = await this.pool.query<{ UpdatedAt: Date }>(
        'SELECT "UpdatedAt" FROM "AdGroupMeta" ORDER BY "UpdatedAt" DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].UpdatedAt;
    } catch (error) {
      logger.error('Failed to get last updated timestamp for ad groups', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async upsertBatch(records: AdGroupMetaRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO "AdGroupMeta" ("Id", "Name", "AdPlanId", "Status")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("Id")
        DO UPDATE SET
          "Name" = EXCLUDED."Name",
          "AdPlanId" = EXCLUDED."AdPlanId",
          "Status" = EXCLUDED."Status",
          "UpdatedAt" = NOW()
      `;

      const client = await this.pool.connect();

      try {
        await client.query('BEGIN');

        for (const record of records) {
          await client.query(query, [
            record.id,
            record.name,
            record.adPlanId,
            record.status,
          ]);
        }

        await client.query('COMMIT');

        const duration = Date.now() - startTime;
        logger.info('Ad group metadata batch upserted', {
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
      logger.error('Failed to upsert ad group metadata batch', {
        error: error instanceof Error ? error.message : String(error),
        recordsCount: records.length,
      });
      throw error;
    }
  }
}
