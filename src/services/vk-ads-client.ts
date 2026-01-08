import { config } from '../config/index.js';
import { logger } from './logger.js';
import { TokenManager } from './token-manager.js';
import {
  VKAdsFastStatResponse,
  VKAdsSummaryResponse,
  FastStatRecord,
  SummaryStatRecord,
  VKAdsCampaignResponse,
  VKAdsAdGroupResponse,
  VKAdsBannerResponse,
  CampaignMetaRecord,
  CampaignHistoryRecord,
  AdGroupMetaRecord,
  BannerMetaRecord,
} from '../types/vk-ads.types.js';

export class VKAdsClient {
  private readonly tokenManager: TokenManager;

  constructor() {
    this.tokenManager = new TokenManager(
      config.vkAds.clientId,
      config.vkAds.clientSecret
    );
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.tokenManager.getAccessToken();
    return {
      Authorization: `Bearer ${accessToken}`,
    };
  }

  private async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
    let headers = await this.getAuthHeaders();
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        ...headers,
      },
    });

    // If we get 401, the token might be invalid - invalidate and retry once
    if (response.status === 401) {
      logger.warn('Got 401 Unauthorized, invalidating token and retrying', { url });
      this.tokenManager.invalidateToken();

      // Get fresh token and retry
      headers = await this.getAuthHeaders();
      response = await fetch(url, {
        ...options,
        headers: {
          ...options.headers,
          ...headers,
        },
      });
    }

    return response;
  }

  async getFastStats(): Promise<FastStatRecord[]> {
    const startTime = Date.now();

    try {
      logger.info('Fetching fast stats from VK Ads API', {
        url: config.vkAds.fastStatUrl,
      });

      const response = await this.fetchWithAuth(config.vkAds.fastStatUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(
          `VK Ads API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as VKAdsFastStatResponse;
      const records = this.parseFastStatResponse(data);

      const duration = Date.now() - startTime;
      logger.info('Fast stats fetched successfully', {
        duration,
        recordsCount: records.length,
        bannersCount: Object.keys(data.banners).length,
      });

      return records;
    } catch (error) {
      logger.error('Failed to fetch fast stats', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async getSummaryStats(): Promise<SummaryStatRecord[]> {
    const startTime = Date.now();
    const url = `${config.vkAds.summaryUrl}?banner_status=active`;

    try {
      logger.info('Fetching summary stats from VK Ads API', { url });

      const response = await this.fetchWithAuth(url, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(
          `VK Ads API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as VKAdsSummaryResponse;
      const records = this.parseSummaryResponse(data);

      const duration = Date.now() - startTime;
      logger.info('Summary stats fetched successfully', {
        duration,
        recordsCount: records.length,
      });

      return records;
    } catch (error) {
      logger.error('Failed to fetch summary stats', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  private parseFastStatResponse(
    data: VKAdsFastStatResponse
  ): FastStatRecord[] {
    const records: FastStatRecord[] = [];

    for (const [bannerId, bannerData] of Object.entries(data.banners)) {
      // VK timestamp is the END of the 60-minute window (in seconds)
      const vkTimestamp = bannerData.timestamp;
      const vkTimestampMs = vkTimestamp * 1000;

      // CRITICAL: Floor VK timestamp to minute boundary FIRST to prevent shifting
      // when VK returns timestamps with seconds (e.g., 17:43:10 vs 17:44:00)
      const vkTimestampFloored = Math.floor(vkTimestampMs / 60000) * 60000;

      // Calculate base timestamp (start of 60-minute window)
      const baseTimestamp = vkTimestampFloored - 60 * 59 * 1000;

      // Log for debugging (using info to ensure visibility)
      if (Object.keys(data.banners).indexOf(bannerId) === 0) {
        // Log only first banner to avoid spam
        logger.info('Parsing fast stats timestamp calculation', {
          bannerId,
          vkTimestampSeconds: vkTimestamp,
          vkTimestampISO: new Date(vkTimestampMs).toISOString(),
          vkTimestampFlooredISO: new Date(vkTimestampFloored).toISOString(),
          baseTimestampISO: new Date(baseTimestamp).toISOString(),
          firstMinute: new Date(baseTimestamp).toISOString(),
          lastMinute: new Date(baseTimestamp + 59 * 60 * 1000).toISOString(),
          minutelyLength: bannerData.minutely.shows.length,
        });
      }

      for (let index = 0; index < bannerData.minutely.shows.length; index++) {
        const shows = bannerData.minutely.shows[index];
        const clicks = bannerData.minutely.clicks[index];

        // Фильтруем записи - берем только баннеры с показами или кликами
        if (shows === 0 && clicks === 0) {
          continue;
        }

        // Add exact minute offsets (no need to round again)
        const minuteTimestamp = new Date(baseTimestamp + 60 * index * 1000);

        records.push({
          timestamp: minuteTimestamp,
          bannerId: parseInt(bannerId, 10),
          shows,
          clicks,
        });
      }
    }

    return records;
  }

  private parseSummaryResponse(
    data: VKAdsSummaryResponse
  ): SummaryStatRecord[] {
    const timestamp = new Date();
    timestamp.setSeconds(0, 0);

    // Фильтруем баннеры - берем только те, у которых есть показы или клики
    return data.items
      .filter((item) => item.total.base.shows > 0 || item.total.base.clicks > 0)
      .map((item) => ({
        timestamp,
        bannerId: parseInt(item.id, 10),
        shows: item.total.base.shows,
        clicks: item.total.base.clicks,
        spent: parseFloat(item.total.base.spent),
      }));
  }

  private async fetchPaginatedItems<T>(
    url: string,
    query: Record<string, string>
  ): Promise<T[]> {
    const perPage = 250;
    let items: T[] = [];
    let totalCount = 0;
    let offset = 0;

    while (true) {
      const paginatedQuery = {
        ...query,
        limit: perPage.toString(),
        offset: offset.toString(),
      };

      const queryString = new URLSearchParams(paginatedQuery).toString();
      const fullUrl = `${url}?${queryString}`;

      logger.debug(`Fetching paginated items`, { url: fullUrl, offset });

      const response = await this.fetchWithAuth(fullUrl, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(
          `VK Ads API error: ${response.status} ${response.statusText}`
        );
      }

      const json = (await response.json()) as {
        count: number;
        items: T[];
        error?: { message: string };
      };

      if (json.error) {
        throw new Error(json.error.message);
      }

      totalCount = json.count;
      items = items.concat(json.items);

      if (totalCount === items.length) {
        break;
      }

      offset += perPage;
    }

    return items;
  }

  async getCampaigns(since?: Date): Promise<CampaignMetaRecord[]> {
    const startTime = Date.now();

    try {
      const query: Record<string, string> = {
        fields: ['id', 'name'].join(','),
        _status__in: ['active', 'blocked'].join(','),
      };

      if (since) {
        query._updated__gt = this.formatDateForApi(since);
        logger.info('Fetching campaigns from VK Ads API (incremental)', { since: query._updated__gt });
      } else {
        logger.info('Fetching campaigns from VK Ads API (full)');
      }

      const items = await this.fetchPaginatedItems<
        VKAdsCampaignResponse['items'][0]
      >('https://ads.vk.com/api/v2/ad_plans.json', query);

      const records = items.map((item) => ({
        id: parseInt(item.id, 10),
        name: item.name,
        status: item.status || 'unknown',
      }));

      const duration = Date.now() - startTime;
      logger.info('Campaigns fetched successfully', {
        duration,
        recordsCount: records.length,
      });

      return records;
    } catch (error) {
      logger.error('Failed to fetch campaigns', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async getCampaignHistory(since?: Date): Promise<CampaignHistoryRecord[]> {
    const startTime = Date.now();

    try {
      const query: Record<string, string> = {
        fields: ['id', 'status', 'price', 'delivery', 'updated'].join(','),
        _status__in: ['active', 'blocked'].join(','),
      };

      if (since) {
        query._updated__gt = this.formatDateForApi(since);
        logger.info('Fetching campaign history from VK Ads API (incremental)', { since: query._updated__gt });
      } else {
        logger.info('Fetching campaign history from VK Ads API (full)');
      }

      const items = await this.fetchPaginatedItems<
        VKAdsCampaignResponse['items'][0]
      >('https://ads.vk.com/api/v2/ad_plans.json', query);

      const records = items.map((item) => ({
        id: parseInt(item.id, 10),
        bid: item.price ? parseFloat(item.price) : null,
        delivery: item.delivery || null,
        status: item.status || 'unknown',
        updatedAt: item.updated ? new Date(item.updated) : new Date(),
      }));

      const duration = Date.now() - startTime;
      logger.info('Campaign history fetched successfully', {
        duration,
        recordsCount: records.length,
      });

      return records;
    } catch (error) {
      logger.error('Failed to fetch campaign history', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async getAdGroups(since?: Date): Promise<AdGroupMetaRecord[]> {
    const startTime = Date.now();

    try {
      const query: Record<string, string> = {
        fields: ['id', 'name', 'ad_plan_id'].join(','),
        _status__in: ['active', 'blocked'].join(','),
      };

      if (since) {
        query._updated__gt = this.formatDateForApi(since);
        logger.info('Fetching ad groups from VK Ads API (incremental)', { since: query._updated__gt });
      } else {
        logger.info('Fetching ad groups from VK Ads API (full)');
      }

      const items = await this.fetchPaginatedItems<
        VKAdsAdGroupResponse['items'][0]
      >('https://ads.vk.com/api/v2/ad_groups.json', query);

      const records = items.map((item) => ({
        id: parseInt(item.id, 10),
        name: item.name,
        adPlanId: parseInt(item.ad_plan_id, 10),
        status: item.status || 'unknown',
      }));

      const duration = Date.now() - startTime;
      logger.info('Ad groups fetched successfully', {
        duration,
        recordsCount: records.length,
      });

      return records;
    } catch (error) {
      logger.error('Failed to fetch ad groups', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  async getBanners(since?: Date): Promise<BannerMetaRecord[]> {
    const startTime = Date.now();

    try {
      const query: Record<string, string> = {
        fields: ['id', 'name', 'ad_group_id', 'textblocks'].join(','),
        _status__in: ['active', 'blocked'].join(','),
      };

      if (since) {
        query._updated__gt = this.formatDateForApi(since);
        logger.info('Fetching banners from VK Ads API (incremental)', { since: query._updated__gt });
      } else {
        logger.info('Fetching banners from VK Ads API (full)');
      }

      const items = await this.fetchPaginatedItems<
        VKAdsBannerResponse['items'][0]
      >('https://ads.vk.com/api/v2/banners.json', query);

      const records = items.map((item) => ({
        id: parseInt(item.id, 10),
        name: item.name,
        adGroupId: parseInt(item.ad_group_id, 10),
        textblocks: item.textblocks ? JSON.stringify(item.textblocks) : null,
        status: item.status || 'unknown',
      }));

      const duration = Date.now() - startTime;
      logger.info('Banners fetched successfully', {
        duration,
        recordsCount: records.length,
      });

      return records;
    } catch (error) {
      logger.error('Failed to fetch banners', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      });
      throw error;
    }
  }

  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }
}
