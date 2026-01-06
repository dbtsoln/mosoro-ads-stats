import { Pool } from 'pg';
import { database } from '../connection.js';
import { BannerMetaRecord } from '../../types/vk-ads.types.js';
import { logger } from '../../services/logger.js';

export class BannerMetaRepository {
  private pool: Pool;

  constructor() {
    this.pool = database.getPool();
  }

  async getLastUpdatedAt(): Promise<Date | null> {
    try {
      const result = await this.pool.query<{ UpdatedAt: Date }>(
        'SELECT "UpdatedAt" FROM "BannerMeta" ORDER BY "UpdatedAt" DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].UpdatedAt;
    } catch (error) {
      logger.error('Failed to get last updated timestamp for banners', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async upsertBatch(records: BannerMetaRecord[]): Promise<number> {
    if (records.length === 0) {
      return 0;
    }

    const startTime = Date.now();

    try {
      const query = `
        INSERT INTO "BannerMeta" ("Id", "Name", "AdGroupId", "Textblocks", "Status")
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT ("Id")
        DO UPDATE SET
          "Name" = EXCLUDED."Name",
          "AdGroupId" = EXCLUDED."AdGroupId",
          "Textblocks" = EXCLUDED."Textblocks",
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
            record.adGroupId,
            record.textblocks,
            record.status,
          ]);
        }

        await client.query('COMMIT');

        const duration = Date.now() - startTime;
        logger.info('Banner metadata batch upserted', {
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
      logger.error('Failed to upsert banner metadata batch', {
        error: error instanceof Error ? error.message : String(error),
        recordsCount: records.length,
      });
      throw error;
    }
  }
}
