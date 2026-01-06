import dotenv from 'dotenv';

dotenv.config();

export const config = {
  vkAds: {
    apiToken: process.env.VK_ADS_API_TOKEN!,
    fastStatUrl: 'https://ads.vk.com/api/v3/statistics/faststat/banners.json',
    summaryUrl: 'https://ads.vk.com/api/v2/statistics/banners/summary.json',
  },
  database: {
    uri: process.env.POSTGRES_URI!,
    ssl: process.env.POSTGRES_SSL === 'true',
  },
  scheduler: {
    fastStatsInterval: parseInt(process.env.FAST_STATS_INTERVAL || '5', 10),
    summaryStatsInterval: parseInt(process.env.SUMMARY_STATS_INTERVAL || '10', 10),
    metadataUpdateInterval: parseInt(process.env.METADATA_UPDATE_INTERVAL || '60', 10),
  },
  app: {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
} as const;

const requiredEnvVars = ['VK_ADS_API_TOKEN', 'POSTGRES_URI'];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
