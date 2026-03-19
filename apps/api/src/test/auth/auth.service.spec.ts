import { generateKeyPairSync } from 'node:crypto';

// Generate Ed25519 keys for test JWT
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
process.env.DATABASE_URL = 'postgresql://localhost/test';
process.env.REDIS_URL = 'redis://localhost';
process.env.JWT_PRIVATE_KEY = Buffer.from(
  privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
).toString('base64');
process.env.JWT_PUBLIC_KEY = Buffer.from(
  publicKey.export({ type: 'spki', format: 'pem' }) as string,
).toString('base64');
process.env.CSRF_SECRET = 'test-csrf-secret-at-least-16-chars';
process.env.SUI_RPC_URL = 'https://rpc.testnet.sui.io';
process.env.SUI_PACKAGE_ID = '0x0';
process.env.PLATFORM_KEYPAIR = 'dGVzdA==';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../modules/auth/auth.service.js';
import { JwtService } from '../../modules/auth/jwt.service.js';
import { SessionService } from '../../modules/auth/session.service.js';
import type { SessionData } from '../../modules/auth/session.service.js';

// Mock @mysten/sui/verify
vi.mock('@mysten/sui/verify', () => ({
  verifyPersonalMessageSignature: vi.fn(),
}));

vi.mock('@mysten/sui/zklogin', () => ({
  jwtToAddress: vi.fn().mockReturnValue('0x' + 'c'.repeat(64)),
}));

