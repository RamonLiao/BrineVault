import type Redis from "ioredis";

/**
 * Invalidates Redis cache keys when the indexer updates core tables.
 */
export class CacheInvalidator {
  constructor(private redis: Redis | null) {}

  async invalidatePool(poolId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`cache:pool:${poolId}`);
  }

  async invalidateMembers(poolId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`cache:members:${poolId}`);
  }

  async invalidatePoolAndMembers(poolId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`cache:pool:${poolId}`, `cache:members:${poolId}`);
  }

  async invalidateNotificationCount(userId: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.del(`notification:unread:${userId}`);
  }
}
