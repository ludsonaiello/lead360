import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

interface ActiveTokenRecord {
  jti: string;
  exp: number; // Unix timestamp in seconds
}

@Injectable()
export class TokenBlocklistService {
  private readonly TRACK_PREFIX = 'user_active_token';
  private readonly BLOCK_PREFIX = 'blocked_token';

  constructor(private readonly cache: CacheService) {}

  /**
   * Called at login/refresh: records the user's current active jti so it can
   * be blocked later on deactivation.
   *
   * @param userId - user.id
   * @param jti    - UUID jti embedded in the access token
   * @param exp    - Unix timestamp (seconds) when the token expires
   */
  async trackToken(userId: string, jti: string, exp: number): Promise<void> {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl <= 0) return; // already expired — nothing to track
    // CacheService auto-serializes: pass the typed object directly
    const record: ActiveTokenRecord = { jti, exp };
    await this.cache.set(`${this.TRACK_PREFIX}:${userId}`, record, ttl);
  }

  /**
   * Called on user deactivation: reads the user's tracked active token and
   * adds its jti to the blocklist with the remaining TTL.
   *
   * @param userId - user.id of the user being deactivated
   */
  async blockUserTokens(userId: string): Promise<void> {
    // CacheService auto-deserializes: get the typed object directly
    const record = await this.cache.get<ActiveTokenRecord>(`${this.TRACK_PREFIX}:${userId}`);
    if (!record) return; // user has no active tracked token — nothing to block

    const remaining = record.exp - Math.floor(Date.now() / 1000);
    if (remaining <= 0) return; // already expired — token is naturally invalid

    // Store the jti in the blocklist with the remaining lifetime as TTL
    await this.cache.set(`${this.BLOCK_PREFIX}:${record.jti}`, '1', remaining);

    // Clean up the tracking key — user is now deactivated
    await this.cache.del(`${this.TRACK_PREFIX}:${userId}`);
  }

  /**
   * Called on every authenticated request: returns true if the token is blocked.
   *
   * @param jti - UUID jti from the incoming JWT payload
   */
  async isBlocked(jti: string): Promise<boolean> {
    return this.cache.exists(`${this.BLOCK_PREFIX}:${jti}`);
  }
}
