import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { REDIS } from '../../common/constants.js';
import { AUTH_CONFIG } from '@rwa-dataroom/shared';

export interface ChallengeData {
  timestamp: string;
  ip: string;
}

export interface SessionData {
  userId: string;
  address: string;
  orgId: string | null;
  refreshTokenHash: string;
  createdAt: string;
  lastActiveAt: string;
  ip: string;
  userAgent: string;
}

@Injectable()
export class SessionService {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  // ─── Challenge ───────────────────────────────────────────

  async storeChallenge(nonce: string, ip: string): Promise<void> {
    const key = `auth:challenge:${nonce}`;
    const data: ChallengeData = { timestamp: new Date().toISOString(), ip };
    await this.redis.set(key, JSON.stringify(data), 'EX', AUTH_CONFIG.CHALLENGE_TTL_SECONDS);
  }

  async consumeChallenge(nonce: string): Promise<ChallengeData | null> {
    const key = `auth:challenge:${nonce}`;
    // Atomic get+delete via pipeline
    const pipeline = this.redis.pipeline();
    pipeline.get(key);
    pipeline.del(key);
    const results = await pipeline.exec();
    const value = results?.[0]?.[1] as string | null;
    if (!value) return null;
    return JSON.parse(value) as ChallengeData;
  }

  // ─── Session ─────────────────────────────────────────────

  async createSession(
    userId: string,
    address: string,
    orgId: string | null,
    refreshTokenHash: string,
    ip: string,
    userAgent: string,
  ): Promise<string> {
    const sid = randomUUID();
    const now = new Date().toISOString();
    const data: SessionData = {
      userId,
      address,
      orgId,
      refreshTokenHash,
      createdAt: now,
      lastActiveAt: now,
      ip,
      userAgent,
    };
    await this.redis.set(
      `session:${sid}`,
      JSON.stringify(data),
      'EX',
      AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS,
    );
    return sid;
  }

  async getSession(sid: string): Promise<SessionData | null> {
    const value = await this.redis.get(`session:${sid}`);
    if (!value) return null;
    return JSON.parse(value) as SessionData;
  }

  async updateSession(sid: string, newRefreshHash: string): Promise<void> {
    const key = `session:${sid}`;
    const value = await this.redis.get(key);
    if (!value) return;

    const ttl = await this.redis.ttl(key);
    if (ttl <= 0) return;

    const data = JSON.parse(value) as SessionData;
    data.refreshTokenHash = newRefreshHash;
    data.lastActiveAt = new Date().toISOString();
    await this.redis.set(key, JSON.stringify(data), 'EX', ttl);
  }

  async getSessionByRefreshHash(refreshTokenHash: string): Promise<(SessionData & { id: string }) | null> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', 'session:*', 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length === 0) continue;
      const values = await this.redis.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        const raw = values[i];
        if (!raw) continue;
        const data = JSON.parse(raw) as SessionData;
        if (data.refreshTokenHash === refreshTokenHash) {
          return { ...data, id: keys[i].replace('session:', '') };
        }
      }
    } while (cursor !== '0');
    return null;
  }

  async deleteSession(sid: string): Promise<void> {
    await this.redis.del(`session:${sid}`);
  }

  // ─── Token Blacklist ─────────────────────────────────────

  async blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(`token:blacklist:${jti}`, '1', 'EX', ttlSeconds);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const exists = await this.redis.exists(`token:blacklist:${jti}`);
    return exists === 1;
  }
}
