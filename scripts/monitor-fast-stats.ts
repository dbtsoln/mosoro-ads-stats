import { config } from '../src/config/index.js';

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

async function monitorFastStats(targetBannerId: string, expectedTimeISO: string) {
  const expectedTime = new Date(expectedTimeISO);
  const expectedTimeMs = expectedTime.getTime();

  console.log('\n=== VK Ads Fast Stats Monitor ===');
  console.log(`Target Banner ID: ${targetBannerId}`);
  console.log(`Expected Time: ${expectedTime.toISOString()}`);
  console.log(`Expected Unix MS: ${expectedTimeMs}`);
  console.log('\nMonitoring every 5 seconds... (Press Ctrl+C to stop)\n');

  let checkCount = 0;

  const interval = setInterval(async () => {
    checkCount++;
    const requestTime = new Date();

    try {
      const response = await fetch(config.vkAds.fastStatUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.vkAds.apiToken}`,
        },
      });

      if (!response.ok) {
        console.log(
          `[${requestTime.toISOString()}] ❌ API Error: ${response.status} ${response.statusText}`
        );
        return;
      }

      const data = (await response.json()) as VKAdsFastStatResponse;
      const bannerData = data.banners[targetBannerId];

      if (!bannerData) {
        console.log(
          `[${requestTime.toISOString()}] ❌ Banner ${targetBannerId} not found in response`
        );
        return;
      }

      // Get VK timestamp
      const vkTimestamp = bannerData.timestamp;
      const vkTimestampMs = vkTimestamp * 1000;
      const vkTimestampDate = new Date(vkTimestampMs);

      // Calculate base timestamp (same logic as in production)
      const vkTimestampFloored = Math.floor(vkTimestampMs / 60000) * 60000;
      const baseTimestamp = vkTimestampFloored - 60 * 59 * 1000;

      // Check if expected time is in the window
      const windowStart = baseTimestamp;
      const windowEnd = baseTimestamp + 59 * 60 * 1000;

      // Find the expected time in minutely data
      let found = false;
      let foundIndex = -1;
      let foundShows = 0;

      if (expectedTimeMs >= windowStart && expectedTimeMs <= windowEnd) {
        // Calculate expected index
        const minutesDiff = Math.floor((expectedTimeMs - baseTimestamp) / (60 * 1000));

        if (minutesDiff >= 0 && minutesDiff < bannerData.minutely.shows.length) {
          foundIndex = minutesDiff;
          foundShows = bannerData.minutely.shows[minutesDiff];
          found = foundShows > 0;
        }
      }

      // Format output
      const status = found ? '✅ FOUND' : '❌ NOT FOUND';
      const vkTimeStr = vkTimestampDate.toISOString().substring(11, 19);
      const baseTimeStr = new Date(baseTimestamp).toISOString().substring(11, 19);
      const windowEndStr = new Date(windowEnd).toISOString().substring(11, 19);

      // Format last_seen_msg_time info
      let lastSeenInfo = '';
      if (data.last_seen_msg_time) {
        const lastSeenTimeStr = new Date(data.last_seen_msg_time.timestamp * 1000)
          .toISOString()
          .substring(11, 19);
        const diff = vkTimestamp - data.last_seen_msg_time.timestamp;
        lastSeenInfo = ` | LastSeen: ${lastSeenTimeStr} (ago: ${data.last_seen_msg_time.ago}s, diff: ${diff}s)`;
      }

      console.log(
        `[${requestTime.toISOString().substring(11, 19)}] Banner: ${vkTimeStr}${lastSeenInfo} | Window: ${baseTimeStr}-${windowEndStr} | ${status}${found ? ` (idx: ${foundIndex}, shows: ${foundShows})` : ''}`
      );
    } catch (error) {
      console.log(
        `[${requestTime.toISOString()}] ❌ Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }, 5000);

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(`\n\nMonitoring stopped after ${checkCount} checks.`);
    process.exit(0);
  });
}

// Get parameters from command line
const bannerId = process.argv[2];
const expectedTime = process.argv[3];

if (!bannerId || !expectedTime) {
  console.error('Usage: npm run monitor:fast-stats <bannerId> <expectedTime>');
  console.error('Example: npm run monitor:fast-stats 203645615 "2026-01-05T17:30:00.000Z"');
  console.error('         npm run monitor:fast-stats 203645615 "2026-01-05 17:30:00"');
  process.exit(1);
}

monitorFastStats(bannerId, expectedTime);
