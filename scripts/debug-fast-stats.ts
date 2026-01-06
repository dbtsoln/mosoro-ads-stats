import { config } from '../src/config/index.js';
import { logger } from '../src/services/logger.js';
import { database } from '../src/database/connection.js';

interface VKAdsFastStatResponse {
  last_seen_msg_time?: {
    timestamp: number;
    string: string;
    ago: number;
  };
  banners: {
    [bannerId: string]: {
      timestamp: number;
      minutely: {
        shows: number[];
        clicks: number[];
      };
    };
  };
}

async function debugFastStats(targetBannerId: string) {
  try {
    console.log('\n=== VK Ads Fast Stats Debug ===');
    console.log(`Target Banner ID: ${targetBannerId}`);
    console.log(`Fetch Time: ${new Date().toISOString()}\n`);

    // 1. Fetch data from VK Ads API
    console.log('1. Fetching data from VK Ads API...');
    const response = await fetch(config.vkAds.fastStatUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.vkAds.apiToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`VK Ads API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as VKAdsFastStatResponse;

    // 2. Check if banner exists in response
    const bannerData = data.banners[targetBannerId];
    if (!bannerData) {
      console.log(`❌ Banner ${targetBannerId} not found in API response`);
      console.log(`Available banner IDs: ${Object.keys(data.banners).join(', ')}`);
      return;
    }

    console.log('✓ Banner found in API response\n');

    // 3. Show last_seen_msg_time from response root
    if (data.last_seen_msg_time) {
      const lastSeen = data.last_seen_msg_time;
      const lastSeenMs = lastSeen.timestamp * 1000;
      console.log('2. Response last_seen_msg_time (root level):');
      console.log(`   timestamp: ${lastSeen.timestamp}`);
      console.log(`   string: ${lastSeen.string}`);
      console.log(`   ago: ${lastSeen.ago} seconds`);
      console.log(`   ISO: ${new Date(lastSeenMs).toISOString()}\n`);
    } else {
      console.log('2. last_seen_msg_time: NOT PRESENT\n');
    }

    // 4. Show banner timestamp
    const vkTimestamp = bannerData.timestamp;
    const vkTimestampMs = vkTimestamp * 1000;
    const vkTimestampDate = new Date(vkTimestampMs);

    console.log('3. Banner Timestamp (end of 60-minute window):');
    console.log(`   Unix seconds: ${vkTimestamp}`);
    console.log(`   ISO: ${vkTimestampDate.toISOString()}`);
    console.log(`   Local: ${vkTimestampDate.toLocaleString()}`);

    // Compare timestamps
    if (data.last_seen_msg_time) {
      const diffSeconds = vkTimestamp - data.last_seen_msg_time.timestamp;
      console.log(`   Difference from last_seen_msg_time: ${diffSeconds} seconds`);
    }
    console.log();

    // 5. Calculate base timestamp
    const vkTimestampFloored = Math.floor(vkTimestampMs / 60000) * 60000;
    const baseTimestamp = vkTimestampFloored - 60 * 59 * 1000;

    console.log('4. Calculated Base Timestamp (start of window):');
    console.log(`   VK timestamp floored: ${new Date(vkTimestampFloored).toISOString()}`);
    console.log(`   Base (floored - 59 min): ${new Date(baseTimestamp).toISOString()}\n`);

    // 6. Parse minutely data
    console.log('5. Minutely Data:');
    console.log(`   Total elements in minutely.shows: ${bannerData.minutely.shows.length}`);
    console.log(`   Total elements in minutely.clicks: ${bannerData.minutely.clicks.length}\n`);
    console.log('   Non-zero records:');
    console.log('   Index | Timestamp                | Shows | Clicks');
    console.log('   ------|--------------------------|-------|-------');

    const recordsToInsert: Array<{
      timestamp: Date;
      shows: number;
      clicks: number;
    }> = [];

    for (let index = 0; index < bannerData.minutely.shows.length; index++) {
      const shows = bannerData.minutely.shows[index];
      const clicks = bannerData.minutely.clicks[index];

      if (shows > 0 || clicks > 0) {
        const minuteTimestamp = new Date(baseTimestamp + 60 * index * 1000);
        recordsToInsert.push({ timestamp: minuteTimestamp, shows, clicks });

        console.log(
          `   ${String(index).padStart(5)} | ${minuteTimestamp.toISOString()} | ${String(shows).padStart(5)} | ${String(clicks).padStart(6)}`
        );
      }
    }

    console.log(`\n   Total non-zero records: ${recordsToInsert.length}\n`);

    // 6. Check database for existing records
    await database.testConnection();
    const pool = database.getPool();

    console.log('6. Checking database for this banner:');
    const dbResult = await pool.query(
      `SELECT "Timestamp", "Shows", "Clicks", "CreatedAt", "UpdatedAt"
       FROM "FastStats"
       WHERE "BannerId" = $1
       ORDER BY "Timestamp" DESC
       LIMIT 100`,
      [parseInt(targetBannerId, 10)]
    );

    if (dbResult.rows.length === 0) {
      console.log('   ❌ No records found in database for this banner\n');
    } else {
      console.log(`   ✓ Found ${dbResult.rows.length} records in database\n`);
      console.log('   Timestamp                | Shows | Clicks | CreatedAt            | UpdatedAt');
      console.log('   -------------------------|-------|--------|----------------------|----------------------');

      for (const row of dbResult.rows.slice(0, 10)) {
        console.log(
          `   ${new Date(row.Timestamp).toISOString()} | ${String(row.Shows).padStart(5)} | ${String(row.Clicks).padStart(6)} | ${new Date(row.CreatedAt).toISOString().substring(11, 19)} | ${new Date(row.UpdatedAt).toISOString().substring(11, 19)}`
        );
      }

      if (dbResult.rows.length > 10) {
        console.log(`   ... and ${dbResult.rows.length - 10} more rows`);
      }
    }

    console.log('\n=== Debug Complete ===\n');

    await database.close();
  } catch (error) {
    console.error('Debug script failed:', error);
    process.exit(1);
  }
}

// Get banner ID from command line arguments
const bannerId = process.argv[2] || process.env.DEBUG_BANNER_ID;

if (!bannerId) {
  console.error('Usage: npm run debug:fast-stats <bannerId>');
  console.error('Or set DEBUG_BANNER_ID environment variable');
  process.exit(1);
}

debugFastStats(bannerId);