vi.mock('@mysten/sui/client', () => ({
  SuiClient: vi.fn().mockImplementation(() => ({
    getLatestSuiSystemState: vi.fn().mockResolvedValue({ epoch: '50' }),
  })),
}));

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let sessionService: SessionService;
  let usersRepo: any;

  const mockAddress = '0x' + 'a'.repeat(64);

  beforeEach(async () => {
    jwtService = new JwtService();
    await jwtService.onModuleInit();

    sessionService = {
      storeChallenge: vi.fn().mockResolvedValue(undefined),
      consumeChallenge: vi.fn(),
      createSession: vi.fn().mockResolvedValue('test-sid'),
      getSession: vi.fn(),
      getSessionByRefreshHash: vi.fn(),
      updateSession: vi.fn().mockResolvedValue(undefined),
      deleteSession: vi.fn().mockResolvedValue(undefined),
      blacklistToken: vi.fn().mockResolvedValue(undefined),
    } as any;

    usersRepo = {
      upsertByWallet: vi.fn().mockResolvedValue([
        {
          id: 'user-123',
          primaryWalletAddress: mockAddress,
          orgId: 'org-1',
          roleInOrg: 3,
        },
      ]),
      findByWalletAddress: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        id: 'user-123',
        primaryWalletAddress: mockAddress,
        displayName: 'Test User',
        orgId: 'org-1',
        roleInOrg: 3,
      }),
    };

    authService = new AuthService(jwtService, sessionService, usersRepo);
  });

  // ─── generateChallenge ───────────────────────────────────

  describe('generateChallenge', () => {
    it('returns nonce, timestamp, and expiresAt', async () => {
      const result = await authService.generateChallenge('127.0.0.1');

      expect(result.nonce).toHaveLength(24); // 12 bytes → 24 hex chars
      expect(result.timestamp).toBeTypeOf('number');
      expect(result.expiresAt).toBeGreaterThan(result.timestamp);
      expect(sessionService.storeChallenge).toHaveBeenCalledWith(result.nonce, '127.0.0.1');
    });

    it('generates unique nonces', async () => {
      const r1 = await authService.generateChallenge('1.1.1.1');
      const r2 = await authService.generateChallenge('1.1.1.1');
      expect(r1.nonce).not.toBe(r2.nonce);
    });
  });

  // ─── verifyAndLogin ──────────────────────────────────────

  describe('verifyAndLogin', () => {
    const dto = { address: mockAddress, signature: 'mock-sig', nonce: 'test-nonce' };
    const challengeData = { timestamp: new Date().toISOString(), ip: '127.0.0.1' };

    beforeEach(async () => {
      (sessionService.consumeChallenge as any).mockResolvedValue(challengeData);

      const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
      (verifyPersonalMessageSignature as any).mockResolvedValue({
        toSuiAddress: () => mockAddress,
      });
    });

    it('happy path: returns accessToken, refreshToken, and user', async () => {
      const result = await authService.verifyAndLogin(dto, '127.0.0.1', 'TestAgent');

      expect(result.accessToken).toBeTypeOf('string');
      expect(result.refreshToken).toBeTypeOf('string');
      expect(result.user.id).toBe('user-123');
      expect(result.user.address).toBe(mockAddress);
      expect(sessionService.consumeChallenge).toHaveBeenCalledWith('test-nonce');
      expect(usersRepo.upsertByWallet).toHaveBeenCalledWith({ primaryWalletAddress: mockAddress });
      expect(sessionService.createSession).toHaveBeenCalled();
    });

    it('throws INVALID_NONCE when nonce is expired/invalid', async () => {
      (sessionService.consumeChallenge as any).mockResolvedValue(null);

      try {
        await authService.verifyAndLogin(dto, '127.0.0.1', '');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as any).getResponse()).toMatchObject({ code: 'INVALID_NONCE' });
      }
    });

    it('throws INVALID_SIGNATURE when signature verification fails', async () => {
      const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
      (verifyPersonalMessageSignature as any).mockRejectedValue(new Error('bad sig'));

      await expect(authService.verifyAndLogin(dto, '127.0.0.1', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws INVALID_SIGNATURE when recovered address mismatches', async () => {
      const { verifyPersonalMessageSignature } = await import('@mysten/sui/verify');
      (verifyPersonalMessageSignature as any).mockResolvedValue({
        toSuiAddress: () => '0x' + 'b'.repeat(64),
      });

      await expect(authService.verifyAndLogin(dto, '127.0.0.1', '')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── refresh ─────────────────────────────────────────────

  describe('refresh', () => {
    const sid = 'test-sid';
    let storedRefreshToken: string;
    let storedHash: string;

    beforeEach(() => {
      storedRefreshToken = jwtService.generateRefreshToken();
      storedHash = jwtService.hashRefreshToken(storedRefreshToken);

      const sessionData: SessionData = {
        userId: 'user-123',
        address: mockAddress,
        orgId: 'org-1',
        refreshTokenHash: storedHash,
        createdAt: new Date().toISOString(),
        lastActiveAt: new Date().toISOString(),
        ip: '127.0.0.1',
        userAgent: 'TestAgent',
      };
      (sessionService.getSession as any).mockResolvedValue(sessionData);
    });

    it('happy path: returns new accessToken and refreshToken', async () => {
      const result = await authService.refresh(storedRefreshToken, sid);

      expect(result.accessToken).toBeTypeOf('string');
      expect(result.refreshToken).toBeTypeOf('string');
      expect(result.refreshToken).not.toBe(storedRefreshToken);
      expect(sessionService.updateSession).toHaveBeenCalled();
    });

    it('throws SESSION_EXPIRED when session not found', async () => {
      (sessionService.getSession as any).mockResolvedValue(null);

      try {
        await authService.refresh('any-token', sid);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as any).getResponse()).toMatchObject({ code: 'SESSION_EXPIRED' });
      }
    });

    it('throws TOKEN_REUSE_DETECTED and deletes session on hash mismatch', async () => {
      try {
        await authService.refresh('wrong-token', sid);
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(UnauthorizedException);
        expect((err as any).getResponse()).toMatchObject({ code: 'TOKEN_REUSE_DETECTED' });
      }
      expect(sessionService.deleteSession).toHaveBeenCalledWith(sid);
    });
  });

  // ─── logout ──────────────────────────────────────────────

  describe('logout', () => {
    it('deletes session and blacklists jti', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 600;
      await authService.logout('sid-1', 'jti-1', futureExp);

      expect(sessionService.deleteSession).toHaveBeenCalledWith('sid-1');
      expect(sessionService.blacklistToken).toHaveBeenCalledWith('jti-1', expect.any(Number));
    });

    it('does not blacklist if token already expired', async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 100;
      await authService.logout('sid-1', 'jti-1', pastExp);

      expect(sessionService.deleteSession).toHaveBeenCalledWith('sid-1');
      expect(sessionService.blacklistToken).not.toHaveBeenCalled();
    });
  });

  // ─── CSRF ────────────────────────────────────────────────

  describe('CSRF tokens', () => {
    it('generate and verify round-trip', () => {
      const token = authService.generateCsrfToken();
      expect(authService.verifyCsrfToken(token)).toBe(true);
    });

    it('rejects tampered token', () => {
      const token = authService.generateCsrfToken();
      const tampered = token.slice(0, -2) + 'ff';
      expect(authService.verifyCsrfToken(tampered)).toBe(false);
    });

    it('rejects malformed token', () => {
      expect(authService.verifyCsrfToken('no-dot-here')).toBe(false);
      expect(authService.verifyCsrfToken('')).toBe(false);
    });

    it('rejects token with wrong random part', () => {
      const token = authService.generateCsrfToken();
      const [, hmac] = token.split('.');
      const fakeRandom = 'a'.repeat(64);
      expect(authService.verifyCsrfToken(`${fakeRandom}.${hmac}`)).toBe(false);
    });
  });

  // ─── verifyZkLogin ──────────────────────────────────────

  describe('verifyZkLogin', () => {
    const validJwt = [
      btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
      btoa(JSON.stringify({ iss: 'https://accounts.google.com', sub: 'user123', aud: 'test', exp: 9999999999 })),
      'fakesig',
    ].map(s => s.replace(/=/g, '')).join('.');

    const validDto = {
      jwt: validJwt,
      zkProof: {
        proofPoints: { a: ['1'], b: [['2']], c: ['3'] },
        issBase64Details: { value: 'base64iss', indexMod4: 1 },
        headerBase64: 'base64header',
      },
      ephemeralPubKey: 'ephemeral-pub-key',
      maxEpoch: 55, // within range of current epoch 50
      salt: 'test-salt',
    };

    it('happy path: returns accessToken and user', async () => {
      const result = await authService.verifyZkLogin(validDto, '127.0.0.1', 'TestAgent');
      expect(result.accessToken).toBeTypeOf('string');
      expect(result.refreshToken).toBeTypeOf('string');
      expect(result.user.address).toBe('0x' + 'c'.repeat(64));
      expect(sessionService.createSession).toHaveBeenCalled();
    });

    it('throws INVALID_JWT when JWT has no iss', async () => {
      const badJwt = [
        btoa(JSON.stringify({ alg: 'RS256' })),
        btoa(JSON.stringify({ sub: 'user123' })),
        'fake',
      ].map(s => s.replace(/=/g, '')).join('.');

      await expect(
        authService.verifyZkLogin({ ...validDto, jwt: badJwt }, '127.0.0.1', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws EXPIRED_EPOCH when maxEpoch < currentEpoch', async () => {
      await expect(
        authService.verifyZkLogin({ ...validDto, maxEpoch: 40 }, '127.0.0.1', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws INVALID_EPOCH when maxEpoch too far in future', async () => {
      await expect(
        authService.verifyZkLogin({ ...validDto, maxEpoch: 100 }, '127.0.0.1', ''),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws INVALID_ZK_PROOF when proof is malformed', async () => {
      await expect(
        authService.verifyZkLogin({
          ...validDto,
          zkProof: { proofPoints: { a: [], b: [], c: [] }, issBase64Details: { value: '', indexMod4: 0 }, headerBase64: '' },
        }, '127.0.0.1', ''),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── Monkey / Edge-case tests ────────────────────────────

  describe('edge cases', () => {
    it('generateChallenge with empty IP', async () => {
      const result = await authService.generateChallenge('');
      expect(result.nonce).toHaveLength(24);
      expect(sessionService.storeChallenge).toHaveBeenCalledWith(result.nonce, '');
    });

    it('refresh with empty sid', async () => {
      (sessionService.getSession as any).mockResolvedValue(null);
      await expect(authService.refresh('token', '')).rejects.toThrow(UnauthorizedException);
    });

    it('verifyCsrfToken with dots in random part', () => {
      expect(authService.verifyCsrfToken('a.b.c')).toBe(false);
    });

    it('logout with zero exp does not blacklist', async () => {
      await authService.logout('sid', 'jti', 0);
      expect(sessionService.blacklistToken).not.toHaveBeenCalled();
    });
  });
});
