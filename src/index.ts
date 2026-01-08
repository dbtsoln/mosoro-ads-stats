import { config } from './config/index.js';
import { logger } from './services/logger.js';
import { VKAdsClient } from './services/vk-ads-client.js';
import { Scheduler } from './services/scheduler.js';
import { FastStatsRepository } from './database/repositories/fast-stats.repository.js';
import { SummaryStatsRepository } from './database/repositories/summary-stats.repository.js';
import { CampaignMetaRepository } from './database/repositories/campaign-meta.repository.js';
import { CampaignHistoryRepository } from './database/repositories/campaign-history.repository.js';
import { AdGroupMetaRepository } from './database/repositories/ad-group-meta.repository.js';
import { BannerMetaRepository } from './database/repositories/banner-meta.repository.js';
import { database } from './database/connection.js';

async function collectFastStats(
  vkAdsClient: VKAdsClient,
  fastStatsRepo: FastStatsRepository
): Promise<void> {
  const fastStats = await vkAdsClient.getFastStats();
  await fastStatsRepo.upsertBatch(fastStats);
}

async function collectSummaryStats(
  vkAdsClient: VKAdsClient,
  summaryStatsRepo: SummaryStatsRepository
): Promise<void> {
  const summaryStats = await vkAdsClient.getSummaryStats();
  await summaryStatsRepo.insertBatch(summaryStats);
}

async function updateCampaignHistory(
  vkAdsClient: VKAdsClient,
  campaignHistoryRepo: CampaignHistoryRepository
): Promise<void> {
  const lastUpdate = await campaignHistoryRepo.getLastUpdatedAt();
  const campaignHistory = await vkAdsClient.getCampaignHistory(lastUpdate || undefined);
  await campaignHistoryRepo.upsertBatch(campaignHistory);
}

async function updateMetadata(
  vkAdsClient: VKAdsClient,
  campaignMetaRepo: CampaignMetaRepository,
  adGroupMetaRepo: AdGroupMetaRepository,
  bannerMetaRepo: BannerMetaRepository
): Promise<void> {
  logger.info('Starting metadata update...');

  // Получаем даты последних обновлений для инкрементальной загрузки
  const lastCampaignUpdate = await campaignMetaRepo.getLastUpdatedAt();
  const lastAdGroupUpdate = await adGroupMetaRepo.getLastUpdatedAt();
  const lastBannerUpdate = await bannerMetaRepo.getLastUpdatedAt();

  const campaigns = await vkAdsClient.getCampaigns(lastCampaignUpdate || undefined);
  await campaignMetaRepo.upsertBatch(campaigns);

  const adGroups = await vkAdsClient.getAdGroups(lastAdGroupUpdate || undefined);
  await adGroupMetaRepo.upsertBatch(adGroups);

  const banners = await vkAdsClient.getBanners(lastBannerUpdate || undefined);
  await bannerMetaRepo.upsertBatch(banners);

  logger.info('Metadata update completed', {
    campaignsCount: campaigns.length,
    adGroupsCount: adGroups.length,
    bannersCount: banners.length,
    incremental: {
      campaigns: !!lastCampaignUpdate,
      adGroups: !!lastAdGroupUpdate,
      banners: !!lastBannerUpdate,
    },
  });
}

async function startService() {
  try {
    logger.info('Starting VK Ads Stats Service...', {
      nodeEnv: config.app.nodeEnv,
      fastStatsInterval: config.scheduler.fastStatsInterval,
      summaryStatsInterval: config.scheduler.summaryStatsInterval,
      metadataUpdateInterval: config.scheduler.metadataUpdateInterval,
    });

    await database.testConnection();

    const vkAdsClient = new VKAdsClient();
    const fastStatsRepo = new FastStatsRepository();
    const summaryStatsRepo = new SummaryStatsRepository();
    const campaignMetaRepo = new CampaignMetaRepository();
    const campaignHistoryRepo = new CampaignHistoryRepository();
    const adGroupMetaRepo = new AdGroupMetaRepository();
    const bannerMetaRepo = new BannerMetaRepository();
    const scheduler = new Scheduler();

    // Schedule tasks with runImmediately=true to fetch data on startup
    scheduler.schedule(
      config.scheduler.fastStatsInterval,
      () => collectFastStats(vkAdsClient, fastStatsRepo),
      'Fast Stats Collection',
      true
    );

    scheduler.schedule(
      config.scheduler.summaryStatsInterval,
      () => collectSummaryStats(vkAdsClient, summaryStatsRepo),
      'Summary Stats Collection',
      true
    );

    scheduler.schedule(
      config.scheduler.metadataUpdateInterval,
      () => updateMetadata(vkAdsClient, campaignMetaRepo, adGroupMetaRepo, bannerMetaRepo),
      'Metadata Update',
      true
    );

    scheduler.schedule(
      config.scheduler.metadataUpdateInterval,
      () => updateCampaignHistory(vkAdsClient, campaignHistoryRepo),
      'Campaign History Update',
      true
    );

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      scheduler.stopAll();
      await database.close();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      scheduler.stopAll();
      await database.close();
      process.exit(0);
    });

    logger.info('Service started successfully');
  } catch (error) {
    logger.error('Service startup failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

startService();
