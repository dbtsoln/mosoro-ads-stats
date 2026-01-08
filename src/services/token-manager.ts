import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number; // Unix timestamp in milliseconds
  token_type: string;
}

interface VKOAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export class TokenManager {
  private tokenData: TokenData | null = null;
  private readonly tokenCachePath: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private refreshPromise: Promise<TokenData> | null = null;

  constructor(clientId: string, clientSecret: string, cacheDir: string = './data') {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tokenCachePath = join(cacheDir, '.token-cache.json');

    // Ensure cache directory exists
    this.ensureCacheDir(cacheDir);
    this.loadTokenFromCache();
  }

  private ensureCacheDir(dir: string): void {
    try {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        logger.info('Created cache directory', { dir });
      }
    } catch (error) {
      logger.warn('Failed to create cache directory', {
        dir,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private loadTokenFromCache(): void {
    try {
      if (existsSync(this.tokenCachePath)) {
        const data = readFileSync(this.tokenCachePath, 'utf-8');
        this.tokenData = JSON.parse(data);
        const isExpired = this.isTokenExpired();
        logger.info('Token loaded from cache', {
          expiresAt: new Date(this.tokenData!.expires_at).toISOString(),
          isExpired,
          timeUntilExpiry: this.tokenData!.expires_at - Date.now(),
        });
      } else {
        logger.info('No token cache found, will fetch new token');
      }
    } catch (error) {
      logger.warn('Failed to load token from cache', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.tokenData = null;
    }
  }

  private saveTokenToCache(tokenData: TokenData): void {
    try {
      writeFileSync(this.tokenCachePath, JSON.stringify(tokenData, null, 2), 'utf-8');
      logger.info('Token saved to cache');
    } catch (error) {
      logger.error('Failed to save token to cache', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenData) {
      return true;
    }

    // Check if token expires in less than 5 minutes (buffer time)
    const bufferMs = 5 * 60 * 1000;
    return Date.now() + bufferMs >= this.tokenData.expires_at;
  }

  private async fetchToken(grantType: 'client_credentials' | 'refresh_token'): Promise<TokenData> {
    const url = 'https://ads.vk.com/api/v2/oauth2/token.json';

    let body: string;
    if (grantType === 'client_credentials') {
      body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString();
    } else {
      if (!this.tokenData?.refresh_token) {
        throw new Error('No refresh token available');
      }
      body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.tokenData.refresh_token,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString();
    }

    logger.info(`Fetching token using ${grantType}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `VK OAuth2 error: ${response.status} ${response.statusText}. Response: ${errorText}`
      );
    }

    const data = (await response.json()) as VKOAuthResponse;

    // Calculate expiration timestamp
    const expiresAt = Date.now() + data.expires_in * 1000;

    const tokenData: TokenData = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: data.expires_in,
      expires_at: expiresAt,
      token_type: data.token_type,
    };

    this.tokenData = tokenData;
    this.saveTokenToCache(tokenData);

    logger.info('Token fetched successfully', {
      expiresIn: `${data.expires_in} seconds`,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    return tokenData;
  }

  async ensureValidToken(): Promise<string> {
    // Check if token is still valid
    if (!this.isTokenExpired()) {
      logger.debug('Using cached token', {
        expiresAt: new Date(this.tokenData!.expires_at).toISOString(),
      });
      return this.tokenData!.access_token;
    }

    // Atomically check and create promise - no awaits between check and set
    if (!this.refreshPromise) {
      this.refreshPromise = this.performTokenRefresh();
    }

    // Wait for the refresh (either one we just created or one in progress)
    try {
      await this.refreshPromise;
    } catch (error) {
      // Error is logged in performTokenRefresh, just propagate
      throw error;
    }

    return this.tokenData!.access_token;
  }

  invalidateToken(): void {
    logger.info('Invalidating current token');
    this.tokenData = null;
    this.refreshPromise = null;
  }

  private async performTokenRefresh(): Promise<TokenData> {
    logger.info('Token expired or missing, refreshing...');

    try {
      // Try to refresh if we have a refresh token
      if (this.tokenData?.refresh_token) {
        return await this.fetchToken('refresh_token');
      } else {
        // Otherwise get new token with client credentials
        return await this.fetchToken('client_credentials');
      }
    } catch (error) {
      logger.warn('Token refresh failed, trying client credentials', {
        error: error instanceof Error ? error.message : String(error),
      });

      // If refresh fails, fall back to client credentials
      return await this.fetchToken('client_credentials');
    } finally {
      // Clear the refresh promise when done
      this.refreshPromise = null;
    }
  }

  async getAccessToken(): Promise<string> {
    return this.ensureValidToken();
  }
}
