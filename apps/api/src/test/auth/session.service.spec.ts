import { describe, it, expect, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';

// Set env vars BEFORE importing service
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = 'dGVzdA==';
process.env.JWT_PUBLIC_KEY = 'dGVzdA==';
process.env.CSRF_SECRET = 'test-secret';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { SessionService } from '../../modules/auth/session.service.js';

describe('SessionService', () => {
  let service: SessionService;
  let redis: InstanceType<typeof RedisMock>;

  beforeEach(() => {
    redis = new RedisMock();
    service = new SessionService(redis as any);
  });

  // ─── Challenge ───────────────────────────────────────────

  describe('storeChallenge / consumeChallenge', () => {
    it('should store and consume a challenge', async () => {
      await service.storeChallenge('nonce-1', '127.0.0.1');
      const result = await service.consumeChallenge('nonce-1');

      expect(result).not.toBeNull();
      expect(result!.ip).toBe('127.0.0.1');
      expect(result!.timestamp).toBeDefined();
    });

    it('should return null when consuming non-existent challenge', async () => {
      const result = await service.consumeChallenge('no-such-nonce');
      expect(result).toBeNull();
    });

    it('should return null on second consume (atomic)', async () => {
      await service.storeChallenge('nonce-2', '10.0.0.1');
      const first = await service.consumeChallenge('nonce-2');
      const second = await service.consumeChallenge('nonce-2');

      expect(first).not.toBeNull();
      expect(second).toBeNull();
    });
  });

  // ─── Session CRUD ────────────────────────────────────────

  describe('createSession / getSession', () => {
    it('should create a session and retrieve it', async () => {
      const sid = await service.createSession(
        'user-1',
        '0x' + 'a'.repeat(64),
        'org-1',
        'hash123',
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(sid).toBeDefined();
      expect(typeof sid).toBe('string');

      const session = await service.getSession(sid);
      expect(session).not.toBeNull();
      expect(session!.userId).toBe('user-1');
      expect(session!.address).toBe('0x' + 'a'.repeat(64));
      expect(session!.orgId).toBe('org-1');
      expect(session!.refreshTokenHash).toBe('hash123');
      expect(session!.ip).toBe('127.0.0.1');
      expect(session!.userAgent).toBe('Mozilla/5.0');
      expect(session!.createdAt).toBeDefined();
      expect(session!.lastActiveAt).toBeDefined();
    });

    it('should create session with null orgId', async () => {
      const sid = await service.createSession(
        'user-2',
        '0x' + 'b'.repeat(64),
        null,
        'hash456',
        '10.0.0.1',
        'curl/7',
      );
      const session = await service.getSession(sid);
      expect(session!.orgId).toBeNull();
    });

    it('should return null for non-existent session', async () => {
      const session = await service.getSession('no-such-sid');
      expect(session).toBeNull();
    });
  });

  // ─── updateSession ───────────────────────────────────────

  describe('updateSession', () => {
    it('should update refreshTokenHash and lastActiveAt', async () => {
      const sid = await service.createSession(
        'user-1',
        '0x' + 'a'.repeat(64),
        'org-1',
        'old-hash',
        '127.0.0.1',
        'Mozilla/5.0',
      );
      const before = await service.getSession(sid);

      // Small delay to ensure lastActiveAt differs
      await new Promise((r) => setTimeout(r, 10));
      await service.updateSession(sid, 'new-hash');

      const after = await service.getSession(sid);
      expect(after!.refreshTokenHash).toBe('new-hash');
      expect(after!.lastActiveAt).not.toBe(before!.lastActiveAt);
    });

    it('should throw or no-op for non-existent session', async () => {
      // updateSession on missing key should not throw (no-op)
      await expect(
        service.updateSession('missing-sid', 'hash'),
      ).resolves.not.toThrow();
    });
  });

  // ─── deleteSession ──────────────────────────────────────

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      const sid = await service.createSession(
        'user-1',
        '0x' + 'a'.repeat(64),
        'org-1',
        'hash',
        '127.0.0.1',
        'Mozilla',
      );
      await service.deleteSession(sid);
      const session = await service.getSession(sid);
      expect(session).toBeNull();
    });

    it('should not throw when deleting non-existent session', async () => {
      await expect(service.deleteSession('nope')).resolves.not.toThrow();
    });
  });

  // ─── Token Blacklist ─────────────────────────────────────

  describe('blacklistToken / isTokenBlacklisted', () => {
    it('should blacklist a token', async () => {
      await service.blacklistToken('jti-1', 900);
      const result = await service.isTokenBlacklisted('jti-1');
      expect(result).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      const result = await service.isTokenBlacklisted('jti-unknown');
      expect(result).toBe(false);
    });
  });

  // ─── Monkey Tests ────────────────────────────────────────

  describe('monkey tests', () => {
    it('concurrent sessions — delete one, others survive', async () => {
      const sids = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          service.createSession(
            `user-${i}`,
            '0x' + i.toString().repeat(64).slice(0, 64),
            null,
            `hash-${i}`,
            '127.0.0.1',
            'bot',
          ),
        ),
      );

      // Delete the middle one
      await service.deleteSession(sids[2]);

      for (let i = 0; i < 5; i++) {
        const s = await service.getSession(sids[i]);
        if (i === 2) {
          expect(s).toBeNull();
        } else {
          expect(s).not.toBeNull();
          expect(s!.userId).toBe(`user-${i}`);
        }
      }
    });

    it('expired challenge reuse — consume twice returns null second time', async () => {
      await service.storeChallenge('replay-nonce', '1.2.3.4');
      const first = await service.consumeChallenge('replay-nonce');
      expect(first).not.toBeNull();
      const second = await service.consumeChallenge('replay-nonce');
      expect(second).toBeNull();
      const third = await service.consumeChallenge('replay-nonce');
      expect(third).toBeNull();
    });

    it('very long user agent string (1000+ chars)', async () => {
      const longUA = 'A'.repeat(2000);
      const sid = await service.createSession(
        'user-long',
        '0x' + '0'.repeat(64),
        null,
        'hash',
        '127.0.0.1',
        longUA,
      );
      const session = await service.getSession(sid);
      expect(session!.userAgent).toBe(longUA);
      expect(session!.userAgent).toHaveLength(2000);
    });

    it('empty string edge cases', async () => {
      // Empty nonce for challenge
      await service.storeChallenge('', '');
      const c = await service.consumeChallenge('');
      expect(c).not.toBeNull();
      expect(c!.ip).toBe('');

      // Empty userId
      const sid = await service.createSession('', '', null, '', '', '');
      const s = await service.getSession(sid);
      expect(s).not.toBeNull();
      expect(s!.userId).toBe('');
    });

    it('special characters in nonce', async () => {
      const weirdNonce = 'nonce:with:colons/and/slashes?and=query&params';
      await service.storeChallenge(weirdNonce, '127.0.0.1');
      const result = await service.consumeChallenge(weirdNonce);
      expect(result).not.toBeNull();
      expect(result!.ip).toBe('127.0.0.1');
    });

    it('blacklist same jti twice — still blacklisted', async () => {
      await service.blacklistToken('double-jti', 300);
      await service.blacklistToken('double-jti', 600);
      expect(await service.isTokenBlacklisted('double-jti')).toBe(true);
    });

    it('multiple blacklisted tokens are independent', async () => {
      await service.blacklistToken('jti-a', 300);
      await service.blacklistToken('jti-b', 300);
      expect(await service.isTokenBlacklisted('jti-a')).toBe(true);
      expect(await service.isTokenBlacklisted('jti-b')).toBe(true);
      expect(await service.isTokenBlacklisted('jti-c')).toBe(false);
    });
  });
});
